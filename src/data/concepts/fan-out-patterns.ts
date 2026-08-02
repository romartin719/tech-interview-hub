import type { Concept } from './types'

const concept: Concept = {
  slug: 'fan-out-patterns',
  title: 'Fan-Out Patterns',
  number: 21,
  category: 'Communication & Messaging',
  icon: 'pi pi-share-alt',
  summary: 'On Write vs On Read - deciding when to pay the cost of delivering one event to many recipients.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Fan-out is what happens when one event needs to reach many recipients - a post reaching every follower, a price update reaching every subscriber. The design question is never "does the data get there," it\'s "when do we pay the cost of distributing it": at write time, when the event happens, or at read time, when a recipient asks for it.',
    },
    {
      type: 'table',
      caption: 'Push vs Pull',
      headers: ['Pattern', 'How it works', 'Trade-off'],
      rows: [
        ['Fan-out-on-write (push)', "When an event happens, immediately write a copy into every recipient's inbox / feed / queue.", "Reads are instant - just read your own precomputed feed. But a single event with millions of recipients means millions of writes, and one wildly popular sender (a \"celebrity\") turns every post into a write storm."],
        ['Fan-out-on-read (pull)', 'Store the event once; each reader merges/queries the relevant sources at read time.', 'Writes stay cheap and O(1) regardless of recipient count, but every read now does more work - merging across many sources gets expensive as the number of sources grows.'],
        ['Hybrid', 'Fan-out-on-write for the common case; fall back to fan-out-on-read for outliers.', 'Gets the fast-read benefit for almost everyone while avoiding the write-storm cost for the accounts that would otherwise trigger it - at the cost of two code paths to maintain.'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Write-Time Fan-Out vs Read-Time Fan-Out',
        mermaid: `flowchart TD
  post["New Post"]:::compute
  worker["Fan-Out Worker"]:::async
  f1["Follower 1 Feed Cache"]:::cache
  f2["Follower 2 Feed Cache"]:::cache
  fn["Follower N Feed Cache"]:::cache
  post -->|"on write"| worker
  worker --> f1
  worker --> f2
  worker --> fn
  req["Read Request"]:::client
  a1[("Followed Account 1")]:::database
  a2[("Followed Account 2")]:::database
  am[("Followed Account M")]:::database
  req -->|"on read: merge"| a1
  req -->|"on read: merge"| a2
  req -->|"on read: merge"| am`,
      },
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'The classic example: Twitter/X\'s home timeline',
      text:
        "Twitter/X fans posts out to follower feed caches on write for the typical account, so most timeline reads are instant. But for celebrity accounts with tens of millions of followers, writing to that many feeds on every single post would be prohibitively expensive - so those accounts fall back to fan-out-on-read: their posts are merged into a follower's timeline at read time instead of being pushed everywhere immediately. That hybrid is the textbook answer to this exact interview question.",
    },
    {
      type: 'heading',
      text: 'Which Way to Default',
    },
    {
      type: 'list',
      items: [
        'Fan-out-on-write wins when reads vastly outnumber writes and the recipient count per event is bounded - you pay a predictable, capped write cost once to make every future read cheap.',
        'Fan-out-on-read wins when a single write can have an effectively unbounded number of recipients - capping the write cost matters more than keeping every read maximally cheap.',
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'Fan-out-on-write is precomputed caching, not a separate idea',
      text:
        "Fan-out-on-write and caching solve the same underlying problem: move expensive computation from query time to write time so a later read is cheap. If you understand Caching's cache-aside vs write-through trade-off, fan-out-on-write is that same trade-off applied to \"one event, many readers\" instead of \"one key, many reads\" - don't treat it as an unrelated pattern to memorize separately.",
    },
  ],
  relatedConcepts: ['caching', 'message-queues', 'realtime-communication'],
}

export default concept
