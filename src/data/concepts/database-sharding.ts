import type { Concept } from './types'

const concept: Concept = {
  slug: 'database-sharding',
  title: 'Database Sharding',
  number: 10,
  category: 'Data & Storage',
  icon: 'pi pi-th-large',
  readTimeMinutes: 9,
  summary: 'Hash, Range, Geo - splitting one logical database across many physical machines.',
  blocks: [
    {
      type: 'paragraph',
      text:
        "Sharding (horizontal partitioning) splits one logical dataset across multiple physical machines, each holding a disjoint subset of the rows. It's how you scale writes past what a single database instance can handle, since a single primary can only take so many writes/second no matter how much you vertically scale it. The catch is that sharding trades away a lot of what makes relational databases convenient - and that trade-off is bigger for SQL than for NoSQL.",
    },
    {
      type: 'table',
      caption: 'Why Sharding Hits SQL Harder Than NoSQL',
      headers: ['', 'SQL (Postgres, MySQL)', 'NoSQL (DynamoDB, Cassandra, MongoDB)'],
      rows: [
        ['Schema', 'Strong, enforced schema', 'Flexible / schemaless'],
        ['Joins & transactions', 'Rich cross-table joins and ACID transactions, assumed to live on one machine', 'Joins are discouraged or unsupported by design - denormalize instead'],
        ['Sharding story', 'Bolted on after the fact - cross-shard joins/transactions become expensive or impossible', 'Built with a partition key as a first-class concept from day one'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Sharded Database',
        mermaid: `flowchart LR
  client[Client]:::client
  router["Shard Router / Proxy"]:::edge
  s1[("Shard 1\nusers A-H")]:::database
  s2[("Shard 2\nusers I-P")]:::database
  s3[("Shard 3\nusers Q-Z")]:::database
  client --> router
  router --> s1
  router --> s2
  router --> s3`,
      },
    },
    {
      type: 'table',
      caption: 'Shard-Key Strategies',
      headers: ['Strategy', 'How it works', 'Trade-off'],
      rows: [
        ['Hash-based', 'Hash the key (e.g. user ID) and mod by shard count to pick a shard', 'Even distribution across shards, but you lose the ability to run range queries across shards (rows near each other logically end up on unrelated shards)'],
        ['Range-based', 'Each shard owns a contiguous range of key values (e.g. user IDs 1-1M, 1M-2M)', 'Supports efficient range scans, but new/popular data often clusters at one end of the range, creating a hot shard'],
        ['Geo-based', 'Shard by region so data lives near the users who access it', 'Great latency and data-locality, but load is uneven - a shard serving a dense region gets hammered while others sit idle'],
      ],
    },
    {
      type: 'heading',
      text: 'Problems Sharding Introduces',
    },
    {
      type: 'list',
      items: [
        'Cross-shard joins and transactions become expensive (fan-out queries to every shard) or simply unsupported - application code has to do the join/aggregation itself.',
        'Resharding (adding or removing shards) is a major operation - it means moving large amounts of data between machines, ideally with consistent hashing to minimize how much has to move.',
        'A poorly chosen shard key creates hot spots: one shard gets disproportionate traffic while others are underutilized, defeating the purpose of sharding in the first place.',
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Pick the key for your queries, not for even spread',
      text:
        'The most common interview mistake is choosing a shard key purely to "spread data evenly" (e.g. a random hash) without checking what the dominant query pattern is. If most queries fetch everything for one user, shard by user ID so that data stays co-located on one shard - even if that occasionally creates a hotter shard for a power user. An evenly-distributed key that forces every query to fan out across all shards is worse than a slightly uneven key that keeps queries single-shard.',
    },
  ],
  relatedConcepts: ['database-replication', 'database-indexing', 'consistent-hashing'],
}

export default concept
