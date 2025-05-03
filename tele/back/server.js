const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const cors = require("cors");
const WebSocket = require('ws');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: true });

// Create a separate WebSocket server for facial pain detection
const wss = new WebSocket.Server({ noServer: true });

// Handle upgrade for the facial pain WebSocket endpoint
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname === '/facial-pain') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Store active WebSocket connections by room
const facialPainConnections = new Map();

// Handle WebSocket connections for facial pain detection
wss.on('connection', (ws) => {
  console.log('Facial pain detection client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // If the message contains a room ID, store the connection
      if (data.roomId) {
        facialPainConnections.set(data.roomId, ws);
        console.log(`Facial pain detection registered for room: ${data.roomId}`);
      }
      
      // Forward facial pain data to the appropriate room
      if (data.type === 'facial_pain' && data.roomId) {
        io.to(data.roomId).emit('facial-pain-update', data);
      }
    } catch (error) {
      console.error('Error processing facial pain WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Facial pain detection client disconnected');
    // Remove the connection from the map
    for (const [roomId, connection] of facialPainConnections.entries()) {
      if (connection === ws) {
        facialPainConnections.delete(roomId);
        console.log(`Facial pain detection unregistered for room: ${roomId}`);
        break;
      }
    }
  });
});

let emailToSocketMapping = new Map();
let socketToEmailMapping = new Map();
let activeConsultations = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join-room", (data) => {
    try {
      const { email, room } = data;
      console.log(`User ${email} joining room ${room}`);
      emailToSocketMapping.set(email, socket.id);
      socketToEmailMapping.set(socket.id, email);
      socket.join(room);
      socket.emit("joined-room", { room });
      socket.broadcast.to(room).emit("user-joined", { email });
    } catch (error) {
      console.error("Error in join-room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("request-consultation", (data) => {
    try {
      const { roomId, ...consultationData } = data;
      activeConsultations.set(roomId, {
        ...consultationData,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      
      socket.join(roomId);
      
      socket.broadcast.emit("new-consultation-request", {
        roomId,
        ...consultationData
      });
    } catch (error) {
      console.error("Error in request-consultation:", error);
      socket.emit("error", { message: "Failed to request consultation" });
    }
  });

  socket.on("get-pending-consultations", () => {
    try {
      const pendingConsultations = Array.from(activeConsultations.entries())
        .filter(([_, consultation]) => consultation.status === 'pending')
        .map(([roomId, consultation]) => ({
          roomId,
          ...consultation
        }));
      
      socket.emit("pending-consultations", pendingConsultations);
    } catch (error) {
      console.error("Error in get-pending-consultations:", error);
      socket.emit("error", { message: "Failed to fetch consultations" });
    }
  });

  socket.on("accept-consultation", (data) => {
    try {
      const { roomId, doctorId } = data;
      const consultation = activeConsultations.get(roomId);
      
      if (consultation) {
        consultation.status = 'active';
        consultation.doctorId = doctorId;
        activeConsultations.set(roomId, consultation);
        
        socket.join(roomId);
        
        io.to(roomId).emit("consultation-update", {
          roomId,
          ...consultation
        });

        socket.broadcast.to(roomId).emit("consultation-accepted", {
          roomId,
          ...consultation
        });
      }
    } catch (error) {
      console.error("Error in accept-consultation:", error);
      socket.emit("error", { message: "Failed to accept consultation" });
    }
  });

  socket.on("reject-consultation", (data) => {
    try {
      const { roomId, reason } = data;
      const consultation = activeConsultations.get(roomId);
      
      if (consultation) {
        consultation.status = 'rejected';
        consultation.rejectionReason = reason;
        activeConsultations.set(roomId, consultation);
        
        socket.broadcast.to(roomId).emit("consultation-update", {
          roomId,
          ...consultation
        });
      }
    } catch (error) {
      console.error("Error in reject-consultation:", error);
      socket.emit("error", { message: "Failed to reject consultation" });
    }
  });

  socket.on("get-consultation-details", (roomId) => {
    try {
      const consultation = activeConsultations.get(roomId);
      if (consultation) {
        const participantType = socket.id === consultation.doctorId ? 'doctor' : 'patient';
        socket.emit("consultation-details", {
          ...consultation,
          participantType
        });
      }
    } catch (error) {
      console.error("Error in get-consultation-details:", error);
      socket.emit("error", { message: "Failed to fetch consultation details" });
    }
  });

  socket.on("chat-message", (data) => {
    try {
      const { roomId, message } = data;
      socket.broadcast.to(roomId).emit("chat-message", message);
    } catch (error) {
      console.error("Error in chat-message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("end-call", (data) => {
    try {
      const { roomId } = data;
      const consultation = activeConsultations.get(roomId);
      
      if (consultation) {
        consultation.status = 'completed';
        consultation.endTime = new Date().toISOString();
        activeConsultations.set(roomId, consultation);
        
        io.to(roomId).emit("consultation-update", {
          roomId,
          ...consultation
        });
      }
    } catch (error) {
      console.error("Error in end-call:", error);
      socket.emit("error", { message: "Failed to end consultation" });
    }
  });

  socket.on("call-user", (data) => {
    try {
      const { email, offer } = data;
      const fromEmail = socketToEmailMapping.get(socket.id);
      console.log(`Call from ${fromEmail} to ${email}`);
      socket.to(emailToSocketMapping.get(email)).emit("incoming-call", {
        offer,
        from: fromEmail,
      });
    } catch (error) {
      console.error("Error in call-user:", error);
      socket.emit("error", { message: "Failed to initiate call" });
    }
  });

  socket.on("call-accepted", (data) => {
    try {
      const { to, answer } = data;
      console.log(`Call accepted from ${to}`);
      socket.to(emailToSocketMapping.get(to)).emit("call-accepted", {
        answer,
      });
    } catch (error) {
      console.error("Error in call-accepted:", error);
      socket.emit("error", { message: "Failed to accept call" });
    }
  });

  socket.on("offer", (data) => {
    try {
      const { roomId, offer } = data;
      socket.broadcast.to(roomId).emit("offer", offer);
    } catch (error) {
      console.error("Error in offer:", error);
      socket.emit("error", { message: "Failed to process offer" });
    }
  });

  socket.on("answer", (data) => {
    try {
      const { roomId, answer } = data;
      socket.broadcast.to(roomId).emit("answer", answer);
    } catch (error) {
      console.error("Error in answer:", error);
      socket.emit("error", { message: "Failed to process answer" });
    }
  });

  socket.on("ice-candidate", (data) => {
    try {
      const { roomId, candidate } = data;
      socket.broadcast.to(roomId).emit("ice-candidate", candidate);
    } catch (error) {
      console.error("Error in ice-candidate:", error);
      socket.emit("error", { message: "Failed to process ICE candidate" });
    }
  });

  // Handle facial pain updates from the client - original event name
  socket.on("facial-pain-update", (data) => {
    try {
      console.log("Received facial pain update (facial-pain-update):", data);
      
      if (data.roomId) {
        // Forward the pain data to everyone in the room
        io.to(data.roomId).emit("facial-pain-update", data);
        console.log(`Forwarded facial pain data to room: ${data.roomId}`);
        
        // Also forward with all other event names for consistency
        io.to(data.roomId).emit("receive_pain_data", data);
        io.to(data.roomId).emit("pain_data", data);
        io.to(data.roomId).emit("facial_pain_data", data);
        console.log(`Also forwarded with all event names to room: ${data.roomId}`);
        
        // For debugging, log all sockets in the room
        const room = io.sockets.adapter.rooms.get(data.roomId);
        if (room) {
          console.log(`Room ${data.roomId} has ${room.size} clients:`, Array.from(room));
        } else {
          console.log(`Room ${data.roomId} not found or empty`);
        }
      }
    } catch (error) {
      console.error("Error in facial-pain-update handler:", error);
    }
  });
  
  // Handle pain data with the new consistent event name
  socket.on("pain_data", (data) => {
    try {
      console.log("Received pain data (pain_data):", data);
      
      if (data.roomId) {
        // Forward the pain data to everyone in the room with all event names
        // Use io.to instead of socket.to to ensure it's sent to everyone including the sender
        io.to(data.roomId).emit("receive_pain_data", data);
        io.to(data.roomId).emit("facial-pain-update", data);
        io.to(data.roomId).emit("pain_data", data);
        io.to(data.roomId).emit("facial_pain_data", data);
        console.log(`Forwarded pain data with all event names to room: ${data.roomId}`);
        
        // For debugging, log all sockets in the room
        const room = io.sockets.adapter.rooms.get(data.roomId);
        if (room) {
          console.log(`Room ${data.roomId} has ${room.size} clients:`, Array.from(room));
        } else {
          console.log(`Room ${data.roomId} not found or empty`);
        }
      }
    } catch (error) {
      console.error("Error in pain_data handler:", error);
    }
  });
  
  // Handle pain data with the additional event name
  socket.on("facial_pain_data", (data) => {
    try {
      console.log("🔴 Received pain data (facial_pain_data):", data);
      
      if (data.roomId) {
        // Forward the pain data to everyone in the room with all event names
        io.to(data.roomId).emit("receive_pain_data", data);
        io.to(data.roomId).emit("facial-pain-update", data);
        io.to(data.roomId).emit("pain_data", data);
        io.to(data.roomId).emit("facial_pain_data", data);
        console.log(`✅ Forwarded facial_pain_data with all event names to room: ${data.roomId}`);
        
        // For debugging, log all sockets in the room
        const room = io.sockets.adapter.rooms.get(data.roomId);
        if (room) {
          console.log(`✅ Room ${data.roomId} has ${room.size} clients:`, Array.from(room));
          
          // Log each socket in the room
          Array.from(room).forEach(socketId => {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket) {
              console.log(`  - Socket ${socketId} is connected: ${clientSocket.connected}`);
            }
          });
          
          // Also emit directly to each socket in the room for testing
          Array.from(room).forEach(socketId => {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket && clientSocket.connected) {
              clientSocket.emit("direct_pain_data", data);
              console.log(`  - Sent direct_pain_data to socket ${socketId}`);
            }
          });
        } else {
          console.log(`❌ Room ${data.roomId} not found or empty`);
        }
        
        // Also broadcast to all sockets as a fallback
        socket.broadcast.emit("broadcast_pain_data", data);
        console.log(`📢 Broadcasted pain data to all sockets as fallback`);
      }
    } catch (error) {
      console.error("Error in facial_pain_data handler:", error);
    }
  });

  socket.on("disconnect", () => {
    try {
      const email = socketToEmailMapping.get(socket.id);
      if (email) {
        console.log(`User ${email} disconnected`);
        emailToSocketMapping.delete(email);
        socketToEmailMapping.delete(socket.id);
      }
    } catch (error) {
      console.error("Error in disconnect:", error);
    }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
