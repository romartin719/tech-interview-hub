import type { Concept } from './types'

const concept: Concept = {
  slug: 'write-ahead-log',
  title: 'Write-Ahead Log',
  number: 14,
  category: 'Data & Storage',
  icon: 'pi pi-file-edit',
  summary: 'Crash Recovery, Kafka - append the intent to durable storage before mutating anything else.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A write-ahead log (WAL) is a simple but powerful rule: before you apply a change to an in-memory structure or an on-disk data file, first append a record describing that change to a sequential, append-only log on durable storage. Only after the log write is confirmed durable does the actual mutation happen. If the process crashes at any point after the log write, the change is not lost - it is sitting in the log, ready to be replayed.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Write-Ahead Log Flow',
        mermaid: `flowchart LR
  client[Client]:::client
  engine["DB Engine"]:::compute
  wal[("Write-Ahead Log (append-only, durable)")]:::storage
  mem[("In-Memory State")]:::cache
  data[("Data Files")]:::database
  client -->|"1. Write request"| engine
  engine -->|"2. Append record"| wal
  wal -->|"3. Fsync confirmed"| engine
  engine -->|"4. Ack to client"| client
  engine -->|"5. Apply mutation"| mem
  mem -.->|"6. Flush later (checkpoint)"| data`,
      },
    },
    {
      type: 'paragraph',
      text:
        'This gives crash safety without requiring every mutation to be durably written to its final, often-scattered location on disk before acknowledging the client. On restart after a crash, the engine replays the log starting from the last checkpoint, reapplying every record whose mutation had not yet made it into the data files, reconstructing exactly the state that existed right before the crash.',
    },
    {
      type: 'table',
      caption: 'WAL in Real Systems',
      headers: ['System', 'How it uses a WAL'],
      rows: [
        ['PostgreSQL', 'Every change to a table or index is first appended to the WAL before the corresponding page in the heap file is modified; the WAL is what makes crash recovery and streaming replication possible.'],
        ['MySQL (InnoDB)', 'The redo log serves the same role - changes are appended to the redo log before dirty pages are flushed from the buffer pool to disk.'],
        ['Kafka', "Kafka's entire storage model IS a write-ahead log: every message produced to a partition is an append to that partition's log, and consumers simply track an offset into it rather than deleting or reordering anything."],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Why sequential appends do not kill write throughput',
      text:
        "It seems like adding an extra write (the log entry) before every mutation should make things slower, not more durable and fast. The trick is that appending to the end of a log is a sequential write, and sequential writes are dramatically faster than the random writes needed to update scattered rows or pages in place - on spinning disks because there is no seek time, and on SSDs because sequential writes avoid the read-modify-write amplification and garbage collection overhead that random writes trigger. So a WAL buys durability essentially for free: one cheap sequential append replaces (or precedes) many expensive random writes, and the expensive scattered updates can be batched and flushed lazily later.",
    },
  ],
  relatedConcepts: ['caching', 'transactions-isolation-levels'],
}

export default concept
