import React, { useMemo, useState, useEffect } from "react";

const PeerContext = React.createContext();
export const usePeer = () => React.useContext(PeerContext);

export const PeerProvider = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMediaError, setIsMediaError] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [iceCandidates, setIceCandidates] = useState([]);

  useEffect(() => {
    let peer = null;
    let localMediaStream = null;

    const setupPeerConnection = () => {
      peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
        iceCandidatePoolSize: 10,
      });

      // Handle incoming streams
      peer.ontrack = (event) => {
        console.log("Received remote track:", event.streams[0]);
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          console.log("Setting remote stream with tracks:", stream.getTracks().map(t => t.kind));
          
          // Ensure we have both audio and video tracks
          const hasAudio = stream.getAudioTracks().length > 0;
          const hasVideo = stream.getVideoTracks().length > 0;
          
          if (!hasAudio || !hasVideo) {
            console.warn("Remote stream missing tracks:", {
              hasAudio,
              hasVideo,
              tracks: stream.getTracks().map(t => t.kind)
            });
          }
          
          // Add event listeners to track state changes
          stream.getTracks().forEach(track => {
            track.onended = () => {
              console.log(`Remote ${track.kind} track ended`);
            };
            track.onmute = () => {
              console.log(`Remote ${track.kind} track muted`);
            };
            track.onunmute = () => {
              console.log(`Remote ${track.kind} track unmuted`);
            };
          });
          
          setRemoteStream(stream);
        }
      };

      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate:", event.candidate);
          setIceCandidates(prev => [...prev, event.candidate]);
        }
      };

      // Handle connection state changes
      peer.onconnectionstatechange = () => {
        console.log("Connection state:", peer.connectionState);
        setConnectionState(peer.connectionState);
        if (peer.connectionState === 'connected') {
          console.log("Peer connection established");
          // Verify remote stream when connection is established
          if (peer.getReceivers().length > 0) {
            const receivers = peer.getReceivers();
            console.log("Active receivers:", receivers.map(r => r.track.kind));
          }
        }
      };

      // Handle ICE connection state changes
      peer.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peer.iceConnectionState);
        if (peer.iceConnectionState === 'connected') {
          console.log("ICE connection established");
          // Verify ICE connection
          const candidates = peer.getReceivers().map(r => r.transport?.getStats());
          console.log("ICE candidates in use:", candidates);
        }
      };

      // Handle signaling state changes
      peer.onsignalingstatechange = () => {
        console.log("Signaling state:", peer.signalingState);
        if (peer.signalingState === 'stable') {
          // Verify media tracks after signaling is stable
          const senders = peer.getSenders();
          const receivers = peer.getReceivers();
          console.log("Active senders:", senders.map(s => s.track?.kind));
          console.log("Active receivers:", receivers.map(r => r.track?.kind));
        }
      };

      setPeerConnection(peer);
      return peer;
    };

    const setupMedia = async () => {
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
        console.log("Local media stream obtained:", stream);
        console.log("Local stream tracks:", stream.getTracks().map(t => t.kind));
        localMediaStream = stream;
        setLocalStream(stream);

        // Add tracks to peer connection
        if (peer && peer.connectionState !== 'closed') {
          stream.getTracks().forEach((track) => {
            console.log("Adding track to peer connection:", track.kind);
            const sender = peer.addTrack(track, stream);
            // Monitor track state
            track.onended = () => {
              console.log(`Local ${track.kind} track ended`);
            };
            track.onmute = () => {
              console.log(`Local ${track.kind} track muted`);
            };
            track.onunmute = () => {
              console.log(`Local ${track.kind} track unmuted`);
            };
          });
        }
        
        setIsMediaError(false);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setIsMediaError(true);
      }
    };

    // Initialize peer connection and media
    peer = setupPeerConnection();
    setupMedia();

    return () => {
      // Cleanup
      if (localMediaStream) {
        console.log("Cleaning up local media stream");
        localMediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      if (peer) {
        console.log("Closing peer connection");
        peer.close();
      }
      setRemoteStream(null);
      setLocalStream(null);
      setConnectionState('new');
      setIceCandidates([]);
    };
  }, []);

  const createOffer = async () => {
    if (!peerConnection) {
      console.error("No peer connection available");
      return null;
    }
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(offer);
      console.log("Created and set local offer");
      return offer;
    } catch (error) {
      console.error("Error creating offer:", error);
      throw error;
    }
  };

  const createAnswer = async (offer) => {
    if (!peerConnection) {
      console.error("No peer connection available");
      return null;
    }
    try {
      console.log("Setting remote description (offer)");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log("Created answer");
      await peerConnection.setLocalDescription(answer);
      console.log("Set local description (answer)");
      return answer;
    } catch (error) {
      console.error("Error creating answer:", error);
      throw error;
    }
  };

  const setRemoteAnswer = async (answer) => {
    if (!peerConnection) {
      console.error("No peer connection available");
      return;
    }
    try {
      console.log("Setting remote description (answer)");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Remote description set successfully");
    } catch (error) {
      console.error("Error setting remote answer:", error);
      throw error;
    }
  };

  const handleIncomingCall = async (offer) => {
    if (!peerConnection) {
      console.error("No peer connection available");
      return null;
    }
    try {
      console.log("Handling incoming call");
      const answer = await createAnswer(offer);
      return answer;
    } catch (error) {
      console.error("Error handling incoming call:", error);
      throw error;
    }
  };

  const addIceCandidate = async (candidate) => {
    if (!peerConnection) {
      console.error("No peer connection available");
      return;
    }
    try {
      console.log("Adding ICE candidate:", candidate);
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("ICE candidate added successfully");
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
      throw error;
    }
  };

  return (
    <PeerContext.Provider
      value={{
        peer: peerConnection,
        createOffer,
        createAnswer,
        setRemoteAnswer,
        handleIncomingCall,
        addIceCandidate,
        remoteStream,
        localStream,
        isMediaError,
        connectionState,
        iceCandidates
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
