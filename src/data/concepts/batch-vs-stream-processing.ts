import type { Concept } from './types'

const concept: Concept = {
  slug: 'batch-vs-stream-processing',
  title: 'Batch vs Stream Processing',
  number: 38,
  category: 'Architecture Decisions',
  icon: 'pi pi-forward',
  summary: 'Processing data in scheduled chunks vs continuously as it arrives.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Any system that processes data at volume has to pick when the processing happens: on a schedule, over a large bounded dataset (batch), or continuously, event by event, as data arrives (stream). The choice shapes latency, cost, and how much complexity you take on - and picking the fancier option by default is a common interview misstep.',
    },
    {
      type: 'table',
      caption: 'Batch vs Stream Processing',
      headers: ['Aspect', 'Batch Processing', 'Stream Processing'],
      rows: [
        ['Data scope', 'Large, bounded dataset (an hour, a day)', 'Unbounded - events processed continuously as they arrive'],
        ['Schedule', 'Runs on a schedule (hourly, nightly)', 'Runs continuously, no fixed schedule'],
        ['Latency', 'High - results are only as fresh as the last run', 'Low - results update within seconds of an event arriving'],
        ['Programming model', 'Simpler - operate over a complete, static dataset', 'Harder - must handle out-of-order events, windowing, exactly-once semantics'],
        ['Efficiency', 'Efficient for large-scale aggregate computation', 'Efficient for continuous small updates, less efficient for huge one-off aggregates'],
        ['Typical tools', 'Spark, Hadoop MapReduce', 'Kafka Streams, Flink, Spark Structured Streaming'],
      ],
    },
    {
      type: 'heading',
      text: 'Choosing Between Them',
    },
    {
      type: 'list',
      items: [
        'Batch fits: nightly reports, "as of this morning" dashboards, ML training data pipelines - anywhere a few hours of staleness is acceptable and simplicity/cost matter more than freshness.',
        'Stream fits: live dashboards, fraud detection, real-time personalization, alerting - anywhere the value of the result decays quickly with delay, even though it costs more in engineering complexity.',
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Lambda Architecture (hybrid)',
        mermaid: `flowchart LR
  src["Event Source"]:::async
  batchLayer["Batch Layer\n(Spark / Hadoop)"]:::compute
  streamLayer["Stream Layer\n(Flink / Kafka Streams)"]:::compute
  batchView[("Accurate, Complete\nHistorical View")]:::database
  streamView[("Fast, Approximate\nReal-Time View")]:::database
  serving["Serving Layer\n(reconciles both)"]:::compute
  src --> batchLayer --> batchView
  src --> streamLayer --> streamView
  batchView --> serving
  streamView --> serving`,
      },
    },
    {
      type: 'paragraph',
      text:
        'The Lambda Architecture runs both layers side by side: a batch layer produces accurate, complete results over historical data, while a stream layer produces fast-but-approximate results for data that has not yet been through a batch run. The serving layer reconciles the two, replacing the stream layer\'s approximate view with the batch layer\'s accurate view once it catches up. It gives you both speed and correctness, but at the cost of maintaining two separate codebases that need to produce compatible results.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Kappa Architecture as a simpler alternative',
      text:
        'Because maintaining two parallel processing pipelines (Lambda) is operationally expensive, many teams now prefer the Kappa Architecture: treat everything as a stream, and handle "batch-like" recomputation by replaying the stream from an earlier offset through the same stream-processing logic. One codebase, one set of semantics, at the cost of needing a log (like Kafka) that can retain and replay history far enough back.',
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: "Defaulting to streaming because it sounds impressive",
      text:
        "The real interview signal is recognizing which specific requirements of your system demand stream processing's added complexity (out-of-order handling, windowing, exactly-once delivery) rather than reaching for Kafka and Flink everywhere because real-time sounds more sophisticated than a nightly cron job. If nothing in the requirements needs sub-minute freshness, say so and default to batch.",
    },
  ],
  relatedConcepts: ['message-queues', 'fan-out-patterns', 'idempotency'],
}

export default concept
