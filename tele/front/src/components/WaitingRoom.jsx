import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from './Socket';

function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Join the room when component mounts
    socket.emit('join-room', { room: roomId });

    // Listen for consultation updates
    socket.on('consultation-update', (data) => {
      console.log('Consultation update received:', data);
      if (data.roomId === roomId) {
        if (data.status === 'active') {
          navigate(`/patient/consultation/${roomId}`);
        } else if (data.status === 'rejected') {
          setStatus('rejected');
          setError(data.rejectionReason || 'Consultation request was rejected');
        }
      }
    });

    // Listen specifically for consultation acceptance
    socket.on('consultation-accepted', (data) => {
      console.log('Consultation accepted:', data);
      if (data.roomId === roomId) {
        navigate(`/patient/consultation/${roomId}`);
      }
    });

    return () => {
      socket.off('consultation-update');
      socket.off('consultation-accepted');
    };
  }, [roomId, socket, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'pending' ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Waiting for Doctor
            </h2>
            <p className="text-gray-600 mb-6">
              Your consultation request is being processed. Please wait while we connect you with a doctor.
            </p>
            <div className="text-sm text-gray-500">
              Room ID: {roomId}
            </div>
          </>
        ) : (
          <>
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Consultation Rejected
            </h2>
            <p className="text-gray-600 mb-6">
              {error || 'Your consultation request could not be processed at this time.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default WaitingRoom; 