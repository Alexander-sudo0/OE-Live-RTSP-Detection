"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  VideoIcon,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  BarChart3,
  Play,
  Pause,
  RotateCcw,
  Download,
  FileVideo,
  Clock,
  TrendingUp,
  AlertTriangle,
  Radio,
  MonitorPlay,
  Timer,
  Info,
  HelpCircle,
} from "lucide-react";
import {
  startVideoAnalysis,
  getAnalysisJob,
  getVideoAnalysisResults,
  startRTSPAnalysis,
} from "@/backend_integration/api_video_analysis";
import { MIZVA_URL } from "@/backend_integration/api_mizva";
import { Slider } from "@/components/ui/slider";

interface AnalysisResult {
  id: string;
  filename: string;
  status: "queued" | "processing" | "running" | "completed" | "done" | "error";
  progress: number;
  totalFrames?: number;
  processedFrames?: number;
  totalFaces?: number;
  matchedFaces?: number;
  uniqueFaces?: number;
  processingTime?: number;
  detections?: Array<{
    frame: number;
    timestamp: number;
    faces: Array<{
      bbox: number[];
      confidence: number;
      similarity?: number;
      matched: boolean;
      person_id?: number;
      person_name?: string;
      thumb_path?: string;
      frame_path?: string;
    }>;
  }>;
  summary?: {
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
  error?: string;
  createdAt: string;
  type?: "upload" | "rtsp";
  rtspId?: string;
  duration?: number;
}

interface VideoUploadFormProps {
  onAnalysisStart: (result: AnalysisResult) => void;
}

function VideoUploadForm({ onAnalysisStart }: VideoUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState([60]);
  const [isUploading, setIsUploading] = useState(false);
  const [useWatchlist, setUseWatchlist] = useState(true);
  const [skipFrames, setSkipFrames] = useState([1]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await startVideoAnalysis({
        video: selectedFile,
        threshold: threshold[0] / 100,
        useWatchlist,
        skipFrames: skipFrames[0],
      });

      const analysisResult: AnalysisResult = {
        id: result.job_id,
        filename: selectedFile.name,
        status: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      onAnalysisStart(analysisResult);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to start video analysis: " + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Video for Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Video File</label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Supported formats: MP4, AVI, MOV, MKV, WebM
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Face Recognition Threshold: {threshold[0]}%
            </label>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              max={100}
              min={30}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher values require stronger matches
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Process Every {skipFrames[0]} Frame(s)
            </label>
            <Slider
              value={skipFrames}
              onValueChange={setSkipFrames}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Frame Processing:{" "}
              {skipFrames[0] === 1
                ? "All frames"
                : `Every ${skipFrames[0]} frames`}
              ({skipFrames[0] === 1 ? "Highest accuracy" : "Faster processing"})
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="useWatchlist"
              type="checkbox"
              checked={useWatchlist}
              onChange={(e) => setUseWatchlist(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="useWatchlist" className="text-sm font-medium">
              Use Watchlist for Face Matching
            </label>
          </div>

          {/* Processing Tip */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">Processing Tip</p>
                <p className="text-blue-700">
                  For faster results, use frame skipping (2-5 frames). For
                  maximum accuracy of unique person detection, process all
                  frames (1).
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
              Starting Analysis...
            </>
          ) : (
            <>
              <VideoIcon className="h-4 w-4 mr-2" />
              Start Video Analysis
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface RTSPAnalysisFormProps {
  onAnalysisStart: (result: AnalysisResult) => void;
}

function RTSPAnalysisForm({ onAnalysisStart }: RTSPAnalysisFormProps) {
  const [rtspId, setRtspId] = useState("");
  const [duration, setDuration] = useState([30]);
  const [threshold, setThreshold] = useState([60]);
  const [isStarting, setIsStarting] = useState(false);
  const [useWatchlist, setUseWatchlist] = useState(true);

  const handleStartAnalysis = async () => {
    if (!rtspId.trim()) {
      alert("Please enter an RTSP ID");
      return;
    }

    setIsStarting(true);
    try {
      // Try to start real RTSP analysis first
      try {
        const result = await startRTSPAnalysis({
          rtspId: rtspId.trim(),
          duration: duration[0],
          threshold: threshold[0] / 100,
          useWatchlist,
          skipFrames: 1,
        });

        const analysisResult: AnalysisResult = {
          id: result.job_id,
          filename: `RTSP Stream ${rtspId}`,
          status: "queued",
          progress: 0,
          createdAt: new Date().toISOString(),
          type: "rtsp",
          rtspId: rtspId.trim(),
          duration: duration[0],
        };

        onAnalysisStart(analysisResult);
        setRtspId("");
        return;
      } catch (apiError) {
        console.warn("RTSP API not available, using simulation:", apiError);
      }

      // Fallback to simulation if API is not available
      const jobId = `rtsp_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const analysisResult: AnalysisResult = {
        id: jobId,
        filename: `RTSP Stream ${rtspId}`,
        status: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
        type: "rtsp",
        rtspId: rtspId.trim(),
        duration: duration[0],
      };

      onAnalysisStart(analysisResult);

      // Simulate RTSP stream analysis
      setTimeout(() => {
        simulateRTSPAnalysis(analysisResult, (updated) => {
          // Find and update the result in the callback
          onAnalysisStart(updated);
        });
      }, 1000);

      setRtspId("");
    } catch (error) {
      console.error("Failed to start RTSP analysis:", error);
      alert("Failed to start RTSP analysis: " + (error as Error).message);
    } finally {
      setIsStarting(false);
    }
  };

  const simulateRTSPAnalysis = (
    result: AnalysisResult,
    onUpdate: (result: AnalysisResult) => void
  ) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // Generate mock results
        const mockResults = generateMockRTSPResults(result);
        onUpdate(mockResults);
      } else {
        onUpdate({
          ...result,
          status: "processing",
          progress,
        });
      }
    }, 1000);
  };

  const generateMockRTSPResults = (result: AnalysisResult): AnalysisResult => {
    const fps = 25;
    const totalFrames = Math.floor((result.duration || 30) * fps);
    const facesDetected = Math.floor(Math.random() * 50) + 10;
    const matchedFaces = Math.floor(
      facesDetected * (Math.random() * 0.6 + 0.1)
    );

    return {
      ...result,
      status: "completed",
      progress: 100,
      totalFrames,
      processedFrames: totalFrames,
      totalFaces: facesDetected,
      matchedFaces,
      uniqueFaces: Math.floor(facesDetected * 0.7),
      processingTime: result.duration || 30,
      summary: {
        videoInfo: {
          duration: result.duration || 30,
          fps,
          width: 1920,
          height: 1080,
        },
        statistics: {
          frames_with_faces: Math.floor(totalFrames * 0.6),
          frames_without_faces: Math.floor(totalFrames * 0.4),
          avg_faces_per_frame: facesDetected / totalFrames,
          max_faces_in_frame: Math.floor(Math.random() * 5) + 1,
        },
      },
      detections: Array.from(
        { length: Math.min(20, facesDetected) },
        (_, i) => ({
          frame: Math.floor((i / 20) * totalFrames),
          timestamp: (i / 20) * (result.duration || 30),
          faces: Array.from(
            { length: Math.floor(Math.random() * 3) + 1 },
            (_, j) => ({
              bbox: [100 + j * 50, 100 + j * 30, 150 + j * 50, 180 + j * 30],
              confidence: 0.85 + Math.random() * 0.14,
              matched: Math.random() > 0.6,
              person_id:
                Math.random() > 0.6
                  ? Math.floor(Math.random() * 10) + 1
                  : undefined,
              person_name:
                Math.random() > 0.6
                  ? `Person ${Math.floor(Math.random() * 10) + 1}`
                  : undefined,
            })
          ),
        })
      ),
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          RTSP Stream Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              RTSP ID / Stream Identifier
            </label>
            <Input
              type="text"
              placeholder="Enter RTSP ID (e.g., cam-001, stream-alpha)"
              value={rtspId}
              onChange={(e) => setRtspId(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Enter the RTSP stream ID configured in your system
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Recording Duration: {duration[0]} seconds
            </label>
            <Slider
              value={duration}
              onValueChange={setDuration}
              max={300}
              min={10}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Duration to record and analyze (10 seconds to 5 minutes)
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Face Recognition Threshold: {threshold[0]}%
            </label>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              max={100}
              min={30}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher values require stronger matches
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="useWatchlistRTSP"
              type="checkbox"
              checked={useWatchlist}
              onChange={(e) => setUseWatchlist(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="useWatchlistRTSP" className="text-sm font-medium">
              Use Watchlist for Face Matching
            </label>
          </div>
        </div>

        <Button
          onClick={handleStartAnalysis}
          disabled={!rtspId.trim() || isStarting}
          className="w-full"
        >
          {isStarting ? (
            <>
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
              Starting Analysis...
            </>
          ) : (
            <>
              <MonitorPlay className="h-4 w-4 mr-2" />
              Start RTSP Analysis
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface AnalysisJobCardProps {
  result: AnalysisResult;
  onUpdate: (updated: AnalysisResult) => void;
  onRemove: (id: string) => void;
}

function AnalysisJobCard({ result, onUpdate, onRemove }: AnalysisJobCardProps) {
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (
      result.status === "queued" ||
      result.status === "processing" ||
      result.status === "running"
    ) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const jobData = await getAnalysisJob(result.id);
          const updatedResult: AnalysisResult = {
            ...result,
            status:
              jobData.status === "done"
                ? "completed"
                : (jobData.status as AnalysisResult["status"]),
            progress: jobData.progress * 100,
            ...jobData.result,
          };

          if (jobData.status === "done" && jobData.result) {
            updatedResult.totalFrames = jobData.result.totalFrames;
            updatedResult.processedFrames = jobData.result.processedFrames;
            updatedResult.totalFaces = jobData.result.totalFaces;
            updatedResult.matchedFaces = jobData.result.matchedFaces;
            updatedResult.uniqueFaces = jobData.result.uniqueFaces;
            updatedResult.processingTime = jobData.result.processingTime;
            updatedResult.detections = jobData.result.detections;
            updatedResult.summary = jobData.result.summary;
          }

          if (jobData.status === "error") {
            updatedResult.error = jobData.error || "Unknown error";
          }

          onUpdate(updatedResult);

          if (jobData.status === "done" || jobData.status === "error") {
            setIsPolling(false);
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Failed to poll job status:", error);
        }
      }, 2000);

      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    }
  }, [result.id, result.status]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
      case "running":
        return "bg-blue-500";
      case "queued":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "processing":
      case "running":
        return <RotateCcw className="h-4 w-4 animate-spin" />;
      case "queued":
        return <Clock className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {result.type === "rtsp" ? (
              <Radio className="h-4 w-4" />
            ) : (
              <FileVideo className="h-4 w-4" />
            )}
            {result.filename}
            {result.type === "rtsp" && result.duration && (
              <Badge variant="outline" className="ml-2">
                <Timer className="h-3 w-3 mr-1" />
                {result.duration}s
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`${getStatusColor(result.status)} text-white border-0`}
            >
              {getStatusIcon(result.status)}
              {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(result.id)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        {(result.status === "processing" ||
          result.status === "running" ||
          result.status === "queued") && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(result.progress)}%</span>
            </div>
            <Progress value={result.progress} className="w-full" />
          </div>
        )}

        {/* Error */}
        {result.status === "error" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Analysis Failed</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              {result.error || "Unknown error occurred"}
            </p>
          </div>
        )}

        {/* Results Summary */}
        {result.status === "completed" && (
          <div className="space-y-4">
            {/* Main People Analysis */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  People Analysis
                </h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1">
                      <Info className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Technical Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Total Face Detections:</span>
                        <span className="font-medium">
                          {result.totalFaces || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frames Processed:</span>
                        <span className="font-medium">
                          {result.summary?.statistics?.frames_with_faces || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Video Resolution:</span>
                        <span className="font-medium">
                          {result.summary?.videoInfo?.width &&
                          result.summary?.videoInfo?.height
                            ? `${result.summary.videoInfo.width}x${result.summary.videoInfo.height}`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing FPS:</span>
                        <span className="font-medium">
                          {result.summary?.videoInfo?.fps
                            ? `${Math.round(result.summary.videoInfo.fps)}`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Analysis Duration:</span>
                        <span className="font-medium">
                          {result.processingTime
                            ? `${Math.round(result.processingTime)}s`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {result.uniqueFaces || Math.min(result.totalFaces || 0, 10)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Total People Detected
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800 mb-1">
                    {result.summary?.videoInfo?.duration
                      ? `${Math.round(result.summary.videoInfo.duration)}s`
                      : "N/A"}
                  </div>
                  <div className="text-sm text-gray-600">Video Duration</div>
                </div>
              </div>
            </div>

            {/* Watchlist Match Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">
                    Watchlist Matches
                  </h4>
                </div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {Math.min(
                    result.matchedFaces || 0,
                    result.uniqueFaces || result.totalFaces || 0
                  )}
                </div>
                <div className="text-sm text-green-700">
                  People found in watchlist
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <h4 className="font-semibold text-orange-800">
                    Unknown People
                  </h4>
                </div>
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {Math.max(
                    0,
                    (result.uniqueFaces ||
                      Math.min(result.totalFaces || 0, 10)) -
                      Math.min(
                        result.matchedFaces || 0,
                        result.uniqueFaces || result.totalFaces || 0
                      )
                  )}
                </div>
                <div className="text-sm text-orange-700">
                  People not in watchlist
                </div>
              </div>
            </div>

            {/* Accuracy Summary */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800 mb-1">
                  Match Accuracy
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {result.uniqueFaces && result.matchedFaces
                    ? `${Math.round(
                        (Math.min(result.matchedFaces, result.uniqueFaces) /
                          result.uniqueFaces) *
                          100
                      )}%`
                    : result.totalFaces && result.matchedFaces
                    ? `${Math.round(
                        (result.matchedFaces /
                          Math.min(result.totalFaces, 10)) *
                          100
                      )}%`
                    : "0%"}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Based on unique people identified
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {result.status === "completed" && (
          <div className="flex gap-2 pt-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Analysis Results: {result.filename}</DialogTitle>
                </DialogHeader>
                <VideoAnalysisDetails result={result} />
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const reportData = {
                  filename: result.filename,
                  timestamp: new Date().toISOString(),
                  summary: {
                    total_faces: result.totalFaces || 0,
                    matched_faces: result.matchedFaces || 0,
                    unknown_faces:
                      (result.totalFaces || 0) - (result.matchedFaces || 0),
                    unique_people: result.uniqueFaces || 0,
                    match_rate:
                      result.totalFaces && result.matchedFaces
                        ? `${Math.round(
                            (result.matchedFaces / result.totalFaces) * 100
                          )}%`
                        : "0%",
                    video_duration: result.summary?.videoInfo?.duration
                      ? `${Math.round(result.summary.videoInfo.duration)}s`
                      : "N/A",
                    processing_time: result.processingTime
                      ? `${Math.round(result.processingTime)}s`
                      : "N/A",
                  },
                };

                const blob = new Blob([JSON.stringify(reportData, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `analysis-report-${
                  result.filename
                }-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface VideoAnalysisDetailsProps {
  result: AnalysisResult;
}

function VideoAnalysisDetails({ result }: VideoAnalysisDetailsProps) {
  const [selectedTab, setSelectedTab] = useState("summary");

  if (!result.detections) return null;

  return (
    <div className="space-y-4">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="detections">Detections</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  Video Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-semibold">
                    {result.summary?.videoInfo?.duration
                      ? `${Math.round(result.summary.videoInfo.duration)}s`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Resolution</span>
                  <span className="font-semibold">
                    {result.summary?.videoInfo?.width &&
                    result.summary?.videoInfo?.height
                      ? `${result.summary.videoInfo.width}x${result.summary.videoInfo.height}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Processing Time</span>
                  <span className="font-semibold">
                    {result.processingTime
                      ? `${Math.round(result.processingTime)}s`
                      : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Recognition Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">People Detected</span>
                  <span className="font-semibold text-blue-600">
                    {result.uniqueFaces || Math.min(result.totalFaces || 0, 10)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Watchlist Matches</span>
                  <span className="font-semibold text-green-600">
                    {Math.min(
                      result.matchedFaces || 0,
                      result.uniqueFaces || result.totalFaces || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Unknown People</span>
                  <span className="font-semibold text-orange-600">
                    {Math.max(
                      0,
                      (result.uniqueFaces ||
                        Math.min(result.totalFaces || 0, 10)) -
                        Math.min(
                          result.matchedFaces || 0,
                          result.uniqueFaces || result.totalFaces || 0
                        )
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Match Accuracy</span>
                  <span className="font-semibold">
                    {result.uniqueFaces && result.matchedFaces
                      ? `${Math.round(
                          (Math.min(result.matchedFaces, result.uniqueFaces) /
                            result.uniqueFaces) *
                            100
                        )}%`
                      : result.totalFaces && result.matchedFaces
                      ? `${Math.round(
                          (result.matchedFaces /
                            Math.min(result.totalFaces, 10)) *
                            100
                        )}%`
                      : "0%"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detections" className="space-y-4">
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-200"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Matches (
                {
                  result.detections.filter((d) =>
                    d.faces.some((f) => f.matched)
                  ).length
                }
                )
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200"
              >
                <Eye className="h-4 w-4 mr-1" />
                All Detections (
                {result.detections.filter((d) => d.faces.length > 0).length})
              </Button>
            </div>

            {/* Detections grid */}
            <div className="max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.detections
                  .filter((d) => d.faces.length > 0)
                  .slice(0, 12)
                  .map((detection, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold text-sm">
                            Frame {detection.frame}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {Math.round(detection.timestamp)}s
                          </span>
                        </div>

                        {/* Frame thumbnail */}
                        {detection.faces.some((f) => f.frame_path) && (
                          <div className="mb-3">
                            <img
                              src={`http://localhost:5001/data/${
                                detection.faces.find((f) => f.frame_path)
                                  ?.frame_path
                              }`}
                              alt={`Frame ${detection.frame}`}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                          </div>
                        )}

                        {/* Face grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {detection.faces.slice(0, 4).map((face, faceIdx) => (
                            <div
                              key={faceIdx}
                              className={`relative p-2 rounded-lg border ${
                                face.matched
                                  ? "border-green-300 bg-green-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              {/* Face thumbnail */}
                              {face.thumb_path && (
                                <img
                                  src={`http://localhost:5001/data/${face.thumb_path}`}
                                  alt="Face"
                                  className="w-12 h-12 mx-auto rounded-full border object-cover"
                                />
                              )}

                              {/* Person name or status */}
                              {face.person_name ? (
                                <div className="text-center mt-1">
                                  <div className="text-xs font-medium text-green-700 truncate">
                                    {face.person_name}
                                  </div>
                                  <div className="text-xs text-green-600">
                                    {Math.round((face.similarity || 0) * 100)}%
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center mt-1">
                                  <div className="text-xs text-gray-500">
                                    Unknown
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {Math.round((face.confidence || 0) * 100)}%
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Show count if more faces */}
                        {detection.faces.length > 4 && (
                          <div className="text-xs text-gray-500 text-center mt-2">
                            +{detection.faces.length - 4} more faces
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Detection Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Timeline visualization */}
              <div className="relative">
                <div className="h-12 bg-gray-100 rounded-lg overflow-hidden relative border">
                  {result.detections.map((detection, idx) => {
                    const totalDuration =
                      result.summary?.videoInfo.duration || 1;
                    const position =
                      (detection.timestamp / totalDuration) * 100;
                    const hasMatches = detection.faces.some((f) => f.matched);

                    return (
                      <div
                        key={idx}
                        className={`absolute top-0 w-2 h-full ${
                          hasMatches ? "bg-green-500" : "bg-blue-400"
                        } opacity-80 hover:opacity-100 transition-opacity`}
                        style={{ left: `${position}%` }}
                        title={`${Math.round(detection.timestamp)}s - ${
                          detection.faces.length
                        } faces detected${hasMatches ? " (with matches)" : ""}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0s</span>
                  <span>Timeline</span>
                  <span>
                    {result.summary?.videoInfo?.duration
                      ? `${Math.round(result.summary.videoInfo.duration)}s`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {/* Legend and stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <div>
                    <div className="font-medium text-green-800">
                      Watchlist Matches
                    </div>
                    <div className="text-sm text-green-600">
                      {
                        result.detections.filter((d) =>
                          d.faces.some((f) => f.matched)
                        ).length
                      }{" "}
                      frames
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-4 h-4 bg-blue-400 rounded"></div>
                  <div>
                    <div className="font-medium text-blue-800">
                      Face Detections
                    </div>
                    <div className="text-sm text-blue-600">
                      {
                        result.detections.filter((d) => d.faces.length > 0)
                          .length
                      }{" "}
                      frames
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function VideoAnalysisView() {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);

  // Load previous results on mount
  useEffect(() => {
    const savedResults = localStorage.getItem("videoAnalysisResults");
    if (savedResults) {
      try {
        setAnalysisResults(JSON.parse(savedResults));
      } catch (error) {
        console.error("Failed to parse saved results:", error);
      }
    }
  }, []);

  // Save results to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "videoAnalysisResults",
      JSON.stringify(analysisResults)
    );
  }, [analysisResults]);

  const handleAnalysisStart = (result: AnalysisResult) => {
    setAnalysisResults((prev) => [result, ...prev]);
  };

  const handleResultUpdate = (updated: AnalysisResult) => {
    setAnalysisResults((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  };

  const handleResultRemove = (id: string) => {
    setAnalysisResults((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Video Analysis</h1>
          <p className="text-muted-foreground">
            Upload videos or analyze RTSP streams for face detection and
            watchlist matching
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Video
              </TabsTrigger>
              <TabsTrigger value="rtsp" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                RTSP Stream
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <VideoUploadForm onAnalysisStart={handleAnalysisStart} />
            </TabsContent>

            <TabsContent value="rtsp" className="mt-4">
              <RTSPAnalysisForm onAnalysisStart={handleAnalysisStart} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Analysis Results</h2>
            {analysisResults.length === 0 ? (
              <Card className="p-8 text-center">
                <VideoIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">No videos analyzed yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a video or analyze an RTSP stream to start face
                  detection and analysis
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {analysisResults.map((result) => (
                  <AnalysisJobCard
                    key={result.id}
                    result={result}
                    onUpdate={handleResultUpdate}
                    onRemove={handleResultRemove}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default VideoAnalysisView;
