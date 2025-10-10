"use client"

import Link from "next/link"

export function BrandLogo({ className = "h-8" }: { className?: string }) {
  return (
    <Link href="/home" className="inline-flex items-center gap-2">
      <img src="/images/oe-white-1080p.png" alt="OptiExacta Logo" className={`${className} w-auto`} />
      <span className="sr-only">Go to Home</span>
    </Link>
  )
}
