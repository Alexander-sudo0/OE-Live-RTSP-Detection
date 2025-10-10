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
import { Info } from "lucide-react";
import { useMemo, useState } from "react";

export default function DetectionLogsPage() {
  const [q, setQ] = useState("");
  const [range, setRange] = useState<number[]>([60]);
  const [open, setOpen] = useState<{ open: boolean }>({ open: false });

  const rows: any[] = [];

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Detection Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-1.5">
                <label className="text-sm">Search (name or RTSP source)</label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} />
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
                    <TableHead>Name</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>RTSP Source</TableHead>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No detection logs yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={open.open} onOpenChange={(v) => setOpen({ open: v })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detection Details</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Select a row to view details.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
