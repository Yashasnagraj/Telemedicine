import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "./Socket";
import { usePeer } from "./peer";
import { useParams } from "react-router-dom";

function Room() {
  const { socket, isConnected } = useSocket();
  const { 
    peer, 
    createOffer, 
    handleIncomingCall, 
    localStream, 
    remoteStream, 
    isMediaError, 
    connectionState,
    addIceCandidate,
    iceCandidates 
  } = usePeer();
  const { room } = useParams();
  const [error, setError] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isLocalVideoReady, setIsLocalVideoReady] = useState(false);
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [isAnswerSent, setIsAnswerSent] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // Debug logs for streams
  useEffect(() => {
    console.log("Local Stream State:", localStream);
    console.log("Remote Stream State:", remoteStream);
    console.log("Connection State:", connectionState);
  }, [localStream, remoteStream, connectionState]);

  // Handle local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log("Setting local video stream");
      try {
        const videoElement = localVideoRef.current;
        videoElement.srcObject = localStream;
        
        const playVideo = async () => {
          try {
            if (!videoElement.paused) {
              return; // Don't try to play if already playing
            }
            // Add a small delay to ensure the video element is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            await videoElement.play();
            setIsLocalVideoReady(true);
            console.log("Local video playing successfully");
          } catch (err) {
            console.error("Error playing local video:", err);
            if (retryCount < maxRetries) {
              setRetryCount(prev => prev + 1);
              setTimeout(playVideo, 1000);
            }
          }
        };

        // Use a MutationObserver to detect when the video element is ready
        const observer = new MutationObserver((mutations) => {
          if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
            playVideo();
            observer.disconnect();
          }
        });

        observer.observe(videoElement, {
          attributes: true,
          attributeFilter: ['srcObject', 'readyState']
        });

        // Cleanup function
        return () => {
          observer.disconnect();
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
        };
      } catch (err) {
        console.error("Error setting local video:", err);
      }
    }
  }, [localStream, retryCount]);

  // Handle remote video stream
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log("Setting remote video stream");
      try {
        const videoElement = remoteVideoRef.current;
        videoElement.srcObject = remoteStream;
        
        const playVideo = async () => {
          try {
            if (!videoElement.paused) {
              return; // Don't try to play if already playing
            }
            // Add a small delay to ensure the video element is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            await videoElement.play();
            setIsRemoteVideoReady(true);
            console.log("Remote video playing successfully");
          } catch (err) {
            console.error("Error playing remote video:", err);
            if (retryCount < maxRetries) {
              setRetryCount(prev => prev + 1);
              setTimeout(playVideo, 1000);
            }
          }
        };

        // Use a MutationObserver to detect when the video element is ready
        const observer = new MutationObserver((mutations) => {
          if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
            playVideo();
            observer.disconnect();
          }
        });

        observer.observe(videoElement, {
          attributes: true,
          attributeFilter: ['srcObject', 'readyState']
        });

        // Cleanup function
        return () => {
          observer.disconnect();
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
        };
      } catch (err) {
        console.error("Error setting remote video:", err);
      }
    }
  }, [remoteStream, retryCount]);

  // Reset retry count when streams change
  useEffect(() => {
    setRetryCount(0);
  }, [localStream, remoteStream]);

  // Handle ICE candidates
  useEffect(() => {
    if (iceCandidates.length > 0 && isCallInProgress) {
      console.log("Sending ICE candidates:", iceCandidates.length);
      socket.emit("ice-candidate", { candidates: iceCandidates });
    }
  }, [iceCandidates, isCallInProgress, socket]);

  const handleNewJoin = async (data) => {
    try {
      const { email } = data;
      console.log("New user joined:", email);
      setIsCallInProgress(true);
      const offer = await createOffer();
      socket.emit("call-user", { email, offer });
    } catch (err) {
      console.error("Error in handleNewJoin:", err);
      setError("Failed to create call offer");
      setIsCallInProgress(false);
    }
  };

  const handleIncomingCallEvent = async (data) => {
    try {
      const { offer, from } = data;
      console.log("Received incoming call from:", from);
      setIsCallInProgress(true);
      const answer = await handleIncomingCall(offer);
      socket.emit("call-accepted", { to: from, answer });
      setIsAnswerSent(true);
    } catch (err) {
      console.error("Error in handleIncomingCallEvent:", err);
      setError("Failed to handle incoming call");
      setIsCallInProgress(false);
    }
  };

  const handleCallAccepted = async (data) => {
    try {
      const { answer } = data;
      console.log("Call accepted, setting remote description");
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      setIsAnswerSent(true);
    } catch (err) {
      console.error("Error in handleCallAccepted:", err);
      setError("Failed to establish connection");
      setIsCallInProgress(false);
    }
  };

  const handleIceCandidate = async (data) => {
    try {
      const { candidates } = data;
      console.log("Received ICE candidates:", candidates.length);
      for (const candidate of candidates) {
        await addIceCandidate(candidate);
      }
    } catch (err) {
      console.error("Error in handleIceCandidate:", err);
      setError("Failed to process ICE candidate");
    }
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("user-joined", handleNewJoin);
    socket.on("incoming-call", handleIncomingCallEvent);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("user-joined", handleNewJoin);
      socket.off("incoming-call", handleIncomingCallEvent);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [socket, isConnected]);

  if (!isConnected) {
    return (
      <div className="room-container">
        <h2>Connecting to room...</h2>
        <p>Please wait while we establish the connection.</p>
      </div>
    );
  }

  if (isMediaError) {
    return (
      <div className="error-container">
        <h2>Error accessing camera and microphone</h2>
        <p>Please make sure you have granted the necessary permissions.</p>
      </div>
    );
  }

  const getConnectionStatus = () => {
    if (!isCallInProgress) return "Waiting for peer...";
    switch (connectionState) {
      case 'new': return "Initializing connection...";
      case 'connecting': return "Connecting...";
      case 'connected': return "Connected";
      case 'disconnected': return "Disconnected";
      case 'failed': return "Connection failed";
      case 'closed': return "Connection closed";
      default: return "Unknown state";
    }
  };

  return (
    <div className="room-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <h2>Room: {room}</h2>
      <div style={{
        margin: '10px 0',
        padding: '10px',
        backgroundColor: connectionState === 'connected' ? '#e8f5e9' : '#fff3e0',
        borderRadius: '4px',
        color: connectionState === 'connected' ? '#2e7d32' : '#f57c00'
      }}>
        {getConnectionStatus()}
      </div>
      {error && <div className="error-message" style={{
        color: 'red',
        margin: '10px 0',
        padding: '10px',
        backgroundColor: '#ffebee',
        borderRadius: '4px'
      }}>{error}</div>}
      <div className="video-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        width: '100%',
        maxWidth: '1200px',
        margin: '20px 0'
      }}>
        <div className="video-container" style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              opacity: isLocalVideoReady ? 1 : 0.5
            }}
          />
          <span style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '5px 10px',
            borderRadius: '4px'
          }}>You</span>
        </div>
        <div className="video-container" style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isRemoteVideoReady ? 1 : 0.5
            }}
          />
          <span style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '5px 10px',
            borderRadius: '4px'
          }}>Remote User</span>
        </div>
      </div>
    </div>
  );
}

export default Room;
