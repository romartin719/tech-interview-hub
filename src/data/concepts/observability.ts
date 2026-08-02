import type { Concept } from './types'

const concept: Concept = {
  slug: 'observability',
  title: 'Observability',
  number: 43,
  category: 'Performance & Operations',
  icon: 'pi pi-eye',
  summary: 'Metrics vs Logs vs Traces, RED/USE - the three pillars that let you answer "why is it broken" at 3am.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Observability is the ability to understand a system's internal state from the outputs it produces - without having to ship new code every time you have a new question. In practice that comes down to three complementary data types, each answering a different question when something goes wrong.",
    },
    {
      type: 'table',
      caption: 'The Three Pillars',
      headers: ['Pillar', 'What it is', 'Best for'],
      rows: [
        ['Metrics', 'Numeric time-series (counters, gauges, histograms).', "Cheap to store, great for dashboards/alerting/trends, but can't tell you WHY a specific request was slow."],
        ['Logs', 'Detailed timestamped text records of discrete events.', 'Great for root-causing a specific incident, but expensive to store/search at volume.'],
        ['Traces', "Follow one request's full path across every service it touched.", 'Shows exactly where time was spent in a distributed call chain.'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'A Trace Across Services',
        mermaid: `flowchart LR
  client[Client]:::client
  gw["API Gateway\\n(generates trace ID)"]:::edge
  svc1["Order Service\\nspan 1"]:::compute
  svc2["Inventory Service\\nspan 2"]:::compute
  db[("Database")]:::database
  client -->|"1. Request"| gw
  gw -->|"2. trace-id header"| svc1
  svc1 -->|"3. trace-id header"| svc2
  svc2 -->|"4. Query"| db`,
      },
    },
    {
      type: 'heading',
      text: 'RED (for services)',
    },
    {
      type: 'list',
      items: [
        'Rate - requests per second.',
        'Errors - failed requests per second.',
        'Duration - latency distribution (see Performance Metrics for why percentiles, not averages).',
      ],
    },
    {
      type: 'heading',
      text: 'USE (for resources)',
    },
    {
      type: 'list',
      items: [
        'Utilization - the percentage of time a resource (CPU, disk, network) was busy.',
        'Saturation - how much queued work is waiting for that resource.',
        'Errors - error events reported by the resource itself.',
      ],
    },
    {
      type: 'paragraph',
      text:
        'Distributed tracing works by generating a trace ID at the edge (the first gateway/load balancer a request hits) and propagating it through every downstream call via request headers. Each service adds its own timed "span" to that same trace, and a tool like Jaeger or Datadog later stitches every span back together into one end-to-end timeline.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Alert on symptoms, not causes',
      text:
        'Alerts should fire on RED metrics (symptoms a user would notice - rising p99 latency, rising error rate) rather than on every USE metric (an internal cause - a CPU blip, a saturated queue). Paging someone every time CPU crosses 80% causes alert fatigue; paging on rising error rate or p99 latency reliably means something a user is actually feeling.',
    },
  ],
  relatedConcepts: ['performance-metrics', 'heartbeat-health-checks', 'deployment-reliability'],
}

export default concept
