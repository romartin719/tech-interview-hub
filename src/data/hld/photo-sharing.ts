import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'photo-sharing',
  title: 'Photo Sharing (Instagram / Pinterest)',
  difficulty: 'Intermediate',
  icon: 'pi pi-image',
  color: '#ec4899',
  readTimeMinutes: 25,
  topics: ['CDN', 'Object Storage', 'Fan-out', 'Media Processing', 'Feed Ranking'],
  companies: ['Meta', 'Pinterest', 'Snap', 'Google', 'Amazon'],
  prerequisites: ['CDN', 'Caching', 'Fan-Out'],
  summary:
    'A globally distributed photo and video platform that decouples upload from processing, uses hybrid fan-out to build personalized feeds, and serves media through a multi-tier CDN to hundreds of millions of daily users.',

  understandingProblem:
    'Instagram is a photo and video sharing platform where users upload media, follow other users, and consume a personalized feed of content. The system must handle billions of photo uploads, deliver images globally with low latency via CDN, and generate personalized feeds for hundreds of millions of users. The key challenges are: efficiently processing and storing media at scale, generating feeds without overwhelming the system, and delivering images fast regardless of user location.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Mobile App]:::client
  api[API Server]:::compute
  pg[("Postgres DB")]:::database
  disk[("Local Disk Storage")]:::storage

  client --> api
  api --> pg
  api --> disk`,
    },
    whyThisBreaks: [
      "Local disk storage can't serve images globally - users in Tokyo wait 2+ seconds for images stored in US-East",
      "Single API server becomes bottleneck during upload spikes (New Year's Eve, live events)",
      'No image resizing - phones download 12MP originals on 3G connections',
      'Feed generation via `SELECT * FROM posts WHERE user_id IN (following) ORDER BY time` kills the DB at scale',
      'No caching layer - every feed request hits the database',
      'Celebrity posts (100M followers) create thundering herd on reads',
    ],
    closingNote:
      'The rest of the doc evolves this into a globally distributed media platform with CDN delivery and intelligent feed generation.',
  },

  priorArt: [
    {
      title: 'Instagram Engineering (Cassandra for Feed Storage)',
      description:
        'Moved from Redis to Cassandra for feed storage to handle 500M+ users. Uses a hybrid fan-out approach (write for normal users, read for celebrities). (Instagram Engineering blog)',
      link: 'https://instagram-engineering.com/open-sourcing-a-10x-reduction-in-apache-cassandra-tail-latency-d64f86b43589',
    },
    {
      title: 'Facebook TAO (Social Graph Cache)',
      description:
        'Distributed graph-aware cache serving billions of queries/sec for social relationships. Demonstrates that the social graph must be cached separately from content. (Facebook TAO paper)',
      link: 'https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf',
    },
    {
      title: 'Flickr Architecture (Image Serving)',
      description:
        'Pioneered the multi-tier image serving pattern: upload -> process -> store in object storage -> serve via CDN. Proved that separating upload and serving paths is essential. (Flickr architecture talk)',
      link: 'https://highscalability.com/flickr-architecture/',
    },
    {
      title: 'Pinterest Image Processing Pipeline',
      description:
        'Async image processing with multiple resolution generation, perceptual hashing for deduplication, and progressive JPEG delivery. (Pinterest Engineering blog)',
    },
    {
      title: 'Twitter Fan-out Service',
      description:
        'Demonstrates the fan-out-on-write vs fan-out-on-read tradeoff at scale. Twitter hybrid approach handles celebrities differently from normal users.',
      link: 'http://highscalability.com/blog/2013/7/8/the-architecture-twitter-uses-to-deal-with-150m-active-users.html',
    },
  ],

  coreEntities: [
    { name: 'User', description: 'Profile info, follower count, following count, settings.' },
    { name: 'Post', description: 'Media URL, caption, location, timestamp, author.' },
    { name: 'Feed', description: "Ordered list of post IDs for a user's home timeline." },
    { name: 'Follow', description: 'Directed edge from follower to followee.' },
    { name: 'Media', description: 'Physical file metadata: S3 key, dimensions, format, sizes generated.' },
    { name: 'Like', description: 'User + post association with timestamp.' },
  ],

  requirements: {
    core: [
      'Upload photos and videos - users can upload media with captions, apply filters, and tag locations',
      'View personalized feed - users see a ranked feed of posts from people they follow',
      'Follow and unfollow users - build a social graph that drives feed generation',
    ],
    belowTheLine: [
      'Stories (24-hour ephemeral content)',
      'Direct messages',
      'Comments and likes',
      'Explore/discovery page',
      'Reels (short-form video)',
      'Image deduplication (nice-to-have, saves storage cost)',
      'Multi-region disaster recovery',
      'Content moderation pipeline',
    ],
    nonFunctionalTable: [
      { metric: 'Feed Latency', target: 'Feed load < 500ms P95 globally' },
      { metric: 'Upload Latency', target: 'Photo upload completes < 3 seconds (user sees confirmation)' },
      { metric: 'Availability', target: '99.99% - users expect Instagram to always be up' },
      { metric: 'Scale', target: '2B monthly active users, 100M+ photos uploaded daily' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Object Storage',
      purpose: 'Original and resized image/video files',
      primaryPick: 'S3',
      alternatives: 'GCS, Azure Blob',
      whyPrimaryWins: 'Write-once, read-many, 11-nines durable - the origin every CDN edge falls back to on a cache miss',
    },
    {
      tier: 'CDN',
      purpose: 'Global image delivery',
      primaryPick: 'CloudFront',
      alternatives: 'Cloudflare, Fastly, Akamai',
      whyPrimaryWins: 'Immutable image URLs cache at 200+ edge PoPs with a 1-year TTL, cutting egress cost roughly 4x versus serving directly from S3',
    },
    {
      tier: 'Feed Store',
      purpose: 'Pre-computed, ordered post IDs per user',
      primaryPick: 'Cassandra',
      alternatives: 'ScyllaDB, DynamoDB',
      whyPrimaryWins: "Feed reads are sequential range scans and fan-out writes spike hard - Cassandra's write-optimized LSM-tree absorbs that load where Postgres would choke on write amplification",
    },
    {
      tier: 'Post Metadata DB',
      purpose: 'Captions, tags, structured post data',
      primaryPick: 'Postgres (sharded by user)',
      alternatives: 'CockroachDB, Vitess',
      whyPrimaryWins: 'Indexed, relational queries for profile and post lookups without the operational overhead of a wide-column store for comparatively low-volume metadata',
    },
    {
      tier: 'Social Graph DB',
      purpose: 'Follower/following edges',
      primaryPick: 'Redis Cluster (adjacency sets)',
      alternatives: 'Neo4j, TAO-style cache',
      whyPrimaryWins: '"Does A follow B?" runs on nearly every feed request, like, and comment - Redis SISMEMBER answers in microseconds at 2B-user scale',
    },
    {
      tier: 'Event Bus',
      purpose: 'Upload-processed and fan-out events',
      primaryPick: 'Kafka',
      alternatives: 'Redpanda, Kinesis',
      whyPrimaryWins: 'Decouples media processing from feed fan-out so a slow resize job never blocks delivery to followers',
    },
  ],
  technologyChoicesNote:
    "Why Cassandra over Postgres for the feed store? Feed reads are sequential range scans and writes spike hard during fan-out to millions of followers - Cassandra's write-optimized structure handles that where Postgres would choke on write amplification. Why Redis over the primary database for the social graph? Follow checks run on nearly every read in the app, so pushing that lookup into Redis keeps it at microsecond latency instead of contending with the same database that also serves post metadata.",

  scaleEstimation: [
    'Users: 2B MAU, 500M DAU, 50M feed loads/day at peak',
    'Write QPS: 400M resize ops/day (100M photos/day x 4 variants = ~4,600 resize ops/sec sustained)',
    "In simple terms: 100M photos per day means 200TB of new storage every day. At S3 prices, that's millions per month. We need tiered storage - hot photos on fast storage, old ones on cheap storage.",
    'Read QPS: 50M feed loads/day peak = ~580K feed reads/sec + image CDN requests',
    'Storage: ~200TB new storage/day before dedup (100M photos x 4 variants x 500KB avg)',
    'Bandwidth: ~15 Tbps at peak (500M users x avg 10 images/session x 200KB per image)',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/api/v1/posts',
      description:
        "Upload a new photo/video post. Returns immediately; media processing happens async.",
      example:
        '// Body (multipart)\n{ mediaFile, caption, location?, tags[]? }\n\n// Response\n{ postId, mediaUrl, status: "PROCESSING", timestamp }\n\n// Auth: JWT Bearer token',
    },
    {
      method: 'GET',
      path: '/api/v1/feed?cursor=<timestamp>&limit=20',
      description: 'Cursor-based pagination for infinite scroll through the personalized feed.',
      example:
        '// Response\n{ posts: [{ postId, authorId, mediaUrls, caption, likes, timestamp }], nextCursor }',
    },
    {
      method: 'POST',
      path: '/api/v1/users/{userId}/follow',
      description: 'Follow a user.',
      example: '// Response\n{ status: "FOLLOWING", timestamp }',
    },
    {
      method: 'DELETE',
      path: '/api/v1/users/{userId}/follow',
      description: 'Unfollow a user.',
      example: '// Response\n{ status: "UNFOLLOWED" }',
    },
    {
      method: 'GET',
      path: '/api/v1/users/{userId}/profile',
      description: "Fetch a user's profile.",
      example:
        '// Response\n{ userId, username, bio, postCount, followerCount, followingCount, posts[] }',
    },
  ],

  highLevelDesignIntro: "Let's build this incrementally, one functional requirement at a time.",

  builds: [
    {
      title: 'FR1: Upload Photos and Videos',
      body:
        'When a user takes a photo and hits "Share," we need to store the image, process it into multiple sizes, and make it available globally. The key insight: don\'t make the user wait for processing. Accept the upload, confirm immediately, process in the background.',
      newComponents: [
        {
          name: 'API Gateway',
          description:
            'Handles auth, rate limiting, routes requests. For uploads, it streams the file directly to object storage (not through the app server - avoids memory pressure).',
        },
        {
          name: 'Upload Service',
          description:
            'Validates the upload, generates a unique media ID, writes metadata to DB, and triggers async processing.',
        },
        {
          name: 'Object Storage (S3)',
          description: 'Stores the original image. Write-once, read-many. Durable (11 nines).',
        },
        {
          name: 'Media Processing Workers',
          description:
            'Consume from a queue, generate thumbnails (150px, 320px, 640px, 1080px), compress, strip EXIF data, and write variants back to S3.',
        },
        {
          name: 'Processing Queue (Kafka or SQS)',
          description: 'Decouples upload from processing. If workers are busy, uploads still succeed.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  app[Mobile App]:::client
  gw[API Gateway]:::edge
  us[Upload Service]:::compute
  s3[("S3 Object Store")]:::storage
  q[Processing Queue]:::async
  mw[Media Workers]:::compute
  db[("Post Metadata DB")]:::database

  app -->|"1. Upload photo"| gw
  gw -->|"2. Forward to upload svc"| us
  us -->|"3. Upload to storage"| s3
  us -->|"4. Save post metadata"| db
  us -->|"5. Publish new post event"| q
  q -->|"6. Process media variants"| mw
  mw -->|"7. Store processed image"| s3`,
      },
      steps: [
        'User selects photo, adds caption, hits "Share" -> app uploads file via multipart POST to Gateway',
        'Gateway authenticates user, checks file size limits (max 50MB), streams file to Upload Service',
        'Upload Service generates a unique mediaId, uploads original to S3 at path originals/{userId}/{mediaId}.jpg',
        'Upload Service writes post metadata to DB (postId, userId, caption, mediaId, status=PROCESSING)',
        'Upload Service publishes a media.uploaded event to Processing Queue with mediaId and S3 path',
        "User gets 201 Created with postId - upload is confirmed, processing hasn't started yet",
        'Media Worker picks up the job: downloads original from S3, generates 4 size variants, converts to WebP, uploads variants to S3 at processed/{mediaId}/{size}.webp',
        'Worker updates post status to PUBLISHED and triggers feed fan-out',
      ],
    },
    {
      title: 'FR2: View Personalized Feed',
      body:
        'Feed is the core experience. When a user opens Instagram, they need to see recent posts from people they follow, ranked by relevance. The challenge: a user following 500 people needs their feed assembled from 500 sources.\n\nTwo approaches: fan-out-on-write (pre-compute everyone\'s feed when a post is created) vs fan-out-on-read (assemble the feed on demand). We use a hybrid - borrowing from Twitter and Instagram\'s actual approach.',
      insightCallout:
        "Why Cassandra for the feed store, not Postgres? Feed reads are sequential (give me the next 20 posts) and writes are massive during fan-out (one post fans out to millions of follower feeds). Cassandra's write-optimized LSM-tree and partition-key access pattern (userId -> sorted posts) is perfect. Postgres would choke on the write amplification.",
      newComponents: [
        {
          name: 'Feed Service',
          description:
            'Serves feed requests. Reads from pre-computed feed store for normal users, merges in celebrity posts on-read.',
        },
        {
          name: 'Fan-out Service',
          description:
            "When a post is published, pushes the postId to all followers' feeds (Cassandra). Skips celebrities (>500K followers).",
        },
        {
          name: 'Feed Store (Cassandra)',
          description: 'Each user has a feed partition: sorted list of postIds. Feed Service reads top N.',
        },
        {
          name: 'CDN',
          description: 'Serves actual images. Feed Service returns URLs; the app fetches images from CDN edge nodes.',
        },
        {
          name: 'Redis Feed Cache',
          description: 'Caches the top 200 posts for active users. Avoids hitting Cassandra on every scroll.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  app[Mobile App]:::client
  gw[Gateway]:::edge
  fs[Feed Service]:::compute
  fc[("Redis Feed Cache")]:::cache
  cass[("Cassandra Feed Store")]:::database
  cdn[CDN Edge]:::edge
  s3[("S3 Images")]:::storage
  fo[Fan-out Service]:::compute
  kf[Kafka]:::async

  app -->|"1. GET user feed"| gw
  gw -->|"2. Forward to feed svc"| fs
  fs -->|"3. Lookup cached feed"| fc
  fs -->|"4. Fetch feed from store"| cass
  app -->|"5. Load images"| cdn
  cdn -->|"6. Fetch origin"| s3
  kf -->|"7. Fan out new posts"| fo
  fo -->|"8. Write to follower feeds"| cass`,
      },
      steps: [
        'User opens app -> GET /feed?cursor=&limit=20 hits Feed Service',
        'Feed Service checks Redis cache for user\'s feed. Cache hit -> return immediately',
        'Cache miss -> query Cassandra feed partition for user (SELECT postIds WHERE userId=X ORDER BY timestamp DESC LIMIT 20)',
        'Feed Service enriches postIds with metadata (author name, caption, like count) from Post Metadata DB',
        'For celebrities the user follows (pre-flagged in social graph), Feed Service fetches their recent posts on-the-fly and merges into the sorted feed',
        'Response includes CDN URLs for each image variant (thumbnail for preview, full-res for detail view)',
        'App renders feed; each image <img src> points to CDN edge -> CDN serves from cache or fetches from S3 origin',
      ],
      closingNote:
        "Why hybrid fan-out? Pure fan-out-on-write: when a celebrity with 100M followers posts, we'd write 100M rows to Cassandra. That's 100M writes per post - expensive and slow. Instead, we skip fan-out for celebrities and merge their posts at read time. This is the \"celebrity problem\" fix.",
    },
    {
      title: 'FR3: Follow and Unfollow Users',
      body:
        "The social graph drives everything - feed generation, suggestions, notifications. When user A follows user B, we need to update the graph and backfill A's feed with B's recent posts.",
      insightCallout:
        'Why Redis for the social graph, not the main DB? "Does user A follow user B?" is called on every feed request, every like, every comment. At 2B users, this needs sub-millisecond latency. Redis SET operations (SISMEMBER) answer this in microseconds.',
      newComponents: [
        {
          name: 'Social Graph Service',
          description:
            'Manages follow/unfollow operations. Stores bidirectional edges (A follows B, B is followed by A).',
        },
        {
          name: 'Graph Store (Redis Sets)',
          description:
            'following:{userId} = set of users they follow. followers:{userId} = set of their followers. O(1) membership check.',
        },
        {
          name: 'Feed Backfill Worker',
          description: "When A follows B, fetches B's last 10 posts and inserts into A's feed in Cassandra.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  app[App]:::client
  gw[Gateway]:::edge
  sgs[Social Graph Service]:::compute
  rg[("Redis Graph Store")]:::cache
  db[("Graph DB Backup")]:::database
  kf[Kafka]:::async
  bf[Backfill Worker]:::compute
  cass[("Feed Store")]:::database

  app -->|"1. POST generate story"| gw
  gw -->|"2. Forward to stories svc"| sgs
  sgs -->|"3. Lookup viewer set"| rg
  sgs -->|"4. Save story metadata"| db
  sgs -->|"5. Publish story event"| kf
  kf -->|"6. Backfill follower feeds"| bf
  bf -->|"7. Write to feed store"| cass`,
      },
      steps: [
        'User A taps "Follow" on User B\'s profile -> POST /users/{B}/follow',
        'Social Graph Service adds B to following:A set in Redis, adds A to followers:B set',
        'Service persists the edge to durable Graph DB (Postgres) as backup - Redis is fast but volatile',
        'Service publishes user.followed event to Kafka',
        "Backfill Worker consumes event: fetches B's last 10 posts, inserts postIds into A's Cassandra feed partition",
        "A's next feed refresh shows B's recent posts mixed in chronologically",
        "On unfollow: remove from Redis sets, publish user.unfollowed event. A lazy cleanup job removes B's posts from A's feed (or they just age out naturally)",
      ],
    },
  ],

  coreFlows: [
    {
      title: 'Photo Upload End-to-End',
      diagram: {
        mermaid: `sequenceDiagram
  participant User
  participant GW as API Gateway
  participant US as Upload Service
  participant S3 as Object Storage
  participant DB as Post Metadata DB
  participant Queue as Processing Queue
  participant MW as Media Worker
  participant FO as Fan-out Service
  participant CASS as Feed Store

  User->>GW: POST /posts (multipart image + caption)
  GW->>GW: Auth + rate limit + file size check
  GW->>US: Forward upload
  US->>S3: Upload original image
  S3-->>US: 200 OK (S3 key)
  US->>DB: INSERT post (status=PROCESSING)
  US-->>User: 201 Created (postId)
  US->>Queue: Publish media.uploaded
  Queue->>MW: Consume job
  MW->>S3: Download original
  MW->>MW: Resize to 4 variants + WebP convert
  MW->>S3: Upload processed variants
  MW->>DB: UPDATE post status=PUBLISHED
  MW->>Queue: Publish post.published
  Queue->>FO: Consume post.published
  FO->>CASS: Write postId to all follower feeds`,
      },
      nonObviousFailure:
        'If Media Worker crashes mid-processing, the job stays on the queue (visibility timeout). After timeout, another worker picks it up. Idempotent processing (check if variants already exist in S3 before re-generating) prevents duplicates. Posts stuck in PROCESSING > 10 minutes are flagged by a reconciler and re-queued.',
    },
    {
      title: 'Feed Load',
      diagram: {
        mermaid: `sequenceDiagram
  participant User
  participant FS as Feed Service
  participant Redis as Feed Cache
  participant CASS as Cassandra
  participant Meta as Post Metadata DB
  participant CDN

  User->>FS: GET /feed?cursor=X&limit=20
  FS->>Redis: Check cache (feed:userId:page)
  alt Cache hit
    Redis-->>FS: Return cached postIds
  else Cache miss
    FS->>CASS: SELECT postIds WHERE userId=X LIMIT 20
    CASS-->>FS: PostIds
    FS->>Redis: Cache for 60s
  end
  FS->>Meta: Batch fetch post metadata
  Meta-->>FS: Posts with CDN URLs
  FS-->>User: Feed response with image URLs
  User->>CDN: Fetch images (parallel)
  CDN-->>User: Images from edge cache`,
      },
      nonObviousFailure:
        'If Cassandra is temporarily down, Feed Service falls back to assembling the feed on-the-fly by querying the social graph (who does this user follow?) and then fetching recent posts from each followed user\'s partition. Slower (2-3s) but keeps the app functional.',
    },
    {
      title: 'Post Lifecycle State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> UPLOADING : User selects media
  UPLOADING --> PROCESSING : Upload complete
  PROCESSING --> PUBLISHED : Variants generated
  PROCESSING --> FAILED : Worker error
  FAILED --> PROCESSING : Retry
  PUBLISHED --> ARCHIVED : User deletes
  PUBLISHED --> FLAGGED : Moderation trigger
  FLAGGED --> REMOVED : Violation confirmed
  FLAGGED --> PUBLISHED : Appeal approved`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Media Upload and Processing Pipeline',
      problem:
        "A user uploads a photo. Resizing it into multiple resolutions, compressing it, and stripping metadata takes real processing time - the question is whether the user has to wait for any of that work to finish before their upload is confirmed.",
      simpleTerms:
        'User uploads a photo. Should we make them wait 15 seconds while we resize it to 5 different sizes? No - accept the upload instantly, process in the background.',
      bad:
        'Process images synchronously during upload - user waits 15+ seconds while server resizes, compresses, and uploads variants. Timeouts on slow connections cause lost uploads.',
      good:
        'Accept upload, store original, process asynchronously. Notify user when done. But: single worker processes all images serially - backlog grows during peak hours.',
      great:
        'Multi-stage pipeline with auto-scaling worker pools:\n\n1. Upload stage: Client uploads to a pre-signed S3 URL directly (bypasses API server entirely for large files). Upload Service just validates and records metadata.\n2. Processing stage: Worker pool auto-scales based on queue depth. Each worker: download -> resize (150, 320, 640, 1080px) -> convert to WebP -> strip EXIF -> upload variants -> update DB.\n3. Optimization: Generate progressive JPEGs so images render top-to-bottom even on slow connections. Store a tiny 20px blurred placeholder (BlurHash) in the post metadata for instant feed skeleton rendering.\n\nCost consideration: Processing 100M images/day at 4 variants each = 400M resize operations. GPU-accelerated workers (using libvips, not ImageMagick) cut processing time from 2s to 200ms per image. Auto-scaling down during off-peak saves 60% compute cost.',
      diagram: {
        mermaid: `flowchart TD
  client[Client]:::client
  us[Upload Service]:::compute
  s3o[("S3 Originals")]:::storage
  q[SQS Queue]:::async
  w[Worker Pool]:::compute
  s3p[("S3 Processed")]:::storage
  cdn[CDN]:::edge

  client -->|"1. Get pre-signed URL"| us
  client -->|"2. Upload directly to S3"| s3o
  us -->|"3. Enqueue processing job"| q
  q -->|"4. Pick job"| w
  w -->|"5. Download original"| s3o
  w -->|"6. Resize + compress + store"| s3p
  s3p -->|"7. Serve via CDN"| cdn`,
      },
    },
    {
      title: 'Feed Generation - Fan-out on Write vs Read',
      problem:
        "Generating a personalized feed for a user following hundreds of accounts means assembling posts from many sources - the question is whether to do that assembly at post time (fan-out-on-write) or at read time (fan-out-on-read), since each choice has a different scaling failure mode.",
      simpleTerms:
        "When you open Instagram, should the app go ask 500 different users 'got any new posts?' That's too slow. Better to pre-build your feed ahead of time.",
      bad:
        "Fan-out-on-read only - every feed request queries 500 users' posts, sorts, ranks. At 100M DAU opening feeds simultaneously, this is billions of queries per minute.",
      good:
        "Fan-out-on-write - when user posts, push postId to all followers' feeds (Cassandra write). Feed reads become a single partition scan. But: celebrities with 100M followers generate 100M writes per post.",
      great:
        "Hybrid approach (borrowing from Instagram and Twitter):\n\n- Normal users (< 500K followers): Fan-out-on-write. When they post, Fan-out Service writes their postId to all followers' feed partitions.\n- Celebrity users (> 500K followers): Skip fan-out. Feed Service merges their recent posts at read time. Since users follow only ~5-10 celebrities, merging 10 extra queries is acceptable.\n- Feed ranking: After assembling candidates, a lightweight ML ranker scores posts by: recency (decay function), engagement signals (likes from mutual friends), content type preference, and relationship strength.\n\nHow Fan-out Service handles scale:\n\n- Kafka partitions fan-out events by postId -> single consumer per post\n- Consumer reads follower list from Redis (SMEMBERS followers:{userId})\n- Batches writes to Cassandra (1000 rows per batch, async)\n- For 10K followers, fan-out completes in < 2 seconds\n- Rate limiter ensures no single post's fan-out starves others",
    },
    {
      title: 'CDN and Image Optimization',
      problem:
        "Serving images from a single origin region means every request - regardless of the requester's location - has to cross the globe to fetch bytes, which is both slow and expensive at Instagram's scale.",
      simpleTerms:
        'If every image request goes to one server in the US, users in India wait 300ms. CDN puts copies of popular images close to users worldwide.',
      bad:
        'Serve all images from origin S3 directly - high latency for distant users (300ms+ for cross-continent), massive egress costs, origin overwhelmed.',
      good:
        'Put CloudFront/Cloudflare in front of S3 - cache at edge nodes. But: cache misses on first access, no adaptive quality based on connection speed.',
      great:
        'Multi-layer CDN strategy with client-driven quality selection:\n\n1. Edge caching (CDN): Images cached at 200+ PoPs globally. TTL = 1 year (images are immutable - new upload = new URL). Cache hit ratio > 95% for popular content.\n2. Client-driven quality: App detects network speed and requests appropriate variant: cdn.instagram.com/media/{id}/w640.webp vs w1080.webp. Saves bandwidth on slow connections.\n3. Progressive loading: Feed shows BlurHash placeholder instantly -> low-res thumbnail loads in 50ms -> full resolution lazy-loads as user scrolls.\n4. Regional origin shields: Secondary cache layer between CDN edge and S3 origin. Reduces origin requests by another 80%.\n\nCost at scale: Serving 2B users, ~50 images/session, ~200KB avg = 20PB egress/month. CDN with committed-use discount: ~$0.02/GB = $400K/month. Without CDN (direct from S3 at $0.09/GB) = $1.8M/month. CDN pays for itself 4x over.',
    },
    {
      title: 'Celebrity / Hot User Problem',
      problem:
        "When a celebrity (100M followers) posts, naive fan-out means 100M Cassandra writes. At 10 celebrity posts/hour, that's 1B writes/hour just for fan-out - unsustainable.",
      simpleTerms:
        "Cristiano Ronaldo posts a photo. If we try to add it to 100M people's feeds instantly, that's 100M database writes. The system would crash. We need a special path for celebrities.",
      bad: 'Treat celebrities the same as everyone - fan-out to all followers. System collapses under write load.',
      good:
        'Skip fan-out entirely for celebrities. Merge their posts at read time. But: feed load latency increases because we now query celebrity posts on every feed request.',
      great:
        'Tiered hybrid with intelligent caching:\n\n1. Classify users: follower_count > 500K = "celebrity." Flag in Redis graph store.\n2. Skip fan-out for celebrities: Their posts go to a special "celebrity posts" store (sharded by celebrityId, sorted by time).\n3. Feed assembly at read time: Feed Service fetches: (a) user\'s pre-computed feed from Cassandra, (b) recent posts from celebrities they follow (max 10 celebrities x 5 posts = 50 posts to merge).\n4. Cache celebrity feeds aggressively: Redis caches each celebrity\'s last 50 posts. Updated on new post. All followers read from same cache - millions of cache hits, one write.\n5. Pre-warm on post: When celebrity posts, invalidate their Redis cache entry. First reader triggers cache fill; subsequent readers hit cache.\n\nNet effect: Celebrity post = 1 write to celebrity store + 1 cache invalidation. vs. 100M writes with naive fan-out. Read overhead: +5ms per celebrity merge (parallel Redis fetches).',
    },
    {
      title: 'Feed Ranking and Relevance',
      problem:
        "Chronological feed shows everything in time order. But users follow 500 people and check the app 5x/day - they miss 80% of content. Need to surface the most relevant posts.",
      simpleTerms:
        "Showing posts purely by time means you miss the important ones posted while you slept. We need to surface the posts you'd actually care about, not just the newest ones.",
      bad: 'Pure chronological - users miss important posts from close friends buried under high-frequency posters.',
      good:
        "Simple scoring: score = recency_weight * time_decay + engagement_weight * (likes + comments). Better than chronological but doesn't personalize.",
      great:
        'Lightweight ML ranker with candidate generation + ranking stages:\n\n1. Candidate generation: Pull 500 candidate posts (pre-computed feed + celebrity merge)\n2. Feature extraction: For each candidate, compute: time since posted, author-viewer relationship strength (interaction frequency), post engagement velocity (likes/min in first hour), content type match (does viewer prefer photos or videos?)\n3. Scoring: Simple logistic regression or small neural net predicts P(engagement). Trained offline on historical engagement data. Inference < 10ms for 500 candidates.\n4. Diversity injection: After ranking, ensure no more than 3 consecutive posts from same author. Mix in "discovery" posts (from friends-of-friends) at 10% ratio.\n\nWhy not a huge ML model? Feed ranking runs on every feed load for 500M daily users. At 200M feed loads/day, even 50ms per inference = saturated GPU cluster. Keep the model small (< 1ms inference on CPU). Heavy ML is for offline training, not online serving.',
    },
    {
      title: 'Storage and Data Lifecycle',
      problem:
        "100M photos/day x 4 variants x average 500KB = 200TB new storage per day. At $0.023/GB, that's $4.6M/month in S3 Standard alone.",
      simpleTerms:
        "100M photos per day means 200TB of new storage every day. At S3 prices, that's millions per month. We need tiered storage - hot photos on fast storage, old ones on cheap storage.",
      bad: 'Keep everything in S3 Standard forever - cost grows linearly, unbounded.',
      good: 'Lifecycle policies: move to S3 Infrequent Access after 30 days, Glacier after 1 year.',
      great:
        'Intelligent tiering based on access patterns:\n\n1. Hot tier (S3 Standard): Posts < 7 days old. 80% of all accesses hit content from the last week.\n2. Warm tier (S3 IA): Posts 7-90 days old. Occasionally accessed via profile views and search.\n3. Cold tier (S3 Glacier Instant Retrieval): Posts > 90 days. Rare access but must still serve in < 100ms when profile is scrolled.\n4. Delete originals: After processed variants are confirmed, delete the original full-res upload (keep only the 1080px max). Saves 40% storage.\n5. Deduplication: Perceptual hash (pHash) on upload. If near-duplicate exists, store a reference instead of new file. Catches reposts and memes - saves ~15% storage.\n\nCost after optimization: 200TB/day -> 120TB/day (after dedup + original deletion). Tiered storage reduces effective cost from $0.023/GB to ~$0.008/GB average. Monthly storage cost drops from $4.6M to $960K.',
    },
  ],

  selfAudit: [
    {
      question: 'Dedicated search index?',
      answer:
        'Not needed for core feed. Explore/discovery (below the line) would use Elasticsearch for hashtag and location search.',
    },
    {
      question: 'Stale reads after writes?',
      answer:
        'User who just posted sees their own post immediately (read-your-writes via write-DB check). Followers see it within 2-5s (fan-out delay).',
    },
    {
      question: 'Single points of failure?',
      answer:
        'Cassandra is multi-node with RF=3. S3 is 11-nines durable. Redis is clustered. Feed Service is stateless, horizontally scaled.',
    },
    {
      question: 'Dead-letter / reconciliation?',
      answer: 'Failed media processing jobs -> DLQ with 3 retries. Reconciler scans PROCESSING posts > 10min.',
    },
    {
      question: 'Data freshness across caches?',
      answer: 'Feed cache TTL 60s + event-driven invalidation on new post. CDN images are immutable (cache forever).',
    },
    {
      question: 'Cost at scale?',
      answer:
        'S3 tiering + CDN = biggest cost drivers. Covered in the Storage and Data Lifecycle deep dive. Fan-out Cassandra writes are the hot write tier - managed via celebrity exemption.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  subgraph Clients
    mob[Mobile App]:::client
    web[Web App]:::client
  end

  subgraph Edge
    lb[Load Balancer]:::edge
    gw[API Gateway]:::edge
    cdn[CDN Edge Nodes]:::edge
  end

  subgraph Services
    us[Upload Service]:::compute
    fs[Feed Service]:::compute
    sgs[Social Graph Service]:::compute
    fo[Fan-out Service]:::compute
    mw[Media Workers]:::compute
    rank[Feed Ranker]:::compute
  end

  subgraph Async
    kf[Kafka]:::async
    pq[Processing Queue]:::async
  end

  subgraph Data
    s3[("S3 Object Store")]:::storage
    cass[("Cassandra Feed Store")]:::database
    pg[("Postgres Post Metadata")]:::database
    rd[("Redis Cluster")]:::cache
  end

  mob -->|"Open app"| lb
  web -->|"Open app"| lb
  lb -->|"Route API"| gw
  mob -->|"Load images"| cdn
  web -->|"Load images"| cdn
  cdn -->|"Fetch origin"| s3
  gw -->|"Forward to upload svc"| us
  gw -->|"Forward to feed svc"| fs
  gw -->|"Forward to stories svc"| sgs
  us -->|"Upload media"| s3
  us -->|"Save post metadata"| pg
  us -->|"Publish new post event"| pq
  pq -->|"Process media variants"| mw
  mw -->|"Store processed media"| s3
  mw -->|"Publish post ready event"| kf
  kf -->|"Fan out to followers"| fo
  fo -->|"Write to follower feeds"| cass
  fs -->|"Lookup cached feed"| rd
  fs -->|"Fetch feed from store"| cass
  fs -->|"Get prediction"| rank
  sgs -->|"Lookup viewer set"| rd
  sgs -->|"Save story metadata"| pg`,
  },

  keyTechnologies: [
    {
      term: 'CDN',
      definition:
        'Content Delivery Network caching images at 200+ global edge nodes so users fetch media from the nearest PoP in under 20ms.',
    },
    {
      term: 'Object Storage (S3)',
      definition: 'Durable blob storage (11 nines) for original and resized images - write once, serve via CDN forever.',
    },
    {
      term: 'Fan-out on Write',
      definition:
        "Pre-computing each user's feed by pushing new postIds to all followers' feed partitions at post time - feed reads become a single partition scan.",
    },
    {
      term: 'Redis Sorted Set',
      definition:
        'In-memory sorted data structure used for the social graph (follower/following sets) and hot feed caching with O(1) membership checks.',
    },
    {
      term: 'Kafka',
      definition: 'Event bus carrying upload events, fan-out triggers, and post-published signals to downstream services.',
    },
    {
      term: 'Cassandra',
      definition:
        'Write-optimized wide-column store used for pre-computed feed storage - partitioned by userId with posts sorted by timestamp.',
    },
    {
      term: 'Elasticsearch',
      definition:
        'Search engine for hashtag, location, and user search with full-text and faceted filtering (used in Explore/discovery).',
    },
  ],

  expectedDepth: {
    mid:
      'Design the upload -> process -> store flow. Understand fan-out-on-write for feed generation and why it works for most users. Propose object storage + CDN for images. With prompting, recognize the celebrity problem - that fan-out-on-write breaks when a user has 100M followers.',
    senior:
      'Propose hybrid fan-out (write for normal users, read for celebrities with >500K followers). Explain the CDN strategy with immutable URLs and aggressive TTLs. Discuss Cassandra for the feed store and why it beats Postgres for write-heavy fan-out workloads. Propose an image processing pipeline with auto-scaling workers and explain why the upload path must be async.',
    staffPlus:
      'Address storage lifecycle optimization (hot/warm/cold tiers with S3 Standard -> IA -> Glacier). Discuss the feed ranking ML pipeline - candidate generation plus a lightweight ranker that runs in <10ms. Proactively mention BlurHash for instant placeholder rendering, perceptual deduplication (pHash) for storage savings, and a full cost breakdown at scale showing how tiering reduces monthly storage from $4.6M to under $1M.',
  },

  keyTakeaways: [
    'Hybrid fan-out: write for normal users, read for celebrities (>500K followers)',
    'CDN + Object Storage for global image delivery - 95%+ cache hit ratio',
    "Async media pipeline: user doesn't wait for image processing",
    'BlurHash placeholders for instant feed skeleton rendering',
  ],

  relatedDesigns: ['social-feed', 'notification-system', 'chat-system'],
  relatedConcepts: [
    { name: 'CDN', description: 'Delivers photos and videos from edge locations near the user.' },
    { name: 'Object Storage', description: 'Stores original and transcoded media durably and cheaply.' },
    { name: 'Fan-Out Patterns', description: 'Distributes each new post into follower feeds.' },
    { name: 'Caching', description: 'Keeps hot feeds and post metadata fast to read.' },
  ],

  simulator: {
    goalDescription:
      'Serve a globally distributed photo feed - decoupling upload and processing from serving, and delivering images from CDN edge nodes at sub-500ms P95.',
    requirementChips: ['Feed load < 500ms P95', '100M+ photos/day uploaded', 'Global CDN image delivery'],
    targetRps: 580000,
    readRatio: 0.99,
    cacheHitRatio: 0.85,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'cdn-delivery', label: 'CDN edge delivery for images', kind: 'requires-node-type', nodeType: 'cdn' },
      { id: 'object-storage', label: 'Object storage for originals and variants', kind: 'requires-node-type', nodeType: 'object-store' },
      {
        id: 'feed-store',
        label: 'Write-optimized feed store',
        kind: 'requires-node-type',
        nodeType: ['cassandra', 'dynamodb', 'mongodb'],
      },
      { id: 'feed-cache', label: 'Feed cache (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'async-pipeline',
        label: 'Async pipeline for upload processing / fan-out',
        kind: 'requires-node-type',
        nodeType: ['kafka', 'sqs', 'rabbitmq'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 600, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 24, position: { x: 880, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 4, position: { x: 1160, y: 80 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 24, position: { x: 1160, y: 240 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 1160, y: 400 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 8, position: { x: 1440, y: 80 } },
        { id: 'objstore-1', type: 'object-store', instanceCount: 6, position: { x: 1440, y: 240 } },
        { id: 'worker-1', type: 'worker', instanceCount: 12, position: { x: 1440, y: 400 } },
        { id: 'cdn-1', type: 'cdn', instanceCount: 2, position: { x: 1720, y: 240 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-gw', source: 'lb-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-cass', source: 'app-1', target: 'cassandra-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker-objstore', source: 'worker-1', target: 'objstore-1' },
        { id: 'e-objstore-cdn', source: 'objstore-1', target: 'cdn-1' },
        { id: 'e-app-objstore', source: 'app-1', target: 'objstore-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Uploads land in S3 and are resized asynchronously by workers off a queue, then served forever after through CDN edge nodes. Feed reads hit a Redis cache backed by a Cassandra feed store, so the vast majority of reads never touch a database directly.',
    failureModeNarratives: {
      'object-store':
        "A single object-store tier backs both the CDN origin and the media-processing pipeline; if it becomes unavailable, new uploads can't be processed and CDN cache misses have nothing to fetch from.",
    },
    fullDesignLinkSlug: 'photo-sharing',
  },
}

export default topic
