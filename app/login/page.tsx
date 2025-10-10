"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogIn } from "lucide-react";
import { useQuickDialog } from "@/components/_comps/quick-dialog";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { show, element } = useQuickDialog();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin") {
      show(<div className="text-sm">Login success. Redirecting to Home…</div>);
      setTimeout(() => router.push("/home"), 700);
    } else {
      setError("Invalid credentials. Try admin / admin.");
      show(
        <div className="text-sm text-destructive-foreground">
          Invalid credentials
        </div>
      );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 relative overflow-hidden">
      {element}

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header Section */}
          <div className="text-center space-y-6 mb-8">
            <div className="mx-auto w-24 h-24 flex items-center justify-center">
              <img
                src="/images/oe-white-1080p.png"
                alt="Company Logo"
                className="h-16 w-auto"
              />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Face Recognition
              </h1>
              <h2 className="text-2xl font-semibold text-muted-foreground">
                Monitoring System
              </h2>
              <p className="text-lg text-muted-foreground">
                Secure access to your surveillance dashboard
              </p>
              <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary rounded-full mx-auto" />
            </div>
          </div>

          {/* Login Form */}
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-3xl border-2 border-primary/20 bg-card/80 backdrop-blur-2xl p-8 shadow-2xl shadow-primary/10 relative overflow-hidden"
          >
            {/* Form background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full transform translate-x-16 -translate-y-16" />

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  Username
                </label>
                <div className="relative">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-background/50 border-2 border-primary/20 focus:border-primary/60 rounded-xl text-base transition-all duration-300 focus:shadow-lg focus:shadow-primary/10 pl-4"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-secondary rounded-full" />
                  Password
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-background/50 border-2 border-secondary/20 focus:border-secondary/60 rounded-xl text-base transition-all duration-300 focus:shadow-lg focus:shadow-secondary/10 pl-4"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-sm text-destructive font-medium">
                    {error}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-14 group bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground font-semibold text-lg rounded-xl shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95"
              >
                <LogIn className="mr-3 h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                Sign In to Dashboard
              </Button>

              <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-muted/30 border border-muted/40">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-full">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">
                    Demo Credentials
                  </p>
                  <p className="text-xs text-foreground/80">admin / admin</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
