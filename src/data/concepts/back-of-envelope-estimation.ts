import type { Concept } from './types'

const concept: Concept = {
  slug: 'back-of-envelope-estimation',
  title: 'Back-of-Envelope Estimation',
  number: 45,
  category: 'Other Essentials',
  icon: 'pi pi-calculator',
  summary: 'Numbers every engineer should know - sizing a system before you have designed a single component.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Before you draw a single box in a system-design interview, you often need a rough sense of scale: how many requests per second, how much data, how many servers. Back-of-envelope estimation is the skill of turning a vague problem statement into concrete numbers using a handful of memorized reference points and simple arithmetic - not precision, just the right order of magnitude.',
    },
    {
      type: 'table',
      caption: 'Latency Numbers Worth Memorizing',
      headers: ['Operation', 'Approximate latency'],
      rows: [
        ['L1 cache reference', '~1 ns'],
        ['Main memory reference', '~100 ns'],
        ['SSD random read', '~100 microseconds'],
        ['Round trip within the same datacenter', '~0.5 ms'],
        ['Round trip cross-continent', '~50-150 ms'],
        ['Typical Postgres indexed query', 'a few ms'],
        ['Typical Redis GET', 'well under 1 ms'],
      ],
    },
    {
      type: 'table',
      caption: 'Throughput Reference Points',
      headers: ['System', 'Approximate throughput'],
      rows: [
        ['Single Postgres instance', 'low thousands of simple writes/sec'],
        ['Redis', '100K+ ops/sec on modest hardware'],
        ['Kafka', 'hundreds of MB/sec to GB/sec per broker'],
        ['Typical HTTP request round trip', 'dominated by network time, not compute'],
      ],
    },
    {
      type: 'list',
      items: [
        'Data size: a short text row is ~100 bytes-1KB; a typical image is hundreds of KB to a few MB.',
        'Storage overhead: assume ~20% overhead for indexes/metadata on top of raw row data when estimating storage.',
        'Traffic: convert daily active users to average requests/sec by dividing by ~86,400 seconds, then multiply by a peak factor of 2-10x for the busiest hour depending on how spiky the product is.',
      ],
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Worked example',
      code:
        '100M DAU, each makes 10 requests/day\n-> 1,000,000,000 requests/day\n-> 1,000,000,000 / 86,400 sec ~= 11,500 req/sec average\n-> apply a peak factor of ~5-10x for the busiest hour\n-> ~50,000-100,000 req/sec at peak',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'The method matters more than the numbers',
      text:
        'Interviewers care far more about the METHOD - state an assumption out loud, compute, sanity-check the order of magnitude - than about memorizing exact numbers. Being off by 2x is fine; being off by 1000x because you forgot a unit conversion (seconds vs. days, bytes vs. bits) is not, and undermines confidence in everything you estimate after it.',
    },
  ],
  relatedConcepts: ['performance-metrics', 'caching', 'database-sharding'],
}

export default concept
