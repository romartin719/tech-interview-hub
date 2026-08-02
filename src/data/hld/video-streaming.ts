import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'video-streaming',
  title: 'Video Streaming (Netflix / YouTube)',
  difficulty: 'Advanced',
  icon: 'pi pi-video',
  color: '#ef4444',
  readTimeMinutes: 28,
  topics: [
    'Adaptive Bitrate Streaming',
    'CDN Edge Caching',
    'Distributed Transcoding',
    'Chunked Resumable Upload',
    'Object Storage',
  ],
  companies: ['Netflix', 'YouTube', 'Twitch', 'Hulu'],
  prerequisites: ['CDN', 'Object Storage', 'Message Queues'],
  summary:
    'A platform for uploading, transcoding into multiple bitrates/resolutions, and streaming video at scale, leaning almost entirely on CDN edge caching and adaptive bitrate delivery so that origin storage never has to serve playback traffic directly.',

  understandingProblem:
    "Netflix, YouTube, Twitch, and Hulu all need to serve tens of petabytes of video per day to hundreds of millions of viewers, and no origin infrastructure — however large — can serve that volume of raw bytes directly. A naive \"GET /video/{id}.mp4, stream the file\" design collapses under both bandwidth and concurrent-connection load, and it can't adapt: a single fixed-quality file either stalls viewers on a bad connection or wastes bandwidth serving 4K to someone on a throttled network. Because a small fraction of the catalog (new releases, trending clips) drives most daily views, the real design challenge is building a delivery architecture where popular content is served almost entirely from nearby edge infrastructure, while the long tail of rarely-watched videos stays servable without every request becoming a slow, expensive origin fetch. Layered underneath that is the transcoding pipeline itself, which has to turn one uploaded file into many parallel-encoded renditions fast enough to keep up with hundreds of thousands of daily uploads — and the upload path has to survive a multi-gigabyte file being pushed over an unreliable connection in the first place.",

  realExamples: "Netflix Open Connect's ISP-embedded CDN appliances, YouTube's transcoding and recommendation pipeline, Twitch VOD storage, Hulu's licensed-content delivery.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Viewer App]:::client
  server[Video Server]:::compute
  storage[("Origin File Storage")]:::storage

  client -->|"GET /video/{id}.mp4"| server
  server -->|"read full file"| storage
  server -->|"stream raw bytes"| client`,
    },
    whyThisBreaks: [
      "Origin bandwidth and connection count collapse instantly at scale — one server, or even a modest fleet, cannot serve tens of petabytes/day of video directly",
      'No transcoding — a single fixed-quality file either stalls viewers on a throttled connection or wastes bandwidth serving 4K to a phone on 3G',
      "No chunked/resumable upload — a 2GB 4K source file uploaded over a flaky connection fails partway through and restarts from byte zero",
      'No catalog or search — there is no way to browse or discover content beyond a raw video ID',
      "In simple terms: streaming a movie by having every viewer's request re-read the same file from one machine is like reopening a book to page 1 for every single reader in a stadium — it works for a handful of concurrent viewers and falls over immediately past that.",
      'Every view competes for the same origin capacity — one popular video can starve every other title on the platform',
    ],
    closingNote:
      'The rest of the doc evolves this into an async transcoding pipeline feeding a CDN-first adaptive bitrate delivery system, with origin storage relegated to a cold fallback that almost never serves playback traffic directly.',
  },

  priorArt: [
    {
      title: 'Netflix Open Connect',
      description:
        "Netflix's purpose-built CDN, deployed as appliances inside ISP networks, is the canonical real-world implementation of the edge-cache-first, origin-as-cold-fallback architecture this design is based on.",
      link: 'https://openconnect.netflix.com/en/',
    },
    {
      title: 'HLS (Apple) and MPEG-DASH',
      description:
        'The two dominant adaptive bitrate streaming standards, both defining the segment-plus-manifest model (short chunked segments, a playlist of available renditions) that this design\'s player and CDN layer implement directly.',
      link: 'https://datatracker.ietf.org/doc/html/rfc8216',
    },
    {
      title: "Google's Resumable Upload Protocol (YouTube Data API)",
      description:
        'A chunked, byte-range-addressable upload protocol that lets a client resume a large upload after a dropped connection without re-sending already-received bytes — the direct model for this design\'s Upload Service.',
      link: 'https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol',
    },
    {
      title: 'Netflix "Per-Title Encode Optimization" (Tech Blog)',
      description:
        "Netflix's published work on content-aware encoding — analyzing each title's visual complexity to assign bitrates per rendition instead of one fixed ladder for the whole catalog — is the direct source for this design's content-aware encoding deep dive.",
      link: 'https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2',
    },
    {
      title: 'Tiered / Origin-Shield CDN Caching',
      description:
        'The standard edge-then-regional-then-origin cache hierarchy used across major CDNs (Akamai, Cloudflare, Fastly) to absorb cache misses at a nearer tier before they reach origin, matching this design\'s long-tail caching strategy.',
      link: 'https://developers.cloudflare.com/cache/how-to/tiered-cache/',
    },
  ],

  coreEntities: [
    { name: 'Video', description: 'The logical content record a viewer watches, tying together metadata and its set of renditions.' },
    { name: 'Rendition', description: 'One resolution/bitrate/codec encoding of a video, part of its bitrate ladder.' },
    { name: 'Segment', description: 'A short (2-10s) chunk of a rendition, the smallest unit fetched and cached during playback.' },
    { name: 'Manifest', description: 'A playlist document listing every available rendition and its segment URL pattern, fetched before playback starts.' },
    { name: 'UploadSession', description: 'Tracks an in-progress chunked upload: uploadId, target video, chunk size, and which chunk indices have landed.' },
    { name: 'WatchEvent', description: "A single engagement signal (play, pause, seek, completion) plus the durable checkpoint of a viewer's last watched position." },
    { name: 'CDN Cache Node', description: 'An edge (or regional) cache serving segments/manifests to viewers, falling back to origin only on a miss.' },
  ],

  requirements: {
    core: [
      'Creators upload video files; the platform transcodes them into a bitrate ladder of multiple resolutions for adaptive playback.',
      'Viewers browse and search a catalog, and stream on-demand video that adapts to their network conditions in real time.',
      'The system supports seeking and resuming playback, and many simultaneous viewers of the same video.',
      'Viewing history and watch progress are tracked per user so playback resumes where a viewer left off, and basic engagement (likes, watch time) feeds recommendations.',
      'Content metadata (title, thumbnails, captions, categories) is manageable and searchable.',
    ],
    belowTheLine: [
      'Live streaming with sub-second glass-to-glass latency',
      'Multi-language audio tracks and subtitle switching mid-playback',
      'Offline downloads for offline viewing',
      'The recommendation model itself (we design the watch-event ingestion hook it consumes, not the ranking model)',
      'Content moderation and copyright-match (Content ID-style) pipelines',
      'Full DRM license-server internals (we note where it plugs into playback, not build it)',
      'Creator analytics dashboards (retention curves, watch-time funnels)',
    ],
    nonFunctionalTable: [
      { metric: 'Playback start latency', target: '< 1-2 seconds; rebuffering events rare even on variable networks' },
      { metric: 'CDN offload', target: 'Vast majority of bytes served from edge cache; origin fetches are the rare exception, not the norm' },
      { metric: 'Transcoding throughput', target: 'Scales horizontally to match upload volume with no unbounded processing backlog' },
      { metric: 'Upload reliability', target: 'A dropped connection loses at most one chunk of an in-progress upload, never the whole file' },
      { metric: 'Regional fault tolerance', target: 'A regional CDN or data-center failure causes no global outage' },
      { metric: 'Storage efficiency', target: 'Multi-rendition storage growth actively managed via tiering/lifecycle policy rather than left unconstrained' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Origin Rendition Storage',
      purpose: 'Durable store for every generated bitrate-ladder segment and manifest - the cold source of truth behind the CDN',
      primaryPick: 'S3',
      alternatives: 'GCS, Azure Blob',
      whyPrimaryWins: 'Write-once, read-rarely (only on a CDN miss) is exactly what object storage is priced and built for.',
    },
    {
      tier: 'CDN',
      purpose: 'Video segment delivery to viewers, absorbing nearly all playback bytes',
      primaryPick: 'Open Connect (custom, ISP-embedded)',
      alternatives: 'CloudFront, Akamai, Fastly',
      whyPrimaryWins: 'At Netflix-scale traffic, custom appliances placed inside ISP networks cost a fraction per GB versus commercial CDN pricing - worth building and operating your own edge hardware for.',
    },
    {
      tier: 'Metadata / Catalog DB',
      purpose: 'Title metadata, episodes, status, and licensing, kept independent of the pixels pipeline',
      primaryPick: 'Postgres (sharded)',
      alternatives: 'CockroachDB, Spanner',
      whyPrimaryWins: 'Catalog admin queries and status transitions benefit from ACID and joins; metadata churn never touches the rendition pipeline.',
    },
    {
      tier: 'Watch History / User Activity Store',
      purpose: 'Append-only per-user engagement event log for resume and recommendations',
      primaryPick: 'Cassandra',
      alternatives: 'DynamoDB, ScyllaDB',
      whyPrimaryWins: 'High-write, wide-column access pattern for time-series events that grow without bound, fully decoupled from the small hot "last position" record.',
    },
    {
      tier: 'Encoding Job Orchestration',
      purpose: 'Coordinates the many dependent, retryable, hours-long transcoding steps per upload',
      primaryPick: 'Temporal',
      alternatives: 'Cadence, Step Functions, Airflow',
      whyPrimaryWins: "Long-running workflows need checkpointing, retry policies, and visibility across split/encode/validate/package steps - hand-rolling that state machine in a plain queue reinvents what a workflow engine already does.",
    },
    {
      tier: 'Watch Progress / Session Store',
      purpose: 'Fast, overwrite-in-place last-position lookups read once at every playback start',
      primaryPick: 'Redis',
      alternatives: 'Memcached',
      whyPrimaryWins: 'Sub-ms key-value reads for a hot, tiny record that must never compete with the ever-growing engagement event log.',
    },
  ],
  technologyChoicesNote:
    "Why a custom CDN (Open Connect) over a commercial one at this scale? Per-GB commercial CDN pricing becomes enormous at tens of petabytes served per day - custom hardware appliances placed inside ISP networks cost a small fraction per GB, saving well over a billion dollars a year at Netflix's traffic share. Why Temporal for the encoding pipeline instead of a plain job queue? Transcoding one upload involves many dependent, retryable, hours-long steps (split, encode, validate, package, publish) - a workflow engine's built-in checkpointing and retry policies replace a hand-rolled state machine that a simple queue can't express.",

  scaleEstimation: [
    'Viewers: 200M MAU, 30M stream on a given day, averaging 40 minutes of viewing at ~3 Mbps blended bitrate (mix of SD/HD/4K)',
    'Bandwidth: ~30M x 40min x 60s x 3Mbps / 8 ≈ 27 PB served per day — almost all of which must come from CDN edge caches, since serving that volume from origin is infeasible',
    'Uploads: ~500K new videos/day, averaging 500MB raw, giving ~250TB/day of fresh footage ingested for transcoding (~90PB/year raw, before any bitrate ladder is generated)',
    "In simple terms: every uploaded video turns into 5-8 transcoded renditions, roughly doubling or tripling its stored footprint — so a mature catalog's storage footprint grows into the hundreds of petabytes to low exabytes range, which is exactly why storage tiering (hot vs. cold) becomes unavoidable, not optional.",
    'Write QPS: ~6 uploads/sec sustained, bursting far higher around regional peak upload hours; each upload fans out into 5-8 parallel transcode jobs',
    'Read QPS: tens of millions of manifest fetches/day plus orders of magnitude more segment fetches — the reason nearly all of that traffic must be absorbed by the CDN, not the origin or the API tier',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/videos/uploads',
      description: 'Initiate a chunked resumable upload; returns an uploadId and chunk size to use.',
      example:
        '// Request\n{ "filename": "trip-vlog.mp4", "sizeBytes": 524288000 }\n\n// Response 201\n{ "uploadId": "u_7712", "chunkSizeBytes": 8388608 }',
    },
    {
      method: 'PUT',
      path: '/v1/videos/uploads/{uploadId}/chunks/{chunkIndex}',
      description: 'Upload a single chunk directly against object storage via a pre-signed URL; safe to retry/resume any chunk independently.',
      example: '// Response 200\n{ "uploadId": "u_7712", "chunkIndex": 12, "received": true }',
    },
    {
      method: 'POST',
      path: '/v1/videos/uploads/{uploadId}/complete',
      description: 'Signal that all chunks have landed; triggers assembly, validation, and enqueues the transcoding job.',
      example: '// Response 202\n{ "videoId": "v_9931", "status": "TRANSCODING" }',
    },
    {
      method: 'GET',
      path: '/v1/videos/{videoId}/manifest.m3u8',
      description: 'Fetch the HLS manifest listing available renditions and segment URLs. Served almost entirely from CDN edge.',
      example: '// Response 200 (abridged)\n#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/index.m3u8',
    },
    {
      method: 'GET',
      path: '/v1/catalog/search?q=<query>&cursor=<cursor>',
      description: 'Search/browse the video catalog by title, category, or tag.',
      example: '// Response 200\n{ results: [{ videoId, title, thumbnailUrl, durationSec }], nextCursor }',
    },
    {
      method: 'POST',
      path: '/v1/videos/{videoId}/events',
      description: 'Report a watch-progress checkpoint or engagement event (play, pause, seek, like, watch-time checkpoint). Accepted async.',
      example: '// Request\n{ "userId": "u_221", "type": "watch_progress", "positionSec": 340 }\n\n// Response 202\n{ "accepted": true }',
    },
  ],
  apiSecurityNote:
    'Manifest and segment URLs are signed with a short-lived token so a viewer cannot share a durable link that bypasses entitlement checks; the CDN validates the signature at the edge without a round trip to origin. Upload endpoints require creator auth plus an Idempotency-Key on /complete so a retried completion call never double-triggers transcoding. Licensed content additionally hands playback off to a DRM license server that the player negotiates with before the CDN will serve protected segments — that negotiation is out of scope for this design, but the manifest is where it plugs in.',

  highLevelDesignIntro:
    "Let's build this incrementally, one functional requirement at a time — starting with getting bytes in reliably, then getting bytes out fast, then closing the loop with what people actually watched.",

  builds: [
    {
      title: 'FR1: Chunked Resumable Upload -> Async Transcoding Pipeline',
      body:
        "A creator's source file can be multiple gigabytes. We can't afford a design where a dropped connection at 95% means starting over, and we can't make a viewer's upload confirmation depend on transcoding finishing — that can take minutes for a long video. So: split the upload into independently-retryable chunks written straight to object storage, confirm receipt fast, and hand transcoding off to an async worker fleet entirely decoupled from the upload request.",
      insightCallout:
        "Why do chunks upload directly to object storage via pre-signed URLs instead of through the Upload Service? Because the Upload Service would otherwise sit in the byte-transfer path for every megabyte of every upload — that couples its scaling to upload volume instead of to session/metadata volume, which is orders of magnitude lighter. Pre-signed URLs let the client push bytes straight to S3-class storage while the Upload Service only tracks session state (which chunks have landed).",
      newComponents: [
        {
          name: 'Upload Service',
          description:
            'Opens upload sessions, issues pre-signed chunk URLs, tracks which chunk indices have landed (persisted, not in-memory), and triggers assembly + transcoding once all chunks arrive.',
        },
        {
          name: 'Raw Upload Storage (Object Storage)',
          description: 'Durable landing zone for uploaded chunks and the assembled source file. Write-once, read-rarely (only by transcoding workers).',
        },
        {
          name: 'Transcode Queue',
          description: 'Decouples upload completion from transcoding. If the worker fleet is backlogged, uploads still succeed and confirm instantly.',
        },
        {
          name: 'Transcoding Worker Fleet',
          description:
            'Consumes transcode jobs, splits the source into time-chunks fanned out across workers, encodes each into every target rendition, and writes segments + manifest to origin rendition storage.',
        },
        {
          name: 'Origin Rendition Storage (Object Storage)',
          description: "Durable store for every generated rendition's segments and manifest — the cold source of truth the CDN pulls from on a cache miss.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  creator[Creator App]:::client
  us[Upload Service]:::edge
  raw[("Raw Upload Storage")]:::storage
  tq[["Transcode Queue"]]:::async
  workers[Transcoding Worker Fleet]:::compute
  rend[("Origin Rendition Storage")]:::storage

  creator -->|"1. Open upload session"| us
  creator -->|"2. Upload chunks (parallel, resumable)"| raw
  creator -->|"3. Mark complete"| us
  us -->|"4. Assemble + validate source"| raw
  us -->|"5. Enqueue transcode job"| tq
  tq -->|"6. Dispatch to fleet"| workers
  workers -->|"7. Read source"| raw
  workers -->|"8. Write bitrate ladder + manifest"| rend`,
      },
      steps: [
        'Creator calls POST /v1/videos/uploads with filename + size -> Upload Service creates an uploadId and returns a chunk size',
        'Client splits the file into chunks and PUTs each one to a pre-signed object storage URL, in parallel, in any order — each chunk is independently retryable',
        'Upload Service persists a chunk-completion bitmap per uploadId so an instance restart never loses in-flight upload state; the client can always ask "which chunks am I missing?"',
        'Once every chunk lands, client calls /complete -> Upload Service (or the object store\'s own multipart-complete API) assembles and validates the full file',
        'Upload Service writes a video row with status=TRANSCODING and enqueues a transcode job with the source location',
        'Worker fleet splits the source into time-segments, fans them out across workers, and each worker encodes its segment at every target rendition in the safe ladder',
        'Completed renditions and manifest are written to origin rendition storage; a stitching step verifies segment boundaries line up across workers before marking the video READY',
      ],
      closingNote:
        "Why split the source by time-segment for transcoding, on top of chunking the upload? Upload-chunking is about surviving a flaky network for a single byte stream; transcode-chunking is about turning one long CPU-bound job into many short, independently-recoverable ones — a worker crash mid-encode only loses its one segment's work, not the whole video, and the job queue's normal retry semantics apply per-segment instead of forcing a full re-encode.",
    },
    {
      title: 'FR2: Catalog and Metadata Service',
      body:
        "Viewers need to browse and search the catalog independent of whether transcoding has finished, and metadata edits (fixing a typo in a title, replacing a thumbnail) should never touch the transcoding pipeline or invalidate already-cached video segments. Metadata and pixels/bytes need to be architecturally separate services.",
      insightCallout:
        'Why a dedicated Search Index (Elasticsearch) instead of querying the Metadata DB directly? Catalog browsing needs full-text and faceted search (title, category, tags) at read volumes far higher than metadata writes — a relational DB\'s B-tree indexes are the wrong tool for "find videos matching this fuzzy query," while Elasticsearch is purpose-built for it and can be rebuilt from the Metadata DB if it ever falls out of sync.',
      newComponents: [
        {
          name: 'Metadata Service',
          description: "Owns a video's title, description, thumbnails, captions, category, and status (TRANSCODING/READY/PUBLISHED/TAKEDOWN). Serves catalog reads.",
        },
        {
          name: 'Metadata DB (Postgres)',
          description: 'Source of truth for video metadata — relational, since catalog admin queries and status transitions benefit from ACID and joins.',
        },
        {
          name: 'Search Index (Elasticsearch)',
          description: 'Denormalized, eventually-consistent copy of searchable fields, kept in sync via events from the Metadata Service.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  workers[Transcoding Worker Fleet]:::compute
  meta[Metadata Service]:::compute
  metadb[("Metadata DB")]:::database
  search[("Search Index")]:::storage
  viewer[Viewer App]:::client

  workers -->|"1. Video ready + thumbnails"| meta
  meta -->|"2. Write/update metadata"| metadb
  meta -->|"3. Index searchable fields"| search
  viewer -->|"4. Browse / search catalog"| meta
  meta -->|"5. Query"| search
  meta -->|"6. Fetch full record"| metadb`,
      },
      steps: [
        'When a video finishes transcoding, the worker fleet calls the Metadata Service with the generated thumbnails and the list of available renditions',
        'Metadata Service writes/updates the video row in Postgres and flips status to PUBLISHED once all required checks (safe-ladder renditions present) pass',
        'Metadata Service publishes a lightweight change event that a consumer uses to update the Search Index with title/category/tags',
        'Viewer calls GET /v1/catalog/search?q=... -> Metadata Service queries the Search Index for matching videoIds, then batch-fetches full records from Postgres',
        'A metadata-only edit (fix a title typo, swap a thumbnail) updates Postgres and re-indexes search — it never touches origin rendition storage or invalidates any CDN-cached segment',
      ],
      closingNote:
        "This separation is the same principle Photo Sharing relies on for its pixels pipeline versus its metadata/engagement pipeline: keeping the byte-heavy, rarely-changing artifact (renditions here, processed images there) fully decoupled from the frequently-edited, lightweight metadata means one pipeline's churn never forces work in the other.",
    },
    {
      title: 'FR3: CDN-First Adaptive Bitrate Playback',
      body:
        "This is the core of the design. Application servers must never proxy video bytes — at this scale that would recreate the exact bottleneck the naive first cut had. Playback is served almost entirely from CDN edge caches using the manifest-and-segment model, with origin storage as a cold fallback that only gets hit on a genuine cache miss.",
      insightCallout:
        "Why does the player switch renditions only at segment boundaries, never mid-segment? A segment is the smallest cacheable, independently-decodable unit. Switching mid-segment would mean decoding a partial file at two different bitrates and splicing frames — fragile and visually jarring. Aligning switches to segment boundaries keeps every segment a clean, independently cacheable object, which is exactly what makes CDN caching work well in the first place.",
      newComponents: [
        {
          name: 'CDN Edge Cache',
          description: 'Hundreds of points of presence caching manifests and segments close to viewers. Absorbs the overwhelming majority of playback bytes.',
        },
        {
          name: 'Origin Shield / Regional Cache',
          description: 'A second cache tier between edge and origin. Absorbs edge misses so a viral spike does not slam origin directly.',
        },
        {
          name: "Player ABR Logic (client)",
          description: 'Measures achieved segment download throughput and time-to-first-byte, and picks the next segment\'s rendition accordingly.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  viewer[Viewer App]:::client
  cdn[["CDN Edge Cache"]]:::cache
  shield[["Origin Shield"]]:::cache
  rend[("Origin Rendition Storage")]:::storage

  viewer -->|"1. GET manifest.m3u8"| cdn
  cdn -->|"2. Miss"| shield
  shield -->|"3. Miss"| rend
  viewer -->|"4. GET segment_N_{rendition}.ts"| cdn
  cdn -->|"5. Cache + serve"| viewer`,
      },
      steps: [
        'Viewer requests GET /v1/videos/{id}/manifest.m3u8 — this hits CDN edge first, not the application tier',
        'On edge cache hit, the manifest is served directly; on a miss, the edge pulls from the regional origin-shield cache, which pulls from origin rendition storage only if it too misses',
        'Player parses the manifest, starts with a conservative rendition, and requests the first segment',
        'Player measures download throughput and time-to-first-byte for each segment; it selects the next segment\'s rendition (higher, equal, or lower) based on that measurement',
        'Every segment request goes to the CDN edge the same way the manifest did — cache hit serves instantly, cache miss falls through the same shield -> origin chain and populates the cache for the next viewer in that region',
        'Because switching only happens at segment boundaries, a network dip causes the player to downshift smoothly at the next boundary rather than mid-frame',
      ],
      closingNote:
        'Origin rendition storage is deliberately a cold, durable source of truth, not the primary read path — the entire point of the CDN-first design is that origin only ever sees the rare cache miss, never the bulk of daily playback traffic.',
    },
    {
      title: 'FR4: Watch Progress, Engagement Tracking, and the Recommendation Hook',
      body:
        "Viewers expect playback to resume where they left off, and the platform needs watch-history signals to power recommendations later. Neither of those can be allowed to slow down or block actual playback — they have to live on a fully decoupled, async path.",
      insightCallout:
        "Why split 'watch progress' (last position) from the full engagement event log instead of one table for both? Resume-on-load only ever needs the single latest position per (user, video) — a small, hot, overwrite-in-place record. The full event history (every play/pause/seek/like) is append-only and grows without bound; mixing the two into one table forces a hot-read path to compete with an ever-growing write path for the same storage engine.",
      newComponents: [
        {
          name: 'Watch Progress Store (Redis)',
          description: 'Fast key-value store of (userId, videoId) -> last position, overwritten on every checkpoint. Read once at playback start to resume.',
        },
        {
          name: 'Watch Event Queue (Kafka)',
          description: 'Durable, append-only stream of every engagement event, fully decoupled from the progress store and from playback itself.',
        },
        {
          name: 'Watch History Store',
          description: 'Wide-column store of the full event history per user, consumed by downstream analytics and recommendation training.',
        },
        {
          name: 'Recommendation Service',
          description: '(Below the line for its ranking model, but its ingestion contract is in scope.) Consumes the event stream asynchronously to build watch-history features.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  viewer[Viewer App]:::client
  progress[("Watch Progress Store")]:::cache
  weq[["Watch Event Queue"]]:::async
  history[("Watch History Store")]:::database
  rec[Recommendation Service]:::compute
  meta[Metadata Service]:::compute

  viewer -->|"1. Checkpoint every ~15s"| progress
  viewer -->|"2. Play / pause / seek / like"| weq
  weq -->|"3. Persist full history"| history
  weq -->|"4. Consume async"| rec
  rec -->|"5. Personalized ranking"| meta`,
      },
      steps: [
        'Player buffers position updates client-side and flushes a checkpoint roughly every 10-15 seconds — never on every frame',
        'Checkpoint hits an async endpoint that overwrites the (userId, videoId) row in the Watch Progress Store; on next playback start, this row is read to resume exactly where the viewer left off',
        'Every meaningful engagement event (play, pause, seek, completion, like) is also published to the Watch Event Queue, independent of the progress checkpoint',
        'A consumer persists the full event stream into the Watch History Store for durability and offline analysis',
        'The Recommendation Service consumes the same event stream asynchronously — it can lag by minutes without affecting playback or resume correctness, since it only ever reads the append log',
      ],
      closingNote:
        'Nothing on this path is allowed to block a video frame from rendering. If the Watch Progress Store or the event queue is briefly unavailable, playback continues uninterrupted — the viewer just risks losing the last few seconds of resume position, not the stream itself.',
    },
  ],

  coreFlows: [
    {
      title: 'Chunked Upload -> Transcoding End-to-End',
      diagram: {
        mermaid: `sequenceDiagram
  participant Creator
  participant US as Upload Service
  participant Raw as Raw Upload Storage
  participant TQ as Transcode Queue
  participant W as Transcoding Worker Fleet
  participant Rend as Origin Rendition Storage
  participant Meta as Metadata Service

  Creator->>US: POST /videos/uploads (filename, size)
  US-->>Creator: uploadId, chunkSize
  loop each chunk, parallel + resumable
    Creator->>Raw: PUT chunk (pre-signed URL)
    Raw-->>Creator: 200 OK
  end
  Creator->>US: POST /uploads/{id}/complete
  US->>Raw: Assemble + validate source
  US->>TQ: Enqueue transcode job
  TQ->>W: Dispatch job
  W->>Raw: Read source, split into time-segments
  W->>W: Encode each segment at every rendition (parallel)
  W->>Rend: Write bitrate ladder + manifest
  W->>Meta: Video READY (renditions, thumbnails)
  Meta-->>Creator: status = PUBLISHED`,
      },
      nonObviousFailure:
        "If a worker crashes mid-encode, only its in-flight time-segment's work is lost — the job queue's visibility timeout redelivers that segment to another worker. Idempotent writes (check if a segment's output already exists in origin storage before re-encoding) prevent duplicate work on redelivery. Videos stuck in TRANSCODING beyond a threshold are flagged by a reconciler and re-queued rather than silently stalling forever.",
    },
    {
      title: 'Manifest and Segment Fetch With Adaptive Bitrate',
      diagram: {
        mermaid: `sequenceDiagram
  participant V as Viewer Client
  participant CDN as CDN Edge
  participant Shield as Origin Shield
  participant O as Origin Rendition Storage

  V->>CDN: GET manifest.m3u8
  alt Cache hit
    CDN-->>V: manifest
  else Cache miss
    CDN->>Shield: fetch
    Shield->>O: fetch (miss)
    O-->>Shield: manifest
    Shield-->>CDN: manifest (cached)
    CDN-->>V: manifest (now cached at edge too)
  end
  loop every segment
    V->>CDN: GET segment_N_{rendition}.ts
    CDN-->>V: segment bytes
    V->>V: measure throughput, choose rendition for segment_N+1
  end`,
      },
      nonObviousFailure:
        "If origin rendition storage is briefly unreachable during a cache miss, the CDN serves a stale-while-revalidate copy rather than a hard failure wherever one exists — a viewer might get a slightly outdated manifest (missing a just-added rendition) rather than a broken stream. A genuine cold cache miss with no stale copy and an unreachable origin is the one case that surfaces as a real playback failure, and it only affects brand-new or extremely unpopular content, never already-cached, already-popular videos.",
    },
    {
      title: 'Watch Progress Checkpoint and Resume',
      diagram: {
        mermaid: `sequenceDiagram
  participant V as Viewer Client
  participant Prog as Watch Progress Store
  participant WEQ as Watch Event Queue
  participant Hist as Watch History Store

  Note over V: Playback starts
  V->>Prog: GET last position for (user, video)
  Prog-->>V: positionSec = 340
  V->>V: Resume playback at 340s
  loop every ~15s during playback
    V->>Prog: SET position = current (overwrite)
    V->>WEQ: publish watch_progress event
  end
  WEQ->>Hist: persist full event history
  Note over V: Viewer closes app
  V->>Prog: final checkpoint (best-effort)`,
      },
      nonObviousFailure:
        'If the final "closing" checkpoint never lands (app killed, network drop), the viewer resumes from their last successful periodic checkpoint — at most ~15 seconds of rewatch, never a lost position or a crash. The system deliberately favors periodic overwrites over a single synchronous write on close, because a beforeunload-style write is exactly the kind of request most likely to be dropped.',
    },
    {
      title: "Video Lifecycle State Machine",
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> UPLOADING : Chunks in flight
  UPLOADING --> ASSEMBLING : All chunks received
  ASSEMBLING --> TRANSCODING : Source validated
  TRANSCODING --> READY : Safe-ladder renditions complete
  TRANSCODING --> FAILED : Worker/job error
  FAILED --> TRANSCODING : Retry
  READY --> PUBLISHED : Metadata checks pass
  PUBLISHED --> TAKEDOWN : Rights/moderation trigger
  PUBLISHED --> GEO_RESTRICTED : Licensing restriction applied
  TAKEDOWN --> PUBLISHED : Appeal approved`,
      },
    },
  ],

  deepDives: [
    {
      title: 'The Transcoding Pipeline and Bitrate Ladder',
      problem:
        'A single uploaded file must become a "bitrate ladder" — several resolution/bitrate renditions segmented into short chunks — fast enough to keep up with hundreds of thousands of daily uploads, without one long video blocking the whole worker fleet.',
      simpleTerms: 'One video file needs to become 6 different quality versions. Should one worker grind through all of them one at a time?',
      bad: 'One worker downloads the full source and encodes each rendition sequentially — 240p, then 360p, and so on up to 4K. A two-hour movie can take hours to fully transcode, and a worker crash mid-job loses all progress on that video.',
      good: "Fan renditions out across workers — one worker per target resolution/codec, all reading the same source in parallel. Cuts wall-clock time roughly by the rendition count, but a single worker still processes an entire two-hour file serially for its one rendition, so long-form content stays slow, and a crash partway through a rendition still restarts that whole rendition from zero.",
      great:
        "Parallelize across both dimensions — rendition AND time segment: split the source into short time chunks (a few minutes each), fan every chunk out to the worker pool, and have each worker independently encode its chunk at every target rendition; a stitching step then verifies segment boundaries and concatenates. This turns one long-running job into many short, independently-recoverable ones — a crash loses only the in-flight chunk's work, and the queue's normal retry semantics apply per-chunk instead of per-video. On top of that, content-aware encoding analyzes each title's visual complexity before assigning bitrates rather than using one fixed universal ladder — a static talking-head video needs far less bitrate than a fast-motion action sequence to hit the same perceptual quality, trading a bit of upfront analysis compute for materially lower storage and bandwidth per view at catalog scale.",
    },
    {
      title: 'Adaptive Bitrate Streaming and the Manifest/Segment Model',
      problem:
        "The player needs to react to a changing network mid-playback without ever splicing a stream mid-frame — the question is what unit of video it operates on to make that possible.",
      simpleTerms: "How does the player know when to switch from a blurry stream to a crisp one, and how does it decide when the network gets slow?",
      bad: 'Serve one fixed rendition to everyone. Fine on a good connection, but a throttled viewer has no lower rendition to fall back to and simply stalls, while a viewer on a great connection is stuck at whatever the server assumed was "good enough."',
      good: "Generate multiple renditions and let the client pick one for the whole session based on an initial network probe. Better than a single fixed rendition, but a network condition that changes mid-playback (walking out of WiFi range) has no way to adapt — the viewer is stuck with their initial choice until they stall.",
      great:
        "The HLS/DASH manifest-and-segment model: break video into short segments (2-10 seconds) per rendition, plus a manifest listing every rendition and its segment URL pattern. The player downloads a segment, measures achieved throughput and time-to-first-byte, and uses that measurement to pick the next segment's rendition — switching only ever happens at a segment boundary, so there's never a mid-frame quality jump. Segment length is a real lever: shorter segments let the player react to a degrading network faster but multiply the distinct cacheable objects the CDN tracks and add proportionally more HTTP overhead; longer segments cache and compress more efficiently but slow the player's ability to downshift, risking a visible stall before a lower-bitrate segment finishes downloading. Live streaming favors short segments to minimize glass-to-glass latency; on-demand libraries lean toward slightly longer segments since playback-start delay matters more than split-second adaptiveness.",
    },
    {
      title: 'CDN Cache Strategy and the Long-Tail Problem',
      problem:
        "A small fraction of the catalog (new releases, trending clips) drives most daily views, so CDN edge caches can serve most traffic without touching origin — but the long tail of rarely watched content still has to be servable without every request becoming a slow, expensive origin fetch.",
      simpleTerms: 'If every video request goes to one origin, users far from it wait hundreds of milliseconds. A CDN puts copies close to viewers everywhere.',
      bad: 'Serve all segments from origin storage directly — high latency for distant viewers, massive egress cost, and origin overwhelmed the moment anything trends.',
      good: 'Put a CDN in front of origin and cache at the edge. But: cache misses on first access are still slow, and a sudden spike of misses for one viral video can still slam origin directly.',
      great:
        "Tiered caching with popularity-aware pre-warming: 1) Edge caching serves the overwhelming majority of requests from hundreds of points of presence, with immutable segment URLs (a new upload is a new URL, so TTLs can be effectively infinite). 2) A regional origin-shield cache sits between edge and origin, absorbing edge misses so a viral spike still doesn't hit origin directly — most edge misses resolve at the shield tier instead. 3) For known, scheduled high-demand events (a new season premiere, a big live event lead-in), content is proactively pushed toward the regions expected to trend, rather than waiting for organic cache misses to populate it. 4) The genuinely hard part is cost: over-provisioning cache capacity for the long tail is wasteful, while under-provisioning causes origin load spikes and elevated playback-start latency exactly for the content least able to absorb it — so most platforms rely on reactive, popularity-driven caching for the long tail and reserve aggressive pre-warming only for events they can actually schedule for.",
      diagram: {
        mermaid: `flowchart LR
  viewer[Viewer]:::client
  edge[["Edge Cache"]]:::cache
  regional[["Regional / Origin Shield"]]:::cache
  origin[("Origin Rendition Storage")]:::storage

  viewer --> edge -->|"miss"| regional -->|"miss"| origin`,
      },
    },
    {
      title: 'Eager vs. On-Demand Rendition Generation',
      problem:
        'Generating and storing every plausible rendition for every uploaded video maximizes playback speed for any viewer, but multiplies transcoding compute and storage cost by the rendition count — much of it wasted on long-tail content that never gets watched at the higher end of the ladder.',
      simpleTerms: 'Should we encode a video into 8 different quality levels the moment it\'s uploaded, even before anyone watches the 4K version, or wait until someone actually asks for it?',
      bad: "Eagerly transcode every video into the full ladder (240p through 4K, H.264 and HEVC and AV1) immediately on upload, regardless of expected audience. Storage and compute scale linearly with catalog size and rendition count, and most of that work is wasted on unpopular content never watched at the top of the ladder.",
      good: "Transcode only a minimal ladder eagerly (say 360p/720p) and defer the rest to on-demand generation on first request, caching the result. Cuts upfront cost, but a video's first 4K viewer now pays a multi-minute encode latency before their stream can even start — unacceptable for on-demand playback, unlike Photo Sharing's on-demand image resize, which finishes in milliseconds instead of minutes.",
      great:
        "The same hybrid principle Photo Sharing uses for image derivatives — eagerly generate the sizes that cover the overwhelming majority of requests, backfill the rest lazily — adapted for the much higher cost of a transcode versus a resize: 1) Eagerly generate a 'safe ladder' immediately at upload — typically 360p/480p/720p, sometimes 1080p — the handful of renditions that cover the overwhelming majority of device/network combinations, so every video is watchable within minutes of upload. 2) Defer expensive or rare renditions (4K, HDR, AV1 for the subset of devices that support it) to a background job triggered once view count crosses a popularity threshold, or immediately for known high-value content (a studio's flagship release) flagged at upload time. 3) Never generate a rendition on the synchronous playback request path — even 'on-demand' renditions are produced by an async job kicked off by the CDN's miss path, and the manifest only ever advertises renditions that already exist, so a viewer requesting 4K before it's ready simply doesn't see it in the ladder yet rather than blocking on a live transcode. 4) Content-aware encoding (from the transcoding pipeline deep dive) can skip a rendition entirely if per-title complexity analysis shows perceptual quality already plateaus below it — a static talking-head video may not need a distinct 4K rendition at all. Net effect: catalog-wide compute cost is dominated by the safe ladder, not the long tail of rarely-viewed high-end renditions, and no viewer ever waits on a live encode.",
    },
    {
      title: 'Chunked Resumable Upload at Scale',
      problem:
        "A creator uploading a multi-gigabyte 4K source file over a home or mobile connection will, statistically, hit a dropped connection before the upload finishes — the question is whether that failure costs them the whole upload or just the last few megabytes.",
      simpleTerms: 'Uploading a 2GB video file over spotty WiFi. If the connection drops at 95%, should the creator start over from zero?',
      bad: 'A single PUT request carrying the entire file body. Any interruption — a dropped WiFi connection, an app backgrounding on mobile — fails the whole upload; the creator restarts from byte zero.',
      good: 'The client splits the file into fixed-size chunks (e.g., 8MB) and uploads each with its own request, tracked by an uploadId and chunk index, so the server can resume from the last acknowledged chunk. But: routing every chunk through a single Upload Service instance for assembly makes that instance a byte-transfer bottleneck, and it becomes a stateful dependency the client must keep talking to.',
      great:
        "Chunked upload directly against pre-signed object-storage URLs, with independently resumable, parallel chunk transfer: 1) The client opens an upload session with the Upload Service and receives an uploadId plus a pre-signed URL per chunk (or a pre-signed multipart-upload session directly against S3/GCS-class storage), so chunk bytes go straight to object storage and never pass through the Upload Service itself. 2) Chunks upload in parallel, in any order; each chunk PUT is independently retryable, and on a dropped connection the client only needs to ask the Upload Service which chunk indices are still missing. 3) Once every chunk lands, the client calls a completion endpoint; the Upload Service (or object storage's own multipart-complete API) assembles and validates the final object and enqueues the transcode job. 4) The upload session and its chunk-completion bitmap are persisted, not held in memory, so an Upload Service instance restart never loses in-flight upload state — a client can resume even talking to a different instance. Net effect: a dropped connection costs at most one chunk's re-transfer, uploads parallelize for throughput, and the Upload Service never sits in the actual byte-transfer path, so it scales independently of upload volume.",
      diagram: {
        mermaid: `flowchart LR
  creator[Creator App]:::client
  us[Upload Service]:::edge
  raw[("Raw Upload Storage")]:::storage
  tq[["Transcode Queue"]]:::async

  creator -->|"1. Open session"| us
  creator -->|"2. PUT chunks in parallel<br/>(pre-signed URLs)"| raw
  creator -->|"3. Ask which chunks are missing"| us
  creator -->|"4. Mark complete"| us
  us -->|"5. Enqueue transcode job"| tq`,
      },
    },
    {
      title: 'Watch History and the Recommendation Event Pipeline',
      problem:
        'Every play, pause, seek, and completion needs to be captured to power resume-playback and, eventually, personalized recommendations — but recording these events on the playback critical path risks slowing or breaking the stream itself.',
      simpleTerms: "The app needs to remember where you left off and roughly what you tend to watch, without ever slowing down the video itself.",
      bad: 'Every position update writes synchronously to the primary metadata database on the request path. Playback now depends on a database write succeeding, and a slow write shows up to the viewer as stutter.',
      good: "Buffer watch events client-side and flush them periodically to an ingestion endpoint that writes async to a queue instead of the primary DB. This decouples playback from write latency, but a single wide table mixing hot 'resume position' reads with an ever-growing history of every event becomes a scaling and query-shape problem.",
      great:
        "Split by access pattern, not by feature: 1) A small, latency-critical 'watch progress' record per (user, video) — just the last position and a timestamp — lives in a fast key-value store, read once on playback start to resume, and overwritten (never appended) on every checkpoint. 2) The full stream of engagement events is appended to a durable event log, fully decoupled from the read-hot progress record. 3) A recommendation service, built and trained separately (out of scope for this design's core requirements), consumes that event stream asynchronously to build watch-history features and personalized rankings — it can lag by minutes without affecting playback or resume correctness, since it only ever reads the append log and never blocks a write to it. This is the same principle Photo Sharing relies on to keep its pixels pipeline and its metadata/engagement pipeline architecturally separate: the latency-sensitive path and the analytics path must never share a write lock.",
    },
  ],

  selfAudit: [
    {
      question: "What happens when a video suddenly goes viral and CDN caches haven't warmed for it?",
      answer:
        'The first requests in each region miss the edge cache and fall through to the regional origin-shield cache or origin, causing a temporary spike in origin load and playback-start latency until enough edge nodes have cached the popular segments — mitigated for known scheduled events via proactive pre-warming.',
    },
    {
      question: 'How do you avoid re-transcoding an entire video just to fix a caption or a thumbnail?',
      answer:
        'Metadata (title, captions, thumbnails) is stored and served independently from video renditions in the Metadata Service, so metadata-only edits never touch the transcoding pipeline or invalidate any already-cached segment.',
    },
    {
      question: "What's the failure mode if a transcoding worker crashes mid-job?",
      answer:
        "Because a source file is split into independently-encoded time-segments per worker, only the in-flight segment's work is lost; the job queue redelivers that segment to another worker, and completed segments/renditions are unaffected.",
    },
    {
      question: 'How do you serve 4K to a viewer on a throttled connection without stalling?',
      answer:
        "The player's ABR logic measures achieved throughput per segment and downshifts to a lower rendition at the next segment boundary before a stall occurs, trading resolution for continuous playback rather than forcing the requested quality.",
    },
    {
      question: 'What happens if a creator\'s upload connection drops at 95% complete?',
      answer:
        'Only the in-flight chunk is lost. The client queries the Upload Service for missing chunk indices and re-uploads just those — the persisted chunk-completion bitmap means this works even if the client reconnects to a different Upload Service instance.',
    },
    {
      question: 'Does watching a video ever block on writing watch history?',
      answer:
        'No. Progress checkpoints overwrite a small key-value record and engagement events publish to a queue — both async, both decoupled from the rendering path, so an outage in either degrades resume-accuracy at worst, never playback itself.',
    },
    {
      question: 'How is storage cost controlled for a catalog with a long tail of rarely-watched videos?',
      answer:
        'Only a safe ladder of common renditions is generated eagerly; rare/expensive renditions are generated on-demand once popularity justifies them, and aging low-traffic renditions can be demoted to cheaper storage tiers based on tracked access-frequency signals.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  subgraph Clients
    creator[Creator App]:::client
    viewer[Viewer App]:::client
  end

  subgraph Ingest
    us[Upload Service]:::edge
    raw[("Raw Upload Storage")]:::storage
    tq[["Transcode Queue"]]:::async
    workers[Transcoding Worker Fleet]:::compute
    rend[("Origin Rendition Storage")]:::storage
  end

  subgraph Catalog
    meta[Metadata Service]:::compute
    metadb[("Metadata DB")]:::database
    search[("Search Index")]:::storage
  end

  subgraph Delivery
    shield[["Origin Shield / Regional Cache"]]:::cache
    cdn[["CDN Edge Cache"]]:::cache
  end

  subgraph Engagement
    progress[("Watch Progress Store")]:::cache
    weq[["Watch Event Queue"]]:::async
    history[("Watch History Store")]:::database
    rec[Recommendation Service]:::compute
  end

  creator -->|"1. Chunked resumable upload"| us
  us -->|"2. Assemble source"| raw
  raw -->|"3. Upload complete event"| tq
  tq -->|"4. Dispatch job"| workers
  workers -->|"5. Write bitrate ladder + manifest"| rend
  workers -->|"6. Video ready"| meta
  meta -->|"7. Persist metadata"| metadb
  meta -->|"8. Index searchable fields"| search
  viewer -->|"9. Browse / search catalog"| meta
  viewer -->|"10. GET manifest + segments"| cdn
  cdn -->|"11. Cache miss"| shield
  shield -->|"12. Cache miss"| rend
  viewer -->|"13. Checkpoint watch progress"| progress
  viewer -->|"14. Watch / engagement events"| weq
  weq -->|"15. Persist history"| history
  weq -->|"16. Consume async"| rec
  rec -->|"17. Personalized ranking"| meta`,
  },

  keyTechnologies: [
    { term: 'HLS/DASH', definition: 'Adaptive bitrate streaming protocols that break video into short segments plus a manifest describing available renditions.' },
    { term: 'Bitrate Ladder', definition: 'The full set of resolution/bitrate renditions generated per video so playback can adapt to varying network conditions and devices.' },
    { term: 'Content-Aware Encoding', definition: "Assigning per-title bitrates based on a video's visual complexity rather than a fixed ladder, to hit target quality with less storage/bandwidth." },
    { term: 'Manifest File', definition: 'A playlist document (e.g. .m3u8) listing every available rendition and the URL pattern for its segments, fetched before playback begins.' },
    { term: 'Tiered / Origin-Shield Caching', definition: 'A caching layer structure (edge -> regional -> origin) that absorbs cache misses at a nearer tier before they reach origin storage.' },
    { term: 'Adaptive Bitrate (ABR) Algorithm', definition: "Client-side logic that measures achieved segment download throughput and selects the next segment's rendition accordingly, switching only at segment boundaries." },
    { term: 'Chunked Resumable Upload', definition: 'Splitting a large upload into independently-retryable chunks against pre-signed object storage URLs, so a dropped connection loses at most one chunk of progress.' },
    { term: 'Kafka', definition: 'Durable event log carrying watch-progress and engagement events from the playback path to history storage and the recommendation pipeline, fully decoupled from streaming itself.' },
  ],

  expectedDepth: {
    mid:
      'Propose transcoding an uploaded video into a few resolutions so different devices/networks can play it. Understand that a CDN is needed to serve video at scale rather than a single server. Explain basic chunked upload for large files and why resuming beats restarting from scratch.',
    senior:
      "Explain the manifest-plus-segment model (HLS/DASH) and how a player's adaptive bitrate logic switches renditions at segment boundaries. Discuss why origin storage should be a cold fallback behind a CDN rather than the primary read path, and how transcoding is parallelized across time-segments and workers. Understand the long-tail caching problem and why watch-progress/engagement tracking must be decoupled from the playback path.",
    staffPlus:
      "Design the full separation between the latency-sensitive playback path (CDN-first, eventually consistent) and the ingest/transcoding path (durable, tolerant of backpressure). Discuss content-aware encoding, tiered/origin-shield caching, the eager-vs-on-demand rendition tradeoff and why it differs from an analogous image-resize tradeoff (transcode cost vs. resize cost), storage lifecycle tiering across a video's popularity curve, and proactive cache pre-warming for scheduled high-demand events versus reactive, popularity-driven caching for the long tail.",
  },

  keyTakeaways: [
    'Origin storage should almost never serve playback traffic directly — the CDN, backed by a regional origin shield, is the actual read path',
    'Adaptive bitrate switches only at segment boundaries, trading resolution for continuous playback rather than stalling',
    'Chunked, resumable upload decouples ingestion reliability from a single request lifetime; splitting transcoding by time-segment turns one long job into many short, independently-recoverable ones',
    "Eager-vs-on-demand rendition generation mirrors Photo Sharing's image-derivative tradeoff, but a transcode's much higher cost forces eagerly generating a safe ladder and lazily backfilling the long tail rather than generating on-demand inline with the request",
    'Watch-progress and engagement tracking must be architecturally decoupled from the playback path so analytics writes never block or slow streaming',
  ],

  relatedDesigns: ['photo-sharing', 'social-feed', 'news-aggregator'],
  relatedConcepts: [
    { name: 'CDN', description: 'Delivers manifests and video segments from edge locations near the viewer, absorbing almost all playback traffic.' },
    { name: 'Adaptive Bitrate Streaming', description: 'Segment-and-manifest model letting the player switch quality at segment boundaries based on measured throughput.' },
    { name: 'Object Storage', description: 'Durable, cold storage for raw uploads and transcoded renditions — never the primary playback read path.' },
    { name: 'Distributed Transcoding', description: 'Parallelizing video encoding across workers by time-segment and rendition to turn one long job into many short, recoverable ones.' },
  ],

  simulator: {
    goalDescription: 'Serve adaptive-bitrate video to hundreds of millions of viewers almost entirely from CDN edge cache, while asynchronously transcoding uploads into a bitrate ladder.',
    requirementChips: ['< 1-2s playback start', '~27PB/day served, almost all from CDN', '500K uploads/day transcoded'],
    targetRps: 100000,
    readRatio: 0.99,
    cacheHitRatio: 0.95,
    latencyBudgetMsP99: 1500,
    rubric: [
      { id: 'cdn-edge', label: 'CDN edge cache serving playback', kind: 'requires-node-type', nodeType: 'cdn' },
      { id: 'origin-storage', label: 'Cold origin storage as fallback, not primary read path', kind: 'requires-node-type', nodeType: 'object-store' },
      { id: 'transcode-workers', label: 'Worker fleet for parallel transcoding', kind: 'requires-node-type', nodeType: 'worker' },
      { id: 'metadata-db', label: 'Durable metadata store', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'compute-tier', label: 'Compute tier for upload/metadata services', kind: 'requires-node-type', nodeType: ['app-server', 'microservice'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'cdn-1', type: 'cdn', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'rend-1', type: 'object-store', instanceCount: 3, position: { x: 600, y: 200 } },
        { id: 'us-1', type: 'app-server', instanceCount: 2, position: { x: 320, y: 400 } },
        { id: 'workers-1', type: 'worker', instanceCount: 15, position: { x: 600, y: 400 } },
        { id: 'meta-1', type: 'microservice', instanceCount: 3, position: { x: 880, y: 400 } },
        { id: 'metadb-1', type: 'postgresql', instanceCount: 2, position: { x: 1160, y: 400 } },
      ],
      edges: [
        { id: 'e-client-cdn', source: 'client-1', target: 'cdn-1' },
        { id: 'e-cdn-rend', source: 'cdn-1', target: 'rend-1' },
        { id: 'e-client-us', source: 'client-1', target: 'us-1' },
        { id: 'e-us-workers', source: 'us-1', target: 'workers-1' },
        { id: 'e-workers-rend', source: 'workers-1', target: 'rend-1' },
        { id: 'e-workers-meta', source: 'workers-1', target: 'meta-1' },
        { id: 'e-meta-metadb', source: 'meta-1', target: 'metadb-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Playback is served almost entirely from the CDN edge cache, with origin rendition storage as a cold fallback only on a miss; uploads flow through a fully separate ingest pipeline where a worker fleet transcodes into a bitrate ladder before publishing metadata, so a spike in either path never touches the other.',
    failureModeNarratives: {
      'cdn': "Only one edge cache tier fronts origin storage; if it's undersized or a popular title's cache hasn't warmed yet, a viral spike routes the full bandwidth of that title straight at origin storage, which was never sized to serve playback traffic directly.",
    },
    fullDesignLinkSlug: 'video-streaming',
  },
}

export default topic
