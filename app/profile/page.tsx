"use client"

import { Navbar } from "@/components/_comps/navbar"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-card/70 p-6 backdrop-blur-xl">
          <img
            src="/images/oe-white-1080p.png"
            alt=""
            className="absolute opacity-5 right-6 top-6 h-20 w-auto pointer-events-none"
          />
          <div className="relative z-10 flex items-center gap-4">
            <img src="/admin-avatar.png" alt="Admin avatar" className="h-16 w-16 rounded-full object-cover" />
            <div>
              <h1 className="text-2xl font-semibold">Admin User</h1>
              <p className="text-muted-foreground">admin@optiexacta.demo</p>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={() => router.push("/login")} className="w-full md:w-auto">
              Logout
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
