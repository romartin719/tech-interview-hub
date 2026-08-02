import type { Concept } from './types'

const concept: Concept = {
  slug: 'leader-election',
  title: 'Leader Election',
  number: 26,
  category: 'Distributed Systems',
  icon: 'pi pi-star',
  summary: 'Raft, ZooKeeper, Split-Brain - getting a cluster of nodes to agree on exactly one leader.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "A lot of coordination problems get much simpler if exactly one node in a cluster is designated as the leader: a database primary that orders all writes, a distributed lock service that grants exclusive access, or a job scheduler that decides who runs a given cron job. Leader election is the mechanism a cluster uses to agree on which single node holds that role at any given time, and to correctly hand it off when the current leader fails.",
    },
    {
      type: 'heading',
      text: 'The Core Mechanism',
    },
    {
      type: 'paragraph',
      text:
        "Most consensus algorithms share the same shape: nodes run periodic elections, and a candidate needs votes from a majority (a quorum) of the cluster to become leader - not just the first response it gets. Leadership is time-bounded through a lease or term number rather than granted forever, so if the current leader gets partitioned away from the rest of the cluster, it eventually stops renewing its lease and steps down (or the rest of the cluster simply stops recognizing it), letting a new election proceed safely.",
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Quorum-Based Election',
        mermaid: `flowchart TD
  n1[("Node 1\\ncandidate")]:::compute
  n2[("Node 2")]:::compute
  n3[("Node 3")]:::compute
  n4[("Node 4")]:::compute
  n5[("Node 5")]:::compute
  n1 -->|"request vote, term=5"| n2
  n1 -->|"request vote, term=5"| n3
  n1 -->|"request vote, term=5"| n4
  n1 -->|"request vote, term=5"| n5
  n2 -->|"vote yes"| n1
  n3 -->|"vote yes"| n1
  n4 -->|"vote yes"| n1
  n1 -->|"3/5 = majority - becomes leader"| n1`,
      },
    },
    {
      type: 'table',
      caption: 'Real Implementations',
      headers: ['Algorithm / Protocol', 'Used by'],
      rows: [
        ['Raft', 'etcd, Consul - both use Raft for their own internal cluster consensus.'],
        ['ZooKeeper (ZAB protocol)', "ZooKeeper's own leader election, and historically Kafka's controller election before Kafka moved to its own Raft-based KRaft mode."],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Split-brain',
      text:
        "If a network partition lets two nodes each believe they are the leader - because each one sees what it thinks is a majority, or because no true majority requirement is enforced - you can end up with two \"leaders\" issuing conflicting writes to the same data at the same time. This is exactly why leader election is built on quorum-based majority voting rather than \"whoever answers first\": a majority of a fixed cluster size can never exist on both sides of a partition simultaneously, so at most one side can ever elect a leader.",
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Leader election alone is not enough - add fencing tokens',
      text:
        "Even a correct leader election protocol has a brief overlap window during failover: the old leader may not know yet that it has been deposed, and could still issue a write while a new leader is already active. The standard second layer of defense is a fencing token - a monotonically increasing epoch/term number attached to every write - so that downstream storage can reject any write carrying a stale token from a leader that has since been replaced. Mentioning fencing tokens alongside leader election is a strong signal in an interview that you understand failover is a process with a window, not an instant.",
    },
  ],
  relatedConcepts: ['consistency-models', 'cap-theorem', 'database-replication'],
}

export default concept
