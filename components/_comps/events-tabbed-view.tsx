"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { EventsTable } from "@/components/_comps/events-table";
import { useQuality } from "@/contexts/QualityContext";
import {
  Eye,
  CheckCircle,
  AlertTriangle,
  Camera,
  ImageIcon,
  Filter,
  Info,
  Sliders,
} from "lucide-react";
import { MIZVA_URL } from "@/backend_integration/api_mizva";
import {
  getHighQualityEvents,
  getLowQualityEvents,
  getFullImageUrl,
  type QualityEvent,
} from "@/backend_integration/api_quality";

export type EventRow = QualityEvent;

function FullImageModal({
  isOpen,
  onClose,
  eventId,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: number | null;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && eventId) {
      setLoading(true);
      setImageUrl(getFullImageUrl(eventId) + `?t=${Date.now()}`);
      setLoading(false);
    }
  }, [isOpen, eventId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Full Image with Detection</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          {loading ? (
            <div className="py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading image...</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Full detection image"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
              onError={() => setImageUrl(null)}
            />
          ) : (
            <div className="py-8 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Full image not available
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QualityEventsTable({
  isLowQuality = false,
  cameraId,
  limit,
}: {
  isLowQuality?: boolean;
  cameraId?: string;
  limit?: number;
}) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const { qualityThreshold } = useQuality();

  // Safe date formatting component to avoid hydration issues
  const SafeDateFormat = ({ timestamp }: { timestamp: number }) => {
    const [formattedDate, setFormattedDate] = useState<string>("...");

    useEffect(() => {
      setFormattedDate(new Date(timestamp).toLocaleString());
    }, [timestamp]);

    return <span>{formattedDate}</span>;
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const limitParam = limit ?? 200;

        const response = isLowQuality
          ? await getLowQualityEvents(limitParam, qualityThreshold, cameraId)
          : await getHighQualityEvents(limitParam, qualityThreshold, cameraId);

        setRows(response.events || []);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 6000); // Refresh every 6 seconds
    return () => clearInterval(interval);
  }, [isLowQuality, cameraId, limit, qualityThreshold]);

  return (
    <>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {rows.length === 0 && !loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-6xl mb-4">{isLowQuality ? "📷" : "📹"}</div>
            <h3 className="text-lg font-medium mb-2">
              {isLowQuality
                ? "No low-quality events"
                : "No high-quality events"}
            </h3>
            <p className="text-sm">
              {isLowQuality
                ? "Low-quality detections will appear here"
                : "High-quality detections will appear here"}
            </p>
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                r.matched
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30"
                  : "bg-card/50 hover:bg-card/70"
              }`}
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 relative">
                {r.thumb_url ? (
                  <img
                    src={`${MIZVA_URL}${r.thumb_url}`}
                    className="h-16 w-16 rounded-md object-cover border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    alt="Event thumbnail"
                    loading="lazy"
                    style={{ imageRendering: "crisp-edges" }}
                    onClick={() => setSelectedEventId(r.id)}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border border-border bg-muted flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {/* Quality indicator */}
                <div
                  className={`absolute -bottom-1 -right-1 px-1 py-0.5 text-xs rounded ${
                    isLowQuality
                      ? "bg-orange-500 text-white"
                      : "bg-green-500 text-white"
                  }`}
                >
                  Q: {r.quality_score?.toFixed(2) || "N/A"}
                </div>

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
                      {isLowQuality && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-orange-200 text-orange-700"
                        >
                          <Filter className="h-3 w-3" />
                          Low Quality
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <SafeDateFormat timestamp={r.ts} />
                      </span>
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {r.camera_name || `Camera ${r.camera_id.slice(-8)}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(r.confidence * 100).toFixed(1)}% confidence
                      </Badge>
                    </div>
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

      <FullImageModal
        isOpen={selectedEventId !== null}
        onClose={() => setSelectedEventId(null)}
        eventId={selectedEventId}
      />
    </>
  );
}

export function EventsTabbedView() {
  const [highQualityCount, setHighQualityCount] = useState(0);
  const [lowQualityCount, setLowQualityCount] = useState(0);
  const { qualityThreshold, updateQualityThreshold } = useQuality();

  // Fetch counts for badges
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [highData, lowData] = await Promise.all([
          getHighQualityEvents(1000, qualityThreshold),
          getLowQualityEvents(1000, qualityThreshold),
        ]);

        setHighQualityCount(highData.events?.length || 0);
        setLowQualityCount(lowData.events?.length || 0);
      } catch (e) {
        console.error("Failed to fetch event counts:", e);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 10000); // Update counts every 10 seconds
    return () => clearInterval(interval);
  }, [qualityThreshold]);

  return (
    <div className="space-y-4">
      {/* Statistics - Compact List Style */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">
                  {highQualityCount + lowQualityCount}
                </p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-green-600 leading-none">
                  {highQualityCount}
                </p>
                <p className="text-xs text-muted-foreground">High Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-orange-600 leading-none">
                  {lowQualityCount}
                </p>
                <p className="text-xs text-muted-foreground">Low Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-blue-600 leading-none">
                  {qualityThreshold.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Threshold</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Threshold Control - Compact */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                <span className="font-medium text-sm">Quality Threshold</span>
              </div>
              <span className="text-sm font-mono font-bold">
                {qualityThreshold.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <Slider
                id="quality-threshold"
                min={0}
                max={1}
                step={0.01}
                value={[qualityThreshold]}
                onValueChange={(value) => updateQualityThreshold(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Strict (0.00)</span>
                <span>Lenient (1.00)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Events by Quality
            </CardTitle>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Threshold: {qualityThreshold.toFixed(2)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="high-quality" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="high-quality" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                High Quality
                <Badge variant="secondary">{highQualityCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="low-quality" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Low Quality Logs
                <Badge variant="secondary">{lowQualityCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="high-quality" className="mt-4">
              <QualityEventsTable isLowQuality={false} />
            </TabsContent>

            <TabsContent value="low-quality" className="mt-4">
              <QualityEventsTable isLowQuality={true} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default EventsTabbedView;
