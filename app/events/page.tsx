"use client";

import { Navbar } from "@/components/_comps/navbar";
import { EventsTable } from "@/components/_comps/events-table";

export default function EventsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <EventsTable />
      </main>
    </>
  );
}
