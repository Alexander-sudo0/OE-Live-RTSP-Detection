import {
  Camera,
  Film,
  Activity,
  FolderSearch,
  Settings,
  Users,
  Bell,
  ListChecks,
  MonitorPlay,
} from "lucide-react";

export type Section = {
  key: string;
  title: string;
  description: string;
  href: string;
  Icon: any;
};

export const SECTION_CARDS: Section[] = [
  {
    key: "live-monitoring",
    title: "Live Monitoring",
    description: "Live RTSP streams checked against watchlist frames.",
    href: "/live-monitoring",
    Icon: MonitorPlay,
  },
  {
    key: "events",
    title: "Events",
    description: "Event-level frames; filter acknowledged vs unmatched.",
    href: "/events",
    Icon: Activity,
  },
  {
    key: "detection-logs",
    title: "Detection Logs",
    description: "Searchable log of all detections with filters.",
    href: "/detection-logs",
    Icon: FolderSearch,
  },
  {
    key: "watchlist",
    title: "Watchlist",
    description: "Manage individuals; images used for matching.",
    href: "/watchlist",
    Icon: Users,
  },
  {
    key: "alerts",
    title: "Alerts",
    description: "Review and acknowledge detection alerts.",
    href: "/alerts",
    Icon: Bell,
  },
  {
    key: "settings",
    title: "Settings",
    description: "System, streams, thresholds, and preferences.",
    href: "/settings",
    Icon: Settings,
  },
  {
    key: "cameras",
    title: "Cameras",
    description: "Add/update RTSP sources.",
    href: "/live-monitoring#cameras",
    Icon: Camera,
  },
];
