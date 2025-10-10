"use client"

import { Navbar } from "@/components/_comps/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ListTree, MonitorIcon as MonitorCog, Users, Shield, ListChecks, Group, List, UserRound } from "lucide-react"
import { useState } from "react"

const sections = [
  { key: "General", icon: MonitorCog },
  { key: "Interface", icon: ListTree },
  { key: "Roles", icon: Shield },
  { key: "Users", icon: Users },
  { key: "Sessions", icon: UserRound },
  { key: "Blocklist Records", icon: List },
  { key: "Camera Groups", icon: Group },
  { key: "Watch Lists", icon: ListChecks },
] as const
type SectionKey = (typeof sections)[number]["key"]

export default function SettingsPage() {
  const [active, setActive] = useState<SectionKey>("General")
  const [threshold, setThreshold] = useState<number[]>([68])
  const [interval, setIntervalV] = useState(5)
  const [jpeg, setJpeg] = useState(75)
  const [cleanup, setCleanup] = useState(true)
  const [hours, setHours] = useState(720)

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border bg-card/70 backdrop-blur-xl p-3 h-fit sticky top-20">
            <ul className="space-y-1">
              {sections.map(({ key, icon: Icon }) => (
                <li key={key}>
                  <button
                    className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                      active === key ? "bg-secondary text-secondary-foreground" : "hover:bg-secondary/60"
                    }`}
                    onClick={() => setActive(key)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{key}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="space-y-6 animate-in fade-in duration-700">
            {active === "General" && (
              <Card className="rounded-2xl">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>General</CardTitle>
                  <Badge variant="secondary">Faces</Badge>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid gap-2">
                    <label className="text-sm">Generic Confidence Threshold</label>
                    <div className="flex items-center gap-3">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={threshold}
                        onValueChange={setThreshold}
                        className="flex-1"
                      />
                      <Input
                        className="w-20"
                        value={(threshold[0] / 100).toFixed(2)}
                        onChange={(e) => {
                          const v = Math.min(1, Math.max(0, Number(e.target.value)))
                          setThreshold([Math.round(v * 100)])
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm">Frame Check Interval</label>
                      <Input
                        type="number"
                        value={interval}
                        onChange={(e) => setIntervalV(Number(e.target.value))}
                        placeholder="Check every N frames"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm">Thumbnail JPEG Quality</label>
                      <Input type="number" value={jpeg} onChange={(e) => setJpeg(Number(e.target.value))} />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm">Events Cleanup</label>
                      <div className="flex h-10 items-center">
                        <Switch checked={cleanup} onCheckedChange={setCleanup} />
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      "Delete matched events older than",
                      "Delete unmatched events older than",
                      "Delete full frames of matched events older than",
                      "Delete full frames of unmatched events older than",
                    ].map((label) => (
                      <div className="grid gap-2" key={label}>
                        <label className="text-sm">{label}</label>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                          <span className="text-sm text-muted-foreground">Hours</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => alert("Settings saved (demo)")}>Save</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {active !== "General" && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>{active}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  This section is not wired yet. Configure options here later.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
