import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'job-scheduler',
  title: 'Distributed Job Scheduler',
  difficulty: 'Advanced',
  icon: 'pi pi-clock',
  color: '#8b5cf6',
  readTimeMinutes: 27,
  topics: [],
  companies: [],
  prerequisites: ['Message Queues', 'Leader Election', 'Database Indexing'],
  summary:
    'A distributed job scheduler lets teams register recurring or one-off tasks (like cron, but across a fleet of machines). It ensures each job runs exactly once, on time, with retries and dependency management.',

  understandingProblem:
    "A distributed job scheduler accepts jobs (run once at time T, or recurring on a cron schedule, or a DAG of dependent steps) and executes them reliably across a fleet of workers. Callers shouldn't worry about which machine runs the job, what happens when a worker crashes mid-execution, or whether the job ran twice. The scheduler owns timing, dispatch, retries, isolation, and observability.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client App]:::client
  api[Scheduler API]:::edge
  db[("Jobs Table")]:::database
  cron["Cron Loop<br/>single process"]:::compute
  worker[Worker]:::compute

  client --> api
  api --> db
  cron --> db
  cron --> worker`,
    },
    whyThisBreaks: [
      'Single point of failure - the one cron loop dies, nothing schedules until someone restarts it.',
      'Scheduler and worker coupled - long-running jobs block the schedule tick.',
      'No leader election - if you run two cron loops for HA, both pick up the same due job and run it twice.',
      'No retries or backoff - worker crashes mid-run, job is lost.',
      "In simple terms: a worker was running a 4-hour job and crashed at hour 3. Is the job done? Should we retry? If we retry, it runs from scratch - wasting 3 hours of work.",
      "Tick granularity - one-per-minute poll can't handle sub-second precision or 100k due-jobs-per-second bursts.",
      "No isolation - a runaway tenant saturates the worker pool, everyone else's jobs miss their SLA.",
      'No observability - "did my job run?" requires grep across worker logs.',
      "No dependencies - jobs are independent; can't express \"run B after A finishes.\"",
    ],
    closingNote:
      'The rest of the doc evolves this into a horizontally scalable, HA, exactly-once-in-effect job platform.',
  },

  priorArt: [
    {
      title: 'Airbnb Dynein',
      description:
        'Distributed delayed job queue at Airbnb; uses DynamoDB for job storage, a dispatcher pool that polls by time range, pushes onto SQS for workers. Powers in-app messaging, dynamic pricing. (blog)',
      link: 'https://medium.com/airbnb-engineering/dynein-building-a-distributed-delayed-job-queueing-system-93ab10f05f99',
    },
    {
      title: 'Uber Cadence / Temporal',
      description:
        'Durable workflow engine: workflow code runs as a "replayable" function; every step is persisted so the workflow survives host death. Originated at Uber, now the industry standard for multi-step orchestration with human-in-the-loop steps, timeouts, and saga compensation. (Temporal blog)',
      link: 'https://temporal.io/blog/building-resilient-workflows-from-azure-to-cadence-to-temporal',
    },
    {
      title: 'Quartz Scheduler (clustered)',
      description:
        'Open-source Java scheduler with DB-locked leader election. Classic pattern - a table row with FOR UPDATE or a sentinel column determines the active scheduler. Widely deployed; limits on horizontal scale due to the single write-lock hot row.',
      link: 'https://www.quartz-scheduler.org/documentation/quartz-2.3.0/configuration/ConfigJDBCJobStoreClustering.html',
    },
    {
      title: 'Dkron',
      description:
        'Go-based distributed cron using Raft for leader election. No SPOF, no DB dependency. Good for platform-layer scheduling (host patching, telemetry collection).',
      link: 'https://dkron.io',
    },
    {
      title: 'Google Borg / Kubernetes CronJob',
      description:
        'Cluster-level job scheduling. Kubernetes CronJob uses a single controller with leader election to create jobs; job pods execute the work.',
      link: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/',
    },
    {
      title: 'AWS EventBridge Scheduler',
      description:
        'The managed version of this pattern at AWS scale. One-shot and cron schedules, EventBridge dispatches to Lambda / SQS / Step Functions. Designed for multi-tenant throughput.',
      link: 'https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html',
    },
  ],

  coreEntities: [
    {
      name: 'Job',
      description:
        'The definition: identity, owner, type (one-shot / cron / delayed), payload, target (worker pool + handler name), retry policy, timeout, priority.',
    },
    {
      name: 'Schedule',
      description: 'Derived from a Job; holds next_fire_time for cron jobs. Updated after each fire.',
    },
    {
      name: 'Execution',
      description:
        'One attempt to run a job. Has its own ID, a timestamp, a worker assignment, status (PENDING / RUNNING / SUCCEEDED / FAILED / TIMED_OUT / CANCELLED).',
    },
    {
      name: 'Worker Pool',
      description: 'A named group of worker processes that handle a specific class of jobs (e.g., email-sender, batch-etl).',
    },
    { name: 'Worker', description: 'A single process that pulls and runs jobs, sends heartbeats.' },
    { name: 'Tenant', description: 'Owner of a set of jobs. Quotas and fairness are applied per tenant.' },
  ],

  requirements: {
    core: [
      'Schedule a job - one-time (run at timestamp T), recurring (cron expression), or delayed (run in N seconds).',
      'Execute reliably - at-least-once delivery to a worker, with retries on failure, respecting timeouts.',
      'Inspect and cancel - query the status of a scheduled or running job, cancel a future run.',
    ],
    belowTheLine: [
      "Workflow DAGs with conditional branches and human steps - that's Temporal territory; we'd mention it as a deep dive extension.",
      'Job output streaming and log aggregation - assume workers ship logs to an existing log pipeline.',
      'Cost optimization (spot workers, preemption) - covered in the worker-pool deep dive briefly.',
      "Full multi-region active-active - we'll note what's needed but design primary-with-DR.",
      'Exactly-once execution end-to-end (impossible; at-least-once + idempotency is the industry standard).',
      'Sub-100ms precision for far-future jobs.',
      "Strict fairness across tenants (we'll do weighted, not strict).",
    ],
    nonFunctionalTable: [
      { metric: 'Scale', target: '100M scheduled jobs at rest, 1M jobs/minute dispatched at peak, 10k concurrent executions.' },
      {
        metric: 'Timing precision',
        target:
          'P95 dispatch latency < 1s of scheduled time for "hot" jobs due within the next minute. Best-effort for long-tail jobs scheduled months out.',
      },
      {
        metric: 'Reliability',
        target:
          'At-least-once execution guarantee. Job owners must be idempotent; we provide execution IDs to help them dedupe.',
      },
      {
        metric: 'Availability',
        target: 'Scheduler control plane tolerates single-node and single-AZ failure. No job loss across failover.',
      },
    ],
  },

  technologyChoices: [
    {
      tier: 'Job & Schedule Store',
      purpose: 'Durable job definitions, cron expressions, and computed next_fire_time',
      primaryPick: 'PostgreSQL (sharded by tenant_id)',
      alternatives: 'MySQL, CockroachDB, Aurora',
      whyPrimaryWins: 'ACID guarantees the job row and its schedule commit together, and an index on (next_fire_time, state) supports admin queries no pure key-value store can answer.',
    },
    {
      tier: 'Hot Dispatch Window',
      purpose: 'O(log N) "what is due right now" lookups for the dispatcher',
      primaryPick: 'Redis Sorted Set',
      alternatives: 'DynamoDB with a timestamp sort key, Google Cloud Tasks (managed)',
      whyPrimaryWins: 'At 1M jobs/min, polling Postgres for everything due in the next 60 seconds would hammer the index - the ZSET gives O(log N) inserts and O(log N + k) range queries scored by fire time.',
    },
    {
      tier: 'Executions Table',
      purpose: 'One append-only row per run attempt, for history and retries',
      primaryPick: 'PostgreSQL (partitioned monthly)',
      alternatives: 'Cassandra for 100M+ executions/day, ClickHouse as an analytics replica',
      whyPrimaryWins: 'Monthly partitioning keeps the hot table small while append-only writes stay cheap and still joinable back to job_id for history views.',
    },
    {
      tier: 'Worker Heartbeats',
      purpose: 'Detect a crashed worker and reclaim its stuck execution',
      primaryPick: 'Redis with TTL',
      alternatives: 'ZooKeeper (small fleets), etcd',
      whyPrimaryWins: 'A 10-second heartbeat with a short TTL lets the sweeper catch a dead worker within seconds instead of leaving an execution stuck in RUNNING indefinitely.',
    },
    {
      tier: 'Dispatch-to-Worker Bus',
      purpose: 'Decouple dispatch timing from worker availability, and carry retries',
      primaryPick: 'Kafka (per-pool topics plus retry/DLQ topics)',
      alternatives: 'Kinesis, Google Pub/Sub, Pulsar',
      whyPrimaryWins: 'Durability means a worker-pool restart never drops an in-flight job, and per-pool topics let each job class scale its own consumer parallelism independently.',
    },
    {
      tier: 'Leader Election',
      purpose: 'Guarantee only one dispatcher shard owns a given slice of jobs',
      primaryPick: 'etcd / ZooKeeper / Consul lease',
      alternatives: 'Kubernetes Lease API, Redis Redlock',
      whyPrimaryWins: 'A renewable lease with sub-second failover prevents two dispatchers from ever firing the same due job twice.',
    },
  ],
  technologyChoicesNote:
    "Postgres is the durable source of truth and Redis is the fast index in front of it: far-future jobs live only in Postgres since they don't need millisecond access, while a background hydrator promotes anything due within the next hour into the Redis ZSET the dispatcher actually polls. Why not put everything in Redis? It isn't durable enough at this cost-per-GB point, and losing a scheduled job on a Redis failover is unacceptable - Postgres plus its write-ahead log guarantees that if the commit returned, the job will run. Kafka sits between dispatch and workers for the same reason: it survives worker restarts, gives each pool its own tunable partition count, and lets a bad worker deploy be fixed by replaying an hour of executions instead of losing them.",

  scaleEstimation: [
    'Users: 10M scheduled jobs at rest, thousands of internal service tenants',
    'Write QPS: 1K new job registrations/sec, 100K executions/hour at peak',
    'Read QPS: 10K job status queries/sec, 1K "what\'s due now?" sweeps/sec',
    'Storage: 500GB job metadata/year (definitions + execution history)',
    'Bandwidth: 99.9% on-time execution SLA - dispatch within 1s of scheduled time',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/jobs',
      description: 'Create a job. Requires an Idempotency-Key header (UUID).',
      example:
        '// Request\n{\n  "name": "daily-invoice-gen",\n  "type": "CRON",\n  "schedule": "0 3 * * *",\n  "timezone": "America/Los_Angeles",\n  "target": { "pool": "batch-etl", "handler": "generate_invoices" },\n  "payload": { "tenantId": "acme", "dateRange": "yesterday" },\n  "retryPolicy": { "maxAttempts": 3, "backoff": "EXPONENTIAL", "initialDelayMs": 30000 },\n  "timeoutSec": 600,\n  "priority": "NORMAL"\n}\n\n// Response 200\n{\n  "jobId": "job_a93f2",\n  "nextFireAt": "2026-05-05T10:00:00Z",\n  "state": "ACTIVE"\n}',
    },
    { method: 'GET', path: '/v1/jobs/:id', description: 'Return the job definition plus its latest executions.' },
    { method: 'PUT', path: '/v1/jobs/:id', description: 'Update the schedule or payload of an existing job.' },
    { method: 'DELETE', path: '/v1/jobs/:id', description: 'Cancel the job (and stop future fires).' },
    { method: 'POST', path: '/v1/jobs/:id/pause', description: 'Pause a recurring job.' },
    { method: 'POST', path: '/v1/jobs/:id/resume', description: 'Resume a paused recurring job.' },
    { method: 'GET', path: '/v1/jobs/:id/executions', description: 'Return paginated execution history for a job.' },
    { method: 'POST', path: '/v1/executions/:id/cancel', description: 'Cancel a specific execution run.' },
    { method: 'GET', path: '/v1/executions/:id', description: 'Return the status of an execution plus a pointer to its logs.' },
  ],
  apiSecurityNote:
    'Service JWT required on all endpoints; job payloads are opaque to us. An idempotency key on job creation prevents retries from double-registering a job. Payloads are encrypted at rest, since they often carry secrets (API tokens, tenant IDs).',

  highLevelDesignIntro: 'Three passes, one per core functional requirement.',

  builds: [
    {
      title: 'FR-1: Schedule a Job',
      body:
        "Users need to register a job - one-time, cron, or delayed - and get back confirmation that it's durably scheduled. The API validates the request, computes the next fire time, and persists it durably.",
      insightCallout:
        "We use Postgres because job creation needs ACID transactions - if we write the job and its schedule, both must succeed or neither does.\n\nA sorted set (ZSET) lets us ask \"give me everything due before NOW\" in O(log N) - the dispatcher polls this instead of scanning millions of rows in Postgres every second.",
      newComponents: [
        {
          name: 'Scheduler API',
          description: 'The HTTP interface users call to create, query, or cancel jobs. Validates inputs and stores job definitions.',
        },
        {
          name: 'Postgres (jobs + schedules)',
          description:
            'The durable source of truth. Stores job definitions, cron expressions, and computed next_fire_time.',
        },
        {
          name: 'Redis Sorted Set (upcoming index)',
          description: 'Holds jobs due within the next hour, scored by next_fire_time.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api[Scheduler API]:::edge
  db[("Postgres<br/>jobs + schedules")]:::database
  cache[("Redis<br/>upcoming index")]:::cache

  client -->|"1. POST create job"| api
  api -->|"2. Store job schedule"| db
  api -->|"3. Add to hot window"| cache`,
      },
      steps: [
        'Developer calls POST /v1/jobs with a cron expression like "0 3 * * *" (run daily at 3am) → hits the Scheduler API',
        'API validates: Is the cron expression valid? Does the target worker pool exist? Is the payload within size limits?',
        'API computes next_fire_time from the cron + timezone (e.g., 3:00 AM Pacific = 10:00 UTC), then writes a jobs row AND a schedules row to Postgres in one atomic transaction',
        'For jobs due within the next hour, API also adds (next_fire_time, job_id) to the Redis sorted set - this is the "hot window" that the dispatcher polls. Jobs further out stay only in Postgres until a background hydrator promotes them',
        'Returns 201 Created with the job ID and next fire time',
      ],
      closingNote:
        "Why Postgres for jobs: ACID for \"create + schedule\" atomicity, SQL flexibility for admin queries (\"show all jobs by tenant X that fired in the last 24h\"), indexes on (next_fire_time, state) for dispatcher polling. Why Redis ZSET for the hot window: at 1M jobs/min peak, polling Postgres for \"jobs due in the next 60s\" every second would hammer the index - Redis ZSET gives O(log N) inserts and O(log N + k) range queries by score, holding only the next hour while everything further out lives in Postgres, promoted one hour ahead. Redis is not durable at the cost-per-GB point we're operating at, so losing scheduled jobs on a Redis failover is unacceptable - Postgres + WAL gives us \"if the commit returned, the job will run.\"",
    },
    {
      title: 'FR-2: Execute Reliably (the Dispatch + Retry Path)',
      body: 'This is where most of the complexity lives.',
      insightCallout:
        "Leader election ensures only ONE dispatcher owns each shard - without it, two dispatchers would both fire the same job, causing duplicate execution.\n\nThis is the \"dead man's switch\" - if we don't hear from a worker, we assume it's dead and retry the job.",
      newComponents: [
        {
          name: 'Dispatcher Pool (leader-elected shards)',
          description: 'The heartbeat of the system. Each dispatcher continuously polls its slice of the Redis ZSET for due jobs.',
        },
        {
          name: 'Kafka (per-pool topics)',
          description:
            'Decouples dispatch timing from worker availability. When the dispatcher finds a due job, it publishes to Kafka rather than directly calling a worker.',
        },
        {
          name: 'Workers',
          description:
            'The processes that actually execute your job code. Each worker pool handles a specific class of jobs (e.g., email-sender, batch-etl).',
        },
        {
          name: 'Executions table (Postgres)',
          description: 'One row per attempt to run a job. Append-only history so you can answer "did my job run? when? how long did it take?"',
        },
        {
          name: 'Worker Heartbeats (Redis)',
          description: "Workers write a heartbeat every 10s. If a worker crashes, its heartbeat expires and a sweeper reschedules the stuck job.",
        },
        {
          name: 'Retry Queue',
          description: 'A delayed Kafka topic where failed jobs wait with exponential backoff before being retried.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  cache[("Redis ZSET<br/>hot window")]:::cache
  dispatch[Dispatcher pool<br/>leader-elected shards]:::compute
  kafka[Kafka<br/>per-pool topics]:::async
  worker[Workers<br/>pool A]:::compute
  exec[("Postgres<br/>executions")]:::database
  heartbeat[("Redis<br/>worker heartbeats")]:::cache
  retry[Retry Queue<br/>delayed topic]:::async

  cache -->|"1. Pop due jobs"| dispatch
  dispatch -->|"2. Publish to pool topic"| kafka
  dispatch -->|"3. Insert execution row"| exec
  kafka -->|"4. Deliver to worker"| worker
  worker -->|"5. Write execution result"| exec
  worker -->|"6. Renew heartbeat TTL"| heartbeat
  worker -.failure.-> retry
  retry -->|"7. Re-enqueue with backoff"| kafka`,
      },
      steps: [
        'Dispatcher shards continuously poll their slice of the Redis ZSET: "Give me all jobs with score <= now()" - runs every 100-500ms',
        'When a shard finds due jobs, it atomically claims them via ZREMRANGEBYSCORE (Redis is single-threaded, so only one dispatcher wins the race)',
        'For each claimed job, the dispatcher creates an executions row in Postgres with status PENDING, publishes a message to Kafka on the target pool\'s topic (e.g., jobs.batch-etl), and for cron jobs computes the NEXT fire time and re-adds it to the ZSET (or Postgres if > 1 hour out)',
        'A worker in the target pool picks up the Kafka message, marks the execution as RUNNING, and starts writing heartbeats to Redis every 10s',
        'Worker invokes the job handler with the payload - this is where YOUR code actually runs',
        'On success → worker marks execution SUCCEEDED, commits Kafka offset, moves on',
        'On failure → worker marks FAILED, reads the retry policy, and publishes to the retry queue with exponential backoff (30s → 2min → 10min → 1h)',
        'A sweeper periodically checks: "any executions stuck in RUNNING with expired heartbeats?" If yes → the worker crashed. Mark FAILED_WORKER_LOST and trigger a retry',
      ],
      closingNote:
        "Why Kafka between dispatcher and workers? If the dispatcher called workers directly, a pool restart would lose all in-flight jobs. Kafka gives us durability (messages survive worker crashes), replay (reprocess an hour of jobs if a worker had a bug), and independent scaling per pool. Why a separate execution row, not just status on the job row: one job may produce many executions (cron fires daily, retries add more). Executions are append-only, cheap to partition by day, and joinable by job_id for history views.",
    },
    {
      title: 'FR-3: Inspect and Cancel',
      body:
        'The read path is straightforward: GET /v1/jobs/:id hits Postgres with an indexed query by job_id and returns the job definition plus recent executions. Cancellation is the tricky part - it has three distinct timing windows depending on where in its lifecycle the job sits.',
      insightCallout:
        "We can't \"un-send\" a Kafka message, so instead we let the worker check a cancel flag before it starts working.",
      newComponents: [
        {
          name: 'Cancel Set (Redis)',
          description:
            "A short-lived set of executionIds that have been cancelled. Workers check this before starting and periodically during execution.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api[API]:::edge
  db[("Postgres<br/>jobs + executions")]:::database
  cancel[("Redis<br/>cancel set")]:::cache
  worker[Worker]:::compute

  client -->|"1. POST cancel execution"| api
  api -->|"2. Fetch execution state"| db
  api -->|"3. Write to cancel set"| cancel
  worker -->|"4. Poll cancel set"| cancel`,
      },
      steps: [
        "Cancel a future job (not yet due) - easiest case. API sets the job state to CANCELLED and removes it from the Redis ZSET. It'll never fire.",
        "Cancel a PENDING execution (dispatched but worker hasn't started yet) - write the executionId to the Redis cancel set. Worker checks this set before starting; if present, it skips the job entirely.",
        "Cancel a RUNNING execution (worker is mid-flight) - worker polls the cancel set every few seconds during execution. On hit, it sends an interrupt to the handler code. Handlers must cooperate - we can't force-kill without risking data corruption.",
      ],
      closingNote:
        "Why lazy cancellation via a flag instead of \"delete from the queue\"? Kafka doesn't support targeted message deletion. And even if it did, there's a race between the cancel request and the worker consuming the message. A cancel flag checked at execution time is simpler and race-free.",
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1 - One-Shot Delayed Job (Run in 5 Minutes)',
      diagram: {
        mermaid: `sequenceDiagram
    actor Client
    participant API
    participant PG as Postgres
    participant Redis
    participant Disp as Dispatcher
    participant Kafka
    participant Worker
    participant Attempts as executions

    Client->>API: POST /v1/jobs (runAt = now + 5min)
    API->>PG: INSERT job + schedule
    API->>Redis: ZADD hot_window next_fire job_id
    API-->>Client: 201 (jobId)

    loop every 100ms
        Disp->>Redis: ZRANGEBYSCORE 0 now LIMIT 100
    end
    Note over Disp,Redis: at T+5min, job surfaces
    Disp->>Redis: ZREMRANGEBYSCORE (atomic claim)
    Disp->>Attempts: INSERT execution PENDING
    Disp->>Kafka: publish to pool topic

    Kafka->>Worker: consume
    Worker->>Attempts: UPDATE state=RUNNING, worker_id=me
    Worker->>Worker: run handler
    Worker->>Attempts: UPDATE state=SUCCEEDED
    Worker->>Kafka: commit offset`,
      },
      nonObviousFailure:
        'If the dispatcher crashes between step 3 and publishing, on restart the ZSET entry has already been removed. Safety net: the executions row was created before the publish, so a sweeper sees a PENDING execution with no Kafka publish → re-publishes.',
    },
    {
      title: 'Flow 2 - Recurring Cron Job with a Failure and Retry',
      diagram: {
        mermaid: `sequenceDiagram
    participant Disp as Dispatcher
    participant Kafka
    participant Worker
    participant Retry as retry topic
    participant Exec as executions
    participant PG as Postgres

    Disp->>Exec: INSERT execution e1 PENDING
    Disp->>Kafka: publish execution e1
    Kafka->>Worker: consume
    Worker->>Exec: UPDATE RUNNING
    Worker->>Worker: handler throws
    Worker->>Exec: UPDATE FAILED attempt=1
    Worker->>Retry: publish with readyAt = now + 30s
    Note over Disp: meanwhile schedule next cron fire
    Disp->>PG: UPDATE schedules SET next_fire_time = + 1 day
    Note over Retry,Kafka: 30s later
    Retry->>Kafka: re-publish execution e1 attempt=2
    Kafka->>Worker: consume
    Worker->>Exec: UPDATE RUNNING attempt=2
    Worker->>Worker: handler succeeds
    Worker->>Exec: UPDATE SUCCEEDED`,
      },
      nonObviousFailure:
        "Worker crashes between step 3a (handler throws) and step 3b (publish to retry). Safety net: the execution row is still RUNNING in Postgres. Heartbeat TTL expires in 30s → sweeper marks FAILED_WORKER_LOST → enqueues retry.",
    },
    {
      title: 'Flow 3 - Running Execution Cancellation',
      diagram: {
        mermaid: `sequenceDiagram
    actor Ops
    participant API
    participant Redis
    participant Worker
    participant Exec as executions

    Ops->>API: POST /v1/executions/e1/cancel
    API->>Redis: SADD cancelled:e1 TTL 10min
    API-->>Ops: 202

    Note over Worker: currently running e1
    Worker->>Redis: check every 5s
    Redis-->>Worker: cancelled
    Worker->>Worker: send interrupt to handler
    Worker->>Exec: UPDATE state=CANCELLED`,
      },
      nonObviousFailure:
        'Non-cooperative handlers (native code, infinite CPU loop) cannot be cancelled. We surface that as "best effort" in the docs and kill the worker process after a grace period.',
    },
    {
      title: "State Machine - An Execution's Lifecycle",
      diagram: {
        mermaid: `stateDiagram-v2
    [*] --> PENDING
    PENDING --> RUNNING: worker picks up
    PENDING --> CANCELLED: cancelled before dispatch
    RUNNING --> SUCCEEDED: handler returns
    RUNNING --> FAILED: handler throws
    RUNNING --> TIMED_OUT: exceeded timeout
    RUNNING --> CANCELLED: cancel signal
    RUNNING --> FAILED_WORKER_LOST: heartbeat TTL
    FAILED --> PENDING: retry scheduled
    FAILED_WORKER_LOST --> PENDING: retry scheduled
    TIMED_OUT --> PENDING: retry scheduled
    FAILED --> DEAD: max retries
    SUCCEEDED --> [*]
    CANCELLED --> [*]
    DEAD --> [*]`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Hot Dispatcher - Scale Beyond One Leader',
      problem:
        'A single dispatcher leader polling one Redis ZSET is fine at low volume, but at 1M jobs/min the single thread saturates and polling latency creeps into seconds. How do you scale dispatch beyond one leader?',
      simpleTerms:
        "One machine is responsible for checking 'which jobs need to run right now?' If that machine gets overloaded, jobs fire late. We need to split the work.",
      bad: 'Single dispatcher leader polling one Redis ZSET. At 1M jobs/min the single thread is saturated, polling latency creeps into seconds.',
      good: 'Shard the ZSET by hash(jobId) % N. Each shard has its own leader (picked via etcd). N dispatchers poll N ZSETs in parallel.',
      great:
        'Dynamic sharding with consistent hashing and idle thievery: use consistent hashing so adding/removing shards redistributes a minimal fraction of jobs. Each dispatcher publishes its load; a coordinator rebalances shards when hotspots emerge. Idle dispatchers can "steal" work from busy peers via a small pull queue, which smooths bursts.',
      diagram: {
        mermaid: `flowchart LR
  zset1[("Redis ZSET shard 1")]:::cache
  zset2[("Redis ZSET shard 2")]:::cache
  zset3[("Redis ZSET shard N")]:::cache
  d1[Dispatcher 1<br/>leader]:::compute
  d2[Dispatcher 2<br/>leader]:::compute
  d3[Dispatcher N<br/>leader]:::compute
  etcd[etcd<br/>leader locks]:::compute
  kafka[Kafka pool topics]:::async

  d1 -->|"1. Acquire leader lock"| etcd
  d2 -->|"2. Acquire leader lock"| etcd
  d3 -->|"3. Acquire leader lock"| etcd
  zset1 -->|"4. Pop due jobs shard 1"| d1
  zset2 -->|"5. Pop due jobs shard 2"| d2
  zset3 -->|"6. Pop due jobs shard N"| d3
  d1 -->|"7. Publish to pool topic"| kafka
  d2 -->|"8. Publish to pool topic"| kafka
  d3 -->|"9. Publish to pool topic"| kafka`,
      },
    },
    {
      title: 'Exactly-Once-in-Effect Execution',
      problem:
        'Exactly-once delivery is impossible across a network boundary. The achievable goal: at-least-once delivery + idempotent handlers = "exactly-once in effect."',
      bad: 'No execution ID. If dispatch retries the same message, the handler runs twice with no way to dedupe.',
      good:
        'Generate an executionId on dispatch. Hand it to the worker. The worker\'s first action is to check a "processed" table; if present, skip; else run the handler, record completion.',
      great:
        "Fencing tokens + transactional completion: each execution gets a monotonic fencing token, and the worker uses it when writing to downstream systems that support fencing (Kafka transactional writes, Postgres with token check). Completion is recorded in the same transaction as the business side-effect wherever possible:\n\nBEGIN;\n  UPDATE invoices SET status = 'sent' WHERE id = ? AND fence_token < ?;\n  UPDATE executions SET state = 'SUCCEEDED' WHERE id = ?;\nCOMMIT;\n\nFor non-transactional downstreams, the handler writes its output with the executionId as a dedup key (producer-level dedup). This is the Outbox + fencing pattern borrowed from Stripe's idempotency work and Temporal's activity-retry model.",
    },
    {
      title: 'Worker Crash During Execution',
      problem:
        'A worker crashes mid-run on a job. The execution is left in whatever state it was last in - how does the system detect the crash and decide whether, and from where, to retry?',
      simpleTerms:
        'A worker was running a 4-hour job and crashed at hour 3. Is the job done? Should we retry? If we retry, it runs from scratch - wasting 3 hours of work.',
      bad: 'Worker crashes mid-run. Execution sits in RUNNING forever. Nobody retries.',
      good:
        'Heartbeat-based liveness. Workers write to Redis every 10s. A sweeper scans executions stuck in RUNNING with expired heartbeats and marks them FAILED_WORKER_LOST, triggering retry.',
      great:
        "Heartbeat TTL + at-most-once interpretation + retry with backoff: the worker writes a heartbeat with a 30s TTL in Redis - missing two consecutive beats brings in the sweeper. The sweeper updates the execution row with UPDATE executions SET state = 'FAILED' WHERE id = ? AND worker_id = ? AND state = 'RUNNING' - CAS on worker_id prevents a race with a worker that just reconnected. Retry publishes to the retry topic with exponential backoff (30s, 2min, 10min, 1h). After maxAttempts, move to DLQ; ops dashboard surfaces these for manual review.\n\nEdge case: the worker finished the work but crashed before ACKing. The job effectively ran; our retry will run it again. That's why the idempotency contract with handlers matters.",
    },
    {
      title: 'Cron Drift, DST, and Timezones',
      problem:
        "Cron schedules need to fire at the right wall-clock time for the user's timezone, but timezones have daylight-saving transitions that can make a scheduled local time skip or repeat.",
      bad: 'Interpret cron in UTC. User in India sees "3 AM IST" jobs run at 3 AM UTC, 8:30 AM IST.',
      good: "Store cron + timezone. Compute next_fire_time in the user's zone, convert to UTC for the ZSET score.",
      great:
        'Recompute every fire, handle DST discontinuities: use a robust cron library (croniter, cron-utils) that handles timezone transitions. On DST spring-forward, "2:30 AM local" skips to 3:30 AM - the library returns the next valid time. On fall-back, "1:30 AM local" occurs twice - the library returns the first; our next_fire_time moves forward after the first fire, so we don\'t fire twice. Store both next_fire_time_local and next_fire_time_utc for debugging. For migrations, if a timezone\'s rules change (this happens - e.g., governments moving DST dates), a background job recomputes all affected schedules.',
    },
    {
      title: 'Multi-Tenant Isolation and Fairness',
      problem:
        "A single tenant's job volume can overwhelm the dispatcher and starve every other tenant's jobs of their SLA.",
      simpleTerms:
        "One customer floods the system with millions of jobs. Other customers' urgent jobs get stuck behind them. We need fairness - one noisy customer shouldn't starve others.",
      bad: "Tenant A schedules 10M cron jobs all firing at 0 0 * * * (midnight UTC). At midnight, the dispatcher is overwhelmed, tenant B's urgent jobs miss their SLA.",
      good: 'Per-tenant quotas enforced at job-submit time. Cap at N concurrent executions per tenant.',
      great:
        "Weighted fair queuing in the dispatcher: the dispatcher doesn't blindly pop from the ZSET in timestamp order - it picks batches round-robin across tenants, weighted by each tenant's tier. Per-tenant rate limiters (token buckets in Redis) sit in front of Kafka publish. Noisy-neighbor isolation: if tenant A's workers are backlogged, tenant A's dispatcher shard slows its publish rate, leaving Kafka capacity for others. Jitter job fire times at schedule-creation: if a user says 0 0 * * *, we spread to 0..180 0 * * * (0-180 second jitter) unless they explicitly opt out - this alone avoids most of the midnight stampede.",
    },
    {
      title: 'Leader Election and Failover',
      problem:
        'The dispatcher is a single point of failure unless multiple candidates can safely take over for each other without two of them dispatching the same job.',
      bad: 'Single dispatcher process. Dies → no jobs scheduled until ops restarts. 5-minute outage.',
      good:
        "Two dispatchers with a DB-based lock row (UPDATE scheduler_leader SET leader = $me WHERE leader IS NULL). Quartz's classic approach.",
      great:
        "Consensus-backed leases with sub-second failover: etcd / ZooKeeper / Consul give each dispatcher shard a lease on its shard key, renewed every 5 seconds - if a leader dies, another node acquires the lease within 10s. Kubernetes Lease API works identically if you're on K8s - just a lease object that watchers race for. Split-brain prevention: the leader includes a monotonic epoch in every dispatch message; workers check the epoch against the one they last saw, and outdated dispatches are rejected - the same fencing-token idea as Deep Dive 2, scaled up.",
    },
    {
      title: 'Handling Long-Running Jobs (Heartbeat + Restart-Safe)',
      problem:
        "A long-running job (hours, not seconds) that crashes partway through shouldn't have to restart from zero - that wastes all the completed work.",
      bad: 'A 4-hour ETL job. Worker crashes at hour 3.5. Retry restarts from zero. Massive waste.',
      good: 'Handlers checkpoint progress periodically. On retry, they read the checkpoint and resume.',
      great:
        "Activity/heartbeat pattern (from Temporal): the handler calls heartbeat(progress) every minute, with progress as arbitrary JSON stored in the execution row. On retry, the handler reads progress from the previous attempt's execution and resumes. Heartbeat TTL on the scheduler side is generous (e.g., 5 minutes) for long jobs - they're allowed to be silent that long. For truly stateful workflows (multi-step with external calls between steps), recommend users move to a workflow engine like Temporal rather than shoehorn into a plain scheduler.",
    },
    {
      title: 'Observability and Debuggability',
      problem:
        'When something goes wrong with a job, on-call engineers need to answer "did my job run, when, and why did it fail" without grepping logs across hundreds of worker hosts.',
      bad: '"Did my job run?" - grep logs on 200 worker hosts.',
      good: 'Executions table indexed by job_id. UI shows history.',
      great:
        'Metrics + traces + audit + replay: Prometheus metrics cover dispatch latency histogram, queue depth per pool, execution duration, retry count, and DLQ size, with P95 dispatch latency as the SLI. OpenTelemetry distributed tracing gives every execution a trace ID, propagated to Kafka headers → worker → downstream services, so a support person can see the whole path for one execution in Jaeger. An audit log records every state transition to an append-only table, answering "who cancelled this job?" compliance questions. Replay lets devs pull messages from Kafka for a given time range into a staging pool to reproduce incidents without hitting prod.',
    },
  ],

  selfAudit: [
    {
      question: 'Clock skew?',
      answer:
        'Dispatcher and workers must agree on "now." NTP keeps hosts in sync; for critical timing we round to the nearest second. Major clock drift would cause duplicate dispatches; fencing tokens (Deep Dive 2) catch those.',
    },
    {
      question: 'Redis ZSET size?',
      answer: 'Holding 1 hour of due jobs at 1M/min = 60M entries. One Redis instance can handle that in RAM (~10 GB). For growth, shard the ZSET (Deep Dive 1).',
    },
    {
      question: 'Postgres write hot spot?',
      answer: 'Executions table grows fast. Partitioning by month + archive old partitions to S3 keeps the hot table small.',
    },
    {
      question: 'Retry storm?',
      answer:
        'A downstream service fails for 5 min, 1M failed executions queue into retry. Retry backoff must be randomized (jitter) and capped; circuit breaker at the worker side pauses retries if failure rate exceeds a threshold.',
    },
    {
      question: 'Payload bloat?',
      answer: 'Users pass 10 MB payloads. Cap payload at 256 KB; larger = reference to S3.',
    },
    {
      question: 'Dependency on Redis availability?',
      answer: 'Redis outage = no dispatch. Mitigation: Redis Sentinel / Cluster; cold-start re-hydrates ZSET from Postgres in minutes.',
    },
    {
      question: 'Multi-region?',
      answer:
        'Primary region in one location, warm standby in another; cross-region Postgres replication (async). On failover, some last-second jobs may re-fire - idempotency catches them.',
    },
    {
      question: 'Cost?',
      answer: 'Kafka and Postgres dominate. Monitor per-tenant cost, bill back for heavy schedulers.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  client[Clients and CI systems]:::client

  subgraph "Control Plane"
    api[Scheduler API]:::edge
    pg[("Postgres<br/>jobs + schedules + executions")]:::database
    redis[("Redis<br/>hot ZSET + heartbeats + cancel")]:::cache
    cron[Cron Parser]:::compute
  end

  subgraph "Dispatch"
    etcd[etcd<br/>leader leases]:::compute
    disp[Dispatcher shards<br/>leader-elected]:::compute
    sweeper[Sweeper<br/>stuck executions]:::compute
    hydrator[Hydrator<br/>PG to Redis]:::compute
  end

  subgraph "Execution"
    kafka[Kafka<br/>per-pool topics + retry + DLQ]:::async
    workerA[Worker pool A<br/>email-sender]:::compute
    workerB[Worker pool B<br/>batch-etl]:::compute
    workerC[Worker pool C<br/>general-purpose]:::compute
  end

  subgraph "Observability"
    metrics[Prometheus]:::compute
    traces[OpenTelemetry + Jaeger]:::compute
    ch[("Analytics Store<br/>executions OLAP replica")]:::database
  end

  client -->|"POST create or cancel job"| api
  api -->|"Persist job definition"| pg
  api -->|"Write to hot ZSET"| redis
  api -->|"Write schedule"| cron
  hydrator -->|"Fetch job details"| pg
  hydrator -->|"Read metadata"| redis
  redis -->|"Pop due jobs"| disp
  disp -->|"Acquire shard lock"| etcd
  disp -->|"Update status"| pg
  disp -->|"Dispatch job"| kafka
  sweeper -->|"Re-schedule stuck jobs"| pg
  sweeper -->|"Re-enqueue for retry"| kafka
  kafka -->|"Execute email jobs"| workerA
  kafka -->|"Execute ETL jobs"| workerB
  kafka -->|"Execute general jobs"| workerC
  workerA -->|"Write execution result"| pg
  workerB -->|"Write execution result"| pg
  workerC -->|"Write execution result"| pg
  workerA -->|"Read cache"| redis
  workerB -->|"Renew heartbeat TTL"| redis
  workerC -->|"Poll cancel set"| redis
  workerA -.failure.-> kafka
  workerB -.failure.-> kafka
  workerC -.failure.-> kafka
  disp -->|"Report metrics"| metrics
  workerA -->|"Report metrics"| metrics
  workerA -->|"Report traces"| traces
  pg -->|"Replicate to OLAP"| ch`,
    bullets: [
      'Client submits job - API call hits the Scheduler API, which persists the job and schedule to Postgres',
      'Hydrator pre-loads hot window - fetches upcoming jobs from Postgres and writes them into Redis ZSET scored by execution time',
      'Dispatcher pops due jobs - leader-elected shard reads from Redis ZSET, acquires shard lock via etcd, updates status in Postgres',
      "Job dispatched to Kafka - dispatcher publishes to the correct per-pool topic based on job type",
      'Worker executes job - pool-specific workers consume from Kafka, run the job logic, report heartbeats to Redis',
      'Worker reports completion - writes result back to Postgres and Redis; failures go back to Kafka for retry',
      'Sweeper catches stuck executions - detects missed heartbeats, marks jobs for re-dispatch via Kafka',
      'Metrics and traces exported - Prometheus and OpenTelemetry capture execution latency, success rates, and queue depths',
    ],
  },

  keyTechnologies: [
    {
      term: 'Redis Sorted Set (ZSET)',
      definition:
        'In-memory data structure scored by fire-time timestamp - O(log N) insert and range queries power the "what\'s due now?" dispatcher hot path.',
    },
    {
      term: 'Timing Wheel',
      definition:
        'Alternative scheduling structure with O(1) insert and fire for time-bucketed events - used in some dispatcher implementations for high-volume ticks.',
    },
    {
      term: 'Leader Election',
      definition: 'Coordination mechanism (via etcd/ZooKeeper/Consul) ensuring only one dispatcher owns each shard - prevents duplicate job firing.',
    },
    {
      term: 'Kafka',
      definition:
        'Durable message broker decoupling dispatch timing from worker execution - survives worker restarts and enables per-pool topic scaling.',
    },
    {
      term: 'Cron Expression',
      definition:
        'Standard syntax (e.g., 0 3 * * *) for defining recurring schedules, parsed with timezone-aware libraries to compute next fire times.',
    },
    {
      term: 'Heartbeat',
      definition: 'Periodic signal (every 10s) from workers to Redis with TTL - missed heartbeats trigger sweeper-based retry of stuck jobs.',
    },
    {
      term: 'Dead Letter Queue',
      definition: 'Holding queue for jobs that exhausted all retry attempts - surfaced to an ops dashboard for manual investigation.',
    },
    {
      term: 'Temporal',
      definition: 'Durable workflow engine for complex multi-step job orchestration with built-in retries, timeouts, and crash recovery.',
    },
  ],

  expectedDepth: {
    mid: "Design a system that stores jobs with execution times and triggers them when due. Propose a polling mechanism or priority queue for finding due jobs. Understand why a single timer thread doesn't scale - one machine crashing means jobs don't fire.",
    senior:
      'Propose Redis ZSET for the hot window of upcoming jobs (score = execution timestamp). Explain leader election for preventing duplicate execution across multiple scheduler instances. Discuss retry logic with exponential backoff and dead-letter queues for permanently failed jobs. Articulate the difference between at-least-once and exactly-once execution guarantees.',
    staffPlus:
      "Address multi-tenant fair scheduling (one user's million jobs shouldn't starve others) using weighted queues with per-tenant token buckets. Discuss timing wheel data structures for sub-second precision without polling overhead, sharding strategies for the job store (partition by tenant + time bucket), and exactly-once execution guarantees using fencing tokens to prevent stale workers from completing zombie executions.",
  },

  keyTakeaways: [
    'Redis ZSET scored by execution time enables O(log N) "what\'s due now?" queries',
    'Leader election ensures exactly one worker processes the hot window',
    'Dead letter queue catches permanently failing jobs without blocking others',
    'Idempotent execution - jobs must be safe to retry',
  ],

  relatedDesigns: ['delayed-trigger-service', 'notification-system', 'food-delivery'],
  relatedConcepts: [
    { name: 'Leader Election', description: "One scheduler node owns dispatch so due jobs aren't fired twice." },
    { name: 'Message Queues', description: 'Hand due jobs off to a pool of workers for execution.' },
    { name: 'Distributed Locking', description: 'Guarantees a given job runs on exactly one worker.' },
    { name: 'Dead Letter Queue', description: 'Captures jobs that exhaust their retries for later triage.' },
  ],

  simulator: {
    goalDescription: "Fire due jobs on time across a fleet of workers, exactly once, with retries and no missed executions.",
    requirementChips: ['Dispatch < 1s of scheduled time', '1M jobs/min peak dispatch', 'At-least-once + idempotent'],
    targetRps: 16667,
    readRatio: 0.5,
    cacheHitRatio: 0.85,
    latencyBudgetMsP99: 1000,
    rubric: [
      { id: 'hot-window', label: 'Redis sorted set for the hot dispatch window', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'durable-store', label: 'Durable store for job definitions and executions', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'dispatch-bus', label: 'Message bus decoupling dispatch from workers', kind: 'requires-node-type', nodeType: 'kafka' },
      {
        id: 'compute-tier',
        label: 'Compute tier for dispatchers and workers',
        kind: 'requires-node-type',
        nodeType: ['worker', 'app-server', 'microservice'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-spof', label: 'No single point of failure on the dispatch path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'api-1', type: 'app-server', instanceCount: 6, position: { x: 320, y: 200 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 15, position: { x: 600, y: 80 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 600, y: 320 } },
        { id: 'disp-1', type: 'worker', instanceCount: 8, position: { x: 880, y: 320 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 4, position: { x: 1160, y: 320 } },
        { id: 'worker-1', type: 'worker', instanceCount: 30, position: { x: 1440, y: 320 } },
      ],
      edges: [
        { id: 'e-client-api', source: 'client-1', target: 'api-1' },
        { id: 'e-api-pg', source: 'api-1', target: 'pg-1' },
        { id: 'e-api-redis', source: 'api-1', target: 'redis-1' },
        { id: 'e-redis-disp', source: 'redis-1', target: 'disp-1' },
        { id: 'e-disp-pg', source: 'disp-1', target: 'pg-1' },
        { id: 'e-disp-kafka', source: 'disp-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker-pg', source: 'worker-1', target: 'pg-1' },
        { id: 'e-worker-redis', source: 'worker-1', target: 'redis-1' },
      ],
    },
    referenceArchitectureExplanation:
      "A Redis ZSET holds the hot window of jobs due within the next hour so leader-elected dispatcher shards can poll 'what's due now?' in O(log N) instead of scanning Postgres; Kafka decouples dispatch timing from worker execution so a worker-pool restart never drops in-flight jobs.",
    failureModeNarratives: {
      redis: 'Only a few Redis instances back the hot dispatch window; if Redis is unavailable, no jobs can be dispatched until it recovers and is rehydrated from Postgres.',
    },
    fullDesignLinkSlug: 'job-scheduler',
  },
}

export default topic
