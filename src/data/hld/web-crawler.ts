import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'web-crawler',
  title: 'Web Crawler & Search Engine',
  difficulty: 'Advanced',
  icon: 'pi pi-compass',
  color: '#0d9488',
  readTimeMinutes: 30,
  topics: ['URL Frontier', 'Bloom Filters', 'Inverted Index', 'PageRank'],
  companies: ['Google', 'Bing', 'Common Crawl'],
  prerequisites: ['Key-Value Store', 'Rate Limiter', 'Job Scheduler'],
  summary:
    'A web crawler discovers and fetches pages from a priority-ordered, per-host-throttled URL frontier, deduplicates URLs with a Bloom filter and page content with fingerprint hashing, then feeds extracted text into an inverted index that a ranking layer (relevance plus PageRank-style link authority) serves search queries from.',

  understandingProblem:
    "A web crawler is the thing that goes and looks at the internet so you don't have to. Someone types \"best noise cancelling headphones\" into a search box and expects an answer in under a second - but nobody fetched that answer in real time. A fleet of crawlers visited billions of pages ahead of time, extracted their text, and built an index that a query can hit instantly. The crawler's job sounds simple - start from some URLs, follow the links, fetch every page - but at web scale every naive assumption breaks: you cannot store every URL you've ever seen in RAM, you cannot hit one server as fast as your network card allows without getting blocked or accidentally DDoSing someone's blog, and you cannot follow every link forever without falling into an infinite calendar widget. The search engine half of the problem is the payoff: turn a pile of raw HTML into a structure where the query \"noise cancelling headphones\" resolves to a ranked list of the most relevant, most trustworthy pages in milliseconds.",
  realExamples:
    "Googlebot fetches billions of pages and adapts its crawl rate per-site based on server response health rather than a fixed Crawl-delay. Common Crawl, a nonprofit, publishes a fresh monthly crawl of roughly 2-3 billion pages as WARC files on S3, with an archive spanning petabytes since 2008 and used to train large language models. The original Mercator crawler design (Heydon & Najork, 1999, built at Compaq/AltaVista) introduced the front-queue/back-queue URL frontier pattern that most crawler system-design answers still reference today.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  seeds[Seed URLs]:::client
  queue["In-Memory FIFO Queue"]:::compute
  fetcher["Single-Threaded Fetcher"]:::compute
  visited[("In-Memory Visited Set")]:::database
  seeds --> queue
  queue --> fetcher
  fetcher -->|"extract links"| queue
  fetcher --> visited`,
    },
    whyThisBreaks: [
      "Throughput: a single-threaded fetcher doing one HTTP GET at ~200ms round trip manages roughly 5 pages/sec. Crawling even 1 billion pages at that rate takes over 6 years - and a serious index needs tens of billions of pages.",
      "Politeness: nothing stops 10,000 queued URLs from the same domain sitting back-to-back. Firing them at a single origin server as fast as the network allows looks exactly like a denial-of-service attack, and the target starts returning 503s or blocking the crawler's IP within seconds.",
      "Memory: an in-memory HashSet of visited URLs at roughly 60 bytes per entry needs hundreds of gigabytes just to track 1 billion URLs - nowhere near the tens of billions actually discovered - and the process OOMs long before the crawl finishes.",
      "Crawler traps: a single calendar widget with a \"next month\" link (/events?month=1, /events?month=2, ...) generates unlimited new URLs. The naive crawler follows every one forever and never gets back to crawling the rest of the web.",
      "No prioritization: a news homepage that changes every few minutes sits in the exact same FIFO queue as an abandoned personal blog from 2009. Fetch budget gets wasted on stale content while the homepage falls further out of date.",
    ],
    closingNote:
      "Every one of these failures traces back to the same root cause: a single machine, a single queue, and no notion of politeness or priority. The fix is to split the queue into a distributed URL frontier that many worker machines pull from, with per-host structure built in from day one.",
  },

  priorArt: [
    {
      title: 'Mercator (Compaq/AltaVista, 1999)',
      description:
        'The Heydon & Najork paper that defined the modern crawler shape: a URL frontier split into priority front queues and per-host FIFO back queues, so politeness and prioritization are separate, composable concerns. Almost every crawler design interview answer today is a variation on Mercator. (Heydon & Najork, "Mercator: A Scalable, Extensible Web Crawler")',
      link: 'https://link.springer.com/article/10.1023/A:1019213109274',
    },
    {
      title: "Google's Original Architecture",
      description:
        "Brin & Page's 1998 Stanford paper described a crawler feeding a store of raw pages, an indexer building an inverted index, and PageRank as the link-authority signal layered on top of text relevance - the same three-stage shape (crawl, index, rank) this design still follows. (Brin & Page, \"The Anatomy of a Large-Scale Hypertextual Web Search Engine\")",
      link: 'http://infolab.stanford.edu/pub/papers/google.pdf',
    },
    {
      title: 'Common Crawl',
      description:
        'A nonprofit that runs a public, open web crawl every month, storing raw pages as WARC files and publishing them on S3 at petabyte scale. Its architecture is a real, inspectable reference for frontier scheduling and politeness at scale that most companies keep private. (Common Crawl Foundation)',
      link: 'https://commoncrawl.org/get-started',
    },
    {
      title: 'Internet Archive Heritrix',
      description:
        'The open-source crawler behind the Wayback Machine. Notable for its "politeness by construction" design - a per-host queue and a configurable delay are first-class primitives, not an afterthought bolted onto a generic job queue. (Internet Archive engineering docs)',
      link: 'https://github.com/internetarchive/heritrix3/wiki/Politeness-parameters',
    },
    {
      title: "Google's Near-Duplicate Detection",
      description:
        'Manku, Jain, and Sarma (2007) described using SimHash - a locality-sensitive hash that reduces a full page to a 64-bit fingerprint - to detect near-duplicate pages across billions of documents in production at Google, which is the standard reference for content-level dedup at this scale. (Manku, Jain, Sarma, "Detecting Near-Duplicates for Web Crawling")',
      link: 'https://research.google/pubs/pub33026/',
    },
  ],

  coreEntities: [
    { name: 'Seed URL', description: 'An initial URL manually provided to bootstrap a crawl or reseed a stalled domain.' },
    { name: 'Frontier Entry', description: 'A discovered-but-not-yet-fetched URL, carrying its host, a priority score, and discovery timestamp.' },
    { name: 'Crawled Document', description: 'The raw fetched page - HTML body, response headers, fetch timestamp, and a content hash.' },
    { name: 'Posting', description: 'A (docID, term frequency, position list) entry stored under a term inside the inverted index.' },
    { name: 'Link Edge', description: 'A directed edge in the web graph (page A links to page B) - the raw input to PageRank.' },
  ],

  requirements: {
    core: [
      'Given seed URLs, discover and fetch reachable pages across the web (or a bounded domain set) and durably store the raw content',
      'Respect robots.txt and per-host politeness delays so crawling never looks like a denial-of-service attack to the sites being crawled',
      'Deduplicate at both the URL level (never re-queue a URL already seen) and the content level (never index the same page twice under different URLs)',
      "Extract text from fetched pages and build a searchable inverted index so a keyword query returns ranked, relevant results",
      'Recrawl pages on a schedule so the index does not go stale, prioritizing fast-changing and high-authority pages over static long-tail pages',
    ],
    belowTheLine: [
      'Rendering JavaScript-heavy single-page apps (a headless-browser rendering tier)',
      'Personalized or user-specific ranking of search results',
      'Spam, phishing, and malware page classification',
      'Real-time, sub-minute freshness for breaking news',
      'Full multi-language tokenization and stemming for every language on the web',
    ],
    nonFunctionalTable: [
      { metric: 'Crawl throughput', target: 'Sustain ~20,000 page fetches/sec across the fleet' },
      { metric: 'Search query latency', target: 'p99 under 200ms end to end' },
      { metric: 'Politeness compliance', target: 'Never exceed one request per configured delay, per host, ever' },
      { metric: 'Index freshness', target: 'High-priority pages recrawled within 24h; long-tail within 30 days' },
      { metric: 'Durability', target: 'Raw crawled HTML replicated 3x - never lost even after a page is deindexed' },
      { metric: 'Availability', target: 'Search query path 99.95%; crawl pipeline can tolerate hours of downtime unnoticed by users' },
    ],
  },

  technologyChoices: [
    {
      tier: 'URL Frontier',
      purpose: 'Priority queue plus per-domain politeness queue',
      primaryPick: 'Redis Sorted Sets + per-domain queues',
      alternatives: 'Kafka, RabbitMQ, or a custom on-disk queue',
      whyPrimaryWins: 'A ZSET gives priority ordering for free; per-domain keys enforce politeness naturally without a separate scheduling layer.',
    },
    {
      tier: 'URL Dedup',
      purpose: 'Avoid re-queuing or re-fetching a URL already seen',
      primaryPick: 'Bloom Filter (in-memory, sharded)',
      alternatives: 'Redis set, RocksDB, or HyperLogLog',
      whyPrimaryWins: '100 billion URLs fit in roughly 120GB of RAM at a 1% false-positive rate, with no disk I/O on the hot path a plain hash set would need.',
    },
    {
      tier: 'Page Store',
      purpose: 'Store raw crawled HTML pages plus headers',
      primaryPick: 'S3 or Bigtable',
      alternatives: 'HDFS, GCS, or Cassandra',
      whyPrimaryWins: 'Multiple petabytes of pages need cheap, durable object storage, not a database - and a downstream parsing bug never costs a re-fetch.',
    },
    {
      tier: 'Inverted Index',
      purpose: 'Map each term to its sorted list of document postings',
      primaryPick: 'Custom sharded index (Lucene-based)',
      alternatives: 'Elasticsearch, Solr, or Vespa',
      whyPrimaryWins: 'Document-sharding supports scatter-gather query fan-out, and the Lucene segment format is proven at web scale.',
    },
    {
      tier: 'Content Dedup',
      purpose: 'Detect near-duplicate pages that differ only in URL',
      primaryPick: 'SimHash / MinHash fingerprinting',
      alternatives: 'Exact MD5 hash or generic locality-sensitive hashing',
      whyPrimaryWins: 'Catches near-duplicates - the same article syndicated with different ads or tracking params - not just byte-for-byte copies.',
    },
    {
      tier: 'Crawl Metadata',
      purpose: 'Track per-URL state, last crawl time, and recrawl priority',
      primaryPick: 'RocksDB (embedded) or Postgres',
      alternatives: 'DynamoDB, Cassandra, or LevelDB',
      whyPrimaryWins: 'RocksDB gives fetcher workers fast local lookups, while Postgres holds the smaller set of coordinator-level state that needs relational queries.',
    },
  ],
  technologyChoicesNote:
    'Why a Bloom filter over an exact hash set for URL dedup? At 100 billion URLs, an exact set needs on the order of terabytes of RAM at roughly 60 bytes/entry, while a Bloom filter does the same job in a fraction of that space at a small, tunable false-positive rate. That tradeoff is acceptable because the crawl is already idempotent - occasionally skipping one legitimately new URL just means it gets picked up on a later pass instead of corrupting anything.',

  scaleEstimation: [
    'Index target: ~50 billion pages (web-scale, smaller than the largest commercial engines but large enough that every naive approach fails)',
    'Raw storage: 50B pages x ~500KB average uncompressed HTML = ~25PB per full snapshot; ~5PB after typical 5:1 compression',
    'Sustained crawl rate to refresh the whole index every 30 days: 50B / (30 x 86,400s) ≈ 19,300 fetches/sec, rounded up to a ~20,000/sec design target',
    'Frontier size: discovered-but-unfetched URLs can outnumber crawled pages 4-10x due to link fan-out; at 200B entries x ~150 bytes (URL + host + priority + timestamp) that is ~30TB of frontier metadata, sharded across many hosts',
    'URL-seen Bloom filter: tracking 500B seen URLs (including duplicates and aliases) at a 1% false-positive rate needs ~9.6 bits/entry, or ~600GB total - trivially shardable to a few GB per node across a hundred-node cluster',
    'Inverted index: 50B docs x ~200 unique terms/doc (after stopword removal) x ~40 bytes/compressed posting ≈ 400TB, before delta-encoding and compression bring real systems down considerably further',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/frontier/seeds',
      description: 'Add one or more seed URLs to bootstrap or reseed a crawl.',
      example: '// Request\n{ "urls": ["https://example.com"], "priority": "high" }\n\n// Response 202\n{ "accepted": 1 }',
    },
    {
      method: 'GET',
      path: '/v1/crawl/status/{domain}',
      description: 'Return crawl stats for a domain: pages fetched today, frontier depth, last robots.txt fetch, current politeness delay.',
      example: '// Response 200\n{ "domain": "example.com", "fetchedToday": 4210, "frontierDepth": 812, "delayMs": 500 }',
    },
    {
      method: 'GET',
      path: '/v1/search',
      description: 'The public query endpoint - keyword search against the inverted index, ranked by relevance and link authority.',
      example: '// GET /v1/search?q=best+noise+cancelling+headphones&limit=10\n\n// Response 200\n{ "results": [{ "url": "https://...", "title": "...", "score": 0.91 }] }',
    },
    {
      method: 'POST',
      path: '/v1/robots/invalidate',
      description: 'Force an immediate re-fetch of a domain\'s robots.txt, bypassing the cache TTL.',
      example: '// Request\n{ "domain": "example.com" }\n\n// Response 202\n{ "status": "queued" }',
    },
    {
      method: 'DELETE',
      path: '/v1/index/{docId}',
      description: 'Remove a page from the live index immediately (e.g. a takedown request), without waiting for the next crawl cycle.',
    },
  ],
  apiSecurityNote:
    'Control-plane endpoints (seeds, robots invalidation, crawl status, index deletion) sit behind internal auth and mTLS since they can directly influence what gets crawled or removed from a public index; only /v1/search is public, and it is rate-limited per client to protect the ranking tier from abusive query volume.',

  highLevelDesignIntro:
    "Let's build this up the way Mercator did: start with a frontier that actually scales across machines, layer in politeness and dedup so it never breaks the internet or itself, then build the pipeline that turns raw HTML into a queryable index with a real ranking signal on top.",

  builds: [
    {
      title: 'The Distributed URL Frontier',
      body:
        "Replace the single FIFO queue with a two-tier frontier, spread across many machines. A set of front queues hold discovered URLs bucketed by priority score - a page's link authority combined with how urgently it needs a fresh crawl. A much larger set of back queues, one per host (or one per small group of hosts), hold the actual FIFO order a given domain will be crawled in.\n\nA routing step decides which back queue a URL lands in once it's pulled from a front queue: hash the host to a back-queue assignment, and only pull from a back queue when that host's minimum delay has elapsed. This separation is deliberate - priority decides WHAT to crawl next in principle, politeness decides WHEN a specific host is actually allowed to be hit again.",
      newComponents: [
        { name: 'Frontier Front Queues', description: 'Priority buckets holding newly discovered URLs, scored by link authority and freshness need.' },
        { name: 'Frontier Back Queues', description: 'One FIFO queue per host, guaranteeing a strict per-host crawl order and enforcing politeness independent of priority.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  seeds[Seed URLs]:::client
  front["Front Queues<br/>bucketed by priority"]:::compute
  router["Host Router<br/>hash host to back queue"]:::compute
  back1["Back Queue: cnn.com"]:::async
  back2["Back Queue: example.org"]:::async
  worker["Fetcher Worker"]:::compute
  seeds -->|"1. New URLs"| front
  front -->|"2. Highest priority first"| router
  router -->|"3. Route by host"| back1
  router -->|"4. Route by host"| back2
  back1 -->|"5. Pull when delay elapsed"| worker
  back2 -->|"6. Pull when delay elapsed"| worker`,
      },
      closingNote:
        "The frontier now scales to many machines and separates priority from politeness cleanly. But nothing yet is actually enforcing politeness rules - robots.txt, minimum delays, backoff on errors - that's the next build.",
    },
    {
      title: 'Enforcing Politeness',
      body:
        "Before a worker fetches from a back queue, it must check two things: does robots.txt allow this path, and has the minimum delay for this host elapsed since the last fetch? Each host's robots.txt is fetched once and cached with a TTL (commonly 24 hours) so the crawler isn't re-fetching a tiny text file before every single page on a domain.\n\nThe delay itself should be adaptive, not fixed. If a host starts returning 503s or slow responses, the worker backs off exponentially and honors any Retry-After header rather than hammering a struggling server. Googlebot's real crawl scheduler works this way - it adjusts crawl rate per-site based on observed server health rather than a static Crawl-delay directive (which isn't even part of the official robots.txt spec, though some crawlers support it as a courtesy).",
      newComponents: [
        { name: 'Robots.txt Cache', description: 'Per-host cached copy of robots.txt with a TTL, so disallowed paths are filtered before a fetch is even attempted.' },
        { name: 'Politeness Scheduler', description: 'Tracks last-fetch time and current delay per host; applies exponential backoff on 5xx responses and Retry-After headers.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  pull["Worker pulls from back queue"]:::compute
  robots{"robots.txt allows path?"}:::cache
  delay{"min delay elapsed?"}:::compute
  fetch["Fetch page"]:::compute
  skip["Drop URL, do not fetch"]:::client
  requeue["Requeue for later"]:::async
  pull --> robots
  robots -->|"1. No"| skip
  robots -->|"2. Yes"| delay
  delay -->|"3. Not yet"| requeue
  delay -->|"4. Yes"| fetch`,
      },
      closingNote:
        "Politeness is now enforced per host before every fetch. The next bottleneck shows up before the fetch even happens: resolving that host's domain name.",
    },
    {
      title: 'DNS Resolution Caching',
      body:
        "An uncached DNS lookup costs anywhere from 10ms to 200ms+. That's tolerable for a browser making one lookup for one page load, but at a design target of ~20,000 fetches/sec, most of which reuse the same handful of popular domains, hitting a public resolver for every single fetch would either bottleneck the whole crawl or get the crawler's resolver rate-limited outright.\n\nThe fix is a dedicated internal DNS resolver cluster with an aggressive, TTL-respecting local cache. Since the crawl fleet only talks to a bounded set of domains at any given time (tens to hundreds of millions, not billions), the whole cache fits comfortably in memory across a small resolver tier, and cache hit rates well above 90% are typical once the crawl is warmed up.",
      newComponents: [{ name: 'DNS Resolver Cache', description: 'A dedicated internal resolver cluster with an in-memory, TTL-aware cache shared by every fetcher worker.' }],
      closingNote:
        "With hostnames resolving in microseconds instead of hundreds of milliseconds, the fetch path itself is the next thing worth designing carefully.",
    },
    {
      title: 'Fetcher Workers',
      body:
        "A pool of stateless worker processes, each pulling ready URLs from the frontier's back queues, resolving via the DNS cache, and issuing the actual HTTP GET. Every fetch needs a strict timeout (a slow or hanging server shouldn't tie up a worker indefinitely), a retry policy with backoff for transient failures, and a response-size cap (a multi-gigabyte video file streamed as a 200 OK shouldn't be treated like an HTML page).\n\nBefore downloading the full body, workers check the Content-Type header and bail early on anything that isn't text/html (or a small allowlist of parseable types) - fetching and discarding a 4K video's bytes just to discover it's not a web page wastes exactly the bandwidth budget this whole system is trying to conserve. Successful fetches get written to a raw page store (blob storage, keyed by URL hash) before anything else touches them, so a downstream parsing bug never costs a re-fetch.",
      newComponents: [
        { name: 'Fetcher Worker Pool', description: 'Stateless workers issuing HTTP fetches with timeouts, retries, and content-type/size filtering.' },
        { name: 'Raw Page Store', description: 'Blob storage holding the exact fetched bytes plus headers, keyed by URL hash, before any parsing happens.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  frontier["Frontier<br/>back queues"]:::async
  dns[("DNS Cache")]:::cache
  worker["Fetcher Worker"]:::compute
  origin["Origin Server"]:::edge
  store[("Raw Page Store")]:::storage
  frontier -->|"1. Pop URL"| worker
  worker -->|"2. Resolve host"| dns
  worker -->|"3. GET with timeout"| origin
  origin -->|"4. 200 OK + HTML"| worker
  worker -->|"5. Persist raw bytes"| store`,
      },
      closingNote:
        "Pages are now being fetched and durably stored at scale. But every fetched page keeps producing new links, and nothing yet stops the frontier from re-queuing a URL it has already crawled ten times over.",
    },
    {
      title: 'URL-Level Deduplication with a Bloom Filter',
      body:
        "Every parsed page yields dozens to hundreds of outbound links. Before any of them go back into the frontier, the crawler needs to answer \"have we already queued or crawled this exact URL?\" - and it needs to answer that question tens of thousands of times per second, against a set that will eventually hold hundreds of billions of entries.\n\nAn exact structure (a HashSet, or a key-value lookup) is either too much memory or too much network latency at that scale. A Bloom filter trades a small, tunable false-positive rate for a huge memory win: it can never produce a false negative (if it says \"not seen,\" the URL is genuinely new), but it can occasionally say \"seen\" for a URL that was never actually crawled - which just means that one new page gets skipped. At a 1% false-positive rate (about 9.6 bits per entry), tracking 100 billion URLs costs roughly 120GB, sharded by URL hash across the cluster instead of the multiple terabytes an exact set would need.",
      newComponents: [{ name: 'Distributed Bloom Filter', description: 'A sharded, probabilistic URL-seen check with no false negatives and a tuned, small false-positive rate.' }],
      insightCallout:
        "The false-positive tradeoff is the entire point: occasionally dropping one legitimately-new URL out of every hundred is a rounding error against a 50-billion-page index, but storing an exact set at that scale would need terabytes of RAM the crawl fleet doesn't have.",
      diagram: {
        mermaid: `flowchart LR
  parser["Parser<br/>extracted links"]:::compute
  normalize["Normalize URL<br/>strip session params, fragment"]:::compute
  bloom[("Bloom Filter<br/>URL-seen, sharded")]:::cache
  frontier["Frontier"]:::async
  drop["Dropped, likely duplicate"]:::client
  parser --> normalize
  normalize --> bloom
  bloom -->|"1. Not seen"| frontier
  bloom -->|"2. Seen or false positive"| drop`,
      },
      closingNote:
        "URL-level dedup is solved cheaply. But the same content routinely lives at multiple different URLs - mirrors, tracking parameters, http vs https - so a URL check alone will still let duplicates through.",
    },
    {
      title: 'Content-Level Deduplication',
      body:
        "A page at https://example.com/article and https://www.example.com/article?utm_source=twitter can have identical or near-identical content but two different URLs, so the Bloom filter's URL-seen check never catches them. After a page is fetched and its text extracted, the crawler computes a fingerprint of that content - a SimHash, a locality-sensitive hash that reduces the full text to a small fixed-size signature such that near-identical documents produce fingerprints with a small Hamming distance.\n\nThat fingerprint is checked against a content fingerprint store. An exact or near match (say, within a Hamming distance of 3 for a 64-bit SimHash) marks the page as a near-duplicate: keep one canonical URL, record the rest as aliases, and skip indexing the duplicate text a second time. This catches mirrors and tracking-parameter variants that URL normalization alone would miss.",
      newComponents: [{ name: 'Content Fingerprint Store', description: 'Stores a SimHash-style fingerprint per canonical document; new fetches are compared against it to catch near-duplicate content.' }],
      closingNote:
        "Dedup is now handled at both layers - before the fetch (URL) and after it (content). The remaining open threat is a page that generates unlimited, legitimately-distinct URLs on purpose.",
    },
    {
      title: 'Bounding Crawler Traps',
      body:
        "A crawler trap is a site structure that keeps generating new, technically-unique URLs forever - a calendar widget with a \"next month\" link, a session ID embedded in every URL, or a faceted-search page where every combination of filters is its own URL. None of these are caught by dedup, because every URL genuinely is new.\n\nThe fix is a crawl budget per host: a max fetch depth from the seed, and a max number of URLs fetched per domain per day (say, 50,000). A crawl budget tracker counts fetches per host in real time; once a host crosses its budget, its back queue is paused until the next day rather than drained further. A secondary signal - abnormal fan-out, where one page links to thousands of new URLs matching an obvious pattern like a numeric query parameter - flags a host for a stricter budget automatically, before a human ever notices.",
      newComponents: [{ name: 'Crawl Budget Tracker', description: 'Tracks fetches-per-host against a daily cap and flags hosts with abnormal link fan-out for a stricter budget.' }],
      diagram: {
        mermaid: `flowchart TD
  fetch["Fetched /events?month=11"]:::compute
  extract["Extract link to /events?month=12"]:::compute
  budget{"Host fetches today < 50,000?"}:::async
  enqueue["Enqueue new link"]:::compute
  pause["Pause host until tomorrow"]:::client
  fetch --> extract
  extract --> budget
  budget -->|"1. Under budget"| enqueue
  budget -->|"2. Over budget"| pause`,
      },
      closingNote:
        "The crawl side is now bounded, polite, deduplicated, and prioritized. The other half of the problem is what happens to a fetched page once it has been kept - turning raw HTML into something a search query can actually use.",
    },
    {
      title: 'From HTML to Inverted Index',
      body:
        "A raw HTML page is useless to a search query as-is. The text extractor strips scripts, styles, and markup, keeping visible body text plus high-signal metadata (title, meta description, headings). The remaining text is tokenized, lowercased, stripped of stopwords, and stemmed (a Porter-style stemmer collapses \"running\", \"runs\", and \"ran\" toward a shared root) so a query for \"running shoes\" also matches a page that only says \"run\".\n\nThe indexer turns that token stream into postings - for each distinct term, a (docID, term frequency, position list) entry - and merges them into the global inverted index: a mapping from term to a sorted list of documents that contain it. This is the exact data structure a search query walks: look up each query term's posting list, intersect them, and you have your candidate documents before any ranking has happened.",
      newComponents: [
        { name: 'Text Extractor', description: 'Strips markup and scripts, keeping visible text and structural metadata like title and headings.' },
        { name: 'Indexer', description: 'Tokenizes, stems, and turns extracted text into postings merged into the global inverted index.' },
        { name: 'Inverted Index', description: 'The core search data structure: term -> sorted list of (docID, frequency, positions) postings.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  raw[("Raw Page Store")]:::storage
  extract["Text Extractor"]:::compute
  tokenize["Tokenize, stem, remove stopwords"]:::compute
  indexer["Indexer"]:::async
  index[("Inverted Index")]:::database
  raw -->|"1. Fetched HTML"| extract
  extract -->|"2. Visible text"| tokenize
  tokenize -->|"3. Token stream"| indexer
  indexer -->|"4. Merge postings"| index`,
      },
      closingNote:
        "There is now a queryable index. But an index built once and never touched again drifts stale the moment anything on the crawled web changes - freshness has to be an ongoing, prioritized process, not a one-time build.",
    },
    {
      title: 'Freshness and Recrawl Scheduling',
      body:
        "Not every page deserves the same recrawl rate. A news homepage that changes every few minutes and a static documentation page from three years ago have wildly different freshness needs, and treating them identically wastes crawl budget either way. Every page gets a recrawl priority score, computed from an observed change frequency (diffing content hashes across past crawls) and an estimated importance signal (the same link-authority score used in the frontier's front queues).\n\nThat recrawl score feeds directly back into the frontier from Build 1: instead of a flat \"recrawl everything every N days\" schedule, high-change, high-authority pages get requeued into the frontier's front queues far more often, while long-tail static pages might not be revisited for weeks. This closes the loop - the same priority mechanism that decides what to crawl first also decides what to crawl again soonest.",
      newComponents: [{ name: 'Recrawl Scheduler', description: 'Computes a per-page recrawl priority from observed change frequency and link authority, feeding it back into the frontier.' }],
      closingNote:
        "The crawl-to-index pipeline is now complete and self-sustaining. What's still missing is the query-serving side - how a keyword search actually turns into a ranked answer, which the core flows and the PageRank deep dive cover next.",
    },
  ],

  coreFlows: [
    {
      title: 'Crawling a Single URL',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant F as Frontier
  participant D as DNS Cache
  participant W as Fetcher Worker
  participant S as Origin Server
  participant P as Parser
  participant B as Bloom Filter
  participant I as Inverted Index

  F->>W: pop next URL, host=example.com, priority=8
  W->>D: resolve example.com
  D-->>W: cached IP (hit)
  W->>S: GET /article (politeness delay honored)
  S-->>W: 200 OK plus HTML body
  W->>P: raw HTML for parsing
  P->>P: extract text, links, canonical tag
  P->>B: check each extracted link
  B-->>P: 40 new links, 12 already seen
  P->>F: enqueue new links with priority
  P->>I: emit postings for this document`,
      },
    },
    {
      title: 'Serving a Search Query',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant Q as Query API
  participant Cache as Results Cache
  participant IDX as Index Shards
  participant R as Ranker

  C->>Q: GET /v1/search?q=best noise cancelling headphones
  Q->>Cache: check cached results for normalized query
  Cache-->>Q: miss
  Q->>IDX: fan out term lookups across shards
  IDX-->>Q: intersected candidate postings, 40,000 docs
  Q->>R: score candidates by BM25 relevance plus PageRank authority
  R-->>Q: ranked top 10 doc IDs
  Q->>Cache: store ranked results with a short TTL
  Q-->>C: 200 with ranked results`,
      },
    },
    {
      title: 'Detecting and Throttling a Crawler Trap',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant W as Fetcher Worker
  participant P as Parser
  participant CB as Crawl Budget Tracker
  participant F as Frontier

  W->>P: fetched /events?month=11
  P->>P: extract link to /events?month=12
  P->>CB: record new URL for host calendartrap.com
  CB->>CB: check fetches today for this host, 49,812 of 50,000
  CB-->>P: still under budget, allow
  P->>F: enqueue /events?month=12
  Note over CB,F: next iteration crosses 50,000 - host is paused until tomorrow`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Prioritizing the URL Frontier',
      problem:
        "With billions of discovered URLs and a fixed fetch budget per second, which URL gets crawled next? Fetch everything in discovery order and popular pages go stale; fetch only pages that already look important and the crawl never explores anything new.",
      bad:
        "Plain FIFO across the entire discovered set. A page with 50,000 inbound links from major sites is treated exactly like a URL discovered five minutes ago from a random personal blog - it can sit behind millions of low-value URLs and wait weeks for its turn, so the index looks stale for exactly the pages people are most likely to search for.",
      good:
        "Static priority tiers assigned once at crawl setup - every domain gets a fixed tier, and the crawler always drains the highest tier first. This fixes the staleness problem for known-important domains, but it's brittle: a page that suddenly becomes important (breaking news on an otherwise obscure site) stays stuck in a low tier until a human manually re-tiers it.",
      great:
        "A dynamic priority score recomputed continuously from two live signals - link authority (a PageRank-style score) and observed change frequency (from diffing past crawls) - feeding Mercator-style front queues that a worker always drains highest-priority-first, subject to the back queue's per-host politeness gate. This mirrors how Googlebot's real scheduler weighs crawl rate: link authority and change signals adjust automatically, no manual re-tiering required.",
      diagram: {
        mermaid: `flowchart LR
  fifo["FIFO: discovery order only"]:::client
  tiers["Static tiers: fixed per domain"]:::compute
  dynamic["Dynamic score: authority + change frequency"]:::cache
  fifo -.->|"stale for important pages"| tiers
  tiers -.->|"brittle, needs manual updates"| dynamic`,
      },
    },
    {
      title: 'Deduplicating at Web Scale',
      problem:
        "The same content lives at many different addresses - http vs https, trailing slash, session IDs, mirrors, syndicated copies - and the crawler must avoid re-fetching or re-indexing it without keeping every URL it has ever seen fully in memory.",
      bad:
        "An in-memory HashSet of every crawled URL string. Exact, but a HashSet of 100 billion URLs at roughly 60 bytes each needs on the order of 6TB of RAM just for URL dedup, before a single page has even been fetched - completely impractical on commodity fetcher machines.",
      good:
        "A sharded key-value store on disk, keyed by a hash of the normalized URL. This scales past what RAM allows, but every single link discovered during parsing - tens of thousands per second across the fleet - now costs a network round trip to a lookup service, and that lookup service becomes a shared bottleneck exactly when crawl load is highest.",
      great:
        "A sharded Bloom filter for the URL-seen check (no false negatives, tunable false-positive rate - about 9.6 bits per entry for 1% FP, so 100 billion URLs cost roughly 120GB spread across the cluster instead of terabytes) combined with a separate SimHash content-fingerprint pass after fetch, so near-duplicate pages that slip past URL dedup - mirrors, tracking-parameter variants, syndicated copies - are still caught before they're indexed a second time.",
    },
    {
      title: 'Ranking Results with Link Analysis',
      problem:
        "The inverted index tells you which of ten million pages contain the query terms, but not which of those pages anyone should actually trust. How do you rank documents that all mention \"best noise cancelling headphones\" equally by keyword match?",
      simpleTerms:
        "Think of every hyperlink as a vote for the page it points to - but a vote from an already-important, selective page should count for far more than a vote from an obscure page that links to everything.",
      bad:
        "Rank purely by term frequency - how many times the query words appear on the page. Trivial to game: stuff the phrase 500 times into invisible text and the page \"wins,\" which is exactly the keyword-stuffing problem that plagued search engines through the mid-1990s before link-based ranking existed.",
      good:
        "Weight by raw inbound link count - more links pointing at a page means more importance. Harder to game by keyword stuffing alone, but trivially gamed by link farms: thousands of throwaway pages that exist purely to link to one target, inflating its count without reflecting any real authority.",
      great:
        "PageRank - model the web as a directed graph and compute each page's rank as a share of the rank of every page linking to it, divided by how many outbound links that page spreads its vote across, iterated to convergence with a damping factor (Brin and Page's original formula used d=0.85). A link from a selective, already-authoritative page counts far more than one from a page with hundreds of outbound links, and combined with per-term relevance (BM25/TF-IDF) at query time, this became Google's founding ranking signal and remains the canonical answer to \"how do you rank documents by authority.\"",
      diagram: {
        mermaid: `flowchart LR
  a["Page A<br/>rank 0.4"]:::client
  b["Page B<br/>rank 0.3"]:::client
  c["Page C<br/>target page"]:::compute
  a -->|"vote weighted by A's rank"| c
  b -->|"vote weighted by B's rank"| c`,
      },
    },
  ],

  selfAudit: [
    { question: 'How do you keep the crawler polite?', answer: 'Per-host back queue plus cached robots.txt plus adaptive delay/backoff - never hit one host from multiple workers at once.' },
    { question: 'How do you dedup at billions of URLs?', answer: 'Sharded Bloom filter for URL-seen (no false negatives, ~1% FP), SimHash content fingerprint to catch near-duplicates under different URLs.' },
    { question: 'How do you avoid crawler traps?', answer: 'Cap max fetch depth and max fetches per domain per day; flag hosts whose link fan-out spikes abnormally for a stricter budget.' },
    { question: 'How do you prioritize what to crawl next?', answer: 'A dynamic score combining link authority (PageRank-style) and observed change frequency, feeding priority front queues.' },
    { question: 'Why is DNS caching necessary?', answer: 'An uncached lookup costs 10-200ms; at ~20,000 fetches/sec that saturates external resolvers and becomes the bottleneck.' },
    { question: 'How do you rank search results?', answer: 'Combine a relevance score (BM25/TF-IDF over the inverted index) with an authority score (PageRank-style link analysis).' },
    { question: 'How do you keep the index fresh?', answer: 'A recrawl schedule weighted by change frequency and authority, not a flat interval - fast-changing important pages get requeued far more often.' },
    { question: 'What happens when a host returns 503s?', answer: 'Exponential backoff on that host\'s back queue honoring Retry-After, without blocking crawl progress on any other host.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  seeds[Seed URLs]:::client
  frontier["URL Frontier<br/>priority front queues + per-host back queues"]:::compute
  robots[("Robots.txt Cache")]:::cache
  dns[("DNS Resolver Cache")]:::cache
  fetchers["Fetcher Worker Pool"]:::compute
  rawstore[("Raw Page Store")]:::storage
  bloom[("Bloom Filter<br/>URL-seen")]:::cache
  parser["Parser & Text Extractor"]:::compute
  fingerprint[("Content Fingerprint Store")]:::database
  indexer["Indexer"]:::async
  invindex[("Inverted Index")]:::database
  linkgraph[("Link Graph / PageRank Store")]:::database
  recrawl["Recrawl Scheduler"]:::async
  user[Search User]:::client
  queryapi["Search Query API"]:::edge
  ranker["Ranker<br/>BM25 + PageRank"]:::compute

  seeds --> frontier
  frontier -->|"1. Pop next URL"| fetchers
  fetchers -->|"2. Resolve host"| dns
  fetchers -->|"3. Check allowed"| robots
  fetchers -->|"4. Fetch HTML"| rawstore
  rawstore --> parser
  parser -->|"5. New links"| bloom
  bloom -->|"6. Unseen only"| frontier
  parser -->|"7. Content hash"| fingerprint
  parser -->|"8. Extracted text"| indexer
  indexer --> invindex
  parser -->|"9. Outbound links"| linkgraph
  linkgraph --> recrawl
  recrawl -->|"10. Priority score"| frontier
  user --> queryapi
  queryapi --> invindex
  queryapi --> linkgraph
  queryapi --> ranker
  ranker --> queryapi
  queryapi -->|"11. Ranked results"| user`,
  },

  keyTechnologies: [
    { term: 'URL Frontier', definition: 'The distributed queue of discovered-but-unfetched URLs, split into priority front queues and per-host back queues.' },
    { term: 'Bloom Filter', definition: 'A probabilistic set that answers "have I seen this before" with no false negatives and a small, tunable false-positive rate, for a fraction of the memory of an exact set.' },
    { term: 'robots.txt', definition: 'A per-site text file declaring which paths a crawler may fetch; the crawler caches it per host and checks it before every fetch.' },
    { term: 'Inverted Index', definition: 'The core search data structure mapping each term to the sorted list of documents (and positions) that contain it.' },
    { term: 'SimHash', definition: 'A locality-sensitive hash that reduces a document to a small fixed-size fingerprint, so near-duplicate pages produce fingerprints a small Hamming distance apart.' },
    { term: 'PageRank', definition: 'A link-authority algorithm that scores a page by the share of rank flowing in from every page linking to it, iterated to convergence with a damping factor.' },
    { term: 'BM25 / TF-IDF', definition: 'Text relevance scoring functions that weigh how often and how distinctively a query term appears in a document relative to the whole corpus.' },
    { term: 'WARC', definition: 'The Web ARChive file format used by Common Crawl and the Internet Archive to store raw fetched pages plus their HTTP headers.' },
  ],

  expectedDepth: {
    mid:
      'Explain a basic crawler loop with a queue and a visited set, and understand why hitting one host as fast as possible is a problem (politeness). Propose simple keyword-based text indexing and lookup, without needing to justify the data structures deeply.',
    senior:
      'Design a distributed frontier with per-host queues for politeness and priority buckets for freshness. Justify a Bloom filter for URL dedup at scale with real numbers (bits per entry vs an exact set), describe the inverted index and TF-IDF-style ranking, and identify crawler traps with concrete bounding strategies (max depth, max fetches per domain).',
    staffPlus:
      'Address recrawl and freshness scheduling tradeoffs (flat interval vs change-frequency-weighted priority), justify PageRank-style link authority combined with relevance signals at query time, and reason about multi-datacenter crawl operations and the cost of storing/refreshing a petabyte-scale raw HTML corpus. Discuss adaptive politeness that reacts to a host\'s live response health rather than a static delay, and the interplay between a finite crawl budget and index quality - what gets deliberately left out, and how that decision gets revisited.',
  },

  keyTakeaways: [
    'The URL frontier is the heart of the system: front queues decide priority, back queues (one per host) guarantee politeness - keep those two concerns separate.',
    'Bloom filters trade a small, tunable false-positive rate for a roughly 1000x memory reduction over an exact set - exactly the right call whenever "have I seen this" does not need to be perfect.',
    'Dedup happens at two layers: URL-level (Bloom filter, before the fetch) and content-level (fingerprint hash, after the fetch) - URLs can differ while content is identical.',
    'Crawler traps and DNS bottlenecks look nothing alike but share the same root cause: unbounded work per unit of crawl budget.',
    'PageRank turns hyperlinks into a trust signal that matters once the inverted index has already narrowed candidates down by keyword relevance - relevance finds the candidates, authority ranks them.',
  ],

  relatedDesigns: ['news-aggregator', 'key-value-store', 'rate-limiter', 'job-scheduler'],
  relatedConcepts: [
    { name: 'Bloom Filters', description: 'The probabilistic structure making URL-seen checks feasible at hundreds of billions of entries.' },
    { name: 'Consistent Hashing', description: 'Used to shard the frontier, the Bloom filter, and the inverted index across many nodes.' },
    { name: 'Information Retrieval', description: 'The inverted index, tokenization, and BM25/TF-IDF ranking that turn crawled text into searchable results.' },
    { name: 'Distributed Queues', description: 'The mechanism underlying the URL frontier\'s front and back queues.' },
    { name: 'Batch Processing', description: 'The large-scale merge and index-build jobs that turn a stream of postings into a queryable inverted index.' },
  ],

  simulator: {
    goalDescription: 'Discover, fetch, and deduplicate pages at web scale through a distributed frontier, then serve ranked keyword search from the resulting index.',
    requirementChips: ['~20,000 fetches/sec', 'Search p99 < 200ms', 'Never re-crawl a duplicate URL'],
    targetRps: 20000,
    readRatio: 0.5,
    cacheHitRatio: 0.9,
    latencyBudgetMsP99: 200,
    rubric: [
      { id: 'frontier-queue', label: 'Distributed URL frontier / work queue', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'dedup-cache', label: 'Bloom filter / dedup cache for URL-seen checks', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'fetch-tier', label: 'Fetcher worker pool', kind: 'requires-node-type', nodeType: 'worker' },
      { id: 'index-store', label: 'Inverted index serving search queries', kind: 'requires-node-type', nodeType: 'elasticsearch' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-frontier-spof', label: 'No single point of failure in the crawl frontier', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'kafka-1', type: 'kafka', instanceCount: 8, position: { x: 40, y: 120 } },
        { id: 'worker-1', type: 'worker', instanceCount: 40, position: { x: 320, y: 120 } },
        { id: 'redis-1', type: 'redis', instanceCount: 6, position: { x: 600, y: 120 } },
        { id: 'object-store-1', type: 'object-store', instanceCount: 1, position: { x: 880, y: 120 } },
        { id: 'worker-2', type: 'worker', instanceCount: 20, position: { x: 1160, y: 120 } },
        { id: 'elasticsearch-1', type: 'elasticsearch', instanceCount: 30, position: { x: 1440, y: 120 } },
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 280 } },
        { id: 'app-1', type: 'app-server', instanceCount: 10, position: { x: 320, y: 280 } },
      ],
      edges: [
        { id: 'e-kafka-worker1', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker1-redis', source: 'worker-1', target: 'redis-1' },
        { id: 'e-worker1-store', source: 'worker-1', target: 'object-store-1' },
        { id: 'e-store-worker2', source: 'object-store-1', target: 'worker-2' },
        { id: 'e-worker2-es', source: 'worker-2', target: 'elasticsearch-1' },
        { id: 'e-worker2-kafka', source: 'worker-2', target: 'kafka-1' },
        { id: 'e-client-app', source: 'client-1', target: 'app-1' },
        { id: 'e-app-es', source: 'app-1', target: 'elasticsearch-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The URL frontier (a durable queue) feeds a pool of fetcher workers that check a Bloom filter for dedup before fetching, persist raw pages to object storage, and hand off to an indexing tier that writes postings into an inverted index (Elasticsearch) that the search query API reads from directly.',
    failureModeNarratives: {
      kafka:
        'The frontier is the single hand-off point between discovery and fetching. If it is under-provisioned or goes down, no new pages get pulled by any fetcher worker and the whole crawl silently stalls even though the workers stay up.',
    },
    fullDesignLinkSlug: 'web-crawler',
  },
}

export default topic
