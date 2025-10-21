"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { streamUrl, snapshotUrl } from "@/backend_integration/api_mizva";

interface LiveVideoStreamProps {
  camId: string;
  camName: string;
  isRunning: boolean;
  className?: string;
  showControls?: boolean;
  onFpsChange?: (fps: number) => void;
}

export function LiveVideoStream({
  camId,
  camName,
  isRunning,
  className = "",
  showControls = true,
  onFpsChange,
}: LiveVideoStreamProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [fpsCounter, setFpsCounter] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef({ count: 0, lastTime: Date.now() });
  const intervalRef = useRef<number>(33); // Start with 30 FPS target

  // Auto-play when camera is running
  useEffect(() => {
    if (isRunning) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isRunning]);

  // Start/stop streaming
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (isRunning && isPlaying) {
      cleanup = startStream();
    } else {
      stopStream();
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isRunning, isPlaying, camId]);

  // FPS counter - more frequent updates for better accuracy
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - fpsRef.current.lastTime;
      if (elapsed >= 1000) {
        const fps = Math.round((fpsRef.current.count * 1000) / elapsed);
        setFpsCounter(fps);
        onFpsChange?.(fps);
        fpsRef.current.count = 0;
        fpsRef.current.lastTime = now;
      }
    }, 200); // Update every 200ms for more responsive display

    return () => clearInterval(interval);
  }, [onFpsChange]);

  const startStream = () => {
    if (!imgRef.current || !isRunning) return undefined;

    const img = imgRef.current;
    setStreamError(null);

    let isRefreshing = false;
    let intervalId: NodeJS.Timeout;
    let loadStartTime = 0;

    // Create a mechanism to refresh the snapshot to simulate streaming
    const refreshFrame = () => {
      if (!isPlaying || !isRunning || !imgRef.current || isRefreshing) return;

      isRefreshing = true;
      loadStartTime = Date.now();
      fpsRef.current.count++;

      // Create a new image element for preloading to avoid blocking
      const newImg = new Image();
      newImg.crossOrigin = "anonymous";

      newImg.onload = () => {
        if (imgRef.current && isPlaying && isRunning) {
          imgRef.current.src = newImg.src;
          setStreamError(null);

          // Adaptive timing: adjust interval based on load time
          const loadTime = Date.now() - loadStartTime;
          if (loadTime > 100) {
            // If loading takes more than 100ms, slow down
            intervalRef.current = Math.min(intervalRef.current + 10, 100);
          } else if (loadTime < 30) {
            // If loading is fast, speed up slightly
            intervalRef.current = Math.max(intervalRef.current - 5, 25);
          }
        }
        isRefreshing = false;
      };

      newImg.onerror = () => {
        // Don't show error immediately - might just be server busy
        // Only show error after multiple failures
        isRefreshing = false;

        // Slow down on errors
        intervalRef.current = Math.min(intervalRef.current + 20, 200);
      };

      // Use snapshot URL with timestamp and random to force refresh and get new frame
      newImg.src = `${snapshotUrl(camId)}?t=${Date.now()}&r=${Math.random()}`;
    };

    // Use dynamic interval that adapts to actual performance
    const scheduleNextFrame = () => {
      intervalId = setTimeout(() => {
        if (isPlaying && isRunning) {
          refreshFrame();
          scheduleNextFrame();
        }
      }, intervalRef.current);
    };

    scheduleNextFrame();

    // Start the first frame immediately
    refreshFrame();

    // Cleanup function
    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
      isRefreshing = false;
    };
  };

  const stopStream = () => {
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    setStreamError(null);
    setFpsCounter(0);
    fpsRef.current.count = 0;
    onFpsChange?.(0);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <Card className={`overflow-hidden ${className}`} ref={containerRef}>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          {camName}
        </CardTitle>
        <div className="flex items-center gap-2">
          {isPlaying && isRunning && (
            <>
              <Badge variant="outline" className="text-xs">
                {fpsCounter} FPS
              </Badge>
              <Badge variant="default" className="text-xs">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1" />
                Live
              </Badge>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className={`relative ${
            isFullscreen ? "h-screen" : "aspect-video"
          } bg-black overflow-hidden`}
        >
          {isRunning && isPlaying ? (
            <>
              <img
                ref={imgRef}
                alt={`Live stream from ${camName}`}
                className="w-full h-full object-contain"
                style={{
                  imageRendering: "auto",
                  filter: "contrast(1.05) saturate(1.1)",
                }}
              />

              {/* Overlay controls */}
              {showControls && (
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="backdrop-blur bg-black/40 border-0 hover:bg-black/60"
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="backdrop-blur bg-black/40 border-0 hover:bg-black/60"
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Error overlay */}
              {streamError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white">
                    <Camera className="h-12 w-12 opacity-50 mx-auto mb-2" />
                    <p className="text-sm">{streamError}</p>
                    <p className="text-xs text-gray-400 mt-1">Retrying...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground bg-muted/10">
              <div className="text-center">
                <Camera className="h-12 w-12 opacity-50 mx-auto mb-2" />
                <p className="text-sm mb-2">
                  {!isRunning ? "Camera stopped" : "Stream paused"}
                </p>
                {isRunning && !isPlaying && showControls && (
                  <Button size="sm" onClick={togglePlay}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Live Stream
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LiveVideoStream;
