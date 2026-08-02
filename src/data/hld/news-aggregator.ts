import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'news-aggregator',
  title: 'News Aggregator (Google News)',
  difficulty: 'Intermediate',
  icon: 'pi pi-globe',
  color: '#3b82f6',
  readTimeMinutes: 23,
  topics: ['Crawling', 'NLP Deduplication', 'Feed Ranking', 'Trending Detection', 'Caching'],
  companies: ['Google', 'Amazon', 'Microsoft', 'Apple', 'Flipkart'],
  prerequisites: ['Caching', 'Message Queues', 'Database Indexing'],
  summary:
    'A content pipeline that crawls thousands of publishers, clusters near-duplicate articles into single "story" cards using semantic embeddings, and serves a personalized, cached feed ranked for freshness, importance, and diversity.',

  understandingProblem:
    'A news aggregator continuously collects articles from thousands of publishers around the world, removes duplicates (50 sources might cover the same event), ranks them by relevance and freshness, and serves personalized feeds to millions of users. The hard parts: ingesting content from unreliable sources at scale, detecting that 200 articles are about the same event, handling breaking news spikes (traffic 10x during elections or disasters), and personalizing without a cold-start problem.',
  realExamples: 'Google News (aggregates from 50K+ sources), Apple News, Flipboard, Inshorts, Microsoft Start.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  CRAWLER[Crawler]:::compute
  DB[("Single DB<br/>all articles")]:::database
  USER[User]:::client

  CRAWLER --> DB
  USER --> DB`,
    },
    whyThisBreaks: [
      'No deduplication - same story from 50 sources clutters the feed',
      'No personalization - everyone sees the same feed regardless of interests',
      'Crawling 50K sources sequentially takes hours - stale news',
      'Breaking news takes too long to surface (waiting for next crawl cycle)',
      "Single DB can't handle 100M+ articles + millions of feed queries",
      'No concept of "topics" or "stories" - just a flat list of articles',
    ],
    closingNote:
      "We need a system that understands meaning, not just URLs - to deduplicate near-identical stories, detect breaking news within minutes instead of one crawl cycle, and rank content per-user instead of showing everyone the same flat list.",
  },

  priorArt: [
    {
      title: 'Google News Clustering',
      description:
        'Groups articles about the same event into "story clusters" using NLP similarity. A story cluster has one headline, multiple source links, and a freshness score that decays over time. (Google Blog)',
      link: 'https://blog.google/products-and-platforms/products/search/smarter-organization-top-stories-search/',
    },
    {
      title: 'Facebook News Feed Ranking',
      description:
        'Multi-stage ranking pipeline: candidate generation (1000s) -> lightweight ranker (100s) -> heavy ranker (top 50). Balances engagement prediction with content quality signals. (Facebook Engineering)',
      link: 'https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/',
    },
    {
      title: 'Twitter Trends Detection',
      description:
        'Detects trending topics by comparing current mention velocity against historical baseline. A topic "trends" when its current rate exceeds the expected rate by a statistical threshold, not just when volume is high. (Twitter Engineering)',
      link: 'https://blog.x.com/engineering/en_us/a/2015/building-a-new-trends-experience',
    },
    {
      title: 'Apache Kafka + Flink at LinkedIn',
      description:
        'Real-time content processing pipeline that ingests millions of events, enriches them, deduplicates, and routes to multiple downstream consumers (feed, notifications, search index). (LinkedIn Engineering)',
      link: 'https://www.linkedin.com/blog/engineering/data-streaming-processing/revolutionizing-real-time-streaming-processing--4-trillion-event',
    },
  ],

  coreEntities: [
    { name: 'Article', description: 'URL, title, body, publisher, publish time, language, category, media.' },
    { name: 'Publisher', description: 'Name, domain, credibility score, crawl frequency, RSS/API endpoint.' },
    {
      name: 'Story Cluster',
      description:
        'A group of articles about the same event, with a representative headline, summary, source count, and freshness score.',
    },
    { name: 'Topic', description: 'A category or tag (Politics, Tech, Sports, etc.) that stories belong to.' },
    {
      name: 'User Profile',
      description: 'Interests (topics followed), reading history, location, language preferences.',
    },
  ],

  requirements: {
    core: [
      'Ingest articles from thousands of sources - continuously crawl/receive articles from 50K+ publishers via RSS, APIs, and webhooks',
      'Deduplicate and cluster - group articles about the same event into story clusters, surface the best source as the headline',
      "Serve personalized feed - each user sees a ranked feed based on their interests, reading history, and location",
    ],
    belowTheLine: [
      'Breaking news push notifications',
      'Topic following and custom sections',
      'Publisher credibility scoring',
      'Fact-check labels',
      'Offline reading / save for later',
      'Comments and social sharing',
      'Multi-language support (50+ languages)',
      'Regional content laws compliance (right to be forgotten)',
      'Publisher analytics dashboard',
    ],
    nonFunctionalTable: [
      { metric: 'Freshness', target: 'Breaking news appears within 2-5 minutes of first publication' },
      { metric: 'Scale', target: '50K sources, 1M+ new articles/day, 100M+ DAU' },
      { metric: 'Feed latency', target: 'Personalized feed served in < 200ms P99' },
      { metric: 'Availability', target: '99.99% - news is time-sensitive, downtime means missed events' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Article Store',
      purpose: 'Raw article content and metadata',
      primaryPick: 'Cassandra',
      alternatives: 'Postgres, DynamoDB, ScyllaDB',
      whyPrimaryWins: 'Write-heavy ingestion (1M+ articles/day) with simple key-based reads scales horizontally without a single-writer bottleneck',
    },
    {
      tier: 'Search Index',
      purpose: 'Full-text article search and facets',
      primaryPick: 'Elasticsearch',
      alternatives: 'Meilisearch, Typesense, Algolia',
      whyPrimaryWins: 'Handles 10M+ docs with relevance scoring, geo filters, and NLP-based similarity',
    },
    {
      tier: 'Event Bus',
      purpose: 'Decouple the crawler from downstream processing',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, RabbitMQ',
      whyPrimaryWins: 'Ordered replay lets dedup and clustering workers process independently of crawl speed',
    },
    {
      tier: 'Feed Cache',
      purpose: 'Pre-computed personalized feeds',
      primaryPick: 'Redis',
      alternatives: 'Memcached, DynamoDB DAX',
      whyPrimaryWins: 'Sub-ms feed reads; sorted sets support time-decay ranking per user',
    },
    {
      tier: 'Embedding Store',
      purpose: 'Article vector embeddings for clustering',
      primaryPick: 'pgvector or Pinecone',
      alternatives: 'Milvus, Weaviate, Qdrant',
      whyPrimaryWins: 'pgvector keeps embeddings in Postgres at small scale; Pinecone for dedicated vector search at larger scale',
    },
    {
      tier: 'Object Storage',
      purpose: 'Article images and media links',
      primaryPick: 'S3',
      alternatives: 'GCS, MinIO, Azure Blob',
      whyPrimaryWins: 'Cheap, durable storage for crawled media assets',
    },
  ],
  technologyChoicesNote:
    "Why Elasticsearch over a relational database's full-text search? At this ingestion volume and query pattern, Postgres tsvector hits performance walls. Elasticsearch combines relevance scoring, category/attribute filtering, and horizontal sharding to handle both the document volume and the read traffic naturally.",

  scaleEstimation: [
    'Sources: 50K publishers, crawled every 5-15 minutes',
    'Ingestion: ~1M new articles/day, 10K/hour average, 50K/hour during breaking events',
    'Storage: ~500GB new article content/month (title + body + metadata), 5TB with media links',
    'Read QPS: 50K feed requests/sec at peak (100M DAU x 5 opens/day / 86400)',
    'Story clusters: ~50K active clusters at any time, 500K total/month',
  ],

  apiInterface: [
    {
      method: 'GET',
      path: '/v1/feed?userId={id}&page={n}',
      description: "Return a page of the user's personalized feed of story clusters.",
      example:
        '// Response 200\n[{ storyCluster: { headline, summary, sources: [...], topic, publishedAt, imageUrl } }, ...]',
    },
    {
      method: 'GET',
      path: '/v1/story/{clusterId}',
      description: 'Return full detail for one story cluster: headline, summary, contributing articles, and related stories.',
      example:
        '// Response 200\n{ headline, summary, articles: [{ title, publisher, url, publishedAt }], relatedStories: [...] }',
    },
    {
      method: 'GET',
      path: '/v1/topics',
      description: 'List available topics/categories and how many articles are tagged with each.',
      example: '// Response 200\n[{ id, name, articleCount }]',
    },
    {
      method: 'GET',
      path: '/v1/trending',
      description: 'Return currently trending story clusters with their velocity and region.',
      example: '// Response 200\n[{ storyCluster, velocity, region }]',
    },
    {
      method: 'POST',
      path: '/v1/user/interests',
      description: "Set a user's followed topics and publishers for personalization.",
      example:
        '// Request\n{ "topics": ["tech", "sports"], "publishers": ["bbc", "reuters"] }\n\n// Response 200\nOK',
    },
  ],
  apiSecurityNote:
    'Feed is read-only for users. Article ingestion is internal only (no user-submitted content). Rate-limit feed API to prevent scraping.',

  highLevelDesignIntro: "Let's build this incrementally, one functional requirement at a time.",

  builds: [
    {
      title: 'FR1: Ingest Articles from Thousands of Sources',
      body:
        'The first challenge: 50K publishers, each publishing 10-100 articles/day. We need to crawl them continuously, extract content, and store it. Some publishers offer RSS feeds, some have APIs, some need HTML scraping. Sources are unreliable - they go down, change formats, or throttle us.',
      newComponents: [
        {
          name: 'Crawl Scheduler',
          description:
            "Maintains a priority queue of sources to crawl. High-priority sources (BBC, Reuters) crawled every 5 min; smaller blogs every 30 min. Adjusts frequency based on publisher's historical update rate.",
        },
        {
          name: 'Crawler Workers',
          description:
            'Stateless workers that fetch content from assigned URLs. Handle retries, rate limiting per publisher, and format parsing (RSS, Atom, HTML scraping).',
        },
        {
          name: 'Content Extractor',
          description:
            'Parses raw HTML/RSS into structured data: title, body text, publish time, author, images. Strips ads and navigation.',
        },
        {
          name: 'Article Store (Cassandra)',
          description: 'Stores all articles durably. Partitioned by publish date for efficient time-range queries.',
        },
        {
          name: 'Kafka',
          description: 'Decouples crawling from downstream processing. Crawlers publish raw articles; multiple consumers process them independently.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  SCHED["Crawl Scheduler<br/>priority queue"]:::compute
  WORKERS["Crawler Workers<br/>stateless pool"]:::compute
  EXTRACT["Content Extractor"]:::compute
  KF["Kafka<br/>raw articles"]:::async
  STORE[("Article Store<br/>Cassandra")]:::database
  SOURCES["50K Publishers"]:::client

  SCHED -->|"1. Dispatch jobs"| WORKERS
  WORKERS -->|"2. Fetch RSS and HTML"| SOURCES
  WORKERS -->|"3. Parse content"| EXTRACT
  EXTRACT -->|"4. Publish parsed article"| KF
  KF -->|"5. Sink data"| STORE`,
      },
      steps: [
        'Crawl Scheduler pops the next source due for crawling from its priority queue',
        'Assigns it to a Crawler Worker (round-robin across the worker pool)',
        "Worker fetches the RSS feed or webpage, respecting robots.txt and rate limits",
        'Content Extractor parses the raw content into structured article fields',
        "Deduplicates at the URL level (skip if we've already seen this exact URL)",
        'Publishes the new article to Kafka topic articles.raw',
        'Downstream consumers (clustering, indexing) read from Kafka independently',
      ],
      closingNote:
        "Why Kafka? Crawling speed varies wildly (some sources respond in 50ms, some in 5s). Kafka buffers the stream so downstream processing isn't coupled to crawl speed. If the clustering service goes down for maintenance, articles queue up and are processed when it's back.",
    },
    {
      title: 'FR2: Deduplicate and Cluster Articles into Stories',
      body:
        'This is the hardest part. When a major event happens (election results, earthquake), 200 publishers write about it within minutes. We need to detect that these 200 articles are about the same event and group them into one "story cluster." The user should see one headline with "200 sources" - not 200 separate cards.',
      newComponents: [
        {
          name: 'Clustering Service',
          description:
            'Consumes articles from Kafka, computes text similarity against existing clusters, and either assigns the article to an existing cluster or creates a new one.',
        },
        {
          name: 'Embedding Store (Redis)',
          description:
            'Stores vector embeddings of recent story clusters for fast similarity lookup. When a new article arrives, we compare its embedding against existing cluster centroids.',
        },
        {
          name: 'Story Cluster DB (Postgres)',
          description: 'Stores cluster metadata: representative headline, source list, topic, freshness score, article count.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  KF["Kafka<br/>raw articles"]:::async
  CLUSTER["Clustering Service"]:::compute
  EMBED[("Embedding Store<br/>Redis vectors")]:::cache
  CLUSTERDB[("Cluster DB<br/>Postgres")]:::database
  STORE[("Article Store")]:::database

  KF -->|"1. Process new article"| CLUSTER
  CLUSTER -->|"2. Compute embeddings"| EMBED
  CLUSTER -->|"3. Read cluster centroids"| CLUSTERDB
  CLUSTER -->|"4. Fetch article content"| STORE`,
      },
      steps: [
        'Clustering Service consumes a new article from Kafka',
        "Generates a text embedding (vector) from the article's title + first paragraph",
        'Queries Embedding Store: "find clusters whose centroid is within 0.85 cosine similarity"',
        'Match found? -> Add article to that cluster. Update cluster metadata (source count, freshness, representative headline if this source is more authoritative).',
        'No match? -> Create a new cluster with this article as the seed. Store its embedding as the cluster centroid.',
        'Assign topic(s) to the cluster based on content classification (Politics, Tech, Sports, etc.)',
        'Update freshness score: score = article_count * recency_weight (more sources + newer = hotter story)',
      ],
      closingNote:
        'Why embeddings over keyword matching? "Biden wins election" and "US Presidential race results announced" are about the same event but share few keywords. Semantic embeddings capture meaning, not just words. Cosine similarity of their vectors will be >0.9.',
    },
    {
      title: 'FR3: Serve Personalized Feed',
      body:
        'When a user opens the app, they need a ranked feed of story clusters tailored to their interests. A tech enthusiast in Bangalore should see different stories than a sports fan in Mumbai - even during the same news cycle.',
      newComponents: [
        {
          name: 'Feed Service',
          description: 'The API layer users hit. Fetches candidate stories, applies personalization ranking, returns the final feed.',
        },
        {
          name: 'User Profile Store (Redis)',
          description: "Stores each user's interests, reading history (last 100 stories read), location, and language.",
        },
        {
          name: 'Feed Cache (Redis)',
          description: 'Pre-computed feeds for active users. Refreshed every 5-10 minutes. Avoids re-ranking on every request.',
        },
        {
          name: 'Ranking Service',
          description:
            "Scores each candidate story for a specific user based on: topic relevance, freshness, source authority, diversity (don't show 5 politics stories in a row).",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  USER[User]:::client
  GW["API Gateway"]:::edge
  FEED["Feed Service"]:::compute
  CACHE[("Feed Cache<br/>Redis")]:::cache
  RANK["Ranking Service"]:::compute
  PROFILE[("User Profile<br/>Redis")]:::cache
  CLUSTERDB[("Cluster DB")]:::database

  USER -->|"1. GET personalized feed"| GW
  GW -->|"2. Forward to feed svc"| FEED
  FEED -->|"3. Lookup cached feed"| CACHE
  FEED -->|"4. Score and rank articles"| RANK
  RANK -->|"5. Load user preferences"| PROFILE
  RANK -->|"6. Read top clusters"| CLUSTERDB`,
      },
      steps: [
        'User opens app -> GET /feed?userId=42',
        'Feed Service checks Feed Cache: is there a fresh pre-computed feed? (< 5 min old)',
        'Cache hit? -> Return immediately. Sub-10ms.',
        'Cache miss? -> Call Ranking Service to build a fresh feed: fetch top 500 active story clusters from Cluster DB (sorted by freshness + article count)',
        "Cache miss: fetch user profile - interests, reading history, location",
        'Cache miss: score each cluster - score = w1*topic_match + w2*freshness + w3*source_authority + w4*diversity_penalty',
        'Cache miss: filter out stories user already read (from reading history), return top 50 ranked clusters',
        'Cache the result for this user (TTL = 5 min), then return the feed to the user',
      ],
      closingNote:
        'Why cache feeds? At 50K feed requests/sec, running the ranking model on every request is expensive. Most users check their feed 5-10 times between updates anyway. A 5-minute cache means 99% of requests are served without computation.',
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1: Article Ingestion (Breaking News)',
      diagram: {
        mermaid: `sequenceDiagram
    participant S as Crawl Scheduler
    participant W as Crawler Worker
    participant E as Extractor
    participant K as Kafka
    participant C as Clustering Service
    participant DB as Cluster DB

    S->>W: Crawl bbc.com/rss (high priority)
    W->>W: Fetch RSS, find 3 new articles
    W->>E: Parse article content
    E-->>K: Publish to articles.raw
    K->>C: Consume new article
    C->>C: Generate embedding
    C->>C: Find matching cluster (cosine > 0.85)
    alt Cluster exists
        C->>DB: Add article to cluster, update freshness
    else New story
        C->>DB: Create new cluster
    end`,
      },
      nonObviousFailure:
        'If the Clustering Service is slow during a breaking news spike (100 articles/min about the same event), articles queue in Kafka. This is fine - Kafka handles backpressure naturally. The feed might show the story 30-60 seconds later than ideal, but no data is lost.',
    },
    {
      title: 'Flow 2: Personalized Feed Load',
      diagram: {
        mermaid: `sequenceDiagram
    participant U as User
    participant F as Feed Service
    participant Cache as Feed Cache
    participant R as Ranking Service
    participant P as User Profile
    participant DB as Cluster DB

    U->>F: GET /feed
    F->>Cache: Check cache for user:42
    alt Cache hit (< 5min old)
        Cache-->>F: Cached feed
        F-->>U: Return feed (sub-10ms)
    else Cache miss
        F->>R: Rank stories for user:42
        R->>P: Get interests + history
        R->>DB: Get top 500 active clusters
        R->>R: Score and rank
        R-->>F: Top 50 clusters
        F->>Cache: Store (TTL 5min)
        F-->>U: Return feed
    end`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Story Clustering - Detecting Same Event Across Sources',
      problem:
        "50 publishers write about the same event with different headlines, different angles, different details. We need to detect they're the same \"story\" and group them.",
      bad:
        'Keyword matching. "Biden" AND "election" -> same cluster. Fails because: "Biden election victory" and "Biden election campaign funding scandal" are completely different stories sharing the same keywords.',
      good:
        'TF-IDF cosine similarity on article titles. Compute term-frequency vectors, compare cosine similarity. Threshold > 0.7 = same cluster. Works for obvious duplicates but misses paraphrased content ("Stock market crashes" vs "Wall Street sees worst day in a decade").',
      great:
        "Sentence embeddings (BERT/sentence-transformers) plus incremental clustering: (1) each article's title + first paragraph becomes a 768-dim vector via a pre-trained model; (2) the new article's vector is compared against all active cluster centroids using approximate nearest neighbor search (FAISS or Redis Vector Search); (3) if cosine similarity > 0.85, assign it to that cluster and update the centroid as a running average; (4) if no match, create a new cluster; (5) clusters decay - if no new article joins for 24h, the cluster moves to archive. Latency: embedding generation is about 10ms (GPU), ANN search about 5ms, so the total clustering decision is under 20ms per article - at 10K articles/hour, one machine handles it.",
    },
    {
      title: 'Breaking News - How to Surface Events in Under 5 Minutes',
      problem:
        'A major event happens. The first publisher posts about it. Our crawler might not check that source for another 10 minutes. By then, users have already seen it on Twitter.',
      simpleTerms:
        "Breaking news just happened. If we wait for our next scheduled crawl (could be 10 minutes), users see it on Twitter first. We need to detect and surface breaking news faster.",
      bad:
        "Crawl all 50K sources every 5 minutes. At 50K sources with 2s average response time, that's 100K seconds of crawl time / parallelism. Even with 100 workers = 1000 seconds per full cycle. Too slow and wasteful for sources that rarely update.",
      good:
        'Adaptive crawl frequency. Track how often each source publishes. BBC publishes every 2 minutes -> crawl every 3 min. A local blog publishes weekly -> crawl every 6 hours. Prioritize sources by historical freshness.',
      great:
        'Adaptive crawling plus webhook push plus velocity detection: (1) push for top publishers - major publishers (Reuters, AP, BBC) send webhooks when they publish, instant with zero crawl delay; (2) adaptive polling for the rest - crawl frequency = f(publish_rate); high-velocity sources crawled every 3-5 min, low-velocity every 1-6 hours; (3) velocity spike detection - if the clustering service sees 10+ new clusters created in the last 5 minutes (unusual), trigger an emergency re-crawl of all top-100 sources, since something big is happening; (4) breaking news flag - stories with cluster growth rate > 20 articles/hour get flagged as "Breaking" and boosted to the top of all feeds regardless of personalization.',
    },
    {
      title: 'Feed Ranking - Personalization Without Being a Filter Bubble',
      problem:
        "Pure personalization creates filter bubbles - a user who reads only tech news never sees important political events. Pure chronological is noisy - most stories aren't relevant to any specific user.",
      simpleTerms:
        "If we only show you tech news because you read tech news, you'll never learn about important political events. But showing everything is noisy. We need balance.",
      bad: 'Sort by publish time only. User drowns in irrelevant content.',
      good:
        'Topic-based filtering. User follows "Tech" and "Sports" -> only show stories with those topics. Simple but misses cross-topic stories the user might care about and provides no ranking within a topic.',
      great:
        'Multi-signal scoring with diversity constraints. Scoring formula per story cluster for a user: score = 0.3 * topic_relevance + 0.25 * freshness_decay + 0.2 * story_importance (source_count * authority_avg) + 0.15 * engagement_signals (CTR from similar users) + 0.1 * diversity_bonus (penalize 3rd story on same topic). Diversity constraint applied as a post-processing pass: no more than 2 consecutive stories from the same topic; at least 1 "serendipity" story per page (topic the user doesn\'t usually read, but is nationally important); breaking news always ranks in top 3 regardless of personalization. Cold start (new users): use location + language to serve a "trending in your region" feed. After 10 clicks, enough signal to personalize.',
    },
    {
      title: 'Handling Traffic Spikes During Breaking Events',
      problem:
        'Normal traffic is 50K QPS. During election night or a natural disaster, traffic spikes to 500K QPS in minutes. The same 3 stories are requested by everyone simultaneously.',
      simpleTerms:
        'Election night. Traffic spikes 10x in minutes. Everyone wants the same 3 stories. If we recompute the feed for each user, the system melts.',
      bad: "Every user's feed request triggers a fresh ranking computation. At 500K QPS, ranking service melts.",
      good:
        'Feed cache with 5-min TTL absorbs most reads. But during breaking news, users want the LATEST - a 5-min-old cache feels stale.',
      great:
        'Tiered caching plus push invalidation: (1) global trending cache - top 10 stories for each region, updated every 30 seconds, served to users whose personal feed cache is stale; super cheap (one cache entry per region, millions of reads); (2) breaking news override - when a story is flagged "Breaking," it\'s injected at the top of ALL cached feeds without regenerating the entire feed; (3) graceful degradation - if ranking service is overloaded, fall back to the global trending feed + user\'s topic preferences (simple filter, no ML ranking); a "good enough" feed in 5ms vs a perfect feed timing out.',
    },
  ],

  selfAudit: [
    {
      question: 'Single points of failure?',
      answer: 'Kafka is replicated. Crawlers are stateless. Cluster DB has read replicas. Feed cache is Redis Cluster.',
    },
    {
      question: 'Stale content?',
      answer: 'Feed cache TTL = 5 min. Breaking news bypasses cache. Acceptable for a news feed.',
    },
    {
      question: 'Duplicate articles?',
      answer: 'URL-level dedup at ingestion + semantic clustering catches paraphrases.',
    },
    {
      question: 'Hot stories?',
      answer: 'Trending cache absorbs 95% of reads for popular stories.',
    },
    {
      question: 'Publisher goes down?',
      answer: 'Crawler retries with backoff. Missing one crawl cycle is acceptable.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  SOURCES["50K Publishers"]:::client
  SCHED["Crawl Scheduler"]:::compute
  WORKERS["Crawler Pool"]:::compute
  KF["Kafka"]:::async
  CLUSTER["Clustering Service"]:::compute
  EMBED[("Embeddings<br/>Redis Vectors")]:::cache
  CLUSTERDB[("Cluster DB<br/>Postgres")]:::database
  ARTICLES[("Article Store<br/>Cassandra")]:::database
  FEED["Feed Service"]:::compute
  RANK["Ranking Service"]:::compute
  CACHE[("Feed Cache<br/>Redis")]:::cache
  PROFILE[("User Profiles<br/>Redis")]:::cache
  USER["Users"]:::client
  GW["API Gateway"]:::edge

  SOURCES -->|"Provide articles"| WORKERS
  SCHED -->|"Trigger crawl"| WORKERS
  WORKERS -->|"Publish parsed article"| KF
  KF -->|"Process new article"| CLUSTER
  KF -->|"Sink data"| ARTICLES
  CLUSTER -->|"Compute embeddings"| EMBED
  CLUSTER -->|"Read cluster centroids"| CLUSTERDB
  USER -->|"GET personalized feed"| GW
  GW -->|"Forward to feed svc"| FEED
  FEED -->|"Lookup cached feed"| CACHE
  FEED -->|"Score and rank articles"| RANK
  RANK -->|"Read top clusters"| CLUSTERDB
  RANK -->|"Load user preferences"| PROFILE`,
    bullets: [
      'Ingestion: Crawl Scheduler triggers workers - adaptive scheduling pings 50K publishers at their optimal frequency',
      'Ingestion: Crawler Pool fetches articles - downloads, parses, and deduplicates new content',
      'Ingestion: Kafka receives raw articles - events streamed to downstream consumers',
      'Ingestion: Clustering Service groups stories - computes sentence embeddings, finds nearest neighbors, assigns articles to story clusters',
      'Ingestion: Article Store persists content - Cassandra stores full article text and metadata',
      'Read path: User requests feed - hits API Gateway, routed to Feed Service',
      'Read path: Feed Cache checked - Redis returns cached personalized feed (5-min TTL absorbs 99% of reads)',
      'Read path: Cache miss triggers ranking - Feed Service calls Ranking Service which scores clusters by freshness, personalization, and diversity',
      'Read path: Ranking Service reads context - pulls story clusters from Postgres Cluster DB and user preferences from Redis Profiles',
      'Read path: Ranked feed returned - top stories served to the user with source diversity constraints applied',
    ],
  },

  keyTechnologies: [
    {
      term: 'Sentence Embeddings',
      definition:
        'ML models (BERT, sentence-transformers) that convert text into fixed-size vectors capturing semantic meaning. Similar texts have high cosine similarity.',
    },
    {
      term: 'Approximate Nearest Neighbor (ANN)',
      definition: 'Algorithms (FAISS, HNSW) that find similar vectors without comparing against all vectors. O(log N) vs O(N).',
    },
    {
      term: 'Story Clustering',
      definition: 'Grouping articles about the same event. The cluster has one headline, N sources, a freshness score, and decays over time.',
    },
    {
      term: 'Adaptive Crawling',
      definition: 'Adjusting crawl frequency per source based on how often they actually publish. Saves resources, improves freshness for active sources.',
    },
    {
      term: 'Feed Ranking',
      definition: 'Multi-signal scoring that balances personalization, freshness, importance, and diversity to produce a ranked feed.',
    },
    {
      term: 'Cascade Ranking',
      definition: 'Two-stage: lightweight filter (1000->100) then expensive ML ranker (100->50). Saves compute.',
    },
  ],

  expectedDepth: {
    mid: 'Design the basic pipeline: crawl sources, store articles, serve chronologically. Propose RSS parsing and a database. With prompting, recognize the deduplication problem (same story from multiple sources). Propose keyword matching or URL-based dedup.',
    senior:
      'Proactively identify story clustering as the core challenge. Propose embedding-based similarity for grouping articles. Design the feed with personalization (topic preferences + freshness). Discuss adaptive crawl scheduling and why uniform polling wastes resources. Explain caching strategy for feed reads.',
    staffPlus:
      'Address breaking news latency (webhook push + velocity detection + emergency re-crawl). Discuss feed diversity constraints to avoid filter bubbles. Propose cascade ranking (lightweight filter -> ML ranker) for cost efficiency. Cover graceful degradation during traffic spikes (fall back to trending feed). Discuss cold-start personalization and the tension between engagement optimization and editorial quality.',
  },

  keyTakeaways: [
    'Story clustering with embeddings groups 200 articles about the same event into one card',
    'Adaptive crawling balances freshness vs resource cost across 50K sources',
    'Feed cache (5-min TTL) absorbs 99% of read traffic without re-ranking',
    'Breaking news bypass injects urgent stories into cached feeds without full regeneration',
    'Diversity constraints prevent filter bubbles while still personalizing',
  ],

  relatedDesigns: ['social-feed', 'notification-system', 'photo-sharing'],
  relatedConcepts: [
    {
      name: 'Message Queues',
      description: 'Pipeline crawled articles through fetch, parse, dedupe, and rank stages.',
    },
    {
      name: 'Batch vs Stream',
      description: 'Batch crawling for coverage vs streaming for trending detection.',
    },
    { name: 'Caching', description: 'Serves hot feeds and ranked stories fast.' },
    {
      name: 'Bloom Filters',
      description: 'Cheaply skip already-seen article URLs during crawling and dedup.',
    },
  ],

  simulator: {
    goalDescription:
      'Ingest articles from 50K publishers, cluster near-duplicates into story cards, and serve a personalized feed fast.',
    requirementChips: ['Feed < 200ms P99', '50K feed RPS', 'Breaking news in < 5 min'],
    targetRps: 50000,
    readRatio: 0.95,
    cacheHitRatio: 0.99,
    latencyBudgetMsP99: 200,
    rubric: [
      { id: 'edge-gateway', label: 'API Gateway at the edge', kind: 'requires-node-type', nodeType: 'api-gateway' },
      { id: 'feed-cache', label: 'Feed cache absorbing repeat reads (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'ingestion-bus', label: 'Durable ingestion pipeline (Kafka)', kind: 'requires-node-type', nodeType: 'kafka' },
      {
        id: 'cluster-store',
        label: 'Durable store for story clusters',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb', 'cassandra'],
      },
      {
        id: 'compute-tier',
        label: 'Compute tier for crawling, clustering, and ranking',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 120 } },
        { id: 'publisher-1', type: 'client', instanceCount: 1, position: { x: 40, y: 320 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 120 } },
        { id: 'feed-1', type: 'app-server', instanceCount: 10, position: { x: 600, y: 120 } },
        { id: 'cache-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'rank-1', type: 'microservice', instanceCount: 6, position: { x: 1160, y: 120 } },
        { id: 'worker-1', type: 'worker', instanceCount: 20, position: { x: 320, y: 320 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 600, y: 320 } },
        { id: 'cluster-svc-1', type: 'microservice', instanceCount: 8, position: { x: 880, y: 320 } },
        { id: 'embed-1', type: 'redis', instanceCount: 2, position: { x: 1160, y: 320 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 10, position: { x: 1440, y: 220 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 12, position: { x: 1440, y: 380 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-feed', source: 'gw-1', target: 'feed-1' },
        { id: 'e-feed-cache', source: 'feed-1', target: 'cache-1' },
        { id: 'e-feed-rank', source: 'feed-1', target: 'rank-1' },
        { id: 'e-rank-pg', source: 'rank-1', target: 'pg-1' },
        { id: 'e-pub-worker', source: 'publisher-1', target: 'worker-1' },
        { id: 'e-worker-kafka', source: 'worker-1', target: 'kafka-1' },
        { id: 'e-kafka-cluster', source: 'kafka-1', target: 'cluster-svc-1' },
        { id: 'e-cluster-embed', source: 'cluster-svc-1', target: 'embed-1' },
        { id: 'e-cluster-pg', source: 'cluster-svc-1', target: 'pg-1' },
        { id: 'e-kafka-cassandra', source: 'kafka-1', target: 'cassandra-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Two lanes share the cluster DB: an ingestion lane (crawlers to Kafka to a clustering service backed by Redis embeddings and Cassandra article storage) and a read lane (API Gateway to Feed Service to a 5-minute Redis feed cache to Ranking) that absorbs 99% of reads without recomputation.',
    failureModeNarratives: {
      'api-gateway': 'A single edge tier fronts both the read path and internal routing; if it saturates, personalized feed requests stall platform-wide even though ingestion keeps running.',
    },
    fullDesignLinkSlug: 'news-aggregator',
  },
}

export default topic
