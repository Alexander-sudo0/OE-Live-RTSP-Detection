"use client";

import { Navbar } from "@/components/_comps/navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BellRing } from "lucide-react";

export default function AlertsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-destructive-foreground" />
          <h1 className="text-2xl font-semibold">Triggered Alerts</h1>
        </div>

        <div className="rounded-2xl border bg-card/70 backdrop-blur-xl overflow-hidden animate-in fade-in duration-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground"
                >
                  No alerts yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </main>
    </>
  );
}
