import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'social-feed',
  title: 'Twitter (X) / Threads — Social Feed',
  difficulty: 'Intermediate',
  icon: 'pi pi-comments',
  color: '#8b5cf6',
  readTimeMinutes: 24,
  topics: ['Fan-out (Push vs Pull)', 'Redis Sorted Sets', 'Kafka Event-Driven Fan-out', 'Feed Ranking'],
  companies: [],
  prerequisites: ['Fan-Out', 'Caching', 'Message Queues'],
  summary:
    "A personalized, ranked stream built by merging posts from hundreds of followed accounts. Uses write-time fan-out so normal reads are instant cache lookups, with a read-time fallback for accounts too large to push to millions of followers on every post.",

  understandingProblem:
    "A social feed is the personalized, ordered stream of content (Twitter/X, Instagram, LinkedIn) built by merging posts from every account a user follows into a single ranked or chronological view. The difficulty comes from several forces pulling against each other at once: a user following ~500 accounts that each post ~5 times a day means merging roughly 2,500 posts/day into one timeline just for that person; a single celebrity account with 50M followers posting once means up to 50M individual timelines could need updating immediately; the feed still has to load in under 200ms even on a weak mobile connection; and ordering matters psychologically - content can be chronological or ranked by relevance, but it should never look randomly scrambled to the viewer.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  user[User opens feed]:::client
  api[Feed API]:::compute
  db[("Tweets table")]:::database
  user --> api
  api -->|"SELECT WHERE author IN followees ORDER BY time"| db`,
    },
    code: `SELECT * FROM tweets WHERE author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?) ORDER BY created_at DESC LIMIT 50`,
    whyThisBreaks: [
      'The IN clause covers hundreds of followee IDs and forces a scan across huge numbers of rows on every request',
      'At 500M DAU with ~10 feed opens/day per user, this query alone runs roughly 5B times/day',
      'There is no caching layer, so the same expensive query re-runs seconds apart for the same user',
      'Results are purely chronological - no relevance ranking is possible with a plain ORDER BY',
      'When a celebrity tweets, up to 50M followers can trigger this same costly query at once',
    ],
    closingNote:
      "We need to precompute and cache each user's feed ahead of time, so reading a feed becomes a fast lookup instead of a live join across the social graph on every request.",
  },

  priorArt: [
    {
      title: 'Twitter Fan-out Service',
      description:
        'The system that coined "fan-out on write." Pre-builds timelines for accounts under 500K followers, and assembles feeds at request time for celebrity accounts. Handles 500M tweets/day, resulting in 200B+ timeline writes/day. (Twitter Engineering blog)',
      link: 'https://highscalability.com/blog/2013/7/8/the-architecture-twitter-uses-to-deal-with-150m-active-users.html',
    },
    {
      title: 'Facebook TAO',
      description:
        'A graph-aware caching system serving the social graph at billions of queries. Separating the cache for follow relationships from the cache for content is essential for performance. (Facebook TAO paper)',
      link: 'https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf',
    },
    {
      title: 'Instagram Feed Ranking',
      description:
        "Instagram's move away from a purely chronological feed toward one ranked by an ML system: first generate candidate posts from the timeline, then score each candidate with a model that predicts engagement likelihood. (Instagram Engineering)",
      link: 'https://transparency.meta.com/features/explaining-ranking/ig-feed-recommendations/',
    },
    {
      title: 'LinkedIn Feed Architecture',
      description:
        'A "feed mixer" design that blends multiple content streams - network updates, sponsored posts, and algorithmic recommendations - into one unified, ranked feed. (LinkedIn Engineering blog)',
      link: 'https://www.linkedin.com/blog/engineering/archive/making-your-feed-more-relevant-part-i',
    },
  ],

  coreEntities: [
    { name: 'User', description: 'An account with a profile, a list of followers, a list of people followed, and preference settings.' },
    {
      name: 'Tweet',
      description: 'A post limited to 280 characters, optionally with media, plus author, timestamp, and engagement counts (likes, retweets, etc.).',
    },
    { name: 'Timeline', description: "An individual, time-sorted list of tweet IDs that make up one user's feed." },
    { name: 'Follow Relationship', description: 'A one-directional edge in the social graph: user A follows user B.' },
    { name: 'Fan-out Job', description: 'A background/async task that distributes a newly created tweet into the timelines of its followers.' },
  ],

  requirements: {
    core: [
      "Post a tweet - a user composes and submits a tweet; the system durably stores it and announces its creation without blocking on delivery to followers",
      "View a personalized home feed - a user opens the app and sees a ranked, near-instant feed built from the accounts they follow",
      'Handle celebrity / mega-follower accounts - very large accounts must not be able to degrade posting or delivery for everyone else',
    ],
    belowTheLine: [
      'Tweet deletion propagation through already-cached (pre-built) timelines',
      'Cache eviction and lazy re-population strategy for dormant users',
    ],
    nonFunctionalTable: [
      { metric: 'Latency', target: 'P99 < 200ms for feed reads' },
      { metric: 'Write throughput', target: '~6K tweets/sec sustained (500M tweets/day); fan-out generates 200B+ cache writes/day' },
      { metric: 'Read throughput', target: '100K feed loads/sec at peak' },
      { metric: 'Scale', target: '500M DAU, ~400 average follows per user, celebrity accounts with 50M+ followers' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Timeline Cache',
      purpose: 'Pre-built per-user feed (sorted tweet IDs)',
      primaryPick: 'Redis Sorted Sets',
      alternatives: 'Memcached, DynamoDB, Cassandra',
      whyPrimaryWins: 'O(log N) insert for fan-out writes; O(log N) range read for feed loads keeps ZREVRANGE off the critical database path',
    },
    {
      tier: 'Tweet Store',
      purpose: 'Durable tweet content + metadata',
      primaryPick: 'Cassandra',
      alternatives: 'DynamoDB, ScyllaDB, Postgres',
      whyPrimaryWins: 'Append-heavy at 6K tweets/sec; partitioning by author_id makes fan-out-on-read for celebrities a single-partition query',
    },
    {
      tier: 'Event Bus',
      purpose: 'Fan-out events from tweet publish',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, RabbitMQ',
      whyPrimaryWins: 'Ordered per-partition and replayable for backfill; absorbs 200B+ fan-out writes/day without blocking the posting path',
    },
    {
      tier: 'Social Graph',
      purpose: 'Follower/following edges',
      primaryPick: 'Redis (adjacency) + Postgres (durable)',
      alternatives: 'Neo4j, DynamoDB, Cassandra',
      whyPrimaryWins: 'Redis answers "who are this account\'s followers" in microseconds during fan-out; Postgres is the durable backstop for graph mutations',
    },
    {
      tier: 'CDN',
      purpose: 'Media attachments (images/video)',
      primaryPick: 'CloudFront',
      alternatives: 'Cloudflare, Fastly, Akamai',
      whyPrimaryWins: 'Offloads media entirely from API servers; immutable media URLs mean a near-100% edge cache hit ratio',
    },
    {
      tier: 'Search',
      purpose: 'Tweet text and hashtag search',
      primaryPick: 'Elasticsearch',
      alternatives: 'Algolia, Meilisearch, Typesense',
      whyPrimaryWins: 'Near-real-time indexing of 500M tweets/day with relevance ranking, decoupled from the write-optimized Tweet Store',
    },
  ],
  technologyChoicesNote:
    "Why Cassandra over Postgres for tweets? At this scale, append-only writes and a partition-by-author access pattern map directly onto Cassandra's LSM-tree storage, while Postgres would struggle with write amplification and vacuuming under the same load. Why Redis for the timeline cache instead of a database read? A feed load is a hot-path read that has to return in milliseconds for hundreds of millions of daily opens - a sorted set gives an O(log N) range read with no join across the social graph.",

  scaleEstimation: [
    'Users: 500M DAU, 400 avg follows per user',
    'Write QPS: ~6K tweets/sec (500M tweets/day); fan-out generates 200B+ cache writes/day',
    'Read QPS: 100K feed loads/sec at peak (each user opens feed 10+ times/day)',
    'Storage: ~3TB tweet storage/year (text + metadata; media stored separately in S3)',
    'Bandwidth: ~50 Gbps at peak for feed API responses + media CDN',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/tweets',
      description:
        'Create a new tweet. Persists it to the Tweet Store and publishes a TweetCreated event to Kafka - does not wait for fan-out to complete.',
      example: '// Request\n{ "authorId": "user_42", "text": "hello world" }\n\n// Response 200\n{ "tweetId": "tw_9001", "createdAt": "2026-07-21T10:00:00Z" }',
    },
    {
      method: 'GET',
      path: '/v1/feed',
      description:
        "Return the caller's ranked home timeline: read the pre-built Redis timeline, merge in celebrity followees fetched live, hydrate tweet IDs into full objects, then rank.",
      example: '// Response 200\n[{ "tweetId": "tw_9001", "authorId": "user_42", "text": "hello world", "score": 0.87 }, ...]',
    },
  ],
  apiSecurityNote:
    "All requests pass through the API Gateway, which authenticates callers (JWT) and applies rate-limiting before forwarding to the Tweet Service or Feed Service. The Tweet Service never trusts an authorId that doesn't match the authenticated session.",

  highLevelDesignIntro: "Let's build this incrementally, adding components as each requirement demands them.",

  builds: [
    {
      title: 'FR1: User Posts a Tweet',
      body:
        "A user composes a tweet and submits it. At this stage, the system's only job is to store the tweet reliably and announce that it exists - not to immediately deliver it to anyone.",
      insightCallout:
        'The Tweet Service doesn\'t deliver tweets to followers - it just writes the tweet and announces "hey, a new tweet exists." Delivery is a separate, asynchronous concern handled by whatever consumes that event.',
      newComponents: [
        { name: 'API Gateway', description: 'Entry point for all client requests. Handles authentication, rate-limiting, and routing.' },
        { name: 'Tweet Service', description: 'Validates content, stores the tweet, and uploads media references.' },
        { name: 'Tweet Store (Cassandra)', description: 'Durable storage layer for all tweets, built for high write throughput.' },
        {
          name: 'Kafka',
          description:
            "Event bus where the Tweet Service publishes TweetCreated events so other parts of the system can react asynchronously - decouples posting from delivery.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  user[User]:::client
  gw[API Gateway]:::edge
  tweetSvc[Tweet Service]:::compute
  store[("Tweet Store - Cassandra")]:::database
  kafka[["Kafka - TweetCreated"]]:::async

  user -->|"1. POST new tweet"| gw
  gw -->|"2. Forward to tweet svc"| tweetSvc
  tweetSvc -->|"3. Persist tweet"| store
  tweetSvc -->|"4. Publish tweet event"| kafka`,
      },
      steps: [
        'User taps Post -> request hits API Gateway',
        'Gateway authenticates (JWT) and forwards to Tweet Service',
        'Tweet Service stores the tweet in Cassandra (permanent record)',
        'Tweet Service publishes a TweetCreated event to Kafka (tweetId, authorId, timestamp)',
        'Service responds to the user: "Tweet posted!" in ~50ms',
      ],
      closingNote: 'Now users want to see their feed.',
    },
    {
      title: 'FR2: User Opens Their Feed - Pre-Built Timelines',
      body:
        "Querying every followee's tweets on demand is too slow at scale, so instead we precompute each person's timeline ahead of time. That turns a feed read into a simple cache lookup instead of a live database query.",
      insightCallout:
        'A Redis sorted set keeps elements ordered by score, so fetching the "latest 50 tweets" for a user is one near-instant ZREVRANGE call instead of a live join across the social graph.',
      newComponents: [
        {
          name: 'Fan-out Service',
          description: "Listens for TweetCreated events on Kafka and inserts the new tweet's ID into each follower's precomputed timeline.",
        },
        { name: 'Social Graph', description: 'The who-follows-whom data store, queried during fan-out (e.g. "all 5,000 followers of this user").' },
        {
          name: 'Timeline Cache (Redis Sorted Set)',
          description: "Stores each user's feed as a sorted set of tweet IDs ranked by timestamp for near-instant reads.",
        },
        { name: 'Feed Service', description: 'Handles feed requests: reads from the cache, expands tweet IDs into full tweet data, and applies ranking.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  kafka[["Kafka - TweetCreated"]]:::async
  fanout[Fan-out Service]:::compute
  graph_[("Social Graph")]:::database
  cache[("Timeline Cache - Redis ZSET")]:::cache
  user[User]:::client
  gw[API Gateway]:::edge
  feedSvc[Feed Service]:::compute
  store[("Tweet Store")]:::database

  kafka -->|"1. Process tweet event"| fanout
  fanout -->|"2. Lookup followers"| graph_
  fanout -->|"3. Prepend to follower feeds"| cache
  user -->|"4. GET /feed"| gw
  gw -->|"5. Forward to feed svc"| feedSvc
  feedSvc -->|"6. Read pre-built feed"| cache
  feedSvc -->|"7. Hydrate tweet details"| store`,
      },
      steps: [
        'Fan-out (write path): Fan-out Service consumes the TweetCreated event from Kafka',
        'Fan-out (write path): asks the Social Graph for the author\'s followers',
        'Fan-out (write path): runs ZADD timeline:{followerId} with timestamp + tweet ID for each follower',
        "Fan-out (write path): trims each follower's timeline to 800 entries",
        'Feed read: user opens the app and calls GET /feed',
        'Feed read: Feed Service runs ZREVRANGE timeline:{userId} 0 49 against Redis (~1ms), returning 50 tweet IDs',
        'Feed read: IDs are hydrated into full tweet objects via a batch multi-get from Cassandra',
        'Feed read: the ranked feed is returned to the user',
      ],
      closingNote:
        "Pushing a single celebrity's tweet to 50M followers would mean 50M Redis writes, taking minutes and stalling the fan-out queue behind it - a different approach is needed for very large accounts.",
    },
    {
      title: 'FR3: Handle Celebrities - The Hybrid Approach',
      body:
        'Celebrity accounts are the central design difficulty: fan-out on write fails for massive accounts, so a combined strategy is needed. Rule: accounts under 10K followers get fan-out on write; accounts over 10K followers get fan-out on read. No new infrastructure is required - just different logic in the Fan-out Service and Feed Service. The Fan-out Service checks the follower count before pushing and skips authors over the threshold; the Feed Service keeps a per-user list of celebrity followees and, at feed-load time, pulls their recent posts directly from the Tweet Store to merge into the cached feed.',
      insightCallout:
        'The 10K threshold is a tuning knob, not a law: pushing to 10K followers finishes in about 100ms, but pushing to 50M would take minutes - the cutoff just has to sit somewhere that keeps push time bounded.',
      diagram: {
        mermaid: `flowchart TD
  newTweet[New tweet]:::client
  check{Follower count?}:::compute
  push[["Fan-out on WRITE - push to Redis timelines"]]:::async
  skip[Skip push - fetched at read time]:::compute

  newTweet -->|"1. Check followers"| check
  check -->|"2. < 10K followers"| push
  check -->|"3. > 10K followers"| skip`,
      },
      steps: [
        'Feed Service gets the pre-built timeline from Redis (regular users\' tweets)',
        "Feed Service gets the list of celebrity followees for this user",
        'Feed Service fetches recent tweets from each celebrity (5-20 accounts x latest 5 tweets = up to 100 tweets)',
        'Feed Service merges both sets and ranks by relevance score',
        'Feed Service returns the top 50',
      ],
      closingNote:
        'This threshold is adjustable depending on your service-level targets - 10K is just a chosen tuning point balancing latency against push cost.',
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1: User Posts a Tweet',
      diagram: {
        mermaid: `sequenceDiagram
  participant U as User
  participant T as Tweet Service
  participant S as Tweet Store
  participant K as Kafka
  participant W as Fan-out Workers
  participant G as Social Graph
  participant R as Redis Timelines

  U->>T: POST tweet
  T->>S: store tweet
  T->>K: publish TweetCreated event
  K->>W: consume
  W->>G: get followers of poster
  G-->>W: follower list
  W->>W: filter out celebrities from push
  W->>R: ZADD timeline:{followerId} tweetId (for each follower)
  W->>R: ZREMRANGEBYRANK trim to latest 800`,
      },
    },
    {
      title: 'Flow 2: User Opens Their Feed',
      diagram: {
        mermaid: `sequenceDiagram
  participant U as User
  participant F as Feed Service
  participant R as Redis
  participant DB as Tweet Store
  participant RANK as Ranking Service

  U->>F: GET /feed
  F->>R: ZREVRANGE timeline:{userId} 0 50
  R-->>F: cached tweet IDs
  F->>DB: multi-get tweet details by IDs
  DB-->>F: tweet objects
  F->>F: fetch celebrity tweets on read (merge)
  F->>RANK: rank and filter
  RANK-->>F: sorted feed
  F-->>U: feed response`,
      },
    },
  ],

  deepDives: [
    {
      title: 'The Celebrity Problem (Hot Partition)',
      problem:
        "Your game... a mega-celebrity account with 100M followers posts a tweet. Pushing that single tweet into 100M separate timelines would take minutes to complete, leaving the post effectively invisible to nearly all followers during that window - an alternative strategy is needed for extremely large accounts.",
      simpleTerms:
        "A celebrity with 100M followers posts something. You can't push that into 100M timelines quickly - it would take minutes, so most followers wouldn't see it right away. Mega-accounts need special handling.",
      bad: 'Fan-out on write for everyone, including celebrities. Their posts clog the processing queue for hours, blocking timely delivery for everyone else in the system too.',
      good: 'Skip fan-out for celebrities (accounts over 10K followers). Fetch their tweets at read time instead, avoiding the massive write burden at posting time.',
      great:
        'A tiered system: regular users (under 10K followers) get immediate push delivery; mid-tier accounts (10K-1M followers) get pushed in batches at lower priority; mega-celebrities (over 1M followers) are never pushed and are always fetched at read time. On the read side, the Feed Service keeps a short list of "celebrity followees" (about 5-20) per user, and on each feed load it pulls their recent posts and merges them with the pre-built cache.',
      diagram: {
        mermaid: `flowchart TD
  newTweet[New tweet posted]:::client
  check{Follower count?}:::compute
  push[["Fan-out on WRITE"]]:::async
  skip[Skip push - fetched at read time]:::compute

  newTweet --> check
  check -->|"< 10K"| push
  check -->|"> 10K"| skip`,
      },
    },
    {
      title: 'Feed Ranking',
      problem:
        'A purely time-ordered feed is easy to build, but it produces weaker engagement because users miss important posts published while they were inactive (e.g. overnight while sleeping).',
      simpleTerms:
        'If your feed is strictly newest-first, you miss important posts that happened while you were asleep. The feed needs to surface content you\'d actually find interesting, not just the newest content.',
      bad: 'Rank purely by recency - a strict reverse-chronological feed. Simple, but users miss high-value posts that happened while they were offline.',
      good:
        'Score each candidate post with a weighted sum of signals: freshness (newer scores higher), engagement (likes/retweets/replies), social closeness (does this user actually interact with the poster), and content type (media-bearing posts weighted above text-only). Score = w1 * freshness + w2 * engagement + w3 * social_closeness + w4 * content_type. A fixed weighted sum like this is acceptable for interview purposes.',
      great:
        "In production, Twitter historically used an ML ranking model (known as Earlybird) rather than a hand-picked linear weighted sum - the weights themselves are learned and continuously retrained from engagement outcomes, and the model can incorporate far more than four signals. Framing it this way in an interview - weighted sum as the practical baseline, learned model as the production evolution - shows awareness of where the simple formula tops out.",
      diagram: {
        mermaid: `flowchart LR
  candidate[Tweet candidate]:::compute
  fresh[Freshness]:::compute
  eng[Engagement]:::compute
  social[Social closeness]:::compute
  content[Content type]:::compute
  final[["Final score = weighted sum"]]:::compute

  candidate --> fresh --> final
  candidate --> eng --> final
  candidate --> social --> final
  candidate --> content --> final`,
      },
    },
    {
      title: 'Timeline Cache Design (Redis Sorted Set)',
      problem:
        "Each user's timeline needs to stay ordered by recency as new tweets constantly arrive, support fast inserts, and support fast range reads for the feed page - at a footprint of hundreds of millions of timelines.",
      simpleTerms:
        "You need a place to keep each user's feed in order, add new tweets to it cheaply, and read the top 50 quickly - for hundreds of millions of users at once.",
      bad: "Store each user's timeline as an unordered list or plain rows in a database and re-sort on every read - no structure keeps it ordered as new tweets arrive, so every read pays a sort cost.",
      good: 'Use a Redis Sorted Set per user: ZADD inserts a new tweet ID in O(log N), ZREVRANGE retrieves the latest 50 entries in O(log N + 50), and ZREMRANGEBYRANK trims the set down to the latest 800 entries so it never grows unbounded.',
      great:
        'Plan capacity and handle cold users explicitly: with 500M users each storing 800 tweet IDs at 8 bytes per entry, total memory need is roughly 3.2TB, spread across a Redis cluster of 100+ nodes. For a user who hasn\'t opened the app in weeks, skip maintaining their timeline at all - fall back to assembling their feed on read by pulling recent posts from everyone they follow, building a fresh timeline, and caching it ("lazy population") for next time.',
    },
    {
      title: 'Real-Time Feed Updates',
      problem:
        "A user is actively viewing their feed when someone they follow publishes a new tweet. Should that content be inserted into the feed instantly, or handled some other way, without disrupting the reading session?",
      simpleTerms:
        "You're scrolling your feed. A new tweet appears from someone you follow. Should it pop in immediately (disrupting your reading) or show a \"new tweets\" banner?",
      bad: 'Polling: the client checks the server for new content on a fixed interval (roughly every 30 seconds). Simple, but wastes resources on repeated requests that usually find nothing new.',
      good: 'Long polling: the client keeps a request open and the server only responds once new content actually becomes available, cutting down on wasted round-trips compared to fixed-interval polling.',
      great:
        "WebSocket/SSE: the server proactively pushes new tweet IDs to already-connected clients, enabling real-time delivery without repeated asking. In practice Twitter doesn't auto-inject new content - the client subscribes over a WebSocket to a channel that the fan-out process also publishes to, and connected clients get a notification (e.g. \"3 new tweets\") that renders as a \"New tweets available\" banner at the top of the feed, requiring a click before the new posts load - deliberately avoiding disrupting the user's current reading position.",
    },
  ],

  selfAudit: [
    {
      question: 'How do you build the feed?',
      answer: 'A hybrid fan-out approach: push updates for regular users, and pull (fetch on demand) for celebrity accounts.',
    },
    {
      question: "Where's the timeline stored?",
      answer: "Each user's timeline lives in a Redis sorted set, holding tweet IDs scored by their timestamp.",
    },
    {
      question: 'How do you handle celebrities?',
      answer: "Instead of pushing a celebrity's tweet out to tens of millions of followers, their tweets are merged into the feed at read time.",
    },
    {
      question: 'How do you rank?',
      answer: 'A weighted score combining freshness, engagement, and social closeness (see Feed Ranking deep dive).',
    },
    {
      question: 'What about real-time?',
      answer: 'A WebSocket connection shows a "new tweets available" banner rather than automatically injecting new posts into the feed.',
    },
    {
      question: 'Storage for tweets?',
      answer: 'Tweets are stored in Cassandra or DynamoDB, partitioned by tweet ID, treated as immutable, and replicated.',
    },
    {
      question: 'Social graph storage?',
      answer: 'The follow graph is an adjacency list in Redis or a dedicated graph database: followers:{userId} -> Set<userId>.',
    },
    {
      question: "What's the read latency?",
      answer: 'Target is P99 < 200ms, achieved via the pre-built cache, followed by hydration and ranking steps.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  users[Users]:::client
  gw[API Gateway - auth, rate-limit]:::edge
  tweetSvc[Tweet Service]:::compute
  feedSvc[Feed Service]:::compute
  rankSvc[Ranking Service - ML model]:::compute
  fanout[Fan-out Workers]:::async
  store[("Tweet Store - Cassandra")]:::database
  graph_[("Social Graph")]:::database
  cache[("Timeline Cache - Redis Sorted Sets")]:::cache
  kafka[["Kafka - tweet events"]]:::async
  media[("Media - S3 + CDN")]:::storage

  users -->|"POST / GET"| gw
  gw -->|"Forward to tweet svc"| tweetSvc
  gw -->|"Forward to feed svc"| feedSvc
  tweetSvc -->|"Persist tweet"| store
  tweetSvc -->|"Store media file"| media
  tweetSvc -->|"Publish tweet event"| kafka
  kafka -->|"Process tweet event"| fanout
  fanout -->|"Lookup followers"| graph_
  fanout -->|"Prepend to follower feeds"| cache
  feedSvc -->|"Read pre-built feed"| cache
  feedSvc -->|"Hydrate tweet details"| store
  feedSvc -->|"Rank by relevance"| rankSvc`,
  },

  keyTechnologies: [
    {
      term: 'Fan-out',
      definition:
        'Distributing a single event (a new tweet) to many recipients. Write-time fan-out pushes content as soon as it is created; read-time fan-out assembles it only when a user requests their feed.',
    },
    {
      term: 'Redis Sorted Set',
      definition: 'A structure holding elements with numeric scores, letting the system efficiently pull the top entries - ideal for the latest N posts.',
    },
    { term: 'Social Graph', definition: 'The who-follows-whom network, typically stored as adjacency lists, queried to fetch e.g. all followers of an account.' },
    { term: 'Kafka', definition: 'A streaming platform for events; tweet-creation events flow through it so background workers can process fan-out asynchronously.' },
    { term: 'Cassandra', definition: 'A wide-column NoSQL database suited for heavy write loads and per-user partitioning; used for durable tweet storage.' },
    { term: 'CDN', definition: 'A content delivery network that serves media assets (images, video) from servers geographically near the end user.' },
    { term: 'Hydration', definition: 'Turning a list of bare IDs into complete objects - e.g. expanding tweet IDs into full tweet records with text, likes, and media links.' },
  ],

  expectedDepth: {
    mid: "Deliver a functional design covering tweet storage and simple feed construction. Recognize that assembling feeds via SQL joins won't scale, and - with some guidance - suggest precomputing timelines (write-time fan-out) so reading a feed becomes a cache lookup instead of a heavy multi-table query.",
    senior:
      'Independently explain the tradeoff between write-time and read-time fan-out, and propose a hybrid model where accounts over 10K followers skip push-based fan-out and get merged in at read time instead. Be comfortable discussing Redis sorted sets or Cassandra as the timeline cache, and clearly explain the celebrity scaling problem - why pushing to 50M followers per tweet is untenable.',
    staffPlus:
      'Weigh ranked feeds against strict chronological ordering and describe the ML pipeline needed for relevance scoring. Address live feed updates (new content appearing without a manual refresh, via WebSocket/SSE), how tweet deletions propagate through already-cached timelines, and the operational burden of fan-out at massive scale - e.g. 500M users each following 400 accounts producing roughly 200 billion cache writes/day. Cover cache eviction for dormant users as well.',
  },

  keyTakeaways: [
    'Precomputing feeds at write time turns feed reads into near-instant lookups instead of expensive on-demand assembly',
    'Celebrity accounts (over 500K followers) bypass push-based fan-out entirely - their posts merge into feeds only when read',
    'Kafka decouples the act of posting a tweet from the downstream work of distributing it into follower feeds',
    'Redis holds the active-user timelines to keep read latency low, with lazy rebuilds for dormant users',
  ],

  relatedDesigns: ['chat-system', 'notification-system', 'real-time-leaderboard'],
  relatedConcepts: [
    { name: 'Fan-Out Patterns', description: 'Pushes each new tweet into follower timelines (fan-out-on-write), with a pull path for celebrities.' },
    { name: 'Caching', description: 'Precomputed timelines live in Redis for millisecond reads.' },
    { name: 'Database Sharding', description: 'Partitions tweets and timelines across nodes to handle write volume.' },
    { name: 'CDN', description: 'Serves attached images and video close to the viewer.' },
  ],

  simulator: {
    goalDescription:
      'Build a personalized home feed for hundreds of millions of users by fanning out new posts into follower timelines, merging celebrity posts in at read time.',
    requirementChips: ['Feed read P99 < 200ms', '100K RPS feed reads', 'Hybrid fan-out for celebrities'],
    targetRps: 100000,
    readRatio: 0.94,
    cacheHitRatio: 0.8,
    latencyBudgetMsP99: 200,
    rubric: [
      { id: 'api-gateway-entry', label: 'API Gateway at the edge (auth + rate limiting)', kind: 'requires-node-type', nodeType: 'api-gateway' },
      { id: 'event-bus', label: 'Event bus decoupling posting from fan-out', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'timeline-cache', label: 'Pre-built timeline cache (Redis Sorted Set)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'durable-store',
        label: 'Durable tweet store',
        kind: 'requires-node-type',
        nodeType: ['cassandra', 'dynamodb', 'mongodb'],
      },
      {
        id: 'compute-tier',
        label: 'Compute tier for tweet + feed services',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 16, position: { x: 600, y: 200 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 280 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 24, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
        { id: 'e-kafka-redis', source: 'kafka-1', target: 'redis-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-cass', source: 'app-1', target: 'cassandra-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Fan-out-on-write pushes new posts into follower timelines in Redis sorted sets via Kafka-driven workers; a feed read is one ZREVRANGE plus a hydration batch-get from Cassandra. Celebrity accounts skip fan-out and are merged in at read time.',
    failureModeNarratives: {
      'api-gateway': 'Only one API Gateway instance sits on every read and write path; if it goes down, both posting and feed reads fail at once.',
    },
    fullDesignLinkSlug: 'social-feed',
  },
}

export default topic
