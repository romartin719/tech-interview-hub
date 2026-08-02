import type { Concept } from './types'

const concept: Concept = {
  slug: 'consistent-hashing',
  title: 'Consistent Hashing',
  number: 25,
  category: 'Distributed Systems',
  icon: 'pi pi-circle',
  summary: 'Hash Ring, Virtual Nodes - adding or removing a server without reshuffling almost everything.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'The naive way to decide which of N servers owns a key is hash(key) % N. This works fine as long as N never changes. The moment you add or remove a single server, N changes, and almost every key now maps to a different server than before - a massive cache-miss storm if this is a cache, or a massive data-movement storm if this is a sharded store, triggered by a routine scale-up or scale-down. Consistent hashing exists specifically to make that operation cheap.',
    },
    {
      type: 'paragraph',
      text:
        'Instead of hashing keys against a count of servers, consistent hashing maps both servers and keys onto positions on a fixed ring of hash values (typically 0 to 2^32 - 1). A key belongs to whichever server is the first one found going clockwise from the key\'s position on the ring. Adding or removing a server only remaps the keys that fall between it and its immediate neighbor on the ring - a small, predictable slice of the keyspace - instead of reshuffling everything.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Hash Ring',
        mermaid: `flowchart LR
  subgraph ring["Hash Ring (0 to 2^32-1)"]
    direction LR
    s1["Server A"]:::compute
    k1["key1"]:::client
    s2["Server B"]:::compute
    k2["key2"]:::client
    s3["Server C"]:::compute
    k3["key3"]:::client
  end
  s1 -->|"clockwise"| k1
  k1 -->|"owned by next server: B"| s2
  s2 -->|"clockwise"| k2
  k2 -->|"owned by next server: C"| s3
  s3 -->|"clockwise"| k3
  k3 -->|"owned by next server: A"| s1`,
      },
    },
    {
      type: 'heading',
      text: 'Virtual Nodes',
    },
    {
      type: 'paragraph',
      text:
        "With only a handful of physical servers placed once each on the ring, load distribution can be quite uneven - one server might end up owning a much larger arc of the ring than another, purely by the luck of where its hash landed. Virtual nodes fix this by placing each physical server at many points around the ring (e.g. 100-200 virtual positions per physical server) instead of just one. This smooths out the load distribution, and it also means that when a server is removed, its keys are spread across many other servers rather than dumped entirely onto its one neighbor.",
    },
    {
      type: 'table',
      caption: 'Consistent Hashing in Practice',
      headers: ['System', 'Where it is used'],
      rows: [
        ['DynamoDB', 'Determines which storage node owns which partition of the key space.'],
        ['Cassandra', 'Same idea - the ring assigns row keys to nodes, with virtual nodes ("vnodes") for even load.'],
        ['Sharded Memcached / Redis clients', "The client library hashes both cache keys and cache-server addresses onto a ring so it can add/remove cache nodes without invalidating the entire cache."],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Same idea as database sharding, one level down',
      text:
        "Consistent hashing is the same underlying idea as Database Sharding - deciding which node owns which piece of data - just applied dynamically at the routing/client-library level instead of through a fixed, manually-maintained shard map. If an interviewer asks how your system rebalances when you add a node, \"consistent hashing with virtual nodes\" is a much stronger answer than \"we'd update the shard map,\" because it shows you understand the operational cost of resharding at scale.",
    },
  ],
  relatedConcepts: ['database-sharding', 'load-balancing', 'cap-theorem'],
}

export default concept
