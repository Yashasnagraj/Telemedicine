/**
 * TestMediaPipe.js
 * A simple test script to verify that MediaPipe Face Mesh is working correctly
 */

import * as faceMesh from '@mediapipe/face_mesh';

// Function to test if MediaPipe Face Mesh can be initialized
export const testMediaPipeFaceMesh = async () => {
  try {
    console.log('Testing MediaPipe Face Mesh initialization...');
    
    // Create a new FaceMesh instance
    const faceMeshInstance = new faceMesh.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });
    
    // Configure Face Mesh
    faceMeshInstance.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    // Set up a simple callback
    faceMeshInstance.onResults((results) => {
      console.log('Face Mesh results:', results ? 'Received' : 'None');
    });
    
    console.log('MediaPipe Face Mesh initialized successfully!');
    return true;
  } catch (error) {
    console.error('Error initializing MediaPipe Face Mesh:', error);
    return false;
  }
};

// Export a function to test if we can access the video stream
export const testVideoAccess = async () => {
  try {
    console.log('Testing video stream access...');
    
    // Try to access the user's camera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });
    
    // Stop all tracks to release the camera
    stream.getTracks().forEach(track => track.stop());
    
    console.log('Video stream access successful!');
    return true;
  } catch (error) {
    console.error('Error accessing video stream:', error);
    return false;
  }
};

// Export a function to test if we can create a canvas element
export const testCanvasCreation = () => {
  try {
    console.log('Testing canvas creation...');
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    
    // Try to get a 2D context
    const ctx = canvas.getContext('2d');
    
    // Draw something simple
    ctx.fillStyle = 'green';
    ctx.fillRect(10, 10, 100, 100);
    
    console.log('Canvas creation successful!');
    return true;
  } catch (error) {
    console.error('Error creating canvas:', error);
    return false;
  }
};

// Export a function to run all tests
export const runAllTests = async () => {
  const results = {
    mediapipe: await testMediaPipeFaceMesh(),
    video: await testVideoAccess(),
    canvas: testCanvasCreation()
  };
  
  console.log('Test results:', results);
  return results;
};

export default {
  testMediaPipeFaceMesh,
  testVideoAccess,
  testCanvasCreation,
  runAllTests
};