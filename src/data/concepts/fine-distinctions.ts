import type { Concept } from './types'

const concept: Concept = {
  slug: 'fine-distinctions',
  title: 'Terminology & Fine Distinctions',
  number: 50,
  category: 'Reference',
  icon: 'pi pi-question-circle',
  summary: '180+ X-vs-Y answers - the comparison questions interviewers actually ask.',
  readTimeMinutes: 12,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Interviewers love asking "what\'s the difference between X and Y" because it reveals whether you actually understand a concept or just memorized its name. This page collects the most common ones in one place.',
    },
    {
      type: 'table',
      caption: 'Partitioning vs Sharding',
      headers: ['', 'Partitioning', 'Sharding'],
      rows: [
        ['Definition', 'Splitting ANY dataset into smaller pieces - a general umbrella term.', 'SPECIFICALLY partitioning across separate database instances/machines for horizontal scale.'],
        ['Scope', 'Can happen within a single database instance, e.g. Postgres table partitioning by date range.', 'Always implies multiple physical machines.'],
        ['Goal', 'Manageability, query performance, sometimes just organization.', 'Horizontal write/storage scalability beyond one machine.'],
        ['Example', 'A single Postgres table split into monthly partitions on one server.', 'User data split across 16 separate database servers by user ID hash.'],
        ['Coordination cost', 'Low - it\'s all one instance.', 'High - needs a routing layer and complicates cross-shard queries/transactions.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      text:
        'Sharding is a TYPE of partitioning - specifically, horizontal partitioning across separate machines. Every shard is a partition, but not every partition is a shard. If asked to define sharding, mentioning this relationship immediately signals precision.',
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'The word "partition" means three different things',
      text:
        'A database partition (a slice of a table or dataset, this page\'s topic), a network partition in CAP Theorem (a communication break between nodes that prevents them from talking to each other), and a Kafka partition (a shard of a topic\'s log, used purely for parallelism) are three unrelated uses of the same word. Context matters, and conflating them - e.g. saying a "network partition" when you mean a sharded table - is a common and easily-avoided confusion.',
    },
    {
      type: 'table',
      caption: 'Rapid-Fire Distinctions',
      headers: ['Term A', 'Term B', 'Key Difference'],
      rows: [
        ['Replication', 'Sharding', 'Replication copies the SAME data to multiple places for durability/read scale; Sharding splits DIFFERENT data across multiple places for write/storage scale - many systems do both.'],
        ['Latency', 'Throughput', 'Latency = time for one request to complete; Throughput = how many requests complete per unit time - you can have high throughput with high latency via parallelism.'],
        ["ACID's Consistency", "CAP's Consistency", 'ACID C = the database never violates its own declared constraints/invariants; CAP C = every read sees the most recent write across replicas - genuinely different meanings of the same word.'],
        ['Linearizability', 'Serializability', 'Linearizability is about the real-time ORDER of individual operations appearing instantaneous; Serializability is about TRANSACTIONS appearing as if run one-at-a-time in some order, not necessarily real-time order.'],
        ['At-least-once delivery', 'Exactly-once delivery', 'At-least-once can redeliver the same message; Exactly-once processing is usually built as at-least-once delivery PLUS idempotent handling - true exactly-once delivery is extremely hard to guarantee end to end.'],
        ['Queue', 'Topic', 'A queue message is consumed by ONE consumer and then gone; a topic message is delivered to EVERY subscriber independently - pub/sub vs point-to-point.'],
        ['Authentication', 'Authorization', 'Authentication = who are you; Authorization = what are you allowed to do - auth-N happens first, auth-Z second.'],
        ['Forward proxy', 'Reverse proxy', 'Forward proxy represents CLIENTS to the internet; Reverse proxy represents SERVERS to the internet.'],
        ['Backpressure', 'Load shedding', 'Backpressure tells the upstream producer to SLOW DOWN; Load shedding just DROPS excess work outright rather than signaling upstream.'],
        ['Optimistic locking', 'Pessimistic locking', 'Optimistic assumes no conflict, checks a version number at write time and fails if it changed; Pessimistic locks the row up front, blocking other writers for the whole operation.'],
        ['SLO', 'SLA', 'SLO = internal target; SLA = external contractual commitment with consequences, usually looser than the SLO to leave margin.'],
        ['RPO', 'RTO', 'RPO = how much DATA you can afford to lose, measured in time; RTO = how much DOWNTIME you can afford before restoring service.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      text:
        'Most of these pairs show up as follow-up questions after a candidate mentions the first term casually. Being ready to immediately distinguish it from its common confusable is a fast way to demonstrate depth without needing to be prompted.',
    },
  ],
  relatedConcepts: ['sharding', 'cap-theorem', 'acid-transactions'],
}

export default concept
