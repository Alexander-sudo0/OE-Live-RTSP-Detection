"use client";

import { Navbar } from "@/components/_comps/navbar";
import { WatchlistTable } from "@/components/_comps/watchlist-table";

export default function WatchlistPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <WatchlistTable />
      </main>
    </>
  );
}
