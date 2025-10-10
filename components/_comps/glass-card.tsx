import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function GlassCard({
  title,
  description,
  icon,
  className,
  children,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border bg-card/70 backdrop-blur-xl transition hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20",
        "animate-in fade-in slide-in-from-bottom-2 duration-700",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-balance">
          {icon} {title}
        </CardTitle>
        {description ? <CardDescription className="text-pretty">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
