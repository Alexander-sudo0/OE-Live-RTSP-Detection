"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar, User, Camera, Clock, Target, Zap, Filter, Search, Eye, Brain, Heart } from "lucide-react";
import { MIZVA_URL } from "@/backend_integration/api_mizva";
import { FaceDetectionEvent, EventSearchFilters, EventsResponse } from "@/types/face-recognition";

interface EnhancedEventsViewProps {
  className?: string;
}

export function EnhancedEventsView({ className }: EnhancedEventsViewProps) {
  const [events, setEvents] = useState<FaceDetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total_count: 0,
    page: 1,
    limit: 20,
    has_next: false,
    has_previous: false,
    total_pages: 0
  });
  
  const [filters, setFilters] = useState<EventSearchFilters>({
    matched_only: false,
    confidence_min: 0.0,
    confidence_max: 1.0,
    min_quality: 0.0,
    exclude_low_quality: false,
    last_hours: 24,
    sort_by: "timestamp",
    sort_order: "desc",
    limit: 20,
    page: 1
  });
  
  const [selectedEvent, setSelectedEvent] = useState<FaceDetectionEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      // Add all filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.set(key, value.toString());
          }
        }
      });

      const response = await fetch(`${MIZVA_URL}/api/events/enhanced?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load events');
      
      const data: EventsResponse = await response.json();
      setEvents(data.events);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key: keyof EventSearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return 'bg-green-100 text-green-800';
    if (quality >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Filters Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Face Detection Events</h2>
          <p className="text-muted-foreground">
            {pagination.total_count} events found • Advanced analytics and filtering
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters & Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Time Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Range (hours)</label>
                <Select 
                  value={filters.last_hours?.toString() || "24"} 
                  onValueChange={(value) => updateFilter('last_hours', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last hour</SelectItem>
                    <SelectItem value="6">Last 6 hours</SelectItem>
                    <SelectItem value="24">Last 24 hours</SelectItem>
                    <SelectItem value="168">Last week</SelectItem>
                    <SelectItem value="720">Last month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recognition Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Recognition Status</label>
                <Select 
                  value={filters.matched_only ? "matched" : "all"} 
                  onValueChange={(value) => updateFilter('matched_only', value === 'matched')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="matched">Recognized Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Quality: {filters.min_quality}</label>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  value={[filters.min_quality || 0]}
                  onValueChange={([value]) => updateFilter('min_quality', value)}
                />
              </div>

              {/* Confidence Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Confidence: {filters.confidence_min} - {filters.confidence_max}</label>
                <div className="space-y-2">
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[filters.confidence_min || 0, filters.confidence_max || 1]}
                    onValueChange={([min, max]) => {
                      updateFilter('confidence_min', min);
                      updateFilter('confidence_max', max);
                    }}
                  />
                </div>
              </div>

              {/* Gender Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Gender</label>
                <Select 
                  value={filters.gender || "all"} 
                  onValueChange={(value) => updateFilter('gender', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Age Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Age Range</label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    placeholder="Min age"
                    value={filters.age_min || ""}
                    onChange={(e) => updateFilter('age_min', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                  <Input 
                    type="number" 
                    placeholder="Max age"
                    value={filters.age_max || ""}
                    onChange={(e) => updateFilter('age_max', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>

              {/* Person Name Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Person Name</label>
                <Input 
                  placeholder="Search by name..."
                  value={filters.person_name || ""}
                  onChange={(e) => updateFilter('person_name', e.target.value || undefined)}
                />
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select 
                  value={filters.sort_by || "timestamp"} 
                  onValueChange={(value) => updateFilter('sort_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timestamp">Newest First</SelectItem>
                    <SelectItem value="confidence">Highest Confidence</SelectItem>
                    <SelectItem value="quality">Best Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={loadEvents} size="sm">
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setFilters({
                    matched_only: false,
                    confidence_min: 0.0,
                    confidence_max: 1.0,
                    min_quality: 0.0,
                    exclude_low_quality: false,
                    last_hours: 24,
                    sort_by: "timestamp",
                    sort_order: "desc",
                    limit: 20,
                    page: 1
                  });
                }}
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted rounded-t-lg"></div>
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))
        ) : (
          events.map((event, i) => (
            <Card key={i} className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <div 
                className="relative"
                onClick={() => setSelectedEvent(event)}
              >
                {/* Event Image */}
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={event.thumbnail || `${MIZVA_URL}/data/${event.thumb_relpath}`}
                    alt="Face detection"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  
                  {/* Status Indicators */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {event.matched && (
                      <Badge className="bg-green-500 text-white text-xs">
                        <Target className="h-3 w-3 mr-1" />
                        Match
                      </Badge>
                    )}
                    <Badge className={`text-xs ${getAlertLevelColor(event.alert_level || 'info')}`}>
                      {event.alert_level?.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Quality Indicator */}
                  <div className="absolute bottom-2 left-2">
                    <Badge className={`text-xs ${getQualityColor(event.quality_metrics?.quality || 0.5)}`}>
                      Q{Math.round((event.quality_metrics?.quality || 0.5) * 100)}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Person Information */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm truncate">
                        {event.person_name || "Unknown Person"}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {Math.round((event.confidence || 0) * 100)}%
                      </Badge>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(event.timestamp || 0)}
                    </div>
                  </div>

                  {/* Facial Features */}
                  <div className="space-y-2">
                    {(event.features?.age?.name || event.features?.gender?.name) && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{event.features?.age?.name}y</span>
                        <span className="capitalize">{event.features?.gender?.name}</span>
                      </div>
                    )}
                    
                    {/* Face Metrics */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>{event.quality_metrics?.width}×{event.quality_metrics?.height}</span>
                      {event.processing_time_ms && (
                        <>
                          <Zap className="h-3 w-3 ml-1" />
                          <span>{event.processing_time_ms.toFixed(1)}ms</span>
                        </>
                      )}
                    </div>

                    {/* Emotions (if available) */}
                    {event.features?.emotions && Object.keys(event.features.emotions).length > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Heart className="h-3 w-3 text-muted-foreground" />
                        <div className="flex gap-1">
                          {Object.entries(event.features.emotions)
                            .sort(([,a], [,b]) => (b as number) - (a as number))
                            .slice(0, 2)
                            .map(([emotion, confidence]) => (
                              <Badge key={emotion} variant="outline" className="text-xs capitalize">
                                {emotion} {Math.round((confidence as number) * 100)}%
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera Info */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                    <Camera className="h-3 w-3" />
                    <span className="truncate">{event.camera_id}</span>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total_count)} of {pagination.total_count} events
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_previous}
              onClick={() => updateFilter('page', pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm py-2 px-3">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_next}
              onClick={() => updateFilter('page', pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedEventsView;