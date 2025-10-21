import { MIZVA_URL } from "./api_mizva";

export interface QualityEvent {
  id: number;
  camera_id: string;
  camera_name?: string;
  ts: number;
  confidence: number;
  bbox: string;
  thumb_relpath?: string;
  thumb_url?: string;
  matched: number;
  person_id?: number;
  person_name?: string;
  quality_score?: number;
  is_low_quality?: number;
  full_image_path?: string;
}

export interface QualityEventsResponse {
  events: QualityEvent[];
}

export async function getHighQualityEvents(
  limit: number = 100,
  threshold?: number,
  cameraId?: string,
  matched?: boolean
): Promise<QualityEventsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  
  if (threshold !== undefined) {
    params.append('threshold', threshold.toString());
  }
  
  if (cameraId) {
    params.append('camera_id', cameraId);
  }
  
  if (matched !== undefined) {
    params.append('matched', matched.toString());
  }

  const response = await fetch(`${MIZVA_URL}/api/events/high-quality?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch high quality events: ${response.statusText}`);
  }
  return response.json();
}

export async function getLowQualityEvents(
  limit: number = 100,
  threshold?: number,
  cameraId?: string,
  matched?: boolean
): Promise<QualityEventsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  
  if (threshold !== undefined) {
    params.append('threshold', threshold.toString());
  }
  
  if (cameraId) {
    params.append('camera_id', cameraId);
  }
  
  if (matched !== undefined) {
    params.append('matched', matched.toString());
  }

  const response = await fetch(`${MIZVA_URL}/api/events/low-quality?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch low quality events: ${response.statusText}`);
  }
  return response.json();
}

export async function getQualityThreshold(): Promise<{ threshold: number }> {
  const response = await fetch(`${MIZVA_URL}/api/quality-threshold`);
  if (!response.ok) {
    throw new Error(`Failed to get quality threshold: ${response.statusText}`);
  }
  return response.json();
}

export async function setQualityThreshold(threshold: number): Promise<{ threshold: number; success: boolean }> {
  const response = await fetch(`${MIZVA_URL}/api/quality-threshold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ threshold }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to set quality threshold: ${response.statusText}`);
  }
  return response.json();
}

export function getFullImageUrl(eventId: number): string {
  return `${MIZVA_URL}/api/events/${eventId}/full-image`;
}