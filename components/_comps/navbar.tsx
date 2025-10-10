"use client";

import Link from "next/link";
import { BrandLogo } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutGrid,
  Bell,
  Camera,
  Users,
  ListOrdered,
  Settings,
  Calendar,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    // Add any logout logic here (clear storage, etc.)
    router.push("/login");
  };

  const linkCls = (path: string) =>
    `relative flex items-center gap-3 px-6 py-3.5 rounded-2xl text-base font-semibold transition-all duration-200 group ${
      pathname === path
        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 scale-105"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:shadow-md hover:scale-105"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-background/90 border-b border-border/50 shadow-lg">
      <nav className="mx-auto max-w-8xl px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <BrandLogo className="h-10 transition-transform hover:scale-110" />
          <ul className="hidden lg:flex items-center gap-3">
            <li>
              <Link className={linkCls("/home")} href="/home">
                <LayoutGrid className="h-5 w-5" />
                Home
                {pathname === "/home" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link
                className={linkCls("/live-monitoring")}
                href="/live-monitoring"
              >
                <Camera className="h-5 w-5" />
                Live
                {pathname === "/live-monitoring" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link className={linkCls("/events")} href="/events">
                <Calendar className="h-5 w-5" />
                Events
                {pathname === "/events" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link className={linkCls("/watchlist")} href="/watchlist">
                <Users className="h-5 w-5" />
                Watchlist
                {pathname === "/watchlist" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link
                className={linkCls("/detection-logs")}
                href="/detection-logs"
              >
                <ListOrdered className="h-5 w-5" />
                Logs
                {pathname === "/detection-logs" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link className={linkCls("/settings")} href="/settings">
                <Settings className="h-5 w-5" />
                Settings
                {pathname === "/settings" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
            <li>
              <Link className={linkCls("/alerts")} href="/alerts">
                <Bell className="h-5 w-5" />
                Alerts
                {pathname === "/alerts" && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </Link>
            </li>
          </ul>
        </div>

        {/* Profile Dropdown */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-4 py-2 h-12 rounded-xl hover:bg-secondary/80 transition-all duration-200 group"
              >
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-200">
                  <AvatarImage src="/admin-avatar.png" alt="Admin" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold">
                    AD
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-foreground">
                    Administrator
                  </p>
                  <p className="text-xs text-muted-foreground">
                    admin@system.com
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-xl border-2 border-border/50 bg-card/95 backdrop-blur-xl shadow-xl"
            >
              <div className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                    <AvatarImage src="/admin-avatar.png" alt="Admin" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold">
                      AD
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Administrator
                    </p>
                    <p className="text-xs text-muted-foreground">
                      admin@system.com
                    </p>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/80 rounded-lg mx-1 transition-colors duration-200">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/80 rounded-lg mx-1 transition-colors duration-200">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 hover:bg-destructive/10 hover:text-destructive rounded-lg mx-1 transition-colors duration-200 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Button variant="ghost" size="lg" className="h-12 w-12">
              <LayoutGrid className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}
