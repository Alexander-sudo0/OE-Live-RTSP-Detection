"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MIZVA_URL, listCameras } from "@/backend_integration/api_mizva";

export type EventRow = {
  id: number;
  camera_id: string;
  ts: number;
  confidence: number;
  bbox: string;
  thumb_relpath?: string;
  thumb_url?: string;
  matched: number;
  person_id?: number;
  person_name?: string;
};

type Props = { cameraId?: string; limit?: number };

export function EventsTable(props: Props) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraId, setCameraId] = useState<string | "">("");
  const [cameras, setCameras] = useState<Array<{ id: string; name?: string }>>(
    []
  );

  useEffect(() => {
    // default from props or URL param
    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const initialCam = props.cameraId || sp?.get("camera_id") || "";
    setCameraId(initialCam);

    const fetchEvents = async (cam?: string) => {
      try {
        setLoading(true);
        const limit = props.limit ?? 200;
        const q =
          cam && cam.length > 0 ? `&camera_id=${encodeURIComponent(cam)}` : "";
        const res = await fetch(`${MIZVA_URL}/api/events?limit=${limit}${q}`);
        const j = await res.json();
        setRows(j.events || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const loadCameras = async () => {
      try {
        const data = await listCameras();
        if (Array.isArray(data?.cameras)) {
          setCameras(
            data.cameras.map((c: any) => ({ id: c.id, name: c.name }))
          );
        }
      } catch {}
    };
    loadCameras();
    fetchEvents(initialCam);
    const t = setInterval(() => fetchEvents(initialCam), 6000); // Reduced polling frequency
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchFiltered = async () => {
      try {
        setLoading(true);
        const limit = props.limit ?? 200;
        const q =
          cameraId && cameraId.length > 0
            ? `&camera_id=${encodeURIComponent(cameraId)}`
            : "";
        const res = await fetch(`${MIZVA_URL}/api/events?limit=${limit}${q}`);
        const j = await res.json();
        setRows(j.events || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFiltered();
  }, [cameraId, props.limit]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Events</CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-sm">Camera</label>
            <select
              className="border rounded-md h-9 px-2 bg-background"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
            >
              <option value="">All</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card/50 hover:bg-card/70 transition-colors"
            >
              {/* Large Thumbnail */}
              <div className="flex-shrink-0">
                {r.thumb_url ? (
                  <img
                    src={`${MIZVA_URL}${r.thumb_url}`}
                    className="h-20 w-20 rounded-lg object-cover border-2 border-border"
                    alt="Event thumbnail"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg border-2 border-border bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">
                      No Image
                    </span>
                  </div>
                )}
              </div>

              {/* Event Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {new Date(r.ts).toLocaleString()}
                      </span>
                      {r.matched ? (
                        <Badge className="bg-emerald-600">Matched</Badge>
                      ) : (
                        <Badge variant="secondary">Unmatched</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        📹{" "}
                        {cameras.find((c) => c.id === r.camera_id)?.name ||
                          r.camera_id}
                      </span>
                      <span>🎯 {(r.confidence * 100).toFixed(1)}%</span>
                      {r.person_name && (
                        <span className="font-medium text-foreground">
                          👤 {r.person_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">📹</div>
              <p>No events recorded yet</p>
              <p className="text-sm">
                Events will appear here when cameras detect activity
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground mt-3 text-center">
            Loading events...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EventsTable;
