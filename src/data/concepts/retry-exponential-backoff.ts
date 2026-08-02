import type { Concept } from './types'

const concept: Concept = {
  slug: 'retry-exponential-backoff',
  title: 'Retry and Exponential Backoff',
  number: 35,
  category: 'Patterns & Architecture',
  icon: 'pi pi-undo',
  summary: 'Jitter - retrying failed calls without turning a hiccup into a self-inflicted DDoS.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Naive retries - immediately re-sending a failed request - work fine for a single client hitting a single blip. The problem shows up at scale: if a service has a brief outage and thousands of clients were mid-request when it happened, they all fail at roughly the same moment and, with no delay, all retry at roughly the same moment too. The recovering service gets hit with a wall of traffic the instant it comes back up, which can knock it back over. This is a \"retry storm,\" and it is a self-inflicted denial-of-service caused entirely by well-meaning retry logic.",
    },
    {
      type: 'heading',
      text: 'Exponential Backoff',
    },
    {
      type: 'paragraph',
      text:
        'The fix is to wait progressively longer between each retry attempt instead of retrying immediately, so that a persistent failure backs off aggressively rather than hammering the target at a constant rate.',
    },
    {
      type: 'table',
      caption: 'Example Backoff Schedule (base = 1s, cap = 8s)',
      headers: ['Attempt', 'Delay before this attempt'],
      rows: [
        ['1st retry', '1s'],
        ['2nd retry', '2s'],
        ['3rd retry', '4s'],
        ['4th retry', '8s (capped)'],
      ],
    },
    {
      type: 'heading',
      text: 'Jitter',
    },
    {
      type: 'paragraph',
      text:
        "Plain exponential backoff alone doesn't fully fix the retry-storm problem: if every client that failed at the same moment computes the exact same delay schedule, they all retry in lockstep at the same instants, just spaced further apart. Jitter adds a small random amount to each delay so that clients spread their retries out over time instead of synchronizing. The common \"full jitter\" formula is:",
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Full jitter backoff',
      code: `delay = random(0, min(cap, base * 2^attempt))`,
    },
    {
      type: 'table',
      caption: 'Retriable vs Non-Retriable Errors',
      headers: ['Category', 'Examples', 'Why'],
      rows: [
        ['Retriable', 'Request timeout, 503 Service Unavailable, connection reset', 'These indicate a transient condition on the server or network - the same request has a real chance of succeeding shortly after.'],
        ['Non-retriable', '400 Bad Request, 401/403 auth errors, 404 Not Found', 'The problem is the request itself (or the caller\'s permissions), not a transient server condition - retrying wastes calls and adds load without any chance of a different outcome, since nothing about the input changed.'],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Blind retries are only safe when the operation is idempotent',
      text:
        "Automating retries assumes that running the operation more than once is harmless. If the first attempt actually succeeded server-side but the response was lost or slow to arrive, an automatic retry duplicates the side effect - a double charge, a duplicate order. Retry logic and idempotency are a matched pair: see Idempotency for the mechanism (idempotency keys) that makes the retry side of this safe.",
    },
  ],
  relatedConcepts: ['idempotency', 'circuit-breaker', 'durable-execution'],
}

export default concept
