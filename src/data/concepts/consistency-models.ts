import type { Concept } from './types'

const concept: Concept = {
  slug: 'consistency-models',
  title: 'Consistency Models',
  number: 24,
  category: 'Distributed Systems',
  icon: 'pi pi-balance-scale',
  summary: 'Strong, Eventual, Causal - how stale a read is allowed to be relative to the latest write.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Once data is replicated across multiple nodes, you have to decide exactly how stale a read is allowed to be relative to the most recent write. A consistency model is that precise contract. It is not a binary strong-vs-eventual choice - it is a spectrum, and the specific point you pick on that spectrum changes both the user experience and the cost of running the system.",
    },
    {
      type: 'table',
      caption: 'Consistency Models',
      headers: ['Model', 'Guarantee', 'Trade-off'],
      rows: [
        [
          'Strong Consistency',
          'Every read, from any replica, sees the most recent write immediately.',
          'Simplest to reason about, but requires coordinating replicas on every write (e.g. quorum or single-leader confirmation), which adds latency and reduces availability during partitions.',
        ],
        [
          'Eventual Consistency',
          'If writes stop, all replicas will converge to the same value "eventually" - but a read immediately after a write can return stale data.',
          'Cheap and highly available since replicas can be read/written independently, but callers must tolerate temporarily seeing old data.',
        ],
        [
          'Read-Your-Writes Consistency',
          "A client is guaranteed to immediately see its own writes, even though the system is otherwise only eventually consistent for other clients' writes.",
          'Often implemented by routing a client\'s reads to the replica it just wrote to (or by tracking a version/timestamp and refusing to serve a replica that has not caught up).',
        ],
        [
          'Causal Consistency',
          'Writes that are causally related (a write B that happened after observing write A) are seen by everyone in that order; causally unrelated writes may be seen in different orders by different observers.',
          "Stronger and more intuitive than plain eventual consistency (no one sees a reply before the comment it replies to), but cheaper than strong consistency since unrelated writes don't need global ordering.",
        ],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Where Reads Can Land',
        mermaid: `flowchart LR
  writer[Client Writes]:::client
  leader[("Leader / Primary")]:::database
  r1[("Replica 1")]:::database
  r2[("Replica 2")]:::database
  writer -->|"write"| leader
  leader -->|"async replicate"| r1
  leader -->|"async replicate"| r2
  reader1[Reader A - same client]:::client
  reader2[Reader B - different client]:::client
  reader1 -->|"routed back to leader:\\nread-your-writes"| leader
  reader2 -->|"may hit stale replica"| r2`,
      },
    },
    {
      type: 'heading',
      text: 'Mapping Models to Real Systems',
    },
    {
      type: 'list',
      items: [
        'DNS and most CDNs: eventually consistent - a DNS record change or cache purge can take seconds to minutes to reach every resolver/edge node, and that is an accepted trade-off for global scale.',
        "A banking ledger: needs strong consistency - two concurrent withdrawals from the same account must never both succeed based on a stale balance.",
        "A social media comment thread: often uses read-your-writes - you always see the comment you just posted, even if other users have not received it yet, which hides the underlying eventual consistency of the replication.",
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: '"Eventually consistent" is not one guarantee',
      text:
        "Saying a system is \"eventually consistent\" and stopping there is a weak interview answer, because eventual consistency is a whole family of relaxations, not a single guarantee. A strong interviewer's natural follow-up is: which specific relaxation are you actually offering - read-your-writes, monotonic reads, causal consistency, or a bounded-staleness window (e.g. \"never more than 5 seconds stale\")? Naming the precise guarantee, and which product requirement it satisfies, is what separates a strong answer from a name-drop.",
    },
  ],
  relatedConcepts: ['cap-theorem', 'database-replication', 'leader-election'],
}

export default concept
