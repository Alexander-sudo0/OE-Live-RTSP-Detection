// Minimal client helpers to talk to Mizva Flask backend
// Configure base URL via NEXT_PUBLIC_MIZVA_URL or pass explicitly

export const MIZVA_URL = process.env.NEXT_PUBLIC_MIZVA_URL || "http://localhost:5001";

export type JobRecord = {
  id: string
  type: string
  status: "queued" | "running" | "done" | "error"
  progress: number
  payload?: unknown
  result?: any
  error?: string | null
}

export async function compareImages(file1: File, file2: File, threshold?: number, baseUrl = MIZVA_URL) {
  const fd = new FormData()
  fd.append("file1", file1)
  fd.append("file2", file2)
  if (threshold != null) fd.append("threshold", String(threshold))
  const res = await fetch(`${baseUrl}/api/compare`, { method: "POST", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function startPicToVideo(known: File, video: File, threshold?: number, baseUrl = MIZVA_URL) {
  const fd = new FormData()
  fd.append("known", known)
  fd.append("video", video)
  if (threshold != null) fd.append("threshold", String(threshold))
  const res = await fetch(`${baseUrl}/api/recognize/pic-to-video`, { method: "POST", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ job_id: string; status: string }>
}

export async function getJob(jobId: string, baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/jobs/${jobId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<JobRecord>
}

export async function rtspStart(
  params: {
    id?: string
    url: string
    known?: File
    threshold?: number
    fps?: number
    transport?: 'tcp' | 'udp'
    timeoutMs?: number
    name?: string
    mode?: 'single' | 'watchlist'
  },
  baseUrl = MIZVA_URL,
) {
  const fd = new FormData()
  if (params.id) fd.append("id", params.id)
  fd.append("url", params.url)
  if (params.name) fd.append("name", params.name)
  if (params.mode) fd.append("mode", params.mode)
  if (params.known) fd.append("known", params.known)
  if (params.threshold != null) fd.append("threshold", String(params.threshold))
  if (params.fps != null) fd.append("fps", String(params.fps))
  if (params.transport) fd.append("transport", params.transport)
  if (params.timeoutMs != null) fd.append("timeout_ms", String(params.timeoutMs))
  const res = await fetch(`${baseUrl}/api/rtsp/start`, { method: "POST", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ id: string; status: string }>
}

export async function rtspStop(id: string, baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/rtsp/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ id: string; status: string }>
}

export async function rtspStatus(id: string, baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/rtsp/status/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ id: string; status: string; last_seen: number; matches_count: number; last_error: string | null; last_confidence?: number }>
}

export function connectRtspEvents(id: string, onEvent: (e: any) => void, baseUrl = MIZVA_URL): EventSource {
  const src = new EventSource(`${baseUrl}/api/rtsp/events/${id}`)
  src.addEventListener("rtsp_match", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data)
      onEvent(data)
    } catch {}
  })
  return src
}

export function snapshotUrl(id: string, baseUrl = MIZVA_URL) {
  return `${baseUrl}/api/rtsp/snapshot/${id}`
}

export function streamUrl(id: string, baseUrl = MIZVA_URL) {
  return `${baseUrl}/api/rtsp/stream/${id}`
}

export async function listCameras(baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/cameras`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function cleanupCameras(baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/cameras/cleanup`, { method: "POST" })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteCamera(id: string, baseUrl = MIZVA_URL) {
  const res = await fetch(`${baseUrl}/api/cameras/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
