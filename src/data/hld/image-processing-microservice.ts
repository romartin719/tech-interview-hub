import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'image-processing-microservice',
  title: 'Image Processing Microservice',
  difficulty: 'Intermediate',
  icon: 'pi pi-images',
  color: '#f472b6',
  readTimeMinutes: 18,
  topics: ['Async Processing', 'Object Storage', 'CDN Caching', 'Media Pipelines'],
  companies: ['Instagram', 'Cloudinary', 'imgix', 'Dropbox'],
  prerequisites: ['Caching', 'Message Queues'],
  summary:
    'An image processing microservice accepts uploaded images, hands the original off to object storage immediately, and asynchronously fans a queue-backed worker pool out to generate resized, cropped, and format-converted variants (thumbnails, web-optimized JPEG, WebP/AVIF) that are cached at a CDN edge so every future request for that image is served in single-digit milliseconds without touching the origin or a worker again.',

  understandingProblem:
    "Almost every product with user-generated media - a social app, an e-commerce catalog, a chat app - needs the same thing: accept an uploaded image once, and then serve it back in a dozen different shapes (a 40px avatar, a 400px feed thumbnail, a 1600px full-screen view, a WebP for Chrome and a JPEG for Safari). Doing that resize work at request time, on the thread that's also trying to say '200 OK, upload received,' is the trap almost everyone falls into first. The real system needs to: accept the upload fast, do the CPU-heavy transform work somewhere else, produce every size/format a client might ask for, and then never repeat that work again for the same image. The interesting engineering is entirely in the 'somewhere else' and the 'never repeat' parts.",
  realExamples:
    'Cloudinary: transforms images on-the-fly via URL parameters (w_300,h_300,f_auto) and caches the result after first request. imgix: same on-demand-plus-cache model, billed per origin fetch. Instagram: pre-computes a fixed set of variants (150px, 320px, 640px, 1080px) at upload time rather than on-demand. Dropbox: generates thumbnails asynchronously for previews across billions of stored files.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  api["API Server<br/>resize inline"]:::compute
  disk[("Local Disk")]:::storage
  client -->|"1. POST image"| api
  api -->|"2. Resize 5 variants<br/>on request thread"| api
  api -->|"3. Save all variants"| disk
  api -->|"4. 200 OK"| client`,
    },
    whyThisBreaks: [
      "Upload latency = upload time + processing time for every variant. Resizing to 5 sizes and 2 formats on a single CPU core can take 2-5 seconds - the client sits on a spinner the whole time.",
      'A CPU-bound resize job blocks the request-handling thread/process. A burst of uploads (e.g., a batch import) starves the API server of capacity to serve any other traffic, including reads.',
      "Local disk doesn't survive a server restart, isn't shared across pods, and can't be served globally - every image request has to route back to the one server that happens to have the file.",
      'If the server crashes mid-resize, the upload is silently lost - there is no record that the job was ever attempted, let alone a way to retry it.',
      "No dedup: the same image (or a byte-identical re-upload) gets processed from scratch every time, burning CPU and storage on work that was already done.",
    ],
    closingNote:
      "The fix is to treat 'accept the file' and 'transform the file' as two separate systems connected by a durable queue - the upload path becomes trivially fast, and the transform path can scale, retry, and fail independently.",
  },

  priorArt: [
    {
      title: 'Cloudinary On-the-Fly Transformations',
      description:
        'Transforms images on first request via URL parameters (e.g., /w_300,h_300,c_fill/photo.jpg), then caches the rendered variant so every subsequent request for that exact transformation is a cache hit. Popularized the "derive on-demand, cache forever" model for media pipelines. (Cloudinary engineering blog)',
      link: 'https://cloudinary.com/documentation/transformation_reference',
    },
    {
      title: 'imgix Real-Time Image Processing',
      description:
        'Renders resized/cropped/format-converted images at the CDN edge on the first request per URL variant, billing customers per unique origin fetch rather than per stored derivative - a strong argument for computing variants lazily instead of exhaustively pre-computing every possible size. (imgix architecture docs)',
      link: 'https://docs.imgix.com/en-US/tutorials/image-manipulation',
    },
    {
      title: 'Netflix Image Pipeline for Studio Assets',
      description:
        'Processes tens of millions of images per day across artwork variants using a queue-backed worker fleet with idempotent, content-hash-keyed jobs so retried or duplicate work never re-derives an already-computed asset. (Netflix Tech Blog)',
      link: 'https://netflixtechblog.com/',
    },
    {
      title: 'Dropbox Thumbnail Generation Service',
      description:
        'Generates preview thumbnails asynchronously for every uploaded file type at massive scale, using priority queues so interactive requests (a user waiting on a preview) jump ahead of bulk backfill jobs. (Dropbox Tech blog)',
      link: 'https://dropbox.tech/infrastructure',
    },
  ],

  coreEntities: [
    { name: 'Image', description: 'The logical asset: an imageId, owner, upload timestamp, content hash, and current processing status.' },
    { name: 'Original', description: 'The unmodified uploaded file as stored in object storage - the source of truth every variant is derived from.' },
    { name: 'Variant', description: 'One derived rendition: a (width, height, format, quality) tuple plus its object storage key and CDN URL.' },
    { name: 'TransformJob', description: 'A queued unit of work describing which variants to generate for which image; carries retry count and priority.' },
    { name: 'Manifest', description: "The set of variants that exist for an image and their generation status - what the API returns when a client asks 'is this ready?'" },
  ],

  requirements: {
    core: [
      'Accept image uploads fast - the upload request returns success as soon as the original is durably stored, without waiting for any processing',
      'Generate a fixed set of variants asynchronously - resize to standard dimensions (thumbnail, small, medium, large) and convert to modern formats (WebP/AVIF) alongside a JPEG fallback',
      'Serve processed variants globally with low latency - once generated, a variant should be served from a CDN edge, not re-computed or re-fetched from origin on every request',
      "Let clients check processing status - a client needs to know whether a specific variant is ready yet, so the app can show a placeholder until it is",
    ],
    belowTheLine: [
      'Fully on-demand arbitrary transformations via URL parameters (crop coordinates, filters, watermarks) - we pre-define a fixed variant set instead',
      'Content moderation / NSFW detection pipeline',
      'Video processing/transcoding (separate pipeline with very different cost and latency characteristics)',
      'Client-side upload UI (drag-drop, progress bars) - out of scope for the backend design',
      'Multi-region active-active origin replication',
    ],
    nonFunctionalTable: [
      { metric: 'Upload Response Time', target: 'p95 < 500ms - bounded by network transfer + a metadata write, not by processing' },
      { metric: 'Time to First Variant Ready', target: 'p95 < 5s from upload to thumbnail variant available' },
      { metric: 'Cache Hit Ratio (CDN)', target: '> 95% of variant reads served from edge, not origin' },
      { metric: 'Durability', target: '11 nines on originals - a derived variant can be regenerated, an original cannot' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Object Storage',
      purpose: 'Store originals and every generated variant',
      primaryPick: 'S3',
      alternatives: 'GCS, Azure Blob, MinIO (self-hosted)',
      whyPrimaryWins:
        'Decouples durability and capacity from compute, supports pre-signed URLs so clients can upload/download directly without proxying bytes through app servers, and is the origin every CDN falls back to on a cache miss',
    },
    {
      tier: 'Processing Queue',
      purpose: 'Decouple the upload request from the transform work',
      primaryPick: 'SQS',
      alternatives: 'Kafka, RabbitMQ, Google Pub/Sub',
      whyPrimaryWins:
        'Built-in visibility timeout and dead-letter redrive with zero cluster to operate - a natural fit for bursty, at-least-once, per-message transform jobs where ordering does not matter',
    },
    {
      tier: 'Worker Compute',
      purpose: 'Run the CPU-bound resize/convert jobs',
      primaryPick: 'Containerized worker pool (ECS/K8s), autoscaled on queue depth',
      alternatives: 'AWS Lambda, Fargate, a self-managed EC2 fleet',
      whyPrimaryWins:
        'Predictable warm-start latency and no per-invocation memory ceiling for large images - Lambda cold starts and its ~10GB memory cap become a real tax once large photos or batch jobs are common',
    },
    {
      tier: 'Processing Library',
      purpose: 'Resize, crop, and re-encode pixels',
      primaryPick: 'libvips (via the sharp Node binding)',
      alternatives: 'ImageMagick, Pillow, Squoosh/Wasm',
      whyPrimaryWins:
        'Streams pixels through a processing pipeline instead of loading the entire decoded bitmap into memory - 4-8x faster and a fraction of the RAM footprint of ImageMagick on large images',
    },
    {
      tier: 'CDN',
      purpose: 'Global edge caching and delivery of variants',
      primaryPick: 'CloudFront',
      alternatives: 'Cloudflare, Fastly, Akamai',
      whyPrimaryWins:
        'Tight native integration with S3 as origin, signed URLs for private content, and near-100% cache hit ratios once a variant URL is immutable and long-TTL',
    },
    {
      tier: 'Metadata Store',
      purpose: 'Image records, variant manifest, and processing status',
      primaryPick: 'DynamoDB',
      alternatives: 'Postgres, MongoDB',
      whyPrimaryWins:
        'Single-digit-millisecond point lookups by imageId at very high write volume without needing to plan a sharding strategy as upload volume grows organically',
    },
  ],
  technologyChoicesNote:
    "The two decisions that shape everything else: async over sync, and libvips over ImageMagick. Async because a resize job (200ms-2s per variant) run inline would make upload latency proportional to how many variants you generate - decoupling with a queue means the client sees a fast 'accepted' response and the fan-out to N variants happens off the critical path entirely. libvips over ImageMagick because it processes images as a streaming pipeline of demand-driven operations rather than materializing a full in-memory bitmap at every step - at a sustained rate of thousands of transform jobs per second, that difference in CPU and memory per job is the difference between needing 50 workers and needing 300.",

  scaleEstimation: [
    'Uploads: ~5M images/day on average, with peak-hour bursts around 300 uploads/sec (evening usage spikes for a consumer app)',
    'Variant fan-out: 5 variants per image (thumbnail, small, medium, large, plus a WebP re-encode of each JPEG) means 300 uploads/sec x 5 = 1,500 transform jobs/sec at peak',
    'Processing throughput: libvips resizes + re-encodes a variant in roughly 150-600ms of CPU time depending on source size; sustaining 1,500 jobs/sec needs on the order of 400-600 concurrent worker threads across the fleet',
    "Storage growth: 5M images/day x (~4MB original + ~750KB across 5 compressed variants) ≈ 24TB of new storage per day before any lifecycle tiering or deduplication",
    'Read/write ratio: images are viewed far more often than uploaded - a rough 50:1 read-to-write ratio means CDN egress traffic dwarfs origin/upload bandwidth by roughly two orders of magnitude',
    'Backlog risk: during a viral spike (e.g., a batch import or a trending post), queue depth can jump from near-zero to hundreds of thousands of pending jobs within minutes, which is exactly what worker autoscaling and priority queues exist to absorb',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/api/v1/images',
      description: 'Upload a new image. Stores the original synchronously and returns immediately; variant generation happens async.',
      example:
        '// Body (multipart or pre-signed direct-to-S3 upload)\n{ file, ownerId }\n\n// Response 202 Accepted\n{ imageId, contentHash, status: "PROCESSING", originalUrl }',
    },
    {
      method: 'GET',
      path: '/api/v1/images/{imageId}',
      description: 'Fetch the manifest for an image - which variants exist, their CDN URLs, and overall processing status.',
      example:
        '// Response\n{ imageId, status: "READY", variants: [ { size: "thumbnail", format: "webp", url: "https://cdn.example.com/img/abc123/thumb.webp" }, ... ] }',
    },
    {
      method: 'GET',
      path: '/api/v1/images/{imageId}/status',
      description: 'Lightweight polling endpoint for clients showing a placeholder until a specific variant is ready.',
      example: '// Response\n{ imageId, status: "PROCESSING", variantsReady: ["thumbnail"], variantsPending: ["large", "webp"] }',
    },
    {
      method: 'GET',
      path: '/cdn/img/{imageId}/{variant}.{format}',
      description: 'The actual variant URL a client renders. Served from CDN edge cache; falls through to origin only on a cache miss.',
      example: 'GET /cdn/img/abc123/thumbnail.webp -> 200 OK, Cache-Control: public, max-age=31536000, immutable',
    },
  ],
  apiSecurityNote:
    'Uploads go through a pre-signed S3 URL scoped to a single PUT and a short expiry, so the API server never proxies raw file bytes. Private images use signed CDN URLs with an expiry rather than public object ACLs, so a leaked URL cannot be replayed indefinitely.',

  highLevelDesignIntro:
    "Let's build this up incrementally: get uploads off the critical path first, then layer in the variant fan-out, the caching layer, and finally the resilience and scaling mechanics a production pipeline actually needs.",

  builds: [
    {
      title: 'Accept Uploads and Store Originals',
      body:
        "The first real fix over the naive version: separate 'receive the file' from 'do anything with the file.' The Upload Service's only job is to validate the request, write the original to object storage, record a metadata row, and respond - no resizing happens here at all yet.\n\nWhy this matters even before a queue exists: upload latency is now bounded by network transfer time and a single durable write, not by CPU-bound image processing. A 4MB photo upload now returns in a few hundred milliseconds instead of several seconds.",
      newComponents: [
        {
          name: 'Upload Service',
          description: 'Validates content-type and size, generates an imageId, writes the original to S3, and inserts a metadata row with status=UPLOADED.',
        },
        {
          name: 'Object Storage (S3)',
          description: 'Durable, write-once storage for the original file at a path like originals/{imageId}.',
        },
        {
          name: 'Metadata Store',
          description: 'Tracks each image record: imageId, ownerId, contentHash, status, and the variant manifest as it fills in.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  us[Upload Service]:::compute
  s3[("S3 Originals")]:::storage
  db[("Metadata Store")]:::database
  client -->|"1. POST image"| us
  us -->|"2. Store original"| s3
  us -->|"3. Write metadata<br/>status=UPLOADED"| db
  us -->|"4. 202 Accepted<br/>imageId"| client`,
      },
      closingNote:
        'Uploads are fast now, but nothing has actually resized anything - there is no thumbnail, no WebP, nothing a client can render yet. That work has to happen somewhere, and it needs to happen without blocking this response.',
    },
    {
      title: 'Move Processing Off the Request Path: Async Queue + Worker Pool',
      body:
        'The Upload Service publishes a transform job to a queue instead of doing any resizing itself. A separate pool of workers consumes jobs, does the actual libvips work, and updates the metadata store when done. If every worker is busy, jobs simply wait in the queue - uploads keep succeeding at full speed regardless of processing backlog.\n\nWorked example: at 300 uploads/sec and a queue that briefly falls behind during a burst, jobs queue up rather than being dropped or blocking new uploads. A worker fleet sized for steady-state (say, 100 workers at 3 jobs/sec each = 300 jobs/sec throughput) drains a 10,000-job backlog in about 33 seconds once the burst subsides - the user experience during the burst is "upload accepted instantly, thumbnail appears a few seconds later," never "upload failed" or "upload hung."',
      newComponents: [
        { name: 'Processing Queue (SQS)', description: 'Holds transform jobs: { imageId, s3Key, contentHash }. Decouples publish rate from processing rate.' },
        { name: 'Worker Pool', description: 'Stateless processes that pull jobs, download the original, run libvips, upload the result, and ack the message.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  us[Upload Service]:::compute
  s3[("S3 Originals")]:::storage
  db[("Metadata Store")]:::database
  q[Processing Queue]:::async
  w[Worker Pool]:::compute
  client -->|"1. POST image"| us
  us -->|"2. Store original"| s3
  us -->|"3. Write metadata"| db
  us -->|"4. Enqueue transform job"| q
  us -->|"5. 202 Accepted"| client
  q -->|"6. Deliver job"| w
  w -->|"7. Download original"| s3
  w -->|"8. Update status"| db`,
      },
      closingNote:
        'The queue absorbs bursts and keeps uploads fast, but right now a worker only produces one output image. We need it to fan out into the actual set of sizes and formats a real client needs.',
    },
    {
      title: 'Generate Multiple Output Variants (Resolutions + Formats)',
      body:
        "A single job now fans out into several derived renditions: thumbnail (150px), small (400px), medium (800px), large (1600px), each encoded as both WebP (smaller, modern browsers) and JPEG (universal fallback). The worker downloads the original once, decodes it once, and streams it through libvips's resize pipeline for each output combination - this reuses the expensive decode step instead of re-downloading and re-decoding per variant.\n\nWorked example: a 4000x3000 original decodes once (roughly 80-150ms for a 4MB JPEG), then each of the 8 output combinations (4 sizes x 2 formats) takes 30-80ms to resize and encode from the already-decoded buffer. Total per-image processing time lands around 400-750ms of CPU time, versus 8x the decode cost if each variant were handled as an independent job that re-fetched and re-decoded the original.",
      newComponents: [
        { name: 'Variant Manifest', description: 'A field on the image metadata record listing every (size, format) pair and its S3 key and status once generated.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  w[Worker]:::compute
  s3o[("S3 Originals")]:::storage
  decode["Decode once"]:::compute
  t1["Thumbnail<br/>WebP + JPEG"]:::compute
  t2["Small<br/>WebP + JPEG"]:::compute
  t3["Medium<br/>WebP + JPEG"]:::compute
  t4["Large<br/>WebP + JPEG"]:::compute
  s3v[("S3 Variants")]:::storage
  db[("Metadata Store")]:::database
  w -->|"1. Download original"| s3o
  w -->|"2. Decode"| decode
  decode -->|"3. Resize+encode"| t1
  decode -->|"4. Resize+encode"| t2
  decode -->|"5. Resize+encode"| t3
  decode -->|"6. Resize+encode"| t4
  t1 -->|"7. Upload variant"| s3v
  t2 -->|"7. Upload variant"| s3v
  t3 -->|"7. Upload variant"| s3v
  t4 -->|"7. Upload variant"| s3v
  w -->|"8. Update manifest"| db`,
      },
      closingNote:
        'Every size and format a client needs now exists in object storage. But every single read is still a request straight to S3 - fine for the first viewer of an image, wasteful for the next million.',
    },
    {
      title: 'Serve Variants Through a CDN Cache Layer',
      body:
        "Once a variant is written to S3, its URL is immutable - the same imageId + size + format combination will never change, because a re-upload gets a new imageId. That property makes these URLs perfect candidates for aggressive, long-TTL CDN caching: cache once at the edge, serve every subsequent request for that variant from the edge PoP nearest the requester, and never go back to origin.\n\nThis is the single highest-leverage change in the whole design: it turns a system whose read cost scales with traffic into one whose read cost is nearly flat, since the marginal cost of serving the 1,000,001st view of a popular thumbnail is a cache hit, not a compute or storage operation.",
      newComponents: [
        { name: 'CDN (CloudFront)', description: 'Caches each variant URL at edge PoPs with a 1-year, immutable Cache-Control header. Falls back to S3 as origin on a cache miss.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  cdn["CDN Edge"]:::edge
  s3v[("S3 Variants")]:::storage
  client -->|"1. GET variant URL"| cdn
  cdn -->|"2. Cache miss: fetch origin"| s3v
  cdn -->|"3. Cache hit: serve from edge<br/>on every future request"| client`,
      },
      closingNote:
        "Reads are now essentially free at scale. The remaining gaps are all about not doing wasted or duplicate work on the write side - starting with the same image being uploaded (or re-uploaded) more than once.",
    },
    {
      title: 'Idempotency and Deduplication via Content Hash',
      body:
        "Compute a content hash (SHA-256) of the uploaded bytes before enqueuing a transform job. If an image with that exact hash has already been processed, skip processing entirely and just point the new imageId's manifest at the existing variants - no worker time, no duplicate S3 objects.\n\nThis also solves a subtler correctness problem: at-least-once delivery from the processing queue means a job can be delivered twice (e.g., a worker crashes after uploading variants but before acking the message). Keying variant object writes by contentHash + size + format makes reprocessing the same job idempotent - the second attempt overwrites the same S3 key with the same bytes rather than creating a duplicate or corrupting a partially-written manifest.\n\nWorked example: a profile photo re-uploaded by 10,000 users who all picked the same stock avatar image hashes to the same value every time. Without dedup, that is 10,000 redundant processing jobs and 10,000 x 8 = 80,000 redundant variant objects in S3. With hash-based dedup, it's one processing job and 79,999 metadata rows that simply reference the same variant set.",
      diagram: {
        mermaid: `flowchart TD
  upload["New upload"]:::client
  hash["Compute SHA-256"]:::compute
  check{"Hash exists<br/>in manifest index?"}:::compute
  reuse["Point new imageId<br/>at existing variants"]:::database
  enqueue["Enqueue transform job"]:::async
  upload -->|"1. Hash bytes"| hash
  hash -->|"2. Lookup"| check
  check -->|"3. Yes: dedup"| reuse
  check -->|"4. No: process"| enqueue`,
      },
      closingNote:
        'Dedup keeps the worker fleet from doing redundant work. Next problem: not every job deserves the same wait time - a free-tier bulk import should not delay a paying user waiting on their profile photo.',
    },
    {
      title: 'Priority Queues for Premium vs Free Tier',
      body:
        "Route transform jobs into separate queues by priority - an interactive queue for uploads a user is actively waiting on (e.g., a profile photo, a chat image) and a bulk queue for background/batch work (e.g., a free-tier user importing 5,000 photos from an old account). Workers drain the interactive queue first and only pull from the bulk queue when it's empty, so one tenant's bulk import can never starve another user's time-sensitive upload.\n\nThis is the same pattern as a priority scheduler: without it, a single burst of low-priority jobs (a batch import) queues up ahead of high-priority jobs by pure FIFO ordering, and a user waiting three seconds for their avatar to render instead sees it stuck behind ten thousand imported vacation photos.",
      newComponents: [
        { name: 'Interactive Queue', description: 'High-priority queue for uploads a user is actively waiting on. Workers check this queue first.' },
        { name: 'Bulk Queue', description: 'Lower-priority queue for batch/background imports. Drained only when the interactive queue is empty.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  us[Upload Service]:::compute
  qi[Interactive Queue]:::async
  qb[Bulk Queue]:::async
  w[Worker Pool]:::compute
  us -->|"1. Interactive upload"| qi
  us -->|"2. Bulk import job"| qb
  qi -->|"3. Always checked first"| w
  qb -->|"4. Drained only when<br/>interactive queue empty"| w`,
      },
      closingNote:
        'Priority handles fairness under normal load. The remaining gap is correctness under failure - what happens when a specific job keeps failing, or a worker crashes mid-job.',
    },
    {
      title: 'Retries and Dead-Letter Queue for Failed Transforms',
      body:
        "Transform jobs fail for real reasons: a corrupted upload, an unsupported color profile, a truncated file from a flaky client connection. The queue's visibility timeout gives automatic retry for free - if a worker crashes or times out mid-job without acking, the message becomes visible again after the timeout and another worker picks it up. But a job that fails deterministically (a genuinely malformed file) would otherwise retry forever.\n\nCap retries at a small number (e.g., 3) with exponential backoff, then redirect the message to a dead-letter queue instead of retrying indefinitely. A separate low-volume consumer inspects the DLQ, flags the image as FAILED in the metadata store so the client stops polling for a variant that will never arrive, and alerts on-call if the DLQ rate crosses a threshold - since a spike in dead-lettered jobs usually means a bug in the processing code itself, not a bad file.",
      newComponents: [
        { name: 'Dead-Letter Queue (DLQ)', description: 'Receives jobs that failed 3 consecutive processing attempts, so they stop consuming worker capacity.' },
        { name: 'DLQ Reconciler', description: 'Consumes the DLQ, marks the image FAILED, and pages on-call if the DLQ rate spikes above a threshold.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  job["Transform job"]:::async
  w[Worker]:::compute
  ok{"Success?"}:::compute
  db[("Metadata Store")]:::database
  retry["Retry with backoff<br/>up to 3 attempts"]:::async
  dlq["Dead-Letter Queue"]:::async
  recon["DLQ Reconciler"]:::compute
  job -->|"1. Deliver"| w
  w -->|"2. Process"| ok
  ok -->|"3. Yes"| db
  ok -->|"4. No, attempts < 3"| retry
  retry -->|"5. Redeliver"| w
  ok -->|"6. No, attempts = 3"| dlq
  dlq -->|"7. Consume"| recon
  recon -->|"8. Mark FAILED"| db`,
      },
      closingNote:
        "Failures are now handled gracefully instead of retrying forever or vanishing silently. The last piece is making sure the worker fleet itself has enough capacity when demand spikes - and doesn't sit idle burning cost when it doesn't.",
    },
    {
      title: 'Horizontal Autoscaling of Workers Based on Queue Depth',
      body:
        "Fix the worker pool size to steady-state load and it either falls behind during a viral spike or sits over-provisioned (and over-billed) during quiet hours. Instead, scale the worker fleet on a queue-depth metric: if approximate messages visible in the interactive queue exceeds a threshold for more than a minute, add workers; if it stays near zero, scale back down toward a small floor.\n\nWorked example: steady-state is 300 jobs/sec handled by 100 workers. A post goes viral and upload rate triples to 900 jobs/sec for twenty minutes. Queue depth starts climbing immediately since 100 workers can't keep up; the autoscaler detects rising backlog within a minute and adds workers in steps until throughput matches the new arrival rate (roughly 300 workers to sustain 900 jobs/sec at the same per-worker rate). Once the spike passes, queue depth falls back near zero and the fleet scales back down over the following 15-20 minutes, avoiding both a stuck backlog and a permanently oversized fleet.",
      newComponents: [
        { name: 'Autoscaler', description: 'Watches queue depth (ApproximateNumberOfMessagesVisible) and scales the worker pool up or down within a min/max bound.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  q[Processing Queue]:::async
  metric["Queue depth metric"]:::compute
  scaler[Autoscaler]:::compute
  w1["Worker Pool<br/>100 to 300+ instances"]:::compute
  q -->|"1. Report depth"| metric
  metric -->|"2. Depth rising for 1min+"| scaler
  scaler -->|"3. Scale out"| w1
  metric -->|"4. Depth near zero"| scaler
  scaler -->|"5. Scale in"| w1`,
      },
      closingNote:
        'With autoscaling in place, the pipeline now handles the full lifecycle: fast uploads, deduplicated and prioritized async processing, resilient retries, and elastic capacity - all while reads stay nearly free thanks to the CDN layer built earlier.',
    },
  ],

  coreFlows: [
    {
      title: 'Image Upload and Processing',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant US as Upload Service
  participant S3 as Object Storage
  participant DB as Metadata Store
  participant Q as Processing Queue
  participant W as Worker

  C->>US: POST /images (file)
  US->>US: compute contentHash
  US->>S3: PUT originals/{imageId}
  S3-->>US: 200 OK
  US->>DB: INSERT image (status=UPLOADED)
  US->>Q: enqueue transform job
  US-->>C: 202 Accepted { imageId, status: PROCESSING }
  Q->>W: deliver job
  W->>S3: GET original
  W->>W: decode once, resize+encode 8 variants
  W->>S3: PUT each variant
  W->>DB: UPDATE manifest, status=READY`,
      },
      nonObviousFailure:
        "If the worker crashes after uploading variants to S3 but before updating the metadata store, the message is redelivered after the visibility timeout and reprocessed. Because variant object keys are derived from contentHash + size + format, the retry overwrites the exact same S3 keys with identical bytes - it's a safe no-op duplicate, not a corrupted or doubled result.",
    },
    {
      title: 'Processing Failure and Retry',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant Q as Processing Queue
  participant W as Worker
  participant DLQ as Dead-Letter Queue
  participant R as DLQ Reconciler
  participant DB as Metadata Store

  Q->>W: deliver job (attempt 1)
  W->>W: decode fails - corrupted file
  W-->>Q: nack / no ack before visibility timeout
  Q->>W: redeliver job (attempt 2)
  W->>W: decode fails again
  Q->>W: redeliver job (attempt 3)
  W->>W: decode fails again
  Q->>DLQ: move to dead-letter queue
  DLQ->>R: consume dead-lettered job
  R->>DB: UPDATE status=FAILED
  R->>R: alert on-call if DLQ rate spikes`,
      },
      nonObviousFailure:
        "A single genuinely corrupt file failing 3 times is expected and harmless. What operators actually watch for is the DLQ arrival *rate* - a sudden spike almost always means a bug shipped in the worker code itself (e.g., a new format the decoder can't handle) rather than a batch of bad uploads, which is why the reconciler alerts on rate, not on individual failures.",
    },
  ],

  deepDives: [
    {
      title: 'On-Demand vs Pre-Computed Variants',
      problem:
        'Every image needs to exist in several sizes and formats before a client can render it. The question is whether to generate all of those variants up front at upload time, or generate each one lazily the first time it is actually requested.',
      simpleTerms:
        'Do we resize an image into every size the moment it is uploaded, even if some sizes never get viewed? Or do we wait until someone actually asks for the 800px version and generate it then?',
      bad:
        'Generate every possible size and format combination for every uploaded image immediately, regardless of whether anything ever requests most of them. A large fraction of generated variants (e.g., the "large" desktop size for images almost exclusively viewed on mobile) are pure wasted compute and storage that nobody ever reads.',
      good:
        'Generate variants on-demand at first request, cached forever afterward (the imgix/Cloudinary model). This eliminates wasted work on variants nobody views, but it means the very first viewer of any given size pays a processing-latency penalty inline with their request, and a popular new image can trigger a burst of identical concurrent transform requests before the first one finishes and populates the cache.',
      great:
        'Hybrid: pre-compute only the variants that are used almost universally (a thumbnail, because virtually every image is shown in a feed or grid at least once), and generate everything else on-demand with request coalescing to prevent duplicate concurrent work. Request coalescing means: if 50 concurrent requests arrive for a variant that does not exist yet, only the first one triggers an actual transform job - the other 49 wait on that same in-flight job and all receive the result once it completes, rather than triggering 50 redundant resize operations (the classic thundering-herd-on-a-popular-image failure mode). This gets the low latency of pre-computation for the one variant that is always needed, and the storage/compute savings of on-demand for everything else, without paying the on-demand tax of duplicate work under concurrent load.',
      diagram: {
        mermaid: `flowchart TD
  req["50 concurrent requests<br/>for uncached variant"]:::client
  lock["In-flight job lock<br/>keyed by variant key"]:::cache
  first["First request:<br/>triggers transform job"]:::async
  wait["Other 49 requests:<br/>wait on same job"]:::client
  result["Variant generated once<br/>served to all 50"]:::compute
  req -->|"1. Check lock"| lock
  lock -->|"2. Not held: acquire"| first
  lock -->|"3. Held: attach as waiter"| wait
  first -->|"4. Complete"| result
  wait -->|"5. Notified"| result`,
      },
    },
    {
      title: 'Idempotent Processing and Deduplication via Content Hash',
      problem:
        'At-least-once delivery from a message queue means the same transform job can be processed twice. Separately, users frequently upload byte-identical images (stock avatars, reposted memes, the same file from two devices). Both problems have the same fix.',
      simpleTerms:
        "If the same image gets uploaded twice, or the same processing job gets delivered twice by the queue, we shouldn't do the resize work twice or end up with two different copies of the same result.",
      bad:
        'Key every variant object by a randomly generated ID with no relationship to the input bytes. A redelivered job re-processes the image and writes a second, different S3 object; two independent uploads of the identical file each generate and store their own full set of variants. Storage and compute both grow linearly with redundant uploads and redundant retries, and there is no way to tell after the fact that two variant sets are actually pixel-identical.',
      good:
        "Deduplicate uploads by content hash at write time - check if a matching hash already has a completed manifest, and if so, skip enqueuing a job entirely and just alias the new imageId to the existing variants. This solves the redundant-upload case well, but doesn't yet address idempotency within a single job's retries - if that one processing job is delivered twice, variant keys still need to resolve to the same object on both attempts.",
      great:
        "Combine both: (1) content-hash-based dedup at upload time skips reprocessing entirely for repeat uploads of the same bytes, and (2) derive every variant's S3 object key deterministically from contentHash + size + format (not a random UUID), so that even if the same transform job is delivered and processed twice due to at-least-once queue semantics, both attempts write to the exact same S3 key with the exact same bytes - the second write is a harmless overwrite, not a duplicate or a race. This makes the whole pipeline safe to retry at any layer without needing distributed locks: the object storage layer's own last-write-wins semantics on an identical key is the idempotency mechanism, for free.",
      diagram: {
        mermaid: `flowchart LR
  upload1["Upload A"]:::client
  upload2["Upload B<br/>same bytes"]:::client
  hash["SHA-256 hash"]:::compute
  manifest[("Manifest keyed<br/>by contentHash")]:::database
  variants[("S3 variants keyed by<br/>hash+size+format")]:::storage
  upload1 -->|"1. Hash"| hash
  upload2 -->|"2. Hash: identical"| hash
  hash -->|"3. Lookup manifest"| manifest
  manifest -->|"4. Already processed:<br/>reuse, no new job"| variants`,
      },
    },
  ],

  selfAudit: [
    { question: 'Why async instead of resizing inline?', answer: 'Upload latency would scale with variant count; async keeps uploads fast regardless of processing backlog.' },
    { question: 'Why libvips over ImageMagick?', answer: 'Streams pixels instead of materializing a full bitmap - 4-8x faster and far less memory per job at scale.' },
    { question: 'How is duplicate processing avoided?', answer: 'Content-hash-keyed variant object keys make retries idempotent; hash-based dedup skips reprocessing identical uploads.' },
    { question: 'What if a job fails permanently?', answer: 'Retry up to 3x with backoff, then dead-letter it and mark the image FAILED so clients stop polling.' },
    { question: 'How does one tenant\'s bulk import avoid starving others?', answer: 'Separate interactive vs bulk queues; workers always drain interactive first.' },
    { question: 'How does the fleet handle a viral spike?', answer: 'Autoscale worker count on queue depth, not on a fixed schedule.' },
    { question: 'Why not just serve everything from S3 directly?', answer: 'CDN caching makes reads nearly free at scale - S3-direct would put origin load on the critical path of every view.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  client[Client]:::client
  cdn["CDN Edge"]:::edge
  us[Upload Service]:::compute
  s3o[("S3 Originals")]:::storage
  s3v[("S3 Variants")]:::storage
  db[("Metadata Store")]:::database
  qi[Interactive Queue]:::async
  qb[Bulk Queue]:::async
  dlq[Dead-Letter Queue]:::async
  w[Worker Pool]:::compute
  scaler[Autoscaler]:::compute
  recon[DLQ Reconciler]:::compute

  client -->|"1. Upload image"| us
  us -->|"2. Compute hash + dedup check"| db
  us -->|"3. Store original"| s3o
  us -->|"4. Interactive job"| qi
  us -->|"5. Bulk import job"| qb
  qi -->|"6. Deliver, checked first"| w
  qb -->|"7. Deliver when idle"| w
  w -->|"8. Download original"| s3o
  w -->|"9. Upload variants"| s3v
  w -->|"10. Update manifest"| db
  w -->|"11. Failed 3x"| dlq
  dlq -->|"12. Consume"| recon
  recon -->|"13. Mark FAILED"| db
  scaler -->|"14. Scale on queue depth"| w
  client -->|"15. View image"| cdn
  cdn -->|"16. Cache miss: fetch origin"| s3v`,
  },

  keyTechnologies: [
    { term: 'Object Storage (S3)', definition: 'Durable, write-once blob storage for originals and every derived variant. Serves as the CDN origin.' },
    { term: 'Processing Queue', definition: 'Durable message queue (SQS/Kafka) that decouples the fast upload path from slow, CPU-bound transform work.' },
    { term: 'libvips', definition: 'A streaming image-processing library that resizes and re-encodes images without loading a full decoded bitmap into memory - far faster and lighter than ImageMagick.' },
    { term: 'CDN', definition: 'Edge cache network that serves immutable variant URLs from a PoP near the user, keeping origin/compute load nearly flat as traffic grows.' },
    { term: 'Content Hash Deduplication', definition: 'Using a hash (e.g., SHA-256) of the uploaded bytes as the dedup key and as part of the variant object key, making both re-uploads and retried jobs idempotent.' },
    { term: 'Dead-Letter Queue (DLQ)', definition: 'A holding queue for messages that failed processing repeatedly, so they stop consuming retry capacity and can be investigated separately.' },
  ],

  expectedDepth: {
    mid:
      'Recognize that image processing must happen off the upload request path. Propose a queue between an upload service and a worker pool, object storage for originals and variants, and a CDN in front of reads. Understand why resizing inline during upload is a latency and availability problem.',
    senior:
      'Design the full variant fan-out (multiple sizes and formats generated per job, decoding once and reusing the buffer), and explain the retry/DLQ story for permanently failing jobs. Propose content-hash-based deduplication and articulate why it also solves the idempotent-retry problem, not just the duplicate-upload problem. Discuss why libvips beats ImageMagick at this throughput.',
    staffPlus:
      'Address the on-demand vs pre-computed variant tradeoff directly, including request coalescing to prevent thundering-herd duplicate processing on a newly popular image. Discuss priority queues for tenant fairness (interactive vs bulk), autoscaling workers on queue depth with the numeric reasoning behind fleet sizing during a spike, and a cost model comparing pre-computing every variant against on-demand generation with caching.',
  },

  keyTakeaways: [
    'Separate "accept the upload" from "process the image" with a durable queue - upload latency should never depend on processing time',
    'Decode the original once and fan out to every size/format from the same decoded buffer instead of re-fetching and re-decoding per variant',
    'Content-hash-keyed variant storage makes both duplicate uploads and at-least-once queue retries idempotent for free',
    'CDN caching on immutable variant URLs turns read cost from scaling with traffic into a nearly flat cost - this is the highest-leverage layer in the whole design',
  ],

  relatedDesigns: ['photo-sharing', 'web-crawler', 'cloud-file-storage'],
  relatedConcepts: [
    { name: 'Message Queues', description: 'Decouples the fast upload path from slow, CPU-bound worker processing and absorbs bursty load.' },
    { name: 'Caching', description: 'CDN edge caching on immutable variant URLs keeps read cost nearly flat as traffic grows.' },
    { name: 'Object Storage', description: 'Durable, write-once storage for originals and derived variants, and the origin every CDN falls back to.' },
  ],
}

export default topic
