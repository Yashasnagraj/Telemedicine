import React, { useEffect, useState } from "react";
import { useSocket } from "./Socket";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const Home = () => {
  const { socket, isConnected } = useSocket();
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = ({ room }) => {
      console.log("Room joined:", room);
      setIsConnecting(false);
      navigate(`/chat/${room}`);
    };

    const handleError = ({ message }) => {
      console.error("Socket error:", message);
      setError(message);
      setIsConnecting(false);
    };

    socket.on("joined-room", handleRoomJoined);
    socket.on("error", handleError);

    return () => {
      socket.off("joined-room", handleRoomJoined);
      socket.off("error", handleError);
    };
  }, [socket, navigate]);

  const handleJoinRoom = () => {
    if (!socket || !isConnected) {
      setError("Socket connection not available");
      return;
    }

    setError("");
    setIsConnecting(true);
    
    if (!email) {
      setError("Please enter your email address");
      setIsConnecting(false);
      return;
    }

    if (!room) {
      setError("Please enter a room code");
      setIsConnecting(false);
      return;
    }

    if (!email.includes('@')) {
      setError("Please enter a valid email address");
      setIsConnecting(false);
      return;
    }

    console.log("Joining room:", { email, room });
    socket.emit("join-room", { email, room });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  if (!isConnected) {
    return (
      <div className="home-container">
        <div className="join-form">
          <h1>Connecting...</h1>
          <p>Please wait while we establish the connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="join-form">
        <h1>Join Video Call</h1>
        {error && <div className="error-message">{error}</div>}
        <div className="input-group">
          <input
            type="email"
            placeholder="Enter Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isConnecting}
          />
        </div>
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter Room Code"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isConnecting}
          />
        </div>
        <button 
          className="join-button"
          onClick={handleJoinRoom}
          disabled={!email || !room || isConnecting}
        >
          {isConnecting ? "Connecting..." : "Enter Room"}
        </button>
      </div>
    </div>
  );
};

export default Home;
