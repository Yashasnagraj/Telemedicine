import React, { useState, useEffect } from 'react';
import { useSocket } from './Socket';
import { useNavigate } from 'react-router-dom';

function DoctorDashboard() {
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If socket is not available or not connected yet, return early
    if (!socket) {
      console.log("Socket not available yet");
      return;
    }

    console.log("Socket connection status:", isConnected ? "Connected" : "Disconnected");
    
    // Listen for new consultation requests
    socket.on('new-consultation-request', (consultation) => {
      console.log("New consultation request received:", consultation);
      setConsultations(prev => [consultation, ...prev]);
    });

    // Listen for consultation updates
    socket.on('consultation-update', (updatedConsultation) => {
      console.log("Consultation update received:", updatedConsultation);
      setConsultations(prev => 
        prev.map(consultation => 
          consultation.roomId === updatedConsultation.roomId 
            ? updatedConsultation 
            : consultation
        )
      );
    });

    // Fetch existing consultations
    console.log("Requesting pending consultations");
    socket.emit('get-pending-consultations');
    
    socket.on('pending-consultations', (data) => {
      console.log("Pending consultations received:", data);
      setConsultations(data);
      setLoading(false);
    });

    return () => {
      // Clean up event listeners only if socket exists
      if (socket) {
        console.log("Cleaning up socket event listeners");
        socket.off('new-consultation-request');
        socket.off('consultation-update');
        socket.off('pending-consultations');
      }
    };
  }, [socket, isConnected]);

  const handleAcceptConsultation = (consultation) => {
    if (!socket) {
      console.error("Socket not available, cannot accept consultation");
      return;
    }
    
    console.log("Accepting consultation:", consultation.roomId);
    socket.emit('accept-consultation', {
      roomId: consultation.roomId,
      doctorId: socket.id
    });
    navigate(`/doctor/consultation/${consultation.roomId}`);
  };

  const handleRejectConsultation = (consultation) => {
    if (!socket) {
      console.error("Socket not available, cannot reject consultation");
      return;
    }
    
    console.log("Rejecting consultation:", consultation.roomId);
    socket.emit('reject-consultation', {
      roomId: consultation.roomId,
      reason: 'Doctor unavailable'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">
          {!socket 
            ? "Connecting to server..." 
            : !isConnected 
              ? "Waiting for connection..." 
              : "Loading consultations..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Consultation Requests</h1>
      
      <div className="grid gap-6">
        {consultations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No pending consultation requests</p>
          </div>
        ) : (
          consultations.map((consultation) => (
            <div 
              key={consultation.roomId}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {consultation.name}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Age: {consultation.age} | Gender: {consultation.gender}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium
                  ${consultation.urgency === 'emergency' ? 'bg-red-100 text-red-800' :
                    consultation.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                    consultation.urgency === 'normal' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'}`}
                >
                  {consultation.urgency.charAt(0).toUpperCase() + consultation.urgency.slice(1)}
                </span>
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-gray-700">Symptoms</h4>
                <p className="text-gray-600 mt-1">{consultation.symptoms}</p>
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-gray-700">Description</h4>
                <p className="text-gray-600 mt-1">{consultation.description}</p>
              </div>

              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => handleRejectConsultation(consultation)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAcceptConsultation(consultation)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Accept & Start Consultation
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DoctorDashboard; 