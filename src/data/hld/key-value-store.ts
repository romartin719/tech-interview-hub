import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'key-value-store',
  title: 'Key-Value Store (Redis / DynamoDB)',
  difficulty: 'Intermediate',
  icon: 'pi pi-database',
  color: '#8b5cf6',
  readTimeMinutes: 24,
  topics: ['Consistent Hashing', 'Replication', 'LSM Tree', 'Quorum'],
  companies: ['Amazon', 'Google', 'Meta', 'Microsoft', 'Databricks'],
  prerequisites: ['Consistent Hashing', 'CAP Theorem', 'Merkle Trees'],
  summary:
    'A distributed hashmap that spreads PUT/GET keys across many machines using consistent hashing, replicates each key N times for durability, and lets each operation tune its own consistency-versus-latency trade-off via read/write quorums.',

  understandingProblem:
    "A key-value store is the simplest database there is: give it a key, get back a value. No joins, no schema, just PUT(key, value) and GET(key) - a giant distributed dictionary. The interesting part isn't the interface, it's making that dictionary survive machine failures, scale past a single node's memory and disk, and serve millions of requests per second. Building one from scratch teaches partitioning, replication, consistency, and failure handling - the four pillars almost every distributed system rests on.",
  realExamples:
    'Redis (in-memory, sub-millisecond reads), DynamoDB (millions of requests/sec at Amazon), Cassandra (wide-column store at massive scale), etcd (the key-value store behind Kubernetes cluster configuration).',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  server[("Single Server - in-memory HashMap")]:::database
  client -->|"PUT / GET"| server`,
    },
    whyThisBreaks: [
      'Memory limit - a single machine cannot hold 10TB+ of data in RAM (or even on disk indefinitely)',
      'Single point of failure - if the server crashes, every key is gone',
      "No horizontal scalability - you can't add more read or write capacity by adding servers",
      'No durability - an in-memory hashmap loses everything on restart',
      'No availability - any maintenance or restart means downtime for every key',
    ],
    closingNote:
      'We need a design that spreads data across many machines, keeps copies of every key for durability, and stays available even when individual nodes fail. The rest of this document evolves the single-server hashmap into exactly that.',
  },

  priorArt: [
    {
      title: 'Amazon DynamoDB (Dynamo Paper)',
      description:
        'Consistent hashing with virtual nodes for partitioning, vector clocks for conflict detection, and tunable W/R/N quorum consistency per request. The paper most of this design is drawn from.',
      link: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf',
    },
    {
      title: 'Google Bigtable / LevelDB',
      description:
        'Pioneered the LSM-tree storage engine - memtable in memory, flushed to sorted SSTables on disk, merged by background compaction.',
      link: 'https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/',
    },
    {
      title: 'Apache Cassandra',
      description:
        'Combines Dynamo-style partitioning with Bigtable-style storage. Runs at extreme scale - Apple has reported running 160K+ Cassandra nodes.',
      link: 'https://www.businesswire.com/news/home/20220929005344/en/Cassandra-Summit-Returns-to-Showcase-the-Future-of-Apache-Cassandra',
    },
    {
      title: 'etcd / Raft',
      description:
        'Chooses strong consistency via the Raft consensus protocol instead of tunable quorums. Backs Kubernetes cluster configuration storage.',
      link: 'https://etcd.io',
    },
  ],

  coreEntities: [
    { name: 'Key', description: 'Unique string identifier, e.g. user:42, session:abc.' },
    { name: 'Value', description: 'Arbitrary bytes - up to a few MB.' },
    { name: 'Node', description: 'A machine that owns part of the keyspace.' },
    { name: 'Partition', description: 'The range of keys assigned to a given node.' },
    { name: 'Replica', description: 'A copy of a partition living on a different node.' },
  ],

  requirements: {
    core: [
      'PUT(key, value) - store or update the value for a key',
      'GET(key) - retrieve the value for a key',
      'DELETE(key) - remove a key and its value',
    ],
    belowTheLine: [
      'Range queries',
      'TTL / expiry',
      'Atomic compare-and-swap (CAS) operations',
      'Batch operations',
      'Multi-region replication',
      'Encryption at rest',
      'Per-key access control',
    ],
    nonFunctionalTable: [
      { metric: 'Scalability', target: 'Handle 10TB+ of data across many machines, scale horizontally' },
      { metric: 'Availability', target: '99.99% - tolerate node failures without downtime' },
      { metric: 'Latency', target: 'Sub-10ms P99 for reads and writes' },
      { metric: 'Tunable consistency', target: 'Let clients choose strong vs. eventual consistency per operation' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Storage Engine',
      purpose: 'On-disk persistence per node',
      primaryPick: 'LSM Tree (RocksDB)',
      alternatives: 'B-Tree (InnoDB), Bitcask, WiscKey',
      whyPrimaryWins: 'Write-optimized; sequential I/O for high-throughput ingestion',
    },
    {
      tier: 'Coordination',
      purpose: 'Cluster membership + leader election',
      primaryPick: 'ZooKeeper',
      alternatives: 'etcd, Consul, gossip (Cassandra-style)',
      whyPrimaryWins: 'Strong consistency for metadata; battle-tested at scale',
    },
    {
      tier: 'Replication',
      purpose: 'Data durability across nodes',
      primaryPick: 'Raft consensus / quorum writes',
      alternatives: 'Paxos, chain replication, async replication',
      whyPrimaryWins: 'Tunable W/R quorum balances consistency vs. latency per-request',
    },
    {
      tier: 'Partitioning',
      purpose: 'Distribute keys across nodes',
      primaryPick: 'Consistent Hashing (virtual nodes)',
      alternatives: 'Range partitioning, hash mod N',
      whyPrimaryWins: 'Minimal data movement on node add/remove',
    },
    {
      tier: 'Conflict Resolution',
      purpose: 'Handle concurrent writes',
      primaryPick: 'Vector Clocks + LWW',
      alternatives: 'CRDTs, application-level merge',
      whyPrimaryWins: 'Simple, fits eventual consistency with tunable quorum',
    },
    {
      tier: 'In-Memory Index',
      purpose: 'Fast key lookup within a node',
      primaryPick: 'Bloom Filter + sparse index',
      alternatives: 'Hash index, B-tree index',
      whyPrimaryWins: 'Bloom filter avoids disk reads for missing keys; sparse index for existing ones',
    },
  ],
  technologyChoicesNote:
    'A KV store at 500K writes/sec needs write-optimized storage. LSM trees batch writes to a memtable then flush sequentially - roughly 10x the write throughput of random B-tree page splits. The read-amplification tradeoff from multiple levels is mitigated by Bloom filters.',

  scaleEstimation: [
    'Write QPS: 500K writes/sec',
    'Read QPS: 1M reads/sec (read-heavy workload)',
    'Storage: 10TB of data, 30TB raw with 3x replication',
    'Latency target: <10ms P99 for both reads and writes',
  ],

  apiInterface: [
    {
      method: 'PUT',
      path: '/v1/data/{key}',
      description: 'Store or update the value for a key.',
      example: '// Request\n{ "value": <any>, "ttl": 3600 }\n\n// Response 200\n{ "version": 42 }',
    },
    {
      method: 'GET',
      path: '/v1/data/{key}',
      description: 'Retrieve the value for a key.',
      example: '// Response 200\n{ "value": <any>, "version": 42 }',
    },
    {
      method: 'DELETE',
      path: '/v1/data/{key}',
      description: 'Remove a key and its value.',
      example: '// Response 204 No Content',
    },
  ],
  apiSecurityNote: 'Authentication via API key or JWT. Rate-limit per client to prevent abuse.',

  highLevelDesignIntro: "Let's build this incrementally, one requirement at a time.",

  builds: [
    {
      title: 'FR1: PUT - Storing Data Across Multiple Machines',
      body:
        "A single server can't hold everything, so data has to be split across many machines. The naive approach - hash(key) % num_nodes - looks fine until the cluster changes size: adding or removing a single node shifts almost every key to a new owner, and the whole cluster has to reshuffle data at once.\n\nThe solution: Consistent Hashing.",
      insightCallout:
        "Consistent hashing maps both keys AND nodes onto a circular ring (0 to 2^32). A key belongs to the first node found walking clockwise from its hash position. Adding or removing a node only affects the keys between it and its neighbor - not the entire ring.",
      newComponents: [
        { name: 'Client / Router', description: 'Hashes the key and walks the ring to find the node that owns it.' },
        {
          name: 'Storage Nodes',
          description: 'Own a contiguous range of the keyspace. Combine an in-memory cache with on-disk storage.',
        },
        {
          name: 'Coordinator Service',
          description: 'Tracks node liveness and ring ownership - ZooKeeper, a gossip protocol, or a control plane.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  router["Router - hash ring"]:::edge
  n1[Node 1 - keys A-F]:::database
  n2[Node 2 - keys G-M]:::database
  n3[Node 3 - keys N-T]:::database
  n4[Node 4 - keys U-Z]:::database
  coord[Coordinator Service]:::async

  client --> router
  router -->|"PUT"| n2
  coord -.->|"health check"| n1
  coord -.->|"health check"| n2
  coord -.->|"health check"| n3
  coord -.->|"health check"| n4`,
      },
      steps: [
        'Client calls PUT(key, value)',
        'Router hashes the key to a position on the ring',
        'Router walks clockwise to find the first node past that position',
        'Router forwards the write to that node',
        'Node stores the value locally',
        'Node ACKs, router ACKs the client',
      ],
      closingNote: 'This works until that one node crashes - the data it owned is gone. We need copies.',
    },
    {
      title: 'FR2: GET - Reading Data with High Availability',
      body:
        "Storing a key on exactly one node means a single crash loses that data forever. The fix: replicate every partition onto multiple nodes.\n\nNew concept: Replication Factor (N), typically N=3 - every key is stored on 3 nodes, not just 1.",
      newComponents: [
        {
          name: 'Replica Nodes',
          description: 'Extra copies of a partition, kept on different nodes for failover reads and durability.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  router[Router]:::edge
  primary[Primary - Node 2]:::database
  r1[Replica 1 - Node 3]:::database
  r2[Replica 2 - Node 4]:::database

  client --> router --> primary
  primary -->|"replicate"| r1
  primary -->|"replicate"| r2`,
      },
      steps: [
        'Client calls GET(key)',
        'Router hashes the key to find the primary node',
        'Router sends the read to the primary',
        "Node checks its in-memory cache, then disk",
        'Value is returned to the client',
      ],
      closingNote:
        "If the primary is down, the router fails over to a replica - no downtime, no data loss. But this raises a question: when we write to 3 replicas, how many ACKs do we wait for before telling the client \"success\"? That's the consistency knob.",
    },
    {
      title: 'FR3: Tunable Consistency - The W and R Knobs',
      body:
        "Replication solved durability, but it introduces a choice: wait for all 3 replicas to ACK a write before calling it successful, or just 1? This is the classic consistency-versus-speed trade-off, and the answer is: let the caller decide per operation.\n\nA quorum means \"a majority must agree.\" We introduce two tunable knobs: W (write quorum) and R (read quorum). If W + R > N, every read is guaranteed to see the most recent write.",
      insightCallout:
        'Strong consistency: W=2, R=2 - always reads the latest value, slower writes. Fast writes: W=1, R=3 - write ACKs after 1 node, but a read must check all 3. Fast reads: W=3, R=1 - write waits for all 3, read hits any single node. Eventual consistency: W=1, R=1 - fastest, but might read stale data.',
      diagram: {
        title: 'FR3: Quorum Write with W=2',
        mermaid: `sequenceDiagram
  participant C as Client
  participant R as Router
  participant N1 as Node 1
  participant N2 as Node 2
  participant N3 as Node 3

  C->>R: PUT key=user:42 value=...
  R->>N1: write
  R->>N2: write
  R->>N3: write
  N1-->>R: ACK
  N2-->>R: ACK
  Note over R: W=2 met - respond now
  R-->>C: 200 OK
  N3-->>R: ACK (late)`,
      },
      closingNote:
        "This is the CAP trade-off in miniature: a full quorum sacrifices availability the moment any single node is unreachable. Tunable W/R lets each operation choose its own point on that spectrum - the same lever the Dynamo paper made famous. That completes the three core functional requirements. Now let's look at what can go wrong operationally.",
    },
  ],

  coreFlows: [
    {
      title: 'PUT with Quorum Write',
      diagram: {
        mermaid: `sequenceDiagram
  participant C as Client
  participant Ro as Router
  participant P as Primary
  participant R1 as Replica 1
  participant R2 as Replica 2

  C->>Ro: PUT key, value
  Ro->>P: write
  Ro->>R1: write
  Ro->>R2: write
  P->>P: append WAL, write memtable
  R1->>R1: append WAL, write memtable
  P-->>Ro: ACK
  R1-->>Ro: ACK
  Note over Ro: W=2 satisfied
  Ro-->>C: 200 OK
  R2-->>Ro: ACK (late)`,
      },
      nonObviousFailure:
        'If Replica 1 is briefly unreachable during the write, W=2 is still met via Primary + Replica 2 and the client gets a success response. The missed replica is not immediately consistent - it catches up later through read repair or a background anti-entropy pass, not through the write path itself.',
    },
    {
      title: 'GET with Quorum Read',
      diagram: {
        mermaid: `sequenceDiagram
  participant C as Client
  participant Ro as Router
  participant P as Primary
  participant R1 as Replica 1

  C->>Ro: GET key
  Ro->>P: read
  Ro->>R1: read
  P-->>Ro: value v42
  R1-->>Ro: value v41 (stale)
  Note over Ro: R=2 satisfied - return highest version
  Ro-->>C: value v42
  Ro->>R1: async read-repair push v42`,
      },
      nonObviousFailure:
        'A stale replica can return an older version than the primary. Quorum reads solve this by always returning the highest version seen among the R responses, then asynchronously pushing that version to the stale replica (read repair) - the client never sees the stale value, but the repair itself is fire-and-forget rather than blocking the response.',
    },
  ],

  deepDives: [
    {
      title: 'Consistent Hashing - What Happens When You Add or Remove a Node',
      problem:
        "Naive hashing - hash(key) % num_nodes - works fine until the cluster changes size. Add a 5th node to a 4-node cluster and the modulo shifts almost every key at once.",
      simpleTerms:
        'Picture the servers arranged in a circle instead of a numbered list. Keys go to whichever server is next going clockwise. Adding a server only affects the small slice of keys near it, not everyone. Giving each server multiple positions on the circle keeps the slices even instead of leaving some servers with lucky-sized (or unlucky) shares.',
      bad: "hash(key) % num_nodes. Going from 4 nodes to 5 changes almost every key's target node - roughly 80% of keys need to move across the network simultaneously, saturating bandwidth and stalling the cluster during the resize.",
      good: "Basic consistent hashing: place both nodes and keys on a hash ring (0 to 2^32), and route each key to the first node found walking clockwise. Adding a node now only remaps the keys between it and its predecessor - on average 1/N of the keyspace moves (about 20% for a 5th node), not 80%.",
      great:
        "Consistent hashing with virtual nodes, the technique DynamoDB popularized: give each physical node 100-200 positions scattered around the ring instead of one. This evens out the load - without virtual nodes, an unlucky hash placement can leave one physical node owning 60% of the ring while another owns almost none; with 100-200 positions per node, every physical node's share stays close to 1/N.",
      diagram: {
        mermaid: `flowchart LR
  key["key: user:42"]:::client
  ring{{"Hash Ring (0 - 2^32)"}}:::edge
  va1[Node A - vnode 1]:::database
  vb1[Node B - vnode 1]:::database
  va2[Node A - vnode 2]:::database
  vc1[Node C - vnode 1]:::database
  vb2[Node B - vnode 2]:::database

  key -->|"hash(key)"| ring
  ring -->|"walk clockwise"| vb1`,
      },
    },
    {
      title: 'Storage Engine - How a Single Node Stores Hundreds of GB',
      problem:
        'Each node needs to store hundreds of GB, sustain ~100K writes/sec, and still answer reads in single-digit milliseconds. The on-disk data structure you pick determines whether that is possible.',
      simpleTerms:
        'Instead of writing every change straight to its final spot on disk (slow, random access), buffer recent writes in memory and periodically flush them to disk in big, pre-sorted batches. Reads check the in-memory buffer first, then the sorted files on disk. This turns expensive random writes into cheap sequential ones - about 100x faster.',
      bad: 'One file per key chokes the filesystem once you have millions of keys. A B-tree index is great for reads, but random writes under high throughput are expensive - each write can mean multiple disk seeks to rebalance the tree.',
      good: 'An append-only log makes writes fast (pure sequential appends), but reads require scanning the whole log to find the latest value for a key. Adding an in-memory hash index (key -> byte offset) fixes read speed, but the log itself grows forever and is never compacted.',
      great:
        "The LSM Tree (Log-Structured Merge Tree): writes go to a Write-Ahead Log for crash recovery and an in-memory sorted memtable; once the memtable fills (~64MB), it's flushed to disk as an immutable, sorted SSTable; a background compaction process merges SSTables over time. Reads check the memtable first, use a Bloom filter to skip SSTables that definitely don't contain the key, then scan the SSTables that might. Sequential disk I/O is roughly 100x faster than random I/O, which is why LevelDB, RocksDB, and Cassandra all use this design.",
      diagram: {
        mermaid: `flowchart LR
  w[Write]:::client
  wal[("WAL - crash recovery")]:::async
  mem[["Memtable - in-memory, sorted"]]:::cache
  sst0[("SSTable L0 - on disk")]:::database
  sst1[("SSTable L1 - compacted")]:::database
  r[Read]:::client
  bloom{{"Bloom Filter"}}:::edge

  w --> wal
  w --> mem
  mem -->|"flush at ~64MB"| sst0
  sst0 -->|"compaction"| sst1
  r --> mem
  r --> bloom
  bloom -->|"maybe present"| sst0`,
      },
    },
    {
      title: 'Handling Node Failures - Keeping the Cluster Consistent After an Outage',
      problem:
        'In a 100-node cluster, node failures are routine, not exceptional. The system has to keep serving reads and writes without losing data - and a recovered node has to catch back up without a full data copy.',
      simpleTerms:
        'Three ways to catch a recovered server back up: replay the writes it missed (saved as temporary hints elsewhere), fix mismatches opportunistically whenever a read happens to touch the stale data, or periodically compare hash summaries between servers to find and sync exactly the keys that drifted.',
      bad: 'A down node\'s keys are simply unavailable until it comes back - writes to that node fail outright, and reads that would have hit it error out.',
      good: "Replication (N=3) means the remaining replicas keep serving reads and writes while a node is down. But when it recovers, it's stale - it missed every write during the outage and has no record of what it missed.",
      great:
        'Combine three self-healing mechanisms. Hinted Handoff stores writes meant for a down node temporarily on another node, then replays them once it recovers - handles short outages instantly. Read Repair detects version mismatches whenever a read happens to touch both a fresh and a stale replica, and pushes the latest version to the stale one in the background. Anti-Entropy via Merkle Trees handles long outages: two nodes compare hash trees of their data, narrowing down to the specific divergent key ranges in O(log N) comparisons instead of transferring or diffing the entire dataset.',
      diagram: {
        mermaid: `sequenceDiagram
  participant N2 as Node 2 (recovering)
  participant N1 as Node 1

  N2->>N1: compare Merkle trees?
  N1-->>N2: root hash abc123
  N2->>N2: local root hash xyz789 - mismatch
  N2->>N1: which subtree diverges?
  N1-->>N2: keys user:42, user:99 differ
  N1->>N2: push latest values for user:42, user:99
  Note over N2: Node 2 now consistent`,
      },
    },
    {
      title: 'Conflict Resolution - Two Clients Write the Same Key at Once',
      problem:
        'Under eventual consistency, two clients can write the same key to different replicas at nearly the same time. When those replicas later compare notes, which value should win?',
      simpleTerms:
        'Vector clocks tag every write with a per-server counter, so the system can tell "B happened after A, keep B" apart from "A and B happened at the same time on different servers, they truly conflict" - only the second case needs a real decision.',
      bad: "Last-writer-wins by wall-clock timestamp. If the two servers' clocks are even slightly skewed, the write with the \"later\" timestamp can actually be the older one - silently discarding real data.",
      good: 'LWW with NTP-synchronized clocks. Reduces but does not eliminate clock-skew data loss - acceptable for use cases where losing an occasional write is tolerable, like caching or session data.',
      great:
        "Vector clocks: each write carries a counter per node that touched the key. Comparing two versions' vectors tells you whether one strictly descends from the other (safe to keep the newer one) or whether they diverge (a true concurrent conflict). DynamoDB's approach for true conflicts is to return both versions to the client and let the application decide; an alternative is merging automatically with CRDTs (Conflict-free Replicated Data Types). In an interview, it's reasonable to say: we'd use LWW with versioning for simplicity, but for critical data we'd use vector clocks.",
    },
  ],

  selfAudit: [
    {
      question: 'Single points of failure?',
      answer:
        'The coordinator uses ZooKeeper (itself replicated) or a gossip protocol (no single coordinator at all). Storage nodes are replicated at N=3, so no single node holds the only copy of any key.',
    },
    {
      question: 'Hot keys?',
      answer:
        'A single very popular key can overload the node that owns it. Mitigate with a client-side cache in front of the store, or by splitting the hot key into sub-shards (key#0, key#1, ...) and merging results.',
    },
    {
      question: 'Data freshness?',
      answer:
        'Quorum reads (with W+R>N) always return the most recent write. Reads with a smaller R (eventual consistency) can lag by milliseconds to seconds.',
    },
    {
      question: 'Network partitions?',
      answer:
        "A full quorum favors consistency (CP): the minority side of a partition can't serve requests. Configuring a smaller W/R favors availability (AP) at the cost of temporarily stale reads - tunable per operation.",
    },
    {
      question: 'Cost at scale?',
      answer:
        '10TB of data at 3x replication is 30TB raw. At roughly $0.10/GB/month for SSD storage plus compute, that is around $3,000/month for storage and compute across 100 nodes.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  router["Router Layer - consistent hash ring"]:::edge
  n1[Node 1]:::database
  n2[Node 2]:::database
  n3[Node 3]:::database
  n4[Node 4]:::database
  n5[Node 5]:::database
  n6[Node 6]:::database
  coord[("Coordinator - ZooKeeper")]:::async

  client -->|"GET / PUT"| lb --> router
  router --> n1
  router --> n2
  router --> n3
  router --> n4
  router --> n5
  router --> n6
  coord -.->|"membership"| n1
  coord -.-> n2
  coord -.-> n3
  coord -.-> n4
  coord -.-> n5
  coord -.-> n6`,
  },

  keyTechnologies: [
    {
      term: 'Consistent Hashing',
      definition:
        'Ring-based mapping of keys and nodes that minimizes reshuffling when the cluster resizes. Used by DynamoDB, Cassandra, Redis Cluster.',
    },
    { term: 'Replication Factor (N)', definition: 'Number of copies stored per key. N=3 survives 2 simultaneous node failures.' },
    {
      term: 'Quorum (W+R>N)',
      definition: 'Tunable knob requiring a majority of replicas to agree, trading consistency against latency per operation.',
    },
    {
      term: 'LSM Tree',
      definition: 'Write-optimized storage engine using sequential appends and background compaction. Used by LevelDB, RocksDB, Cassandra.',
    },
    {
      term: 'Bloom Filter',
      definition: 'Probabilistic structure that answers "definitely not present" or "maybe present," letting reads skip SSTables that cannot contain a key.',
    },
    { term: 'WAL (Write-Ahead Log)', definition: 'Append-only log written before an in-memory update, used to recover state after a crash.' },
    {
      term: 'Vector Clock',
      definition: 'Per-node counters that track write causality and detect genuinely concurrent conflicting writes between replicas.',
    },
    {
      term: 'Merkle Tree',
      definition: 'Hash tree that lets two replicas find their differences in O(log N) comparisons instead of diffing every key.',
    },
  ],

  expectedDepth: {
    mid: 'Propose basic GET/PUT distributed across multiple machines. Explain consistent hashing at a high level - keys and nodes on a ring. Suggest N=3 replication for durability. With prompting, explain why hash(key) % num_nodes breaks when the cluster resizes.',
    senior:
      'Introduce virtual nodes for even load distribution. Explain quorum reads/writes (W+R>N) and the consistency-versus-latency trade-off. Justify LSM trees over B-trees for write-heavy workloads. Connect the design to CAP theorem - AP with tunable consistency. Describe read repair as a self-healing mechanism.',
    staffPlus:
      'Cover vector clocks for conflict detection, Merkle-tree anti-entropy, and hinted handoff for node recovery. Support per-operation tunable consistency. Discuss LSM write amplification and compaction cost trade-offs. Address hot-key mitigation and the operational complexity of 100+ node clusters - gossip convergence, partition handling, rebalancing.',
  },

  keyTakeaways: [
    'Consistent hashing distributes data evenly and minimizes reshuffling when nodes are added or removed',
    'Replication (N=3) provides fault tolerance - lose a node, the data survives on its replicas',
    'Quorum (W+R>N) lets you tune the consistency-versus-speed trade-off on a per-operation basis',
    'LSM trees make writes fast by converting random disk I/O into sequential appends',
    'This pattern - partition, replicate, quorum, LSM storage - underpins almost every distributed database',
  ],

  relatedDesigns: ['rate-limiter', 'real-time-leaderboard', 'url-shortener'],
  relatedConcepts: [
    { name: 'Consistent Hashing', description: 'Places keys on a ring so adding or removing nodes reshuffles only a minimal slice of the keyspace.' },
    { name: 'CAP Theorem', description: 'Frames the availability-versus-consistency choice a distributed store must make under a network partition.' },
    { name: 'Merkle Trees', description: 'Power efficient anti-entropy repair between replicas by comparing hash trees instead of full datasets.' },
    { name: 'Vector Clocks', description: 'Detect and help reconcile concurrent, conflicting writes to the same key.' },
    { name: 'Database Replication', description: 'N-way replication with quorum reads/writes underlies the store\'s durability and availability.' },
  ],

  simulator: {
    goalDescription: 'Store and retrieve arbitrary key-value pairs across a partitioned, replicated cluster with tunable read/write consistency.',
    requirementChips: ['1.5M ops/sec', 'Sub-10ms P99', 'N=3 replication'],
    targetRps: 1500000,
    readRatio: 0.67,
    cacheHitRatio: 0,
    latencyBudgetMsP99: 10,
    rubric: [
      { id: 'lb-edge', label: 'Load balancer at the edge', kind: 'requires-node-type', nodeType: 'load-balancer' },
      {
        id: 'router-layer',
        label: 'Routing layer implementing the consistent-hash ring',
        kind: 'requires-node-type',
        nodeType: ['api-gateway', 'load-balancer'],
      },
      {
        id: 'storage-nodes',
        label: 'Partitioned, replicated storage nodes',
        kind: 'requires-node-type',
        nodeType: ['cassandra', 'dynamodb', 'mongodb'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-node', label: 'No single point of failure across the storage fleet', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 10, position: { x: 320, y: 200 } },
        { id: 'router-1', type: 'api-gateway', instanceCount: 40, position: { x: 600, y: 200 } },
        { id: 'storage-1', type: 'cassandra', instanceCount: 100, position: { x: 880, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-router', source: 'lb-1', target: 'router-1' },
        { id: 'e-router-storage', source: 'router-1', target: 'storage-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The router layer hashes each key onto a consistent-hash ring and forwards to the owning storage node and its N=3 replicas; at this scale the storage fleet mirrors the 100+ node clusters this design discusses operationally, each running an LSM-tree engine to sustain heavy write throughput.',
    failureModeNarratives: {
      'load-balancer':
        'A single load-balancer/router edge tier stands between all clients and the storage fleet; if it fails, no request reaches any storage node even though the underlying data is still fully replicated and healthy.',
    },
    fullDesignLinkSlug: 'key-value-store',
  },
}

export default topic
