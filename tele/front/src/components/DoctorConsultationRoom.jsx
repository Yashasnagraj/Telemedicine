import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from './Socket';
import FacialPainPanel from './FacialPainPanel';

function DoctorConsultationRoom() {
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef(null);
  const screenStream = useRef(null);
  const chatContainerRef = useRef(null);

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
    
    console.log("Doctor room - Socket status:", {
      connected: socket.connected,
      id: socket.id
    });
    
    // Only join the room and get consultation details once
    if (!hasJoinedRoom.current) {
      console.log(`Doctor joining room ${roomId} for the first time`);
      socket.emit('join-room', { room: roomId });
      socket.emit('get-consultation-details', roomId);
      hasJoinedRoom.current = true;
    }

    // Remove any existing listeners first to prevent duplicates
    socket.off('consultation-details').on('consultation-details', (details) => {
      console.log('Consultation details received:', details);
      setConsultationDetails(details);
      // Don't call initializeWebRTC here - it will be called in a separate useEffect
    });

    setupSocketListeners();

    return () => {
      cleanupMediaStreams();
      cleanupSocketListeners();
      
      // Reset the joined room flag when component unmounts
      hasJoinedRoom.current = false;
    };
  }, [socket, roomId]); // It's safe to include both dependencies with our ref guard
  
  // Separate useEffect for WebRTC initialization
  useEffect(() => {
    if (socket && socket.connected && consultationDetails && !peerConnection.current) {
      console.log('Initializing WebRTC after consultation details received');
      initializeWebRTC();
    }
  }, [socket, consultationDetails]);

  const setupSocketListeners = () => {
    // Remove any existing listeners first to prevent duplicates
    socket.off('chat-message').on('chat-message', handleChatMessage);
    socket.off('answer').on('answer', handleAnswer);
    socket.off('ice-candidate').on('ice-candidate', handleIceCandidate);
    
    // Listen for pain data from the patient
    socket.off('receive_pain_data').on('receive_pain_data', (data) => {
      console.log("Pain data received via receive_pain_data:", data);
      // The FacialPainPanel component will handle this data
    });
    
    // Also listen for the original event name for backward compatibility
    socket.off('facial-pain-update').on('facial-pain-update', (data) => {
      console.log("Pain data received via facial-pain-update:", data);
      // The FacialPainPanel component will handle this data
    });
  };

  const cleanupSocketListeners = () => {
    socket.off('chat-message');
    socket.off('answer');
    socket.off('ice-candidate');
    socket.off('receive_pain_data');
    socket.off('facial-pain-update');
  };

  const handleChatMessage = (message) => {
    setMessages(prev => [...prev, message]);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleAnswer = async (answer) => {
    try {
      console.log('Received answer:', answer);
      if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description set successfully');
        setConnectionStatus('connected');
      } else {
        console.warn('Cannot set remote description in current state:', peerConnection.current?.signalingState);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
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

  // Use a ref to track if we've already created an offer
  const hasCreatedOffer = useRef(false);

  const initializeWebRTC = async () => {
    try {
      // Prevent multiple initializations
      if (peerConnection.current) {
        console.log('WebRTC already initialized, skipping...');
        return;
      }

      console.log('Initializing WebRTC...');
      
      // Create a new RTCPeerConnection first
      peerConnection.current = new RTCPeerConnection(rtcConfiguration);
      
      // Set up event handlers before adding tracks
      peerConnection.current.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate);
          socket.emit('ice-candidate', {
            roomId,
            candidate: event.candidate
          });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log('Connection state changed:', peerConnection.current.connectionState);
        setConnectionStatus(peerConnection.current.connectionState);
      };
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to the peer connection
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      // Only create and send offer if we haven't done so already
      if (!hasCreatedOffer.current) {
        console.log('Creating offer...');
        
        const offer = await peerConnection.current.createOffer();
        console.log('Setting local description...');
        await peerConnection.current.setLocalDescription(offer);
        
        // Mark as created only after successfully setting local description
        hasCreatedOffer.current = true;
        
        console.log('Sending offer:', offer);
        socket.emit('offer', { roomId, offer });
      } else {
        console.log('Offer already created, skipping...');
      }

      setIsCallActive(true);
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      setError('Failed to access camera/microphone');
      
      // Clean up if there was an error
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      hasCreatedOffer.current = false;
    }
  };

  const cleanupMediaStreams = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream.current) {
      screenStream.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
  };

  const handleEndConsultation = () => {
    socket.emit('end-consultation', {
      roomId,
      notes,
      prescription
    });
    navigate('/doctor-dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Doctor's Consultation Room</h1>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              {connectionStatus}
            </span>
            <span className="text-gray-400">Room: {roomId}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content - Videos and Controls */}
          <div className="col-span-2">
            {/* Video Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Patient's Video (Remote) */}
              <div className="relative bg-gray-800 rounded-lg aspect-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  Patient
                </div>
              </div>

              {/* Doctor's Video (Local) */}
              <div className="relative bg-gray-800 rounded-lg aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  You (Doctor)
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
              <button
                onClick={handleEndConsultation}
                className="p-3 rounded-full bg-red-500"
              >
                End Consultation
              </button>
              
              {/* Test Pain Data Button - Local Event */}
              <button
                onClick={() => {
                  console.log('Doctor: Testing pain data reception (local event)');
                  
                  // Create test pain data
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
                  
                  // Directly update the FacialPainPanel component
                  // This bypasses the socket and tests if the component can render pain data
                  const painUpdateEvent = new CustomEvent('test-pain-data', { 
                    detail: testData 
                  });
                  window.dispatchEvent(painUpdateEvent);
                  
                  console.log('Doctor: Test pain data dispatched locally');
                }}
                className="p-3 rounded-full bg-purple-500 ml-2"
              >
                Test Local
              </button>
              
              {/* Test Pain Data Button - Socket Emit */}
              <button
                onClick={() => {
                  console.log('Doctor: Testing pain data via socket');
                  
                  // Create test pain data
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
                    ],
                    timestamp: Date.now()
                  };
                  
                  // Emit via socket to test the full data flow
                  socket.emit('pain_data', testData);
                  socket.emit('facial-pain-update', testData);
                  socket.emit('facial_pain_data', testData); // Try additional event name
                  
                  console.log('Doctor: Test pain data emitted via socket:', testData);
                  console.log('Socket connected:', socket.connected, 'Socket ID:', socket.id);
                }}
                className="p-3 rounded-full bg-green-500 ml-2"
              >
                Test Socket
              </button>
            </div>

            {/* Medical Notes */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Medical Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-32 bg-gray-700 rounded p-2 text-white"
                placeholder="Enter medical notes here..."
              />
            </div>

            {/* Prescription */}
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <h3 className="text-lg font-semibold mb-2">Prescription</h3>
              <textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                className="w-full h-32 bg-gray-700 rounded p-2 text-white"
                placeholder="Enter prescription here..."
              />
            </div>
          </div>

          {/* Sidebar - Patient Info and Chat */}
          <div className="col-span-1">
            {/* Patient Information */}
            {consultationDetails && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold mb-2">Patient Information</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-400">Name:</span> {consultationDetails.name}</p>
                  <p><span className="text-gray-400">Age:</span> {consultationDetails.age}</p>
                  <p><span className="text-gray-400">Symptoms:</span> {consultationDetails.symptoms}</p>
                  <p><span className="text-gray-400">Description:</span> {consultationDetails.description}</p>
                </div>
              </div>
            )}
            
            {/* Facial Pain Detection Panel */}
            <FacialPainPanel roomId={roomId} />

            {/* Chat */}
            <div className="bg-gray-800 rounded-lg p-4 h-[400px] flex flex-col">
              <h3 className="text-lg font-semibold mb-2">Chat</h3>
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 space-y-2"
              >
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      message.sender === 'doctor' ? 'bg-blue-600 ml-auto' : 'bg-gray-700'
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
                    sender: 'doctor',
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
    </div>
  );
}

export default DoctorConsultationRoom; 