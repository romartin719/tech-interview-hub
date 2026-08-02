import type { Concept } from './types'

const concept: Concept = {
  slug: 'transactions-isolation-levels',
  title: 'Transactions & Isolation Levels',
  number: 15,
  category: 'Data & Storage',
  icon: 'pi pi-lock',
  summary: 'ACID, MVCC, Write Skew - what a database actually guarantees when multiple transactions run concurrently.',
  readTimeMinutes: 9,
  blocks: [
    {
      type: 'paragraph',
      text:
        "A transaction groups a set of reads and writes into one all-or-nothing unit. ACID describes what a database promises about that unit, but the interesting interview-level question is Isolation: what exactly can go wrong when many transactions run concurrently, and which isolation level actually prevents which anomaly? Getting this precise - not just naming the levels - is what separates a strong answer from a memorized one.",
    },
    {
      type: 'table',
      caption: 'ACID',
      headers: ['Property', 'Guarantee'],
      rows: [
        ['Atomicity', 'A transaction either applies all of its writes, or none of them - there is no partially-applied state visible to anyone.'],
        ['Consistency', 'A transaction never leaves the database violating its own declared constraints (foreign keys, unique constraints, application invariants enforced within the transaction).'],
        ['Isolation', "Concurrent transactions do not see each other's half-finished, uncommitted work - the degree to which this holds is exactly what isolation levels tune."],
        ['Durability', 'Once a transaction commits, that result survives a crash immediately after - it is on durable storage (typically via a write-ahead log), not just in memory.'],
      ],
    },
    {
      type: 'heading',
      text: 'Isolation Levels and the Anomalies They Allow',
    },
    {
      type: 'table',
      caption: 'From weakest to strongest',
      headers: ['Level', 'Dirty read', 'Non-repeatable read', 'Phantom read', 'Write skew'],
      rows: [
        ['Read Uncommitted', 'Allowed', 'Allowed', 'Allowed', 'Allowed'],
        ['Read Committed', 'Prevented', 'Allowed', 'Allowed', 'Allowed'],
        ['Repeatable Read', 'Prevented', 'Prevented', 'Allowed (varies by DB)', 'Allowed'],
        ['Serializable', 'Prevented', 'Prevented', 'Prevented', 'Prevented'],
      ],
    },
    {
      type: 'list',
      items: [
        'Dirty read - reading a value another transaction wrote but has not committed yet (and might roll back).',
        'Non-repeatable read - reading the same row twice within one transaction and getting different values because another transaction committed a change in between.',
        'Phantom read - re-running the same query twice within one transaction and getting a different set of rows, because another transaction inserted or deleted rows matching the condition.',
      ],
    },
    {
      type: 'heading',
      text: 'MVCC (Multi-Version Concurrency Control)',
    },
    {
      type: 'paragraph',
      text: 'Postgres and MySQL (InnoDB) implement their isolation levels using MVCC: instead of locking rows for every read, the engine keeps multiple versions of each row, each tagged with the transaction that created it. A reader is handed a consistent snapshot - the versions visible as of when its transaction (or statement) started - so readers never block writers and writers never block readers. This is why "Repeatable Read" in these databases is cheap: the snapshot itself, not a lock held for the transaction\'s duration, is what makes repeated reads consistent.',
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Write skew: the anomaly Repeatable Read misses',
      text:
        'Write skew happens when two transactions each read overlapping data, each independently decides an action is valid based on what they read, and both commit - but the combination violates an invariant that neither transaction could see on its own. Classic example: two doctors on call both check "is at least one other doctor on call?", both see yes, and both remove themselves from on-call duty, leaving zero doctors on call even though the invariant "at least one doctor on call" was never violated from either transaction\'s own point of view. Repeatable Read does not catch this because neither transaction re-read data that changed underneath it - the row each transaction wrote is different from the row it read. Only true Serializable isolation (or an explicit `SELECT ... FOR UPDATE` / serialization check) prevents it.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Why Serializable is rarely the default',
      text:
        "Serializable isolation gives the strongest guarantee but at real cost: it is typically implemented with more aggressive locking or optimistic conflict detection that aborts and retries transactions under contention, which hurts throughput and adds retry complexity to application code. Most production systems default to Read Committed (Postgres, and MySQL's practical default) and handle the genuinely dangerous cases explicitly - with a `SELECT ... FOR UPDATE`, a unique constraint, or an application-level check - rather than paying the Serializable tax on every transaction in the system.",
    },
  ],
  relatedConcepts: ['write-ahead-log', 'caching'],
}

export default concept
