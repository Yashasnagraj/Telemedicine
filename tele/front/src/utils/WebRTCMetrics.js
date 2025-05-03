/**
 * WebRTCMetrics.js
 * Utility for collecting and logging WebRTC performance metrics
 */

class WebRTCMetricsCollector {
  constructor(options = {}) {
    this.role = options.role || 'unknown'; // 'patient' or 'doctor'
    this.peerConnection = null;
    this.isCollecting = false;
    this.collectionInterval = null;
    this.intervalTime = options.intervalTime || 5000; // Default: collect every 5 seconds
    this.compression = options.compression || false; // Flag for AI compression
    this.onMetricsCollected = options.onMetricsCollected || this.defaultMetricsHandler;
    this.sessionId = this.generateSessionId();
    this.metrics = [];
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Set the RTCPeerConnection to monitor
   */
  setPeerConnection(peerConnection) {
    this.peerConnection = peerConnection;
    console.log(`WebRTC Metrics: Monitoring initialized for ${this.role}`);
    return this;
  }

  /**
   * Start collecting metrics
   */
  startCollection() {
    if (!this.peerConnection) {
      console.error('WebRTC Metrics: No peer connection set');
      return this;
    }

    if (this.isCollecting) {
      console.warn('WebRTC Metrics: Already collecting');
      return this;
    }

    this.isCollecting = true;
    console.log(`WebRTC Metrics: Started collection for ${this.role} (compression: ${this.compression})`);
    
    // Log initial connection event
    this.logEvent('connection_start');
    
    // Set up collection interval
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.intervalTime);
    
    return this;
  }

  /**
   * Stop collecting metrics
   */
  stopCollection() {
    if (!this.isCollecting) return this;
    
    clearInterval(this.collectionInterval);
    this.isCollecting = false;
    
    // Log final connection event
    this.logEvent('connection_end');
    
    console.log(`WebRTC Metrics: Stopped collection for ${this.role}`);
    
    // Save the collected metrics
    this.saveMetrics();
    
    return this;
  }

  /**
   * Log a specific event
   */
  logEvent(eventType, additionalData = {}) {
    const eventLog = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      role: this.role,
      event: eventType,
      compression: this.compression,
      ...additionalData
    };
    
    console.log(`WebRTC Metrics Event: ${eventType}`, eventLog);
    this.metrics.push(eventLog);
    
    return this;
  }

  /**
   * Collect metrics from the peer connection
   */
  async collectMetrics() {
    if (!this.peerConnection || !this.isCollecting) return;

    try {
      const stats = await this.peerConnection.getStats();
      
      // Initialize metrics object
      const metricsData = {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        role: this.role,
        compression: this.compression,
        rtt_ms: null,
        jitter_ms: null,
        packets_lost: 0,
        packets_received: 0,
        packets_sent: 0,
        fps: null,
        bitrate_kbps_inbound: null,
        bitrate_kbps_outbound: null,
        resolution_width: null,
        resolution_height: null,
        codec: null
      };

      // Debug: Log all stats reports for troubleshooting
      if (this.compression) {
        console.debug('WebRTC Stats with compression enabled:');
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp' || 
              report.type === 'remote-inbound-rtp' || report.type === 'remote-outbound-rtp') {
            console.debug(`${report.type}:`, report);
          }
        });
      }

      // Process each stats report
      stats.forEach(report => {
        // Remote inbound RTP - contains RTT
        if (report.type === 'remote-inbound-rtp') {
          metricsData.rtt_ms = report.roundTripTime ? Math.round(report.roundTripTime * 1000) : null;
        }
        
        // Inbound RTP - video metrics
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          metricsData.jitter_ms = report.jitter ? Math.round(report.jitter * 1000) : null;
          metricsData.packets_lost = report.packetsLost || 0;
          metricsData.packets_received = report.packetsReceived || 0;
          metricsData.fps = report.framesPerSecond ? Math.round(report.framesPerSecond) : null;
          metricsData.resolution_width = report.frameWidth;
          metricsData.resolution_height = report.frameHeight;
          
          // Calculate bitrate if bytesReceived is available
          if (report.bytesReceived && this._lastInboundStats && this._lastInboundStats.bytesReceived) {
            const bytesReceived = report.bytesReceived - this._lastInboundStats.bytesReceived;
            const timeDiff = report.timestamp - this._lastInboundStats.timestamp;
            if (timeDiff > 0) {
              metricsData.bitrate_kbps_inbound = Math.round((bytesReceived * 8) / timeDiff); // kbps
            }
          }
          
          this._lastInboundStats = report;
        }
        
        // Outbound RTP - for outgoing video
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          metricsData.packets_sent = report.packetsSent || 0;
          
          // Get resolution from frameWidth/frameHeight if available
          if (report.frameWidth && report.frameHeight) {
            metricsData.resolution_width = report.frameWidth;
            metricsData.resolution_height = report.frameHeight;
          }
          
          // Get framerate if available
          if (report.framesPerSecond) {
            metricsData.fps = Math.round(report.framesPerSecond);
          }
          
          // Calculate outbound bitrate
          if (report.bytesSent && this._lastOutboundStats && this._lastOutboundStats.bytesSent) {
            const bytesSent = report.bytesSent - this._lastOutboundStats.bytesSent;
            const timeDiff = report.timestamp - this._lastOutboundStats.timestamp;
            if (timeDiff > 0) {
              metricsData.bitrate_kbps_outbound = Math.round((bytesSent * 8) / timeDiff); // kbps
            }
          }
          
          this._lastOutboundStats = report;
          
          // Get codec information if available
          if (report.codecId) {
            const codecStats = stats.get(report.codecId);
            if (codecStats) {
              metricsData.codec = codecStats.mimeType;
            }
          }
        }
        
        // Try to get additional information from media-source stats
        if (report.type === 'media-source' && report.kind === 'video') {
          if (!metricsData.fps && report.framesPerSecond) {
            metricsData.fps = Math.round(report.framesPerSecond);
          }
          if (!metricsData.resolution_width && report.width) {
            metricsData.resolution_width = report.width;
            metricsData.resolution_height = report.height;
          }
        }
      });

      // If we still don't have resolution or framerate, try to get it from the video tracks
      if ((!metricsData.resolution_width || !metricsData.fps) && this.peerConnection.getSenders) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
        
        if (videoSender && videoSender.track) {
          const settings = videoSender.track.getSettings();
          
          if (!metricsData.resolution_width && settings.width) {
            metricsData.resolution_width = settings.width;
            metricsData.resolution_height = settings.height;
          }
          
          if (!metricsData.fps && settings.frameRate) {
            metricsData.fps = Math.round(settings.frameRate);
          }
        }
      }

      // Store the metrics
      this.metrics.push(metricsData);
      
      // Call the handler
      this.onMetricsCollected(metricsData);
      
    } catch (error) {
      console.error('WebRTC Metrics: Error collecting metrics', error);
    }
  }

  /**
   * Default handler for collected metrics
   */
  defaultMetricsHandler(metrics) {
    console.log('WebRTC Metrics:', JSON.stringify(metrics, null, 2));
  }

  /**
   * Save metrics to local storage
   */
  saveMetrics() {
    try {
      // Create a meaningful filename
      const filename = `webrtc-metrics-${this.role}-${this.compression ? 'with' : 'without'}-compression-${this.sessionId}.json`;
      
      // Format the metrics as JSON
      const metricsJson = JSON.stringify(this.metrics, null, 2);
      
      // Log to console for now
      console.log(`WebRTC Metrics: Session complete. ${this.metrics.length} data points collected.`);
      console.log(`WebRTC Metrics: Data would be saved as ${filename}`);
      
      // In a real implementation, you might want to:
      // 1. Save to localStorage
      localStorage.setItem(filename, metricsJson);
      console.log(`WebRTC Metrics: Saved to localStorage with key: ${filename}`);
      
      // 2. Or offer as a download (in a browser context)
      // This would typically be triggered by a user action
      this.downloadMetrics(filename, metricsJson);
      
      // 3. Or send to a server endpoint
      // this.sendMetricsToServer(metricsJson);
      
    } catch (error) {
      console.error('WebRTC Metrics: Error saving metrics', error);
    }
  }

  /**
   * Download metrics as a JSON file
   */
  downloadMetrics(filename, data) {
    // This function would be called from a UI component
    // Creating a download link programmatically
    const element = document.createElement('a');
    const file = new Blob([data], {type: 'application/json'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    
    // For demonstration, log that download is ready
    console.log(`WebRTC Metrics: Download ready for ${filename}`);
    
    // In a real implementation, you would append to the document and click:
    // document.body.appendChild(element);
    // element.click();
    // document.body.removeChild(element);
  }

  /**
   * Send metrics to a server endpoint
   */
  sendMetricsToServer(data) {
    // Example implementation - would be customized for your backend
    console.log('WebRTC Metrics: Would send to server:', data.length, 'bytes');
    
    // Actual implementation would use fetch or axios:
    /*
    fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data,
    })
    .then(response => response.json())
    .then(result => {
      console.log('WebRTC Metrics: Server response:', result);
    })
    .catch(error => {
      console.error('WebRTC Metrics: Error sending to server:', error);
    });
    */
  }

  /**
   * Set compression flag
   */
  setCompression(enabled) {
    this.compression = enabled;
    return this;
  }
}

export default WebRTCMetricsCollector;