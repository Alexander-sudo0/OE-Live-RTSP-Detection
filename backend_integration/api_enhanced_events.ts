// Enhanced events API integration for rich metadata features
import { FaceDetectionEvent, EventSearchFilters, EventsResponse } from "@/types/face-recognition";

export const MIZVA_URL = process.env.NEXT_PUBLIC_MIZVA_URL || "http://localhost:5001";

/**
 * Fetch enhanced events with comprehensive metadata and filtering
 */
export async function getEnhancedEvents(filters: EventSearchFilters = {}): Promise<EventsResponse> {
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
  if (!response.ok) {
    throw new Error(`Failed to fetch enhanced events: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get events for a specific camera with enhanced metadata
 */
export async function getCameraEnhancedEvents(
  cameraId: string, 
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    camera_ids: [cameraId]
  });
}

/**
 * Get recent events (last N hours) with enhanced metadata
 */
export async function getRecentEnhancedEvents(
  hours: number = 24, 
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    last_hours: hours
  });
}

/**
 * Get events by recognition status with enhanced metadata
 */
export async function getRecognizedEvents(
  matchedOnly: boolean = true,
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    matched_only: matchedOnly
  });
}

/**
 * Get events filtered by quality metrics
 */
export async function getQualityFilteredEvents(
  minQuality: number = 0.6,
  excludeLowQuality: boolean = true,
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    min_quality: minQuality,
    exclude_low_quality: excludeLowQuality
  });
}

/**
 * Get events filtered by demographic features
 */
export async function getDemographicEvents(
  demographic: {
    gender?: 'male' | 'female';
    ageMin?: number;
    ageMax?: number;
  },
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    gender: demographic.gender,
    age_min: demographic.ageMin,
    age_max: demographic.ageMax
  });
}

/**
 * Search events by person name
 */
export async function searchEventsByPersonName(
  personName: string,
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    person_name: personName
  });
}

/**
 * Get events by alert level
 */
export async function getEventsByAlertLevel(
  alertLevels: string[] = ['high', 'critical'],
  filters: Partial<EventSearchFilters> = {}
): Promise<EventsResponse> {
  return getEnhancedEvents({
    ...filters,
    alert_levels: alertLevels
  });
}

/**
 * Get events analytics summary
 */
export async function getEventsAnalytics(filters: Partial<EventSearchFilters> = {}) {
  const response = await getEnhancedEvents(filters);
  
  if (!response.events) {
    return {
      totalEvents: 0,
      recognizedEvents: 0,
      avgConfidence: 0,
      avgQuality: 0,
      genderDistribution: {},
      ageDistribution: {},
      cameraDistribution: {},
      qualityDistribution: {}
    };
  }

  const events = response.events;
  const recognizedEvents = events.filter(e => e.matched);
  
  // Calculate averages
  const totalConfidence = events.reduce((sum, e) => sum + (e.confidence || 0), 0);
  const totalQuality = events.reduce((sum, e) => sum + (e.quality_metrics?.quality || 0), 0);
  
  // Gender distribution
  const genderDistribution = events.reduce((dist: Record<string, number>, e) => {
    const gender = e.features?.gender?.name || 'unknown';
    dist[gender] = (dist[gender] || 0) + 1;
    return dist;
  }, {});
  
  // Age distribution (by ranges)
  const ageDistribution = events.reduce((dist: Record<string, number>, e) => {
    const age = e.features?.age?.name;
    if (age) {
      let range = 'unknown';
      if (age < 18) range = '0-18';
      else if (age < 30) range = '18-30';
      else if (age < 45) range = '30-45';
      else if (age < 60) range = '45-60';
      else range = '60+';
      dist[range] = (dist[range] || 0) + 1;
    }
    return dist;
  }, {});
  
  // Camera distribution
  const cameraDistribution = events.reduce((dist: Record<string, number>, e) => {
    dist[e.camera_id] = (dist[e.camera_id] || 0) + 1;
    return dist;
  }, {});
  
  // Quality distribution
  const qualityDistribution = events.reduce((dist: Record<string, number>, e) => {
    const quality = e.quality_metrics?.quality || 0;
    let range = 'unknown';
    if (quality >= 0.8) range = 'excellent';
    else if (quality >= 0.6) range = 'good';
    else if (quality >= 0.4) range = 'fair';
    else range = 'poor';
    dist[range] = (dist[range] || 0) + 1;
    return dist;
  }, {});
  
  return {
    totalEvents: events.length,
    recognizedEvents: recognizedEvents.length,
    recognitionRate: events.length > 0 ? (recognizedEvents.length / events.length) * 100 : 0,
    avgConfidence: events.length > 0 ? totalConfidence / events.length : 0,
    avgQuality: events.length > 0 ? totalQuality / events.length : 0,
    genderDistribution,
    ageDistribution,
    cameraDistribution,
    qualityDistribution
  };
}

/**
 * Export event data to CSV format
 */
export function exportEventsToCSV(events: FaceDetectionEvent[]): string {
  if (events.length === 0) return '';
  
  const headers = [
    'Timestamp',
    'Camera ID',
    'Person Name',
    'Confidence',
    'Matched',
    'Age',
    'Gender',
    'Quality Score',
    'Face Width',
    'Face Height',
    'Alert Level',
    'Event Type',
    'Processing Time (ms)'
  ];
  
  const csvRows = [
    headers.join(','),
    ...events.map(event => [
      new Date(event.timestamp || 0).toISOString(),
      event.camera_id || '',
      `"${event.person_name || 'Unknown'}"`,
      event.confidence || 0,
      event.matched || false,
      event.features?.age?.name || '',
      event.features?.gender?.name || '',
      event.quality_metrics?.quality || 0,
      event.quality_metrics?.width || 0,
      event.quality_metrics?.height || 0,
      event.alert_level || '',
      event.event_type || '',
      event.processing_time_ms || 0
    ].join(','))
  ];
  
  return csvRows.join('\n');
}

/**
 * Download events data as CSV file
 */
export function downloadEventsCSV(events: FaceDetectionEvent[], filename: string = 'face_detection_events.csv') {
  const csvContent = exportEventsToCSV(events);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}