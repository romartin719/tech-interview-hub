import type { Concept } from './types'

const concept: Concept = {
  slug: 'merkle-trees',
  title: 'Merkle Trees',
  number: 28,
  category: 'Distributed Systems',
  icon: 'pi pi-sitemap',
  summary: 'Data Integrity, Anti-Entropy - a hash tree that lets two replicas find their differences in O(log n) instead of comparing everything.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'usedIn',
      items: ['Amazon DynamoDB', 'Cassandra', 'Git', 'Bitcoin/blockchains', 'IPFS'],
    },
    {
      type: 'paragraph',
      text:
        'When two replicas of the same dataset might have drifted apart (a node was down, a write was missed, a partition happened), you eventually need to reconcile them - a process called anti-entropy. The naive way is to compare every key between the two replicas, which is O(n) in the number of keys and gets expensive fast at scale. A Merkle tree restructures the data as a hash tree so that two replicas can find exactly where they differ in O(log n) comparisons, most of the time in a single round trip.',
    },
    {
      type: 'heading',
      text: 'How It Is Built',
    },
    {
      type: 'list',
      items: [
        'Leaves: each leaf is the hash of one data block or key range (e.g. hash of a key\'s value, or hash of a small range of keys).',
        'Internal nodes: each parent node is the hash of the concatenation of its children\'s hashes.',
        'Root: a single hash at the top that summarizes the entire dataset - if any single leaf anywhere in the tree changes, that change propagates upward and the root hash changes too.',
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'A Small Merkle Tree',
        mermaid: `flowchart TD
  root["Root Hash = H(H12 + H34)"]:::compute
  h12["H12 = H(H1 + H2)"]:::compute
  h34["H34 = H(H3 + H4)"]:::compute
  h1["H1 = hash(key range 1)"]:::storage
  h2["H2 = hash(key range 2)"]:::storage
  h3["H3 = hash(key range 3)"]:::storage
  h4["H4 = hash(key range 4)"]:::storage
  root --> h12
  root --> h34
  h12 --> h1
  h12 --> h2
  h34 --> h3
  h34 --> h4`,
      },
    },
    {
      type: 'heading',
      text: 'The Anti-Entropy Sync Algorithm',
    },
    {
      type: 'list',
      items: [
        '1. Two replicas exchange just their root hashes. If the roots match, the entire datasets are provably identical - sync is done in a single round trip, with no key-level comparison needed at all.',
        '2. If the roots differ, exchange the hashes of the root\'s children instead.',
        '3. Recurse: descend only into the branches whose hashes actually differ, skipping any subtree whose hash matches (that subtree is proven identical without inspecting it further).',
        '4. Keep descending until you reach the leaf level, at which point you have isolated the exact key ranges that are out of sync - only those need to be transferred and repaired.',
      ],
    },
    {
      type: 'table',
      caption: 'Merkle Comparison vs. Naive Comparison',
      headers: ['Approach', 'Network cost', 'Notes'],
      rows: [
        ['Compare every key', 'O(n) - proportional to full dataset size', 'Simple but wasteful when most data already matches, which is the common case in anti-entropy repair'],
        ['Compare Merkle tree hashes top-down', 'O(log n) in the common case', 'Only diverging branches are traversed; matching subtrees are pruned after a single hash comparison'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'The same idea shows up everywhere',
      text:
        'Cassandra and Dynamo-style databases use Merkle trees for exactly this - background anti-entropy repair between replicas without shipping the whole dataset over the wire. Git uses the identical idea for its commit history: every commit, tree, and blob is content-addressed by hash, so two clones can tell in one step whether their histories match, and if not, walk down to find the exact diverging commits. Blockchains use it to let a client prove a single transaction is included in a block by revealing only the sibling hashes along the path to the root (a "Merkle proof"), without downloading every transaction in the block.',
    },
  ],
  relatedConcepts: ['vector-clocks', 'consistent-hashing'],
}

export default concept
