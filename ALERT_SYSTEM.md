# OE Face Management System - Alert System

## Overview

The enhanced face recognition system now includes a comprehensive real-time alert system with the following features:

## Features

### 🔔 Bell Notification System

- **Real-time alerts** for face detection events
- **Visual notification badge** with unread count
- **Ring sound alerts** for high-priority matches
- **Mute/unmute functionality** for sound alerts
- **Dropdown panel** with recent alerts preview

### 🚨 Alert Management

- **Three severity levels**: High, Medium, Low (based on confidence)
- **Alert status tracking**: New, Acknowledged, Dismissed
- **Persistent storage** in browser localStorage
- **Auto-categorization** of watchlist matches vs unknown persons

### 📊 Enhanced Monitoring

- **Live monitoring** with real-time event streaming
- **Detection logs** with comprehensive filtering
- **Event timeline** with detailed statistics
- **Alert center** with advanced filtering and search

### 🎵 Audio Alerts

- **Web Audio API** based sound generation
- **Configurable ring patterns** for different alert types
- **Auto-stop** after 30 seconds
- **Persistent mute settings**

## Components

### AlertContext (`/contexts/AlertContext.tsx`)

Global state management for alerts with the following features:

- Alert creation and management
- Sound control (mute/unmute)
- Persistent storage
- Real-time updates

### BellNotification (`/components/_comps/bell-notification.tsx`)

Navigation bar component featuring:

- Animated bell icon with notification badge
- Dropdown with recent alerts
- Quick actions (acknowledge, dismiss, mute)
- Ring status indicator

### Enhanced Pages

1. **Alerts Page** (`/app/alerts/page.tsx`)

   - Complete alert management interface
   - Advanced filtering and search
   - Bulk operations (mark all read, clear all)

2. **Detection Logs** (`/app/detection-logs/page.tsx`)

   - Comprehensive logging with statistics
   - Date-based filtering
   - Export functionality

3. **Live Monitoring** (`/app/live-monitoring/page.tsx`)
   - Real-time alert generation
   - Automatic event forwarding to alert system

## Alert Workflow

1. **Detection**: Camera detects a face
2. **Analysis**: System determines if it's a watchlist match
3. **Alert Creation**: Alert is created with appropriate severity
4. **Notification**:
   - Visual: Bell icon shows badge
   - Audio: Ring sound for high-priority alerts
   - Storage: Alert saved to localStorage
5. **Management**: Admin can acknowledge, dismiss, or clear alerts

## Severity Levels

- **High** (90%+ confidence): Red alerts with ring sound
- **Medium** (75-89% confidence): Yellow alerts with notification
- **Low** (<75% confidence): Blue alerts with notification

## Alert Types

- **Watchlist Match**: Person found in watchlist (⚠️ icon)
- **Unknown Person**: Person not in watchlist (✅ icon)

## Configuration

### Sound Settings

- Default volume: 30% of system volume
- Ring duration: 30 seconds maximum
- Ring pattern: 800Hz + 1200Hz alternating beeps
- Mute setting: Persisted in localStorage

### Storage

- Alerts: Stored in localStorage as 'faceRecognitionAlerts'
- Mute setting: Stored as 'alertsMuted'
- Auto-cleanup: No automatic cleanup (admin managed)

## Installation Notes

1. **Audio File**: The system uses Web Audio API by default. For custom sounds, place audio files in `/public/sounds/`
2. **Permissions**: Browser may require user interaction before playing audio
3. **Performance**: Alerts are stored locally; consider implementing server-side storage for production

## Usage

### For Administrators

1. **Monitor**: Check the bell icon for new alerts
2. **Review**: Click bell to see recent alerts
3. **Manage**: Acknowledge or dismiss alerts as needed
4. **Control**: Use mute button to control sound alerts

### For System Integration

1. **Event Creation**: Alerts are automatically created from camera events
2. **Custom Alerts**: Use `addAlert()` from AlertContext to create custom alerts
3. **Status Updates**: Monitor alert status changes for reporting

## API Integration

The system integrates with the Mizva backend through:

- `connectRtspEvents()`: Real-time event streaming
- Event data includes: person_name, confidence, camera info, thumbnails
- Automatic alert creation based on detection results

## Troubleshooting

### Audio Issues

- Ensure browser allows audio playback
- Check system volume settings
- Verify Web Audio API support

### Alert Not Showing

- Check console for JavaScript errors
- Verify AlertProvider is wrapping the app
- Check localStorage for stored alerts

### Performance Issues

- Large number of stored alerts may slow down interface
- Use "Clear All" button to reset alert storage
- Consider implementing pagination for production use

## Future Enhancements

1. **Server Integration**: Move alerts to database storage
2. **Push Notifications**: Browser push notifications for alerts
3. **Email/SMS**: External notification channels
4. **Analytics**: Alert pattern analysis and reporting
5. **Custom Sounds**: Admin-configurable alert sounds
6. **Integration**: Webhook support for external systems
