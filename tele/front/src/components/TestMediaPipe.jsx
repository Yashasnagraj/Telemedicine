import React, { useState, useEffect } from 'react';
import { runAllTests } from '../utils/TestMediaPipe';

const TestMediaPipe = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const runTests = async () => {
      try {
        setLoading(true);
        const results = await runAllTests();
        setTestResults(results);
        setLoading(false);
      } catch (err) {
        console.error('Error running tests:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    runTests();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">MediaPipe Face Mesh Test</h1>
      
      {loading && (
        <div className="bg-blue-900 p-4 rounded-lg mb-4">
          <p>Running tests...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-900 p-4 rounded-lg mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {testResults && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Test Results</h2>
          
          <div className="grid grid-cols-1 gap-4">
            <div className={`p-4 rounded-lg ${testResults.mediapipe ? 'bg-green-800' : 'bg-red-800'}`}>
              <p className="font-bold">MediaPipe Face Mesh:</p>
              <p>{testResults.mediapipe ? 'SUCCESS' : 'FAILED'}</p>
            </div>
            
            <div className={`p-4 rounded-lg ${testResults.video ? 'bg-green-800' : 'bg-red-800'}`}>
              <p className="font-bold">Video Stream Access:</p>
              <p>{testResults.video ? 'SUCCESS' : 'FAILED'}</p>
            </div>
            
            <div className={`p-4 rounded-lg ${testResults.canvas ? 'bg-green-800' : 'bg-red-800'}`}>
              <p className="font-bold">Canvas Creation:</p>
              <p>{testResults.canvas ? 'SUCCESS' : 'FAILED'}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="font-bold">All tests passed:</p>
            <p>{Object.values(testResults).every(result => result) ? 'YES' : 'NO'}</p>
          </div>
        </div>
      )}
      
      <div className="mt-8">
        <p className="text-gray-400">
          This test verifies that all the components needed for in-browser facial pain detection are working correctly.
        </p>
        <p className="text-gray-400 mt-2">
          If all tests pass, the MediaPipe Face Mesh integration should work in the Patient Consultation Room.
        </p>
      </div>
    </div>
  );
};

export default TestMediaPipe;