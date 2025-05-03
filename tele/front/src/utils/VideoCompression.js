/**
 * VideoCompression.js
 * AI-based video compression utility for WebRTC streams
 */

import * as tf from '@tensorflow/tfjs';

class VideoCompressor {
  constructor(options = {}) {
    this.options = {
      targetBitrate: options.targetBitrate || 500, // Target bitrate in kbps
      targetFrameRate: options.targetFrameRate || 30,
      targetResolution: options.targetResolution || { width: 640, height: 360 }, // Default to 360p
      adaptiveMode: options.adaptiveMode !== false, // Enable adaptive compression by default
      qualityThreshold: options.qualityThreshold || 0.85, // SSIM quality threshold (0-1)
      latencyThreshold: options.latencyThreshold || 150, // ms
      debugOverlay: options.debugOverlay || false, // Show debug overlay on video
      compressionLevels: options.compressionLevels || [
        { name: 'high', crf: 18, resolution: { width: 1280, height: 720 }, frameRate: 30 },
        { name: 'medium', crf: 23, resolution: { width: 640, height: 360 }, frameRate: 25 },
        { name: 'low', crf: 28, resolution: { width: 480, height: 270 }, frameRate: 20 },
        { name: 'very-low', crf: 32, resolution: { width: 320, height: 180 }, frameRate: 15 }
      ],
      ...options
    };

    this.model = null;
    this.isModelLoaded = false;
    this.isCompressing = false;
    this.currentLevel = 1; // Start with medium compression
    this.processingCanvas = document.createElement('canvas');
    this.processingContext = this.processingCanvas.getContext('2d', { alpha: false });
    this.frameProcessor = null;
    this.networkStats = {
      rtt: 0,
      jitter: 0,
      packetsLost: 0,
      bitrate: 0
    };
    this.compressionStats = {
      inputSize: 0,
      outputSize: 0,
      compressionRatio: 0,
      processingTime: 0,
      quality: 1
    };
    this.onStatsUpdate = options.onStatsUpdate || null;
  }

  /**
   * Initialize the compressor and load the AI model
   */
  async initialize() {
    console.log('Initializing AI video compressor...');
    try {
      // Load TensorFlow.js model
      // In a real implementation, you would load a pre-trained model from a URL or file
      // For this example, we'll use a simple model or simulate compression
      
      // Simulated model loading for demonstration
      await this._simulateModelLoading();
      
      // Set up the processing canvas
      this.processingCanvas.width = this.options.targetResolution.width;
      this.processingCanvas.height = this.options.targetResolution.height;
      
      this.isModelLoaded = true;
      console.log('AI video compressor initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize AI video compressor:', error);
      return false;
    }
  }

  /**
   * Simulate loading an AI model (for demonstration)
   * In a real implementation, this would load a TensorFlow.js model
   */
  async _simulateModelLoading() {
    console.log('Loading AI compression model...');
    
    // Simulate model loading time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a simple frame processor function
    this.frameProcessor = (imageData) => {
      // In a real implementation, this would run the image through the AI model
      // For now, we'll just simulate compression by adjusting resolution and quality
      return this._simulateCompression(imageData);
    };
    
    console.log('AI compression model loaded');
  }

  /**
   * Update network statistics to adapt compression level
   */
  updateNetworkStats(stats) {
    this.networkStats = {
      ...this.networkStats,
      ...stats
    };
    
    if (this.options.adaptiveMode) {
      this._adaptCompressionLevel();
    }
    
    return this;
  }

  /**
   * Adapt compression level based on network conditions
   */
  _adaptCompressionLevel() {
    const { rtt, jitter, packetsLost, bitrate } = this.networkStats;
    let newLevel = this.currentLevel;
    
    // Adjust compression based on network conditions
    if (rtt > 300 || packetsLost > 5 || bitrate < 200) {
      // Poor network conditions - increase compression
      newLevel = Math.min(this.options.compressionLevels.length - 1, this.currentLevel + 1);
    } else if (rtt < 100 && packetsLost < 1 && bitrate > 1000) {
      // Good network conditions - decrease compression
      newLevel = Math.max(0, this.currentLevel - 1);
    }
    
    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      console.log(`Adapting compression to level: ${this.options.compressionLevels[this.currentLevel].name}`);
      
      // Update target resolution and frame rate
      const { resolution, frameRate } = this.options.compressionLevels[this.currentLevel];
      this.options.targetResolution = resolution;
      this.options.targetFrameRate = frameRate;
      
      // Resize processing canvas
      this.processingCanvas.width = resolution.width;
      this.processingCanvas.height = resolution.height;
    }
  }

  /**
   * Compress a video frame using the AI model
   * @param {HTMLVideoElement} videoElement - The video element to compress
   * @returns {ImageData} - The compressed frame
   */
  compressFrame(videoElement) {
    if (!this.isModelLoaded || !videoElement) {
      return null;
    }
    
    const startTime = performance.now();
    
    try {
      // Draw the video frame to the canvas at the target resolution
      this.processingContext.drawImage(
        videoElement,
        0, 0,
        this.processingCanvas.width,
        this.processingCanvas.height
      );
      
      // Get the image data from the canvas
      const imageData = this.processingContext.getImageData(
        0, 0,
        this.processingCanvas.width,
        this.processingCanvas.height
      );
      
      // Estimate input size (uncompressed RGB data)
      this.compressionStats.inputSize = imageData.width * imageData.height * 3; // RGB bytes
      
      // Process the frame using our AI model or simulation
      const processedImageData = this.frameProcessor(imageData);
      
      // Update compression stats
      this.compressionStats.processingTime = performance.now() - startTime;
      
      // Notify about stats update
      if (this.onStatsUpdate) {
        this.onStatsUpdate(this.compressionStats);
      }
      
      return processedImageData;
    } catch (error) {
      console.error('Error compressing video frame:', error);
      return null;
    }
  }

  /**
   * Simulate AI compression (for demonstration)
   * In a real implementation, this would use the AI model to compress the frame
   */
  _simulateCompression(imageData) {
    // For simulation, we're just using the resized frame as "compression"
    // In a real implementation, this would apply more sophisticated compression
    
    // Simulate compression ratio based on current compression level
    const compressionLevel = this.options.compressionLevels[this.currentLevel];
    const simulatedRatio = 1 - (compressionLevel.crf / 50); // Higher CRF = more compression
    
    // Update compression stats
    this.compressionStats.outputSize = Math.floor(this.compressionStats.inputSize * simulatedRatio);
    this.compressionStats.compressionRatio = this.compressionStats.inputSize / this.compressionStats.outputSize;
    this.compressionStats.quality = 1 - (compressionLevel.crf / 50); // Simulate quality score
    
    return imageData; // Return the resized image data
  }

  /**
   * Process a MediaStream with AI compression
   * @param {MediaStream} inputStream - The original media stream
   * @returns {MediaStream} - A new stream with compressed video
   */
  async processStream(inputStream) {
    if (!this.isModelLoaded || !inputStream) {
      console.error('Cannot process stream: model not loaded or no input stream');
      return inputStream;
    }
    
    try {
      // Create a video element to capture the input stream
      const videoEl = document.createElement('video');
      videoEl.srcObject = inputStream;
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      
      // Wait for video to be ready
      await new Promise(resolve => {
        videoEl.onloadedmetadata = () => {
          videoEl.play().then(resolve);
        };
      });
      
      // Create a canvas for the output stream
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = this.options.targetResolution.width;
      outputCanvas.height = this.options.targetResolution.height;
      const ctx = outputCanvas.getContext('2d', { alpha: false });
      
      // Create a stream from the canvas with the same frame rate as the original
      // Use the target frame rate or the original track's frame rate if available
      const originalVideoTrack = inputStream.getVideoTracks()[0];
      const frameRate = originalVideoTrack?.getSettings()?.frameRate || this.options.targetFrameRate;
      
      // Create a stream from the canvas
      const outputStream = outputCanvas.captureStream(frameRate);
      
      // Get the video track from the canvas stream
      const compressedVideoTrack = outputStream.getVideoTracks()[0];
      
      // Copy constraints from the original track to maintain compatibility
      if (originalVideoTrack && compressedVideoTrack) {
        // Set the same track ID to help with statistics correlation
        // Note: This is a workaround and may not work in all browsers
        try {
          // This is not standard but might work in some implementations
          compressedVideoTrack._id = originalVideoTrack.id + '-compressed';
        } catch (e) {
          // Ignore if not supported
        }
        
        // Log the track information for debugging
        console.log('Original track:', originalVideoTrack.id, originalVideoTrack.label);
        console.log('Compressed track:', compressedVideoTrack.id, compressedVideoTrack.label);
      }
      
      // Add audio tracks from the original stream
      inputStream.getAudioTracks().forEach(track => {
        outputStream.addTrack(track);
      });
      
      // Start the compression loop
      this.isCompressing = true;
      this._compressionLoop(videoEl, outputCanvas, ctx);
      
      // Log that the compressed stream is ready
      console.log('Compressed stream ready with resolution:', 
        this.options.targetResolution.width, 'x', this.options.targetResolution.height,
        'at', frameRate, 'fps');
      
      return outputStream;
    } catch (error) {
      console.error('Error setting up stream processing:', error);
      return inputStream; // Return original stream as fallback
    }
  }

  /**
   * Main compression loop that processes frames continuously
   */
  _compressionLoop(videoEl, canvas, ctx) {
    if (!this.isCompressing) return;
    
    try {
      // Process the current frame
      const compressedFrame = this.compressFrame(videoEl);
      
      if (compressedFrame) {
        // Draw the compressed frame to the output canvas
        ctx.putImageData(compressedFrame, 0, 0);
      } else {
        // Fallback: just draw the video directly
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      }
      
      // Add debug information to the canvas if needed
      if (this.options.debugOverlay) {
        this._drawDebugOverlay(ctx, canvas);
      }
    } catch (error) {
      console.error('Error in compression loop:', error);
      // On error, still try to draw the original video as fallback
      try {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Ignore if this also fails
      }
    }
    
    // Schedule the next frame
    requestAnimationFrame(() => this._compressionLoop(videoEl, canvas, ctx));
  }
  
  /**
   * Draw debug information overlay on the canvas
   */
  _drawDebugOverlay(ctx, canvas) {
    const { compressionRatio, quality, processingTime } = this.compressionStats;
    const level = this.options.compressionLevels[this.currentLevel].name;
    
    // Save context state
    ctx.save();
    
    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 220, 80);
    
    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText(`AI Compression: ${level} (${quality ? (quality * 100).toFixed(0) : 'N/A'}%)`, 10, 20);
    ctx.fillText(`Ratio: ${compressionRatio ? compressionRatio.toFixed(1) : 'N/A'}x`, 10, 40);
    ctx.fillText(`Time: ${processingTime ? processingTime.toFixed(1) : 'N/A'} ms`, 10, 60);
    
    // Restore context state
    ctx.restore();
  }

  /**
   * Stop compression and clean up resources
   */
  stop() {
    this.isCompressing = false;
    
    // Clean up resources
    if (this.model) {
      // In a real implementation with TensorFlow.js, you might need to dispose of tensors
      // this.model.dispose();
    }
    
    console.log('AI video compression stopped');
  }

  /**
   * Get current compression statistics
   */
  getCompressionStats() {
    return {
      ...this.compressionStats,
      currentLevel: this.options.compressionLevels[this.currentLevel].name,
      targetResolution: this.options.targetResolution,
      targetFrameRate: this.options.targetFrameRate
    };
  }
}

export default VideoCompressor;