import type { Concept } from './types'

const concept: Concept = {
  slug: 'cap-theorem',
  title: 'CAP Theorem',
  number: 23,
  category: 'Distributed Systems',
  icon: 'pi pi-sitemap',
  summary:
    'CP vs AP, PACELC - you cannot have Consistency, Availability, AND Partition tolerance all at once during a network partition.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        "The CAP theorem says that during a network partition, a distributed system must choose between Consistency (every read sees the latest write) and Availability (every request gets a response, even if it might not be the latest data). Partition tolerance is not really an optional third dial - in any real distributed system, nodes and networks will eventually fail to talk to each other, so you have to tolerate partitions whether you want to or not. That means the actual, practical choice CAP forces on you is CP vs AP, and only during a partition. When the network is healthy, most systems can be both consistent and available at the same time.",
    },
    {
      type: 'table',
      caption: 'CP vs AP - What Happens During a Partition',
      headers: ['Choice', 'Behavior on the minority side', 'Examples'],
      rows: [
        [
          'CP (Consistency + Partition tolerance)',
          'Reject or block requests on the side of the partition that cannot confirm it has the latest data, rather than risk serving stale results.',
          'ZooKeeper, HBase, etcd',
        ],
        [
          'AP (Availability + Partition tolerance)',
          'Keep serving reads and writes on both sides of the partition, accepting temporary inconsistency between the two sides, and reconcile the divergence once the partition heals.',
          'Cassandra, DynamoDB',
        ],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Same Partition, Two Different Choices',
        mermaid: `flowchart TD
  client1[Client A]:::client
  client2[Client B]:::client
  n1[("Node 1\\n(majority side)")]:::database
  n2[("Node 2\\n(minority side)")]:::database
  client1 -->|"write"| n1
  client2 -->|"read"| n2
  n1 -.->|"partition - no link"| n2
  n2 -->|"CP: reject request\\nAP: serve possibly-stale data"| client2`,
      },
    },
    {
      type: 'heading',
      text: 'PACELC - The More Complete Picture',
    },
    {
      type: 'paragraph',
      text:
        'CAP only describes behavior during a partition (P), but every distributed system also makes a trade-off during completely normal operation with no partition at all: when you ask for stronger consistency (C), you generally pay for it in latency (L), else (E) you can get lower latency at the cost of weaker consistency. This is PACELC: if Partitioned, choose Availability or Consistency; Else (normally), choose Latency or Consistency. A system like DynamoDB or Cassandra is more precisely described as "PA/EL" - available over consistent during a partition, and latency-favoring over consistency-favoring the rest of the time - which explains its everyday behavior far better than the CAP label "AP" alone.',
    },
    {
      type: 'table',
      caption: 'PACELC Labels for Familiar Systems',
      headers: ['System', 'During a partition', 'Normal operation'],
      rows: [
        ['DynamoDB / Cassandra', 'PA - stay available, accept staleness', 'EL - favor low latency over strict consistency'],
        ['etcd / ZooKeeper', 'PC - block/reject to stay consistent', 'EC - favor consistency, pay the latency cost of quorum writes'],
        ['MongoDB (default settings)', 'PA in practice for reads from secondaries', 'EC for writes acknowledged by a majority'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'What interviewers are actually listening for',
      text:
        "Reciting the CAP theorem from memory earns you nothing. What matters is that when you propose a real component in your design - a metadata store, a leaderboard, a session store - you can correctly label it CP or AP and justify that choice against the stated requirements. If losing a write for a few seconds during a rare partition is acceptable but the service must never go down, argue AP. If two nodes disagreeing for even a moment would corrupt money or inventory, argue CP. Also be ready to move past CAP into PACELC when asked to describe day-to-day behavior, since that's where most of a system's real latency/consistency trade-offs actually live.",
    },
  ],
  relatedConcepts: ['consistency-models', 'consistent-hashing', 'database-replication'],
}

export default concept
