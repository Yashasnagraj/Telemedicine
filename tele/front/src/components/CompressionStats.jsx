import React, { useState } from 'react';

/**
 * Component to display video compression statistics
 */
const CompressionStats = ({ stats, visible = true }) => {
  const [showStats, setShowStats] = useState(visible);

  if (!showStats || !stats) return (
    <button 
      className="fixed bottom-20 right-4 bg-purple-500 text-white px-3 py-1 rounded-md text-sm"
      onClick={() => setShowStats(true)}
    >
      Show Compression Stats
    </button>
  );

  return (
    <div className="fixed bottom-20 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-md w-full opacity-90 z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">AI Compression Stats</h3>
        <button 
          className="text-gray-400 hover:text-white"
          onClick={() => setShowStats(false)}
        >
          Hide
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Compression Level</span>
          <span className="text-lg font-mono text-purple-400">
            {stats.currentLevel || 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Compression Ratio</span>
          <span className="text-lg font-mono text-green-400">
            {stats.compressionRatio ? `${stats.compressionRatio.toFixed(1)}x` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Quality</span>
          <span className={`text-lg font-mono ${getQualityColor(stats.quality)}`}>
            {stats.quality ? `${(stats.quality * 100).toFixed(0)}%` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Processing Time</span>
          <span className={`text-lg font-mono ${getProcessingTimeColor(stats.processingTime)}`}>
            {stats.processingTime ? `${stats.processingTime.toFixed(1)} ms` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded col-span-2">
          <span className="block text-gray-400">Resolution</span>
          <span className="text-lg font-mono">
            {stats.targetResolution ? 
              `${stats.targetResolution.width}×${stats.targetResolution.height}` : 
              'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Frame Rate</span>
          <span className="text-lg font-mono">
            {stats.targetFrameRate ? `${stats.targetFrameRate} fps` : 'N/A'}
          </span>
        </div>
        
        <div className="bg-gray-700 p-2 rounded">
          <span className="block text-gray-400">Data Saved</span>
          <span className="text-lg font-mono text-green-400">
            {stats.inputSize && stats.outputSize ? 
              `${(((stats.inputSize - stats.outputSize) / stats.inputSize) * 100).toFixed(0)}%` : 
              'N/A'}
          </span>
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        Adaptive mode: {stats.adaptiveMode ? 'Enabled' : 'Disabled'}
      </div>
    </div>
  );
};

// Helper functions for color coding
function getQualityColor(quality) {
  if (quality === undefined || quality === null) return 'text-gray-400';
  if (quality > 0.8) return 'text-green-400';
  if (quality > 0.6) return 'text-yellow-400';
  return 'text-red-400';
}

function getProcessingTimeColor(time) {
  if (time === undefined || time === null) return 'text-gray-400';
  if (time < 20) return 'text-green-400';
  if (time < 50) return 'text-yellow-400';
  return 'text-red-400';
}

export default CompressionStats;