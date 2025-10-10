"use client"

import { Navbar } from "@/components/_comps/navbar"
import { EpisodesView } from "@/components/_comps/episodes-view"

export default function EpisodesPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <EpisodesView mode="episodes" />
      </main>
    </>
  )
}
