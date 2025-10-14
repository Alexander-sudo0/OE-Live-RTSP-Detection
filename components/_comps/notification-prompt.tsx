"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BellRing, X } from "lucide-react";

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if we should show the notification prompt
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = Notification.permission;
      const dismissed = localStorage.getItem("notificationPromptDismissed");

      if (permission === "default" && !dismissed) {
        setShowPrompt(true);
      }
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Show a test notification
        new Notification("Face Recognition Alerts Enabled", {
          body: "You will now receive browser notifications for security alerts.",
          icon: "/placeholder-logo.png",
        });
      }
      setShowPrompt(false);
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      setShowPrompt(false);
    }
  };

  const dismissPrompt = () => {
    localStorage.setItem("notificationPromptDismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm bg-card border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <BellRing className="h-5 w-5 text-primary mt-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground mb-1">
            Enable Browser Notifications
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Get instant alerts when watchlist matches are detected, even when
            the tab is in the background.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={requestPermission}
              className="text-xs h-7 px-3"
            >
              Enable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissPrompt}
              className="text-xs h-7 px-3"
            >
              Maybe Later
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissPrompt}
          className="h-6 w-6 p-0 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
