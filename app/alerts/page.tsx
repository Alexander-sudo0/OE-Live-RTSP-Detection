"use client";

import { Navbar } from "@/components/_comps/navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BellRing,
  Search,
  Filter,
  Check,
  X,
  Trash2,
  Eye,
  AlertTriangle,
  Shield,
  Info,
} from "lucide-react";
import { useAlerts } from "@/contexts/AlertContext";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MIZVA_URL } from "@/backend_integration/api_mizva";

export default function AlertsPage() {
  const {
    alerts,
    acknowledgeAlert,
    dismissAlert,
    clearAllAlerts,
    markAllAsRead,
  } = useAlerts();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "acknowledged" | "dismissed"
  >("all");
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        searchQuery === "" ||
        alert.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.camera_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || alert.status === statusFilter;
      const matchesSeverity =
        severityFilter === "all" || alert.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [alerts, searchQuery, statusFilter, severityFilter]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
          >
            Medium
          </Badge>
        );
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="destructive">New</Badge>;
      case "acknowledged":
        return <Badge variant="secondary">Acknowledged</Badge>;
      case "dismissed":
        return <Badge variant="outline">Dismissed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Alert Center</h1>
            <Badge variant="secondary" className="ml-2">
              {alerts.length} total
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={alerts.filter((a) => a.status === "new").length === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllAlerts}
              disabled={alerts.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">All Severity</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Results</label>
                <div className="text-sm text-muted-foreground pt-2">
                  {filteredAlerts.length} of {alerts.length} alerts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        <div className="rounded-2xl border bg-card/70 backdrop-blur-xl overflow-hidden animate-in fade-in duration-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    {alerts.length === 0
                      ? "No alerts yet."
                      : "No alerts match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    className={cn(
                      "transition-colors duration-200",
                      alert.status === "new" &&
                        "bg-primary/5 border-l-2 border-primary"
                    )}
                  >
                    <TableCell>
                      <img
                        src={`${MIZVA_URL}/data/${alert.thumb_relpath}`}
                        alt="Detection"
                        className="h-16 w-16 rounded-lg object-cover border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        style={{ imageRendering: "crisp-edges" }}
                        loading="lazy"
                        onClick={() =>
                          window.open(
                            `${MIZVA_URL}/data/${alert.thumb_relpath}`,
                            "_blank"
                          )
                        }
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder-user.jpg";
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {alert.is_match ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            ⚠️ {alert.person_name}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">
                            ✅ {alert.person_name}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {alert.confidence}%
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{alert.camera_name}</div>
                        <div className="text-muted-foreground text-xs">
                          {alert.camera_id.slice(-8)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        {formatTime(alert.timestamp)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                        {getSeverityBadge(alert.severity)}
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(alert.status)}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        {alert.status === "new" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="h-8 w-8 p-0"
                            title="Acknowledge"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissAlert(alert.id)}
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                          title="Dismiss"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </>
  );
}
