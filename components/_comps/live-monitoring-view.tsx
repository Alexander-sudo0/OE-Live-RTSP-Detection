"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import {
  rtspStart,
  rtspStop,
  rtspStatus,
  connectRtspEvents,
  snapshotUrl,
  MIZVA_URL,
  listCameras,
  cleanupCameras,
  deleteCamera,
} from "@/backend_integration/api_mizva";
import { Play, Pause, Trash2 as Delete } from "lucide-react";
import { useAlerts } from "@/contexts/AlertContext";

type Cam = { id: string; url: string; name: string };

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  );
}

function CameraCard({
  cam,
  onRemove,
  onUpdate,
}: {
  cam: Cam;
  onRemove: (id: string) => void;
  onUpdate: () => void;
}) {
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [snapshotKey, setSnapshotKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { addAlert } = useAlerts();

  useEffect(() => {
    let es: EventSource | null = null;
    let mounted = true;

    // Initial status check and auto-start if needed
    const initializeCamera = async () => {
      try {
        const s = await rtspStatus(cam.id);
        if (mounted) {
          const isRunning = s.status === "running";
          setRunning(isRunning);
          setLastError(s.last_error || null);
          if (typeof s.last_confidence === "number") {
            setLastConfidence(Math.round(s.last_confidence * 100));
          }
          setInitialized(true);

          // Connect to events if running
          if (isRunning && !es) {
            es = connectRtspEvents(cam.id, (e) => {
              if (mounted) {
                setEvents((prev) => [e, ...prev].slice(0, 10));

                // Add alert for each event
                addAlert({
                  person_name: e.person_name || "Unknown Person",
                  confidence: Math.round((e.confidence || 0) * 100),
                  camera_id: cam.id,
                  camera_name: cam.name || `Camera ${cam.id.slice(-6)}`,
                  timestamp: new Date().toISOString(),
                  thumb_relpath: e.thumb_relpath || "",
                  is_match: e.is_match || false,
                });
              }
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setInitialized(true);
          setRunning(false);
        }
      }
    };

    // Start initialization
    initializeCamera();

    const t = setInterval(async () => {
      if (!mounted) return;
      try {
        const s = await rtspStatus(cam.id);
        const isRunning = s.status === "running";
        setRunning(isRunning);
        setLastError(s.last_error || null);
        if (typeof s.last_confidence === "number") {
          setLastConfidence(Math.round(s.last_confidence * 100));
        }

        // Manage event source connection
        if (isRunning && !es) {
          es = connectRtspEvents(cam.id, (e) => {
            if (mounted) {
              setEvents((prev) => [e, ...prev].slice(0, 10));

              // Add alert for each event
              addAlert({
                person_name: e.person_name || "Unknown Person",
                confidence: Math.round((e.confidence || 0) * 100),
                camera_id: cam.id,
                camera_name: cam.name || `Camera ${cam.id.slice(-6)}`,
                timestamp: new Date().toISOString(),
                thumb_relpath: e.thumb_relpath || "",
                is_match: e.is_match || false,
              });
            }
          });
        } else if (!isRunning && es) {
          es.close();
          es = null;
        }

        setTick((x) => x + 1);
      } catch (error) {
        // Camera might not exist anymore
        setRunning(false);
        setLastError("Camera not responding");
      }
    }, 3000); // Check more frequently for better responsiveness

    // Update snapshot every 2 seconds for running cameras
    const snapshotTimer = setInterval(() => {
      if (mounted && running) {
        setSnapshotKey((k) => k + 1);
      }
    }, 2000);

    return () => {
      mounted = false;
      if (es) {
        es.close();
      }
      clearInterval(t);
      clearInterval(snapshotTimer);
    };
  }, [cam.id]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await rtspStart({
        id: cam.id,
        url: cam.url,
        threshold: 0.6,
        fps: 3,
        transport: "tcp" as const,
        timeoutMs: 5000000,
        mode: "watchlist" as const,
        name: cam.name,
      });
      // Wait a moment then check status
      setTimeout(async () => {
        try {
          const s = await rtspStatus(cam.id);
          setRunning(s.status === "running");
          onUpdate();
        } catch {}
      }, 1000);
    } catch (e) {
      console.error("Failed to start camera:", e);
      alert(
        "Failed to start camera: " +
          (e instanceof Error ? e.message : "Unknown error")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await rtspStop(cam.id);
      setRunning(false);
      setEvents([]);
      onUpdate();
    } catch (e) {
      console.error("Failed to stop camera:", e);
      alert("Failed to stop camera");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete camera "${cam.name}"?`)) {
      return;
    }
    setActionLoading(true);
    try {
      // Use the proper delete API endpoint
      await deleteCamera(cam.id);
      onRemove(cam.id);
      onUpdate();
    } catch (e) {
      console.error("Failed to delete camera:", e);
      alert(
        "Failed to delete camera: " +
          (e instanceof Error ? e.message : "Unknown error")
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-700 rounded-2xl">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          {cam.name || `Camera ${cam.id.slice(-6)}`}
        </CardTitle>
        <div className="flex items-center gap-2">
          {running && <LiveBadge />}
          {!initialized && (
            <Badge variant="outline" className="text-xs">
              Loading...
            </Badge>
          )}
          <Link
            className="text-xs underline text-primary hover:opacity-80"
            href={`/events?camera_id=${encodeURIComponent(cam.id)}`}
            title="View events for this camera"
          >
            Events
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-video rounded-xl border bg-muted/10 overflow-hidden">
          {running ? (
            <img
              src={`${snapshotUrl(cam.id)}?t=${snapshotKey}`}
              alt={"Live snapshot"}
              className="h-full w-full object-cover transition-opacity duration-300"
              loading="lazy"
              style={{
                imageRendering: "crisp-edges",
                filter: "contrast(1.1) saturate(1.05)",
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.opacity = "1";
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Camera className="h-12 w-12 opacity-50 mx-auto mb-2" />
                <p className="text-sm">
                  {!initialized ? "Initializing..." : "Camera stopped"}
                </p>
              </div>
            </div>
          )}
          {running && (
            <div className="absolute right-2 bottom-2">
              <Badge variant="secondary" className="backdrop-blur bg-black/40">
                Confidence: {lastConfidence ?? "-"}%
              </Badge>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!running ? (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={actionLoading || !initialized}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              {actionLoading ? "Starting..." : "Start"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleStop}
              disabled={actionLoading}
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              {actionLoading ? "Stopping..." : "Pause"}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            <Delete className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Source:{" "}
          <span className="font-mono break-all">
            {cam.url || "No URL configured"}
          </span>
        </p>
        {lastError && <p className="text-xs text-red-500">{lastError}</p>}
        {events.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {events.map((e, i) => (
              <div key={i} className="relative group">
                <img
                  src={`${MIZVA_URL}/data/${e.thumb_relpath}`}
                  className="h-24 w-full object-cover rounded-md border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                  alt={`Detection ${i + 1}`}
                  loading="lazy"
                  style={{ imageRendering: "crisp-edges" }}
                  onClick={() =>
                    window.open(
                      `${MIZVA_URL}/data/${e.thumb_relpath}`,
                      "_blank"
                    )
                  }
                />
                {e.is_match && (
                  <div className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full border border-white shadow-sm"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveMonitoringView() {
  const [cams, setCams] = useState<Cam[]>([]);
  const [open, setOpen] = useState(false);
  const [rtsp, setRtsp] = useState("");
  const [name, setName] = useState("");
  const [known, setKnown] = useState<File | null>(null);
  const [threshold, setThreshold] = useState<number[]>([60]);
  const [fps, setFps] = useState<string>("3");
  const [transport, setTransport] = useState<"tcp" | "udp">("tcp");
  const [timeoutMs, setTimeoutMs] = useState<string>("5000000");
  const [busy, setBusy] = useState(false);
  const [useWatchlist, setUseWatchlist] = useState<boolean>(true);

  // Load persisted cameras on mount
  const loadCameras = async () => {
    try {
      console.log("Loading cameras...");
      const data = await listCameras();
      console.log("Camera data received:", data);
      if (Array.isArray(data?.cameras)) {
        const camerasWithProperNames = data.cameras
          .filter((c: any) => c.url && c.url.trim()) // Only include cameras with valid URLs
          .map((c: any) => ({
            id: c.id,
            url: c.url,
            name: c.name || `Camera ${c.id.slice(-6)}`,
          }));
        console.log("Processed cameras:", camerasWithProperNames);
        setCams(camerasWithProperNames);
      }
    } catch (e) {
      console.error("Failed to load cameras:", e);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const addCam = async () => {
    if (!rtsp.trim()) return;
    if (!useWatchlist && !known) return;
    setBusy(true);
    try {
      const id = `cam-${Date.now()}`;
      const cameraName = name.trim() || `Camera ${id.slice(-6)}`;

      // Start the camera immediately
      await rtspStart({
        id,
        url: rtsp.trim(),
        known: useWatchlist ? undefined : known!,
        threshold: threshold[0] / 100,
        fps: Number(fps) || 3,
        transport,
        timeoutMs: Number(timeoutMs) || 5000000,
        mode: useWatchlist ? "watchlist" : "single",
        name: cameraName,
      });

      // Add to local state immediately
      setCams((c) => [...c, { id, url: rtsp.trim(), name: cameraName }]);

      // Clear form
      setRtsp("");
      setName("");
      setKnown(null);
      setOpen(false);

      // Reload cameras to sync with backend
      setTimeout(() => {
        loadCameras();
      }, 1000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to start RTSP";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const removeCam = async (id: string) => {
    try {
      await rtspStop(id);
    } catch {}
    setCams((c) => c.filter((x) => x.id !== id));
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live Monitoring</h1>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Camera
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await cleanupCameras();
                // Reload cameras after cleanup
                await loadCameras();
              } catch (e) {
                console.error("Failed to cleanup cameras:", e);
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cams.length === 0 ? (
          <div className="text-sm text-muted-foreground">No cameras added.</div>
        ) : (
          cams.map((cam) => (
            <CameraCard
              key={cam.id}
              cam={cam}
              onRemove={removeCam}
              onUpdate={loadCameras}
            />
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add RTSP URL</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm">Camera Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gate-01"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">RTSP URL</label>
              <Input
                value={rtsp}
                onChange={(e) => setRtsp(e.target.value)}
                placeholder="rtsp://example/stream"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <input
                  id="useWatchlist"
                  type="checkbox"
                  checked={useWatchlist}
                  onChange={(e) => setUseWatchlist(e.target.checked)}
                />
                <label htmlFor="useWatchlist" className="text-sm">
                  Use Watchlist (no known image)
                </label>
              </div>
              {!useWatchlist && (
                <div className="grid gap-1.5">
                  <label className="text-sm">Known Face Image</label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setKnown(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Threshold: {threshold[0]}%</label>
              <Slider
                min={0}
                max={100}
                value={threshold}
                onValueChange={setThreshold}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Processing FPS</label>
              <Input
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                placeholder="3"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">RTSP Transport</label>
              <select
                className="border rounded-md h-9 px-2 bg-background"
                value={transport}
                onChange={(e) => setTransport(e.target.value as "tcp" | "udp")}
              >
                <option value="tcp">TCP (recommended)</option>
                <option value="udp">UDP</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">FFmpeg stimeout (microseconds)</label>
              <Input
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
                placeholder="5000000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={addCam}
              disabled={busy || !rtsp.trim() || (!useWatchlist && !known)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default LiveMonitoringView;
