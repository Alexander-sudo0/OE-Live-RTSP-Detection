import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { AlertProvider } from "@/contexts/AlertContext";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientComponents } from "@/components/_comps/client-components";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "OE Face Management System",
  description: "Advanced face recognition and monitoring system",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`font-sans ${inter.variable} ${GeistMono.variable} min-h-dvh bg-background text-foreground antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AlertProvider>
            <Suspense fallback={null}>{children}</Suspense>
            <ClientComponents />
            <Analytics />
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
