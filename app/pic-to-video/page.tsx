"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/_comps/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  startPicToVideo,
  getJob,
  MIZVA_URL,
} from "@/backend_integration/api_mizva";

type Match = {
  time: number;
  frame: number;
  bbox: number[];
  confidence: number;
  thumb_relpath: string;
};

export default function PicToVideoPage() {
  const [known, setKnown] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [threshold, setThreshold] = useState<number[]>([60]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const thrFloat = useMemo(() => threshold[0] / 100, [threshold]);

  const start = async () => {
    if (!known || !video) return;
    setBusy(true);
    try {
      const res = await startPicToVideo(known, video, thrFloat);
      setJobId(res.job_id);
      setProgress(1);
    } catch (e) {
      console.error(e);
      alert("Failed to start job");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const tick = async () => {
      try {
        const rec = await getJob(jobId);
        setProgress(Math.round((rec.progress || 0) * 100));
        if (rec.status === "done" && rec.result) {
          setMatches(rec.result.matches || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    tick();
    timer.current = setInterval(tick, 1500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [jobId]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Offline Pic to Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm">Known Face Image</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setKnown(e.target.files?.[0] || null)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Video File</label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideo(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm">
                Threshold: {Math.round(thrFloat * 100)}%
              </label>
              <Slider
                min={0}
                max={100}
                step={1}
                value={threshold}
                onValueChange={setThreshold}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={start} disabled={!known || !video || busy}>
                Start
              </Button>
              {jobId && (
                <span className="text-sm">
                  Job: {jobId} • Progress: {progress}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {matches.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Matches ({matches.length})</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {matches.map((m, i) => (
                <div key={i} className="space-y-2">
                  <img
                    src={`${MIZVA_URL}/data/${m.thumb_relpath}`}
                    alt="match"
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <div className="text-xs text-muted-foreground">
                    t={m.time}s • conf={(m.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
