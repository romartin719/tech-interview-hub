import type { Concept } from './types'

const concept: Concept = {
  slug: 'database-replication',
  title: 'Database Replication',
  number: 11,
  category: 'Data & Storage',
  icon: 'pi pi-copy',
  readTimeMinutes: 7,
  summary: 'Primary-Replica, Quorum - copying data across machines for durability and read scalability.',
  blocks: [
    {
      type: 'paragraph',
      text:
        "Replication copies the same data onto multiple machines so the system survives a single machine dying (durability) and so reads can be spread across more than one server (scalability). It's a different axis from sharding: sharding splits data into disjoint pieces, replication copies the same piece multiple times. Most real systems use both together.",
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Primary-Replica Replication',
        mermaid: `flowchart LR
  client[Client]:::client
  primary[("Primary\n(accepts writes)")]:::database
  r1[("Replica 1")]:::database
  r2[("Replica 2")]:::database
  r3[("Replica 3")]:::database
  client -->|writes| primary
  client -->|reads| r1
  client -->|reads| r2
  primary -->|replication log| r1
  primary -->|replication log| r2
  primary -->|replication log| r3`,
      },
    },
    {
      type: 'table',
      caption: 'Synchronous vs Asynchronous Replication',
      headers: ['', 'Synchronous', 'Asynchronous'],
      rows: [
        ['Write completes when', 'The primary AND at least one replica have confirmed the write', 'The primary has written locally - it doesn\'t wait on replicas'],
        ['Write latency', 'Higher - bounded by the slowest replica in the sync set', 'Lower - never blocked on replica speed'],
        ['Data loss on primary failure', "None for synced replicas - they're guaranteed up to date", 'Possible - the last few writes may not have reached any replica yet'],
        ['Common use', 'Financial/critical data where losing a write is unacceptable', 'Most read-scaling use cases, where a little staleness is fine'],
      ],
    },
    {
      type: 'heading',
      text: 'Replication Lag',
    },
    {
      type: 'paragraph',
      text:
        'Asynchronous replicas are always slightly behind the primary. That lag becomes visible to users as a specific bug pattern: a client writes a value, then immediately reads it back - but the read gets routed to a replica that hasn\'t caught up yet, and the client sees stale (or missing) data right after writing it. This is the "read-after-write consistency" problem, and it\'s usually fixed by routing a user\'s own reads to the primary for a short window after they write, or by routing based on a replication-lag-aware sticky session.',
    },
    {
      type: 'table',
      caption: 'Quorum-Based Replication (Dynamo-style)',
      headers: ['Term', 'Meaning'],
      rows: [
        ['N', 'Total number of replicas a piece of data is stored on'],
        ['W', 'Number of replicas that must acknowledge a write before it succeeds'],
        ['R', 'Number of replicas that must respond to a read before it returns'],
        ['W + R > N', 'Guarantees a read overlaps with the most recent write set, giving tunable strong-ish consistency without a single primary'],
      ],
    },
    {
      type: 'paragraph',
      text:
        'Cassandra and DynamoDB let you tune W and R per operation instead of hardcoding synchronous vs asynchronous replication - e.g. W=1 for fast writes and eventual consistency, or W=N/R=N for strong consistency at the cost of latency and availability during a partition.',
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Failover is a hard distributed-systems problem',
      text:
        "When a primary dies, promoting a replica to be the new primary sounds simple but isn't: two nodes might both believe they're primary during a network partition (split-brain), in-flight writes to the old primary can be lost if it wasn't fully synced, and clients need to discover the new primary quickly. This is exactly the Leader Election problem - production systems lean on tools like Raft, ZooKeeper, or etcd rather than hand-rolling failover logic.",
    },
  ],
  relatedConcepts: ['database-sharding', 'consensus', 'database-indexing'],
}

export default concept
