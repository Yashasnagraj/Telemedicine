/**
 * BrowserFacialPainDetection.js
 * In-browser facial pain detection using MediaPipe Face Mesh
 */

// Import MediaPipe Face Mesh
import * as faceMesh from '@mediapipe/face_mesh';

// Fallback to CDN if needed
if (!faceMesh || !faceMesh.FaceMesh) {
  console.warn('MediaPipe Face Mesh not found in npm package, loading from CDN...');
  // This is a fallback in case the npm package doesn't load correctly
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
  script.async = true;
  document.head.appendChild(script);
}

// Define face regions and their corresponding body parts
const FACE_REGIONS = {
  "jaw": {
    "landmarks": [61, 91, 84, 314, 402, 178, 87, 14, 317, 405, 321, 375, 291],  // Jaw line landmarks
    "body_region": "jaw",
    "threshold": 0.03,  // More sensitive threshold
    "description": "Jaw/TMJ pain"
  },
  "forehead": {
    "landmarks": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323],  // Forehead landmarks
    "body_region": "head",
    "threshold": 0.02,  // More sensitive threshold
    "description": "Headache/Migraine"
  },
  "right_eye": {
    "landmarks": [33, 133, 157, 158, 159, 160, 161, 173, 246],  // Right eye landmarks
    "body_region": "right_eye",
    "threshold": 0.03,  // More sensitive threshold
    "description": "Right eye pain"
  },
  "left_eye": {
    "landmarks": [362, 263, 386, 387, 388, 466, 390, 373, 374],  // Left eye landmarks
    "body_region": "left_eye",
    "threshold": 0.03,  // More sensitive threshold
    "description": "Left eye pain"
  },
  "nose": {
    "landmarks": [1, 2, 3, 4, 5, 6, 168, 197, 195],  // Nose landmarks
    "body_region": "nose",
    "threshold": 0.03,  // More sensitive threshold
    "description": "Sinus pain"
  },
  "right_cheek": {
    "landmarks": [50, 101, 36, 206, 207, 187],  // Right cheek landmarks
    "body_region": "right_cheek",
    "threshold": 0.02,  // More sensitive threshold
    "description": "Right facial pain"
  },
  "left_cheek": {
    "landmarks": [280, 330, 266, 426, 427, 411],  // Left cheek landmarks
    "body_region": "left_cheek",
    "threshold": 0.02,  // More sensitive threshold
    "description": "Left facial pain"
  }
};

class BrowserFacialPainDetector {
  constructor() {
    this.isRunning = false;
    this.roomId = null;
    this.faceMesh = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.socket = null;
    this.animationFrameId = null;
    this.lastSentTime = 0;
    this.calibrationFrames = 30;
    this.calibrationCounter = 0;
    this.baselineValues = {};
    this.onPainDetected = null;
    this.debugMode = false;
  }

  /**
   * Initialize the facial pain detector
   * @param {Object} options Configuration options
   * @param {HTMLVideoElement} options.videoElement Video element to analyze
   * @param {HTMLCanvasElement} options.canvasElement Optional canvas for visualization
   * @param {WebSocket|Object} options.socket WebSocket or Socket.io instance
   * @param {string} options.roomId Room ID for the consultation
   * @param {Function} options.onPainDetected Callback when pain is detected
   * @param {boolean} options.debug Enable debug visualization
   */
  async initialize(options) {
    if (this.isRunning) {
      console.warn('Facial pain detector is already running');
      return false;
    }

    this.videoElement = options.videoElement;
    this.canvasElement = options.canvasElement;
    this.socket = options.socket;
    this.roomId = options.roomId;
    this.onPainDetected = options.onPainDetected;
    this.debugMode = options.debug || false;

    if (!this.videoElement) {
      console.error('Video element is required');
      return false;
    }

    if (this.canvasElement) {
      this.canvasCtx = this.canvasElement.getContext('2d');
    }

    try {
      // Initialize MediaPipe Face Mesh with specific version to ensure compatibility
      this.faceMesh = new faceMesh.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });

      // Configure Face Mesh
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Set up Face Mesh callback
      this.faceMesh.onResults((results) => {
        console.log("FaceMesh results received"); // Debug step 1
        this.onFaceMeshResults(results);
      });

      console.log('MediaPipe Face Mesh initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe Face Mesh:', error);
      return false;
    }
  }

  /**
   * Start facial pain detection
   */
  start() {
    if (!this.faceMesh || !this.videoElement) {
      console.error('Face Mesh or Video Element not initialized');
      return false;
    }

    this.isRunning = true;
    this.calibrationCounter = 0;
    this.baselineValues = {};
    this.processFrame();
    
    console.log('Facial pain detection started');
    return true;
  }

  /**
   * Stop facial pain detection
   */
  stop() {
    if (!this.isRunning) {
      return false;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isRunning = false;
    console.log('Facial pain detection stopped');
    return true;
  }

  /**
   * Process video frames
   */
  processFrame() {
    if (!this.isRunning) return;

    // Process the current frame
    this.faceMesh.send({ image: this.videoElement });

    // Schedule the next frame
    this.animationFrameId = requestAnimationFrame(() => this.processFrame());
  }

  /**
   * Handle Face Mesh results
   * @param {Object} results Face Mesh detection results
   */
  onFaceMeshResults(results) {
    // Log frame processing for debugging
    const frameTime = new Date().toISOString();
    const timestamp = Date.now();
    
    // ✅ 6. Verify onResults Callback is receiving frames
    console.log("Received frame:", timestamp);
    
    // ✅ 1. Verify MediaPipe is Detecting the Face and Landmarks
    if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      console.log(`[${frameTime}] No face detected in frame`);
      
      // Draw debug visualization even when no face is detected
      if (this.debugMode && this.canvasCtx && this.canvasElement) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw the video frame
        this.canvasCtx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw "No face detected" message
        this.canvasCtx.font = '20px Arial';
        this.canvasCtx.fillStyle = 'red';
        this.canvasCtx.fillText('No face detected', 10, 30);
        this.canvasCtx.fillText(`Frame: ${timestamp}`, 10, 60);
        
        this.canvasCtx.restore();
      }
      return;
    }

    // Log successful face detection and full landmark data
    console.log("Face Landmarks:", results.multiFaceLandmarks);
    console.log(`[${frameTime}] Face detected with ${results.multiFaceLandmarks[0].length} landmarks`);

    // Draw face mesh if debug mode is enabled and canvas is available
    if (this.debugMode && this.canvasCtx && this.canvasElement) {
      this.drawDebugVisualization(results);
    }

    // Get the first face landmarks
    const landmarks = results.multiFaceLandmarks[0];

    // During calibration phase, update baseline values
    if (this.calibrationCounter < this.calibrationFrames) {
      this.updateBaseline(landmarks);
      return;
    }

    // ✅ 2. Check Your Pain Detection Algorithm
    // ✅ 3. Review Threshold & Sensitivity Settings
    // Calculate some basic metrics for debugging
    const jawOpenness = Math.abs(landmarks[13].y - landmarks[14].y);
    const rightEyeOpenness = Math.abs(landmarks[159].y - landmarks[145].y);
    const leftEyeOpenness = Math.abs(landmarks[386].y - landmarks[374].y);
    
    console.log("Facial metrics:", {
      jawOpenness,
      rightEyeOpenness,
      leftEyeOpenness,
      timestamp
    });
    
    // Use very low thresholds for testing
    const painDetected = 
      jawOpenness > 0.01 || 
      rightEyeOpenness < 0.01 || 
      leftEyeOpenness < 0.01;
    
    if (painDetected) {
      console.log("Pain detected at:", timestamp);
    } else {
      console.log("No pain detected at:", timestamp);
    }

    // Analyze face for pain indicators
    const painIndicators = this.analyzeFaceForPain(landmarks);

    // Log pain indicators for debugging
    if (painIndicators && Object.keys(painIndicators).length > 0) {
      console.log(`[${frameTime}] Pain indicators detected:`, painIndicators);
      this.sendPainIndicators(painIndicators);
    } else {
      console.log(`[${frameTime}] No pain indicators detected in this frame`);
      
      // ✅ 4. Test Mode - Always send test pain data every 3 seconds
      if (timestamp % 3000 < 100) {  // Send roughly every 3 seconds
        console.log("Sending test pain signal");
        const testPainIndicators = {
          "jaw": 0.7,
          "head": 0.5
        };
        this.sendPainIndicators(testPainIndicators);
      }
    }
  }

  /**
   * Draw debug visualization on canvas
   * @param {Object} results Face Mesh results
   */
  drawDebugVisualization(results) {
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const timestamp = Date.now();

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, width, height);
    
    // Draw the video frame
    this.canvasCtx.drawImage(this.videoElement, 0, 0, width, height);
    
    // ✅ 5. Landmark Indexing Bug - Verify indices
    // Draw face mesh
    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        // Draw connections between landmarks for better visualization
        // Draw jaw line
        this.drawConnectors(landmarks, [61, 91, 84, 314, 402, 178, 87, 14, 317, 405, 321, 375, 291], 'red', width, height);
        
        // Draw eyes
        this.drawConnectors(landmarks, [159, 145, 33, 133, 157, 158, 159], 'blue', width, height); // Right eye
        this.drawConnectors(landmarks, [386, 374, 362, 263, 386, 387, 388, 466, 390, 373, 374], 'blue', width, height); // Left eye
        
        // Draw mouth
        this.drawConnectors(landmarks, [61, 91, 84, 314, 402, 178, 87, 14, 317, 405, 321, 375, 291], 'green', width, height);
        
        // Draw all landmarks with indices
        for (let i = 0; i < landmarks.length; i++) {
          const x = landmarks[i].x * width;
          const y = landmarks[i].y * height;
          
          this.canvasCtx.beginPath();
          this.canvasCtx.arc(x, y, 1, 0, 2 * Math.PI);
          this.canvasCtx.fillStyle = 'white';
          this.canvasCtx.fill();
          
          // Draw landmark index for key points
          // ✅ 5. Landmark Indexing Bug - Draw more indices for verification
          const keyPoints = [
            13, 14,           // Lips
            61, 91, 84, 314,  // Jaw
            159, 145,         // Right eye
            386, 374,         // Left eye
            10                // Forehead
          ];
          
          if (keyPoints.includes(i)) {
            this.canvasCtx.font = '12px Arial';
            this.canvasCtx.fillStyle = 'yellow';
            this.canvasCtx.fillText(`${i}`, x + 3, y);
          }
        }
        
        // Draw specific measurements for debugging
        if (landmarks[13] && landmarks[14]) {
          const upperLipX = landmarks[13].x * width;
          const upperLipY = landmarks[13].y * height;
          const lowerLipX = landmarks[14].x * width;
          const lowerLipY = landmarks[14].y * height;
          
          // Draw line between upper and lower lip
          this.canvasCtx.beginPath();
          this.canvasCtx.moveTo(upperLipX, upperLipY);
          this.canvasCtx.lineTo(lowerLipX, lowerLipY);
          this.canvasCtx.strokeStyle = 'yellow';
          this.canvasCtx.lineWidth = 2;
          this.canvasCtx.stroke();
          
          // Calculate and display the distance
          const lipDistance = Math.abs(upperLipY - lowerLipY);
          this.canvasCtx.font = '14px Arial';
          this.canvasCtx.fillStyle = 'yellow';
          this.canvasCtx.fillText(`Jaw: ${lipDistance.toFixed(4)}`, 10, 90);
        }
        
        // Draw eye measurements
        if (landmarks[159] && landmarks[145]) {
          const upperEyeX = landmarks[159].x * width;
          const upperEyeY = landmarks[159].y * height;
          const lowerEyeX = landmarks[145].x * width;
          const lowerEyeY = landmarks[145].y * height;
          
          // Draw line between upper and lower eyelid (right eye)
          this.canvasCtx.beginPath();
          this.canvasCtx.moveTo(upperEyeX, upperEyeY);
          this.canvasCtx.lineTo(lowerEyeX, lowerEyeY);
          this.canvasCtx.strokeStyle = 'cyan';
          this.canvasCtx.lineWidth = 2;
          this.canvasCtx.stroke();
          
          // Calculate and display the distance
          const rightEyeDistance = Math.abs(upperEyeY - lowerEyeY);
          this.canvasCtx.font = '14px Arial';
          this.canvasCtx.fillStyle = 'cyan';
          this.canvasCtx.fillText(`R.Eye: ${rightEyeDistance.toFixed(4)}`, 10, 110);
        }
        
        // Highlight specific regions if in pain
        if (this.calibrationCounter >= this.calibrationFrames) {
          const painIndicators = this.analyzeFaceForPain(landmarks);
          
          // Always log the pain analysis results for debugging
          console.log("Pain analysis results:", painIndicators);
          
          if (painIndicators) {
            for (const region in painIndicators) {
              const intensity = painIndicators[region];
              
              // Find the landmarks for this region
              for (const [regionName, regionData] of Object.entries(FACE_REGIONS)) {
                if (regionData.body_region === region) {
                  // Draw region with intensity-based color
                  this.canvasCtx.beginPath();
                  
                  // Connect landmarks to form a region
                  const landmarkIndices = regionData.landmarks;
                  if (landmarkIndices.length > 0) {
                    const firstLandmark = landmarks[landmarkIndices[0]];
                    const startX = firstLandmark.x * width;
                    const startY = firstLandmark.y * height;
                    
                    this.canvasCtx.moveTo(startX, startY);
                    
                    for (let i = 1; i < landmarkIndices.length; i++) {
                      const landmark = landmarks[landmarkIndices[i]];
                      const x = landmark.x * width;
                      const y = landmark.y * height;
                      this.canvasCtx.lineTo(x, y);
                    }
                    
                    // Close the path
                    this.canvasCtx.closePath();
                    
                    // Fill with semi-transparent red based on intensity
                    this.canvasCtx.fillStyle = `rgba(255, 0, 0, ${Math.min(intensity * 0.5, 0.5)})`;
                    this.canvasCtx.fill();
                    
                    // Stroke with red
                    this.canvasCtx.strokeStyle = 'red';
                    this.canvasCtx.lineWidth = 2;
                    this.canvasCtx.stroke();
                    
                    // Label the region
                    const centerX = startX;
                    const centerY = startY;
                    this.canvasCtx.font = '14px Arial';
                    this.canvasCtx.fillStyle = 'white';
                    this.canvasCtx.fillText(`${region}: ${intensity.toFixed(2)}`, centerX, centerY);
                  }
                  
                  break;
                }
              }
            }
          }
        }
      }
    } else {
      // Log when no face is detected
      console.log("No face detected in the current frame");
    }
    
    // Draw calibration status
    if (this.calibrationCounter < this.calibrationFrames) {
      this.canvasCtx.font = '20px Arial';
      this.canvasCtx.fillStyle = 'green';
      this.canvasCtx.fillText(`Calibrating: ${this.calibrationCounter}/${this.calibrationFrames}`, 10, 30);
    } else {
      // Draw status text
      this.canvasCtx.font = '20px Arial';
      this.canvasCtx.fillStyle = 'green';
      this.canvasCtx.fillText(`Face detection active`, 10, 30);
    }
    
    // Draw timestamp
    this.canvasCtx.font = '14px Arial';
    this.canvasCtx.fillStyle = 'white';
    this.canvasCtx.fillText(`Frame: ${timestamp}`, 10, 60);
    
    this.canvasCtx.restore();
  }
  
  // Helper method to draw connectors between landmarks
  drawConnectors(landmarks, indices, color, width, height) {
    if (!landmarks || !indices || indices.length < 2) return;
    
    this.canvasCtx.beginPath();
    const firstLandmark = landmarks[indices[0]];
    const startX = firstLandmark.x * width;
    const startY = firstLandmark.y * height;
    this.canvasCtx.moveTo(startX, startY);
    
    for (let i = 1; i < indices.length; i++) {
      const landmark = landmarks[indices[i]];
      const x = landmark.x * width;
      const y = landmark.y * height;
      this.canvasCtx.lineTo(x, y);
    }
    
    this.canvasCtx.strokeStyle = color;
    this.canvasCtx.lineWidth = 2;
    this.canvasCtx.stroke();
  }

  /**
   * Update baseline values during calibration
   * @param {Array} landmarks Face landmarks
   */
  updateBaseline(landmarks) {
    // Jaw (mouth opening)
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const mouthGap = Math.abs(upperLip.y - lowerLip.y);
    
    // Eyes
    const rightUpperEye = landmarks[159];
    const rightLowerEye = landmarks[145];
    const leftUpperEye = landmarks[386];
    const leftLowerEye = landmarks[374];
    const rightEyeOpening = Math.abs(rightUpperEye.y - rightLowerEye.y);
    const leftEyeOpening = Math.abs(leftUpperEye.y - leftLowerEye.y);
    
    // Forehead
    const leftEyebrow = landmarks[107];
    const rightEyebrow = landmarks[336];
    const forehead = landmarks[10];
    const eyebrowHeight = (leftEyebrow.y + rightEyebrow.y) / 2;
    const foreheadHeight = forehead.y;
    const foreheadDistance = Math.abs(foreheadHeight - eyebrowHeight);
    
    // Asymmetry
    const leftEye = landmarks[386];
    const rightEye = landmarks[159];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const eyeAlignment = Math.abs(leftEye.y - rightEye.y);
    const mouthAlignment = Math.abs(leftMouth.y - rightMouth.y);
    const asymmetry = eyeAlignment + mouthAlignment;
    
    // Update running averages
    if (this.calibrationCounter === 0) {
      this.baselineValues = {
        "jaw": mouthGap,
        "right_eye": rightEyeOpening,
        "left_eye": leftEyeOpening,
        "forehead": foreheadDistance,
        "asymmetry": asymmetry
      };
    } else {
      for (const key in this.baselineValues) {
        if (key === "jaw") {
          this.baselineValues[key] = (this.baselineValues[key] * this.calibrationCounter + mouthGap) / (this.calibrationCounter + 1);
        } else if (key === "right_eye") {
          this.baselineValues[key] = (this.baselineValues[key] * this.calibrationCounter + rightEyeOpening) / (this.calibrationCounter + 1);
        } else if (key === "left_eye") {
          this.baselineValues[key] = (this.baselineValues[key] * this.calibrationCounter + leftEyeOpening) / (this.calibrationCounter + 1);
        } else if (key === "forehead") {
          this.baselineValues[key] = (this.baselineValues[key] * this.calibrationCounter + foreheadDistance) / (this.calibrationCounter + 1);
        } else if (key === "asymmetry") {
          this.baselineValues[key] = (this.baselineValues[key] * this.calibrationCounter + asymmetry) / (this.calibrationCounter + 1);
        }
      }
    }
    
    this.calibrationCounter++;
    
    if (this.calibrationCounter === this.calibrationFrames) {
      console.log('Calibration complete. Baseline values:', this.baselineValues);
    }
  }

  /**
   * Analyze face for pain indicators
   * @param {Array} landmarks Face landmarks
   * @returns {Object} Pain indicators with intensities
   */
  analyzeFaceForPain(landmarks) {
    console.log("Evaluating expression change..."); // Debug step 3
    
    if (this.calibrationCounter < this.calibrationFrames) {
      console.log("Still calibrating, not detecting pain yet");
      return null;
    }
    
    // Debug step 6: Use facial feature distances for quick test
    const leftEyebrow = landmarks[70]; // Adjust index if needed
    const leftEyeTop = landmarks[159];
    const eyebrowToEyeDist = Math.abs(leftEyebrow.y - leftEyeTop.y);
    console.log("Eyebrow to eye distance:", eyebrowToEyeDist);
    
    // Mouth openness
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const mouthOpenness = Math.abs(upperLip.y - lowerLip.y);
    console.log("Mouth openness:", mouthOpenness);
    
    // Smile detection (mouth corners)
    const leftMouthCorner = landmarks[61];
    const rightMouthCorner = landmarks[291];
    const smileWidth = Math.abs(leftMouthCorner.x - rightMouthCorner.x);
    console.log("Smile width:", smileWidth);
    
    // Debug step 5: Compare baseline and expression
    console.log("Baseline values:", this.baselineValues);
    
    // Enable test mode for debugging - always return some pain indicators
    const testMode = false; // Set to false to test real detection
    
    if (testMode) {
      console.log("TEST MODE ENABLED - Generating test pain indicators");
      // Return test pain indicators for debugging
      return {
        "jaw": 0.7,
        "head": 0.6,
        "right_eye": 0.5,
        "left_eye": 0.4
      };
    }
    
    const painIndicators = {};
    
    // Check for jaw pain (mouth opening)
    const jawPain = this.detectJawPain(landmarks);
    console.log("Jaw pain detection:", jawPain);
    if (jawPain.detected) {
      painIndicators["jaw"] = Math.min(jawPain.intensity, 1.0);
    }
    
    // Check for eye pain
    const rightEyePain = this.detectEyePain(landmarks, "right");
    console.log("Right eye pain detection:", rightEyePain);
    if (rightEyePain.detected) {
      painIndicators["right_eye"] = Math.min(rightEyePain.intensity, 1.0);
    }
    
    const leftEyePain = this.detectEyePain(landmarks, "left");
    console.log("Left eye pain detection:", leftEyePain);
    if (leftEyePain.detected) {
      painIndicators["left_eye"] = Math.min(leftEyePain.intensity, 1.0);
    }
    
    // Check for forehead pain (headache)
    const foreheadPain = this.detectForeheadPain(landmarks);
    console.log("Forehead pain detection:", foreheadPain);
    if (foreheadPain.detected) {
      painIndicators["head"] = Math.min(foreheadPain.intensity, 1.0);
    }
    
    // Check for facial asymmetry
    const asymmetry = this.detectFacialAsymmetry(landmarks);
    console.log("Facial asymmetry detection:", asymmetry);
    if (asymmetry.detected) {
      // Asymmetry could indicate pain on either side
      if (asymmetry.intensity > 0.5) {
        painIndicators["right_cheek"] = Math.min(asymmetry.intensity * 0.8, 1.0);
        painIndicators["left_cheek"] = Math.min(asymmetry.intensity * 0.8, 1.0);
      }
    }
    
    // Debug step 4: Test signal
    // Always add at least one pain indicator for testing
    if (Object.keys(painIndicators).length === 0) {
      console.log("No pain detected naturally, adding test indicator");
      painIndicators["jaw"] = 0.5;
    }
    
    console.log("Final pain indicators:", painIndicators);
    return painIndicators;
  }

  /**
   * Detect jaw pain from mouth opening
   * @param {Array} landmarks Face landmarks
   * @returns {Object} Detection result
   */
  detectJawPain(landmarks) {
    // Measure distance between upper and lower lip
    const upperLip = landmarks[13];  // Upper lip
    const lowerLip = landmarks[14];  // Lower lip
    const mouthGap = Math.abs(upperLip.y - lowerLip.y);
    
    // Log the measurement for debugging
    console.log("Jaw measurement - Mouth gap:", mouthGap);
    
    // Compare with baseline if available
    if ("jaw" in this.baselineValues) {
      // If mouth is significantly more open than baseline, it might indicate pain
      const ratio = mouthGap / this.baselineValues["jaw"];
      console.log("Jaw ratio to baseline:", ratio);
      
      // SUPER sensitive detection for testing - any change triggers detection
      // Use an extremely low threshold of 1.05 (5% change)
      const detected = mouthGap > this.baselineValues["jaw"] * 1.05;
      const intensity = ratio;
      
      console.log("Jaw pain detected?", detected, "with intensity", intensity);
      
      // For testing, always detect some pain
      // const detected = true;
      // const intensity = 0.5;
      
      return { detected, intensity };
    } else {
      // Default threshold if no baseline - EXTREMELY sensitive
      // Use a very low threshold of 0.01 for testing
      const detected = mouthGap > 0.01;
      const intensity = mouthGap / 0.01;
      
      console.log("Jaw pain detected (no baseline)?", detected, "with intensity", intensity);
      
      return { detected, intensity };
    }
  }

  /**
   * Detect eye pain from squinting
   * @param {Array} landmarks Face landmarks
   * @param {string} side "right" or "left"
   * @returns {Object} Detection result
   */
  detectEyePain(landmarks, side = "right") {
    let upperEye, lowerEye;
    
    if (side === "right") {
      // Right eye upper and lower points
      upperEye = landmarks[159];  // Upper eyelid
      lowerEye = landmarks[145];  // Lower eyelid
    } else {
      // Left eye upper and lower points
      upperEye = landmarks[386];  // Upper eyelid
      lowerEye = landmarks[374];  // Lower eyelid
    }
    
    const eyeOpening = Math.abs(upperEye.y - lowerEye.y);
    
    // Log the measurement for debugging
    console.log(`${side} eye measurement - Eye opening:`, eyeOpening);
    
    // Compare with baseline if available
    const regionKey = side === "right" ? "right_eye" : "left_eye";
    if (regionKey in this.baselineValues) {
      // If eye is significantly more closed than baseline, it might indicate pain
      const ratio = eyeOpening / this.baselineValues[regionKey];
      console.log(`${side} eye ratio to baseline:`, ratio);
      
      // More sensitive detection - raise the threshold from 0.7 to 0.8
      const detected = eyeOpening < this.baselineValues[regionKey] * 0.8;
      const intensity = 1 - ratio;
      
      // For testing, always detect some pain
      // const detected = true;
      // const intensity = 0.5;
      
      return { detected, intensity };
    } else {
      // Default threshold if no baseline - more sensitive
      const detected = eyeOpening < 0.015;
      const intensity = 1 - (eyeOpening / 0.015);
      return { detected, intensity };
    }
  }

  /**
   * Detect forehead pain from brow furrowing
   * @param {Array} landmarks Face landmarks
   * @returns {Object} Detection result
   */
  detectForeheadPain(landmarks) {
    // Measure distance between eyebrows and hairline
    const leftEyebrow = landmarks[107];
    const rightEyebrow = landmarks[336];
    const forehead = landmarks[10];  // Top of forehead
    
    // Calculate vertical distance
    const eyebrowHeight = (leftEyebrow.y + rightEyebrow.y) / 2;
    const foreheadHeight = forehead.y;
    const foreheadDistance = Math.abs(foreheadHeight - eyebrowHeight);
    
    // Log the measurement for debugging
    console.log("Forehead measurement - Distance:", foreheadDistance);
    
    // Compare with baseline if available
    if ("forehead" in this.baselineValues) {
      // If forehead is significantly more furrowed than baseline
      const ratio = foreheadDistance / this.baselineValues["forehead"];
      console.log("Forehead ratio to baseline:", ratio);
      
      // More sensitive detection - raise the threshold from 0.8 to 0.9
      const detected = foreheadDistance < this.baselineValues["forehead"] * 0.9;
      const intensity = 1 - ratio;
      
      // For testing, always detect some pain
      // const detected = true;
      // const intensity = 0.5;
      
      return { detected, intensity };
    } else {
      // Default threshold if no baseline - more sensitive
      const detected = foreheadDistance < 0.12;
      const intensity = 1 - (foreheadDistance / 0.12);
      return { detected, intensity };
    }
  }

  /**
   * Detect facial asymmetry
   * @param {Array} landmarks Face landmarks
   * @returns {Object} Detection result
   */
  detectFacialAsymmetry(landmarks) {
    // Compare left and right sides of face
    const leftEye = landmarks[386];
    const rightEye = landmarks[159];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    
    // Calculate horizontal alignment
    const eyeAlignment = Math.abs(leftEye.y - rightEye.y);
    const mouthAlignment = Math.abs(leftMouth.y - rightMouth.y);
    
    const asymmetry = eyeAlignment + mouthAlignment;
    
    // Log the measurement for debugging
    console.log("Asymmetry measurement:", asymmetry);
    
    // Compare with baseline if available
    if ("asymmetry" in this.baselineValues) {
      const ratio = asymmetry / this.baselineValues["asymmetry"];
      console.log("Asymmetry ratio to baseline:", ratio);
      
      // More sensitive detection - lower the threshold from 1.5 to 1.3
      const detected = asymmetry > this.baselineValues["asymmetry"] * 1.3;
      const intensity = ratio;
      
      // For testing, always detect some pain
      // const detected = true;
      // const intensity = 0.5;
      
      return { detected, intensity };
    } else {
      // Default threshold if no baseline - more sensitive
      const detected = asymmetry > 0.02;
      const intensity = asymmetry / 0.02;
      return { detected, intensity };
    }
  }

  /**
   * Send pain indicators to the server
   * @param {Object} painIndicators Pain indicators with intensities
   */
  sendPainIndicators(painIndicators) {
    console.log("sendPainIndicators called with:", painIndicators);
    
    if (!this.socket) {
      console.error("Cannot send pain indicators: socket is missing");
      return;
    }
    
    if (!this.roomId) {
      console.error("Cannot send pain indicators: roomId is missing");
      return;
    }
    
    console.log("Socket and roomId are available:", {
      socketExists: !!this.socket,
      socketEmitExists: !!this.socket.emit,
      roomId: this.roomId
    });
    
    const currentTime = Date.now();
    
    // ALWAYS send updates for testing - remove throttling
    // if (currentTime - this.lastSentTime >= 500) {
    if (true) {  // Always send for testing
      // Prepare data to send
      const data = {
        type: "facial_pain",
        roomId: this.roomId,
        regions: []
      };
      
      // Add each pain indicator to the data
      for (const [region, intensity] of Object.entries(painIndicators)) {
        const regionData = {
          region: region,
          intensity: parseFloat(intensity)
        };
        
        // Add description if available
        for (const [faceRegion, info] of Object.entries(FACE_REGIONS)) {
          if (info.body_region === region) {
            regionData.description = info.description;
            break;
          }
        }
        
        data.regions.push(regionData);
      }
      
      console.log("Sending pain indicators to server:", JSON.stringify(data));
      
      // Send data via WebSocket
      try {
        if (this.socket.emit) {
          // Make sure roomId is included in the data
          if (!data.roomId && this.roomId) {
            data.roomId = this.roomId;
            console.log("Added roomId to pain data:", this.roomId);
          }
          
          // Socket.io - use consistent event name "pain_data" as suggested
          this.socket.emit('pain_data', data);
          console.log("Pain data sent via socket.io at", new Date().toISOString(), "to room:", data.roomId);
          
          // Also send with the original event name for backward compatibility
          this.socket.emit('facial-pain-update', data);
          console.log("Pain data also sent via facial-pain-update event");
          
          // For testing, also log the socket connection status
          console.log("Socket connected:", this.socket.connected, "Socket ID:", this.socket.id);
          
          // Dispatch a local event for direct testing
          if (typeof window !== 'undefined') {
            const testEvent = new CustomEvent('test-pain-data', { detail: data });
            window.dispatchEvent(testEvent);
            console.log("Local test-pain-data event dispatched");
          }
        } else if (this.socket.send) {
          // Native WebSocket
          this.socket.send(JSON.stringify(data));
          console.log("Pain data sent via native WebSocket");
        } else {
          console.error("Socket does not have emit or send method");
          console.log("Socket object type:", typeof this.socket);
          console.log("Socket properties:", Object.getOwnPropertyNames(this.socket));
        }
        
        this.lastSentTime = currentTime;
        
        // Call the callback if provided
        if (this.onPainDetected && typeof this.onPainDetected === 'function') {
          console.log("Calling onPainDetected callback");
          this.onPainDetected(data.regions);
        } else {
          console.log("onPainDetected callback not available or not a function");
        }
      } catch (error) {
        console.error("Error sending pain indicators:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
    } else {
      console.log("Skipping pain update due to throttling");
    }
  }
}

// Create a singleton instance
const browserFacialPainDetector = new BrowserFacialPainDetector();

export default browserFacialPainDetector;