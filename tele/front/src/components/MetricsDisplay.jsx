import React, { useState, useEffect } from 'react';

/**
 * Component to display real-time WebRTC metrics
 */
const MetricsDisplay = ({ metrics, visible = true }) => {
  const [showMetrics, setShowMetrics] = useState(visible);

  if (!showMetrics || !metrics) return (
    <button 
      className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
      onClick={() => setShowMetrics(true)}
    >
      Show Metrics
    </button>
  );

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-md w-full opacity-90 z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">WebRTC Metrics</h3>
        <button 
          className="text-gray-400 hover:text-white"
          onClick={() => setShowMetrics(false)}
        >
          Hide
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Latency (RTT)</span>
          <span className={`text-lg font-mono ${getLatencyColor(metrics.rtt_ms)}`}>
            {metrics.rtt_ms !== null ? `${metrics.rtt_ms} ms` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Jitter</span>
          <span className={`text-lg font-mono ${getJitterColor(metrics.jitter_ms)}`}>
            {metrics.jitter_ms !== null ? `${metrics.jitter_ms} ms` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Packet Loss</span>
          <span className={`text-lg font-mono ${getPacketLossColor(metrics.packets_lost, metrics.packets_received)}`}>
            {metrics.packets_received ? 
              `${((metrics.packets_lost / (metrics.packets_lost + metrics.packets_received)) * 100).toFixed(1)}%` : 
              'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Frame Rate</span>
          <span className={`text-lg font-mono ${getFpsColor(metrics.fps)}`}>
            {metrics.fps !== null ? `${metrics.fps} fps` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Bitrate (In)</span>
          <span className="text-lg font-mono text-blue-400">
            {metrics.bitrate_kbps_inbound !== null ? `${metrics.bitrate_kbps_inbound} kbps` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Bitrate (Out)</span>
          <span className="text-lg font-mono text-purple-400">
            {metrics.bitrate_kbps_outbound !== null ? `${metrics.bitrate_kbps_outbound} kbps` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded col-span-2">
          <span className="block text-gray-400">Resolution</span>
          <span className="text-lg font-mono">
            {metrics.resolution_width && metrics.resolution_height ? 
              `${metrics.resolution_width}×${metrics.resolution_height}` : 
              'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded col-span-2">
          <span className="block text-gray-400">Codec</span>
          <span className="text-lg font-mono">
            {metrics.codec || 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded col-span-2">
          <span className="block text-gray-400">Compression</span>
          <span className={`text-lg font-mono ${metrics.compression ? 'text-green-400' : 'text-yellow-400'}`}>
            {metrics.compression ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

// Helper functions for color coding
function getLatencyColor(rtt) {
  if (rtt === null) return 'text-gray-400';
  if (rtt < 100) return 'text-green-400';
  if (rtt < 200) return 'text-yellow-400';
  return 'text-red-400';
}

function getJitterColor(jitter) {
  if (jitter === null) return 'text-gray-400';
  if (jitter < 10) return 'text-green-400';
  if (jitter < 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getPacketLossColor(lost, received) {
  if (!received) return 'text-gray-400';
  const lossRate = lost / (lost + received);
  if (lossRate < 0.01) return 'text-green-400';
  if (lossRate < 0.05) return 'text-yellow-400';
  return 'text-red-400';
}

function getFpsColor(fps) {
  if (fps === null) return 'text-gray-400';
  if (fps >= 25) return 'text-green-400';
  if (fps >= 15) return 'text-yellow-400';
  return 'text-red-400';
}

export default MetricsDisplay;