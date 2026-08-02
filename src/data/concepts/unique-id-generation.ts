import type { Concept } from './types'

const concept: Concept = {
  slug: 'unique-id-generation',
  title: 'Unique ID Generation',
  number: 49,
  category: 'Other Essentials',
  icon: 'pi pi-hashtag',
  summary: 'Snowflake, UUID v7, ULID - generating IDs across many machines without a central counter.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A simple AUTO_INCREMENT column requires a single source of truth handing out the next number one at a time. That works fine on one database instance, but the moment you have multiple writers or shards, that counter becomes a bottleneck and a single point of failure - every writer everywhere has to ask it for the next value. Distributed ID generation needs a scheme where each machine can mint IDs on its own, with no coordination round-trip, while still avoiding collisions.',
    },
    {
      type: 'table',
      caption: 'Approaches',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['UUID v4', 'Fully random 128-bit value.', 'Zero coordination needed anywhere - but random order is terrible for database index locality (inserts scatter across the entire B-tree instead of appending at the end) and the ID carries no notion of creation time, so it is not sortable.'],
        ['Twitter Snowflake', '64-bit ID packing [timestamp | machine/worker ID | sequence number] into one integer.', 'Roughly time-sortable and compact; each machine only needs to know its own worker ID and a local per-millisecond counter - no coordination between machines at generation time.'],
        ['UUID v7 / ULID', 'Newer formats that embed a timestamp prefix into a UUID-shaped (or UUID-compatible) value, specifically to fix v4\'s sortability problem.', 'Keeps the "no coordination" property of UUID v4 while restoring the time-ordering and index-locality benefits of Snowflake-style IDs.'],
      ],
    },
    {
      type: 'table',
      caption: 'Snowflake Bit Layout (64 bits total)',
      headers: ['Field', 'Bits', 'Gives you'],
      rows: [
        ['Timestamp', '41 bits', 'Milliseconds since a custom epoch - roughly 69 years of range, and the reason IDs sort close to creation order.'],
        ['Machine / worker ID', '10 bits', 'Up to 1,024 distinct machines minting IDs independently with no coordination.'],
        ['Sequence number', '12 bits', 'Up to 4,096 unique IDs per machine per millisecond before the clock has to tick forward.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      text:
        'ID sortability matters more than people expect: a monotonically-increasing-ish ID (Snowflake, ULID, UUID v7) means new rows insert at the end of a B-tree index instead of scattering randomly across it, which is a real, measurable difference in write throughput and index bloat at scale. This is usually why "just use UUID v4" is the wrong default answer when the interviewer is describing a high-write-volume system - it is a fine answer for low-volume systems where simplicity wins, but say so explicitly rather than reaching for it reflexively.',
    },
  ],
  relatedConcepts: ['sharding', 'distributed-locking'],
}

export default concept
