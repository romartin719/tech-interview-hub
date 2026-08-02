import type { Concept } from './types'

const concept: Concept = {
  slug: 'dead-letter-queue',
  title: 'Dead Letter Queue',
  number: 22,
  category: 'Communication & Messaging',
  icon: 'pi pi-exclamation-triangle',
  summary: 'Poison Messages, Retry - where messages go after they fail processing one too many times.',
  readTimeMinutes: 5,
  blocks: [
    {
      type: 'paragraph',
      text:
        "A message that repeatedly crashes its consumer - because of a bug, malformed data, or a downstream dependency that's permanently unavailable - is a \"poison message.\" If the queue just keeps redelivering it, that one message can block the queue behind it or burn consumer capacity in an endless retry loop, dragging down every other message's throughput along with it.",
    },
    {
      type: 'paragraph',
      text:
        'The dead letter queue (DLQ) pattern fixes this: after a message fails processing more than N times, or exceeds a maximum age, it gets moved out of the main queue into a separate dead-letter queue instead of being retried forever. The main queue keeps flowing, and the failed message is preserved - not lost - for someone to look at later.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Main Queue to Dead Letter Queue',
        mermaid: `flowchart LR
  q[("Main Queue")]:::async
  c["Consumer"]:::compute
  ok["Processed OK"]:::compute
  dlq[("Dead Letter Queue")]:::storage
  q --> c
  c -->|"success"| ok
  c -->|"fails N times"| dlq`,
      },
    },
    {
      type: 'heading',
      text: 'Why This Matters',
    },
    {
      type: 'list',
      items: [
        "Protects throughput - one message that can never succeed doesn't get to dominate retry cycles and starve every healthy message behind it.",
        "Preserves failures for inspection - engineers can look at exactly what's in a DLQ message, fix the root cause, and then replay it instead of the message being silently dropped.",
        "Gives you a discard option too - once you've confirmed a message is genuinely bad (not just unlucky timing), you can delete it from the DLQ rather than reprocessing it.",
      ],
    },
    {
      type: 'table',
      caption: 'Real-World Implementations',
      headers: ['System', 'Pattern'],
      rows: [
        ['SQS', 'A redrive policy on the source queue specifies a maxReceiveCount and a target DLQ to move messages to once exceeded.'],
        ['Kafka', "No built-in DLQ primitive - the common convention is a consumer that, after N failed attempts, publishes the message to a separate topic (often named like \"orders.DLT\") instead of committing its offset and moving on."],
        ['RabbitMQ', 'Dead-letter exchanges - a queue can be configured with a dead-letter-exchange, and RabbitMQ automatically routes rejected, expired, or overflowed messages there.'],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'An unmonitored DLQ is where bugs go to be silently ignored',
      text:
        "Moving a poison message to a DLQ only solves the throughput problem - it does nothing for the underlying bug unless someone is watching. Alerting on DLQ depth (and ideally on individual failure reasons) is part of the pattern, not an optional nice-to-have. A team that builds a DLQ and never wires up monitoring on it has just built a quieter way to lose data - the messages are technically still there, but nobody notices they stopped being processed until a customer complains.",
    },
  ],
  relatedConcepts: ['message-queues', 'fan-out-patterns'],
}

export default concept
