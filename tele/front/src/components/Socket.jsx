// Socket.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  const socketContext = useContext(SocketContext);
  if (!socketContext) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return socketContext;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  useEffect(() => {
    const initializeSocket = () => {
      try {
        const newSocket = io("http://localhost:3002", {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });
        
        // Make socket available globally for debugging
        window.socket = newSocket;
        console.log('Socket made available globally as window.socket for debugging');

        newSocket.on("connect", () => {
          console.log("Socket connected:", newSocket.id);
          setIsConnected(true);
          setRetryCount(0);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          setIsConnected(false);
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setTimeout(initializeSocket, 2000);
          }
        });

        newSocket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          setIsConnected(false);
          if (reason === "io server disconnect") {
            // Server initiated disconnect, try to reconnect
            newSocket.connect();
          }
        });

        setSocket(newSocket);

        return () => {
          if (newSocket) {
            newSocket.disconnect();
          }
        };
      } catch (error) {
        console.error("Error initializing socket:", error);
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(initializeSocket, 2000);
        }
      }
    };

    initializeSocket();
  }, [retryCount]);

  // Create a memoized value to prevent unnecessary re-renders
  const contextValue = { socket, isConnected };
  
  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
