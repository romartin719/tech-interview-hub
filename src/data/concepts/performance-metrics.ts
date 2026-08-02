import type { Concept } from './types'

const concept: Concept = {
  slug: 'performance-metrics',
  title: 'Performance Metrics',
  number: 42,
  category: 'Performance & Operations',
  icon: 'pi pi-chart-line',
  summary: "p99, Little's Law, SLO - the numbers that actually describe whether a system is \"fast enough\".",
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A mean latency of 50ms sounds fine, but it can hide a p99 of 2000ms if even a small fraction of requests are very slow. Averages are pulled toward the bulk of fast requests and quietly bury the tail - and that slow tail is exactly what real users notice, remember, and complain about. Talking about system performance in interviews means talking about percentiles, not averages.',
    },
    {
      type: 'table',
      caption: 'Percentiles - What Each One Tells You',
      headers: ['Percentile', 'Meaning'],
      rows: [
        ['p50 (median)', 'The typical experience - half of requests are faster, half are slower.'],
        ['p90', 'The experience for most users - 9 out of 10 requests are at least this fast.'],
        ['p99', 'The "long tail" - 1% of requests are slower than this. Often what SLOs are written against.'],
        ['p99.9', 'Matters enormously at high request volume - 0.1% of a billion requests is a million bad experiences.'],
      ],
    },
    {
      type: 'heading',
      text: "Little's Law",
    },
    {
      type: 'paragraph',
      text:
        "Little's Law states that, at steady state, the average number of requests in a system equals the average arrival rate times the average time each request spends in the system: L = λ × W.",
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Worked example',
      code:
        'λ (arrival rate) = 100 requests/sec\nW (time in system) = 200ms = 0.2 sec\n\nL = λ × W = 100 × 0.2 = 20\n\n-> On average, 20 requests are in flight at any moment.\n   Useful for sizing thread pools and connection pools:\n   too few slots and requests queue up; too many and you\n   waste memory/connections that are mostly idle.',
    },
    {
      type: 'table',
      caption: 'SLI vs SLO vs SLA',
      headers: ['Term', 'Definition', 'Example'],
      rows: [
        ['SLI (Indicator)', 'The actual measured metric.', '"p99 latency of the checkout endpoint"'],
        ['SLO (Objective)', 'The internal target for that indicator.', '"p99 < 300ms"'],
        ['SLA (Agreement)', 'An external, often contractual, commitment with consequences for missing it - usually looser than the internal SLO to leave margin.', '"p99 < 500ms or customer receives a service credit"'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Name the percentile',
      text:
        '"Make it faster" is not an actionable interview answer. Naming the specific percentile and target you are optimizing for - and why that percentile matters for this system - is what signals seniority. "We need p99 write latency under 200ms because that is what feeds the real-time leaderboard update" is a sentence an interviewer remembers.',
    },
  ],
  relatedConcepts: ['observability', 'back-of-envelope-estimation', 'caching'],
}

export default concept
