import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'url-shortener',
  title: 'URL Shortener (Bitly / TinyURL)',
  difficulty: 'Beginner',
  icon: 'pi pi-link',
  color: '#3b82f6',
  readTimeMinutes: 24,
  topics: ['Base62 Encoding', 'Snowflake ID Generation', 'CDN Caching'],
  companies: ['Bitly', 'Twitter', 'Google'],
  prerequisites: ['Caching', 'CDN'],
  summary:
    'A URL shortener maps short codes to long URLs and redirects billions of clicks per day using tiered caching (CDN -> Redis -> DB).',

  understandingProblem:
    "A service that takes a long URL like https://example.com/products/2024/summer-sale?utm_campaign=email&ref=newsletter and gives you back a short one like https://sho.rt/aB3xY9. When someone clicks the short link, they're redirected to the original. Despite the tiny API surface, a URL shortener has to handle billions of redirects a day, generate unique codes without collisions, survive traffic spikes on viral links, and provide analytics.",
  realExamples: "Bitly, TinyURL, t.co (Twitter), or Google's short-lived goo.gl.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  user[User Browser]:::client
  api[Shortener API]:::compute
  db[("Database")]:::database
  user --> api
  api -->|"generate random code, store {short, long}"| db`,
    },
    whyThisBreaks: [
      "Random code generation collides more often than you'd think at 100M+ links.",
      'Every redirect is a DB read, so 1M redirects/sec melts the DB.',
      'Hot links (a tweet goes viral) hammer a single row.',
      'No analytics beyond "it existed."',
      'One DB region -> half the planet sees 200ms+ redirect latency.',
    ],
    closingNote:
      'The rest of this doc evolves this into a system that serves billions of redirects globally at low latency.',
  },

  priorArt: [
    {
      title: 'Bitly',
      description:
        'The canonical URL shortener. Public writeups describe a heavy read-cache tier, base62 encoding over numeric IDs, and a dedicated analytics pipeline separate from the redirect hot path. (Educative overview)',
      link: 'https://www.educative.io/blog/bitly-system-design',
    },
    {
      title: 'Twitter Snowflake',
      description:
        '64-bit distributed ID generator producing time-ordered unique IDs without coordination per request. Widely adopted as an alternative to DB auto-increment for short-code generation. (twitter-archive/snowflake)',
      link: 'https://github.com/twitter-archive/snowflake',
    },
    {
      title: 'Base62 Encoding',
      description:
        'The standard way to turn a numeric ID into a short alphanumeric code. 7 characters of base62 give 3.5 trillion unique codes, enough for decades of links.',
    },
    {
      title: 'Counter-Based Ranges (Zookeeper / DB)',
      description:
        "Pre-allocate ranges of IDs to each service instance to avoid per-request coordination. Instagram's photo ID generation is a famous variant.",
      link: 'https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c',
    },
    {
      title: 'CDN-Cached 301 Redirects',
      description:
        't.co and goo.gl both served redirects from edge PoPs. Bitly uses its own edge infrastructure with aggressive caching.',
    },
  ],

  coreEntities: [
    { name: 'Long URL', description: 'The original destination URL the user submitted.' },
    { name: 'Short Code', description: 'The unique alphanumeric suffix (e.g. aB3xY9) that identifies a mapping.' },
    {
      name: 'Link',
      description: 'The stored mapping of short_code -> long_url with metadata (creator, created_at, expires_at).',
    },
    {
      name: 'Click Event',
      description: 'A record of a single redirect, with timestamp, IP-derived country, referrer, user agent.',
    },
  ],

  requirements: {
    core: [
      'Users should be able to submit a long URL and get back a unique short URL.',
      'Anyone with a short URL should be redirected to the original long URL, fast.',
      'Short URLs should have a configurable expiry (default: forever) and support click analytics.',
    ],
    belowTheLine: [
      'User accounts, API keys, billing, dashboards',
      'Custom aliases / vanity URLs (simple extension once core works)',
      'Password-protected or expiring-on-click links',
      'Real-time dashboards with sub-second freshness',
      'QR codes, link previews, malware scanning',
      'Custom domains per customer',
      'Strong consistency on analytics counts (eventual is fine)',
      'Strict ordering of click events',
      'Sub-100ms link creation latency (creation is rare; can be 500ms)',
    ],
    nonFunctionalTable: [
      {
        metric: 'Read:Write Ratio',
        target: '100:1 reads to writes - every design decision is driven by the redirect hot path',
      },
      { metric: 'Redirect Latency', target: 'P99 under 100ms globally - slow redirects feel broken' },
      { metric: 'Availability', target: "99.99% on the redirect path - a dead redirect breaks someone else's tweet" },
      { metric: 'Uniqueness', target: 'No two long URLs can accidentally share a short code' },
      { metric: 'Scale', target: '100M new links/day, 10B redirects/day, 5-year retention -> ~200B rows at peak' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Links Store',
      purpose: 'short_code -> long_url mapping (source of truth)',
      primaryPick: 'DynamoDB',
      alternatives: 'Cassandra, TiDB, CockroachDB',
      whyPrimaryWins: 'Pure point-lookup/point-write access pattern with no joins - a KV store scales horizontally where a single sharded Postgres becomes an operational burden past a few billion rows',
    },
    {
      tier: 'Redirect Cache',
      purpose: 'Sub-millisecond lookup on the redirect hot path',
      primaryPick: 'Redis',
      alternatives: 'Memcached, Valkey',
      whyPrimaryWins: 'Read-through in-memory cache absorbs 95%+ of redirects before they ever reach the durable store',
    },
    {
      tier: 'Edge Delivery',
      purpose: 'Serve popular redirects without touching origin',
      primaryPick: 'Cloudflare CDN',
      alternatives: 'CloudFront, Fastly, Akamai',
      whyPrimaryWins: 'Viral links resolve in under 10ms worldwide straight from the edge, with zero origin load',
    },
    {
      tier: 'ID Generation',
      purpose: 'Unique, collision-free short codes at 1K+/sec',
      primaryPick: 'Snowflake ID',
      alternatives: 'DB auto-increment + base62, Sonyflake, UUIDv7',
      whyPrimaryWins: 'Unique by construction with zero per-request coordination, unlike a centralized DB sequence',
    },
    {
      tier: 'Event Backbone',
      purpose: 'Ship click events off the redirect hot path',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Google Pub/Sub, Pulsar',
      whyPrimaryWins: 'Fire-and-forget durable log decouples analytics writes entirely from redirect latency',
    },
    {
      tier: 'Analytics Serving Store',
      purpose: 'Fast per-link aggregate queries for the stats API',
      primaryPick: 'ClickHouse',
      alternatives: 'Pinot, Druid, Timestream',
      whyPrimaryWins: 'Columnar storage pre-aggregated by a stream processor makes "clicks by country, last 30 days" a millisecond query instead of a full scan',
    },
  ],
  technologyChoicesNote:
    "Why DynamoDB over a sharded Postgres? Read replicas don't help write throughput, and backup/restore on a table with hundreds of billions of rows takes 12+ hours. The access pattern is pure point-lookup/point-write by short_code with no relational queries on the redirect path - exactly what a managed KV store is built for, without owning a sharding layer yourself.",

  scaleEstimation: [
    'Users: 100M DAU (link creators + clickers combined)',
    'Write QPS: 1K new URLs/sec (100M new links/day)',
    'Read QPS: 100K redirects/sec (100:1 read-write ratio, 10B redirects/day)',
    'Storage: 500GB URL mapping data/year (~200B rows at 5-year retention)',
    'Bandwidth: ~50 Gbps at peak for redirect responses + analytics event ingestion',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/links',
      description: 'Submit a long URL and receive a unique short URL.',
      example:
        'Body: { longUrl, customAlias?, expiresAt? }\nHeader: Authorization: Bearer <api_key>\n-> Link',
    },
    {
      method: 'GET',
      path: '/:shortCode',
      description:
        'Public endpoint on the short domain (e.g. sho.rt/aB3xY9). Redirects to the original long URL.',
      example: '-> 302 Found, Location: <longUrl>',
    },
    {
      method: 'GET',
      path: '/v1/links/:shortCode/stats',
      description: 'Return aggregated clicks by time bucket, country, and referrer.',
      example: '-> ClickStats',
    },
    {
      method: 'DELETE',
      path: '/v1/links/:shortCode',
      description: "Soft delete - the short code immediately starts returning 410 Gone instead of redirecting.",
      example: '-> 204',
    },
  ],
  apiSecurityNote:
    "Creation is authenticated via API key; redirects are public. customAlias (if supported) must be validated for reserved words and rate-limited per user. Submitted URLs should be screened for phishing/malware (out of scope for this HLD, but a hook point is needed). Never trust the Referer header for anything beyond analytics - it's user-controlled.",

  highLevelDesignIntro: "Let's build up service by service.",

  builds: [
    {
      title: '1) User Creates a Short URL',
      body:
        'The create path is low-QPS (~1K/sec peak) but needs a unique, collision-free short code every time.',
      insightCallout:
        'Why Snowflake instead of random strings? Random strings require a "check if it already exists" round-trip on every creation. At 100M+ links, collisions become frequent and expensive. Snowflake IDs are unique by construction - no checking needed, ever.',
      newComponents: [
        {
          name: 'API Gateway',
          description:
            'The front door. Authenticates API keys, applies per-user rate limits, and routes requests to the right service. Think of it as a security guard + receptionist for your backend.',
        },
        {
          name: 'Write Service',
          description: 'Handles link creation. Validates the URL, generates the short code, and stores the mapping.',
        },
        {
          name: 'Snowflake ID Generator',
          description:
            'Produces unique numeric IDs without any coordination between servers. Embeds a timestamp + machine ID + sequence number into a single 64-bit integer, so no two machines ever produce the same ID, even without talking to each other.',
        },
        {
          name: 'Global KV Store',
          description:
            'Where the short_code -> long_url mapping lives permanently. Needs to survive failures and serve reads worldwide.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  gw[API Gateway]:::edge
  ws[Write Service]:::compute
  idg[Snowflake ID Gen]:::compute
  db[("Database")]:::database

  client -->|"1. POST /links with long URL"| gw
  gw -->|"2. Auth + rate limit"| ws
  ws -->|"3. Get unique ID"| idg
  ws -->|"4. Store short_code to long_url"| db`,
      },
      steps: [
        'User calls POST /v1/links with their long URL and API key -> request hits the API Gateway',
        'Gateway checks: is this API key valid? Has this user exceeded their rate limit?',
        'Gateway forwards to Write Service, which asks the Snowflake ID Generator for a fresh numeric ID, then base62-encodes it into a 7-character short code (e.g. aB3xY9)',
        'Write Service stores {short_code, long_url, user_id, created_at, expires_at} in the Global KV Store',
        'Returns the short URL to the user - done in under 100ms',
      ],
    },
    {
      title: '2) Anyone Hits the Short URL and Gets Redirected',
      body: 'This is the hot path - billions of reads per day. Latency and cost both matter.',
      insightCallout:
        'Why 302 and not 301? A 301 (permanent redirect) tells the browser to cache it forever - next time the user clicks that link, the browser goes directly to the destination and we never see the click, so no analytics. 302 (temporary redirect) forces the browser through us every time, so we count every click.',
      newComponents: [
        {
          name: 'CDN Edge',
          description:
            'Servers deployed worldwide (Cloudflare, CloudFront, Fastly) that cache popular redirects close to users. A viral link gets served from the edge in under 10ms without ever touching our origin servers.',
        },
        {
          name: 'Redirect Service',
          description: 'The origin server that handles CDN misses. Looks up the short code and returns a 302 Found with the long URL.',
        },
        {
          name: 'Redis Cache',
          description:
            'A regional in-memory cache sitting between the Redirect Service and the database. Holds recently-accessed links for sub-millisecond lookups.',
        },
        {
          name: 'Event Bus',
          description:
            'Captures every click as an event for analytics, without slowing down the redirect. Fire-and-forget pattern: the redirect returns immediately, and the click event flows through the bus in the background.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  user[Browser]:::client
  cdn[CDN Edge]:::edge
  rs[Redirect Service]:::compute
  cache[("Redis Cache")]:::cache
  db[("Database")]:::database
  eb[Event Bus]:::async

  user -->|"1. GET /aB3xY9"| cdn
  cdn -->|"2. Forward on miss"| rs
  rs -->|"3. Lookup short code"| cache
  rs -->|"4. Fetch mapping from DB"| db
  rs -->|"5. Fire click event async"| eb`,
      },
      steps: [
        'User clicks sho.rt/aB3xY9 -> browser sends a GET request',
        "CDN edge checks its local cache - for popular links (that viral tweet everyone's clicking), the redirect is served right there, under 10ms, without ever reaching our servers",
        'On CDN miss -> request reaches our Redirect Service, which checks the regional Redis cache',
        'On Redis miss -> reads from the Global KV Store and backfills both Redis and CDN caches for next time',
        "Fires a click event to the Event Bus (fire-and-forget - the redirect doesn't wait for analytics)",
        'Returns 302 Found with the long URL in the Location header -> browser redirects',
      ],
    },
    {
      title: '3) Analytics and Stats',
      body:
        'Clicks go to Kafka from the hot path. A stream processor aggregates them into per-link counters visible via a stats API.',
      newComponents: [
        {
          name: 'Stream Processor (Flink or Kafka Streams)',
          description:
            'Reads raw click events and aggregates them into per-link counters by time bucket, country, and referrer. Instead of counting clicks one-by-one on each query, the stream processor pre-computes rollups so dashboard queries are instant.',
        },
        {
          name: 'Serving Store (ClickHouse, Pinot, or Timestream)',
          description:
            'A columnar database optimized for fast aggregation queries like "how many clicks did this link get in the last 30 days, broken down by country?"',
        },
        {
          name: 'Object Storage (S3 / GCS)',
          description: 'Where raw click events are archived as Parquet files for long-term retention and ad-hoc analysis.',
        },
        {
          name: 'Stats API',
          description: 'Serves pre-aggregated analytics to dashboards. Never scans raw events at query time.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  rs[Redirect Service]:::compute
  eb["Event bus (Kafka / Kinesis)"]:::async
  sp["Stream processor (Flink / Kafka Streams)"]:::compute
  agg[("Serving store (ClickHouse / Pinot / Timestream)")]:::database
  raw[("Object storage (S3 / GCS / Parquet)")]:::storage
  api[Stats API]:::compute
  dash[Dashboard]:::client
  adhoc["Ad hoc SQL (Athena / BigQuery / Trino)"]:::compute

  rs --> eb
  eb --> sp
  eb --> raw
  sp --> agg
  dash --> api
  api --> agg
  dash --> adhoc
  adhoc --> raw`,
      },
      steps: [
        "Redirect Service fires every click to the event bus (Kafka / Kinesis / Pub/Sub). The redirect itself doesn't wait.",
        'A stream processor (Flink / Kafka Streams / Spark Streaming) windows events by short_code + time_bucket + country + referrer, writing aggregates to a serving store (ClickHouse / Pinot / Druid / Timestream).',
        'Raw events tee to object storage (S3 / GCS) as hourly Parquet, queryable via Athena / BigQuery / Trino.',
        'Stats API reads pre-aggregated rollups - cheap queries, no scanning billions of rows at request time.',
      ],
    },
  ],

  coreFlows: [
    {
      title: 'Create a Short Link',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant GW as API Gateway
  participant WS as Write Service
  participant ID as ID Generator
  participant DB as Links DB

  C->>GW: POST /v1/links with API key
  GW->>GW: Auth and rate limit
  GW->>WS: Forward
  WS->>WS: Validate URL format and denylist
  WS->>ID: Next ID
  ID-->>WS: Snowflake ID
  WS->>WS: Base62 encode and bit-shuffle
  WS->>DB: PUT short_code to long_url
  DB-->>WS: Success
  WS-->>C: 201 with short URL`,
      },
      nonObviousFailure:
        "If the KV store write fails, we retry with the same ID (the ID has already been generated, there's no benefit to burning a new one). If it keeps failing, the ID is silently wasted - Snowflake has 42 bits of address space so waste is irrelevant.",
    },
    {
      title: 'Redirect a Short Link',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as Browser
  participant CDN as CDN Edge
  participant RS as Redirect Service
  participant BF as Bloom Filter
  participant L as Local Pod Cache
  participant R as Regional Redis
  participant KV as Global KV
  participant K as Event Bus

  U->>CDN: GET short code
  alt CDN cache hit
    CDN-->>U: 302 to long URL
    CDN->>K: Click event
  else CDN miss path
    CDN->>RS: Forward to origin
    RS->>BF: Probe bloom filter
    BF-->>RS: Unknown or definitely not
    RS->>L: Read local pod cache
    L-->>RS: Hit or miss
    RS->>R: GET on local miss
    R-->>RS: Hit or miss
    RS->>KV: GET on Redis miss
    KV-->>RS: Long URL or not found
    RS->>R: Backfill SETEX 24h
    RS->>L: Backfill 60s
    RS-->>U: 302 with Location header
    RS->>K: Click event fire and forget
  end`,
      },
      nonObviousFailure:
        "If all caches miss AND the KV is slow, we time out the read at 50ms and return 503 Try Again. We never serve a wrong URL; stale-if-error is risky because the link's destination may have been changed.",
    },
    {
      title: 'Analytics Ingestion',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant RS as Redirect Service
  participant K as Kafka (clicks)
  participant SP as Flink Stream Processor
  participant CH as ClickHouse
  participant S3 as S3 Parquet
  participant API as Stats API
  participant D as Dashboard

  RS->>K: Produce click event
  K->>SP: Consume
  K->>S3: Hourly sink
  SP->>SP: Window by short_code + country + bucket
  SP->>CH: Write aggregates
  D->>API: GET stats?range=30d
  API->>CH: SELECT aggregated
  CH-->>API: Rollup rows
  API-->>D: Chart data`,
      },
    },
    {
      title: 'Link State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> ACTIVE
  ACTIVE --> EXPIRED: TTL reached
  ACTIVE --> DELETED: user deletes
  EXPIRED --> [*]: purged after 90d
  DELETED --> [*]: purged after 90d`,
        bullets: [
          'ACTIVE links redirect normally.',
          'EXPIRED and DELETED return 410 Gone (not 404), so clients can distinguish "this link intentionally ended" from "this link never existed."',
        ],
      },
    },
  ],

  deepDives: [
    {
      title: 'How Do We Generate Short Codes at 1K/sec Without Collisions?',
      problem:
        "We need every short code to be globally unique. With 100M links/day, we're generating ~1,200/sec sustained. Naive approaches either collide, don't scale, or require coordination on every request.",
      simpleTerms:
        "Every time someone shortens a URL, we need to generate a unique 7-character code. With millions of URLs, random generation might accidentally create the same code twice.",
      bad:
        'MD5 or SHA256 hash of the long URL, take first 7 chars. Same URL always hashes to the same code, which seems like a nice dedupe property - but now two users submitting the same URL share a code and share click stats, which is almost never what they want. Hash collisions force you to rehash with a salt and retry, meaning an unknown number of DB round-trips per write. Truncating 128 bits to 42 bits (7 base62 chars) multiplies collision probability exponentially. Use hashing only if "same URL -> same short code" is an explicit product requirement.',
      good:
        'DB auto-increment ID, base62-encoded. INSERT INTO links (long_url, ...) RETURNING id, then base62-encode the ID. 7 chars of base62 = 62^7 ~= 3.5 trillion codes - plenty. Zero collision risk since the DB guarantees uniqueness. Problem: a single-primary DB becomes the ID bottleneck at scale - every insert waits on the sequence. Sequential IDs are also predictable - someone can enumerate aAAAAA0, aAAAAA1, ... and scrape every link, which is a privacy leak since short links are often effectively "private" because they are unguessable.',
      great:
        'Distributed ID generation with Snowflake + base62 + optional bit-shuffling. Options: (1) Twitter Snowflake - 64-bit ID = [41 bits timestamp][10 bits machine ID][12 bits sequence]; each service pod generates its own IDs, no coordination, time-ordered, collision-free across ~1K machines; base62-encode the lower 42 bits for a 7-char code (used in production by Twitter, Instagram, Discord). (2) Zookeeper range allocator - a service instance requests a range of 1M IDs at once from Zookeeper, burns through them locally, and requests the next range; handles DB unavailability with no per-request coordination. (3) Database with pre-allocated ranges - same idea using a single counter table row with SELECT ... FOR UPDATE SKIP LOCKED; simpler infra, slightly slower. To defeat enumeration scraping, bit-shuffle the numeric ID before base62-encoding using a fixed, reversible permutation (Feistel network or multiply-by-large-prime mod 2^42) - codes become unpredictable without adding lookup cost, since we still decode back to the real ID by reversing the permutation. For custom aliases, use a separate write path: try INSERT ... ON CONFLICT DO NOTHING on the alias, and reserve words like admin, api, login in a denylist.',
    },
    {
      title: 'How Do We Serve 10B Redirects Per Day at <100ms P99 Globally?',
      problem:
        'Problem: 10B redirects/day = ~120K/sec average, 500K/sec peak. A round-trip to a primary DB in us-east-1 from Singapore is already 200ms, before you touch the data. We need data close to the user.',
      simpleTerms:
        'Ten billion clicks per day on short links. A database lookup for every click is too slow and too expensive. We need the mapping cached as close to the user as possible.',
      bad:
        'Single origin DB, one region, hope for the best. Falls over on raw QPS and gives lousy latency to anyone outside the origin region.',
      good:
        'Redis read-through cache in front of the DB. Check Redis first on every redirect - cache hit returns instantly (sub-ms); cache miss reads from the DB and backfills Redis, then returns. Since links are mostly immutable (write-once, read-forever), cache hit rate climbs to 95%+ quickly, so most traffic never touches the DB.',
      great:
        "CDN layer in front of Redis + DB. For truly hot links (viral tweets), the CDN edge (Cloudflare, CloudFront, Fastly) serves the 302 redirect directly from the user's nearest edge server without ever reaching your origin - sub-10ms worldwide. The lookup path becomes CDN (edge, ~5ms) -> Redis (in-memory, ~1ms) -> DB (disk, ~10ms); each tier absorbs traffic so the next one sees less load. Cache invalidation is simple since links are immutable - set a TTL (e.g. CDN 5 min, Redis 24h) and on delete, purge both.",
      diagram: {
        mermaid: `flowchart LR
  user[Browser]:::client
  cdn[CDN Edge]:::edge
  rs[Redirect Service]:::compute
  redis[("Redis Cache")]:::cache
  db[("Database")]:::database

  user --> cdn
  cdn -->|"miss"| rs
  rs -->|"lookup short code"| redis
  rs -->|"miss"| db`,
      },
    },
    {
      title: 'How Do We Handle a Single Link Going Viral?',
      problem: 'One link gets 100K clicks/sec. All requests land on the same Redis key on the same shard.',
      bad: "Add more Redis nodes. Doesn't help - consistent hashing still routes this key to one node.",
      good:
        'Local in-process cache in each pod. Each pod caches the hottest codes in its own memory (simple LRU, 10K entries, 60s TTL). Most viral traffic is served from pod memory without hitting Redis at all.',
      great:
        'CDN absorbs viral traffic + local pod cache as backup. For any truly viral link, the CDN edge handles 99%+ of requests before they reach origin - set Cache-Control: public, max-age=300. Combined with the pod-level LRU, Redis only sees the initial miss and rare cache-fill requests. The "hot key" problem effectively disappears because it never reaches your infrastructure.',
    },
    {
      title: 'How Do We Handle Analytics Without Slowing Redirects?',
      problem: 'We want click counts per link without adding latency to the redirect path.',
      bad:
        'Synchronously write to a counter on each redirect. Adds latency to the hot path and creates another hot-key problem.',
      good:
        'Fire a click event to a message queue asynchronously. The redirect returns immediately; a background consumer processes events and increments counters. Decoupled, durable, no impact on redirect latency.',
      great:
        "Same as Good, but aggregate into time-bucketed counters, and go further with a full pipeline: every click becomes a Protobuf message on the event bus (Kafka / Kinesis / Pub/Sub) topic link-clicks, keyed by short_code for partition-level ordering. A stream processor (Flink / Kafka Streams / Spark Structured Streaming) maintains tumbling-window aggregates - 1-min, 1-hour, 1-day buckets per (short_code, country, referrer) tuple - and writes to a columnar serving store (ClickHouse / Pinot / Druid / Timestream) for fast per-link queries. The same stream is tee'd via a sink connector to object storage (S3 / GCS) as hourly Parquet files for ad-hoc queries via Athena / BigQuery / Trino, ML training, and long-term retention. The Stats API reads only pre-aggregated rollups, so GET /links/:code/stats?range=30d runs in milliseconds. A fully-serverless shortcut swaps Kafka+Flink for Kinesis Data Streams + Firehose + Data Analytics, or Pub/Sub + Dataflow on GCP. The eventual-consistency tradeoff is explicit: dashboard numbers lag the true count by ~1-2 minutes, which is never a problem for link analytics since nobody watches their click count refresh every second expecting real-time precision.",
    },
    {
      title: 'How Do We Scale the Writes to the Links Store?',
      problem:
        'Problem: 100M new links per day = ~1,200 writes/sec average. Over 5 years: 200B rows. A single Postgres instance groans somewhere around a few billion rows even with good indexing.',
      simpleTerms:
        "100M new URLs per day, stored for 5 years = 200 billion rows. A single Postgres can't hold this. We need to split the data across multiple databases.",
      bad:
        'One big Postgres table, add read replicas when it gets slow. Replicas do not help writes. Indexes balloon. Backup and restore take 12+ hours.',
      good:
        'Shard Postgres by short_code hash. N shards, each smaller and faster, with the application routing by hash. Works, but is operationally heavy - you now own a sharding layer, cross-shard queries, and painful resharding.',
      great:
        "Pick a store built for this: DynamoDB, Cassandra, or TiDB. The access pattern is a perfect fit for a KV store - writes are PUT short_code -> {long_url, user_id, created_at, expires_at} with no joins and no transactions beyond a single row; reads are GET short_code, a point lookup by primary key; deletes are UPDATE status = 'deleted', also a point-key operation. There are no relational queries on the redirect path. DynamoDB (fully managed, auto-scales, Global Tables for multi-region), Cassandra (self-managed, cheaper at massive scale), or TiDB (SQL-compatible if you want it) all fit. Schema: PK short_code (partition key, hashed), attributes long_url, user_id, created_at, expires_at, status. User-side queries like \"all links created by user X\" are a different, secondary access pattern - serve them from a GSI on user_id or a separate materialized view updated via CDC. Don't warp the primary schema for it.",
    },
  ],

  selfAudit: [
    {
      question: 'What if all caches miss and the KV store is slow?',
      answer:
        "Time out the read at 50ms and return 503 Try Again. Never guess and serve a possibly-stale URL - the link's destination may have changed since it was cached.",
    },
    {
      question: 'How do you stop someone from scraping every link?',
      answer:
        'Sequential Snowflake/auto-increment IDs are enumerable. Bit-shuffle the numeric ID with a reversible permutation before base62-encoding so codes look random while still decoding back to the real ID with zero extra lookup cost.',
    },
    {
      question: 'What happens when a single link goes viral (100K clicks/sec)?',
      answer:
        'Adding more Redis nodes does not help - consistent hashing still routes the hot key to one node. A pod-local LRU cache plus CDN edge caching (Cache-Control: max-age=300) absorbs 99%+ of the traffic before it ever reaches Redis.',
    },
    {
      question: 'Why return a 302 instead of a 301 on redirect?',
      answer:
        '301 tells the browser to cache the redirect forever, so subsequent clicks never hit our servers again and we lose analytics. 302 forces every click through us, at the cost of a slightly less cacheable response.',
    },
    {
      question: "Why not just use Postgres for 200B rows of links?",
      answer:
        'Read replicas do not help write throughput, and backup/restore on a table that size takes 12+ hours. The access pattern is pure point-lookup/point-write by short_code, which is exactly what a KV store (DynamoDB, Cassandra, TiDB) is built for.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  client[Client or Browser]:::client
  cdn[CDN Edge]:::edge
  gw[API Gateway]:::edge
  ws[Write Service]:::compute
  rs[Redirect Service]:::compute
  idg[Snowflake ID Gen]:::compute
  consumer[Analytics Consumer]:::compute
  redis[("Redis Cache")]:::cache
  db[("Database")]:::database
  q[Message Queue]:::async

  client -->|"Request"| cdn
  cdn -->|"Cache miss"| gw
  gw -->|"3a. POST /links"| ws
  gw -->|"3b. GET /code"| rs
  ws -->|"Get unique ID"| idg
  ws -->|"Store mapping"| db
  rs -->|"Lookup short code"| redis
  rs -->|"DB fallback"| db
  rs -->|"Fire click event"| q
  q -->|"Aggregate counts"| consumer
  consumer -->|"Write rollups"| db`,
  },

  keyTechnologies: [
    {
      term: 'Base62 Encoding',
      definition:
        'Converts numeric IDs into compact alphanumeric strings using [0-9a-zA-Z] - 7 characters yield 3.5 trillion unique short codes.',
    },
    {
      term: 'Snowflake ID',
      definition:
        'Distributed 64-bit ID generator embedding timestamp + machine ID + sequence - unique by construction with no coordination per request.',
    },
    {
      term: 'Redis Cache',
      definition: 'Regional in-memory cache holding recently-accessed link mappings for sub-millisecond redirect lookups on CDN misses.',
    },
    {
      term: 'CDN',
      definition: 'Content Delivery Network serving redirect responses from edge PoPs worldwide - hot links resolved in under 10ms without hitting origin.',
    },
    {
      term: '301 / 302 Redirect',
      definition:
        'HTTP status codes: 301 (permanent, browser caches forever - no analytics) vs 302 (temporary, always routes through us - enables click counting).',
    },
    {
      term: 'Bloom Filter',
      definition: 'Probabilistic data structure in each service pod that fast-rejects invalid short codes (guaranteed 404) without hitting Redis or the DB.',
    },
    {
      term: 'Kafka',
      definition: 'Event bus carrying click events from the redirect hot path to the analytics pipeline without adding latency to redirects.',
    },
  ],

  expectedDepth: {
    mid: 'Design basic URL creation and redirect flow. Propose a database for storing long-to-short mappings. Understand Base62 encoding for generating short codes from numeric IDs. Explain the difference between 301 (permanent) vs 302 (temporary) redirects and when each is appropriate.',
    senior:
      'Propose a counter-based or hash-based ID generation strategy (Snowflake or similar). Discuss caching with Redis for popular URLs and CDN for redirect responses at the edge. Explain horizontal scaling of the write service with a distributed counter (range allocation per instance). Articulate the 100:1 read-write ratio and how it drives the architecture.',
    staffPlus:
      'Address multi-region deployment with counter range allocation per region (no cross-region coordination on writes). Discuss the analytics pipeline - click tracking without adding latency to the redirect hot path (fire-and-forget to Kafka, process async). Cover URL expiration cleanup (background TTL sweeper vs lazy deletion), and the security implications of predictable sequential codes (enumeration attacks, phishing detection).',
  },

  keyTakeaways: [
    'Base62 encoding turns numeric IDs into short 7-char codes (3.5T unique codes)',
    '302 redirect enables analytics; 301 is for permanent redirects without tracking',
    'CDN caching at the edge handles redirect QPS without hitting origin',
    'Snowflake ID eliminates the need for a centralized ID counter',
  ],

  relatedDesigns: ['rate-limiter', 'real-time-leaderboard', 'stock-broker'],
  relatedConcepts: [
    {
      name: 'Consistent Hashing',
      description: 'Distributes the short-code keyspace across nodes with minimal reshuffling.',
    },
    { name: 'Caching', description: 'Hot short-URL lookups are served from Redis instead of the database.' },
    { name: 'CDN', description: 'Edge nodes handle redirects for popular links close to users.' },
    {
      name: 'Database Sharding',
      description: 'Partitions the code-to-URL mapping table as it grows to billions of rows.',
    },
  ],

  simulator: {
    goalDescription: 'Redirect billions of clicks/day at a 100:1 read-write ratio, with sub-100ms P99 redirect latency worldwide.',
    requirementChips: ['100:1 read:write', 'P99 < 100ms redirect', '100K redirects/sec'],
    targetRps: 100000,
    readRatio: 0.99,
    cacheHitRatio: 0.95,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'cdn-edge', label: 'CDN edge caching for hot redirects', kind: 'requires-node-type', nodeType: 'cdn' },
      { id: 'redis-cache', label: 'Regional cache for sub-ms redirect lookups', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'durable-kv-store',
        label: 'Durable KV store for short_code to long_url mappings',
        kind: 'requires-node-type',
        nodeType: ['dynamodb', 'cassandra', 'postgresql', 'mysql', 'mongodb'],
      },
      {
        id: 'compute-tier',
        label: 'Write/Redirect Service compute tier',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'cdn-1', type: 'cdn', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 3, position: { x: 600, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 8, position: { x: 880, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 2, position: { x: 1160, y: 120 } },
        { id: 'db-1', type: 'dynamodb', instanceCount: 3, position: { x: 1160, y: 280 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 2, position: { x: 1440, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 2, position: { x: 1720, y: 200 } },
      ],
      edges: [
        { id: 'e-client-cdn', source: 'client-1', target: 'cdn-1' },
        { id: 'e-cdn-gw', source: 'cdn-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-redis-db', source: 'redis-1', target: 'db-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
      ],
    },
    referenceArchitectureExplanation:
      'CDN edge caching absorbs the bulk of the 100:1 read-heavy redirect traffic within milliseconds, Redis absorbs most of the remainder on cache misses, and only the small residual reaches the durable KV store that is the actual source of truth; click events are fired to Kafka asynchronously so analytics never adds latency to the hot redirect path.',
    failureModeNarratives: {
      cdn:
        'A single CDN tier fronts all redirect traffic; if it fails, the full 100:1 read load instantly falls through to the API Gateway and Redis layers, which were sized assuming the CDN absorbs most of the hits.',
    },
    fullDesignLinkSlug: 'url-shortener',
  },
}

export default topic
