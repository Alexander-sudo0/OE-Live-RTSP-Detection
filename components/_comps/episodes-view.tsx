"use client"

import { useState } from "react"
import { EpisodeEventCard } from "./episode-event-card"
import { cn } from "@/lib/utils"

type EpisodesViewProps = { mode: "episodes" | "events" }

const TABS = ["Episodes", "Events", "Individuals"] as const

export function EpisodesView({ mode }: EpisodesViewProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(mode === "events" ? "Events" : "Episodes")

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{activeTab}</h1>
        <p className="text-sm text-muted-foreground">
          Frames from live RTSP streams are compared with Watchlist images. Review matched and unmatched results.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-border/60 bg-card/60 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                activeTab === t ? "bg-primary text-primary-foreground" : "text-foreground/80",
              )}
              aria-pressed={activeTab === t}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill label="Matches: faces" />
          <FilterPill label="Matches: bodies" />
          <FilterPill label="Acknowledged" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <EpisodeEventCard key={i} matched={i % 3 !== 0} count={(i % 4) + 1} />
        ))}
      </div>
    </div>
  )
}

function FilterPill({ label }: { label: string }) {
  return (
    <button
      className="rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-muted/40"
      aria-pressed="false"
    >
      {label}
    </button>
  )
}
