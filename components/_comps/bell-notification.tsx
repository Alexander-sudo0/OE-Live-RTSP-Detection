"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlerts } from "@/contexts/AlertContext";
import { cn } from "@/lib/utils";
import { MIZVA_URL } from "@/backend_integration/api_mizva";

export function BellNotification() {
  const {
    alerts,
    unreadCount,
    isRinging,
    isMuted,
    acknowledgeAlert,
    dismissAlert,
    markAllAsRead,
    muteRing,
    unmuteRing,
    clearAllAlerts,
  } = useAlerts();

  const [open, setOpen] = useState(false);

  // ONLY show watchlist matches in bell notification
  const matchedAlerts = alerts.filter((alert) => alert.is_match);
  const recentAlerts = matchedAlerts.slice(0, 10); // Show only recent 10 matched alerts
  const matchedUnreadCount = matchedAlerts.filter(
    (alert) => alert.status === "new"
  ).length;

  // Move formatTime to a separate component to avoid hydration issues
  const TimeAgo = ({ timestamp }: { timestamp: string }) => {
    const [formattedTime, setFormattedTime] = useState<string>("...");

    useEffect(() => {
      const updateTime = () => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) setFormattedTime("Just now");
        else if (minutes < 60) setFormattedTime(`${minutes}m ago`);
        else if (hours < 24) setFormattedTime(`${hours}h ago`);
        else setFormattedTime(`${days}d ago`);
      };

      updateTime();
      // Update every minute
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }, [timestamp]);

    return <span>{formattedTime}</span>;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-10 w-10 rounded-full hover:bg-secondary/80 transition-all duration-200",
            isRinging && "animate-bounce"
          )}
        >
          {isRinging ? (
            <BellRing
              className={cn(
                "h-5 w-5 transition-colors duration-200",
                isRinging
                  ? "text-red-500 animate-pulse"
                  : "text-muted-foreground"
              )}
            />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors duration-200" />
          )}

          {matchedUnreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold rounded-full",
                isRinging && "animate-pulse scale-110"
              )}
            >
              {matchedUnreadCount > 99 ? "99+" : matchedUnreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-96 rounded-xl border-2 border-border/50 bg-card/95 backdrop-blur-xl shadow-xl p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Watchlist Matches</h3>
            {matchedUnreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {matchedUnreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mute/Unmute Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={isMuted ? unmuteRing : muteRing}
              className="h-8 w-8 p-0 hover:bg-secondary/80"
              title={isMuted ? "Unmute alerts" : "Mute alerts"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {/* Mark All Read Button */}
            {matchedUnreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 w-8 p-0 hover:bg-secondary/80"
                title="Mark all as read"
              >
                <Check className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}

            {/* Clear All Button */}
            {matchedAlerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllAlerts}
                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                title="Clear all alerts"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Ring Status */}
        {isRinging && (
          <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800/30 p-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <BellRing className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Alert ringing...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead()}
                className="ml-auto h-6 px-2 text-xs hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                Stop
              </Button>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <ScrollArea className="max-h-96">
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No watchlist matches yet</p>
            </div>
          ) : (
            <div className="p-2">
              {recentAlerts.map((alert, index) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors duration-200 group",
                    alert.status === "new" &&
                      "bg-primary/5 border-l-2 border-primary",
                    index < recentAlerts.length - 1 && "mb-2"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={`${MIZVA_URL}/data/${alert.thumb_relpath}`}
                      alt="Detection"
                      className="h-14 w-14 rounded-lg object-cover border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      style={{ imageRendering: "crisp-edges" }}
                      loading="lazy"
                      onClick={() =>
                        window.open(
                          `${MIZVA_URL}/data/${alert.thumb_relpath}`,
                          "_blank"
                        )
                      }
                    />
                    <div
                      className={cn(
                        "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                        getSeverityColor(alert.severity)
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm truncate",
                            alert.status === "new"
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          <span className="text-red-600 dark:text-red-400">
                            ⚠️ {alert.person_name || "Unknown Person"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.camera_name || alert.camera_id} •{" "}
                          {Math.round(alert.confidence)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <TimeAgo timestamp={alert.timestamp} />
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {alert.status === "new" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="h-6 w-6 p-0 hover:bg-primary/10"
                            title="Acknowledge"
                          >
                            <Check className="h-3 w-3 text-primary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissAlert(alert.id)}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {matchedAlerts.length > 10 && (
          <div className="border-t border-border/50 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              View all matches ({matchedAlerts.length})
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
