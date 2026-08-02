import type { Concept } from './types'

const concept: Concept = {
  slug: 'db-query-complexity',
  title: 'Database Query Complexity',
  number: 12,
  category: 'Data & Storage',
  icon: 'pi pi-chart-bar',
  readTimeMinutes: 9,
  summary: 'Postgres, DynamoDB, Redis - the Big-O of common operations differs wildly by database.',
  blocks: [
    {
      type: 'paragraph',
      text:
        "In an interview, being able to say \"that query is O(n) because it's an unindexed scan\" or \"that DynamoDB access pattern needs a Scan, which is a red flag\" signals real database intuition. The Big-O of the exact same logical operation - \"find this record\" - varies enormously depending on which database you picked and how you modeled the access pattern, which is why the choice of database is itself a system-design decision.",
    },
    {
      type: 'table',
      caption: 'Postgres (Relational)',
      headers: ['Operation', 'Complexity', 'Notes'],
      rows: [
        ['Indexed lookup (WHERE id = ?)', 'O(log n)', 'B-Tree index walk'],
        ['Full table scan (unindexed WHERE)', 'O(n)', 'Every row is read - the thing indexing exists to avoid'],
        ['JOIN', 'Depends on indexes + planner strategy', 'Indexed nested-loop join can be near O(n log n); an unindexed join can degrade toward O(n*m)'],
        ['INSERT with many indexes', 'Slower per additional index', 'Every index on the table must be updated on every write'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Mental model: why O(log n) feels instant',
      text:
        "A B-Tree cuts the remaining search space by a large branching factor at every level (not by half like a binary tree - more like by hundreds). A 1,000,000-row table is roughly log(1,000,000) ~ 20 levels deep, so an indexed lookup touches on the order of 20 pages, not 1,000,000 rows. That's the entire reason indexing turns a noticeable pause into an imperceptible one.",
    },
    {
      type: 'paragraph',
      text:
        'The same leftmost-prefix rule from indexing applies here: a composite index on (a, b, c) speeds up queries filtering on a, or a+b, or a+b+c - but not on b or c alone, because the index is one structure sorted first by a.',
    },
    {
      type: 'table',
      caption: 'DynamoDB (Key-Value / Wide-Column)',
      headers: ['Operation', 'Complexity', 'Notes'],
      rows: [
        ['GetItem (partition key + sort key)', 'O(1)-ish', 'Direct hash lookup to the right partition'],
        ['Query (all items in one partition, optionally sort-key range)', 'Efficient - proportional to items returned', 'The core "good" DynamoDB access pattern'],
        ['Scan (whole table)', 'O(n) - expensive and discouraged', 'Reads every item in every partition; avoid in any hot code path'],
        ['Global Secondary Index (GSI)', 'Query by a different attribute', "Lets you query by a non-key attribute, but it's eventually consistent and consumes its own write capacity on every write"],
      ],
    },
    {
      type: 'table',
      caption: 'Redis (In-Memory)',
      headers: ['Operation', 'Complexity', 'Notes'],
      rows: [
        ['GET / SET', 'O(1)', 'Direct hash table access'],
        ['SADD / ZADD', 'O(log n)', 'Sets are hash-based; sorted sets maintain order via a skip list'],
        ['KEYS (scan all keys)', 'O(n) and blocking', 'Blocks the single-threaded event loop while it runs - never use in production'],
        ['SCAN (cursor-based iteration)', 'O(n) total, but non-blocking per call', 'The safe replacement for KEYS - iterates incrementally without freezing the server'],
      ],
    },
    {
      type: 'table',
      caption: 'Decision Framework',
      headers: ['Need', 'Reach for'],
      rows: [
        ['Range queries, joins, ad-hoc filtering', 'B-Tree / Postgres (or any relational DB)'],
        ['Massive write throughput at a fixed, known access pattern', 'DynamoDB (or Cassandra)'],
        ['Sub-millisecond simple lookups, counters, leaderboards', 'Redis'],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Never Scan, never KEYS',
      text:
        "DynamoDB's Scan and Redis's KEYS are the two most common \"this doesn't scale\" red flags interviewers listen for. Both are O(n) over the entire dataset, and both get slower and more expensive as the system succeeds and grows - the exact opposite of what you want from a hot-path operation. If you find yourself needing one, it usually means the access pattern wasn't modeled correctly (missing GSI, wrong Redis data structure) rather than that the operation is actually necessary.",
    },
  ],
  relatedConcepts: ['database-indexing', 'caching', 'database-sharding'],
}

export default concept
