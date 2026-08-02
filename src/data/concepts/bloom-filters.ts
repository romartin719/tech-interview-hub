import type { Concept } from './types'

const concept: Concept = {
  slug: 'bloom-filters',
  title: 'Bloom Filters',
  number: 18,
  category: 'Caching & Performance',
  icon: 'pi pi-filter',
  summary: 'Probabilistic, False Positives - a tiny bit array that answers "definitely not present" or "maybe present".',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text: 'A Bloom filter is a fixed-size bit array plus K independent hash functions, used to answer one narrow question extremely cheaply: "have I possibly seen this item before?" It never gives a false negative - if it says an item is not in the set, that is guaranteed true - but it can give a false positive at a small, tunable rate. That asymmetry is exactly what makes it useful as a fast pre-check in front of something slower and authoritative.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Adding an Item',
        mermaid: `flowchart TD
  item["Item x"]:::client
  h1["hash1(x) -> bit 3"]:::compute
  h2["hash2(x) -> bit 7"]:::compute
  h3["hash3(x) -> bit 11"]:::compute
  bits[("Bit Array: set bits 3, 7, 11 to 1")]:::storage
  item --> h1 --> bits
  item --> h2 --> bits
  item --> h3 --> bits`,
      },
    },
    {
      type: 'list',
      items: [
        'Adding an item runs it through K hash functions, each producing a position in the bit array, and sets all K of those bits to 1.',
        'Checking an item runs it through the same K hash functions and reads those same K positions: if ANY of those bits is 0, the item was definitely never added. If ALL of them are 1, the item was probably added - but another combination of items could have coincidentally set the same bits, producing a false positive.',
        'The false-positive rate is tunable by the size of the bit array and the number of hash functions - bigger array and more hashes means fewer collisions, at the cost of more memory and more hashing work per operation.',
      ],
    },
    {
      type: 'table',
      caption: 'Why the Trade-off Is Worth It',
      headers: ['Exact set', 'Bloom filter'],
      rows: [
        ['Storing millions of keys exactly (e.g. in a hash set) can require gigabytes of memory.', 'The same set can be approximated in a small fraction of that memory - often under 2% false-positive rate using roughly 1 byte per element.'],
        ['Guarantees exact answers for both presence and absence.', 'Guarantees exact answers for absence only; presence answers are probabilistic and must be double-checked against the real source.'],
      ],
    },
    {
      type: 'list',
      items: [
        'A cache (or CDN) checking "have I ever seen this key before" to skip an expensive downstream lookup entirely for keys that have genuinely never existed, rather than doing a full cache-miss round trip to the database.',
        'Cassandra and HBase keep a Bloom filter per SSTable so a read for a key can skip disk I/O entirely for every SSTable that definitely does not contain it, only reading the (usually few) files that might.',
        "A web crawler's URL-seen-before check, so it does not need to store every URL it has ever crawled in full to avoid re-crawling it.",
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'A Bloom filter can rule out, never confirm',
      text: 'The most common mistake is treating a positive Bloom filter result as proof the item exists. It is not - it only means "probably." A Bloom filter is always a fast pre-check that sits in front of an authoritative, slower lookup (a database query, a disk read, a full hash-set check), used to skip that slower path when the answer is definitely no. It is never a replacement for the authoritative check itself, and it cannot be used at all if you need to remove items (a standard Bloom filter supports no deletions, since clearing a bit could break lookups for a different item that also set that bit).',
    },
  ],
  relatedConcepts: ['caching', 'rate-limiting'],
}

export default concept
