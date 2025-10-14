import { useEffect, useRef } from 'react';
import { useAlerts } from '@/contexts/AlertContext';
import { connectRtspEvents } from '@/backend_integration/api_mizva';

interface UseEventStreamOptions {
  cameraId: string;
  cameraName: string;
  enabled?: boolean;
}

export function useEventStream({ cameraId, cameraName, enabled = true }: UseEventStreamOptions) {
  const { addAlert } = useAlerts();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !cameraId) return;

    let mounted = true;

    const connectToEvents = () => {
      try {
        eventSourceRef.current = connectRtspEvents(cameraId, (event) => {
          if (!mounted) return;

          // Create alert from event
          addAlert({
            person_name: event.person_name || 'Unknown Person',
            confidence: Math.round((event.confidence || 0) * 100),
            camera_id: cameraId,
            camera_name: cameraName,
            timestamp: new Date().toISOString(),
            thumb_relpath: event.thumb_relpath || '',
            is_match: event.is_match || false,
          });
        });
      } catch (error) {
        console.error('Failed to connect to event stream:', error);
      }
    };

    connectToEvents();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [cameraId, cameraName, enabled, addAlert]);

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  return { disconnect };
}