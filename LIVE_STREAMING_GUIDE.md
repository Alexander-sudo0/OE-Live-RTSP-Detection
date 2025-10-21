# Live Video Streaming Feature

## Overview

The live monitoring system now supports high-quality live video streaming at 20-30 FPS, allowing you to view real-time camera feeds alongside the existing face detection capabilities.

## Features

### Dual View Modes

1. **Snapshot Mode** (Default)

   - Shows processed frames with face detection overlays
   - Updates every 2-3 seconds based on processing FPS
   - Displays confidence scores and detection boxes
   - Lower bandwidth usage

2. **Live Mode** (New)
   - High-quality real-time video stream at 25 FPS
   - Smooth video playback with minimal latency
   - Live face detection overlays
   - Higher bandwidth usage but better user experience

### Live Streaming Controls

- **Play/Pause**: Start or stop the live video feed
- **Fullscreen**: Expand to fullscreen mode for better viewing
- **FPS Counter**: Real-time frame rate display
- **Live Indicator**: Shows when the stream is active

## How to Use

### Setting Up a Camera

1. Go to **Live Monitoring** page
2. Click **"Add Camera"**
3. Configure:
   - **Camera Name**: Give it a descriptive name
   - **RTSP/HTTP URL**: Your camera stream URL
   - **Processing FPS**: Set to 3-5 for face recognition (lower = less CPU/GPU usage)
   - **Transport**: Use TCP for stability, UDP for lower latency

### Viewing Live Stream

1. **Start Camera**: Click the "Start" button on any camera card
2. **Switch to Live Mode**: Click the "Live" button in the top-right of the camera card
3. **Play Stream**: Click the play button to start live streaming
4. **Fullscreen**: Use the fullscreen button for immersive viewing

### Supported URL Formats

#### RTSP Streams

```
rtsp://username:password@ip:port/stream
rtsp://192.168.1.100:554/live/main
rtsp://admin:password@camera.local/stream1
```

#### HTTP/MJPEG Streams

```
http://192.168.1.100:8080/video
http://username:password@ip:port/mjpeg
```

## Performance Considerations

### Frame Rates

- **Live Streaming**: 25 FPS (automatic)
- **Face Recognition**: 3-5 FPS (configurable)
- The system processes faces at a lower rate to save GPU/CPU while streaming at full quality

### Bandwidth Usage

- **Live Mode**: ~2-5 Mbps per camera (depending on resolution)
- **Snapshot Mode**: ~50-100 KB per update

### GPU Acceleration

The system uses GPU acceleration for:

- Face detection and recognition
- Video decoding (when supported)
- Image processing and compression

## Troubleshooting

### Stream Not Loading

1. Check camera URL is accessible
2. Verify network connectivity
3. Try switching between TCP/UDP transport
4. Check camera authentication credentials

### Low Frame Rate

1. Reduce number of concurrent streams
2. Lower camera resolution if possible
3. Check network bandwidth
4. Ensure GPU acceleration is working

### High CPU/GPU Usage

1. Reduce processing FPS (face recognition rate)
2. Limit number of active cameras
3. Use TCP transport for better stability
4. Consider reducing stream resolution

## Technical Details

### Streaming Protocol

- Uses MJPEG over HTTP for live streaming
- Boundary-based frame separation
- Automatic frame rate control
- Error recovery and reconnection

### Face Detection Integration

- Real-time overlay of detection results
- Confidence scores displayed on faces
- Person identification (when using watchlist)
- Event generation for alerts

### Browser Compatibility

- Works on all modern browsers
- Hardware acceleration when available
- Responsive design for mobile devices
- Fullscreen support

## Examples

### Basic RTSP Camera

```
Name: Front Door
URL: rtsp://admin:password@192.168.1.10:554/live
Processing FPS: 3
Transport: TCP
```

### IP Camera with Authentication

```
Name: Office Camera
URL: rtsp://user:pass@office-cam.local/stream
Processing FPS: 5
Transport: TCP
Threshold: 70%
```

### Public Test Stream

```
Name: Test Stream
URL: rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4
Processing FPS: 3
Transport: TCP
```

For additional support or feature requests, please refer to the project documentation.
