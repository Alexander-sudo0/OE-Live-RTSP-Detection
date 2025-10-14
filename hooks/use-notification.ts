import { useState, useEffect } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted' || !isSupported) {
      return null;
    }

    try {
      return new Notification(title, {
        icon: '/placeholder-logo.png',
        badge: '/placeholder-logo.png',
        ...options,
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    canShowNotifications: permission === 'granted' && isSupported,
  };
}