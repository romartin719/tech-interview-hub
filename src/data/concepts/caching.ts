import type { Concept } from './types'

const concept: Concept = {
  slug: 'caching',
  title: 'Caching',
  number: 16,
  category: 'Caching & Performance',
  icon: 'pi pi-bolt',
  summary: 'Cache-Aside, Stampede, Eviction - storing a cheap copy of expensive-to-compute data.',
  readTimeMinutes: 9,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A cache stores a copy of data that is expensive to compute or fetch, so a later request can be answered from fast storage instead of redoing the expensive work. The two questions that matter in an interview are: where does the cache live relative to the database, and what happens to correctness when the cached copy and the source of truth disagree.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Where Caches Live',
        mermaid: `flowchart LR
  client[Client]:::client
  cdn["CDN / Edge Cache"]:::edge
  app["App Server"]:::compute
  local["In-Process Cache"]:::cache
  redis[("Redis / Memcached")]:::cache
  db[("Database")]:::database
  client -->|"1. Request"| cdn
  cdn -->|"2. Miss"| app
  app -->|"3. Check local"| local
  app -->|"4. Check shared"| redis
  redis -->|"5. Miss"| db`,
      },
    },
    {
      type: 'table',
      caption: 'Caching Strategies',
      headers: ['Strategy', 'How it works', 'Trade-off'],
      rows: [
        ['Cache-Aside (Lazy Loading)', 'App checks cache first; on a miss, reads DB and populates the cache.', 'Simple and widely used, but the first request after a miss/eviction is always slow, and a crash between DB write and cache write can leave the cache stale.'],
        ['Write-Through', 'App writes to the cache, which synchronously writes through to the DB.', 'Cache and DB stay consistent, but every write pays the DB\'s latency - no write speedup.'],
        ['Write-Behind (Write-Back)', 'App writes to the cache, which asynchronously flushes to the DB later.', 'Very fast writes, but a cache-node crash before flush can lose data - needs a durable queue to be safe.'],
        ['Read-Through', 'Cache library itself owns loading from the DB on a miss (app never sees the DB).', 'Cleanest app code, but couples the caching layer to a specific data-loading implementation.'],
      ],
    },
    {
      type: 'table',
      caption: 'Eviction Policies',
      headers: ['Policy', 'Evicts', 'Good for'],
      rows: [
        ['LRU (Least Recently Used)', 'The entry not accessed for the longest time', 'General-purpose - recently used data tends to be used again ("temporal locality")'],
        ['LFU (Least Frequently Used)', 'The entry accessed the fewest total times', 'Workloads with a stable set of "hot" keys that should survive short quiet periods'],
        ['TTL (Time To Live)', 'Any entry older than a fixed duration, regardless of usage', 'Data with a known staleness budget (e.g. a stock quote good for 5 seconds)'],
      ],
    },
    {
      type: 'heading',
      text: 'Cache Invalidation',
    },
    {
      type: 'list',
      items: [
        'TTL expiry - simplest option; accept some staleness up to the TTL window.',
        'Write-invalidate - on every write to the source of truth, explicitly delete or update the corresponding cache key.',
        'Event-driven invalidation - a change-data-capture stream or message queue tells other services/caches that a key changed, decoupling the writer from every cache that needs updating.',
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Cache stampede (thundering herd)',
      text:
        'When a single hot key expires, hundreds of concurrent requests can all miss at once and hammer the database simultaneously - momentarily worse than having no cache at all. Mitigate with: (1) a short-lived lock/mutex so only one request repopulates the key while others wait, (2) probabilistic early expiration (refresh slightly before the real TTL, staggered per-request), or (3) serving stale data for a grace period while one request refreshes in the background.',
    },
    {
      type: 'list',
      items: [
        'In-process caches (Caffeine, Guava): fastest (no network hop), but not shared across app instances.',
        'Redis / Memcached: shared across all app instances, adds one network hop; Redis additionally supports rich data structures (sorted sets, hashes) beyond simple key-value.',
        'CDN edge caches (CloudFront, Cloudflare): cache whole HTTP responses close to users; ideal for public, cacheable content.',
      ],
    },
  ],
  relatedConcepts: ['rate-limiting', 'cdn', 'database-replication'],
}

export default concept
