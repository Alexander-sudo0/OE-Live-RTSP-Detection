"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { alertSound } from "@/lib/alert-sound";

export interface AlertEvent {
  id: string;
  person_name: string;
  confidence: number;
  camera_id: string;
  camera_name: string;
  timestamp: string;
  thumb_relpath: string;
  is_match: boolean;
  status: "new" | "acknowledged" | "dismissed";
  severity: "low" | "medium" | "high";
}

interface AlertContextType {
  alerts: AlertEvent[];
  unreadCount: number;
  isRinging: boolean;
  isMuted: boolean;
  addAlert: (alert: Omit<AlertEvent, "id" | "status" | "severity">) => void;
  acknowledgeAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
  markAllAsRead: () => void;
  muteRing: () => void;
  unmuteRing: () => void;
  clearAllAlerts: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlerts must be used within an AlertProvider");
  }
  return context;
};

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [isRinging, setIsRinging] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alertsMuted") === "true";
    }
    return false;
  });
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio
  useEffect(() => {
    // Audio will be handled by alertSound utility
  }, []);

  // Load alerts from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAlerts = localStorage.getItem("faceRecognitionAlerts");
      if (savedAlerts) {
        try {
          setAlerts(JSON.parse(savedAlerts));
        } catch (error) {
          console.error("Failed to load alerts from storage:", error);
        }
      }
    }
  }, []);

  // Save alerts to localStorage whenever alerts change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("faceRecognitionAlerts", JSON.stringify(alerts));
    }
  }, [alerts]);

  // Save mute state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("alertsMuted", isMuted.toString());
    }
  }, [isMuted]);

  const unreadCount = alerts.filter((alert) => alert.status === "new").length;

  const startRinging = async () => {
    if (isMuted || isRinging) return;

    setIsRinging(true);

    // Start playing alert sound in a loop
    await alertSound.playAlertSequence();

    // Continue playing every 2 seconds
    ringIntervalRef.current = setInterval(async () => {
      await alertSound.playAlertSequence();
    }, 2000);

    // Auto-stop ringing after 30 seconds
    ringTimeoutRef.current = setTimeout(() => {
      stopRinging();
    }, 30000);
  };

  const stopRinging = () => {
    setIsRinging(false);

    // Clear intervals and timeouts
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  const getSeverity = (confidence: number): "low" | "medium" | "high" => {
    if (confidence >= 90) return "high";
    if (confidence >= 75) return "medium";
    return "low";
  };

  const addAlert = (
    alertData: Omit<AlertEvent, "id" | "status" | "severity">
  ) => {
    const newAlert: AlertEvent = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "new",
      severity: getSeverity(alertData.confidence),
    };

    setAlerts((prev) => [newAlert, ...prev]);

    // Show browser notification for high severity matches
    if (
      newAlert.is_match &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(`⚠️ Watchlist Match Detected`, {
          body: `${newAlert.person_name} detected at ${newAlert.camera_name} (${newAlert.confidence}% confidence)`,
          icon: "/placeholder-logo.png",
          tag: "face-match",
          requireInteraction: true,
        });
      } catch (error) {
        console.error("Failed to show notification:", error);
      }
    }

    // Start ringing for high severity matches
    if (newAlert.is_match && newAlert.severity === "high") {
      startRinging();
    }
  };

  const acknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status: "acknowledged" as const } : alert
      )
    );

    // Stop ringing when alert is acknowledged
    if (isRinging) {
      stopRinging();
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, status: "dismissed" as const } : alert
      )
    );
  };

  const markAllAsRead = () => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.status === "new"
          ? { ...alert, status: "acknowledged" as const }
          : alert
      )
    );

    if (isRinging) {
      stopRinging();
    }
  };

  const muteRing = () => {
    setIsMuted(true);
    if (isRinging) {
      stopRinging();
    }
  };

  const unmuteRing = () => {
    setIsMuted(false);
  };

  const clearAllAlerts = () => {
    setAlerts([]);
    if (isRinging) {
      stopRinging();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
      }
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
      }
    };
  }, []);

  const value: AlertContextType = {
    alerts,
    unreadCount,
    isRinging,
    isMuted,
    addAlert,
    acknowledgeAlert,
    dismissAlert,
    markAllAsRead,
    muteRing,
    unmuteRing,
    clearAllAlerts,
  };

  return (
    <AlertContext.Provider value={value}>{children}</AlertContext.Provider>
  );
};
