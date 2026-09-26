import type { ComponentKind, Point } from '../types/drawing'

export interface DetectedComponent {
  kind: ComponentKind
  x: number
  y: number
  confidence: number
}

export interface DetectedWire {
  points: Point[]
  confidence: number
}

export interface DrawingDetectionResult {
  components: DetectedComponent[]
  wires: DetectedWire[]
  metresPerPx: number | null
  scaleEvidence: string | null
  scaleConfidence: number
}

interface DetectResultBody {
  components: DetectedComponent[]
  wires: DetectedWire[]
  scale: { metres_per_pixel: number | null; evidence: string | null; confidence: number }
}

type JobStatus =
  | { status: 'pending' }
  | { status: 'done'; result: DetectResultBody }
  | { status: 'error'; error: string }

const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 5 * 60 * 1000
// A flaky tunnel/proxy can drop one request without the underlying job being affected at
// all - only give up after several polls in a row fail, not on the first blip. Quick
// tunnels can have connection gaps of several seconds while reconnecting, so this is
// generous (~40s of grace) rather than just covering a single blip.
const MAX_CONSECUTIVE_POLL_FAILURES = 20

function errorFrom(body: unknown, fallback: string): Error {
  const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : null
  return new Error(message ?? fallback)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// The vision call itself often takes 30-60s - a single request held open that long
// doesn't reliably survive every proxy/tunnel in front of the dev server, so this starts
// a background job and polls for the result instead of waiting on one long response.
export async function detectDrawing(
  dataUrl: string,
  width: number,
  height: number,
): Promise<DrawingDetectionResult> {
  let startRes: Response | null = null
  let startErr: unknown = null
  for (let attempt = 0; attempt < 3 && !startRes; attempt++) {
    if (attempt > 0) await sleep(1000)
    try {
      startRes = await fetch('/api/drawing/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, width, height }),
      })
    } catch (err) {
      startErr = err
    }
  }
  if (!startRes) throw startErr instanceof Error ? startErr : new Error('could not reach the server to start detection')

  const startBody: unknown = await startRes.json().catch(() => null)
  if (!startRes.ok) throw errorFrom(startBody, `detection failed to start (${startRes.status})`)
  const { jobId } = startBody as { jobId: string }

  const deadline = Date.now() + MAX_WAIT_MS
  let consecutiveFailures = 0
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    let pollRes: Response
    try {
      pollRes = await fetch(`/api/drawing/detect/${jobId}`)
    } catch {
      // A dropped connection (e.g. the tunnel reconnecting) - the job keeps running
      // server-side regardless, so retry rather than failing the whole detection.
      if (++consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error('lost connection while waiting for detection to finish - try again')
      }
      continue
    }

    // The job id is genuinely gone (expired, or the server restarted) - no point retrying.
    if (pollRes.status === 404) {
      throw new Error('detection job was lost (the server may have restarted) - try uploading again')
    }

    if (!pollRes.ok) {
      if (++consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        const body: unknown = await pollRes.json().catch(() => null)
        throw errorFrom(body, `detection status check failed (${pollRes.status})`)
      }
      continue
    }
    consecutiveFailures = 0

    const pollBody: unknown = await pollRes.json().catch(() => null)
    const job = pollBody as JobStatus
    if (job.status === 'pending') continue
    if (job.status === 'error') throw new Error(job.error)

    return {
      components: job.result.components,
      wires: job.result.wires,
      metresPerPx: job.result.scale.metres_per_pixel,
      scaleEvidence: job.result.scale.evidence,
      scaleConfidence: job.result.scale.confidence,
    }
  }

  throw new Error('detection timed out')
}
