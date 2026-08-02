import type { Concept } from './types'

const concept: Concept = {
  slug: 'message-queues',
  title: 'Message Queues',
  number: 19,
  category: 'Communication & Messaging',
  icon: 'pi pi-inbox',
  summary: 'Kafka vs SQS vs RabbitMQ - decoupling producers from consumers with an async buffer.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        "A message queue sits between a producer and a consumer so the two never have to talk to each other directly or be available at the same time. The producer drops a message and moves on; the consumer picks it up whenever it's ready. That one indirection is what lets a slow or temporarily-down consumer absorb a traffic spike without taking the producer down with it - the queue is the shock absorber.",
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Decoupling Producers From Consumers',
        mermaid: `flowchart LR
  p1["Producer A"]:::compute
  p2["Producer B"]:::compute
  q[("Queue / Topic")]:::async
  c1["Consumer 1"]:::compute
  c2["Consumer 2"]:::compute
  c3["Consumer 3"]:::compute
  p1 -->|"publish"| q
  p2 -->|"publish"| q
  q -->|"consume"| c1
  q -->|"consume"| c2
  q -->|"fan-out"| c3`,
      },
    },
    {
      type: 'heading',
      text: 'Why Bother With a Queue',
    },
    {
      type: 'list',
      items: [
        "Absorbs traffic spikes - the queue buffers a burst of messages so a slow downstream consumer doesn't get overwhelmed or take the producer's request path down with it.",
        'Decouples deploys and scaling - producer and consumer can be deployed, scaled, and even fail independently, as long as the queue between them stays up.',
        'Enables fan-out - one event can be delivered to several independent consumers (e.g. an order-placed event triggering billing, email, and analytics) without the producer knowing any of them exist.',
      ],
    },
    {
      type: 'table',
      caption: 'Delivery Guarantees',
      headers: ['Guarantee', 'Behavior', 'Trade-off'],
      rows: [
        ['At-most-once', 'A message is delivered zero or one times.', 'Never duplicates, but a dropped message is gone for good - only acceptable when losing an occasional message is cheaper than the complexity of retrying.'],
        ['At-least-once', 'A message is redelivered until the consumer explicitly acknowledges it.', 'Never loses a message, but the same message can be delivered more than once (e.g. consumer crashes after processing but before acking) - consumers must be idempotent.'],
        ['Exactly-once', 'Each message is processed exactly one time, no drops and no duplicates.', "Hardest to achieve end-to-end; in practice it's usually exactly-once *processing* built on top of at-least-once delivery plus an idempotency check on the consumer side, not a magic property of the broker."],
      ],
    },
    {
      type: 'table',
      caption: 'Kafka vs SQS',
      headers: ['', 'Kafka', 'SQS'],
      rows: [
        ['Throughput', 'Very high - designed for continuous high-volume streams.', 'High, but generally lower ceiling than a well-tuned Kafka cluster.'],
        ['Consumption model', 'Consumers track their own offset per partition and can rewind and replay history.', "Messages are deleted once acknowledged - there's no replay."],
        ['Ordering', 'Guaranteed within a partition.', 'Standard queues give best-effort ordering; FIFO queues guarantee order within a message group.'],
        ['Operational cost', 'You run and tune a cluster (brokers, partitions, replication) yourself.', 'Fully managed - no cluster to operate.'],
        ['Best fit', 'Multiple independent consumer groups need to read the same event stream, possibly replaying it.', 'Simple point-to-point work distribution where you just need decoupling, not a queryable log.'],
      ],
    },
    {
      type: 'paragraph',
      text:
        "RabbitMQ is the traditional broker in this space: it excels at complex routing - exchanges and bindings let you route a message to different queues based on topic, headers, or pattern matching - at a lower raw throughput ceiling than Kafka. It's a strong default when the routing logic itself is the hard part, not the volume.",
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Picking Kafka vs a simpler queue',
      text:
        "Reach for Kafka when you need replay (reprocess history after fixing a bug) or multiple independent consumer groups reading the same stream at their own pace. Reach for a simpler queue (SQS or RabbitMQ) when you just need to hand work off to be processed once - it's a smaller mental model, less to operate, and replay/multi-consumer semantics are exactly what you're not paying for.",
    },
  ],
  relatedConcepts: ['fan-out-patterns', 'dead-letter-queue', 'realtime-communication'],
}

export default concept
