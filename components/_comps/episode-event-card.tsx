"use client"

import Image from "next/image"
import { BadgeCheck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  title?: string
  matched: boolean
  imageUrl?: string
  count?: number
}

export function EpisodeEventCard({ title = "Acknowledged", matched, imageUrl, count = 1 }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm transition hover:shadow-md">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="text-foreground/80">{title}</span>
        <span className="rounded bg-background/40 px-1.5 text-foreground/70">#{count}</span>
      </div>

      <div className="aspect-video overflow-hidden rounded-lg border border-border/50 bg-muted/20">
        {imageUrl ? (
          <Image
            src={imageUrl || "/placeholder.svg?height=270&width=480&query=detected face"}
            alt="Detected face"
            width={480}
            height={270}
            className="h-full w-full object-cover"
          />
        ) : (
          <img src="/detected-face-placeholder.jpg" alt="" className="h-full w-full object-cover opacity-70" />
        )}
      </div>

      <div
        className={cn(
          "mt-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs",
          matched
            ? "bg-emerald-600/15 text-emerald-400 ring-1 ring-emerald-400/20"
            : "bg-amber-600/15 text-amber-400 ring-1 ring-amber-400/20",
        )}
      >
        {matched ? <BadgeCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
        <span>{matched ? "Matched" : "Unmatched"}</span>
      </div>
    </div>
  )
}
