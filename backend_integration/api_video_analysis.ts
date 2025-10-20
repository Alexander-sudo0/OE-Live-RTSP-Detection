// Video Analysis API integration for Mizva Flask backend

import { MIZVA_URL } from "./api_mizva";

export type VideoAnalysisParams = {
  video: File;
  threshold?: number;
  useWatchlist?: boolean;
  skipFrames?: number;
};

export type RTSPAnalysisParams = {
  rtspId: string;
  duration: number;
  threshold?: number;
  useWatchlist?: boolean;
  skipFrames?: number;
};

export type AnalysisJobResult = {
  job_id: string;
  status: string;
};

export type JobStatus = {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  result?: {
    totalFrames: number;
    processedFrames: number;
    totalFaces: number;
    matchedFaces: number;
    uniqueFaces: number;
    processingTime: number;
    detections: Array<{
      frame: number;
      timestamp: number;
      faces: Array<{
        bbox: number[];
        confidence: number;
        matched: boolean;
        person_id?: number;
        person_name?: string;
        thumb_path?: string;
      }>;
    }>;
    summary: {
      videoInfo: {
        duration: number;
        fps: number;
        width: number;
        height: number;
      };
      statistics: {
        frames_with_faces: number;
        frames_without_faces: number;
        avg_faces_per_frame: number;
        max_faces_in_frame: number;
      };
    };
  };
  error?: string;
};

export async function startVideoAnalysis(
  params: VideoAnalysisParams,
  baseUrl = MIZVA_URL
): Promise<AnalysisJobResult> {
  const formData = new FormData();
  formData.append("video", params.video);
  
  if (params.threshold !== undefined) {
    formData.append("threshold", String(params.threshold));
  }
  
  if (params.useWatchlist !== undefined) {
    formData.append("use_watchlist", String(params.useWatchlist));
  }
  
  if (params.skipFrames !== undefined) {
    formData.append("skip_frames", String(params.skipFrames));
  }

  const response = await fetch(`${baseUrl}/api/video-analysis/start`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to start video analysis: ${await response.text()}`);
  }

  return response.json();
}

export async function startRTSPAnalysis(
  params: RTSPAnalysisParams,
  baseUrl = MIZVA_URL
): Promise<AnalysisJobResult> {
  const formData = new FormData();
  formData.append("rtsp_id", params.rtspId);
  formData.append("duration", String(params.duration));
  
  if (params.threshold !== undefined) {
    formData.append("threshold", String(params.threshold));
  }
  
  if (params.useWatchlist !== undefined) {
    formData.append("use_watchlist", String(params.useWatchlist));
  }
  
  if (params.skipFrames !== undefined) {
    formData.append("skip_frames", String(params.skipFrames));
  }

  const response = await fetch(`${baseUrl}/api/rtsp-analysis/start`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to start RTSP analysis: ${await response.text()}`);
  }

  return response.json();
}

export async function getAnalysisJob(
  jobId: string,
  baseUrl = MIZVA_URL
): Promise<JobStatus> {
  const response = await fetch(`${baseUrl}/api/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${await response.text()}`);
  }

  return response.json();
}

export async function getVideoAnalysisResults(
  jobId: string,
  baseUrl = MIZVA_URL
): Promise<JobStatus> {
  const response = await fetch(`${baseUrl}/api/video-analysis/results/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get analysis results: ${await response.text()}`);
  }

  return response.json();
}

export async function downloadAnalysisReport(
  jobId: string,
  format: "json" | "csv" = "json",
  baseUrl = MIZVA_URL
): Promise<Blob> {
  const response = await fetch(
    `${baseUrl}/api/video-analysis/export/${jobId}?format=${format}`
  );

  if (!response.ok) {
    throw new Error(`Failed to download report: ${await response.text()}`);
  }

  return response.blob();
}

export function getAnalysisDetectionImageUrl(
  jobId: string,
  detectionPath: string,
  baseUrl = MIZVA_URL
): string {
  return `${baseUrl}/api/video-analysis/detection-image/${jobId}/${encodeURIComponent(detectionPath)}`;
}
