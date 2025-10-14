"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIZVA_URL, listCameras } from "@/backend_integration/api_mizva";
import { useAlerts } from "@/contexts/AlertContext";
import {
  Search,
  Calendar,
  Filter,
  Eye,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState<
    "all" | "matched" | "unmatched"
  >("all");
  const { alerts } = useAlerts();

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
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{rows.length}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {rows.filter((r) => r.matched).length}
                </p>
                <p className="text-sm text-muted-foreground">Matches</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {rows.filter((r) => !r.matched).length}
                </p>
                <p className="text-sm text-muted-foreground">Unknown</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {cameras.length}
                </p>
                <p className="text-sm text-muted-foreground">Active Cameras</p>
              </div>
              <Camera className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Events Timeline
            </CardTitle>
            <Badge variant="secondary">{rows.length} events</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Camera</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
              >
                <option value="">All Cameras</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                value={matchFilter}
                onChange={(e) => setMatchFilter(e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All Events</option>
                <option value="matched">Matches Only</option>
                <option value="unmatched">Unknown Only</option>
              </select>
            </div>
          </div>

          {/* Events Grid */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {rows.length === 0 && !loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-6xl mb-4">📹</div>
                <h3 className="text-lg font-medium mb-2">
                  No events recorded yet
                </h3>
                <p className="text-sm">
                  Events will appear here when cameras detect faces
                </p>
              </div>
            ) : (
              rows
                .filter((row) => {
                  const matchesSearch =
                    searchQuery === "" ||
                    (row.person_name &&
                      row.person_name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())) ||
                    row.camera_id
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase());

                  const matchesDate =
                    dateFilter === "" ||
                    new Date(row.ts).toISOString().split("T")[0] === dateFilter;

                  const matchesType =
                    matchFilter === "all" ||
                    (matchFilter === "matched" && row.matched) ||
                    (matchFilter === "unmatched" && !row.matched);

                  return matchesSearch && matchesDate && matchesType;
                })
                .map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
                      r.matched
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30"
                        : "bg-card/50 hover:bg-card/70"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 relative">
                      {r.thumb_url ? (
                        <img
                          src={`${MIZVA_URL}${r.thumb_url}`}
                          className="h-20 w-20 rounded-lg object-cover border-2 border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          alt="Event thumbnail"
                          loading="lazy"
                          style={{ imageRendering: "crisp-edges" }}
                          onClick={() =>
                            window.open(`${MIZVA_URL}${r.thumb_url}`, "_blank")
                          }
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-lg border-2 border-border bg-muted flex items-center justify-center">
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* Match indicator */}
                      {r.matched ? (
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-background flex items-center justify-center">
                          <AlertTriangle className="h-2 w-2 text-white" />
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                          <CheckCircle className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {r.person_name || "Unknown Person"}
                            </span>
                            {r.matched ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Watchlist Match
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Detection
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(r.ts).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Camera className="h-3 w-3" />
                              {cameras.find((c) => c.id === r.camera_id)
                                ?.name || r.camera_id.slice(-8)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {(r.confidence * 100).toFixed(1)}% confidence
                            </Badge>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {r.thumb_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Download image"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = `${MIZVA_URL}${r.thumb_url}`;
                                link.download = `event-${r.id}.jpg`;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}

            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm">Loading events...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EventsTable;
