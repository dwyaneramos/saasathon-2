const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 25 * 60 * 1000
// A flaky tunnel/proxy can drop one request without the underlying job being affected
// at all - only give up after several polls in a row fail, not on the first blip.
const MAX_CONSECUTIVE_POLL_FAILURES = 20
const MAX_START_ATTEMPTS = 3

type JobBody<T> = { status: 'pending' } | { status: 'done'; result: T } | { status: 'error'; error: string }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorFrom(body: unknown, fallback: string): Error {
  const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : null
  return new Error(message ?? fallback)
}

/**
 * Starts a background job (a request that would otherwise be held open far too long
 * to survive a flaky tunnel/proxy) and polls for its result instead of waiting on one
 * long response. Tolerates transient poll failures - the job keeps running server-side
 * regardless of whether any one poll request makes it through.
 */
export async function runPolledJob<T>(
  startRequest: () => Promise<Response>,
  jobIdFrom: (startBody: unknown) => string,
  pollUrl: (jobId: string) => string,
): Promise<T> {
  let startRes: Response | null = null
  let startErr: unknown = null
  for (let attempt = 0; attempt < MAX_START_ATTEMPTS && !startRes; attempt++) {
    if (attempt > 0) await sleep(1000)
    try {
      startRes = await startRequest()
    } catch (err) {
      startErr = err
    }
  }
  if (!startRes) throw startErr instanceof Error ? startErr : new Error('could not reach the server to start the job')

  const startBody: unknown = await startRes.json().catch(() => null)
  if (!startRes.ok) throw errorFrom(startBody, `failed to start (${startRes.status})`)
  const jobId = jobIdFrom(startBody)

  const deadline = Date.now() + MAX_WAIT_MS
  let consecutiveFailures = 0
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    let pollRes: Response
    try {
      pollRes = await fetch(pollUrl(jobId))
    } catch {
      // A dropped connection (e.g. the tunnel reconnecting) - retry rather than
      // failing the whole operation.
      if (++consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error('lost connection while waiting for this to finish - try again')
      }
      continue
    }

    // The job id is genuinely gone (expired, or the server restarted) - no point retrying.
    if (pollRes.status === 404) {
      throw new Error('the job was lost (the server may have restarted) - try again')
    }

    if (!pollRes.ok) {
      if (++consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        const body: unknown = await pollRes.json().catch(() => null)
        throw errorFrom(body, `status check failed (${pollRes.status})`)
      }
      continue
    }
    consecutiveFailures = 0

    const job = (await pollRes.json().catch(() => null)) as JobBody<T> | null
    if (!job) continue
    if (job.status === 'pending') continue
    if (job.status === 'error') throw new Error(job.error)
    return job.result
  }

  throw new Error('timed out waiting for this to finish')
}
