import { randomUUID } from 'node:crypto';
import { zodTextFormat } from 'openai/helpers/zod';
import { Router } from 'express';
import { z } from 'zod';
import { EXTRACT_MODEL, getOpenAI, refusalReason } from '../pipeline/client.js';

const ComponentKind = z.enum([
  'socket',
  'double-socket',
  'switch',
  'two-way-switch',
  'light',
  'downlight',
  'switchboard',
  'junction-box',
]);

const DetectedComponent = z.object({
  kind: ComponentKind,
  x: z.number().describe('Pixel x-coordinate in the source image, at its native resolution.'),
  y: z.number().describe('Pixel y-coordinate in the source image, at its native resolution.'),
  confidence: z.number().min(0).max(1),
});

const DetectedWire = z.object({
  points: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .min(2)
    .describe('Ordered points tracing the drawn line, at the image native resolution.'),
  confidence: z.number().min(0).max(1),
});

const ScaleInference = z.object({
  metres_per_pixel: z
    .number()
    .nullable()
    .describe('Null when no measurement is legible on the plan - never guess this.'),
  evidence: z
    .string()
    .nullable()
    .describe('What on the plan justifies the scale (a dimension line, a stated length, a scale bar). Null when metres_per_pixel is null.'),
  confidence: z.number().min(0).max(1),
});

const DetectionResult = z.object({
  components: z.array(DetectedComponent),
  wires: z.array(DetectedWire),
  scale: ScaleInference,
});

const INSTRUCTIONS = `You read New Zealand residential/commercial electrical floor plans.

Identify every electrical symbol on the attached image matching one of these kinds, by their
conventional floor-plan symbol:
- socket / double-socket: a small rectangle with one or two pairs of vertical prong lines
- switch / two-way-switch: a small circle with one (or two) short diagonal flick lines
- light: a circle with a cross/X through it
- downlight: a circle with a smaller filled circle inside it
- switchboard: a labelled rectangle (often "DB" or "SB"), usually with a triangular fill mark
- junction-box: a small labelled box, distinct from a switchboard

Report each symbol's pixel position (x, y) at the image's native resolution (given below). Never
invent a component that isn't actually drawn - if a mark is ambiguous, either leave it out or
include it with low confidence rather than guessing its kind.

Also identify every wire/circuit path actually drawn on the plan - typically a dashed or dash-dot
line connecting a switch to a light, or a socket/circuit run back to the switchboard. Check the
plan's own legend if it has one, for its exact line conventions. Report each as an ordered list of
points (x, y) tracing its drawn path at the image's native resolution, from one end to the other.
Do not invent a connection that isn't actually drawn as a line - two components simply being near
each other is not evidence of a wire between them.

Also look for any explicit real-world measurement on the plan: a dimension line with a length
label, a printed scale (e.g. "1:100"), a scale bar, or a stated room/wall length. If you find one,
compute metres_per_pixel from it and name the evidence. If nothing on the plan states a real
measurement, return metres_per_pixel: null and evidence: null - never assume a standard scale.`;

const requestSchema = z.object({
  dataUrl: z.string().startsWith('data:image/'),
  width: z.number().positive(),
  height: z.number().positive(),
});

type Job =
  | { status: 'pending' }
  | { status: 'done'; result: z.infer<typeof DetectionResult> }
  | { status: 'error'; error: string };

// In-memory only - fine for a single-instance dev/hackathon deploy. Each job is cleared a
// few minutes after it finishes so this never grows unbounded.
const jobs = new Map<string, Job>();
const JOB_TTL_MS = 5 * 60 * 1000;

async function runDetection(jobId: string, dataUrl: string, width: number, height: number) {
  try {
    const stream = getOpenAI().responses.stream({
      model: EXTRACT_MODEL,
      instructions: INSTRUCTIONS,
      max_output_tokens: 16000,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
            { type: 'input_text', text: `Image native size: ${width} x ${height} px.` },
          ],
        },
      ],
      text: { format: zodTextFormat(DetectionResult, 'drawing_detection') },
    });

    const response = await stream.finalResponse();

    if (!response.output_parsed) {
      const refusal = refusalReason(response.output);
      jobs.set(jobId, {
        status: 'error',
        error: refusal ? `detection refused: ${refusal}` : `detection returned no parsable output (status: ${response.status})`,
      });
    } else {
      jobs.set(jobId, { status: 'done', result: response.output_parsed });
    }
  } catch (err) {
    jobs.set(jobId, { status: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref();
  }
}

const router = Router();

// Starts the (slow - often 30-60s) vision call in the background and returns immediately.
// A single request held open that long doesn't survive every proxy/tunnel in front of this
// server, so the client polls GET /detect/:jobId instead of waiting on one long response.
router.post('/detect', (req, res) => {
  const body = requestSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'expected { dataUrl, width, height }' });
    return;
  }

  const jobId = randomUUID();
  jobs.set(jobId, { status: 'pending' });
  void runDetection(jobId, body.data.dataUrl, body.data.width, body.data.height);
  res.status(202).json({ jobId });
});

router.get('/detect/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'unknown or expired job id' });
    return;
  }
  res.json(job);
});

export default router;
