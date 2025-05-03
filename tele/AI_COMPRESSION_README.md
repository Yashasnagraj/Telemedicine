# AI-Based Video Compression for Tele-Mine

This document describes the implementation of AI-based video compression in the Tele-Mine telemedicine platform. The compression system is designed to reduce bandwidth usage and latency during WebRTC video calls, improving the user experience especially in low-bandwidth environments.

## Overview

The AI-based video compression system consists of:

1. **VideoCompressor** - A utility class that applies AI-based compression to video streams
2. **CompressionStats** - A React component that displays real-time compression statistics

## Features

The compression system provides the following features:

- **AI-Based Compression** - Uses machine learning to compress video with minimal quality loss
- **Adaptive Compression** - Automatically adjusts compression level based on network conditions
- **Real-Time Processing** - Processes video frames in real-time with low latency
- **Seamless WebRTC Integration** - Works with WebRTC's peer-to-peer connection
- **Compression Statistics** - Provides real-time feedback on compression performance

## Implementation Details

### VideoCompressor

The `VideoCompressor` class is responsible for:

- Initializing and loading the AI compression model
- Processing video frames from the WebRTC stream
- Applying adaptive compression based on network conditions
- Generating a new compressed MediaStream
- Tracking compression statistics

### Compression Algorithm

The compression algorithm works as follows:

1. **Preprocessing** - Resize and normalize video frames for the AI model
2. **AI Model Processing** - Apply the AI model to compress the frame
3. **Adaptive Adjustment** - Adjust compression level based on network conditions
4. **Stream Generation** - Create a new MediaStream with compressed video

### Adaptive Compression

The system monitors network conditions using WebRTC metrics and adjusts compression accordingly:

- **High Latency (>300ms)** - Increase compression to reduce bandwidth
- **Packet Loss (>5%)** - Increase compression to improve reliability
- **Low Bandwidth (<200kbps)** - Increase compression to maintain connection
- **Good Conditions** - Decrease compression to improve quality

### Compression Levels

The system supports multiple compression levels:

1. **High Quality** - CRF 18, 720p, 30fps
2. **Medium Quality** - CRF 23, 360p, 25fps
3. **Low Quality** - CRF 28, 270p, 20fps
4. **Very Low Quality** - CRF 32, 180p, 15fps

## Integration with WebRTC

The compression system integrates with WebRTC as follows:

1. When compression is enabled, the original video track is replaced with the compressed track
2. The compressed track is sent to the remote peer via the RTCPeerConnection
3. When compression is disabled, the original track is restored

## Usage

### Enabling Compression

Compression can be enabled/disabled using the "AI Compression" toggle in the consultation room. When enabled, the system will:

1. Initialize the AI compression model (if not already loaded)
2. Process the video stream with the AI model
3. Replace the original video track with the compressed track
4. Display compression statistics

### Compression Statistics

The compression statistics panel shows:

- **Compression Level** - Current compression level (high, medium, low, very-low)
- **Compression Ratio** - How much the video is compressed (e.g., 3.5x)
- **Quality** - Estimated video quality after compression
- **Processing Time** - Time taken to compress each frame
- **Resolution** - Current video resolution
- **Frame Rate** - Current frame rate
- **Data Saved** - Percentage of bandwidth saved

## Performance Considerations

The AI-based compression system is designed to balance between compression efficiency and processing overhead:

- The AI model is optimized for real-time processing
- Compression is adapted based on device capabilities
- Processing is done on a separate thread to avoid UI blocking
- Canvas-based processing minimizes memory usage

## Future Enhancements

1. **Model Optimization** - Further optimize the AI model for mobile devices
2. **Quality Metrics** - Implement PSNR/SSIM quality metrics for objective quality assessment
3. **Advanced Adaptation** - Implement more sophisticated adaptation algorithms
4. **Hardware Acceleration** - Utilize WebGL for faster processing
5. **Codec Integration** - Integrate with advanced codecs like AV1 or VVC

## Technical Requirements

- Modern browser with WebRTC support
- WebGL support for TensorFlow.js acceleration
- Sufficient CPU/GPU for real-time processing

## Implementation Notes

In the current implementation, we use a simulated AI model for demonstration purposes. In a production environment, you would:

1. Train a specialized neural network for video compression
2. Convert it to TensorFlow.js format
3. Load it in the browser using tf.loadGraphModel()
4. Apply it to each video frame

The actual compression would use techniques like:
- Learned transform coding
- Neural network-based prediction
- Perceptual optimization
- Temporal redundancy reduction