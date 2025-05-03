# WebRTC Metrics Collection for Tele-Mine

This document describes the implementation of WebRTC metrics collection in the Tele-Mine telemedicine platform. The metrics collection system is designed to measure and log key performance indicators for WebRTC video calls, with a focus on comparing performance with and without AI-based compression.

## Overview

The metrics collection system consists of:

1. **WebRTCMetricsCollector** - A utility class that collects and logs WebRTC performance metrics
2. **MetricsDisplay** - A React component that displays real-time metrics in the UI

## Metrics Collected

The system collects the following metrics:

- **Round Trip Time (RTT)** - Overall latency in milliseconds
- **Jitter** - Packet arrival variability in milliseconds
- **Packet Loss** - Number and percentage of lost packets
- **Frame Rate** - Video smoothness in frames per second
- **Bitrate** - Bandwidth usage for inbound and outbound streams in kbps
- **Resolution** - Video dimensions (width x height)
- **Codec** - Video codec in use
- **Connection State** - Current WebRTC connection state

## Implementation

### WebRTCMetricsCollector

The `WebRTCMetricsCollector` class is responsible for:

- Collecting metrics from the RTCPeerConnection using getStats() API
- Logging events during the connection lifecycle
- Calculating derived metrics like bitrate
- Saving metrics to localStorage or offering them for download
- Tracking whether AI compression is enabled

### MetricsDisplay

The `MetricsDisplay` component provides:

- Real-time visualization of key metrics
- Color-coded indicators for metric quality
- Toggle to show/hide the metrics panel

### Integration

The metrics collection is integrated into both the PatientConsultationRoom and DoctorConsultationRoom components:

1. A metrics collector instance is created when the WebRTC connection is initialized
2. The collector is attached to the RTCPeerConnection
3. Metrics are collected every 5 seconds
4. The metrics are displayed in a floating panel in the UI
5. A toggle button allows enabling/disabling AI compression for A/B testing
6. Metrics are saved when the call ends

## Usage

### Viewing Metrics

During a consultation, metrics are displayed in a panel at the bottom-right of the screen. The panel can be toggled on/off.

### Toggling Compression

The "AI Compression" toggle in the header allows switching between:
- **OFF** - Standard WebRTC encoding
- **ON** - AI-enhanced compression (when implemented)

### Analyzing Results

Metrics are saved to localStorage with the following naming convention:
```
webrtc-metrics-[role]-[with|without]-compression-[sessionId].json
```

The saved metrics can be analyzed to compare performance with and without compression.

## Sample Metrics Output

```json
{
  "timestamp": "2025-05-01T10:15:00Z",
  "sessionId": "1620567890-abc123",
  "role": "patient",
  "compression": false,
  "rtt_ms": 120,
  "jitter_ms": 15,
  "packets_lost": 3,
  "packets_received": 1250,
  "packets_sent": 1280,
  "fps": 27,
  "bitrate_kbps_inbound": 850,
  "bitrate_kbps_outbound": 920,
  "resolution_width": 1280,
  "resolution_height": 720,
  "codec": "video/VP8"
}
```

## Future Enhancements

1. Server-side storage of metrics for long-term analysis
2. Visualization of metrics over time using charts
3. Automatic quality adaptation based on metrics
4. Correlation of subjective quality ratings with objective metrics
5. Implementation of AI-based compression algorithms