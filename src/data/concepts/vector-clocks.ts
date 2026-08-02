import type { Concept } from './types'

const concept: Concept = {
  slug: 'vector-clocks',
  title: 'Vector Clocks',
  number: 27,
  category: 'Distributed Systems',
  icon: 'pi pi-clock',
  summary: 'Causality, Conflict Detection - tracking "who knew what, when" without a synchronized wall clock.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'usedIn',
      items: ['Amazon DynamoDB (original Dynamo paper)', 'Riak', 'Voldemort'],
    },
    {
      type: 'paragraph',
      text:
        'In a distributed system you cannot trust wall-clock timestamps from different machines to order events correctly - clocks drift, NTP sync is imperfect, and "5ms apart" on two different nodes might actually be reversed in real time. But for correctness (especially conflict detection in eventually-consistent stores) you often need a precise answer to a narrower question: did event A definitely happen before event B (causally), or could they have happened independently, in which case they conflict? A vector clock answers exactly that question, without any dependency on synchronized real time.',
    },
    {
      type: 'heading',
      text: 'How It Works',
    },
    {
      type: 'list',
      items: [
        'Each node in the system keeps a vector of counters, one slot per node (e.g. [A:0, B:0, C:0] in a 3-node system).',
        'A node increments its own counter every time it processes an event (a write, a send).',
        'When a node sends a message (or replicates a write), it attaches its current vector.',
        'When a node receives a message, it merges: take the element-wise max of its own vector and the incoming vector, then increment its own counter by one.',
      ],
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Merge-on-receive, in pseudocode',
      code:
        'function onReceive(localVector, incomingVector, selfId):\n  merged = elementwiseMax(localVector, incomingVector)\n  merged[selfId] += 1\n  return merged',
    },
    {
      type: 'heading',
      text: 'Comparing Two Vectors',
    },
    {
      type: 'paragraph',
      text:
        'Take two versions of a value tagged with vectors [A:2, B:1] and [A:1, B:1]. Compare them position by position: A:2 >= A:1, and B:1 >= B:1 - every position of the first vector is greater than or equal to the corresponding position of the second, and at least one is strictly greater. That means the first vector causally dominates the second: whatever produced [A:2, B:1] happened after, and with full knowledge of, whatever produced [A:1, B:1]. It is safe to treat the newer one as the correct successor.',
    },
    {
      type: 'paragraph',
      text:
        'Now compare [A:2, B:1] with [A:1, B:2] instead. A:2 >= A:1 (first wins that slot) but B:1 < B:2 (second wins that slot). Neither vector dominates the other in every position, so the two writes are concurrent - they happened independently, each without knowledge of the other. This is a genuine conflict: two clients modified the same logical record without either seeing the other\'s change, and the system cannot say which one is "newer."',
    },
    {
      type: 'table',
      caption: 'Resolving Detected Conflicts',
      headers: ['Strategy', 'How it works', 'Trade-off'],
      rows: [
        ['Last-write-wins (arbitrary tiebreak)', 'Pick one version using a rule unrelated to causality - e.g. highest node ID, or a wall-clock timestamp stored alongside the vector.', 'Simple and requires no client involvement, but silently discards one write with no warning - can lose data the client thought was saved.'],
        ['Merge and return siblings', 'Store both concurrent versions and hand both back to the client (or application logic) on the next read, letting it decide how to reconcile.', 'No data is lost, but it pushes reconciliation logic onto every client - this is the approach the original Dynamo paper used for shopping-cart-style merges.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'They do not scale forever',
      text:
        'Vector clocks give a precise, mathematically clean answer to "were these two events concurrent," which a plain timestamp cannot. The catch is that the vector grows with the number of distinct nodes/clients that have ever written a value, so in systems with many thousands of writers, vectors get large and expensive to compare and store. That is why many production systems switch to cheaper approximations once node count grows - a single monotonic version number (accepting some lost precision), or hybrid logical clocks (HLCs), which combine a physical timestamp with a logical counter to get most of the ordering benefit at a fraction of the storage cost.',
    },
  ],
  relatedConcepts: ['merkle-trees', 'fencing-tokens'],
}

export default concept
