import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from './Socket';

function ConsultationRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [participantType, setParticipantType] = useState(null);
  const [consultationDetails, setConsultationDetails] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef(null);
  const screenStream = useRef(null);
  const chatContainerRef = useRef(null);

  // WebRTC Configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'username',
        credential: 'password'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all'
  };

  useEffect(() => {
    // Join the room when component mounts
    socket.emit('join-room', { room: roomId });

    // Get user type and consultation details
    socket.emit('get-consultation-details', roomId);
    socket.on('consultation-details', (details) => {
      console.log('Consultation details received:', details);
      setConsultationDetails(details);
      setParticipantType(details.participantType);
      // Initialize WebRTC after getting participant type
      initializeWebRTC();
    });

    // Set up chat listeners
    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });

    // Set up WebRTC signaling
    socket.on('offer', async (offer) => {
      console.log('Received offer:', offer);
      try {
        if (!peerConnection.current) {
          await initializeWebRTC();
        }
        await peerConnection.current.setRemoteDescription(offer);
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
      } catch (error) {
        console.error('Error handling offer:', error);
        setError('Failed to establish connection. Please try again.');
      }
    });

    socket.on('answer', async (answer) => {
      console.log('Received answer:', answer);
      try {
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(answer);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
        setError('Failed to establish connection. Please try again.');
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      console.log('Received ICE candidate:', candidate);
      try {
        if (peerConnection.current) {
          await peerConnection.current.addIceCandidate(candidate);
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    // Cleanup
    return () => {
      cleanupMediaStreams();
      socket.off('chat-message');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [roomId]);

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

  const initializeWebRTC = async () => {
    try {
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
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection with enhanced configuration
      peerConnection.current = new RTCPeerConnection(rtcConfiguration);

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      // Handle connection state changes
      peerConnection.current.onconnectionstatechange = () => {
        setConnectionStatus(peerConnection.current.connectionState);
        if (peerConnection.current.connectionState === 'failed') {
          handleReconnection();
        }
      };

      // Handle ICE connection state changes
      peerConnection.current.oniceconnectionstatechange = () => {
        if (peerConnection.current.iceConnectionState === 'failed') {
          handleReconnection();
        }
      };

      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            roomId,
            candidate: event.candidate
          });
        }
      };

      // If doctor, create and send offer
      if (participantType === 'doctor') {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
      }

      setIsCallActive(true);
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Failed to access camera and microphone. Please check your permissions.');
    }
  };

  const handleReconnection = async () => {
    try {
      await peerConnection.current.restartIce();
      if (participantType === 'doctor') {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
      }
    } catch (error) {
      console.error('Error during reconnection:', error);
      setError('Connection lost. Attempting to reconnect...');
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: false
        });
        
        screenStream.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        
        // Replace video track
        const sender = peerConnection.current.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Handle screen share stop
        videoTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      setError('Failed to share screen. Please try again.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach(track => track.stop());
      screenStream.current = null;
    }

    // Restore camera video
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = peerConnection.current.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    setIsScreenSharing(false);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        text: newMessage,
        sender: participantType,
        timestamp: new Date().toISOString()
      };
      socket.emit('chat-message', { roomId, message });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    socket.emit('end-call', { roomId });
    // Navigate back to dashboard or home
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Consultation Room</h1>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}>
              {connectionStatus}
            </div>
            <div className="text-sm text-gray-400">
              Room ID: {roomId}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Remote Video */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-400">Waiting for participant...</p>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
                  {participantType === 'doctor' ? 'Patient' : 'Doctor'}
                </div>
              </div>

              {/* Local Video */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                {localStream && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
                  {participantType === 'doctor' ? 'Doctor' : 'Patient'}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full ${
                  isMuted ? 'bg-red-600' : 'bg-gray-700'
                } hover:bg-opacity-80 transition-colors`}
              >
                {isMuted ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full ${
                  isVideoOff ? 'bg-red-600' : 'bg-gray-700'
                } hover:bg-opacity-80 transition-colors`}
              >
                {isVideoOff ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-4 rounded-full ${
                  isScreenSharing ? 'bg-blue-600' : 'bg-gray-700'
                } hover:bg-opacity-80 transition-colors`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>

              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat and Details Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Chat */}
            <div className="bg-gray-800 rounded-lg p-4 h-[400px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Chat</h3>
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 space-y-2"
              >
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg ${
                      message.sender === participantType
                        ? 'bg-blue-600 ml-auto'
                        : 'bg-gray-700'
                    } max-w-[80%]`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Consultation Details */}
            {consultationDetails && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Consultation Details</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400">Patient Name</p>
                    <p className="text-white">{consultationDetails.patientName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Age</p>
                    <p className="text-white">{consultationDetails.age}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Symptoms</p>
                    <p className="text-white">{consultationDetails.symptoms}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Description</p>
                    <p className="text-white">{consultationDetails.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsultationRoom; 