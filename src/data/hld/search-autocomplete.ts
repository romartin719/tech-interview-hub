import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'search-autocomplete',
  title: 'Search Autocomplete / Typeahead',
  difficulty: 'Intermediate',
  icon: 'pi pi-search',
  color: '#14b8a6',
  readTimeMinutes: 24,
  topics: ['Trie / Prefix Tree', 'Top-K Precomputation', 'Offline Index Rebuilds'],
  companies: ['Google', 'Amazon', 'Elasticsearch', 'Algolia'],
  prerequisites: ['Caching', 'Sharding a Database'],
  summary:
    "A typeahead service answers 'what might the user be typing' by walking an in-memory trie whose every node has its top-K completions precomputed offline, blending in a fast streaming layer for queries that are trending right now, so a lookup stays under 100ms even across billions of distinct historical queries.",

  understandingProblem:
    "Every search box you've ever used - Google, Amazon's product search, your phone's contacts app - starts suggesting things before you finish typing. That's autocomplete, and it exists for a very simple reason: typing is slow and search is guessable. Most people type the same handful of things (\"weather\", \"news\", a handful of trending topics) and most queries in general follow a long-tail distribution where a small set of phrases accounts for a huge share of traffic. If you can guess the rest of a query from its first two or three characters with reasonable confidence, you save the user keystrokes, correct typos before they happen, and steer them toward the query your backend actually knows how to answer well. The hard part isn't the UI dropdown - it's answering \"what are the top 10 things people search for that start with 'net'\" for millions of distinct prefixes, in under 100 milliseconds, while the underlying popularity data keeps shifting in real time (a breaking news event can make an obscure phrase the most popular query on the planet within minutes).",
  realExamples:
    "Google autocomplete famously targets sub-100ms end-to-end latency and serves suggestions after every keystroke across billions of searches a day. LinkedIn's internal typeahead system (nicknamed \"Cleo\") serves search-box, mentions, and job-title suggestions at p99 latencies under 50ms by precomputing ranked results per prefix. Facebook's search typeahead blends a static popularity index with per-user social-graph signals (friends' names rank above strangers with the same prefix). Elasticsearch ships a dedicated \"Completion Suggester\" built on a finite-state transducer specifically because walking a naive trie and sorting at read time doesn't scale past a few thousand requests per second.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  api["API Server<br/>runs SQL on every keystroke"]:::compute
  db[("queries table<br/>(text, count)")]:::database
  client -->|"keystroke"| api
  api -->|"SELECT ... WHERE text LIKE 'prefix%'<br/>ORDER BY count DESC LIMIT 10"| db`,
    },
    whyThisBreaks: [
      "One query per keystroke - typing \"network\" fires 7 separate round trips to the database in under two seconds, and every one of them has to finish before the dropdown updates.",
      "Ranking is the expensive part, not matching - the LIKE 'net%' scan itself can use a B-tree range, but sorting every matching row by count at read time means scanning potentially millions of rows for a common 2-3 character prefix.",
      "It doesn't scale horizontally - at 100K concurrent users each typing at a normal pace, that's 700K+ queries/sec landing directly on one relational database; it falls over long before you hit real production traffic.",
      "Freshness is backwards - a synchronous UPDATE on every completed search means write contention on hot rows (everyone incrementing the count for \"weather\" at once), yet a genuinely new trending phrase still has to accumulate enough rows to out-rank the incumbents before anyone sees it.",
      'No tolerance for anything fuzzy - a single typo ("netflx") or word reordering ("case iphone") returns zero rows even though the data to satisfy the intent clearly exists in the table.',
    ],
    closingNote:
      "The fix for the first two problems is the same data structure every dictionary implementation has used for decades: a trie. Walking a trie by prefix is O(prefix length) instead of a table scan - but a plain trie still has to walk every completion under a node and sort it at read time, so that's the next problem to kill.",
  },

  priorArt: [
    {
      title: 'Google Search Autocomplete',
      description:
        'Targets end-to-end sub-100ms suggestion latency after every keystroke, blending long-term popularity with real-time trending signals and per-user personalization from recent search history. (Google Search Help / engineering blog posts)',
      link: 'https://blog.google/products-and-platforms/products/search/how-google-autocomplete-predictions-work/',
    },
    {
      title: "LinkedIn's Cleo Typeahead Platform",
      description:
        'A shared internal typeahead service used for search-box, @mention, and job-title suggestions across LinkedIn products, serving precomputed ranked results at p99 under 50ms by keeping per-prefix answers cached rather than computed live. (LinkedIn Engineering blog)',
      link: 'https://engineering.linkedin.com/open-source/cleo-open-source-technology-behind-linkedins-typeahead-search',
    },
    {
      title: 'Facebook Search Typeahead',
      description:
        "Combines a static, offline-built popularity index with live social-graph signals - a friend's name with the same prefix as a celebrity's outranks the celebrity for that particular searcher. (Facebook Engineering blog)",
      link: 'https://engineering.fb.com/2010/05/17/web/the-life-of-a-typeahead-query/',
    },
    {
      title: 'Elasticsearch Completion Suggester',
      description:
        'Uses a Finite State Transducer (FST) instead of a raw trie for prefix completion, because an FST shares common suffixes across many entries and is far more memory-dense at the scale of a real product catalog or query log. (Elastic documentation)',
      link: 'https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/completion',
    },
    {
      title: "AWS's Autocomplete Reference Architectures",
      description:
        'Recommends a managed search layer (OpenSearch / Elasticsearch) fronted by a CDN and cache for the hottest prefixes, explicitly calling out that recomputing rankings per request is the most common autocomplete anti-pattern teams ship. (AWS Architecture blog)',
    },
  ],

  coreEntities: [
    { name: 'Query', description: 'A completed search string, logged once the user actually submits it (not every keystroke).' },
    { name: 'PrefixNode', description: 'One character in the trie; holds child pointers and a precomputed list of its top-K completions.' },
    { name: 'Suggestion', description: 'A ranked (text, score) pair returned to the client for a given prefix.' },
    {
      name: 'QueryAggregate',
      description: 'A time-bucketed popularity count for one query string, produced by the offline aggregation pipeline.',
    },
    {
      name: 'TrendingSignal',
      description: "A short-lived, fast-moving score (EMA of recent request rate) tracking queries that are spiking right now.",
    },
  ],

  requirements: {
    core: [
      'Return the top-K (5-10) suggestions for any prefix in well under 100ms at the p99',
      'Rank suggestions primarily by historical popularity, with a boost for queries that are trending in the last few minutes',
      'Ingest new completed queries continuously so a genuinely popular new phrase surfaces within minutes, not days',
      "Personalize lightly using the searcher's own recent query history when available",
      'Debounce on the client so the backend is not hit on every single keystroke',
    ],
    belowTheLine: [
      'Full typo tolerance / fuzzy matching (treated as a deep dive, not a core requirement)',
      'Multi-language transliteration and script conversion',
      'Voice or image-based query suggestions',
      'Semantic / intent-based suggestions powered by an ML ranking model',
      'Sponsored or ad-injected suggestions',
      'Cross-device sync of personal search history',
    ],
    nonFunctionalTable: [
      { metric: 'p99 latency', target: '< 100ms end-to-end; < 50ms inside the trie-serving tier itself' },
      { metric: 'Availability', target: '99.99% - autocomplete failing should degrade to "no suggestions", never break search' },
      { metric: 'Read:write ratio', target: '~1000:1 - every keystroke is a read; writes trickle in from an offline aggregation job' },
      { metric: 'Freshness', target: 'Trending queries visible within 5-15 minutes; steady-state popularity refreshed every rebuild cycle' },
      { metric: 'Throughput', target: '100K+ prefix lookups/sec at peak across all shards' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Prefix Index',
      purpose: 'In-memory top-K completions cached per prefix node, looked up by prefix string',
      primaryPick: 'Custom Trie Service',
      alternatives: 'Elasticsearch Completion Suggester, Redis sorted sets',
      whyPrimaryWins: 'Walking a prefix is O(prefix length) with the top-K already cached at the node - a read never sorts',
    },
    {
      tier: 'Query Event Stream',
      purpose: 'Ingest every completed search as a durable, ordered event',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, Redpanda',
      whyPrimaryWins: 'A durable, ordered log lets the aggregator and trending detector consume independently at their own pace',
    },
    {
      tier: 'Stream Aggregation',
      purpose: 'Roll completed queries up into windowed popularity counts',
      primaryPick: 'Kafka Streams',
      alternatives: 'Flink, Spark Structured Streaming',
      whyPrimaryWins: 'Windowed aggregation keeps the popularity store from drowning in raw per-query events',
    },
    {
      tier: 'Popularity Store',
      purpose: 'Durable per-query aggregated counts read by the periodic Trie Builder',
      primaryPick: 'Cassandra',
      alternatives: 'DynamoDB, Postgres (at moderate scale)',
      whyPrimaryWins: 'Wide-column writes absorb continuous count upserts, and a full snapshot read for rebuilds is exactly what wide-column storage is built for',
    },
    {
      tier: 'Hot-Prefix / Trending Cache',
      purpose: 'Cache ranked results for the hottest prefixes and short-lived trending boosts',
      primaryPick: 'Redis',
      alternatives: 'Memcached, Cloudflare Workers KV',
      whyPrimaryWins: 'Sorted sets and short TTLs absorb the top 10K-50K prefixes that account for 70-80% of all traffic',
    },
    {
      tier: 'Query Log Analytics',
      purpose: 'Long-term storage of raw query logs for offline analysis',
      primaryPick: 'ClickHouse',
      alternatives: 'BigQuery, Redshift, Snowflake',
      whyPrimaryWins: 'Columnar OLAP storage makes ad hoc analysis of billions of historical queries cheap, off the hot serving path',
    },
  ],
  technologyChoicesNote:
    "Why a custom Trie over Elasticsearch's Completion Suggester? For pure prefix completion at 100K+ QPS, an in-memory Trie with precomputed top-K at every node is 10-50x faster because it skips serialization and network hops entirely. Elasticsearch only earns its keep here if fuzzy matching, typo correction, and faceted search need to live alongside autocomplete.",

  scaleEstimation: [
    'Traffic: assume 500M daily active searchers issuing ~5 completed searches/day = 2.5B completed queries/day (~30K QPS average).',
    'Each completed search is preceded by ~5-8 keystrokes, but client-side debouncing collapses that into roughly one lookup request per 100-150ms of typing, so raw suggestion-request volume runs 3-5x completed-query volume - on the order of 100K-150K lookup requests/sec at peak.',
    'Vocabulary size: hundreds of millions of distinct historical query strings exist, but traffic follows a steep long-tail curve - the trie only needs to retain the top 50-100M by frequency to answer the overwhelming majority of live traffic.',
    'Trie memory footprint: with an average query length of ~20 characters and a precomputed top-10 suggestion list (~50 bytes per entry) cached at every node, the full in-memory structure lands around 200-500GB - too big for one machine, which is what forces sharding.',
    'Raw log volume: 2.5B completed queries/day at ~100 bytes/event is roughly 250GB/day of raw events before offline aggregation collapses it down by orders of magnitude into per-query counts.',
    'Cache effectiveness: the top 10K-50K prefixes (mostly 1-3 characters) absorb an estimated 70-80% of all traffic thanks to the Zipfian shape of real typing patterns - small enough to sit entirely in a Redis layer in front of the trie service.',
  ],

  apiInterface: [
    {
      method: 'GET',
      path: '/v1/suggest?q={prefix}&limit=8',
      description: 'Returns ranked suggestions for a prefix, blending precomputed popularity with any live trending boost.',
      example:
        '// Request\nGET /v1/suggest?q=net&limit=8\n\n// Response 200\n{\n  "prefix": "net",\n  "suggestions": [\n    { "text": "netflix", "score": 0.94 },\n    { "text": "netflix down", "score": 0.81, "trending": true },\n    { "text": "network error fix", "score": 0.42 }\n  ]\n}',
    },
    {
      method: 'GET',
      path: '/v1/suggest?q={prefix}&userId={id}',
      description: "Same as above, but blends in the caller's recent personal search history when a userId is present.",
      example: '// Response includes a "personal": true flag on entries pulled from the user\'s own history\n{ "text": "netflix account settings", "score": 0.88, "personal": true }',
    },
    {
      method: 'POST',
      path: '/v1/queries/completed',
      description: 'Internal endpoint the search frontend calls once a query is actually submitted, feeding the offline aggregation pipeline.',
      example: '// Request\n{ "text": "network engineer salary", "userId": "u_991", "ts": 1751000000 }\n\n// Response 202\n{ "accepted": true }',
    },
    {
      method: 'DELETE',
      path: '/v1/history/{userId}',
      description: "Clears a user's personal search history used for personalization, for privacy/GDPR-style deletion requests.",
      example: '// Response 204 No Content',
    },
    {
      method: 'POST',
      path: '/v1/admin/reindex',
      description: 'Manually triggers an out-of-cycle trie rebuild; used operationally when a known event needs suggestions boosted immediately.',
    },
  ],
  apiSecurityNote:
    "The personalized variant of /v1/suggest requires an authenticated session so one user's history is never blended into another's response. All variants are rate-limited per user/IP, since prefix enumeration (walking a-z, aa-az, ...) is a cheap way to scrape the entire underlying vocabulary.",

  highLevelDesignIntro:
    "Let's build this up incrementally: start with the trie itself, precompute rankings so reads never sort at request time, then work through how that index actually stays correct and fresh once it's too big to rebuild synchronously or fit on one box.",

  builds: [
    {
      title: 'Replace the Table Scan With an In-Memory Trie',
      body:
        "A trie (prefix tree) stores every known query character-by-character: each node represents one character, and a path from the root spells out a prefix. Looking up a prefix means walking one character at a time from the root - that's O(prefix length) regardless of how many total queries exist in the trie, which already beats a database scan by orders of magnitude.\n\nBut a plain trie only tells you \"does anything start with this prefix\" - to actually return the top 10 completions you still have to walk every leaf under that node and sort by popularity. For a 2-character prefix like \"ne\", that subtree can contain tens of thousands of completions. We've removed the database, but we haven't removed the sort.",
      newComponents: [
        {
          name: 'Trie Service',
          description: 'An in-memory service holding the full prefix tree; walks the tree by character to locate the node for a given prefix.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api["Trie Service"]:::compute
  trie[("In-memory Trie<br/>one node per character")]:::storage
  client -->|"1. GET /suggest?q=net"| api
  api -->|"2. walk n -> e -> t"| trie
  trie -->|"3. subtree under 'net'"| api
  api -->|"4. walk + sort at read time"| client`,
      },
      closingNote:
        "Sorting a potentially huge subtree on every single keystroke is exactly the bottleneck we just escaped from the database. The fix is to do that sorting once, offline, and cache the answer directly on the node.",
    },
    {
      title: 'Precompute the Top-K at Every Node',
      body:
        "Here's the key idea that makes typeahead systems fast: instead of computing rankings when a request arrives, precompute the top-K completions for every single node while building the trie, and store that list directly on the node. A lookup then becomes: walk to the node for the prefix (O(prefix length)), and return the list that's already sitting there. No subtree walk, no sort, no per-request work beyond a pointer chase.\n\nThe cost moves entirely to build time - when you insert or reprocess the vocabulary, every ancestor of a query's leaf node needs its top-K list re-evaluated, since a new heavily-searched phrase can knock an existing suggestion out of the top 10 at every prefix length along the way. That's an expensive operation across a huge trie, which is exactly why you don't want to do it live, on every write.",
      insightCallout:
        "This is the single most important idea in the whole design: shift the expensive work (ranking) from read time, where it happens millions of times a second, to build time, where it happens once per rebuild cycle. Every other build below exists to make that precomputation cheap enough to redo regularly and fresh enough that it doesn't feel stale.",
      diagram: {
        mermaid: `flowchart TD
  root(["root"]):::storage
  n(["n"]):::storage
  ne(["ne"]):::storage
  net(["net<br/>top-10 cached:<br/>netflix, network, net worth ..."]):::cache
  root --> n --> ne --> net
  lookup["GET /suggest?q=net"]:::client
  lookup -->|"1. walk 3 chars"| net
  net -->|"2. return cached list, no sort"| result["8 suggestions in < 1ms"]:::compute`,
      },
      closingNote:
        "Precomputed top-K per node makes reads nearly free, but it means writes are expensive - inserting one new popular query can force re-ranking at every ancestor node up to the root. Doing that synchronously on every completed search would make writes as slow as the reads used to be, so the next build moves index construction off the request path entirely.",
    },
    {
      title: 'Build the Trie Offline From Query Logs, Then Hot-Swap It In',
      body:
        "Since maintaining precomputed top-K lists incrementally is expensive, don't do it incrementally at all. Log every completed query to a stream (Kafka), aggregate counts in fixed windows, and periodically (every 10-15 minutes is typical) run a batch job that reads the current popularity snapshot, builds an entirely new trie from scratch with fresh top-K caches at every node, serializes it, and atomically swaps it into the serving fleet in place of the old one.\n\nThis sidesteps the whole \"re-rank every ancestor on every write\" problem: the new trie is built once, in isolation, off the request path, and old requests keep being served by the previous trie snapshot until the swap completes - so there's no window where reads see a half-built structure.",
      newComponents: [
        { name: 'Query Logger', description: 'Publishes an event to a stream for every completed (not every keystroke) search.' },
        { name: 'Stream Aggregator', description: 'Consumes the event stream in windows and maintains rolling popularity counts per query string.' },
        { name: 'Popularity Store', description: 'A wide-column store (e.g. Cassandra) holding the current aggregated count for every known query.' },
        { name: 'Trie Builder', description: 'A periodic batch job that reads the popularity snapshot and builds a fresh trie with top-K caches precomputed at every node.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  logger["Query Logger"]:::async
  kafka[/"Event Stream (Kafka)"/]:::async
  agg["Stream Aggregator"]:::compute
  store[("Popularity Store")]:::database
  builder["Trie Builder<br/>(every 10-15 min)"]:::compute
  shards["Serving Trie Shards"]:::cache
  logger -->|"1. completed query event"| kafka
  kafka -->|"2. windowed batches"| agg
  agg -->|"3. upsert counts"| store
  builder -->|"4. read snapshot"| store
  builder -->|"5. build + precompute top-K"| builder
  builder -->|"6. atomic hot-swap"| shards`,
      },
      closingNote:
        "Rebuilding every 10-15 minutes keeps the trie from ever needing expensive live edits, but it also means a query that suddenly goes viral won't show up in suggestions until the next rebuild - which could be 14 minutes away. For breaking news, 14 minutes is an eternity, so the next build adds a fast path that doesn't wait for the batch job at all.",
    },
    {
      title: 'Layer a Real-Time Trending Signal on Top of the Batch Trie',
      body:
        "The batch trie is intentionally slow-moving - it answers \"what's popular over the long run.\" To catch things that are popular right now, run a second, much lighter pipeline directly off the same event stream: for every completed query, update an exponential moving average (EMA) of its recent request rate, and compare that EMA against its historical baseline. When a query's EMA spikes well above baseline (3x or more is a common trigger), write it into a small, short-TTL trending cache with a boost score.\n\nAt read time, the trie service fetches the cached top-K for the prefix and merges in any trending entries for that same prefix from the trending cache, giving trending results a score boost so they surface near the top without needing a trie rebuild at all. A trending entry naturally expires (TTL of a couple of hours) once its spike subsides, so this cache never grows large enough to need its own rebalancing story.",
      newComponents: [
        { name: 'Trending Detector', description: "Consumes the same event stream and computes an EMA-based spike score per query text in near real time." },
        { name: 'Trending Cache', description: 'A small Redis sorted set holding currently-spiking queries with a boost score and a short TTL.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  kafka[/"Event Stream"/]:::async
  detector["Trending Detector<br/>EMA vs. baseline"]:::compute
  tcache[("Trending Cache<br/>TTL ~2h")]:::cache
  trieSvc["Trie Service"]:::compute
  client[Client]:::client
  kafka -->|"1. stream of completed queries"| detector
  detector -->|"2. spike detected, write boost"| tcache
  client -->|"3. GET /suggest?q=earth"| trieSvc
  trieSvc -->|"4. read batch top-K"| trieSvc
  trieSvc -->|"5. read trending boost"| tcache
  trieSvc -->|"6. merged, boosted list"| client`,
      },
      closingNote:
        "Freshness solved - a phrase can go from unranked to the top suggestion within seconds of spiking, without touching the multi-hundred-gigabyte batch trie at all. The remaining problem is that a multi-hundred-gigabyte trie doesn't fit comfortably on one machine to begin with, so the next build tackles sharding.",
    },
    {
      title: 'Shard the Trie Across Machines by Prefix',
      body:
        "At 200-500GB for the full vocabulary and 100K+ lookups/sec, one machine can't hold the trie or absorb the traffic. The obvious first idea - shard by first letter (a, b, c, ... z) - fails immediately in practice: English text is heavily skewed, so an \"s\" shard (search, security, sports, ...) can see 5-10x the traffic of an \"x\" or \"z\" shard sitting nearly idle.\n\nSharding by the first two characters flattens the curve somewhat but is still skewed by real language frequency (\"th\", \"an\", \"re\" are everywhere), and now single-character prefixes have to fan out to dozens of shards and merge the results, adding tail latency to the exact requests that are the cheapest to answer. The production answer is weighted sharding driven by observed QPS per prefix range rather than a fixed character boundary: a control plane continuously monitors traffic per shard and splits hot ranges further (giving \"s\"-heavy ranges more replicas and narrower boundaries) while cold ranges are merged or share resources - the same idea Bigtable uses to auto-split hot tablets.",
      newComponents: [
        { name: 'Shard Router', description: "Routes a lookup to the shard owning that prefix's range; fans out to multiple shards only for very short prefixes." },
        { name: 'Shard Control Plane', description: 'Monitors per-shard QPS and dynamically re-splits hot prefix ranges, rebalancing load across the fleet.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  router["Shard Router"]:::compute
  shardAI["Shard: a-i"]:::cache
  shardJR["Shard: j-r"]:::cache
  shardSZsplit1["Shard: s-sn<br/>(split off hot range)"]:::cache
  shardSZsplit2["Shard: so-z"]:::cache
  control["Shard Control Plane<br/>watches QPS, re-splits hot ranges"]:::edge
  router -->|"1. q=network"| shardJR
  router -->|"2. q=search"| shardSZsplit1
  router -->|"3. q=zebra"| shardSZsplit2
  control -->|"4. monitors + rebalances"| shardAI
  control -->|"5. monitors + rebalances"| shardJR
  control -->|"6. monitors + rebalances"| shardSZsplit1
  control -->|"7. monitors + rebalances"| shardSZsplit2`,
      },
      closingNote:
        "Sharding solves capacity, but every one of those shards still gets hammered by the same handful of one- and two-character prefixes - everyone's search starts with something short. The next build absorbs that traffic before it ever reaches a trie shard.",
    },
    {
      title: 'Cache the Hottest Prefixes in Front of the Trie Service',
      body:
        "Real typing follows a steep power law: the first one or two characters someone types are shared by nearly every user (there just aren't that many starting letters), so a tiny number of very short prefixes account for a hugely disproportionate share of total traffic. Put a Redis (or CDN edge) cache in front of the trie shards keyed by the raw prefix string, with a short TTL (5-15 minutes, matched roughly to the trie rebuild cadence). The top 10K-50K cached prefixes alone can absorb 70-80% of all incoming lookups, meaning the trie shards themselves only ever see the long tail.\n\nThe one thing to watch for is a cache stampede: if a hot prefix's TTL expires and 10,000 requests hit at the same instant, they'd all miss together and hammer the same trie shard simultaneously. Mitigate with probabilistic early expiration (refresh slightly before the TTL actually lapses, with randomized jitter) and request coalescing, so only one request per key actually reaches the trie service while the rest wait on that single in-flight fetch.",
      newComponents: [
        { name: 'Edge / Redis Cache', description: 'Caches ranked suggestions per raw prefix string, absorbing the vast majority of short-prefix traffic before it reaches any trie shard.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  edge["CDN / Edge"]:::edge
  redis[("Redis<br/>hot prefix cache")]:::cache
  trieSvc["Trie Service Shards"]:::compute
  client -->|"1. GET /suggest?q=n"| edge
  edge -->|"2. cache miss"| redis
  redis -->|"3. miss, single-flight fetch"| trieSvc
  trieSvc -->|"4. ranked list"| redis
  redis -->|"5. cache + return"| edge
  edge -->|"6. cached hit next time"| client`,
      },
      closingNote:
        "Global popularity plus caching gets every user the same ranked answer for the same prefix - but the single best suggestion for \"amazon\" might genuinely differ between someone who works there and someone who just wants to shop. The next build layers in a thin personalization signal without touching the shared global index.",
    },
    {
      title: "Blend in the User's Own Recent History",
      body:
        "Keep a small, per-user list of recently completed searches (a few dozen entries, in a fast key-value store or even client-side local storage synced lazily). When a personalized request comes in, check that personal list for entries matching the current prefix, and merge them into the global, cached result with a strong boost - your own recent search for \"netflix account settings\" should outrank the globally-popular \"netflix\" if you typed \"netflix a\" yesterday and are typing \"netflix a\" again today.\n\nThis has to stay small and separate from the shared global trie on purpose: personal history is high-cardinality (one list per user, not one shared structure) and low-volume per user, so it's cheap to store and look up independently, and a bug in personalization can never corrupt the shared ranking every other user sees.",
      diagram: {
        mermaid: `flowchart LR
  request["GET /suggest?q=netflix a&userId=u_991"]:::client
  global["Global Cache/Trie<br/>shared ranking"]:::cache
  personal[("Personal History Store<br/>per-user, small")]:::database
  merge["Merge + boost personal matches"]:::compute
  request -->|"1. fetch shared"| global
  request -->|"2. fetch personal"| personal
  global -->|"3. global list"| merge
  personal -->|"4. personal matches"| merge
  merge -->|"5. final ranked list"| request`,
      },
      closingNote:
        "The backend can now answer any prefix accurately, quickly, freshly, and personally - but none of that matters if the client fires a network request on literally every keystroke. The last build moves part of the design onto the client itself.",
    },
    {
      title: 'Debounce and Cancel on the Client',
      body:
        "The 100ms latency budget for this system is a backend number, but the actual user-perceived experience is shaped just as much by client behavior. Fire a request only after the user pauses typing for roughly 100-150ms (debouncing), rather than on every keystroke - this alone can cut request volume by 3-5x with no loss in perceived responsiveness, since most people type faster than a round trip would even return.\n\nJust as important: cancel any in-flight request the moment a newer keystroke supersedes it. Without cancellation, a slow response to an old prefix (\"ne\") can arrive after a newer, faster response to a longer prefix (\"net\") and stomp the dropdown with stale suggestions. Keep the previous response rendered (grayed out or as-is) while the next one is in flight, so the UI never flashes empty between keystrokes.",
      steps: [
        'Start (or reset) a debounce timer on every keystroke; only fire the request once the timer elapses without another keystroke.',
        'Tag each outgoing request with a monotonically increasing sequence number.',
        'On response, discard it if a request with a higher sequence number has already returned or is still in flight.',
        'Keep the last-good result rendered until a newer response replaces it, so the dropdown never blanks mid-type.',
      ],
      closingNote:
        "With debouncing and cancellation on the client, request-per-keystroke pressure on the backend drops to a fraction of raw typing speed, closing the loop on a design that is now fast, fresh, personalized, and sharded to scale.",
    },
  ],

  coreFlows: [
    {
      title: 'User Types a Character and Gets Suggestions',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant C as Client (debounced)
  participant Edge as CDN / Edge Cache
  participant R as Redis Hot-Prefix Cache
  participant TS as Trie Service Shard
  participant TC as Trending Cache

  U->>C: types "n", "e", "t"
  C->>C: debounce 120ms, no further keystrokes
  C->>Edge: GET /v1/suggest?q=net
  Edge->>R: cache miss, forward
  R->>R: cache miss on key "net"
  R->>TS: route to shard owning "net"
  TS->>TS: walk root -> n -> e -> t, read cached top-K
  TS->>TC: fetch trending boost for prefix "net"
  TC-->>TS: "netflix down" trending +boost
  TS-->>R: merged ranked list, cache 5min TTL
  R-->>Edge: response
  Edge-->>C: response
  C-->>U: render suggestion dropdown`,
      },
      nonObviousFailure:
        'If the trending cache lookup times out, the trie service must still return the plain batch ranking rather than failing the whole request - a missing trending boost degrades quality slightly; a hard failure removes autocomplete entirely.',
    },
    {
      title: 'The Trie Gets Rebuilt From Aggregated Query Logs',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant QL as Query Logger
  participant K as Event Stream (Kafka)
  participant SA as Stream Aggregator
  participant PS as Popularity Store
  participant TB as Trie Builder
  participant SH as Serving Shards

  QL->>K: publish completed query event
  K->>SA: consume windowed batch
  SA->>PS: upsert (query, count, last_seen)
  Note over TB: fires every 10-15 minutes
  TB->>PS: read full popularity snapshot
  TB->>TB: build new trie, precompute top-K at every node
  TB->>TB: serialize and split by shard prefix range
  TB->>SH: push new snapshot per shard
  SH->>SH: atomic hot-swap; old trie freed after in-flight reads drain`,
      },
      nonObviousFailure:
        'A rebuild that crashes partway through must never partially swap shards - some serving a fresh trie and others a stale one produces visibly inconsistent suggestions across requests; the swap has to be all-or-nothing per rebuild cycle.',
    },
    {
      title: 'A Query Suddenly Starts Trending',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant K as Event Stream
  participant TD as Trending Detector
  participant TC as Trending Cache
  participant TS as Trie Service

  K->>TD: stream of completed query events
  TD->>TD: update EMA per query text
  TD->>TD: "earthquake bay area" EMA hits ~300x baseline
  TD->>TC: write trending entry, boost score, TTL 2h
  TS->>TC: next lookup for prefix "earth" checks trending cache
  TC-->>TS: boosted entry returned
  TS-->>TS: merge with unchanged batch trie result
  Note over TS: surfaces within seconds, batch trie untouched`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Keeping the Index Fresh Without Rebuilding Constantly',
      problem:
        'The batch-rebuilt trie is the source of ranking truth, but it is stale by definition - anywhere from a few minutes to 15 minutes old at any given moment.',
      bad:
        "Rely on the batch rebuild alone and just shrink the interval - rebuild every 1-2 minutes instead of every 15. This reduces staleness but does not eliminate it, and rebuilding a 300GB+ trie with fresh top-K precomputation at every node every 60-120 seconds burns enormous CPU and memory, risks overlapping builds stepping on each other, and still can't react to a spike that started 30 seconds ago.",
      good:
        "Shrinking the interval further and further chases diminishing returns - at some point you are spending more compute rebuilding the trie than serving traffic from it, and you are still fundamentally bound by however long a full rebuild takes to reach the serving fleet.",
      great:
        "Decouple the two concerns entirely: keep the batch trie on its comfortable 10-15 minute cycle for stable, high-confidence popularity ranking, and run a separate, lightweight streaming layer (the EMA-based trending detector) that reacts within seconds and is merged in at read time. The batch trie answers \"what's reliably popular\"; the streaming layer answers \"what's happening right now\" - together they cover both timescales without either one needing to do the other's job.",
    },
    {
      title: 'Typo Tolerance / Fuzzy Matching',
      simpleTerms: "Handling a search for \"netflx\" as if the user had typed \"netflix\".",
      problem: 'A pure trie only matches exact character-by-character prefixes, so a single typo returns zero results even when the intended query is one of the most popular in the system.',
      bad:
        'No fuzzy matching at all - "netflx" or "amaozn" return an empty suggestion list despite "netflix" and "amazon" being some of the highest-volume queries in the entire vocabulary; the user has to notice and self-correct the typo mid-search.',
      good:
        'Brute-force edit-distance comparison against the vocabulary at query time (compute Levenshtein distance between the typed prefix and every candidate). This is correct, but scanning the vocabulary with an edit-distance calculation per candidate is far too slow at 100K+ QPS - it reintroduces exactly the kind of per-request computation the whole design has been trying to eliminate.',
      great:
        'Precompute fuzzy matches offline, the same way top-K is precomputed: build a SymSpell-style deletion dictionary (or a BK-tree) during the same batch rebuild, mapping every popular query and its edit-distance-1/2 variants to the original term. At read time, a fuzzy lookup becomes a small number of extra O(1) dictionary hits merged with the exact-prefix results - no live edit-distance computation on the hot path, and the fix arrives on the same rebuild cadence as everything else.',
    },
    {
      title: 'Sharding the Trie Without Killing Merge Performance',
      problem: 'A single trie is too large for one machine, but naive sharding schemes create hot shards and force expensive multi-shard fan-out for the shortest, most common prefixes.',
      bad:
        'Shard strictly by first letter. English usage is heavily skewed - an "s" shard (search, security, sports, sale, ...) can see 5-10x the QPS of an "x" or "q" shard, so most of the fleet sits underutilized while a handful of shards are overloaded.',
      good:
        'Shard by the first two characters instead of one. This flattens the distribution somewhat, but common digraphs ("th", "an", "re") are still hot relative to rare ones, and now every single-character prefix (which is extremely common traffic - everyone starts somewhere) has to fan out to dozens of shards and merge the results, adding real tail latency to the cheapest, most frequent class of request.',
      great:
        "Shard using weighted or consistent hashing driven by observed QPS per prefix range rather than any fixed character boundary, with a control plane that continuously monitors traffic and re-splits hot ranges into more, narrower shards while merging cold ranges to save resources - conceptually the same mechanism Bigtable uses to auto-split hot tablets. This keeps any single shard's load bounded and limits multi-shard fan-out to only the very shortest, rarest prefixes rather than the majority of traffic.",
    },
  ],

  selfAudit: [
    {
      question: 'Why not just query a database and ORDER BY count on every keystroke?',
      answer: 'Ranking at read time means scanning and sorting every matching row - fine for a handful of QPS, impossible at 100K+/sec.',
    },
    {
      question: 'Why precompute the top-K at every trie node instead of at read time?',
      answer: 'It moves ranking work from every request to a single offline build step, making a lookup O(prefix length) with zero sorting.',
    },
    {
      question: 'Why rebuild the whole trie offline instead of updating it live on every write?',
      answer: "A live insert would force re-ranking every ancestor node up to the root; batch rebuild + atomic hot-swap avoids that entirely.",
    },
    {
      question: "How do you show a query that's trending right now if the batch trie is 10 minutes stale?",
      answer: 'A separate lightweight EMA-based streaming layer flags spikes within seconds and gets merged in at read time.',
    },
    {
      question: 'How do you scale the trie past one machine?',
      answer: 'Shard by prefix range using observed QPS (weighted/consistent hashing), not a fixed first-letter boundary.',
    },
    {
      question: 'The trie is already in memory - why cache in front of it too?',
      answer: 'A tiny set of 1-2 character prefixes accounts for most traffic; a Redis/CDN cache absorbs it before it reaches any shard.',
    },
    {
      question: 'How do you avoid hammering the backend on every keystroke?',
      answer: 'Client-side debouncing (~100-150ms) plus cancelling stale in-flight requests when a newer keystroke supersedes them.',
    },
    {
      question: 'How would you add typo tolerance without blowing the latency budget?',
      answer: 'Precompute an edit-distance dictionary (SymSpell-style) offline during the same rebuild, not a live Levenshtein scan.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  client[Client]:::client
  edge["CDN / Edge Cache"]:::edge
  redis[("Redis<br/>hot prefix cache")]:::cache
  router["Shard Router"]:::compute
  shard1["Trie Shard a-i"]:::compute
  shard2["Trie Shard j-r"]:::compute
  shard3["Trie Shard s-z"]:::compute
  tcache[("Trending Cache")]:::cache
  personal[("Personal History Store")]:::database

  logger["Query Logger"]:::async
  kafka[/"Event Stream (Kafka)"/]:::async
  agg["Stream Aggregator"]:::compute
  store[("Popularity Store")]:::database
  builder["Trie Builder<br/>(batch, every 10-15 min)"]:::compute
  detector["Trending Detector<br/>EMA vs baseline"]:::compute
  control["Shard Control Plane"]:::edge

  client -->|"debounced request"| edge
  edge -->|"cache miss"| redis
  redis -->|"cache miss"| router
  router --> shard1
  router --> shard2
  router --> shard3
  shard1 -->|"trending boost"| tcache
  shard2 -->|"trending boost"| tcache
  shard3 -->|"trending boost"| tcache
  shard1 -->|"personal boost"| personal

  logger --> kafka
  kafka --> agg
  agg --> store
  kafka --> detector
  detector --> tcache
  builder --> store
  builder -->|"hot-swap"| shard1
  builder -->|"hot-swap"| shard2
  builder -->|"hot-swap"| shard3
  control -->|"monitor + rebalance"| shard1
  control -->|"monitor + rebalance"| shard2
  control -->|"monitor + rebalance"| shard3`,
  },

  keyTechnologies: [
    { term: 'Trie (Prefix Tree)', definition: 'A tree where each edge is one character; a path from the root spells a prefix, making prefix lookups O(prefix length).' },
    {
      term: 'Top-K Precomputation',
      definition: 'Caching the ranked list of best completions directly on each trie node at build time, so a read never has to sort.',
    },
    {
      term: 'Finite State Transducer (FST)',
      definition: 'A more memory-dense alternative to a trie that shares common suffixes across entries; used by Elasticsearch\'s Completion Suggester.',
    },
    {
      term: 'Exponential Moving Average (EMA)',
      definition: 'A rolling average that weights recent data more heavily, used here to detect a query suddenly spiking above its historical baseline.',
    },
    {
      term: 'Weighted / Consistent Hashing',
      definition: 'A sharding scheme that assigns key ranges to shards based on observed load rather than a fixed boundary, letting hot ranges split further.',
    },
    { term: 'Kafka (Event Stream)', definition: 'A durable, ordered log of events - here, every completed search - that multiple independent consumers (aggregator, trending detector) can read.' },
    {
      term: 'SymSpell / Edit-Distance Dictionary',
      definition: 'A precomputed mapping of a term and its common typo variants (deletions within 1-2 edits) to the correct term, avoiding live Levenshtein computation.',
    },
  ],

  expectedDepth: {
    mid:
      'Explain what a trie is and why prefix lookups are O(prefix length). Identify why a naive database LIKE query with an ORDER BY does not scale, and propose a basic cache in front of the backend for the most common prefixes.',
    senior:
      "Propose precomputing top-K suggestions at each trie node at build time rather than ranking at read time. Explain why the trie is rebuilt offline on a periodic cadence instead of updated live, and the tradeoff that creates between freshness and system stability. Discuss sharding the trie once it exceeds a single machine's memory, and why naive first-letter sharding produces hot shards.",
    staffPlus:
      "Address the freshness/staleness tension directly: a lightweight streaming trending layer that patches a periodically rebuilt batch index without requiring live index mutation. Cover the cost of running a multi-hundred-gigabyte in-memory index (memory pricing, replication for availability, multi-region trie snapshot distribution), dynamic QPS-weighted shard rebalancing, and privacy handling for query logs (anonymizing raw logs after a short retention window, optionally adding differential privacy noise to low-count aggregates before they influence rankings).",
  },

  keyTakeaways: [
    'Precompute, never compute at read time - top-K suggestions cached on each trie node at build time is the core idea everything else supports.',
    'Offline batch rebuild plus atomic hot-swap avoids the cost of maintaining precomputed rankings incrementally on every write.',
    'Freshness and index stability are in tension - a fast streaming trending layer resolves it by patching a periodically rebuilt batch index rather than replacing it.',
    'Shard by observed load, not by a fixed character boundary - static first-letter sharding is never actually balanced against real language frequency.',
    'Client-side debouncing and request cancellation are part of the system design, not a UI afterthought - they set the real request volume the backend has to handle.',
  ],

  relatedDesigns: ['rate-limiter', 'news-aggregator', 'social-feed'],
  relatedConcepts: [
    { name: 'Trie / Prefix Tree', description: 'The core data structure the entire read path is built around.' },
    { name: 'Caching', description: 'Redis/CDN layers in front of the trie absorb the majority of short-prefix traffic.' },
    { name: 'Sharding', description: 'Splitting the trie across machines by prefix range once it outgrows a single node.' },
    { name: 'Event Streaming', description: 'Kafka decouples query logging from both offline aggregation and real-time trend detection.' },
    { name: 'Ranking Algorithms', description: 'Blending long-term popularity, short-term trending, and personal history into one ordered list.' },
  ],

  simulator: {
    goalDescription: "Answer 'what is the user typing' in well under 100ms across billions of historical queries, blending precomputed popularity with real-time trending signals.",
    requirementChips: ['< 100ms p99 lookup', '150K lookups/sec peak', 'Trending queries surface within minutes'],
    targetRps: 150000,
    readRatio: 0.999,
    cacheHitRatio: 0.75,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'hot-prefix-cache', label: 'Hot-prefix / trending cache (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'popularity-store', label: 'Wide-column popularity store', kind: 'requires-node-type', nodeType: 'cassandra' },
      { id: 'event-stream', label: 'Event stream for completed queries', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'trie-tier', label: 'Sharded trie-serving compute tier', kind: 'requires-node-type', nodeType: ['app-server', 'microservice'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'meets-budget', label: 'Meets the p99 latency budget', kind: 'meets-latency-budget' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'edge-1', type: 'cdn', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 4, position: { x: 600, y: 120 } },
        { id: 'trie-1', type: 'microservice', instanceCount: 12, position: { x: 600, y: 280 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 880, y: 280 } },
        { id: 'store-1', type: 'cassandra', instanceCount: 6, position: { x: 1160, y: 280 } },
      ],
      edges: [
        { id: 'e-client-edge', source: 'client-1', target: 'edge-1' },
        { id: 'e-edge-redis', source: 'edge-1', target: 'redis-1' },
        { id: 'e-redis-trie', source: 'redis-1', target: 'trie-1' },
        { id: 'e-kafka-store', source: 'kafka-1', target: 'store-1' },
        { id: 'e-store-trie', source: 'store-1', target: 'trie-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Reads walk edge cache, then a Redis hot-prefix cache, then a sharded trie service whose nodes already have their top-K completions precomputed; a separate offline pipeline aggregates the query-log event stream into a popularity store that a periodic batch job uses to rebuild and atomically hot-swap each trie shard.',
    failureModeNarratives: {
      'redis': 'The hot-prefix cache absorbs the vast majority of short-prefix traffic; if a hot key expires without request coalescing, a thundering herd of identical lookups can hit every trie shard for that prefix at the exact same instant.',
    },
    fullDesignLinkSlug: 'search-autocomplete',
  },
}

export default topic
