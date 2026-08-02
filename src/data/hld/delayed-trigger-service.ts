import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'delayed-trigger-service',
  title: 'Delayed Trigger Service',
  difficulty: 'Advanced',
  icon: 'pi pi-hourglass',
  color: '#06b6d4',
  readTimeMinutes: 26,
  topics: [],
  companies: [],
  prerequisites: ['Message Queues', 'Leader Election'],
  summary:
    'A service that fires HTTP callbacks at a future time. Short delays (≤15 min) go directly to a queue; long delays park in a database until a sweeper migrates them to the queue as their fire time approaches.',

  understandingProblem:
    'A delayed trigger service lets internal services register a callback with a future fire time (e.g., "ping me back in 30 minutes"). When the delay elapses, the service POSTs a response to a callback URL the caller provided. It\'s the building block behind reminders, payment retries, abandoned-cart nudges, "release the seat hold in 7 minutes," and "auto-cancel the order if not paid in 15 min."',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  caller[Caller service]:::client
  api[Trigger API]:::edge
  mem[("In-process map: triggerId to fireAt")]:::storage
  timer[ScheduledExecutorService]:::compute
  caller --> api
  api --> mem
  timer --> mem
  timer -->|"fires callback"| caller`,
    },
    whyThisBreaks: [
      'Process crash loses every pending trigger - no durability. If the box reboots, every "fire in 10 min" is gone.',
      'One JVM caps throughput - ScheduledExecutorService is fine for thousands of timers, hopeless at millions.',
      'No horizontal scale - two replicas would each fire the callback, giving duplicates.',
      'No retry on callback failure - if the caller\'s endpoint is down at fire time, the trigger is silently lost.',
      'No long delays - JVM heap pressure with millions of DelayedTask objects.',
      'Hot fire-time spikes - "fire at top of the hour" thundering herd would saturate the executor.',
    ],
    closingNote:
      'The rest of the doc evolves this into a durable, sharded, bucketed scheduler with a timing-wheel front end and at-least-once HTTP callback delivery.',
  },

  priorArt: [
    {
      title: 'Airbnb Dynein',
      description:
        'Short-delay jobs (≤15 min) go straight to SQS; long-delay jobs sit in DynamoDB and a sweeper moves them to SQS as fire time approaches. We borrow this two-tier split. (Airbnb Engineering)',
      link: 'https://medium.com/airbnb-engineering/dynein-building-a-distributed-delayed-job-queueing-system-93ab10f05f99',
    },
    {
      title: 'Apache Kafka Purgatory + Hierarchical Timing Wheels',
      description:
        'O(1) insert/expire for millions of in-memory timers across multiple resolutions. We use this for the hot, near-future tier. (Confluent / Kafka Engineering)',
      link: 'https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/',
    },
    {
      title: 'AWS SQS Delay Queues',
      description:
        'Built-in 0-15 min delay primitive. We treat SQS as the "execution lane" once a trigger is within 15 min. (AWS documentation)',
      link: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-delay-queues.html',
    },
    {
      title: 'Stripe Idempotency-Key',
      description:
        "Caller-supplied idempotency key on register so repeated submissions don't create duplicate triggers. (Stripe API docs)",
      link: 'https://docs.stripe.com/api/idempotent_requests',
    },
    {
      title: 'Netflix Maestro',
      description:
        'Sharded execution layer; we use the same partition-by-triggerId model so each shard is independently leader-led. (Netflix / ByteByteGo)',
      link: 'https://netflixtechblog.com/maestro-netflixs-workflow-orchestrator-ee13a06f9c78',
    },
    {
      title: 'Technology Choices: Storage & Queue Tiers',
      description:
        "OLTP trigger store (triggerId, callerId, callbackUrl, fireAt, payload, status, idempotencyKey): Cassandra or DynamoDB, partition key = fireAt bucket, alternatives ScyllaDB/Bigtable. Short-delay execution lane: SQS delay queue, alternatives RabbitMQ delayed exchange or Redis Streams + ZSET. In-memory timer wheel: hierarchical timing wheel in-process, alternatives Netty HashedWheelTimer or a Redis sorted set per bucket. Long-delay sweep index: secondary index on Cassandra (partition = bucket minute), alternative DynamoDB GSI on fireAtMinute. Idempotency cache: Redis with TTL = max delay + grace, alternative DynamoDB with TTL. Audit/DLQ: Kafka topic + S3 sink, alternative Kinesis Firehose. Why Cassandra for the trigger store, not Postgres: writes dominate (every register is a write, every fire is an update), and the access pattern is partition key = fireAt-bucket → range scan within the bucket - exactly what wide-column stores are built for. Postgres would work but you'd be hand-rolling sharding and the time-series indexing.",
    },
  ],

  coreEntities: [
    {
      name: 'Trigger',
      description: 'id, callerId, callbackUrl, payload, fireAt, status (PENDING / IN_FLIGHT / FIRED / FAILED / CANCELLED), attemptCount.',
    },
    { name: 'Caller', description: 'Registered service with auth credentials and (optionally) per-tenant rate limits.' },
    { name: 'Bucket', description: "A 1-minute window keyed by floor(fireAt). Triggers live in their bucket's row in Cassandra." },
    { name: 'Dispatcher', description: 'Worker that turns "trigger is due" into "HTTP POST to callbackUrl."' },
    { name: 'Sweeper', description: 'Process that scans upcoming buckets and pushes due-soon triggers into the in-memory wheel.' },
  ],

  requirements: {
    core: [
      'registerTrigger(callerId, callbackUrl, payload, delaySeconds, idempotencyKey) returns a triggerId. Persists the intent durably.',
      'At now + delaySeconds, the service POSTs {triggerId, payload} to callbackUrl and considers the trigger fired only after a 2xx ack.',
      'cancelTrigger(triggerId) - best-effort cancel before fire time.',
    ],
    belowTheLine: [
      'Recurring / cron-like triggers.',
      'Workflow chaining (trigger A fires trigger B).',
      'Per-caller priority / rate limits beyond fairness.',
      'Cross-region active-active.',
    ],
    nonFunctionalTable: [
      {
        metric: 'Durability',
        target: 'Once register() returns 200, the trigger must fire even if every component crashes - no silent drops.',
      },
      { metric: 'On-time firing', target: 'P99 jitter < 1s for short delays, < 5s for long (>15 min) delays.' },
      { metric: 'Throughput', target: '100K registers/sec, 100K fires/sec at peak.' },
      {
        metric: 'At-least-once + idempotent',
        target: 'Callback may fire twice; caller must dedupe via triggerId.',
      },
    ],
  },

  technologyChoices: [
    {
      tier: 'OLTP Trigger Store',
      purpose: 'Durable trigger records: triggerId, callerId, callbackUrl, fireAt, payload, status, idempotencyKey',
      primaryPick: 'Cassandra / DynamoDB (partition key = fireAt bucket)',
      alternatives: 'ScyllaDB, Bigtable',
      whyPrimaryWins:
        'Writes dominate (every register is a write, every fire is an update), and partition key = fireAt-bucket with a range scan within the bucket is exactly what wide-column stores are built for.',
    },
    {
      tier: 'Short-Delay Execution Lane',
      purpose: 'Holds triggers within 15 minutes of firing until a dispatcher picks them up',
      primaryPick: 'SQS (delay queue)',
      alternatives: 'RabbitMQ delayed exchange, Redis Streams + ZSET',
      whyPrimaryWins: 'Managed delay-queue semantics (DelaySeconds) mean we never hand-roll visibility-timeout and redelivery logic on the hot execution path.',
    },
    {
      tier: 'In-Memory Timer Wheel',
      purpose: 'Fires callbacks with sub-second precision as their fire time arrives',
      primaryPick: 'Hierarchical timing wheel, in-process',
      alternatives: 'Netty HashedWheelTimer, Redis sorted set per bucket',
      whyPrimaryWins: 'O(1) insert and expiry smooths thousands of simultaneous fire times into a steady release rate, which is what keeps SQS from seeing a thundering herd at the top of every hour.',
    },
    {
      tier: 'Long-Delay Sweep Index',
      purpose: 'Lets the sweeper efficiently find "all triggers due in the next bucket"',
      primaryPick: 'Secondary index on Cassandra (partition = bucket minute)',
      alternatives: 'DynamoDB GSI on fireAtMinute',
      whyPrimaryWins: 'One partition read per bucket instead of a full-table scan for far-future triggers.',
    },
    {
      tier: 'Idempotency Cache',
      purpose: 'Maps (callerId, idempotencyKey) to triggerId so retries never double-register',
      primaryPick: 'Redis with TTL = max delay + grace',
      alternatives: 'DynamoDB with TTL',
      whyPrimaryWins: 'Sub-ms GET/SET keeps the idempotency check off the critical path of every register call.',
    },
    {
      tier: 'Audit / DLQ',
      purpose: 'Captures callbacks that failed after N retries for investigation',
      primaryPick: 'Kafka topic + S3 sink',
      alternatives: 'Kinesis Firehose',
      whyPrimaryWins: 'A durable, replayable log gives operators a queryable trail of every failed delivery without blocking the main dispatch path.',
    },
  ],
  technologyChoicesNote:
    "Why Cassandra over Postgres for the trigger store? Writes dominate - every register is a write, every fire is an update - and the access pattern (partition key = fireAt-bucket, range scan within the bucket) is exactly what wide-column stores are built for; Postgres would work but you'd be hand-rolling sharding and the time-series indexing yourself. Why an in-process timing wheel when SQS already supports delay? SQS caps out at a 15-minute delay, and the wheel smooths bursts of simultaneously-due triggers into a steady trickle of SQS sends instead of a thundering herd.",

  scaleEstimation: [
    'Users: 50M pending triggers at any given time across all callers',
    'Write QPS: 500K new triggers/hour (~140 triggers/sec), 10K fires/sec at peak',
    'Read QPS: Sweeper scans 1K buckets/sec, 5K status queries/sec from callers',
    'Storage: 200GB trigger metadata/year (Cassandra, with TTL cleanup after firing)',
    'Bandwidth: <1s jitter SLA for firing - timing wheel precision in the 100ms range',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/triggers',
      description:
        'Register a delayed trigger. Requires an Idempotency-Key header; the caller supplies a callbackUrl, payload, and delaySeconds.',
      example:
        '// Request\nAuthorization: Bearer <caller JWT>\nIdempotency-Key: <client-supplied uuid>\n\n{\n  "callbackUrl": "https://orders.internal/seat-hold/expire",\n  "payload":     {"holdId": "h_8c4"},\n  "delaySeconds": 420\n}\n\n// Response 200\n{ "triggerId": "trg_01HZ...", "fireAt": "2026-06-12T14:31:00Z" }',
    },
    {
      method: 'DELETE',
      path: '/v1/triggers/{triggerId}',
      description: "Best-effort cancel a pending trigger before its fire time.",
      example: 'Authorization: Bearer <caller JWT>',
    },
    {
      method: 'POST',
      path: '<callbackUrl> (caller-supplied)',
      description:
        'Outbound callback the dispatcher fires when a trigger is due. Caller responds 2xx for ack; anything else (or a timeout) triggers a retry with exponential backoff, eventually landing in the DLQ.',
      example:
        'POST <callbackUrl>\nX-Trigger-Id: trg_01HZ...\nX-Trigger-Attempt: 1\n\n{ "triggerId": "trg_01HZ...", "payload": {"holdId": "h_8c4"} }',
    },
  ],
  apiSecurityNote:
    'Caller authenticated via short-lived JWT minted for the service identity; callbackUrl validated against an allow-list of registered base URLs per caller (prevents using us as an SSRF springboard). Payload size capped at 4 KB.',

  highLevelDesignIntro: "We'll layer in components as the three FRs demand them.",

  builds: [
    {
      title: 'FR1: Register a Trigger',
      body:
        "The first thing a caller needs: register a delayed trigger and get back a durable guarantee that it will eventually fire - even if the caller's own request retries after a network blip.",
      insightCallout:
        "Idempotency means: if the caller's network drops and they retry, we return the same triggerId instead of creating a second trigger. Safe retries.",
      newComponents: [
        {
          name: 'Trigger API',
          description: 'The HTTP service callers hit to register or cancel triggers. Validates requests and handles idempotency.',
        },
        {
          name: 'Redis Idempotency Cache',
          description:
            "Stores (callerId, idempotencyKey) → triggerId so retried requests don't create duplicate triggers.",
        },
        {
          name: 'Cassandra (partitioned by fire-time bucket)',
          description:
            'Durable storage for all triggers. Partitioned by the 1-minute window containing fireAt, so the sweeper can efficiently ask "give me all triggers due in minute M" with one partition read.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  caller[Caller]:::client
  api[Trigger API]:::edge
  idem[("Redis idempotency cache")]:::cache
  db[("Cassandra: partition by fireAt-minute")]:::database
  caller -->|"1. Register trigger"| api
  api -->|"2. Check idempotency key"| idem
  api -->|"3. Persist trigger"| db`,
      },
      steps: [
        'Caller (e.g., the Order Service) calls POST /v1/triggers with a callback URL and delaySeconds: 420 (7 minutes) - "Call me back in 7 minutes to expire this seat hold"',
        'Trigger API checks Redis: have we seen this (callerId, idempotencyKey) before? If yes → return the cached triggerId (no duplicate created)',
        'API computes fireAt = now + 420s, generates a unique ULID triggerId, and writes the row to Cassandra. The partition key is the 1-minute bucket containing fireAt (e.g., 14:31) - this groups triggers by fire time for efficient sweeping later',
        'API caches the triggerId in Redis under the idempotency key (TTL = delay + grace period) so future retries short-circuit',
        'Returns 200 OK with the triggerId and exact fireAt timestamp',
      ],
      closingNote:
        'Why partition by 1-minute buckets? The sweeper needs to efficiently find "all triggers about to fire." Without bucketing, it would scan millions of rows. With bucketing, it reads one partition per minute - a single disk seek in Cassandra.',
    },
    {
      title: 'FR2: Fire the Callback at the Right Time',
      body:
        'We split by delay length, borrowing from Dynein:\n\nShort delay (≤15 min) - push directly to SQS with DelaySeconds = delay. SQS handles the wait, the dispatcher picks up the message when visible. We keep the Cassandra row as the source of truth.\n\nLong delay (>15 min) - leave it in Cassandra. The Sweeper scans the next bucket every 30s and, when within 15 min of fireAt, pushes into SQS the same way. This caps the in-memory state and lets the long tail live cheaply in Cassandra.',
      newComponents: [
        {
          name: 'Sweeper (leader-elected, per shard)',
          description:
            'Scans Cassandra for triggers due in the next 15 minutes and loads them into the timing wheel. Leader election ensures only one sweeper owns each shard - without it, duplicate fires would happen.',
        },
        {
          name: 'Timing Wheel (in-process)',
          description:
            "A ring-buffer data structure that fires callbacks at precise times with O(1) insert and expiry. Think of it as an alarm clock with thousands of slots - you set the alarm (insert), and when the hand reaches your slot, it goes off (expires). Kafka's internals use this exact structure.",
        },
        {
          name: 'SQS (delay queue)',
          description:
            'The execution lane. Once a trigger is within seconds of firing, the timing wheel pushes it to SQS. Dispatchers consume from SQS.',
        },
        {
          name: 'Dispatcher Pool',
          description:
            "Workers that pull from SQS, read the trigger from Cassandra, and POST the callback to the caller's URL. Stateless; scales horizontally.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  db[("Cassandra")]:::database
  sweeper[Sweeper: scans next bucket]:::compute
  wheel{{"Timing wheel per shard"}}:::compute
  sqs[["SQS delay queue"]]:::async
  api[Trigger API]:::edge
  disp[Dispatcher pool]:::compute
  callercb[Caller callback URL]:::client

  db -->|"1. Scan bucket"| sweeper
  sweeper -->|"2. Load into wheel"| wheel
  wheel -->|"3. Push when due"| sqs
  api -->|"4. Short delay enqueue"| sqs
  sqs -->|"5. Consume message"| disp
  disp -->|"6. POST callback"| callercb`,
      },
      steps: [
        "Sweeper runs per shard, leader-elected via ZooKeeper/etcd. Every 30 seconds, it scans Cassandra for the bucket that's about to enter the 15-minute firing window",
        'Each trigger from the scan is inserted into the in-process timing wheel - O(1) per insert, handles millions of pending triggers per shard',
        'When a wheel slot expires (fire time arrives!), the triggerId is pushed to SQS with a tiny DelaySeconds (usually 0-60s of slack)',
        'Dispatcher pulls from SQS, reads the current trigger row from Cassandra (checking status - it might have been cancelled!), and POSTs the payload to the callback URL',
        'On 2xx response → dispatcher writes status = FIRED to Cassandra and deletes the SQS message. Done!',
        'On non-2xx or timeout → dispatcher requeues to SQS with exponential backoff (10s → 30s → 2min → 10min → 30min). After N attempts → Dead Letter Queue',
        'If dispatcher crashes after POST but before deleting from SQS → SQS visibility timeout expires → another dispatcher picks up and retries. The caller dedupes on triggerId - at-least-once is the contract',
      ],
      closingNote:
        "Why the timing wheel when SQS already has delay? Two reasons: (a) SQS caps at 15-minute delay - not enough for our 30-day triggers. (b) At the top of the hour, 200K triggers all want DelaySeconds=0 simultaneously. The wheel acts as a smoothing front-end, releasing messages into SQS in sub-second batches so the dispatcher pool sees an even rate instead of a thundering herd.\n\nWhy does the dispatcher read from Cassandra before firing? The SQS message only holds the triggerId (to keep messages small). More importantly, the trigger might have been cancelled since it was enqueued - checking status at fire time is the \"lazy cancel\" pattern that avoids expensive queue surgery.",
    },
    {
      title: 'FR3: Cancel a Trigger',
      body:
        'New components we need: none! Cancellation reuses existing infrastructure - it just flips a status flag in Cassandra that the dispatcher checks at fire time.',
      newComponents: [],
      diagram: {
        mermaid: `flowchart LR
  caller[Caller]:::client
  api[Trigger API]:::edge
  db[("Cassandra: set status=CANCELLED")]:::database
  disp[Dispatcher]:::compute
  drop[Discard]:::storage

  caller -->|"1. Cancel request"| api
  api -->|"2. Set CANCELLED"| db
  disp -->|"3. Check status"| db
  disp -.->|"skips if cancelled"| drop`,
      },
      steps: [
        'Caller hits DELETE /v1/triggers/{triggerId} → API sets status = CANCELLED in Cassandra (only if current status is PENDING)',
        "We DON'T try to remove the trigger from SQS or the timing wheel - that's too racy and SQS doesn't support targeted deletion by content",
        "When the trigger's fire time arrives, the dispatcher reads the row, sees CANCELLED, and quietly drops it without firing the callback",
        'This is "lazy cancel": the cancel is durable instantly, but the trigger message may sit in the queue until its fire time before being discarded',
      ],
      closingNote:
        "Why not remove from the queue immediately? SQS doesn't support \"find and delete message with triggerId X.\" And even if it did, there's a race: the message might be in-flight to a dispatcher at the exact moment you try to cancel. Lazy cancel avoids all these races - the flag in Cassandra is the single source of truth, checked at the last possible moment.",
    },
  ],

  coreFlows: [
    {
      title: 'Flow A: Register + Fire (Short Delay, ≤15 min)',
      diagram: {
        mermaid: `sequenceDiagram
  participant C as Caller
  participant A as Trigger API
  participant R as Redis idem cache
  participant D as Cassandra
  participant Q as SQS
  participant W as Dispatcher
  C->>A: POST /triggers (delay=120s)
  A->>R: GET (callerId, idemKey)
  alt cache hit
    R-->>A: triggerId
    A-->>C: 200 (cached id)
  else miss
    A->>D: INSERT trigger row PENDING
    A->>Q: SendMessage DelaySeconds=120 body=triggerId
    A->>R: SET idemKey=triggerId TTL=180
    A-->>C: 200 triggerId
  end
  Note over Q: 120s elapse
  Q-->>W: receive message
  W->>D: SELECT trigger
  W->>C: POST callbackUrl payload
  alt 2xx
    C-->>W: 200
    W->>D: UPDATE status=FIRED
    W->>Q: DeleteMessage
  else non-2xx or timeout
    W->>Q: ChangeMessageVisibility backoff
  end`,
      },
      nonObviousFailure:
        'Dispatcher crashes after POST but before deleting from SQS. SQS visibility timeout expires, another dispatcher receives the message, POSTs again. The caller is expected to dedupe on triggerId - at-least-once is the contract.',
    },
    {
      title: 'Flow B: Long Delay (> 15 min)',
      diagram: {
        mermaid: `sequenceDiagram
  participant C as Caller
  participant A as Trigger API
  participant D as Cassandra
  participant S as Sweeper
  participant TW as Timing wheel
  participant Q as SQS
  participant W as Dispatcher
  C->>A: POST /triggers (delay=2h)
  A->>D: INSERT bucket=now+2h status=PENDING
  A-->>C: 200 triggerId
  Note over S: every 30s
  S->>D: SELECT * FROM bucket=now+15m
  D-->>S: rows due in next 15min
  S->>TW: insert(fireAt, triggerId)
  Note over TW: wheel ticks
  TW->>Q: SendMessage triggerId DelaySeconds=remaining
  Q-->>W: receive
  W->>D: SELECT and POST callback`,
      },
      nonObviousFailure:
        "Sweeper leader crashes mid-scan. ZooKeeper detects the session loss, elects a new leader. The new leader rescans the bucket - Cassandra row's status is still PENDING so it gets re-inserted into the wheel. Possible duplicate fire if the old leader had already pushed to SQS; dedupe on triggerId handles it.",
    },
    {
      title: 'Trigger State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> PENDING: register (persisted in Cassandra)
  PENDING --> CANCELLED: cancel
  PENDING --> IN_FLIGHT: dispatcher picks up
  IN_FLIGHT --> FIRED: 2xx ack
  IN_FLIGHT --> FAILED: N retries fail (DLQ)
  CANCELLED --> [*]
  FIRED --> [*]
  FAILED --> [*]`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Hot Bucket: Thundering Herd at Popular Fire Times',
      problem:
        "Delays like \"remind me in 1 hour\" cluster on the same fireAt second (e.g., the top of every hour) because so many callers round to the same interval. If all of them land in one Cassandra partition, that partition - and the sweeper's read of it - becomes a hot-spot bottleneck.",
      bad: 'Single Cassandra partition keyed by bucket = fireAt minute. At 14:00:00 sharp every cron-aligned trigger lands in the same partition. Cassandra hot partition warning, sweeper read fan-out spikes, and the wheel inserts a million entries in one go. Latency for that bucket blows up.',
      good: 'Sub-shard the bucket. Partition key becomes (bucket, hash(triggerId) % 64). The single 14:00 minute is now 64 partitions, evenly distributed. Sweeper runs 64 parallel reads (one per sub-shard).',
      great:
        'Combine sub-sharding with jittered fireAt. Caller asks for delay = 1h; we add ±5s of jitter (fireAt = requested + rand(-5s, +5s)). This is invisible to the caller (they wanted "in roughly an hour") but spreads the load across many seconds. For callers that need exact timing (e.g., delay = 0), skip the jitter - usually the exact-timing callers are a small fraction. Borrowed from Airbnb Dynein\'s load-spreading approach.',
      diagram: {
        mermaid: `flowchart LR
  hot[["fireAt=14:00:00 - 1M triggers"]]:::async
  sub[Sub-shard by hash(triggerId) % 64]:::compute
  p0[("partition 14:00 #0")]:::database
  p1[("partition 14:00 #1")]:::database
  pn[("partition 14:00 #63")]:::database

  hot -->|"1. Distribute"| sub
  sub -->|"2. Route to shard"| p0
  sub -->|"3. Route to shard"| p1
  sub -->|"4. Route to shard"| pn`,
      },
    },
    {
      title: 'Exactly-Once-ish: Idempotency on Register and Dedupe at Fire',
      problem:
        "A caller's register request can get dropped by a network blip and retried. Without protection, the retry creates a second trigger row, and both fire - two callbacks for what the caller intended as one.",
      bad: 'Caller retries the register request after a network blip. We create two trigger rows. Two callbacks fire at the same time. Caller is confused.',
      good: 'Caller supplies Idempotency-Key. API stores (callerId, idemKey) → triggerId in Redis with TTL covering the delay. Repeat requests get the same triggerId.',
      great:
        'Combine register-side idempotency with fire-side dedupe. The dispatcher writes status = FIRED using a Cassandra IF status = IN_FLIGHT condition. If two dispatchers race on the same SQS message (visibility-timeout edge case), one wins the conditional write, the other gets a "no-op" and skips the callback. Borrowed from Stripe\'s idempotency layer pattern. The caller still has to be ready for at-least-once because the conditional write reduces but doesn\'t eliminate duplicates (window between POST returning 2xx and the conditional write).',
    },
    {
      title: 'Long-Delay Tail: 30-Day Triggers Without Bloating SQS',
      problem:
        "Some triggers fire 30 days out (e.g., subscription renewals), far beyond SQS's 15-minute delay cap. The system needs a way to hold long-delay triggers cheaply without ballooning the hot path.",
      bad: "Push 30-day triggers to SQS with DelaySeconds=2592000. SQS doesn't support that - caps at 15 min.",
      good: 'Keep them in Cassandra; sweeper migrates them to SQS within 15 min of fire. Already the design.',
      great:
        'Bucket-aligned Cassandra TTL so old fired/cancelled rows auto-purge. Set TTL on inserts to delaySeconds + 30 days so audit data sticks around but the active table stays lean. For super-long delays (> 30 days, e.g., subscription renewal in 1 year), promote to a separate cold table (triggers_cold) and have a daily job migrate rows back into the hot table when they\'re a day away. Borrowed from Dynein\'s "secondary store for far-future" pattern.',
    },
    {
      title: 'Bad Caller Endpoints: Blocking Dispatchers',
      problem:
        "One caller's callbackUrl can hang (e.g., a 60-second read timeout). If dispatchers block on that call, the whole dispatcher pool can fill with stuck threads, turning one bad caller into a platform-wide outage.",
      bad: "One caller's callback URL hangs (60s read timeout). Dispatcher pool fills with stuck threads. All other triggers stall. Single-tenant outage becomes platform-wide.",
      good: "Per-caller dispatcher pools with bulkhead semantics. Each caller gets a slice of the pool capped at, say, 100 concurrent calls. A misbehaving caller can saturate their own slice but not others'.",
      great:
        'Circuit breaker per caller (e.g., Resilience4j). Track success rate per callerId; if >50% errors over the last 30s, open the circuit and fast-fail callbacks to that caller for 60s, dumping them to a per-caller delayed retry SQS. This both protects the dispatcher pool and gives the caller breathing room to recover. Pair with a dashboard surfacing "callers with open circuit" so on-call can reach out. Borrowed from Netflix Hystrix-style isolation. Circuit breaker means: if a downstream service fails X times in a row, stop calling it for a cooldown period (the circuit "opens"). Prevents cascading failures and gives the failing service time to recover.',
      diagram: {
        mermaid: `flowchart LR
  sqs[["main SQS"]]:::async
  disp[Dispatcher]:::compute
  cb{Per-caller circuit breaker}:::compute
  healthy[Healthy callers - POST]:::client
  open[["Open circuit retry SQS"]]:::async

  sqs -->|"1. Deliver message"| disp
  disp -->|"2. Check breaker"| cb
  cb -->|"3. POST to healthy"| healthy
  cb -->|"4. Fast-fail to retry"| open
  open -.->|"30s later"| disp`,
      },
    },
    {
      title: 'Cancellation Race: Cancel Arrives Mid-Fire',
      problem:
        'A cancel request and a dispatcher firing can race: the caller cancels at T-2s, but a dispatcher that read the trigger status a moment earlier at T-3s still fires it at T+0, confusing the caller.',
      bad: 'Caller cancels at T-2s; dispatcher reads status = PENDING at T-3s, fires at T+0. Caller confused.',
      good: 'Dispatcher reads status at the moment of dispatch (just before POST), not when the SQS message is received.',
      great:
        "Use a Cassandra LWT (UPDATE ... IF status='PENDING') to atomically transition PENDING → IN_FLIGHT right before POST. If the cancel raced and won, the LWT fails and dispatcher skips. This gives us a consistent linearization point at fire time.",
    },
    {
      title: 'Dead-Letter / Reconciliation',
      problem:
        'Bugs in the sweeper or leader election can leave a trigger stuck in PENDING or IN_FLIGHT forever if nothing goes back to check on it, and failed callbacks need somewhere to land instead of blocking the main queue.',
      bad: 'A callback that fails N times has nowhere defined to go, and a trigger that gets leaked by a sweeper/leader-election bug just sits there forever, silently never firing.',
      good: 'Failed callbacks after N retries land in a DLQ topic (Kafka). A small operator dashboard surfaces failures by caller.',
      great:
        'Add a reconciler job that runs hourly: scans Cassandra for rows with fireAt < now - 1h and status IN (PENDING, IN_FLIGHT) - these are leaks. They get re-pushed to SQS. This is the safety net for any sweeper / leader-election bug. Borrowed from Dynein\'s reconciler.',
    },
  ],

  selfAudit: [
    {
      question: 'Single point of failure?',
      answer:
        'Cassandra is multi-DC replicated, SQS is regional with built-in redundancy, Redis cache is tolerable to lose (just rebuild from Cassandra). API and dispatchers are stateless behind a load balancer.',
    },
    {
      question: 'Stale reads?',
      answer:
        "Dispatcher LWT on IF status='PENDING' is strongly consistent (Paxos round). The sub-second window between LWT and HTTP POST is the at-least-once gap, accepted.",
    },
    { question: 'Hot partition?', answer: 'Addressed with sub-sharding + jitter (see the Hot Bucket deep dive).' },
    { question: 'DLQ + reconciliation story?', answer: 'Covered by the Dead-Letter / Reconciliation deep dive.' },
    {
      question: 'Cost callout for hot tier?',
      answer:
        'SQS at 100K msgs/sec is non-trivial - ~$0.40/M requests, plus delay queue charges. At 100K/s x 86400 = 8.6B msgs/day, that\'s ~$3500/day in SQS alone. Worth noting we\'d evaluate SQS FIFO vs Redis Streams for cost-sensitive deployments.',
    },
    { question: 'Search?', answer: "Not relevant - callers query their own triggers by triggerId, no full-text need." },
    {
      question: 'What would a skeptical senior push back on?',
      answer:
        '"Why not just Temporal?" Fair - Temporal solves this and more. Tradeoff: heavier ops, harder to scale to 100K/s of simple delayed triggers without serious tuning. Our scope is the narrow "fire one HTTP callback later" use case, where a purpose-built service is leaner.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  caller[Caller services]:::client
  alb[API gateway]:::edge
  api[Trigger API]:::edge
  idem[("Redis idem cache")]:::cache
  db[("Cassandra: partition by bucket sub-shard")]:::database
  sqs[["SQS short-delay queue"]]:::async
  sweeper[Sweeper: leader per shard]:::compute
  wheel{{"Timing wheel per shard"}}:::compute
  disp[Dispatcher pool: bulkheads + breaker]:::compute
  cb[Caller callback URL]:::client
  dlq[["DLQ Kafka topic"]]:::async
  recon[Reconciler: hourly]:::compute

  caller -->|"Register delayed trigger"| alb
  alb -->|"Forward to trigger API"| api
  api -->|"Check idempotency"| idem
  api -->|"Persist trigger"| db
  api -->|"Enqueue short delay"| sqs

  sweeper -->|"Scan buckets"| db
  sweeper -->|"Load into wheel"| wheel
  wheel -->|"Push when due"| sqs

  sqs -->|"Consume message"| disp
  disp -->|"Check status"| db
  disp -->|"POST callback"| cb

  disp -.->|"failures"| dlq
  recon -->|"Scan leaks"| db
  recon -->|"Re-enqueue"| sqs`,
  },

  keyTechnologies: [
    {
      term: 'SQS',
      definition:
        'Amazon Simple Queue Service. A managed message queue. You put messages in, consumers take them out. Supports delaying message visibility up to 15 minutes.',
    },
    {
      term: 'Cassandra',
      definition:
        'Distributed NoSQL database. Excellent for time-series/bucketed data. We partition triggers by their fire-time minute for efficient sweeper scans.',
    },
    {
      term: 'Timing Wheel',
      definition:
        'An in-memory data structure (ring buffer) that fires callbacks at precise times. O(1) insert and expiry. Used inside Kafka and Netty.',
    },
    {
      term: 'Sweeper',
      definition:
        'A background job that scans the database for triggers approaching their fire time and moves them into the active queue. Safety net for long delays.',
    },
    {
      term: 'Idempotency Key',
      definition:
        "A unique ID the caller sends with each request. If retried, the server recognizes it's a duplicate and returns the cached response instead of creating a new trigger.",
    },
    {
      term: 'Circuit Breaker',
      definition:
        'Pattern that stops calling a failing service after N errors. "Opens" the circuit, fast-fails for a cooldown period, then retries. Protects dispatchers from bad callback endpoints.',
    },
    {
      term: 'DLQ (Dead Letter Queue)',
      definition: 'Where messages go after failing N retries. Allows manual investigation without blocking the main queue.',
    },
    {
      term: 'Reconciler',
      definition:
        'Hourly safety-net job that finds "stuck" triggers (fire time passed but status still PENDING) and re-injects them. Catches bugs in the sweeper or leader election.',
    },
  ],

  expectedDepth: {
    mid: 'Understand the problem - schedule an action to happen at a future time (e.g., "send reminder in 30 min"). Propose a simple DB + polling mechanism. Recognize why polling every second doesn\'t scale to millions of triggers - scanning the entire table is O(N) per tick.',
    senior:
      'Propose SQS delay queues or hierarchical timing wheels for efficient scheduling. Explain how to shard triggers by time bucket so sweepers only scan a small partition. Discuss idempotent trigger execution and what happens if a trigger fires twice (callers must be idempotent, we provide execution IDs).',
    staffPlus:
      'Address sub-second precision at scale using timing wheels (Kafka-style HashedWheelTimer with O(1) insert and fire). Discuss circuit breaker patterns for downstream callback services, multi-region trigger consistency (what if the primary region fails mid-sweep), and cost comparison of managed SQS vs self-managed timing infrastructure at 10K fires/sec. Cover the reconciler as a safety net for leaked triggers.',
  },

  keyTakeaways: [
    'Timing wheel gives O(1) insert and fire for scheduled events',
    'Two-tier: Redis for near-term (<1hr), Cassandra for far-term timers',
    'Circuit breaker protects downstream services during cascade failures',
    'Lazy cancellation - mark as cancelled, skip on fire (cheaper than deleting from wheel)',
  ],

  relatedDesigns: ['job-scheduler', 'digital-wallet', 'notification-system'],
  relatedConcepts: [
    { name: 'Message Queues', description: 'Hold and dispatch triggers when their fire time arrives.' },
    { name: 'Dead Letter Queue', description: 'Isolates triggers that repeatedly fail to deliver.' },
    { name: 'Circuit Breaker', description: "Stops hammering a downstream that's already unhealthy." },
    { name: 'Retry & Backoff', description: 'Re-attempts failed triggers with growing delays.' },
  ],

  simulator: {
    goalDescription: 'Fire an HTTP callback at a future time, durably, at-least-once, with jitter under 1s.',
    requirementChips: ['P99 jitter < 1s (short delay)', '100K registers/sec', '100K fires/sec at peak'],
    targetRps: 100000,
    readRatio: 0.5,
    cacheHitRatio: 0.15,
    latencyBudgetMsP99: 1000,
    rubric: [
      { id: 'idem-cache', label: 'Idempotency cache to dedupe retried registers', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'bucketed-store', label: 'Durable store partitioned by fire-time bucket', kind: 'requires-node-type', nodeType: 'cassandra' },
      { id: 'delay-queue', label: 'Delay/execution queue for near-fire triggers', kind: 'requires-node-type', nodeType: 'sqs' },
      {
        id: 'compute-tier',
        label: 'Compute tier for the Trigger API and dispatcher pool',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'api-1', type: 'app-server', instanceCount: 8, position: { x: 320, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 600, y: 80 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 16, position: { x: 600, y: 320 } },
        { id: 'sqs-1', type: 'sqs', instanceCount: 4, position: { x: 880, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 12, position: { x: 1160, y: 200 } },
        { id: 'client-2', type: 'client', instanceCount: 1, position: { x: 1440, y: 200 } },
      ],
      edges: [
        { id: 'e-client-api', source: 'client-1', target: 'api-1' },
        { id: 'e-api-redis', source: 'api-1', target: 'redis-1' },
        { id: 'e-api-cassandra', source: 'api-1', target: 'cassandra-1' },
        { id: 'e-api-sqs', source: 'api-1', target: 'sqs-1' },
        { id: 'e-cassandra-sqs', source: 'cassandra-1', target: 'sqs-1' },
        { id: 'e-sqs-worker', source: 'sqs-1', target: 'worker-1' },
        { id: 'e-worker-cassandra', source: 'worker-1', target: 'cassandra-1' },
        { id: 'e-worker-client2', source: 'worker-1', target: 'client-2' },
      ],
    },
    referenceArchitectureExplanation:
      'Cassandra partitioned by fire-time bucket is the durable source of truth; short delays go straight to the SQS delay queue while a sweeper (not modeled as a node) migrates long-delay triggers as their fire time nears, and the dispatcher pool re-checks status in Cassandra before POSTing so a lazily-cancelled trigger is dropped instead of fired.',
    failureModeNarratives: {
      sqs: 'A single execution lane serves every near-term fire; if SQS is degraded, no triggers can fire even though they remain safely durable in Cassandra.',
    },
    fullDesignLinkSlug: 'delayed-trigger-service',
  },
}

export default topic
