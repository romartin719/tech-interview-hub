import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'pastebin',
  title: 'Pastebin / Text Sharing',
  difficulty: 'Beginner',
  icon: 'pi pi-file-edit',
  color: '#10b981',
  readTimeMinutes: 16,
  topics: ['Object Storage', 'ID Generation', 'CDN', 'TTL'],
  companies: ['Google', 'Amazon', 'Meta'],
  prerequisites: ['Caching', 'CDN'],
  summary:
    'A text-sharing service where anyone can paste content and get back a unique, non-guessable short URL - the canonical exercise in separating blob storage from metadata and caching immutable content at the edge.',

  understandingProblem:
    "Pastebin is a text-sharing service. You paste text (code snippets, logs, config files), get a unique short URL, and anyone with that URL can read the paste. No authentication needed to create or read. That's it - deceptively simple, but it covers real design concepts: unique ID generation, storage decisions, caching, and data lifecycle management.",
  realExamples: 'pastebin.com (18M+ pastes/month), GitHub Gist, Hastebin, Privatebin.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  user[User]:::client
  api[API Server]:::compute
  db[("Single DB - stores everything")]:::database
  user --> api
  api --> db`,
    },
    whyThisBreaks: [
      'Large pastes in DB - storing 10MB text blobs in a relational DB bloats the table, slows backups, and makes queries inefficient',
      'Sequential IDs - auto-increment exposes paste count and is guessable (scraping paste/1, paste/2, …)',
      'Single server - one machine handles both reads and writes. Traffic spike kills everything.',
      'No caching - every read hits the DB. With a 10:1 read-to-write ratio, the DB drowns.',
      'No expiry - pastes accumulate forever, storage grows unbounded',
    ],
    closingNote:
      'The rest of this walkthrough evolves this naive approach into a proper, scalable design - splitting content storage from metadata, adding a CDN, and generating short, non-guessable IDs.',
  },

  priorArt: [
    {
      title: 'GitHub Gist',
      description: 'Stores code snippets with Git-backed versioning. Content lives in object storage, metadata in Postgres.',
      link: 'https://github.blog/engineering/',
    },
    {
      title: 'Hastebin (haste-server)',
      description: 'Minimal open-source paste service. Shows that the core problem is just ID generation + blob storage + serve.',
      link: 'https://github.com/toptal/haste-server',
    },
    {
      title: 'Cloudflare Workers KV',
      description: 'Globally distributed key-value store with CDN-like read performance.',
      link: 'https://developers.cloudflare.com/kv/',
    },
  ],

  coreEntities: [
    { name: 'Paste', description: 'The content (text/code), up to 10MB.' },
    { name: 'Metadata', description: 'Paste ID, creation time, expiry time, language, owner (optional).' },
    { name: 'Short URL', description: 'The unique 7-character code that maps to a paste.' },
  ],

  requirements: {
    core: [
      'Create a paste - user submits text, gets back a unique short URL',
      'Read a paste - anyone with the URL can retrieve the content',
      'Expire pastes - pastes can have a TTL (1 hour, 1 day, 1 week, never)',
    ],
    belowTheLine: [
      'Syntax highlighting per language',
      'Edit/update an existing paste',
      'User accounts and "my pastes" list',
      'Password-protected pastes',
      'Raw content endpoint',
      'Strong consistency on analytics',
      'Multi-region deployment',
      'End-to-end encryption',
    ],
    nonFunctionalTable: [
      { metric: 'Read-heavy', target: '10:1 read-to-write ratio (10K reads/sec, 1K writes/sec)' },
      { metric: 'Low read latency', target: 'P99 < 100ms for paste retrieval' },
      { metric: 'Durability', target: 'Paste content must survive hardware failures (99.999%)' },
      { metric: 'Storage efficiency', target: 'Handle pastes up to 10MB cheaply' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Object Storage',
      purpose: 'Paste content blobs',
      primaryPick: 'S3',
      alternatives: 'GCS, Azure Blob, MinIO',
      whyPrimaryWins: 'Cheap, durable, handles 10MB blobs natively without bloating the DB',
    },
    {
      tier: 'Metadata DB',
      purpose: 'Paste metadata + expiry',
      primaryPick: 'Postgres',
      alternatives: 'MySQL, DynamoDB, CockroachDB',
      whyPrimaryWins: 'Relational simplicity for small rows; TTL index for expiry queries',
    },
    {
      tier: 'Cache',
      purpose: 'Hot paste reads',
      primaryPick: 'Redis',
      alternatives: 'Memcached, Caffeine, Varnish',
      whyPrimaryWins: 'Sub-ms reads for viral pastes; TTL eviction matches paste expiry',
    },
    {
      tier: 'CDN',
      purpose: 'Serve popular pastes at the edge',
      primaryPick: 'CloudFront',
      alternatives: 'Cloudflare, Fastly, Akamai',
      whyPrimaryWins: 'Immutable content = perfect cache hit ratio at the edge',
    },
    {
      tier: 'ID Generation',
      purpose: 'Short, unique paste URLs',
      primaryPick: 'Base62 (Snowflake/Counter)',
      alternatives: 'UUIDv7, NanoID, hashids',
      whyPrimaryWins: '64-bit numeric -> short URL, time-sorted, non-guessable',
    },
  ],
  technologyChoicesNote:
    "Why S3 over storing blobs in Postgres? Pastes up to 10MB in a database table cause table bloat, slow backups, and complicate write-ahead log replay. S3 offers essentially unlimited, affordable storage with very high durability, and since content is immutable once written, it's a perfect fit for object storage.",

  scaleEstimation: [
    'Write QPS: 1K new pastes/sec (peak during work hours)',
    'Read QPS: 10K reads/sec (10:1 ratio)',
    'Storage: 10TB paste content/year (avg paste ~1KB, max 10MB)',
    'Bandwidth: ~1 Gbps at peak for content delivery',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/pastes',
      description: 'Create a new paste.',
      example:
        '// Request\n{ "content": "...", "language": "python", "expiresIn": "1d", "title": "my snippet" }\n\n// Response 201\n{ "id": "abc12XY", "url": "https://paste.io/abc12XY", "expiresAt": "2026-07-22T10:00:00Z" }',
    },
    {
      method: 'GET',
      path: '/v1/pastes/{id}',
      description: "Retrieve a paste's content and metadata.",
      example:
        '// Response 200\n{ "id": "abc12XY", "content": "...", "language": "python", "createdAt": "2026-07-21T10:00:00Z", "expiresAt": "2026-07-22T10:00:00Z", "title": "my snippet" }',
    },
    {
      method: 'DELETE',
      path: '/v1/pastes/{id}',
      description: 'Delete a paste (requires ownership proof).',
      example: '// Request\nAuthorization: Bearer <token>\n\n// Response 204\nNo Content',
    },
  ],
  apiSecurityNote:
    'Creating pastes can be anonymous, but deleting requires ownership proof. Rate-limit creation by IP to prevent spam.',

  highLevelDesignIntro: "Let's build this incrementally, one functional requirement at a time.",

  builds: [
    {
      title: 'FR1: Create a Paste - Generating a Unique ID and Storing Content',
      body:
        'A user pastes text, clicks submit, and expects a short URL back. Under the hood the service has to generate a unique ID, store the content somewhere durable, and coordinate both writes.\n\nThe core problem: relational databases are not built for large blobs. Paste content can range from 1 byte to 10MB - stuffing that into a TEXT/BLOB column bloats the table.',
      insightCallout:
        'Paste content can be up to 10MB. Storing that in a relational DB makes the table enormous, slows backups, and makes queries inefficient - so content and metadata need to live in different stores.',
      newComponents: [
        {
          name: 'Paste Service',
          description:
            'The API layer that validates input and coordinates writes across the ID generator, object storage, and metadata DB.',
        },
        {
          name: 'ID Generator',
          description:
            'Produces unique, short, non-guessable IDs using Base62 encoding (7 chars = 3.5 trillion combinations).',
        },
        {
          name: 'Object Storage (S3/GCS)',
          description: 'Holds paste content as blobs. Pay-per-GB (~$0.023/GB/month), virtually unlimited.',
        },
        {
          name: 'Metadata DB (Postgres)',
          description:
            'Stores small rows (~200 bytes each) per paste - ID, timestamps, expiry, language - for fast lookups.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  user[User]:::client
  api[Paste Service]:::compute
  idgen[ID Generator]:::compute
  s3[("Object Storage")]:::storage
  db[("Metadata DB")]:::database

  user -->|"1. POST paste content"| api
  api -->|"2. Generate short ID"| idgen
  api -->|"3. Store paste text"| s3
  api -->|"4. Save paste metadata"| db`,
      },
      steps: [
        'User submits content and options via POST /v1/pastes',
        'Paste Service validates size (< 10MB) and rate limits by IP',
        'Service requests a short ID from the ID Generator',
        'Service writes the content to Object Storage using that ID as the key',
        'Service inserts a metadata row (id, timestamps, expiry, language) into the Metadata DB',
        'Service returns the generated URL to the user',
      ],
      closingNote:
        'If we put 10MB blobs in Postgres, the table would be 10TB and backups would take hours. Splitting storage from metadata keeps the DB lean and lets object storage handle variable-size content cheaply.',
    },
    {
      title: 'FR2: Read a Paste - Serving Reads at Scale with Caching',
      body:
        'With a 10:1 read-to-write ratio, hitting Object Storage on every single read wastes both latency (~50ms) and money (S3 charges per GET). We need most reads to never touch the origin at all.',
      insightCallout:
        'Pastes are immutable - once created, the content never changes. Write-once, read-many is the ideal caching pattern.',
      newComponents: [
        {
          name: 'CDN',
          description:
            'Caches paste content at edge locations worldwide. Because pastes never change, cache hit rates are extremely high.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  reader[Reader]:::client
  cdn[CDN Edge]:::edge
  api[Paste Service]:::compute
  db[("Metadata DB")]:::database
  s3[("Object Storage")]:::storage

  reader -->|"1. GET paste by ID"| cdn
  cdn -->|"2. Forward on miss"| api
  api -->|"3. Fetch paste metadata"| db
  api -->|"4. Fetch paste content"| s3`,
      },
      steps: [
        'Reader requests a paste, hitting the CDN edge first',
        'On a cache hit, content returns immediately (< 10ms)',
        'On a miss, the CDN forwards the request to the Paste Service',
        'Service queries the Metadata DB by ID',
        'Service checks expiration status - returns 404 if expired',
        'Service fetches content from Object Storage',
        'Service returns content with Cache-Control headers',
        'CDN caches the response at the edge for future reads',
      ],
      closingNote:
        'After the first read, every subsequent read in that region is served from the CDN edge without touching the origin - this is the highest-leverage optimization in the entire system.',
    },
    {
      title: 'FR3: Expire Pastes - Handling TTL Without Slowing Reads',
      body:
        'Pastes can carry a TTL (1 hour, 1 day, 1 week, never). We need both correctness - blocking access after expiry - and storage reclamation - actually deleting the underlying blob so storage costs do not grow unbounded.',
      insightCallout:
        'Caching conflicts with expiry: a paste can stay visible for up to max-age seconds after it technically expires, because the CDN does not know it expired.',
      newComponents: [
        {
          name: 'Cleanup Service',
          description:
            'A scheduled background job (runs every 5 minutes) that scans for expired pastes and deletes both their metadata row and their Object Storage blob.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  api[Paste Service]:::compute
  db[("Metadata DB")]:::database
  s3[("Object Storage")]:::storage
  cleanup[Cleanup Service]:::async

  api -->|"1. Check if paste expired"| db
  cleanup -->|"2. Scan expired pastes"| db
  cleanup -->|"3. Delete expired content"| s3`,
      },
      steps: [
        'Lazy check on read: Paste Service checks expiry on every GET and returns 404 instantly if expired - correctness without waiting for cleanup',
        'Background cleanup: Cleanup Service runs every 5 minutes, scans the Metadata DB for expired pastes, and deletes both the metadata row and the Object Storage blob - reclaims storage costs',
      ],
      closingNote:
        'The lazy check handles user-facing correctness; the cleanup job handles the economics of storage reclamation. Neither alone solves both problems.',
    },
  ],

  coreFlows: [
    {
      title: 'Create a Paste (End-to-End)',
      diagram: {
        mermaid: `sequenceDiagram
  participant U as User
  participant API as Paste Service
  participant ID as ID Generator
  participant S3 as Object Storage
  participant DB as Metadata DB

  U->>API: POST /pastes content + options
  API->>API: Validate size < 10MB
  API->>ID: Generate unique ID
  ID-->>API: "abc12XY"
  API->>S3: PUT key=abc12XY body=content
  S3-->>API: OK
  API->>DB: INSERT id, expiry, language
  DB-->>API: OK
  API-->>U: 201 url=paste.io/abc12XY`,
      },
      nonObviousFailure:
        'What if the S3 write succeeds but the DB insert fails? The content exists in Object Storage but no metadata row points to it - it is an orphan. The Cleanup Service also scans, less frequently (once/hour), for S3 keys that do not have a corresponding metadata row.',
    },
    {
      title: 'Read a Paste (CDN Hit vs Miss)',
      diagram: {
        mermaid: `sequenceDiagram
  participant R as Reader
  participant CDN as CDN Edge
  participant API as Paste Service
  participant DB as Metadata DB
  participant S3 as Object Storage

  R->>CDN: GET paste.io/abc12XY
  alt Cache Hit
    CDN-->>R: 200 content (sub-10ms)
  else Cache Miss
    CDN->>API: Forward request
    API->>DB: SELECT WHERE id=abc12XY
    DB-->>API: Metadata (not expired)
    API->>S3: GET key=abc12XY
    S3-->>API: Content
    API-->>CDN: 200 + Cache-Control headers
    CDN-->>R: 200 content
    CDN->>CDN: Cache for next reader
  end`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Unique ID Generation - Short, Unique, and Non-Guessable',
      problem:
        'The paste ID appears in the URL (paste.io/abc12XY). It must be unique, short, and not guessable - sequential IDs let people scrape all pastes.',
      simpleTerms:
        'Generate a random 7-character code (like "aB3xY9"), check if it already exists in the database (extremely unlikely with 3.5 trillion possibilities), and use it. Simple, fast, and non-guessable.',
      bad: 'Auto-increment IDs (1, 2, 3…). Sequential, guessable, easy to scrape. Also exposes business metrics (total paste count).',
      good:
        'Hash-based - MD5/SHA256 of content, take first 7 chars of Base62. Same content = same ID (deduplication!). But different pastes can collide (same first 7 chars), requiring retry logic.',
      great:
        "Random 7-character Base62 string with collision check. Generate abc12XY randomly, check if it exists in the metadata DB (fast primary key lookup), retry on collision. At 3.5 trillion possible IDs, the collision probability is astronomically low - less than lottery odds at 1 billion pastes.\n\nWhy random beats hash: with hash-based IDs, two different pastes CAN produce the same first 7 chars (collision) - you'd need collision resolution anyway, so random is simpler. Hash-based is better when you WANT deduplication (same content -> same URL), but that's not a requirement here.\n\nWhy random beats counter/Snowflake: Snowflake IDs are time-sorted and somewhat predictable. For a paste service where privacy matters (users don't want their paste URLs guessable), random is preferred.",
    },
    {
      title: 'Storage Choice - Why Object Storage Beats the Database',
      problem: 'Paste content ranges from 1 byte to 10MB. Where should it live?',
      simpleTerms:
        'If two users paste the exact same text, store it only once in S3 and have both paste URLs point to the same file. Saves storage money.',
      bad: 'Store content as a TEXT column in Postgres.',
      good:
        'Object Storage for all content. Cheap, scalable, durable. The 50ms latency is a non-issue because the CDN absorbs 95%+ of reads.\n\nComparison - DB (Postgres BYTEA) vs Object Storage (S3):\n- Max practical size: ~1MB per row (performance degrades) vs up to 5TB per object\n- Cost: $0.10-0.20/GB/month (EBS-backed) vs $0.023/GB/month (S3 Standard)\n- Backup speed: slow when table has large blobs vs independent - DB stays lean\n- Read latency: fast for small rows vs ~50ms first byte (CDN fixes this)\n- Scaling: vertical (bigger instance) vs infinite horizontal',
      great:
        'Object Storage + content-hash deduplication. If two users paste identical content, store it once in S3 with the content hash as the key. Both paste metadata rows point to the same S3 object. Saves storage at scale.',
    },
    {
      title: 'CDN Caching Strategy - Immutable Content is Cache-Perfect',
      problem: '10K reads/sec. Object Storage charges per request and has ~50ms latency. We need most reads to never touch the origin.',
      simpleTerms:
        'Since pastes never change after creation, a CDN can cache them forever. After the first person reads a paste, everyone else in that region gets it instantly from the CDN - your origin server is never hit again for that paste.',
      bad:
        'No caching. Every read hits S3 through the API. At $0.0004 per GET and 10K/sec, that is ~$350/day in S3 costs alone, plus 50ms+ latency for every user.',
      good:
        'Application-level cache (Redis) in front of S3. Reduces origin hits. But Redis costs memory, and popular pastes might be large (10MB cache entry).',
      great:
        "CDN at the edge. Pastes are immutable (write-once, never updated), making them ideal CDN candidates. Set Cache-Control: public, max-age=86400 (24h). After the first read, all subsequent reads from the same region are served in <10ms from the CDN edge. For a popular paste with 100K views, only 1 request reaches your origin.\n\nCache invalidation for expired pastes: the CDN might serve stale content for up to max-age seconds. Solutions: set max-age = min(time_until_expiry, 24h) - a paste expiring in 1 hour gets a 1h cache; for immediate removal, call the CDN purge API when a paste is deleted.",
    },
  ],

  selfAudit: [
    {
      question: 'Single points of failure?',
      answer: 'S3 is multi-AZ. Metadata DB needs a replica. Paste Service is stateless -> scale horizontally.',
    },
    {
      question: 'Abuse prevention?',
      answer: 'Rate limit by IP (100 creates/hour), max size 10MB, content scanning for malware.',
    },
    {
      question: 'What if S3 is slow?',
      answer: 'CDN absorbs 95% of reads. The remaining 5% (cold misses) tolerate 50ms.',
    },
    {
      question: 'Orphan cleanup?',
      answer: 'Background job scans for S3 keys without metadata matches (hourly).',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  user[User]:::client
  reader[Reader]:::client
  cdn[CDN Edge Cache]:::edge
  api[Paste Service]:::compute
  idgen[ID Generator]:::compute
  s3[("Object Storage - paste content")]:::storage
  db[("Metadata DB - id, expiry, lang")]:::database
  cleanup[Cleanup Service]:::async

  user -->|"POST paste content"| api
  api -->|"Generate short ID"| idgen
  api -->|"Store paste text"| s3
  api -->|"Save paste metadata"| db
  reader -->|"GET paste by ID"| cdn
  cdn -->|"Forward on miss"| api
  cleanup -->|"Scan expired pastes"| db
  cleanup -->|"Delete expired content"| s3`,
  },

  keyTechnologies: [
    {
      term: 'Object Storage (S3/GCS)',
      definition: 'Cloud storage for arbitrary blobs. Pay per GB. Virtually unlimited. Perfect for paste content.',
    },
    {
      term: 'Base62 Encoding',
      definition: 'Encoding using 62 characters (a-z, A-Z, 0-9). 7 chars = 3.5 trillion combinations. Short, URL-safe.',
    },
    {
      term: 'CDN (CloudFront/Cloudflare)',
      definition: 'Caches content at edge servers worldwide. Immutable pastes = extremely high hit rate.',
    },
    { term: 'TTL (Time To Live)', definition: 'How long a paste lives before expiring. Stored as an expiresAt timestamp.' },
    {
      term: 'Metadata DB',
      definition: 'Small structured data per paste (ID, timestamps, language). Stays lean because content lives elsewhere.',
    },
  ],

  expectedDepth: {
    mid:
      'Design basic paste creation and retrieval. Propose object storage (S3) for content and a database for metadata. Understand Base62 ID generation (same pattern as URL shortener). Explain why storing large text blobs directly in a relational DB is a bad idea - cost, backup speed, and query performance all suffer.',
    senior:
      'Explain the separation of content (S3) from metadata (Postgres) - different access patterns, different cost profiles. Propose CDN caching for immutable pastes (write-once, read-many = perfect cache hit ratio). Discuss expiry handling with lazy deletion on read plus background cleanup for storage reclamation. Know the failure mode: S3 write succeeds but DB insert fails -> orphan handling.',
    staffPlus:
      'Address abuse prevention (rate limiting per IP, content scanning for malware/spam, CAPTCHA). Discuss storage cost optimization via content-hash deduplication (same content = same S3 key). Cover CDN cache invalidation for expired pastes (short max-age for short-lived pastes). Discuss multi-region: replicate metadata DB for low-latency reads, S3 is already multi-AZ, CDN handles global distribution.',
  },

  keyTakeaways: [
    'Separate metadata from content - small DB rows for fast lookups, object storage for cheap blob storage',
    'Base62 random IDs give short, URL-safe, non-guessable paste links',
    'CDN is a perfect fit because pastes are immutable - write once, read many',
    'Two-pronged expiry - lazy check for correctness, background job for cleanup',
    'This is essentially a simpler URL shortener: generate ID -> store blob -> serve it',
  ],

  relatedDesigns: ['url-shortener', 'rate-limiter', 'photo-sharing'],
  relatedConcepts: [
    { name: 'Object Storage', description: 'Stores large paste blobs cheaply instead of bloating the database.' },
    { name: 'CDN', description: 'Serves popular pastes from the edge to cut read latency.' },
    { name: 'Caching', description: 'Keeps hot paste content and metadata in memory.' },
    { name: 'Database Sharding', description: 'Partitions the paste metadata store as volume grows.' },
  ],

  simulator: {
    goalDescription: 'Let anyone create a paste and get it back fast, at a 10:1 read-to-write ratio, without storing large blobs in the database.',
    requirementChips: ['10:1 read:write', 'P99 < 100ms reads', '10K reads/sec'],
    targetRps: 11000,
    readRatio: 0.91,
    cacheHitRatio: 0.9,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'cdn-edge', label: 'CDN edge caching for immutable paste content', kind: 'requires-node-type', nodeType: 'cdn' },
      { id: 'object-storage', label: 'Object storage for paste blobs', kind: 'requires-node-type', nodeType: 'object-store' },
      {
        id: 'metadata-store',
        label: 'Durable metadata store (ID, expiry, language)',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb'],
      },
      {
        id: 'compute-tier',
        label: 'Paste Service compute tier',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'cdn-1', type: 'cdn', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 3, position: { x: 600, y: 200 } },
        { id: 's3-1', type: 'object-store', instanceCount: 2, position: { x: 880, y: 120 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 2, position: { x: 880, y: 280 } },
        { id: 'worker-1', type: 'worker', instanceCount: 1, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-cdn', source: 'client-1', target: 'cdn-1' },
        { id: 'e-cdn-app', source: 'cdn-1', target: 'app-1' },
        { id: 'e-app-s3', source: 'app-1', target: 's3-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-worker-pg', source: 'worker-1', target: 'pg-1' },
        { id: 'e-worker-s3', source: 'worker-1', target: 's3-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Pastes are immutable, so the CDN absorbs the vast majority of the 10:1 read-heavy traffic at the edge; on a miss, the Paste Service fetches small metadata rows from Postgres and the actual blob from cheap Object Storage, while a background Cleanup worker deletes expired metadata and blobs on a schedule.',
    failureModeNarratives: {
      cdn:
        'A single CDN tier fronts all reads; if it fails, the full 10:1 read load falls straight through to the Paste Service and origin stores, which were sized assuming the CDN absorbs most of the traffic.',
    },
    fullDesignLinkSlug: 'pastebin',
  },
}

export default topic
