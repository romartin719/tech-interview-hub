import type { Concept } from './types'

const concept: Concept = {
  slug: 'database-indexing',
  title: 'Database Indexing',
  number: 9,
  category: 'Data & Storage',
  icon: 'pi pi-database',
  summary: 'B-Tree, Composite - trading write speed and storage for O(log n) reads instead of a full table scan.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Without an index, finding a row means scanning every row in the table - O(n). An index is an auxiliary sorted (or hashed) data structure that lets the database jump straight to matching rows, turning that into O(log n) or better. The cost isn't free: every index has to be updated on every write, uses disk and memory, and can actually make a write-heavy table slower if you add too many.",
    },
    {
      type: 'table',
      caption: 'Index Types',
      headers: ['Type', 'Good for', 'Limitation'],
      rows: [
        ['B-Tree', 'General-purpose ordered lookups, range queries (WHERE age > 30), sorting', 'Default in most relational databases - not the fastest for pure exact-match'],
        ['Hash', 'Exact-match lookups only (WHERE id = 5) in O(1)', 'Cannot do range queries or sorting at all'],
        ['Full-text', 'Tokenized keyword search over text columns (Postgres GIN, MySQL FULLTEXT)', 'Weaker relevance ranking and scaling than a dedicated search engine'],
        ['Geospatial (R-tree / quadtree)', 'Location queries - "find points within this bounding box/radius"', 'Specialized - only useful for spatial columns'],
        ['Composite (multi-column)', 'Queries that filter/sort on a fixed combination of columns together', 'Column order matters enormously - see leftmost-prefix rule below'],
      ],
    },
    {
      type: 'heading',
      text: 'When to Index (and When Not To)',
    },
    {
      type: 'list',
      items: [
        'Index columns used in WHERE clauses, JOIN conditions, and ORDER BY / GROUP BY - these are what the database engine needs to seek or sort on quickly.',
        "Don't index low-cardinality columns (e.g. a boolean flag or a status enum with 3 values) - the index barely narrows the search and the planner may ignore it anyway.",
        "Don't over-index write-heavy tables - every additional index means every INSERT/UPDATE/DELETE has to also update that index, so index maintenance cost can dominate and slow down writes noticeably.",
        'A composite index can often replace several single-column indexes if your queries consistently filter on the same combination of columns.',
      ],
    },
    {
      type: 'table',
      caption: 'Full-Text: Database Index vs Dedicated Search Engine',
      headers: ['', 'DB full-text index (Postgres GIN, MySQL FULLTEXT)', 'Dedicated search index (Elasticsearch, OpenSearch)'],
      rows: [
        ['Relevance ranking', 'Basic (tf-idf-ish)', 'Rich scoring, fuzzy match, synonyms, typo tolerance'],
        ['Scale', 'Fine for moderate text volume', 'Built to shard and scale to huge corpora'],
        ['Operational cost', 'None - it\'s just another index on your existing DB', 'A separate system to run, and data has to be kept in sync via CDC or dual-writes'],
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'The leftmost-prefix rule',
      text:
        'A composite index on (a, b, c) is a single sorted structure keyed first by a, then by b within each a, then by c within each b. It speeds up queries filtering on a alone, or a + b, or a + b + c - but it does NOT help a query that filters only on b or only on c, because the database has no way to jump into the middle of that sort order without first pinning down a. Column order in a composite index should match your most common query patterns, not alphabetical or "importance" order.',
    },
  ],
  relatedConcepts: ['database-sharding', 'database-replication', 'db-query-complexity'],
}

export default concept
