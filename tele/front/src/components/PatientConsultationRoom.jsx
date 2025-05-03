import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from './Socket';
import WebRTCMetricsCollector from '../utils/WebRTCMetrics';
import MetricsDisplay from './MetricsDisplay';
import VideoCompressor from '../utils/VideoCompression';
import CompressionStats from './CompressionStats';
import browserFacialPainDetector from '../utils/BrowserFacialPainDetection';

function PatientConsultationRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [consultationDetails, setConsultationDetails] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [prescription, setPrescription] = useState('');
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionStats, setCompressionStats] = useState(null);
  const [isCompressionReady, setIsCompressionReady] = useState(false);
  const [facialPainDetectionActive, setFacialPainDetectionActive] = useState(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef(null);
  const chatContainerRef = useRef(null);
  const metricsCollector = useRef(null);
  const videoCompressor = useRef(null);
  const originalStream = useRef(null);

  // WebRTC Configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Use a ref to track if we've already joined the room
  const hasJoinedRoom = useRef(false);

  useEffect(() => {
    if (!socket) {
      console.error("Socket not available");
      return;
    }
    
    console.log("Patient room - Socket status:", {
      connected: socket.connected,
      id: socket.id
    });
    
    // Only join the room and get consultation details once
    if (!hasJoinedRoom.current) {
      console.log(`Joining room ${roomId} for the first time`);
      socket.emit('join-room', { room: roomId });
      socket.emit('get-consultation-details', roomId);
      hasJoinedRoom.current = true;
    }

    // Remove any existing listeners first to prevent duplicates
    socket.off('consultation-details').on('consultation-details', (details) => {
      console.log('Consultation details received:', details);
      setConsultationDetails(details);
      initializeWebRTC();
    });

    setupSocketListeners();

    return () => {
      cleanupMediaStreams();
      cleanupSocketListeners();
      
      // Stop facial pain detection when component unmounts
      browserFacialPainDetector.stop();
      
      // Reset the joined room flag when component unmounts
      hasJoinedRoom.current = false;
    };
  }, [socket, roomId]); // It's safe to include both dependencies with our ref guard

  const setupSocketListeners = () => {
    // Remove any existing listeners first to prevent duplicates
    socket.off('chat-message').on('chat-message', handleChatMessage);
    socket.off('offer').on('offer', handleOffer);
    socket.off('ice-candidate').on('ice-candidate', handleIceCandidate);
    socket.off('consultation-ended').on('consultation-ended', handleConsultationEnded);
  };

  const cleanupSocketListeners = () => {
    socket.off('chat-message');
    socket.off('offer');
    socket.off('ice-candidate');
    socket.off('consultation-ended');
  };

  const handleChatMessage = (message) => {
    setMessages(prev => [...prev, message]);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleOffer = async (offer) => {
    try {
      console.log('Received offer:', offer);
      if (!peerConnection.current) {
        await initializeWebRTC();
      }
      
      // Check the signaling state and handle accordingly
      const signalingState = peerConnection.current.signalingState;
      console.log('Current signaling state:', signalingState);
      
      // If we're already in a negotiation, we need to handle it differently
      if (signalingState === 'stable') {
        // Normal case - we can proceed with the offer
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Creating answer...');
        const answer = await peerConnection.current.createAnswer();
        console.log('Setting local description...');
        await peerConnection.current.setLocalDescription(answer);
        console.log('Sending answer:', answer);
        socket.emit('answer', { roomId, answer });
        setConnectionStatus('connected');
      } else if (signalingState === 'have-local-offer') {
        // We've already sent an offer, but received another one
        // This is a collision, we need to handle it based on some tie-breaker
        console.warn('Offer collision detected. Current state:', signalingState);
        
        // Simple tie-breaker: use the "lower" socket ID
        const isLower = socket.id < offer.from; // Assuming offer has a 'from' field with socket ID
        
        if (isLower) {
          console.log('We win the collision. Ignoring their offer.');
          // Do nothing, wait for them to accept our offer
        } else {
          console.log('They win the collision. Accepting their offer.');
          // Roll back our offer
          await peerConnection.current.setLocalDescription({type: 'rollback'});
          // Accept their offer
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit('answer', { roomId, answer });
        }
      } else {
        console.warn('Cannot handle offer in current state:', signalingState);
        // Try to reset the connection
        if (signalingState !== 'closed') {
          console.log('Attempting to reset the connection...');
          peerConnection.current.close();
          await initializeWebRTC();
          // Now try again with the offer
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit('answer', { roomId, answer });
        }
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      setError('Failed to establish connection');
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        console.log('Adding ICE candidate:', candidate);
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('Queuing ICE candidate for later');
        // Store candidate to add later when remote description is set
        if (!peerConnection.current.queuedCandidates) {
          peerConnection.current.queuedCandidates = [];
        }
        peerConnection.current.queuedCandidates.push(candidate);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const handleConsultationEnded = (data) => {
    setPrescription(data.prescription || '');
    navigate('/consultation-summary');
  };

  const initializeWebRTC = async () => {
    try {
      // Get user media with high quality for potential compression
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Store the original stream for later use with compression
      originalStream.current = stream;
      
      // Initialize the video compressor
      videoCompressor.current = new VideoCompressor({
        targetBitrate: 500, // Initial target bitrate in kbps
        adaptiveMode: true,
        debugOverlay: true, // Show debug overlay on video
        onStatsUpdate: (stats) => {
          setCompressionStats(stats);
        }
      });
      
      // Initialize the compressor in the background
      videoCompressor.current.initialize().then(success => {
        if (success) {
          setIsCompressionReady(true);
          console.log('AI video compression is ready');
        } else {
          console.error('Failed to initialize AI video compression');
        }
      });
      
      // Use the original stream initially
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection(rtcConfiguration);

      // Initialize metrics collector
      metricsCollector.current = new WebRTCMetricsCollector({
        role: 'patient',
        compression: compressionEnabled,
        onMetricsCollected: (metrics) => {
          setCurrentMetrics(metrics);
          
          // Update network stats for the video compressor
          if (videoCompressor.current && isCompressionReady) {
            videoCompressor.current.updateNetworkStats({
              rtt: metrics.rtt_ms,
              jitter: metrics.jitter_ms,
              packetsLost: metrics.packets_lost,
              bitrate: metrics.bitrate_kbps_outbound
            });
          }
        }
      });
      
      // Set the peer connection to monitor
      metricsCollector.current.setPeerConnection(peerConnection.current);
      
      // Start collecting metrics
      metricsCollector.current.startCollection();

      // Add tracks from the original stream to the peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        
        // Log track received event
        metricsCollector.current?.logEvent('track_received', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          muted: event.track.muted
        });
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate);
          socket.emit('ice-candidate', {
            roomId,
            candidate: event.candidate
          });
          
          // Log ICE candidate event
          metricsCollector.current?.logEvent('ice_candidate_sent');
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current.connectionState;
        console.log('Connection state changed:', state);
        setConnectionStatus(state);
        
        // Log connection state change
        metricsCollector.current?.logEvent('connection_state_change', { state });
        
        // If connected, log a connection established event
        if (state === 'connected') {
          metricsCollector.current?.logEvent('connection_established');
          
          // Initialize and start facial pain detection when connection is established
          initializeFacialPainDetection();
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          metricsCollector.current?.logEvent('connection_ended', { state });
          metricsCollector.current?.stopCollection();
          
          // Stop facial pain detection if connection is lost
          browserFacialPainDetector.stop();
          setFacialPainDetectionActive(false);
        }
      };

      // Process any queued ICE candidates
      if (peerConnection.current.queuedCandidates) {
        console.log('Processing queued ICE candidates...');
        for (const candidate of peerConnection.current.queuedCandidates) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        peerConnection.current.queuedCandidates = [];
      }

      setIsCallActive(true);
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      setError('Failed to access camera/microphone');
    }
  };
  
  // Initialize and start facial pain detection
  const initializeFacialPainDetection = async () => {
    try {
      // Create a canvas element for debug visualization
      const facialPainCanvas = document.createElement('canvas');
      facialPainCanvas.width = localVideoRef.current.videoWidth || 640;
      facialPainCanvas.height = localVideoRef.current.videoHeight || 480;
      facialPainCanvas.style.position = 'absolute';
      facialPainCanvas.style.top = '10px';
      facialPainCanvas.style.right = '10px';
      facialPainCanvas.style.width = '320px';  // Smaller size for overlay
      facialPainCanvas.style.height = '240px';
      facialPainCanvas.style.zIndex = '1000';
      facialPainCanvas.style.border = '2px solid red';
      document.body.appendChild(facialPainCanvas);
      
      console.log('Created debug canvas for facial pain detection');
      
      // Initialize the facial pain detector
      console.log('Initializing facial pain detector with roomId:', roomId);
      const initialized = await browserFacialPainDetector.initialize({
        videoElement: localVideoRef.current,
        canvasElement: facialPainCanvas,
        socket: socket,
        roomId: roomId, // Make sure roomId is passed correctly
        debug: true, // Enable visualization for debugging
        onPainDetected: (regions) => {
          console.log('Pain detected:', regions);
          
          // Also manually emit the pain data with roomId to ensure it's sent
          if (regions && regions.length > 0) {
            const painData = {
              type: "facial_pain",
              roomId: roomId,
              regions: regions
            };
            
            // Send with both event names
            socket.emit('pain_data', painData);
            socket.emit('facial-pain-update', painData);
            console.log('Manual pain data emission with roomId:', roomId);
            
            // Also dispatch a local event for direct testing
            const testEvent = new CustomEvent('test-pain-data', { 
              detail: painData 
            });
            window.dispatchEvent(testEvent);
          }
        }
      });
      
      if (initialized) {
        // Start the facial pain detection
        const started = browserFacialPainDetector.start();
        setFacialPainDetectionActive(started);
        
        if (started) {
          console.log('In-browser facial pain detection started');
          
          // Add a test pain signal for debugging
          setTimeout(() => {
            console.log('Sending test pain signal');
            // Use both event names for consistency
            const testData = {
              type: "facial_pain",
              roomId: roomId,
              regions: [
                {
                  region: "jaw",
                  intensity: 0.7,
                  description: "Jaw/TMJ pain"
                },
                {
                  region: "head",
                  intensity: 0.5,
                  description: "Headache/Migraine"
                }
              ]
            };
            
            socket.emit('facial-pain-update', testData);
            socket.emit('pain_data', testData);
            console.log('Test pain data sent with both event names');
          }, 5000);
        } else {
          console.error('Failed to start facial pain detection');
        }
      } else {
        console.error('Failed to initialize facial pain detection');
      }
    } catch (error) {
      console.error('Error initializing facial pain detection:', error);
    }
  };

  const cleanupMediaStreams = () => {
    // Stop metrics collection
    if (metricsCollector.current) {
      metricsCollector.current.logEvent('cleanup_initiated');
      metricsCollector.current.stopCollection();
    }
    
    // Stop video compression
    if (videoCompressor.current) {
      videoCompressor.current.stop();
    }
    
    // Stop facial pain detection
    browserFacialPainDetector.stop();
    setFacialPainDetectionActive(false);
    
    // Remove any debug canvas elements that might have been created
    const canvasElements = document.querySelectorAll('canvas');
    canvasElements.forEach(canvas => {
      if (canvas.style.display === 'none') {
        canvas.remove();
      }
    });
    
    // Stop media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Stop original stream if different
    if (originalStream.current && originalStream.current !== localStream) {
      originalStream.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
    }
  };

  // Toggle AI-based compression
  const toggleCompression = async () => {
    // Check if compression is ready
    if (!isCompressionReady && !compressionEnabled) {
      console.warn('AI compression is not ready yet');
      return;
    }
    
    const newState = !compressionEnabled;
    setCompressionEnabled(newState);
    
    try {
      // Update the metrics collector
      if (metricsCollector.current) {
        metricsCollector.current.setCompression(newState);
        metricsCollector.current.logEvent('compression_toggled', { enabled: newState });
      }
      
      if (newState) {
        // Enable compression
        console.log('Enabling AI-based video compression...');
        
        // Process the original stream with AI compression
        if (originalStream.current && videoCompressor.current) {
          // Get the compressed stream
          const compressedStream = await videoCompressor.current.processStream(originalStream.current);
          
          // Replace the current stream with the compressed one
          const senders = peerConnection.current.getSenders();
          const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
          
          if (videoSender) {
            // Get the video track from the compressed stream
            const compressedVideoTrack = compressedStream.getVideoTracks()[0];
            
            if (compressedVideoTrack) {
              // Replace the track in the peer connection
              await videoSender.replaceTrack(compressedVideoTrack);
              
              // Update the local video display
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = compressedStream;
              }
              
              // Update the local stream reference
              setLocalStream(compressedStream);
              
              // Log the event in metrics collector
              metricsCollector.current?.logEvent('compression_applied', {
                originalResolution: `${originalStream.current.getVideoTracks()[0].getSettings().width}x${originalStream.current.getVideoTracks()[0].getSettings().height}`,
                compressedResolution: `${compressedVideoTrack.getSettings().width}x${compressedVideoTrack.getSettings().height}`,
                originalFrameRate: originalStream.current.getVideoTracks()[0].getSettings().frameRate,
                compressedFrameRate: compressedVideoTrack.getSettings().frameRate
              });
              
              // Force a refresh of the metrics collector's peer connection reference
              // This ensures it continues to collect metrics after track replacement
              if (metricsCollector.current) {
                metricsCollector.current.setPeerConnection(peerConnection.current);
                
                // Wait a moment and then restart collection to ensure fresh stats
                setTimeout(() => {
                  metricsCollector.current.stopCollection();
                  metricsCollector.current.startCollection();
                }, 1000);
              }
              
              console.log('Video track replaced with AI-compressed version');
            }
          }
        }
      } else {
        // Disable compression - revert to original stream
        console.log('Disabling AI-based video compression...');
        
        if (originalStream.current) {
          // Replace the current stream with the original one
          const senders = peerConnection.current.getSenders();
          const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
          
          if (videoSender) {
            // Get the original video track
            const originalVideoTrack = originalStream.current.getVideoTracks()[0];
            
            if (originalVideoTrack) {
              // Replace the track in the peer connection
              await videoSender.replaceTrack(originalVideoTrack);
              
              // Update the local video display
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = originalStream.current;
              }
              
              // Update the local stream reference
              setLocalStream(originalStream.current);
              
              console.log('Reverted to original video track');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error toggling compression:', error);
      // Revert the state if there was an error
      setCompressionEnabled(!newState);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Patient's Consultation Room</h1>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              {connectionStatus}
            </span>
            <span className="text-gray-400">Room: {roomId}</span>
            
            {/* Compression Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-sm">AI Compression:</span>
              <button 
                onClick={toggleCompression}
                disabled={!isCompressionReady && !compressionEnabled}
                className={`px-3 py-1 rounded-full text-sm ${
                  !isCompressionReady && !compressionEnabled 
                    ? 'bg-gray-500 cursor-not-allowed' 
                    : compressionEnabled 
                      ? 'bg-green-500' 
                      : 'bg-gray-600'
                }`}
              >
                {!isCompressionReady && !compressionEnabled 
                  ? 'LOADING...' 
                  : compressionEnabled 
                    ? 'ON' 
                    : 'OFF'
                }
              </button>
              {compressionEnabled && compressionStats && (
                <span className="text-xs text-green-400">
                  {compressionStats.compressionRatio 
                    ? `${compressionStats.compressionRatio.toFixed(1)}x compression` 
                    : ''}
                </span>
              )}
            </div>
            
            {/* Facial Pain Detection Toggle */}
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-sm">Facial Pain Detection:</span>
              <button 
                onClick={() => {
                  if (facialPainDetectionActive) {
                    browserFacialPainDetector.stop();
                    setFacialPainDetectionActive(false);
                  } else {
                    initializeFacialPainDetection();
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  facialPainDetectionActive 
                    ? 'bg-green-500' 
                    : 'bg-gray-600'
                }`}
              >
                {facialPainDetectionActive ? 'ON' : 'OFF'}
              </button>
              {facialPainDetectionActive && (
                <span className="text-xs text-green-400">
                  Analyzing facial expressions
                </span>
              )}
              
              {/* Manual Test Button */}
              {facialPainDetectionActive && (
                <button 
                  onClick={() => {
                    console.log('Sending manual test pain signal');
                    // Use both event names for consistency
                    const testData = {
                      type: "facial_pain",
                      roomId: roomId,
                      regions: [
                        {
                          region: "jaw",
                          intensity: 0.9,
                          description: "Jaw/TMJ pain"
                        },
                        {
                          region: "head",
                          intensity: 0.8,
                          description: "Headache/Migraine"
                        }
                      ]
                    };
                    
                    socket.emit('facial-pain-update', testData);
                    socket.emit('pain_data', testData);
                    console.log('Manual test pain data sent with both event names');
                  }}
                  className="px-3 py-1 rounded-full text-sm bg-red-500 ml-2"
                >
                  Test Pain
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content - Videos and Controls */}
          <div className="col-span-2">
            {/* Video Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Doctor's Video (Remote) */}
              <div className="relative bg-gray-800 rounded-lg aspect-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  Doctor
                </div>
              </div>

              {/* Patient's Video (Local) */}
              <div className="relative bg-gray-800 rounded-lg aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  You (Patient)
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center space-x-4 mb-6">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-600'}`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-600'}`}
              >
                {isVideoOff ? 'Start Video' : 'Stop Video'}
              </button>
            </div>

            {/* Consultation Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Consultation Status</h3>
              <p className="text-gray-300">
                {isCallActive ? 'Consultation in progress...' : 'Waiting for doctor...'}
              </p>
            </div>
          </div>

          {/* Sidebar - Chat */}
          <div className="col-span-1">
            {/* Chat */}
            <div className="bg-gray-800 rounded-lg p-4 h-[600px] flex flex-col">
              <h3 className="text-lg font-semibold mb-2">Chat with Doctor</h3>
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 space-y-2"
              >
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      message.sender === 'patient' ? 'bg-blue-600 ml-auto' : 'bg-gray-700'
                    } max-w-[80%]`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs text-gray-400">{new Date(message.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (newMessage.trim()) {
                  const message = {
                    text: newMessage,
                    sender: 'patient',
                    timestamp: new Date().toISOString()
                  };
                  socket.emit('chat-message', { roomId, message });
                  setMessages(prev => [...prev, message]);
                  setNewMessage('');
                }
              }}>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-gray-700 rounded px-3 py-2"
                    placeholder="Type a message..."
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 px-4 py-2 rounded"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      {/* Metrics Display */}
      {currentMetrics && <MetricsDisplay metrics={currentMetrics} />}
      
      {/* Compression Stats Display */}
      {compressionEnabled && compressionStats && <CompressionStats stats={compressionStats} />}
    </div>
  );
}

export default PatientConsultationRoom; 