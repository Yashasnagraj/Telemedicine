import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './Socket';
import HumanBodySVG from './HumanBodySVG';

const FacialPainPanel = ({ roomId }) => {
  const { socket } = useSocket();
  const [painRegions, setPainRegions] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [debugInfo, setDebugInfo] = useState('No events received yet');

  // SIMPLIFIED APPROACH - ONE SINGLE EFFECT FOR ALL LISTENERS
  useEffect(() => {
    if (!socket) {
      console.log('FacialPainPanel: Socket not available');
      return;
    }

    console.log('FacialPainPanel: Setting up ALL socket listeners for room', roomId);
    
    // HANDLER FUNCTION - Simplified to handle any pain data format
    const handleAnyPainData = (data) => {
      console.log('🔴 RECEIVED PAIN DATA:', data);
      setDebugInfo(JSON.stringify(data, null, 2));
      
      try {
        // Handle different possible data formats
        if (data && data.regions && Array.isArray(data.regions)) {
          // Standard format with regions array
          console.log('✅ Setting pain regions from standard format:', data.regions);
          setPainRegions(data.regions);
          setLastUpdate(new Date());
        } else if (data && Array.isArray(data)) {
          // If data itself is an array of regions
          console.log('✅ Setting pain regions from array format:', data);
          setPainRegions(data);
          setLastUpdate(new Date());
        } else {
          console.warn('❌ Unrecognized pain data format:', data);
        }
      } catch (error) {
        console.error('Error processing pain data:', error);
      }
    };
    
    // Custom event handler for direct testing
    const handleTestEvent = (event) => {
      console.log('🟣 RECEIVED TEST EVENT:', event.detail);
      setDebugInfo(JSON.stringify(event.detail, null, 2));
      
      try {
        if (event.detail && event.detail.regions) {
          console.log('✅ Setting pain regions from test event:', event.detail.regions);
          setPainRegions(event.detail.regions);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Error processing test event:', error);
      }
    };
    
    // REGISTER ALL POSSIBLE EVENT LISTENERS
    const eventNames = [
      'facial-pain-update', 
      'receive_pain_data', 
      'pain_data', 
      'facial_pain_data',
      'direct_pain_data',
      'broadcast_pain_data'
    ];
    
    // Remove any existing listeners
    eventNames.forEach(eventName => socket.off(eventName));
    window.removeEventListener('test-pain-data', handleTestEvent);
    
    // Add listeners for all event names
    eventNames.forEach(eventName => {
      socket.on(eventName, handleAnyPainData);
      console.log(`🎧 Listening for '${eventName}' events`);
    });
    
    // Add custom event listener
    window.addEventListener('test-pain-data', handleTestEvent);
    
    // Log socket status periodically
    const intervalId = setInterval(() => {
      if (socket) {
        console.log('🔌 Socket status:', {
          connected: socket.connected,
          id: socket.id,
          roomId: roomId
        });
      }
    }, 10000);
    
    // CLEANUP FUNCTION
    return () => {
      eventNames.forEach(eventName => socket.off(eventName));
      window.removeEventListener('test-pain-data', handleTestEvent);
      clearInterval(intervalId);
      console.log('🧹 Cleaned up all pain data listeners');
    };
  }, [socket, roomId]);

  // Format the last update time
  const formatLastUpdate = () => {
    if (!lastUpdate) return 'No data yet';
    
    const now = new Date();
    const diffSeconds = Math.floor((now - lastUpdate) / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    } else {
      return lastUpdate.toLocaleTimeString();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Facial Pain Detection</h3>
        <button 
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="text-gray-400 hover:text-white"
        >
          {isPanelExpanded ? '▼' : '▲'}
        </button>
      </div>
      
      {isPanelExpanded && (
        <>
          <div className="mb-2 text-sm text-gray-400 flex justify-between">
            <span>Last update: {formatLastUpdate()}</span>
            <span>Room ID: {roomId}</span>
          </div>
          
          <div className="flex justify-center">
            <HumanBodySVG painRegions={painRegions} />
          </div>
          
          {painRegions.length === 0 && (
            <div className="text-center text-gray-400 mt-4">
              No pain detected. Waiting for facial expressions...
            </div>
          )}
          
          {/* Debug Controls */}
          <div className="mt-4 border-t border-gray-700 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-yellow-400">Debug Controls</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    // Create test pain data - DIRECT STATE UPDATE
                    const testData = [
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
                    ];
                    
                    // Update the state directly
                    setPainRegions(testData);
                    setLastUpdate(new Date());
                    console.log("🟢 DIRECT STATE UPDATE:", testData);
                  }}
                  className="bg-green-600 text-white text-xs px-2 py-1 rounded"
                >
                  Direct Update
                </button>
                
                <button
                  onClick={() => {
                    if (socket) {
                      // Create simple test data
                      const testData = {
                        roomId: roomId,
                        regions: [
                          {
                            region: "forehead",
                            intensity: 0.7,
                            description: "Forehead pain"
                          },
                          {
                            region: "right_eye",
                            intensity: 0.6,
                            description: "Right eye pain"
                          }
                        ],
                        timestamp: Date.now()
                      };
                      
                      // Emit via socket
                      socket.emit('facial_pain_data', testData);
                      console.log('🔵 SOCKET EMIT facial_pain_data:', testData);
                    } else {
                      console.error('Socket not available for test');
                    }
                  }}
                  className="bg-blue-600 text-white text-xs px-2 py-1 rounded"
                >
                  Socket Emit
                </button>
                
                <button
                  onClick={() => {
                    // Create test event
                    const testData = {
                      roomId: roomId,
                      regions: [
                        {
                          region: "left_cheek",
                          intensity: 0.8,
                          description: "Left cheek pain"
                        },
                        {
                          region: "jaw",
                          intensity: 0.7,
                          description: "Jaw pain"
                        }
                      ]
                    };
                    
                    // Dispatch custom event
                    const event = new CustomEvent('test-pain-data', { detail: testData });
                    window.dispatchEvent(event);
                    console.log('🟣 CUSTOM EVENT DISPATCHED:', testData);
                  }}
                  className="bg-purple-600 text-white text-xs px-2 py-1 rounded"
                >
                  Custom Event
                </button>
              </div>
            </div>
            
            {/* Debug Info */}
            <div className="mt-4 border border-gray-700 rounded p-2 bg-gray-900">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-yellow-400">Debug Info</span>
                <button
                  onClick={() => {
                    if (socket) {
                      setDebugInfo(JSON.stringify({
                        socketConnected: socket.connected,
                        socketId: socket.id,
                        roomId: roomId,
                        timestamp: new Date().toISOString(),
                        painRegionsCount: painRegions.length
                      }, null, 2));
                    }
                  }}
                  className="bg-yellow-600 text-white text-xs px-2 py-1 rounded"
                >
                  Refresh
                </button>
              </div>
              
              <div className="text-xs text-gray-400 font-mono whitespace-pre-wrap overflow-auto max-h-40">
                {debugInfo}
              </div>
              
              <div className="mt-2 text-xs text-gray-500">
                <div>Current pain regions: {painRegions.length}</div>
                <div className="mt-1 text-xs text-gray-400 font-mono overflow-auto max-h-20">
                  {JSON.stringify(painRegions, null, 2)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FacialPainPanel;