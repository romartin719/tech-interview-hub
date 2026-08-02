import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'unique-id-generator',
  title: 'Unique ID Generator',
  difficulty: 'Beginner',
  icon: 'pi pi-hashtag',
  color: '#6366f1',
  readTimeMinutes: 15,
  topics: ['Snowflake IDs', 'Clock Synchronization', 'Distributed Coordination'],
  companies: ['Twitter', 'Discord', 'Instagram', 'Amazon', 'Flipkart'],
  prerequisites: ['Back-of-Envelope Estimation'],
  summary:
    "Generate globally unique, roughly time-sorted, 64-bit IDs without a single point of failure. Twitter's Snowflake approach (timestamp + machine ID + sequence) is the industry standard for most use cases.",

  understandingProblem:
    'Almost every system needs unique identifiers. User IDs, order IDs, message IDs, transaction IDs - they must be globally unique across all servers, ideally sortable by creation time, and generated with extremely low latency (< 1ms). The challenge is generating these at scale (10K-100K IDs/sec) across multiple machines without coordination or collisions.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  s1[Server 1]:::compute
  s2[Server 2]:::compute
  db[("Single DB - AUTO_INCREMENT")]:::database
  s1 --> db
  s2 --> db`,
    },
    whyThisBreaks: [
      'Single point of failure - if the DB goes down, no service can generate IDs',
      'Bottleneck - all ID generation is serialized through one DB',
      "Can't scale horizontally - adding more app servers doesn't help, the DB is the limit",
      'Sequential and guessable - exposes total count, easy to scrape',
      'Cross-datacenter latency - if services are in multiple regions, every ID requires a round-trip to one DB',
    ],
    closingNote: 'The rest of the doc explores 4 production-ready alternatives.',
  },

  priorArt: [
    {
      title: 'Twitter Snowflake',
      description:
        'The original distributed ID generator. 64-bit IDs composed of timestamp + datacenter + machine + sequence. Open-sourced in 2010, now the de facto standard. (Twitter Engineering Blog)',
      link: 'https://blog.x.com/engineering/en_us/a/2010/announcing-snowflake',
    },
    {
      title: 'Instagram Sharded IDs',
      description:
        'Modified Snowflake using Postgres schemas to embed shard information into IDs. Generates IDs at the DB layer without a separate service. (Instagram Engineering)',
      link: 'https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c',
    },
    {
      title: 'Discord Snowflakes',
      description:
        "Twitter Snowflake adapted for Discord with epoch starting at Discord's launch date. Used for messages, users, channels. (Discord Developer Docs)",
      link: 'https://discord.com/developers/docs/reference#snowflakes',
    },
    {
      title: 'MongoDB ObjectId',
      description:
        '12-byte ID with timestamp + random + counter. No central coordination needed. Demonstrates the random + counter hybrid approach. (MongoDB Docs)',
      link: 'https://www.mongodb.com/docs/manual/reference/method/ObjectId/',
    },
  ],

  coreEntities: [
    { name: 'ID', description: 'The 64-bit unique identifier itself.' },
    { name: 'Node', description: 'A machine/process that generates IDs (identified by a machine ID).' },
    { name: 'Timestamp', description: 'Millisecond-precision time component within the ID.' },
    { name: 'Sequence', description: 'Per-node counter that resets each millisecond.' },
  ],

  requirements: {
    core: [
      'Generate globally unique IDs - no two IDs should ever collide across all services and servers',
      'IDs must be 64-bit numeric - fits in a long/bigint, can be used as primary keys and sorted efficiently',
      'Roughly time-ordered - IDs generated later should be larger than IDs generated earlier (enables range queries and chronological sorting)',
    ],
    belowTheLine: [
      'Human-readable (short URLs, display-friendly)',
      'Cryptographically unpredictable',
      'Embeddable shard/partition information',
      'Custom epoch support',
    ],
    nonFunctionalTable: [
      { metric: 'Throughput', target: '10K-100K IDs/sec per node' },
      { metric: 'Latency', target: '< 1ms per ID generation' },
      { metric: 'Availability', target: '99.999% - ID generation cannot be a single point of failure' },
      { metric: 'Uniqueness', target: 'Zero collisions, ever, across all nodes' },
    ],
  },

  technologyChoices: [
    {
      tier: 'ID Algorithm',
      purpose: 'Core ID generation logic',
      primaryPick: 'Snowflake (timestamp + machine + seq)',
      alternatives: 'UUIDv7, Sonyflake, ULID, DB range allocation',
      whyPrimaryWins: '64-bit, time-sorted, no coordination, 10K+ IDs/ms per node',
    },
    {
      tier: 'Coordination',
      purpose: 'Machine ID assignment',
      primaryPick: 'ZooKeeper',
      alternatives: 'etcd, Consul, Kubernetes lease',
      whyPrimaryWins: 'Guarantees unique machine IDs across the fleet; fast failover',
    },
    {
      tier: 'Timestamp Source',
      purpose: 'Clock accuracy',
      primaryPick: 'NTP-synced system clock',
      alternatives: 'GPS clock, PTP, Atomic clock',
      whyPrimaryWins: 'Good enough for ms precision; GPS/atomic only needed for sub-us',
    },
    {
      tier: 'Backup/Range Store',
      purpose: 'Fallback ID ranges when Snowflake is unavailable',
      primaryPick: 'Postgres',
      alternatives: 'MySQL, DynamoDB, etcd',
      whyPrimaryWins: 'Simple atomic range allocation with SELECT ... FOR UPDATE',
    },
  ],
  technologyChoicesNote:
    'Why Snowflake over UUID? UUIDs are 128-bit (wastes index space) and not sortable by time. Snowflake gives 64-bit IDs that fit in a database bigint, sort chronologically, and encode the generating machine - all without network round-trips for each ID.',

  scaleEstimation: [
    'Throughput target: 10K-100K IDs/sec per node (per NFR); a single Snowflake node alone delivers up to 4M IDs/sec',
    'Node capacity: 5 bits datacenter + 5 bits machine = 1024 total nodes addressable in the ID space (32 datacenters x 32 machines)',
    'ID lifespan: 41-bit timestamp gives ~69 years of IDs from a custom epoch before overflow',
    'Latency: < 1ms per ID, achieved with zero network calls or DB round-trips in the Snowflake path',
  ],

  apiInterface: [],

  highLevelDesignIntro:
    "This design doesn't build up through sequential functional requirements - it's best explored as four alternative approaches to generating unique IDs, each trading off coordination, throughput, and ordering guarantees differently.",

  builds: [
    {
      title: 'Approach 1: UUID',
      body:
        '128-bit random identifier (e.g. 550e8400-e29b-41d4-a716-446655440000). No coordination needed - any server can generate one independently.\n\nPros: zero coordination, any node generates independently, zero collisions in practice, simple to implement. Cons: 128 bits is too large for a primary key with poor index performance, not sortable by time, not human-friendly, and produces fragmented B-tree indexes because the values are in random order.',
      diagram: {
        mermaid: `flowchart LR
  s1[Server 1]:::compute
  s2[Server 2]:::compute
  id1[("UUID<br/>550e8400-e29b-41d4-...")]:::storage
  id2[("UUID<br/>6ba7b810-9dad-11d1-...")]:::storage
  s1 -->|"generate locally"| id1
  s2 -->|"generate locally"| id2`,
      },
      closingNote:
        "Verdict: use for cases where time-ordering doesn't matter and you don't need compact IDs (e.g., idempotency keys, distributed trace IDs).",
    },
    {
      title: 'Approach 2: Database Ticket Server',
      body:
        'Two (or more) databases hand out IDs from disjoint ranges: Server 1 increments by 2 starting at 1 (odd IDs), Server 2 increments by 2 starting at 2 (even IDs). No collisions.\n\nPros: simple to understand, numeric and sortable, and proven at scale (Flickr used this pattern). Cons: still requires a DB round-trip per ID, adding a 3rd server requires changing the step size (breaks the existing pattern), and IDs are not truly time-ordered across servers.',
      diagram: {
        mermaid: `flowchart LR
  svc[Service]:::compute
  db1[("Ticket Server 1<br/>IDs: 1 3 5 7 ...")]:::database
  db2[("Ticket Server 2<br/>IDs: 2 4 6 8 ...")]:::database
  svc -->|"1. Get odd ID"| db1
  svc -->|"2. Get even ID"| db2`,
      },
      closingNote:
        "Verdict: works for small-medium scale. Flickr used this pattern, but it's inflexible when adding or removing nodes.",
    },
    {
      title: 'Approach 3: Snowflake (Industry Standard)',
      body:
        'A 64-bit ID composed of multiple fields packed into a single long integer: 1 bit unused | 41 bits timestamp | 5 bits datacenter | 5 bits machine | 12 bits sequence.\n\nPros: no coordination at runtime, time-sorted, 64-bit and compact, 4M IDs/sec/node. Cons: requires machine ID assignment (one-time setup via ZooKeeper or config), clock skew between machines can cause non-monotonic ordering, a 69-year lifespan (enough for most systems), and it needs NTP sync to prevent clock drift.',
      insightCallout:
        'Why this is great: no coordination - each machine generates independently using its own machine ID; time-sorted - IDs increase over time because the timestamp occupies the most significant bits; 64-bit - fits in a bigint with great index performance; high throughput - 4M IDs/sec per node without any network calls; unique - machine ID + sequence guarantees no collision within the same millisecond.',
      diagram: {
        mermaid: `flowchart LR
  subgraph sf["64-bit Snowflake ID"]
    a["0<br/>unused"]:::client
    b["41 bits<br/>timestamp ms"]:::edge
    c["5 bits<br/>datacenter"]:::compute
    d["5 bits<br/>machine"]:::compute
    e["12 bits<br/>sequence"]:::storage
  end`,
      },
      steps: [
        '41 bits for timestamp - milliseconds since a custom epoch (e.g., Twitter uses Nov 4, 2010), giving ~69 years of IDs before overflow',
        '5 bits datacenter ID - supports 32 datacenters',
        '5 bits machine ID - supports 32 machines per datacenter (1024 total nodes)',
        '12 bits sequence - counter per millisecond per machine, supporting 4096 IDs/ms/machine = 4 million IDs/sec per machine',
      ],
      closingNote:
        "Clock skew handling: if the system clock moves backward (NTP correction), either wait until the clock catches up, or refuse to generate IDs until the clock advances past the last timestamp used. Twitter's Snowflake logs an error and waits.",
    },
    {
      title: 'Approach 4: Range-Based Allocation',
      body:
        'A central service pre-allocates ID ranges to application servers. Each server generates IDs from its range without further coordination.\n\nPros: very fast (local increment), simple implementation, the central allocator is low-QPS since it is called rarely, and this is the pattern Google Spanner uses. Cons: IDs are not time-sorted across servers, unused IDs are wasted if a server crashes mid-range, the allocator is still a SPOF (mitigate with replicas), and it is not as compact as Snowflake.',
      diagram: {
        mermaid: `flowchart LR
  alloc["Range Allocator<br/>central service"]:::async
  s1["Server 1<br/>range: 1-1000"]:::compute
  s2["Server 2<br/>range: 1001-2000"]:::compute
  s3["Server 3<br/>range: 2001-3000"]:::compute
  alloc -->|"1. Assign range 1-1000"| s1
  alloc -->|"2. Assign range 1001-2000"| s2
  alloc -->|"3. Assign range 2001-3000"| s3`,
      },
      steps: [
        'Central allocator (backed by a DB) hands out ranges of 1000 or 10000 IDs at a time',
        'Each app server increments locally within its range - zero network calls per ID',
        'When a range is exhausted, fetch a new range from the allocator',
        'If a server crashes mid-range, those unused IDs are simply wasted (acceptable)',
      ],
      closingNote:
        'Comparison across all four approaches - UUID: 128 bits, not time-sorted, no coordination, unlimited throughput, best for trace IDs and idempotency keys. Ticket Server: 64 bits, partially time-sorted, needs a DB round-trip per ID, ~10K/sec, best for small-medium scale. Snowflake: 64 bits, time-sorted, no coordination at runtime, 4M/sec, best for most use cases. Range Allocation: 64 bits, time-sorted only within a node, rare coordination (per range), unlimited throughput, best for sharded DBs like Google Spanner. For most interview answers, Snowflake is the recommended default.',
    },
  ],

  coreFlows: [
    {
      title: 'Recommended: Snowflake ID Generation Flow',
      diagram: {
        title: 'Snowflake ID Generation (Sequence)',
        mermaid: `sequenceDiagram
  participant App as Application
  participant Gen as ID Generator (local)
  participant Clock as System Clock

  App->>Gen: generateId()
  Gen->>Clock: currentTimeMillis()
  Clock-->>Gen: timestamp
  Gen->>Gen: check if same ms as last ID
  alt Same millisecond
    Gen->>Gen: increment sequence
  else New millisecond
    Gen->>Gen: reset sequence to 0
  end
  Gen->>Gen: compose: timestamp | datacenter | machine | sequence
  Gen-->>App: 64-bit unique ID`,
        bullets: ['No network calls. No DB lookups. Pure local computation.'],
      },
      nonObviousFailure:
        "What if the System Clock's currentTimeMillis() call returns a value earlier than the last timestamp this generator used (an NTP backward correction)? The naively composed ID would then collide with, or sort behind, an ID already issued a moment earlier. See the Clock Skew deep dive for how Snowflake implementations detect and handle this.",
    },
  ],

  deepDives: [
    {
      title: 'Machine ID Assignment',
      problem:
        "Each node needs a unique machine ID (10 bits = 1024 possible). How do you assign these without collisions? If two machines accidentally get the same ID, they'll generate duplicate IDs.",
      simpleTerms:
        'Before a machine can start generating IDs, it needs a name tag (its machine ID). We need to make sure no two machines wear the same name tag.',
      bad:
        'Hardcode machine IDs in config files. "Server A = machine 1, Server B = machine 2." Error-prone - someone deploys a new server and forgets to update the config. Doesn\'t work with auto-scaling (Kubernetes spinning up pods dynamically).',
      good:
        "Use ZooKeeper or etcd. Each node, on startup, connects to ZooKeeper and claims the next available sequential ID via an ephemeral node. If the node crashes, ZooKeeper detects the missing heartbeat and releases the ID for reuse.\n\nHow it works step by step: the node starts up and connects to ZooKeeper; it creates an ephemeral sequential node (e.g. /id-generators/machine-0007); it reads its sequence number (7) as its machine ID; if the node crashes, ZooKeeper auto-deletes the ephemeral node; the next node to start gets the recycled ID.",
      great:
        'Use the network interface MAC address or container hostname hash to derive a machine ID - no external dependency at all.\n\nHow it works: take the machine\'s MAC address (unique per network card, e.g. AA:BB:CC:DD:EE:FF); hash it and mod by 1024 to get a machine ID (e.g. hash("AA:BB:CC:DD:EE:FF") % 1024 -> machine ID = 547); on startup, register this ID in a shared store (Redis or DB) to verify no collision; if a collision is detected (extremely rare), fall back to random plus retry.\n\nTrade-off: the ZooKeeper approach is safer (guarantees uniqueness) but adds an external dependency. MAC-based is simpler but theoretically collision-possible (hash collisions). In practice, most companies use ZooKeeper/etcd because they already run it for other coordination tasks.',
    },
    {
      title: 'Clock Skew',
      problem:
        'NTP (the protocol that syncs your system clock with the internet) can adjust the clock backward. If timestamp decreases, two IDs could have the same timestamp + sequence = collision.',
      simpleTerms:
        "Imagine your clock shows 10:05, then suddenly jumps back to 10:03 (because NTP realized it was 2 minutes ahead). Now the ID generator thinks it's 10:03 again and might generate the same IDs it made the first time at 10:03. Duplicate IDs.",
      bad:
        'Ignore it. Hope clocks are always correct. "NTP adjustments are rare." True - but when it happens, you get duplicate IDs in your database, corrupt data, and a very bad day debugging.',
      good:
        'Detect backward clock movement. The generator tracks lastTimestamp (the timestamp it used for the most recent ID). Before generating a new ID, check: if currentTime < lastTimestamp, refuse to generate and wait until the clock catches up.\n\nHow it works: the generator keeps lastTimestamp = 10:05:00.123; the next call gets currentTime = 10:04:59.900 (clock went back); the generator detects current < last, so clock skew is flagged; options are (a) spin-wait doing nothing until currentTime >= lastTimestamp, or (b) throw an error and let the caller retry later; once the clock catches up, generation resumes normally.\n\nDownside: during the wait, no IDs are generated. If the clock was adjusted back by 5 seconds, that is 5 seconds of downtime for that node.',
      great:
        'Use a logical clock component. Instead of waiting, "borrow from the future" by continuing to increment the sequence counter even though the timestamp hasn\'t advanced. Eventually the real clock catches up and things normalize.\n\nHow it works: when the clock goes back, keep using the old, higher lastTimestamp; keep incrementing the sequence counter (which normally resets each millisecond, but now keeps growing); if the sequence overflows (hits 4096), a wait becomes unavoidable; in practice, a 1-2 second clock adjustment only "borrows" about 4096 sequences - well within limits.\n\nWhat Twitter\'s Snowflake actually does: logs an error to alert ops, then waits. They chose simplicity over cleverness - a few milliseconds of waiting is better than complex "borrowing" logic that\'s hard to reason about.',
    },
    {
      title: 'Scaling Beyond 4M IDs/sec',
      problem:
        'One Snowflake node generates 4M IDs/sec (4096 per millisecond). What if you need 100M/sec? (e.g., a messaging platform generating IDs for every single message across billions of conversations)',
      simpleTerms:
        'One machine can make 4 million IDs per second. What if that\'s not enough? How do you get 100 million per second?',
      bad:
        'Make the sequence field larger (e.g., 16 bits = 65,536/ms). But this steals bits from the timestamp, reducing the 69-year lifespan to ~4 years. Or it steals from the machine ID, reducing max nodes from 1024 to 64.',
      good:
        'Run multiple Snowflake instances. The bit layout already supports 1024 machines (10 bits for datacenter + machine). Deploy 25 machines x 4M/sec each = 100M/sec. Each machine has a unique ID, so no collisions.\n\nHow it works: deploy 25 ID generator instances (each with a unique machine ID); put them behind a load balancer; services request IDs from any instance (round-robin); each instance generates 4M/sec independently; total throughput is 25 x 4M = 100M/sec; zero coordination between instances at runtime.',
      great:
        'For extreme scale beyond 1024 machines, use the range-based approach as a hybrid. A central allocator hands out blocks of Snowflake machine IDs dynamically. Each "micro-generator" thread gets its own machine ID from the pool, generates IDs locally, and returns the machine ID when done.\n\nWhen is this needed? In practice, almost never. Even Twitter at peak (~140K tweets/sec plus internal IDs) only needed a handful of Snowflake nodes. The 4M/sec per-node limit is extremely generous - most companies never hit it.',
    },
  ],

  selfAudit: [
    {
      question: 'Why not UUID?',
      answer: "128 bits, not sortable, bad index performance. Use when time-ordering isn't needed.",
    },
    {
      question: 'Why not auto-increment?',
      answer: "Single DB bottleneck, SPOF, can't scale horizontally, sequential = guessable.",
    },
    {
      question: "What's Snowflake?",
      answer: '64-bit ID = timestamp(41) + datacenter(5) + machine(5) + sequence(12). No coordination. 4M IDs/sec/node.',
    },
    {
      question: 'How is uniqueness guaranteed?',
      answer: 'Unique machine ID ensures no two nodes produce the same bits. Sequence resets per millisecond per node.',
    },
    {
      question: 'What about clock skew?',
      answer: 'Detect backward movement, wait until clock catches up. Or use a logical clock.',
    },
    {
      question: 'How to assign machine IDs?',
      answer: 'ZooKeeper, etcd, or derive from MAC/hostname hash with collision check.',
    },
    {
      question: 'Is it truly globally unique?',
      answer: "Yes - as long as machine IDs are unique and clocks don't go backward without detection.",
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  app[Application Services]:::client
  lb[Load Balancer]:::edge
  g1["ID Generator 1<br/>Snowflake"]:::compute
  g2["ID Generator 2<br/>Snowflake"]:::compute
  gn["ID Generator N<br/>Snowflake"]:::compute
  zk[("ZooKeeper<br/>machine-ID registry")]:::database
  ntp[NTP time sync]:::async

  app -->|"Request unique ID"| lb
  lb -->|"Route"| g1
  lb -->|"Route"| g2
  lb -->|"Route"| gn
  g1 -->|"Claim machine ID"| zk
  g2 -->|"Claim machine ID"| zk
  gn -->|"Claim machine ID"| zk
  ntp -->|"Clock sync"| g1
  ntp -->|"Clock sync"| g2
  ntp -->|"Clock sync"| gn`,
    bullets: [
      'Each generator produces IDs locally with zero runtime coordination (4M/sec/node)',
      'ZooKeeper is touched only once per node at startup for machine-ID assignment',
      'NTP prevents the clock skew that the Clock Skew deep dive addresses',
      'Add nodes to scale past 4M/sec (see the Scaling Beyond 4M IDs/sec deep dive)',
    ],
  },

  keyTechnologies: [
    {
      term: 'Snowflake ID',
      definition:
        '64-bit ID composed of 1 bit unused + 41 bits timestamp + 5 bits datacenter + 5 bits machine + 12 bits sequence. No coordination needed at runtime.',
    },
    {
      term: 'Machine ID',
      definition:
        '10-bit identifier (5 bits datacenter + 5 bits machine) assigned to each node; must be unique across the fleet to avoid collisions.',
    },
    {
      term: 'Sequence Counter',
      definition:
        'Per-node counter that increments within the same millisecond and resets to 0 on the next millisecond; supports 4096 IDs/ms/machine.',
    },
    {
      term: 'Ephemeral Sequential Node (ZooKeeper/etcd)',
      definition:
        'A node type that claims the next available machine ID on startup and is auto-deleted, freeing the ID, if the owning process crashes.',
    },
    {
      term: 'Clock Skew',
      definition:
        "Backward movement of a node's system clock (e.g., from an NTP correction) that can cause duplicate or out-of-order IDs if not detected.",
    },
    {
      term: 'Range-Based Allocation',
      definition:
        'A central allocator hands out disjoint blocks of IDs to servers, which increment locally with zero per-ID network calls (used by Google Spanner).',
    },
  ],

  expectedDepth: {
    mid:
      'Know that auto-increment doesn\'t scale. Propose UUID or Snowflake. Explain the Snowflake bit layout and why 64-bit time-sorted IDs are preferred over 128-bit random UUIDs for database primary keys. Understand the trade-offs table.',
    senior:
      'Drive the discussion on clock skew handling, machine ID assignment strategies, and when to choose Snowflake vs range-based allocation. Discuss the index performance implications of random vs sequential IDs. Know that Twitter, Discord, and Instagram all use Snowflake variants.',
    staffPlus:
      'Discuss multi-region ID generation with region bits, capacity planning for the 69-year timestamp limit, and hybrid approaches for extreme throughput. Address the operational burden of ZooKeeper for machine ID assignment vs stateless alternatives. Cover how Snowflake IDs leak creation time (a privacy concern for some products).',
  },

  keyTakeaways: [
    'Auto-increment is the naive solution - breaks at scale, SPOF, guessable',
    'Snowflake is the industry standard - 64-bit, time-sorted, no coordination, 4M IDs/sec/node',
    "UUID when ordering doesn't matter - trace IDs, idempotency keys",
    'Range allocation for extreme scale - Google Spanner pattern, trades ordering for simplicity',
    'Clock skew is the main operational risk - detect and wait is the standard mitigation',
  ],

  relatedDesigns: ['url-shortener', 'pastebin', 'key-value-store'],
  relatedConcepts: [
    { name: 'Consistent Hashing', description: 'Assigns ID ranges or worker nodes so generators never collide.' },
    { name: 'Leader Election', description: 'Coordinates the authority that hands out node IDs and epochs.' },
    { name: 'Database Replication', description: "Durably persists allocated ID ranges so restarts don't reissue IDs." },
  ],

  simulator: {
    goalDescription: 'Generate globally unique, roughly time-sorted 64-bit IDs at high throughput with zero per-request coordination.',
    requirementChips: ['100K IDs/sec', '< 1ms per ID', 'No SPOF'],
    targetRps: 100000,
    readRatio: 0,
    cacheHitRatio: 0,
    latencyBudgetMsP99: 1,
    rubric: [
      { id: 'lb-edge', label: 'Load balancer distributing ID requests', kind: 'requires-node-type', nodeType: 'load-balancer' },
      {
        id: 'id-gen-compute',
        label: 'Stateless ID Generator compute tier (Snowflake nodes)',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      {
        id: 'machine-id-registry',
        label: 'Machine-ID coordination store (ZooKeeper/etcd)',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-generator', label: 'No single point of failure - multiple generator nodes', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'gen-1', type: 'app-server', instanceCount: 8, position: { x: 600, y: 200 } },
        { id: 'zk-1', type: 'dynamodb', instanceCount: 3, position: { x: 880, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-gen', source: 'lb-1', target: 'gen-1' },
        { id: 'e-gen-zk', source: 'gen-1', target: 'zk-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Each ID Generator node computes Snowflake IDs entirely locally (timestamp + machine ID + sequence) with zero per-request network calls; the coordination store is touched only once at startup to claim a unique machine ID, so it never sits on the hot path.',
    failureModeNarratives: {
      'load-balancer':
        'A single load balancer instance routes every ID request; even though the generator nodes behind it are stateless and redundant, losing this one instance cuts off all application services from ID generation.',
    },
    fullDesignLinkSlug: 'unique-id-generator',
  },
}

export default topic
