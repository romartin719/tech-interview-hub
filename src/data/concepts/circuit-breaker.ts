import type { Concept } from './types'

const concept: Concept = {
  slug: 'circuit-breaker',
  title: 'Circuit Breaker Pattern',
  number: 33,
  category: 'Patterns & Architecture',
  icon: 'pi pi-bolt',
  summary: 'Fail Fast, Fallback - stop calling a downstream service that is already drowning.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "A circuit breaker wraps a call to a downstream dependency and watches its recent failure rate. Once failures cross a threshold, the breaker \"opens\" and starts failing calls immediately, without even attempting the network call, instead of letting every caller wait out a slow timeout against a service that is already struggling. It is the same idea as an electrical circuit breaker: trip early to stop a local problem from becoming a fire.",
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Closed -> Open -> Half-Open',
        mermaid: `stateDiagram-v2
  [*] --> Closed
  Closed --> Open: failure rate crosses threshold
  Open --> HalfOpen: cooldown timer elapses
  HalfOpen --> Closed: trial calls succeed
  HalfOpen --> Open: trial calls fail
  Closed --> Closed: calls flow through, failures counted`,
      },
    },
    {
      type: 'table',
      caption: 'The Three States',
      headers: ['State', 'Behavior'],
      rows: [
        ['Closed', 'Normal operation. Calls flow through to the downstream service; the breaker counts successes and failures in a rolling window.'],
        ['Open', 'Calls fail immediately (a local exception or fallback), with no attempt to reach the downstream service. This protects the caller from tying up threads/connections on a doomed call, and gives the downstream service breathing room to recover instead of piling on more load.'],
        ['Half-Open', 'After a cooldown, a small number of trial calls are let through. If they succeed, the breaker closes and traffic resumes normally; if they fail, it reopens and the cooldown starts again.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Fail fast is a feature, not a shortcut',
      text:
        "Without a circuit breaker, a struggling downstream service keeps receiving the exact same load, plus every caller's threads and connections now sit stuck waiting on slow timeouts instead of failing quickly. That resource exhaustion propagates upward: callers of the caller start timing out too, and one slow dependency cascades into an outage several layers away. Failing fast locally is what stops the cascade.",
    },
    {
      type: 'table',
      caption: 'Typical Tunables',
      headers: ['Setting', 'What it controls'],
      rows: [
        ['Failure threshold %', 'The error rate (e.g. 50% of calls failing) within the rolling window that trips the breaker from Closed to Open.'],
        ['Request volume threshold', 'A minimum number of calls that must occur in the window before the failure rate is even evaluated - avoids tripping on 2 failures out of 3 total requests.'],
        ['Cooldown duration', 'How long the breaker stays Open before allowing a Half-Open trial (e.g. 30 seconds).'],
        ['Half-Open trial count', 'How many test calls are allowed through in Half-Open before deciding to close or reopen - usually a small number like 1-5.'],
      ],
    },
    {
      type: 'list',
      items: [
        'Netflix Hystrix - the pattern that popularized circuit breakers in microservices; now in maintenance mode, but its concepts live on in successors.',
        'Resilience4j - the modern JVM successor to Hystrix; lightweight, composable with retries, rate limiters, and bulkheads.',
        "Envoy - has circuit breaking built into its proxy layer, so it can be applied at the infrastructure level without any application code changes.",
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'A breaker without a fallback just moves the failure',
      text:
        "Opening the circuit only stops wasted calls - it doesn't answer the user's request. Always pair a circuit breaker with a sensible fallback: a cached or default response, a degraded version of the feature, or a queued retry for later. Surfacing a raw \"fail fast\" error to the end user is rarely acceptable on its own; the breaker should buy you time to serve something reasonable instead.",
    },
  ],
  relatedConcepts: ['retry-exponential-backoff', 'idempotency', 'load-balancing'],
}

export default concept
