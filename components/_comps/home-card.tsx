"use client";

import type React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomeCardProps = {
  href: string;
  title: string;
  description?: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  className?: string;
};

export function HomeCard({ title, description, Icon, href }: HomeCardProps) {
  return (
    <Link href={href} className="group">
      <Card className="relative h-48 p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 border-2 hover:border-primary/50 overflow-hidden bg-gradient-to-br from-card to-muted/20">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full transform translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-500" />

        <CardContent className="relative z-10 h-full flex flex-col justify-between p-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110">
                <Icon className="h-8 w-8 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-xl leading-none group-hover:text-primary transition-colors duration-300">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                {description}
              </p>
            </div>
          </div>

          {/* Hover indicator */}
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-primary transition-all duration-300">
            <span>View Details</span>
            <div className="w-0 group-hover:w-8 h-px bg-primary transition-all duration-300" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
