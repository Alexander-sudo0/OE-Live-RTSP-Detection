// Enhanced Face Recognition Types based on OPTIEXACTA system analysis
// This mirrors the sophisticated metadata structure shown in the reference images

export interface FaceDetectionFeatures {
  // Liveness detection
  liveness: {
    name: "fake" | "real";
    confidence: number;
  };
  
  // Facial hair detection
  beard: {
    name: "beard" | "no_beard";
    confidence: number;
  };
  
  // Age estimation  
  age: {
    name: number; // Actual age estimate
    confidence: number;
  };
  
  // Gender detection
  gender: {
    name: "male" | "female";
    confidence: number;
  };
  
  // Glasses detection
  glasses: {
    name: "none" | "eyeglasses" | "sunglasses";
    confidence: number;
  };
  
  // Emotion analysis
  emotions: {
    anger?: number;
    disgust?: number;
    fear?: number;
    happiness?: number;
    sadness?: number;
    surprise?: number;
    neutral?: number;
    dominant_emotion?: string;
  };
}

export interface FaceQualityMetrics {
  width: number;
  height: number;
  size: number; // pixel count or area
  quality: number; // 0-1 quality score
  sharpness?: number;
  brightness?: number;
  contrast?: number;
  symmetry?: number;
}

export interface FaceDetectionEvent {
  // Core identification
  id: string;
  episode_id?: number;
  camera_id: string;
  camera_name?: string;
  
  // Timestamp and location
  created_date: string; // ISO timestamp
  timestamp: number; // Unix timestamp
  frame_number?: number;
  
  // Detection coordinates
  frame_coords_left: number;
  frame_coords_top: number;
  frame_coords_right: number;
  frame_coords_bottom: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  
  // Recognition results
  matched: boolean;
  person_id?: number;
  person_name?: string;
  confidence: number;
  similarity_score?: number;
  
  // Watchlist information  
  matched_lists?: number[];
  is_blacklisted?: boolean;
  is_whitelisted?: boolean;
  alert_level?: "low" | "medium" | "high" | "critical";
  
  // Image references
  thumbnail: string; // URL or path to thumbnail
  full_frame?: string; // URL or path to full frame
  crop_image?: string; // URL or path to face crop
  
  // Quality metrics
  quality_metrics: FaceQualityMetrics;
  is_low_quality: boolean;
  
  // Facial analysis
  features: FaceDetectionFeatures;
  
  // Detection parameters
  detector_params: {
    model_version?: string;
    detection_threshold?: number;
    recognition_threshold?: number;
    quality_threshold?: number;
    min_face_size?: number;
  };
  
  // Tracking information
  track_id?: string;
  track_duration?: number; // seconds
  track_confidence?: number;
  is_new_track?: boolean;
  
  // System metadata
  processed_date?: string;
  processing_time_ms?: number;
  frame_processing_fps?: number;
  
  // Additional context
  camera_location?: {
    latitude?: number;
    longitude?: number;
    zone?: string;
    building?: string;
    floor?: string;
  };
  
  // Event classification
  event_type?: "entry" | "exit" | "loitering" | "recognized" | "unknown" | "alert";
  severity?: "info" | "warning" | "alert" | "critical";
  
  // External system integration
  external_ref_id?: string;
  sync_status?: "pending" | "synced" | "failed";
  
  // Analytics
  visit_count?: number;
  last_seen?: string;
  frequency_score?: number;
}

export interface CameraMetadata {
  id: string;
  name: string;
  status: "active" | "inactive" | "error" | "maintenance";
  url?: string;
  
  // Camera settings
  stream_settings: {
    resolution?: string;
    fps?: number;
    bitrate?: string;
    codec?: string;
  };
  
  // Detection configuration
  detectors: {
    face: {
      enabled: boolean;
      filter_max_size?: number;
      filter_min_quality?: number;
      filter_min_size?: number;
      confidence_threshold?: number;
    };
    body?: {
      enabled: boolean;
      confidence_threshold?: number;
    };
  };
  
  // Location and context
  location?: {
    latitude?: number;
    longitude?: number;
    zone?: string;
    building?: string;
    floor?: string;
    direction?: string; // "entry", "exit", "bidirectional"
  };
  
  // Health monitoring
  health_status: {
    enabled: boolean;
    status: "healthy" | "warning" | "error";
    last_heartbeat?: string;
    uptime_percentage?: number;
    error_count?: number;
  };
  
  // Statistics
  statistics: {
    total_detections?: number;
    faces_detected_today?: number;
    unique_faces_today?: number;
    avg_confidence?: number;
    processing_fps?: number;
  };
}

export interface LiveMonitoringState {
  cameras: CameraMetadata[];
  active_alerts: FaceDetectionEvent[];
  system_stats: {
    total_cameras: number;
    active_cameras: number;
    total_events_today: number;
    unique_persons_today: number;
    avg_system_load?: number;
    storage_used_gb?: number;
  };
}

export interface EventSearchFilters {
  // Time filters
  start_date?: string;
  end_date?: string;
  last_hours?: number;
  
  // Location filters  
  camera_ids?: string[];
  zones?: string[];
  
  // Recognition filters
  matched_only?: boolean;
  person_ids?: number[];
  person_names?: string[];
  confidence_min?: number;
  confidence_max?: number;
  
  // Quality filters
  min_quality?: number;
  exclude_low_quality?: boolean;
  min_face_size?: number;
  
  // Feature filters
  age_min?: number;
  age_max?: number;
  gender?: "male" | "female";
  has_glasses?: boolean;
  has_beard?: boolean;
  emotion?: string;
  
  // Alert filters
  alert_levels?: string[];
  event_types?: string[];
  
  // Pagination
  page?: number;
  limit?: number;
  sort_by?: "timestamp" | "confidence" | "quality";
  sort_order?: "asc" | "desc";
}

// Enhanced API response types
export interface EventsResponse {
  events: FaceDetectionEvent[];
  total_count: number;
  page: number;
  has_next: boolean;
  has_previous: boolean;
  filters_applied: EventSearchFilters;
  processing_time_ms: number;
}

export interface EventAnalytics {
  // Time-based analytics
  hourly_counts: { hour: string; count: number }[];
  daily_trends: { date: string; total: number; unique: number }[];
  
  // Demographics
  age_distribution: { range: string; count: number; percentage: number }[];
  gender_distribution: { gender: string; count: number; percentage: number }[];
  
  // Quality metrics
  quality_distribution: { range: string; count: number }[];
  avg_confidence: number;
  
  // Top performers
  top_cameras: { camera_id: string; camera_name: string; count: number }[];
  frequent_visitors: { person_id: number; person_name: string; visit_count: number; last_seen: string }[];
  
  // Alert statistics
  alert_breakdown: { level: string; count: number }[];
  recognition_rate: number; // percentage of faces that were recognized
}