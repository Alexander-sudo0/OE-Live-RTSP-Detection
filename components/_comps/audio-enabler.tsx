"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { alertSound } from "@/lib/alert-sound";

export function AudioEnabler() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const checkAudioContext = () => {
      if (typeof window !== "undefined" && alertSound) {
        // Check if audio context exists and is suspended
        const context = (alertSound as any).audioContext;
        if (context && context.state === "suspended") {
          setShowPrompt(true);
          setAudioEnabled(false);
        } else if (context && context.state === "running") {
          setAudioEnabled(true);
          setShowPrompt(false);
        }
      }
    };

    checkAudioContext();

    // Check periodically
    const interval = setInterval(checkAudioContext, 1000);

    return () => clearInterval(interval);
  }, []);

  const enableAudio = async () => {
    try {
      const context = (alertSound as any).audioContext;
      if (context && context.state === "suspended") {
        await context.resume();
        setAudioEnabled(true);
        setShowPrompt(false);

        // Play a test sound
        await alertSound.playBeep(800, 100);
      }
    } catch (error) {
      console.error("Failed to enable audio:", error);
    }
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-3 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3">
        <VolumeX className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">Enable Audio Alerts</p>
          <p className="text-xs text-muted-foreground">
            Click to enable sound notifications
          </p>
        </div>
        <Button size="sm" onClick={enableAudio}>
          <Volume2 className="h-4 w-4 mr-2" />
          Enable
        </Button>
      </div>
    </div>
  );
}
