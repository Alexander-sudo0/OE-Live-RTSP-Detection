"use client";

import { Navbar } from "@/components/_comps/navbar";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Info,
  Search,
  Download,
  Filter,
  Calendar,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAlerts } from "@/contexts/AlertContext";
import { cn } from "@/lib/utils";
import { MIZVA_URL } from "@/backend_integration/api_mizva";

export default function DetectionLogsPage() {
  const { alerts } = useAlerts();
  const [q, setQ] = useState("");
  const [range, setRange] = useState<number[]>([60]);
  const [open, setOpen] = useState<{ open: boolean; alert?: any }>({
    open: false,
  });
  const [dateFilter, setDateFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState<
    "all" | "matches" | "non-matches"
  >("all");

  const filteredLogs = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        q === "" ||
        alert.person_name.toLowerCase().includes(q.toLowerCase()) ||
        alert.camera_name.toLowerCase().includes(q.toLowerCase());

      const matchesConfidence = alert.confidence >= range[0];

      const matchesDate =
        dateFilter === "" ||
        new Date(alert.timestamp).toISOString().split("T")[0] === dateFilter;

      const matchesType =
        matchFilter === "all" ||
        (matchFilter === "matches" && alert.is_match) ||
        (matchFilter === "non-matches" && !alert.is_match);

      return matchesSearch && matchesConfidence && matchesDate && matchesType;
    });
  }, [alerts, q, range, dateFilter, matchFilter]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const stats = useMemo(() => {
    const total = alerts.length;
    const matches = alerts.filter((a) => a.is_match).length;
    const today = alerts.filter(
      (a) => new Date(a.timestamp).toDateString() === new Date().toDateString()
    ).length;

    return { total, matches, today, nonMatches: total - matches };
  }, [alerts]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">
                    Total Detections
                  </p>
                </div>
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.matches}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Watchlist Matches
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.nonMatches}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Unknown Persons
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.today}
                  </p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Detection Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="grid gap-1.5">
                <label className="text-sm">Search (name or camera)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm">Date</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm">Type</label>
                <select
                  value={matchFilter}
                  onChange={(e) => setMatchFilter(e.target.value as any)}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">All Detections</option>
                  <option value="matches">Watchlist Matches</option>
                  <option value="non-matches">Unknown Persons</option>
                </select>
              </div>

              <div className="grid gap-1.5 md:col-span-2">
                <label className="text-sm flex items-center gap-2">
                  Confidence minimum
                  <Info className="h-4 w-4 text-muted-foreground" />
                </label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={range}
                    onValueChange={setRange}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-sm">{range[0]}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/70 backdrop-blur-xl overflow-hidden animate-in fade-in duration-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        {alerts.length === 0
                          ? "No detection logs yet."
                          : "No logs match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="hover:bg-secondary/50 transition-colors duration-200"
                      >
                        <TableCell>
                          <img
                            src={`${MIZVA_URL}/data/${log.thumb_relpath}`}
                            alt="Detection"
                            className="h-12 w-12 rounded-lg object-cover border cursor-pointer hover:scale-105 transition-transform duration-200"
                            onClick={() => setOpen({ open: true, alert: log })}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder-user.jpg";
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {log.person_name || "Unknown Person"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono",
                              log.confidence >= 90 &&
                                "border-green-500 text-green-700 dark:text-green-300",
                              log.confidence >= 75 &&
                                log.confidence < 90 &&
                                "border-yellow-500 text-yellow-700 dark:text-yellow-300",
                              log.confidence < 75 &&
                                "border-red-500 text-red-700 dark:text-red-300"
                            )}
                          >
                            {log.confidence}%
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            {formatTime(log.timestamp)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.camera_name}</div>
                            <div className="text-muted-foreground text-xs">
                              {log.camera_id.slice(-8)}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {log.is_match ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Match
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Detection
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpen({ open: true, alert: log })}
                            className="h-8 w-8 p-0"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Detail Dialog */}
      <Dialog open={open.open} onOpenChange={(v) => setOpen({ open: v })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detection Details</DialogTitle>
          </DialogHeader>
          {open.alert && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <img
                  src={`${MIZVA_URL}/data/${open.alert.thumb_relpath}`}
                  alt="Detection"
                  className="h-32 w-32 rounded-lg object-cover border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/placeholder-user.jpg";
                  }}
                />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {open.alert.person_name}
                    </h3>
                    <p className="text-muted-foreground">
                      {open.alert.is_match
                        ? "Watchlist Match"
                        : "Unknown Person"}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confidence:</span>
                      <Badge variant="outline">{open.alert.confidence}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Camera:</span>
                      <span>{open.alert.camera_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span>{formatTime(open.alert.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Severity:</span>
                      <Badge
                        variant={
                          open.alert.severity === "high"
                            ? "destructive"
                            : "secondary"
                        }
                        className={cn(
                          open.alert.severity === "medium" &&
                            "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                        )}
                      >
                        {open.alert.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Download logic here
                    const link = document.createElement("a");
                    link.href = `${MIZVA_URL}/data/${open.alert.thumb_relpath}`;
                    link.download = `detection-${open.alert.id}.jpg`;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
