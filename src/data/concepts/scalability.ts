import type { Concept } from './types'

const concept: Concept = {
  slug: 'scalability',
  title: 'Scalability',
  number: 1,
  category: 'Start Here',
  icon: 'pi pi-arrows-alt',
  summary: 'Vertical vs Horizontal - the first fork in every system design conversation.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Scalability is a system\'s ability to handle more load - more users, more requests, more data - by adding resources rather than falling over. Every other concept on this page exists to answer a scalability problem in some specific dimension (storage, compute, network, or coordination). Before reaching for any specific technique, an interviewer wants to hear you reason about the two fundamental levers: make the machine you have bigger, or add more machines.',
    },
    {
      type: 'table',
      caption: 'Vertical vs Horizontal Scaling',
      headers: ['', 'Vertical (Scale Up)', 'Horizontal (Scale Out)'],
      rows: [
        ['What changes', 'Add CPU/RAM/disk to one machine', 'Add more machines'],
        ['Ceiling', 'Hard physical/cost limit on a single box', 'Effectively unbounded'],
        ['Complexity', 'Low - no code changes needed', 'High - needs load balancing, data partitioning, coordination'],
        ['Downtime', 'Usually requires a restart/resize', 'Can add capacity with zero downtime'],
        ['Cost curve', 'Exponential past a point (bigger boxes cost disproportionately more)', 'Roughly linear per unit of added capacity'],
        ['Failure blast radius', 'One box, one point of failure', 'A single machine dying barely dents total capacity'],
      ],
    },
    {
      type: 'paragraph',
      text:
        'In practice almost every real system does both: pick a reasonably-sized instance type (vertical) and then run many of them behind a load balancer (horizontal). The interesting design decisions - and the vast majority of the concepts in this reference - are about what happens once you go horizontal: how do you route requests to the right machine, how do you keep data consistent across machines, and how do you keep the system correct when any one of those machines can fail at any time.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Interview framing',
      text:
        'When asked "how would you scale this," don\'t just say "add more servers." Name the specific bottleneck first (CPU-bound compute? a single database accepting all writes? a hot cache key?), then explain which lever - vertical or horizontal - actually relieves that specific bottleneck. Horizontal scaling a stateless API layer is easy; horizontally scaling a single-writer relational database is the hard, interesting part of the conversation (that\'s what Database Sharding and Database Replication are for).',
    },
    {
      type: 'list',
      items: [
        'Stateless services (API servers, web servers) scale horizontally almost for free - just add instances behind a load balancer.',
        'Stateful services (databases, in-memory caches) require an explicit strategy - replication, sharding, or consistent hashing - because state has to live somewhere specific.',
        'Vertical scaling buys you time cheaply early on; most systems should not reach for horizontal complexity before they have measured an actual bottleneck.',
      ],
    },
  ],
  relatedConcepts: ['load-balancing', 'database-sharding', 'database-replication'],
}

export default concept
