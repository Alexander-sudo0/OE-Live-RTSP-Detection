"use client";
import { Navbar } from "@/components/_comps/navbar";
import { HomeGrid } from "@/components/_comps/home-grid";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-8xl px-8 py-12">
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-6 py-8">
              <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Face Recognition Dashboard
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Comprehensive surveillance and monitoring system with real-time
                face detection, intelligent alerts, and advanced analytics for
                enhanced security management.
              </p>
              <div className="w-32 h-1 bg-gradient-to-r from-primary to-primary/60 rounded-full mx-auto" />
            </div>

            {/* Cards Grid */}
            <HomeGrid />
          </div>
        </div>
      </main>
    </>
  );
}
