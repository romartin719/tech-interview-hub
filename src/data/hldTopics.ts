export interface SimGraphNode {
  id: string
  type: string
  instanceCount: number
  position: { x: number; y: number }
}

export interface SimGraphEdge {
  id: string
  source: string
  target: string
}

export interface SimGraph {
  nodes: SimGraphNode[]
  edges: SimGraphEdge[]
}

export type RubricCriterion =
  | { id: string; label: string; kind: 'requires-node-type'; nodeType: string | string[] }
  | { id: string; label: string; kind: 'requires-connected-pair'; fromType: string; toType: string }
  | { id: string; label: string; kind: 'requires-cache-before'; cacheType: string; sinkType: string }
  | { id: string; label: string; kind: 'no-bottleneck' }
  | { id: string; label: string; kind: 'no-spof' }
  | { id: string; label: string; kind: 'meets-latency-budget' }

export interface SimulatorConfig {
  goalDescription: string
  requirementChips: string[]
  targetRps: number
  readRatio: number
  cacheHitRatio: number
  latencyBudgetMsP99: number
  rubric: RubricCriterion[]
  referenceArchitecture: SimGraph
  referenceArchitectureExplanation: string
  failureModeNarratives: Record<string, string>
  fullDesignLinkSlug: string
}

export interface HLDDiagram {
  title: string
  mermaid: string
  bullets?: string[]
}

export interface ApiEndpoint {
  method: string
  path: string
  description: string
  example?: string
}

export interface GlossaryEntry {
  term: string
  definition: string
}

export interface SelfAuditEntry {
  question: string
  answer: string
}

export interface NfrRow {
  metric: string
  target: string
}

export interface PriorArtEntry {
  title: string
  description: string
}

export interface CoreEntity {
  name: string
  description: string
}

export interface ApproachComparison {
  name: string
  description: string
  pros: string[]
  cons: string[]
  usedBy?: string
}

export interface LayerRow {
  layer: string
  blocks: string
  key: string
  example: string
}

export interface CheatSheetEntry {
  question: string
  answer: string
}

export interface HLDTopic {
  slug: string
  title: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  icon: string
  color: string
  concepts: string[]
  companies: string[]
  summary: string
  tldr: string
  problemFraming: string
  priorArt: PriorArtEntry[]
  coreEntities: CoreEntity[]
  requirements: { core: string[]; belowTheLine: string[]; nonFunctionalTable: NfrRow[] }
  capacityEstimate: string
  architecture: string
  diagrams: HLDDiagram[]
  approaches: ApproachComparison[]
  whereThisFits: LayerRow[]
  deepDive: { title: string; body: string; diagram?: string }[]
  tradeoffs: { title: string; body: string }[]
  failureMode: { title: string; body: string }
  apiInterface: ApiEndpoint[]
  keyTechnologies: GlossaryEntry[]
  selfAudit: SelfAuditEntry[]
  cheatSheet: CheatSheetEntry[]
  expectedDepth: { mid: string; senior: string; staffPlus: string }
  keyTakeaways: string[]
  relatedDesigns: string[]
  simulator?: SimulatorConfig
}

export const hldTopics: HLDTopic[] = [
  {
    slug: 'rate-limiter',
    title: 'Rate Limiter',
    difficulty: 'Beginner',
    icon: 'pi pi-shield',
    color: '#ef4444',
    concepts: ['Token Bucket', 'Sliding Window Counter', 'Redis Lua Scripting', 'Distributed Counters', 'Middleware/Sidecar'],
    companies: ['Stripe', 'Cloudflare', 'Amazon (API Gateway)', 'Twitter/X'],
    summary: 'A shared service that throttles requests per user, API key, or IP to protect backend systems from abuse and overload, enforceable consistently across a fleet of stateless servers.',
    tldr: 'Enforce limits with an atomic Redis Lua script (check-and-increment as one uninterruptible op) so concurrent app servers never race on the same counter, and fail open with a circuit breaker so a Redis blip throttles nothing rather than taking down the whole API.',
    problemFraming: "Protecting an API from abuse seems like it should be as simple as counting requests per key, but the moment you have more than one server, per-instance in-memory counters silently stop enforcing anything: a client hitting N different app servers behind a load balancer gets N times its intended limit, since no single instance ever sees the full picture. This is exactly the problem Stripe's API gateway and Cloudflare's edge network have to solve at massive scale, where thousands of stateless nodes must agree on one client's quota without each request paying for a cross-node consensus round-trip. Centralizing counters in one store fixes the visibility problem but introduces a new race: two servers reading a counter of 9 (limit 10) simultaneously can both increment and both allow the request, letting 11 through. The hard part isn't the counting algorithm itself — it's making the read-check-increment sequence atomic across a distributed fleet without turning the limiter into the slowest, or least available, part of the request path.",
    priorArt: [
      { title: 'Token Bucket algorithm', description: 'A traffic-shaping algorithm from network engineering (ATM/Frame Relay QoS) that models a client as a bucket refilled at a steady rate, naturally allowing bursts up to bucket capacity — the basis for AWS and Stripe-style rate limits.' },
      { title: 'Redis Lua scripting (EVAL)', description: 'Executes the read-check-increment sequence as one atomic, uninterruptible operation on the Redis server, which is what closes the race condition that plain multi-command counters suffer from.' },
      { title: "Stripe's and Cloudflare's rate-limiting engineering writeups", description: 'Both companies have published on using sliding-window counters and approximate, locally-enforced limits at the edge specifically to avoid a centralized store becoming a bottleneck at their request volumes.' },
      { title: 'Generic Cell Rate Algorithm (GCRA)', description: 'A precise, low-memory alternative to token bucket used in some production limiters (e.g. Cloudflare, Doorman-style systems) that tracks a single "theoretical arrival time" value per client instead of a counter and a timer.' },
    ],
    coreEntities: [
      { name: 'Rule', description: 'Defines a limit: identifier type (user/IP/key), max requests, time window, algorithm.' },
      { name: 'Counter', description: 'Tracks current usage for a specific client + window combination.' },
      { name: 'Window', description: 'The time boundary — fixed 1-minute, sliding, or token bucket refill rate.' },
      { name: 'Decision', description: 'The result of a rate check: ALLOW or REJECT, with remaining quota.' },
    ],
    requirements: {
      core: [
        'Limit requests per client (by API key, user id, or IP) to N requests per time window',
        'Support multiple simultaneous rules (e.g. 10 req/sec AND 1000 req/day per key)',
        'Return a clear rejection (HTTP 429) with a Retry-After header when a client is throttled',
        'Allow different limits per tier (free, pro, enterprise) or per endpoint',
        'Expose current usage/remaining-quota to clients via response headers',
      ],
      belowTheLine: [
        'Adaptive limits that auto-adjust based on system load',
        'Per-endpoint weighting (expensive operations cost more tokens)',
        'Allowlists/blocklists',
        'Rate limit dashboard for API consumers',
      ],
      nonFunctionalTable: [
        { metric: 'Rate-limit check latency added to request path', target: '< 5ms, typically sub-millisecond' },
        { metric: 'Cross-fleet correctness', target: 'Consistent enforcement across all horizontally scaled app server instances, not per-instance' },
        { metric: 'Availability during limiter-store outage', target: 'Fail-open with circuit breaker; a Redis blip must not take down all traffic' },
        { metric: 'Enforcement accuracy', target: 'Approximate is acceptable — a few extra requests during a burst/boundary is tolerable' },
        { metric: 'Config propagation time', target: '< 10s for new limits/tier changes, no redeploy required' },
      ],
    },
    capacityEstimate: 'Consider an API gateway fronting 50,000 active API keys, with an average request rate of 5 req/sec per key at peak and burst clients up to 200 req/sec — total gateway throughput around 250K req/sec at peak. Each rate-limit check is a small Redis operation (a Lua script doing INCR + EXPIRE or a sorted-set trim) costing roughly 0.3-0.5ms round-trip within the same region; at 250K req/sec that\'s comfortably handled by a few Redis nodes doing simple counter ops, especially since operations are O(1) or O(log N) and payloads are tiny (key + counter, under 100 bytes). Storage is minimal — one counter per key per active window, so 50,000 keys * ~200 bytes (including sliding-window timestamp buckets) ≈ 10MB, trivial for memory. The real capacity concern isn\'t data volume, it\'s Redis network round-trips at high QPS, which is why many production limiters shift some checking to local in-process caches with periodic reconciliation rather than hitting Redis on every single request.',
    architecture: 'A rate limiter typically lives as a shared library/middleware invoked by every service instance before the request reaches business logic, backed by a centralized store — most commonly Redis — that holds per-key counters so that limits are enforced consistently regardless of which of N stateless app servers handles a given request. The request path is: client hits the load balancer, which routes to any app server; that server\'s rate-limit middleware extracts the client identifier (API key, user id, or IP), looks up the applicable rule(s) from a config service or local cache, and executes an atomic check-and-increment against Redis using a Lua script (to make "read counter, compare, increment" atomic without a round-trip race between two servers checking simultaneously).\n\nRule configuration (limits per tier, per endpoint) is stored in a small, low-write config store and cached aggressively in each app server\'s memory with short TTL or invalidated via pub/sub when an admin changes a limit, since rules change far less often than requests arrive. For the counter data itself, a common layout keys Redis by `{clientId}:{endpoint}:{windowBucket}` and lets Redis TTL expire old windows automatically, avoiding a separate cleanup job.\n\nAt very high scale, a single centralized Redis becomes a bottleneck and a single point of added latency for every request, so large deployments push rate limiting to the edge: each edge/gateway node keeps a local approximate counter and only periodically syncs aggregate counts to a central store (or uses a gossip-style protocol between nodes), trading perfect global accuracy for the ability to make the vast majority of allow/deny decisions locally, in-memory, with zero network hop. This is why most real-world limiters are documented as "approximate" — a client might occasionally get a few more requests through than the nominal limit during the sync interval, which is an acceptable trade against making every request pay for a cross-node consensus round-trip.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  app1[App Server 1 - local counter]:::compute
  app2[App Server 2 - local counter]:::compute
  backend[Backend Service]:::compute

  client --> lb
  lb --> app1
  lb --> app2
  app1 -->|"if local count < limit"| backend
  app2 -->|"if local count < limit"| backend`,
        bullets: [
          'Multiple servers — 10 API pods each with their own counter means a client hitting different pods effectively gets 10x the limit.',
          'Server restart — in-memory counters vanish, so everyone gets a fresh quota after every deploy.',
          'Memory — 10 million unique users means 10 million map entries, risking OOM.',
          'Window boundaries — 100 requests at 11:59:59 plus 100 more at 12:00:01 both pass their own window check, letting 200 requests through in 2 seconds.',
        ],
      },
      {
        title: 'Core Design: Centralized Atomic Check-and-Increment',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  app[App Server + RL Middleware]:::compute
  redis[("Redis")]:::cache
  backend[Backend Service]:::compute

  client --> lb --> app
  app -->|"EVAL rate_limit.lua(key, limit, window)"| redis
  redis -->|"allow / deny + remaining"| app
  app -->|"if allowed"| backend
  app -->|"429 + Retry-After"| client`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  app[App Servers + RL Middleware]:::compute
  config[[Config Service]]:::compute
  redis[("Redis Counter Store")]:::cache
  backend[Backend Service]:::compute

  client --> lb --> app
  config -.->|"pub/sub rule updates"| app
  app -->|"EVAL check-and-incr"| redis
  redis -.->|"circuit breaker on timeout/failure"| app
  app -->|"fail-open: allow through"| backend
  app -->|"allowed"| backend
  app -->|"429 + Retry-After"| client`,
      },
      {
        title: 'Core Flow: Atomic Check-and-Increment (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant A as App Server (RL Middleware)
  participant R as Redis
  participant B as Backend

  C->>A: request (API key X)
  A->>R: EVAL rate_limit.lua(key, limit, window)
  R-->>A: allowed / remaining / resetAt
  alt allowed
    A->>B: forward request
    B-->>A: response
    A-->>C: 200 + X-RateLimit-Remaining
  else denied
    A-->>C: 429 Too Many Requests + Retry-After
  end`,
      },
    ],
    approaches: [
      {
        name: 'Fixed Window Counter',
        description: 'Divides time into fixed intervals (e.g. every 60 seconds) and maintains one counter per user per window via a single Redis INCR + EXPIRE. Simple but allows a 2x burst across a window boundary — 100 requests just before the boundary plus 100 just after both pass their own window\'s check.',
        pros: ['Dead simple — one INCR + one EXPIRE', 'Minimal memory — 1 counter per user', 'O(1) per request'],
        cons: ['Boundary burst allows 2x the limit', 'Not accurate for tight limits', 'Resets abruptly'],
        usedBy: 'GitHub API (60/hour unauthenticated), Twitter/X (15-minute fixed windows), Slack API',
      },
      {
        name: 'Sliding Window Log',
        description: 'Stores the exact timestamp of every request in a Redis Sorted Set. On each request, purge entries older than now-window, count what remains, and allow if under the limit. Perfectly accurate but memory-heavy — a 10K req/min limit means 10K stored timestamps per user.',
        pros: ['Perfectly accurate — zero boundary burst', 'True rolling window', 'No approximation'],
        cons: ['Memory-heavy: stores every timestamp', '10K req/min limit = 10K entries per user', 'O(n) cleanup on each request'],
        usedBy: 'Payment/billing systems where exact counts are non-negotiable',
      },
      {
        name: "Sliding Window Counter (Cloudflare's approach)",
        description: "Keeps two counters — current window and previous window — and estimates the rolling count with a weighted formula: current_count + (previous_count x overlap_percentage). Combines the accuracy of a sliding window with the O(1) memory of a fixed window.",
        pros: ['Smooth — no boundary bursts', 'O(1) memory — just 2 counters per user', 'Cloudflare tested: 400M requests, 0.003% error'],
        cons: ['Approximate (~0.003% error rate)', 'Slightly more logic than fixed window'],
        usedBy: 'Cloudflare (45M+ req/sec), most modern REST APIs',
      },
      {
        name: 'Token Bucket',
        description: 'Each client has a bucket with a maximum capacity, refilled at a fixed rate; each request consumes a token, and an empty bucket means reject. Allows controlled bursts up to bucket capacity while the average rate converges to the refill rate over time — matching how real user traffic actually behaves.',
        pros: ['Allows natural burst behavior', 'Smooth long-term rate enforcement', 'Memory efficient — ~50 bytes per user', 'Best UX for API consumers'],
        cons: ['Two values stored per user (tokens + timestamp)', 'Tuning capacity + refill rate takes thought', 'In distributed systems, needs Redis for sync'],
        usedBy: 'Stripe, AWS API Gateway, GitHub, Amazon — the industry default for public APIs',
      },
      {
        name: 'Leaky Bucket',
        description: 'Incoming requests queue into a bucket of fixed capacity; a background worker drains the queue at a constant rate. If the queue is full, new requests are dropped. Unlike token bucket (which shapes input), leaky bucket shapes output — smoothing bursty input into a steady, protective stream for downstream services.',
        pros: ['Perfectly smooth output — protects backends', 'Prevents downstream overload', 'Simple FIFO queue implementation'],
        cons: ['No burst tolerance — strict constant rate', 'Adds latency (requests wait in queue)', 'Old requests processed before new ones'],
        usedBy: 'Shopify REST API (40 bucket size, 2/sec leak rate), Netflix (streaming traffic shaping)',
      },
    ],
    whereThisFits: [
      { layer: 'Edge (Cloudflare/WAF)', blocks: 'DDoS, bots, abusive IPs', key: 'IP address', example: 'No IP can send more than 1000 req/sec' },
      { layer: 'Gateway (Kong/Envoy)', blocks: 'Per-user quota enforcement', key: 'API key or user ID', example: 'Free tier: 100/min. Paid: 10000/min' },
      { layer: 'Service level', blocks: 'Domain-specific limits', key: 'Per resource', example: 'Max 5 password reset emails/hour' },
    ],
    deepDive: [
      {
        title: 'Token bucket vs. sliding window counter',
        body: 'Token bucket models each client as a bucket that holds up to B tokens, refilled at rate R tokens/sec; each request consumes a token, and requests are rejected when the bucket is empty. It naturally allows short bursts up to the bucket size while enforcing a steady-state average rate, which matches how real traffic behaves (bursty, not uniform) — this is why AWS and Stripe both document token-bucket-style limits. The sliding window counter (splitting time into small buckets, e.g. per-second, and summing the last N buckets) avoids the "double allowance at window boundary" flaw of fixed windows — where a client could send N requests at 11:59:59 and another N at 12:00:00, getting 2N through in two real seconds — while being cheaper than a fully precise sliding-log (which stores every request timestamp and costs O(N) memory per client). Most production systems pick sliding window counter for its accuracy/cost balance, or token bucket when burst tolerance is a product requirement.',
        diagram: `flowchart LR
  refill[Refill Timer: +R tokens/sec]:::compute
  bucket[("Token Bucket (capacity B)")]:::cache
  request[Incoming Request]:::client
  allow[Allow: consume 1 token]:::compute
  deny[Deny: 429]:::compute

  refill -->|"add tokens up to capacity"| bucket
  request --> bucket
  bucket -->|"token available"| allow
  bucket -->|"bucket empty"| deny`,
      },
      {
        title: 'Atomicity under concurrent requests',
        body: 'If two app servers simultaneously read a counter value of 9 (limit 10), both increment, and both allow the request, the client got 11 through — a classic check-then-act race. The fix is to make the read-check-increment sequence atomic at the Redis level using a single Lua script (EVAL) that Redis executes as one uninterruptible operation, or using Redis\'s native atomic commands (INCR returns the post-increment value directly, so you check the *result* of the increment rather than a stale pre-read value). This collapses what would be a multi-round-trip distributed transaction into a single network call with server-side atomicity, which is both correct and fast.',
      },
      {
        title: 'Fail-open vs. fail-closed on limiter store outage',
        body: 'When Redis is unreachable, the middleware must decide: block all traffic (fail-closed, safe for the backend but takes down the whole API on a cache blip) or allow all traffic through unthrottled (fail-open, keeps the product up but exposes backends to unmetered load during the outage). Most production systems choose fail-open with a circuit breaker: after a few failed Redis calls within a short window, stop trying Redis for a cooldown period and allow requests through, logging heavily, on the reasoning that a rate limiter\'s job is to protect against sustained abuse, not to be a second point of failure that\'s stricter than the system it protects. Sensitive endpoints (e.g. login, password reset) may instead choose fail-closed since unmetered abuse there is more dangerous than brief unavailability.',
      },
      {
        title: 'Distributed edge counting without a central bottleneck',
        body: 'When rate limiting runs at dozens of edge PoPs (as with a CDN-integrated limiter), routing every check to one central Redis adds cross-region latency and creates a single point of contention. A common pattern is local-first counting: each edge node maintains its own counter and enforces a *node-local* fraction of the global limit (e.g. global limit 1000/sec split across 10 nodes ≈100/sec locally, adjusted dynamically based on observed traffic share), periodically reconciling with a central aggregator. This sacrifices perfect precision — a client hitting multiple edge nodes could theoretically get more than the nominal global limit — in exchange for keeping the hot path entirely local and fast, which is the right trade when the limiter\'s purpose is abuse prevention, not billing-grade metering.',
      },
    ],
    tradeoffs: [
      {
        title: 'Accuracy vs. latency and cost',
        body: 'A sliding-log limiter that stores every request timestamp gives perfectly accurate enforcement but costs O(N) memory per client and O(N) time to prune old entries on every check. A fixed or sliding-window counter approximates the same behavior with O(1) memory and O(1) checks, at the cost of small boundary inaccuracies. For abuse prevention (the typical use case), the approximation is virtually always worth it — nobody notices if a client got 3 extra requests through during a window transition, but everybody notices if the rate limiter itself becomes the slowest part of the request path.',
      },
      {
        title: 'Centralized store vs. local-node enforcement',
        body: 'A single centralized Redis gives exact, globally consistent limits and is simple to reason about, but adds a network round-trip to every request and becomes a scaling and availability bottleneck as request volume grows. Local, in-process counting on each server/edge node removes that round-trip entirely but requires accepting either coarser global accuracy (each node only sees its own slice of traffic) or added complexity (periodic sync/gossip protocols) to approximate a global view. Systems choose centralized when correctness matters more than raw throughput (e.g. billing-tied quotas) and local-first when the priority is protecting infrastructure at massive scale.',
      },
      {
        title: 'Per-client granularity vs. operational simplicity',
        body: 'Fine-grained limits (different rules per endpoint, per tier, per client, combined with burst allowances) give precise control and better product experience but multiply the number of rules the system must track, cache, and keep consistent, and complicate the "which rule applies" logic on every request. A single global limit per API key is trivial to implement and reason about but either over-restricts light endpoints or under-protects expensive ones. Most systems converge on a middle ground: a small number of tiers (free/pro/enterprise) crossed with a small number of endpoint cost classes (cheap/expensive), rather than a fully bespoke rule per client-endpoint pair.',
      },
    ],
    failureMode: {
      title: 'What Happens When Redis Goes Down?',
      body: "Three options: fail-closed rejects all requests — safe for backends but causes a global outage of the API; fail-open allows all requests through unthrottled — keeps the API up but leaves backends unprotected from whatever load arrives; or fail-open with a local fallback, where each pod switches to a local in-memory token bucket the moment Redis becomes unreachable. The best answer for interviews is fail-open with a local fallback: it's less accurate (each pod enforces roughly limit/N independently, since pods no longer share a global view), but the API stays up, and the system alerts loudly on Redis being down so ops can investigate — a rate limiter's job is to protect against abuse, not to become a stricter single point of failure than the system it's protecting.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/ratelimit/check',
        description: 'Check-and-increment a rate-limit counter for a client/key against the applicable rule; returns allow/deny plus quota headers.',
        example: '// Request\n{ "clientKey": "apikey_9f21", "endpoint": "/orders", "cost": 1 }\n\n// Response 200\n{ "allowed": true, "limit": 1000, "remaining": 942, "resetAt": "2026-07-16T12:01:00Z" }',
      },
      {
        method: 'GET',
        path: '/v1/ratelimit/{clientKey}/usage',
        description: 'Return current usage and remaining quota for a client across its active rules, for surfacing in response headers or dashboards.',
        example: '// Response 200\n{ "clientKey": "apikey_9f21", "rules": [ { "window": "1s", "limit": 10, "used": 3 }, { "window": "1d", "limit": 1000, "used": 58 } ] }',
      },
      {
        method: 'PUT',
        path: '/v1/rules/{tier}',
        description: 'Create or update the rate-limit rule set for a pricing tier or endpoint class. Propagated to app servers via pub/sub.',
        example: '// Request\n{ "tier": "pro", "endpoint": "/orders", "limit": 50, "windowSeconds": 1 }\n\n// Response 200\n{ "updated": true, "propagatedAt": "2026-07-16T12:00:03Z" }',
      },
      {
        method: 'GET',
        path: '/v1/rules',
        description: 'List all currently active rate-limit rules across tiers and endpoints.',
        example: '// Response 200\n{ "rules": [ { "tier": "free", "endpoint": "*", "limit": 10, "windowSeconds": 1 } ] }',
      },
    ],
    keyTechnologies: [
      { term: 'Token Bucket', definition: 'An algorithm modeling a client as a bucket of B tokens refilled at rate R/sec; each request consumes a token, naturally allowing bursts up to B while capping the steady-state rate.' },
      { term: 'Sliding Window Counter', definition: 'Splits time into small sub-buckets and sums the last N of them to approximate a true sliding window without the boundary-doubling flaw of fixed windows.' },
      { term: 'Redis Lua Scripting (EVAL)', definition: 'Executes a script server-side as one atomic operation, letting a read-check-increment sequence happen without a race between concurrent callers.' },
      { term: 'Leaky Bucket', definition: 'A variant that processes requests at a constant outflow rate regardless of burst size, smoothing traffic rather than allowing bursts through immediately.' },
      { term: 'Circuit Breaker', definition: 'A pattern that stops calling a failing dependency (like Redis) after repeated failures, failing fast/open for a cooldown period instead of blocking every request on a timeout.' },
      { term: 'Fixed Window Counter', definition: 'The simplest and cheapest limiter: one counter per discrete time window (e.g. per minute), vulnerable to a 2x burst at window boundaries.' },
    ],
    selfAudit: [
      {
        question: 'What happens when a single popular API key becomes a hot key hammering one Redis shard?',
        answer: 'The key is sharded by hashing clientKey + a small suffix bucket into N sub-counters, with the effective limit divided across them, or the check is pushed to a local/edge counter with periodic reconciliation so the hot path never round-trips to the same Redis node on every request.',
      },
      {
        question: 'How do you avoid an abuse window when the limiter fails open during a Redis outage?',
        answer: 'Fail-open is paired with a short circuit-breaker cooldown (not indefinite bypass), heavy logging/alerting during the open period, and sensitive endpoints (login, payments) are configured to fail-closed instead so unmetered abuse there is prevented even at the cost of brief unavailability.',
      },
      {
        question: 'A client is rate-limited to 10 req/sec — can they still burst above that briefly?',
        answer: 'Yes, by design if using token bucket (burst up to bucket capacity B) or a coarse fixed window; a sliding window counter bounds this more tightly. The NFRs explicitly accept small boundary overshoot since perfect precision costs more latency/memory than the abuse-prevention goal justifies.',
      },
      {
        question: 'How fast does a limit change (e.g. free-to-pro upgrade) actually take effect?',
        answer: 'Rule config is cached per app server with a short TTL and invalidated via pub/sub on change, so propagation is typically sub-second to a few seconds — bounded by pub/sub delivery time, not a redeploy or restart.',
      },
      {
        question: 'Does the limiter work correctly if a client is routed to different app servers across requests?',
        answer: 'Yes — because the counter state lives in centralized Redis (or is periodically reconciled if edge-local), the limit is enforced against the same shared value regardless of which stateless app server instance handled the request.',
      },
    ],
    cheatSheet: [
      { question: 'Which algorithm?', answer: 'Token Bucket — allows bursts, caps sustained rate.' },
      { question: 'Where to store counters?', answer: 'Redis — sub-ms latency, atomic Lua, built-in TTL.' },
      { question: 'How to make it atomic?', answer: 'Redis Lua script — read + check + decrement in one operation.' },
      { question: 'What if Redis is down?', answer: 'Fail-open + local fallback. Never be a single point of failure.' },
      { question: 'Where to put it?', answer: '3 layers: Edge (IP/DDoS) → Gateway (per-user) → Service (domain logic).' },
      { question: 'How to handle distributed?', answer: 'Centralized Redis for strict limits; local sync for soft limits.' },
      { question: 'What headers to return?', answer: 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After.' },
    ],
    expectedDepth: {
      mid: 'Explain the token bucket or fixed window algorithm. Propose Redis INCR for counting requests per time window. Understand why in-memory counters fail across multiple servers — each server has its own count, so a client can exceed limits by hitting different servers.',
      senior: 'Compare token bucket vs sliding window vs sliding window log — articulate the tradeoffs (burst tolerance, memory, precision). Propose Redis Lua scripts for atomic check-and-increment. Discuss multi-tier limiting (edge + gateway + service) and what happens when Redis goes down (fail-open vs fail-closed tradeoff).',
      staffPlus: 'Address distributed rate limiting across multiple regions with eventual consistency (local counters + periodic sync vs centralized Redis). Discuss adaptive rate limits that adjust dynamically based on system load, shedding traffic before the backend saturates. Cover per-endpoint granularity (expensive operations like writes get tighter limits than cheap reads) and cost-based limiting where each operation has a "weight" consuming tokens proportionally.',
    },
    keyTakeaways: [
      'Token bucket allows bursts; sliding window is smoother but more complex',
      'Redis Lua scripts make check-and-increment atomic — no race conditions',
      'Apply at multiple levels: per-user, per-IP, per-endpoint, global',
      'Return 429 with a Retry-After header — good API citizenship',
    ],
    relatedDesigns: ['url-shortener', 'real-time-leaderboard', 'notification-system'],
  },
  {
    slug: 'pastebin',
    title: 'Pastebin / Text Sharing',
    difficulty: 'Beginner',
    icon: 'pi pi-file-edit',
    color: '#10b981',
    concepts: ['Base62 Short URL', 'Object Storage (Blob)', 'CDN Caching', 'TTL Expiry', 'Read-Heavy Caching'],
    companies: ['GitHub (Gists)', 'Dropbox', 'Bit.ly', 'Google Cloud'],
    summary: 'A service for uploading arbitrary text snippets and retrieving them via a short, shareable link, optimized for a read-heavy access pattern with optional expiration.',
    tldr: 'Split small, fixed-shape metadata (short code, expiry, pointer) into a fast indexed store from large, variable-length content in object storage, and serve reads through a cache-aside layer — since the workload is read-heavy and Zipfian, caching even the top few percent of pastes absorbs most traffic.',
    problemFraming: "Storing a short snippet of text and handing back a link looks trivial until you look at the shape of real usage: services like GitHub Gists and Bit.ly see a 10:1 or higher read-to-write ratio, with a small number of pastes going viral and getting thousands of reads per second while the long tail is read once or twice and forgotten. The naive design — one relational table with a TEXT/BLOB column holding the paste content, queried directly on every read — breaks in two ways at once: large variable-length blobs bloat the database's buffer pool and slow down unrelated queries, and every viral paste hammers the same database row with read traffic the database was never sized for. There's also a subtler correctness problem in expiration: if you only expire pastes via a periodic cleanup job, there's a window where a paste that should be gone is still served, which is a data-handling bug, not a performance one. The design has to solve storage-shape mismatch, hot-key read skew, and expiry correctness all at once.",
    priorArt: [
      { title: 'Bit.ly-style Base62 short URL encoding', description: 'Encodes a numeric counter into a compact, URL-safe short code — the same short-code generation approach this design uses to keep paste links short and collision-free by construction.' },
      { title: 'S3-class object storage', description: 'A purpose-built store for large, variable-length, write-once/read-many payloads with byte-range reads and lifecycle-based auto-expiry, which is why paste content lives there instead of in a relational BLOB column.' },
      { title: "Cache-aside pattern (as popularized by Facebook's Memcache-in-front-of-MySQL architecture)", description: 'The application checks cache first and populates it on miss rather than writing through — the standard approach for absorbing Zipfian-skewed read traffic without hitting the origin store on every request.' },
      { title: 'TinyURL / URL-shortener design pattern', description: 'The general architecture of decoupling a short, allocator-issued key from the (potentially large) resource it points to, which this design reuses for pastes instead of URLs.' },
    ],
    coreEntities: [
      { name: 'Paste', description: 'The core content object — text/code body, language tag, owner, visibility.' },
      { name: 'ShortCode', description: "The unique, URL-safe key that maps to a paste's content pointer." },
      { name: 'Metadata', description: 'A small, fixed-shape record (expiry, creation time, view count, access flags) indexed separately from content.' },
      { name: 'ExpiryPolicy', description: 'The rule governing when a paste becomes inaccessible — TTL, view-count cap, or manual delete.' },
    ],
    requirements: {
      core: [
        'Accept a text/code snippet upload and return a short unique URL for retrieving it',
        'Serve the original content when a client visits the short URL',
        'Support optional expiration (paste auto-deletes/becomes inaccessible after a set time or view count)',
        'Support optional custom aliases and optional password protection or private/unlisted pastes',
        'Provide syntax-highlighting hints (language tag) and basic metadata (creation time, view count)',
      ],
      belowTheLine: [
        "Version history / diff view across edits to a paste (most pastebins are otherwise immutable)",
        "Full-text search across a user's own paste history",
        'Team/organization workspaces with shared, access-controlled paste collections',
        'A usage dashboard for prolific paste creators (views over time, referrers)',
      ],
      nonFunctionalTable: [
        { metric: 'Read latency', target: '< 100ms at p99 (reads dominate ~10:1 over writes)' },
        { metric: 'Short code collision probability', target: 'Effectively zero — collision-free by construction, or negligible under hashing with retry' },
        { metric: 'Storage scale', target: 'Hundreds of millions of pastes without a redesign' },
        { metric: 'Read availability', target: 'Reads remain available even if the write path degrades briefly' },
        { metric: 'Durability before expiry', target: "No silent data loss prior to a paste's configured expiry" },
      ],
    },
    capacityEstimate: 'Assume 1M new pastes created per day (about 12 writes/sec average, bursting to 100/sec) and a read:write ratio of 10:1, giving roughly 120 reads/sec average and higher during viral spikes on individual popular pastes. Average paste size is modest — call it 10KB (most are a few lines to a few hundred lines of text/code) — so daily storage growth is 1M * 10KB = 10GB/day, or about 3.6TB/year before accounting for deletions/expirations, which is cheap on object storage (S3-class storage at roughly $0.023/GB/month means ~3.6TB costs under $100/month). Metadata (short code, creation time, expiry, owner, content pointer) is small, maybe 200 bytes per paste, so 1M/day * 200 bytes = 200MB/day of metadata — trivial for a relational or key-value index, and easily cached. A 7-character base62 short code space (62^7 ≈ 3.5 trillion) comfortably avoids collisions even at billions of pastes, so ID exhaustion is a non-issue at this scale.',
    architecture: 'On write, a client POSTs paste content to an API server behind a load balancer; the server generates a short, unique key (via a counter-based base62 encoder or a hash-based approach, discussed below), writes the actual content blob to an object store (S3-class storage) keyed by that short code, and writes a small metadata row (short code, content pointer, expiry, creation time, view count, optional owner) to a fast key-value or relational store. Storing large text bodies in a purpose-built blob store rather than a relational database avoids bloating a row-oriented database with variable, sometimes large payloads, and lets the database stay small and fast for metadata lookups and TTL/expiry queries.\n\nOn read, a client requests `/​{shortCode}`; the API server first checks a cache (Redis or an in-memory LRU) for that short code\'s content, since popular pastes are read far more often than they\'re written — a classic case for a read-through cache with the paste content itself as the cached value, keyed by short code, with a TTL that\'s refreshed on access. On a cache miss, the server looks up metadata (to confirm the paste isn\'t expired/deleted and to check any access controls like password protection), fetches the blob from object storage, populates the cache, and returns it. For very popular or viral pastes, a CDN can sit in front of the API layer entirely and serve cached content directly at the edge, bypassing the origin servers for the vast majority of requests.\n\nExpiration is handled lazily and eagerly in combination: reads always check the stored expiry timestamp and return 404/410 for expired pastes regardless of whether cleanup has run yet (correctness doesn\'t depend on a background job), while a periodic sweeper job scans for expired metadata rows and deletes the corresponding blobs from object storage to reclaim space and keep the metadata index small. This decouples "is this paste accessible" (checked synchronously, cheap) from "reclaim the storage" (done asynchronously, in bulk).',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[API Server]:::compute
  pg[(PostgreSQL)]:::database

  client -->|"POST /paste {content}"| api
  api -->|"INSERT content TEXT column"| pg
  client -->|"GET /{code}"| api
  api -->|"SELECT content WHERE code = ?"| pg`,
      },
      {
        title: 'Core Design: Split Metadata from Blob Storage with Read-Through Cache',
        mermaid: `flowchart LR
  client[Client]:::client
  api[API Server]:::compute
  cache[("Redis Cache")]:::cache
  meta[(Metadata DB)]:::database
  blob[["Object Storage (S3)"]]:::storage

  client -->|"POST /paste"| api
  api -->|"write short code, expiry, pointer"| meta
  api -->|"PUT blob"| blob
  client -->|"GET /{code}"| api
  api -->|"check cache"| cache
  cache -->|"miss"| meta
  api -->|"GET blob"| blob
  api -->|"populate cache"| cache`,
      },
      {
        title: 'Incremental: CDN Edge Caching for Viral Reads',
        mermaid: `flowchart LR
  client[Client]:::client
  cdn[["CDN Edge"]]:::edge
  api[API Server]:::compute
  cache[("Redis Cache")]:::cache
  blob[["Object Storage"]]:::storage
  meta[(Metadata DB)]:::database

  client --> cdn
  cdn -.->|"edge cache hit, bypass origin"| client
  cdn -->|"cache miss"| api
  api --> cache
  cache -->|"miss"| meta
  api --> blob`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  cdn[["CDN"]]:::edge
  lb[Load Balancer]:::edge
  api[API Servers]:::compute
  cache[("Redis Cache")]:::cache
  meta[(Metadata DB)]:::database
  blob[["Object Storage"]]:::storage
  sweeper[Expiry Sweeper Job]:::compute

  client --> cdn --> lb --> api
  api --> cache
  cache -->|"miss"| meta
  api --> blob
  sweeper -->|"scan expired rows"| meta
  sweeper -->|"delete expired blob"| blob`,
      },
    ],
    approaches: [
      {
        name: 'Single Relational Table with a TEXT/BLOB Column',
        description: 'Store the short code, metadata, and full paste content in one relational row, read and written directly.',
        pros: ['Simplest possible implementation', 'One transaction covers metadata and content together'],
        cons: ['Large/variable blobs bloat the buffer pool and slow down unrelated queries', 'No natural TTL/lifecycle support, and replication cost balloons with content size'],
        usedBy: 'Small-scale or early-stage pastebin clones',
      },
      {
        name: 'Split Metadata Store + Object Storage + Cache-Aside',
        description: 'Keep small, fixed-shape metadata in a fast indexed store, large content blobs in object storage, and serve hot reads through a cache-aside layer.',
        pros: ['Each store is optimized for its own access pattern', 'Object storage gives cheap multi-AZ redundancy and lifecycle-based auto-expiry', 'The metadata index stays small and fast'],
        cons: ['Two writes per paste creation (metadata + blob) must be kept consistent', 'More moving parts than a single table'],
        usedBy: 'GitHub Gists, Dropbox-style file-sharing services',
      },
      {
        name: 'Counter-Based vs. Hash-Based Short Codes',
        description: 'Counter-based codes (base62 of an atomically-allocated sequence) are collision-free by construction; hash-based codes (truncated MD5/SHA of the content) need no coordinated allocator but require collision detection and retry.',
        pros: ['Counter: predictable short length, zero collision handling', 'Hash: no coordination dependency, naturally dedupes identical content'],
        cons: ['Counter: needs a highly-available allocator service on the write path', 'Hash: collision probability rises well before the theoretical keyspace is exhausted, per the birthday bound'],
        usedBy: 'Counter-based codes dominate most production pastebin systems',
      },
    ],
    whereThisFits: [
      { layer: 'Edge / CDN', blocks: 'Serving viral/hot pastes without hitting origin at all', key: 'short code', example: 'CDN caches the GET /{code} response for a trending gist' },
      { layer: 'API / Cache (Redis)', blocks: 'Absorbing Zipfian read skew for the top few percent of pastes', key: 'short code -> content', example: 'Cache-aside populated on first miss, TTL refreshed on access' },
      { layer: 'Metadata store', blocks: 'Fast expiry checks, access control, view counting', key: 'short code -> pointer/expiry', example: 'Synchronous expiry check on every read regardless of sweeper status' },
      { layer: 'Object storage', blocks: 'Durable, cheap storage of variable-length content', key: 'short code -> blob', example: 'S3 object with a lifecycle rule auto-deleting after TTL' },
    ],
    deepDive: [
      {
        title: 'Generating short, unique codes at scale',
        body: 'Two common approaches: (1) a centralized counter (e.g. from a database sequence, Redis INCR, or a Snowflake-style ID generator) that\'s then base62-encoded into a compact string — guarantees uniqueness by construction and produces short codes quickly, but requires the counter service to be highly available; or (2) hashing the content (or content + timestamp) with something like MD5/SHA and taking the first 7 characters — no coordination needed, but collisions are possible and must be detected (check-and-retry with a different hash seed, or append a discriminator) and the result isn\'t sequential, which is fine since ordering isn\'t a requirement here. Counter-based approaches are generally preferred for pastebin-style systems because they avoid the collision-handling complexity and produce predictably short, dense codes even at billions of entries, at the modest cost of running a coordinated ID-allocation service.',
        diagram: `flowchart LR
  api[API Server]:::compute
  counter[[ID Allocator]]:::compute
  meta[(Metadata Store)]:::database

  api -->|"request next id"| counter
  counter -->|"increment atomically"| counter
  counter -->|"base62-encoded short code"| api
  api -->|"store code -> content pointer"| meta`,
      },
      {
        title: 'Why content lives in object storage, not the database',
        body: 'Paste sizes vary wildly, from a one-line snippet to megabytes of logs, and relational databases handle large variable-length BLOBs poorly — they bloat table/page sizes, slow down unrelated queries via buffer pool pollution, and complicate replication (replicating large blobs on every write is expensive). Splitting concerns — small, fixed-shape metadata in a fast indexed store; large, variable content in a purpose-built blob store optimized for exactly this access pattern (write-once, read-many, byte-range fetches) — lets each store do what it\'s good at. Object stores also give cheap built-in redundancy (multi-AZ replication) and lifecycle policies that can auto-expire objects after N days, which nicely mirrors the paste-expiration requirement without custom cleanup code for the content itself.',
      },
      {
        title: 'Cache strategy for a heavily skewed read distribution',
        body: 'Paste popularity follows a long-tail/Zipfian distribution: a small number of pastes (viral snippets, popular Stack Overflow-linked gists) receive the overwhelming majority of reads, while most pastes are read once or twice and then forgotten. This makes a simple LRU or LFU cache highly effective with a relatively small cache size relative to total corpus size — caching even the top 1-5% of pastes by access frequency can absorb the large majority of read traffic. It also means CDN edge caching is unusually effective here compared to systems with more uniform access patterns, since a CDN cache-hit ratio scales directly with how skewed the popularity curve is.',
      },
      {
        title: 'Expiration correctness without relying on a background sweeper',
        body: 'If expiration were enforced only by a periodic delete job, there\'s a window between "paste should be expired" and "sweeper actually ran" during which a supposedly-expired paste remains readable — a correctness bug, not just a cosmetic delay. The fix is to always store an explicit expiry timestamp (or view-count-based expiry counter) in metadata and check it synchronously on every read path, returning not-found for anything past its expiry regardless of whether physical deletion happened yet. The sweeper then becomes purely a storage-reclamation mechanism, decoupled from correctness — it can run hourly or daily in batches without any user-visible impact, and can even use object storage lifecycle rules to avoid needing a custom job at all for the content blobs.',
      },
    ],
    tradeoffs: [
      {
        title: 'Counter-based IDs vs. hash-based IDs',
        body: 'Counter-based short codes are collision-free by construction and stay compact even at huge scale, but require a coordinated, highly-available allocator (a single logical sequence, even if sharded), introducing an extra dependency on the write path. Hash-based codes need no coordination and can be computed independently by any server, but require collision detection/handling and, for short hash prefixes, the birthday-paradox collision probability becomes non-trivial well before you\'d expect (a 6-character base62 hash has only ~56 billion possible values, and collisions become likely long before that count is reached per the birthday bound). Pastebin-scale systems typically accept the coordination cost for the collision-free guarantee.',
      },
      {
        title: 'Aggressive caching vs. staleness on edited/deleted content',
        body: 'Caching paste content aggressively (long TTLs, CDN edge caching) maximizes read performance and minimizes origin load, which matters enormously given the read-heavy access pattern — but it means a deleted or expired paste might still be served from a stale cache/CDN edge for some window after deletion. Since most pastebin services treat pastes as immutable once created (no editing, only creation and deletion/expiry), this is manageable: cache invalidation on delete can be an explicit purge call, and short TTLs bound the staleness window for expiry-based removal without requiring an active invalidation protocol.',
      },
      {
        title: 'Single blob store vs. tiered storage by access frequency',
        body: 'Storing every paste in the same storage tier is simple to build and reason about, but wastes cost on cold, rarely-accessed old pastes sitting in the same tier as hot content. Moving cold pastes (e.g. untouched for 90+ days) to a cheaper, higher-latency storage class (like S3 Glacier-equivalent) cuts storage cost significantly at scale, but adds complexity: a lifecycle/migration job, and a slower path for the rare cold-read that needs a restore-then-serve flow. For a system at moderate scale the added complexity usually isn\'t worth it until storage costs become a meaningfully large line item.',
      },
    ],
    failureMode: {
      title: 'What Happens When Object Storage Is Unreachable?',
      body: 'Because content is split from metadata, the two dependencies fail independently: the metadata store can still answer "does this paste exist and is it expired" even when the blob store is down, so reads can at least return a meaningful "temporarily unavailable" rather than a hard error. Hot pastes already sitting in the Redis cache-aside layer keep serving normally, since a cache hit never touches object storage at all, which covers the large majority of read traffic given how skewed paste popularity is. Cold reads (uncached pastes) and all new writes fail during the outage; writes can be buffered to a small durable queue and retried once the store recovers rather than being rejected outright, trading a short visible delay for not losing a user\'s paste. Once object storage is back, the queue drains and any cache entries populated with stale placeholders are invalidated.',
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/pastes',
        description: 'Create a new paste. Returns a short code and shareable URL. Supports optional TTL, custom alias, and password.',
        example: '// Request\n{ "content": "print(\\"hello\\")", "language": "python", "expiresInSec": 86400, "customAlias": null }\n\n// Response 201\n{ "code": "aZ9kLq2", "url": "https://paste.dev/aZ9kLq2", "expiresAt": "2026-07-17T12:00:00Z" }',
      },
      {
        method: 'GET',
        path: '/v1/pastes/{code}',
        description: 'Retrieve paste content and metadata. Returns 404/410 if not found or expired, regardless of sweeper cleanup status.',
        example: '// Response 200\n{ "code": "aZ9kLq2", "content": "print(\\"hello\\")", "language": "python", "createdAt": "2026-07-16T12:00:00Z", "viewCount": 42 }',
      },
      {
        method: 'DELETE',
        path: '/v1/pastes/{code}',
        description: 'Delete a paste immediately (owner only). Also issues a CDN/cache purge for the short code.',
        example: '// Response 204 No Content',
      },
      {
        method: 'GET',
        path: '/v1/pastes/{code}/meta',
        description: 'Fetch just metadata (creation time, expiry, view count, language tag) without pulling the full content blob.',
        example: '// Response 200\n{ "code": "aZ9kLq2", "createdAt": "2026-07-16T12:00:00Z", "expiresAt": "2026-07-17T12:00:00Z", "viewCount": 42, "language": "python" }',
      },
    ],
    keyTechnologies: [
      { term: 'Base62 Encoding', definition: 'Encodes a numeric ID using 62 alphanumeric characters (a-z, A-Z, 0-9), producing short, URL-safe, case-sensitive codes.' },
      { term: 'Object Storage (Blob Store)', definition: 'A purpose-built store (e.g. S3) for large, variable-length binary/text payloads with byte-range reads, lifecycle expiry, and multi-AZ redundancy.' },
      { term: 'Cache-Aside Pattern', definition: 'The application checks the cache first, and on a miss reads from the source of truth and populates the cache — as opposed to write-through caching.' },
      { term: 'TTL / Lazy Expiration', definition: 'Expiry is checked synchronously on every read (correctness), while physical deletion happens later via a background sweeper (storage reclamation only).' },
      { term: 'LRU/LFU Cache', definition: 'Eviction policies (Least Recently/Frequently Used) that keep the hottest subset of pastes in memory, effective here due to Zipfian access skew.' },
      { term: 'CDN Edge Caching', definition: 'Caches paste responses at geographically distributed edge nodes, serving repeat reads without a round trip to origin servers.' },
    ],
    selfAudit: [
      {
        question: 'What happens when a paste suddenly goes viral and gets thousands of reads per second?',
        answer: 'The cache-aside layer absorbs the vast majority of reads after the first fetch; request coalescing prevents a thundering-herd of cache misses hitting the metadata DB/object store simultaneously, and CDN edge caching can absorb the load entirely before it reaches the origin.',
      },
      {
        question: 'How do you handle hash collisions if you switch to a hash-based short code?',
        answer: 'On collision, the write is retried with a different hash seed (or a discriminator character appended) and re-checked against the metadata index before being accepted — this is exactly why most pastebin-scale systems prefer counter-based codes, which are collision-free by construction.',
      },
      {
        question: 'Can a paste be served after it should have expired?',
        answer: "No — every read path synchronously checks the stored expiry timestamp and returns 404/410 regardless of whether the background sweeper has physically deleted the blob yet, so correctness never depends on sweeper timing.",
      },
      {
        question: 'What if someone uploads a 500MB paste?',
        answer: "The API enforces a max content size at the write path (rejecting or requiring chunked/multipart upload above a threshold), since object storage handles large blobs fine but the product use case (readable text snippets) doesn't need multi-hundred-MB pastes — a size cap keeps abuse and storage cost bounded.",
      },
      {
        question: 'A user deletes a paste, but a friend still sees it via a CDN edge cache — is that a bug?',
        answer: "It's an accepted, bounded staleness window rather than a bug: since pastes are treated as immutable content, deletion triggers an explicit cache/CDN purge call, and even without one, TTLs bound how long a stale edge copy can be served.",
      },
    ],
    cheatSheet: [
      { question: 'Which storage split?', answer: 'Small metadata in an indexed DB, large content in object storage — never a relational TEXT/BLOB column.' },
      { question: 'Where does state live?', answer: 'Metadata store (source of truth for expiry/access) plus object storage (content) plus Redis (hot read cache).' },
      { question: 'How to keep writes safe without a distributed transaction?', answer: 'Write the blob then the metadata pointer; a dangling blob without metadata is harmless orphaned storage, not a correctness bug.' },
      { question: 'What if object storage is down?', answer: 'Serve cached hot pastes normally; fail cold reads/writes gracefully with retry rather than touching the metadata/expiry path.' },
      { question: 'How is it layered?', answer: 'CDN edge → cache-aside API → metadata store → object storage.' },
      { question: 'How does expiry stay correct?', answer: 'Check the expiry timestamp synchronously on every read; the background sweeper only reclaims storage, never gates correctness.' },
      { question: 'Counter vs. hash short codes?', answer: 'Counter-based is collision-free by construction, which is why most production systems prefer it over hashing.' },
    ],
    expectedDepth: {
      mid: 'Propose splitting large content from small metadata, understand why the workload is read-heavy, and know to check expiry synchronously on read rather than relying solely on a cron job.',
      senior: 'Compare counter-based vs. hash-based code generation, design a cache-aside layer with appropriate TTLs, explain why CDN caching is unusually effective here given Zipfian access skew, and handle thundering-herd misses on a newly viral paste.',
      staffPlus: 'Discuss tiered storage by access frequency (hot vs. cold pastes), multi-region replication tradeoffs for global read latency, abuse mitigation via size caps, and generalize the sync-correctness/async-cleanup split (expiry check vs. sweeper) as a pattern applicable well beyond this one system.',
    },
    keyTakeaways: [
      'Split fixed-shape metadata from variable-length content — each store does what it is good at.',
      'Cache-aside plus CDN edge caching works exceptionally well because paste popularity is Zipfian.',
      'Expiry correctness must be checked synchronously on read; the sweeper only reclaims storage.',
      'Counter-based short codes avoid collision-handling complexity entirely.',
    ],
    relatedDesigns: ['url-shortener', 'key-value-store', 'photo-sharing'],
  },
  {
    slug: 'unique-id-generator',
    title: 'Unique ID Generator',
    difficulty: 'Intermediate',
    icon: 'pi pi-hashtag',
    color: '#6366f1',
    concepts: ['Snowflake Algorithm', 'Clock Synchronization (NTP)', 'Bit-Packed IDs', 'Worker/Datacenter ID Allocation', 'Monotonicity'],
    companies: ['Twitter/X', 'Instagram', 'Discord', 'Sony (Sonyflake)'],
    summary: 'A distributed service that generates globally unique, roughly time-ordered identifiers at high throughput without requiring coordination between generator nodes on every request.',
    tldr: 'Bit-pack a timestamp, worker id, and per-millisecond sequence into a single 64-bit integer (Twitter Snowflake) so IDs are generated locally with zero network calls per request, needing coordination only rarely, at worker-id claim time — not on the hot path.',
    problemFraming: "Generating a unique ID sounds solved by a database auto-increment column until you have more than one database. Twitter hit this directly: a single MySQL auto-increment sequence became a write bottleneck and a single point of failure once tweet volume outgrew one shard, and naively range-partitioning IDs across shards (shard A gets 1-1M, shard B gets 1M-2M) is brittle and nearly impossible to rebalance as shards are added or resized. Switching to random UUIDs solves the coordination problem but creates new ones: UUIDs are twice the storage cost of a 64-bit ID, aren't sortable by creation time, and cause B-tree index fragmentation because random inserts land all over the tree instead of at the end. Instagram and Discord later faced the identical problem as they scaled out horizontally, and both adopted variants of the same idea Twitter open-sourced as Snowflake — the challenge is finding an ID scheme that needs no per-request coordination between nodes, yet still stays compact and roughly time-ordered.",
    priorArt: [
      { title: 'Twitter Snowflake', description: 'The originating algorithm: a 64-bit ID packing a millisecond timestamp, worker id, and sequence number, generated entirely in-process with no coordination per request — the direct basis for this design.' },
      { title: "Instagram's sharded ID generation", description: "Instagram's engineering blog describes a near-identical bit-packed scheme (timestamp/shard-id/sequence) adopted for the same reason: scaling ID generation across many independent PostgreSQL shards without a central bottleneck." },
      { title: "Discord's Snowflake variant", description: "Discord uses its own epoch and the same bit-packing structure for message and object IDs at massive scale, demonstrating the approach's durability well beyond Twitter's original use case." },
      { title: 'Sonyflake', description: "Sony's variant that trades timestamp precision (10ms units instead of 1ms) for more worker-ID bits, illustrating that the classic 41/10/12 bit split is a tunable product decision, not a fixed constant." },
    ],
    coreEntities: [
      { name: 'Worker', description: 'A generator node holding a uniquely-claimed worker ID for its lifetime.' },
      { name: 'SnowflakeID', description: 'The 64-bit packed value — timestamp, worker id, and sequence — returned to callers.' },
      { name: 'WorkerIDLease', description: 'The coordination-service record granting a node exclusive use of a worker-ID slot, with a TTL.' },
      { name: 'SequenceCounter', description: 'The in-memory, per-worker, per-millisecond counter that disambiguates IDs issued in the same tick.' },
    ],
    requirements: {
      core: [
        'Generate a unique ID on every request, with no coordination round-trip required per ID',
        'IDs should be roughly sortable by creation time (useful for pagination and indexing)',
        'Support many independent generator nodes across multiple datacenters/regions issuing IDs concurrently',
        'IDs must fit in a fixed, compact format (typically 64 bits, so they fit in a standard signed long/bigint)',
        'Provide a way to extract the embedded timestamp from an ID for debugging/auditing',
      ],
      belowTheLine: [
        'Dynamic/runtime-tunable bit allocation, trading timestamp bits for worker bits without a hard migration',
        'A pluggable custom epoch per tenant or service',
        'Built-in opaque public-alias generation so internal Snowflake IDs are never exposed directly in URLs',
        'A dashboard showing per-worker issuance rate and sequence-exhaustion risk for capacity planning',
      ],
      nonFunctionalTable: [
        { metric: 'Per-node throughput', target: '>= tens of thousands of IDs/sec, zero external calls' },
        { metric: 'Uniqueness under network partition', target: 'Guaranteed without per-ID consensus, even during partitions between nodes' },
        { metric: 'Clock skew tolerance', target: 'No duplicate IDs on minor backward clock jumps; bounded/graceful handling of drift' },
        { metric: 'ID generation latency', target: '~0 — in-process, in-memory, no I/O on the hot path' },
        { metric: 'Single point of failure', target: 'None on the hot path — worker-ID allocation is the only shared dependency, and it is rare/async' },
      ],
    },
    capacityEstimate: 'A Twitter Snowflake-style 64-bit ID typically allocates 1 sign bit (unused, kept 0 for positive longs), 41 bits for a millisecond timestamp (2^41 ms ≈ 69.7 years of range from a chosen epoch), 10 bits for a machine/worker identifier (2^10 = 1,024 distinct worker nodes), and 12 bits for a per-millisecond sequence number (2^12 = 4,096 unique IDs per worker per millisecond). That yields a theoretical per-node throughput ceiling of 4,096 IDs/ms = 4.096 million IDs/sec per worker, and with 1,024 workers concurrently active, a theoretical system-wide ceiling above 4 billion IDs/sec — far beyond what any realistic write workload (even Twitter-scale, on the order of hundreds of thousands of writes/sec globally) would need. Storage cost per ID is fixed and tiny: 8 bytes, versus a UUID\'s 16 bytes, which matters when IDs are used as primary keys and get duplicated into every index and foreign-key column across a large dataset — at 1 billion rows, that\'s an 8GB difference in raw key size before indexing overhead.',
    architecture: 'Each application or service that needs IDs runs (or calls, via a lightweight local library rather than a remote service) an ID generator that is pre-assigned a unique worker ID at startup — either via static configuration, a coordination service like ZooKeeper/etcd handing out worker IDs from a small pool, or a Kubernetes StatefulSet ordinal. Because the worker ID is fixed for the node\'s lifetime and assigned once (not per-request), generating an ID afterward requires zero network calls: the generator reads the current wall-clock time, packs it with its worker ID and an incrementing per-millisecond sequence counter into a 64-bit integer, and returns it — entirely in-process, in nanoseconds.\n\nThe generator maintains two pieces of local mutable state: the last timestamp it issued an ID for, and the sequence counter within that millisecond. On each request, if the current time matches the last recorded millisecond, the sequence counter increments (wrapping and briefly blocking/spinning until the next millisecond if it overflows 4,096); if time has advanced, the sequence resets to zero and the new timestamp is recorded. This makes IDs roughly monotonic within a single worker and, because the timestamp occupies the highest bits, roughly sortable by creation time across the whole system even though different workers are issuing IDs independently and concurrently.\n\nBecause there\'s no shared mutable state between workers (no central counter, no locking across nodes), the design has no single point of failure and no throughput ceiling imposed by coordination — the only shared dependency is the worker-ID allocation step, which happens rarely (at node startup, not per-request) and can tolerate being slow or occasionally unavailable without affecting steady-state ID issuance. Downstream services simply call the local generator library embedded in their process, or, if centralization is preferred for operational simplicity, a thin ID-generation microservice wraps the same algorithm and is horizontally scaled behind a load balancer, trading a small amount of added network latency for centralized worker-ID management.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[App Server]:::compute
  pg[(PostgreSQL - single auto-increment sequence)]:::database

  client -->|"write request"| api
  api -->|"INSERT ... RETURNING id"| pg`,
      },
      {
        title: 'Core Design: Local Bit-Packed Generation with One-Time Worker-ID Claim',
        mermaid: `flowchart LR
  client[Client]:::client
  app1[App Server 1 + ID Generator]:::compute
  app2[App Server 2 + ID Generator]:::compute
  coord[[etcd / ZooKeeper]]:::compute

  app1 -.->|"claim worker id (startup only)"| coord
  app2 -.->|"claim worker id (startup only)"| coord
  client -->|"write request"| app1
  app1 -->|"64-bit ID: timestamp | workerId | sequence"| client`,
      },
      {
        title: 'Anatomy of a 64-bit Snowflake ID',
        mermaid: `flowchart LR
  sign[1 bit: sign - unused]:::compute
  ts[41 bits: timestamp - ms since epoch]:::compute
  worker[10 bits: worker id - up to 1024 nodes]:::compute
  seq[12 bits: sequence - up to 4096 per ms]:::compute

  sign --> ts --> worker --> seq`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  coord[[etcd Worker-ID Allocator]]:::compute
  svcA[Service A + ID Gen Library]:::compute
  svcB[Service B + ID Gen Library]:::compute
  idsvc[Centralized ID Microservice]:::compute
  lb[Load Balancer]:::edge
  client[Client]:::client
  pg[(Primary Datastore)]:::database

  svcA -.->|"claim worker id at startup"| coord
  svcB -.->|"claim worker id at startup"| coord
  idsvc -.->|"claim worker id at startup"| coord
  client --> lb --> idsvc
  svcA -->|"local generate(), zero network hop"| pg
  svcB -->|"local generate(), zero network hop"| pg
  idsvc -->|"generate() over network - optional centralized mode"| lb`,
      },
    ],
    approaches: [
      {
        name: 'Database Auto-Increment',
        description: 'A single sequence/auto-increment column in one database issues the next ID for every insert.',
        pros: ['Trivially simple', 'Perfectly ordered', 'Exactly-once by construction'],
        cons: ['Single point of contention and failure', 'Does not work across independent shards without a central bottleneck or brittle range partitioning'],
        usedBy: 'Small, single-database applications',
      },
      {
        name: 'Random UUID (v4)',
        description: 'Generate 128 random bits with no coordination or shared state at all.',
        pros: ['Zero coordination between any two generators', 'Collision-safe at any practical scale'],
        cons: ['Twice the storage cost of a 64-bit ID', 'Not sortable by creation time, and causes B-tree index fragmentation from random insert order'],
        usedBy: 'Systems that prioritize implementation simplicity over sortability/compactness',
      },
      {
        name: 'Snowflake-Style Bit-Packed ID',
        description: 'Pack a timestamp, worker id, and per-millisecond sequence into a single 64-bit integer, generated entirely in-process.',
        pros: ['No per-request coordination', 'Compact — 8 bytes', 'Roughly time-sortable', 'Decodable for debugging/auditing'],
        cons: ['Requires explicit clock-skew handling', 'Needs infrequent worker-ID coordination at node startup', 'Leaks approximate creation time/issuance rate if exposed publicly'],
        usedBy: 'Twitter/X, Instagram, Discord, Sony (Sonyflake)',
      },
    ],
    whereThisFits: [
      { layer: 'Node startup (rare coordination)', blocks: 'Claiming a unique worker ID from a bounded pool', key: 'worker-id lease', example: 'etcd atomic claim of slot 42, TTL-renewed' },
      { layer: 'Hot path (per-request)', blocks: 'Generating the ID itself', key: 'timestamp + worker id + sequence', example: 'In-process bit-pack, zero network hop, nanosecond latency' },
      { layer: 'Consumers (downstream services)', blocks: 'Using the ID as a primary key, sort key, or shard key', key: '64-bit ID', example: 'Insert a row with the Snowflake ID as PK; it naturally clusters by creation time' },
      { layer: 'Debugging/audit tooling', blocks: 'Decoding an ID back to timestamp/worker/sequence', key: 'ID value', example: 'GET /v1/ids/{id}/decode during an incident investigation' },
    ],
    deepDive: [
      {
        title: 'Bit allocation is a product decision, not just a technical one',
        body: 'The classic Snowflake split (41 timestamp / 10 worker / 12 sequence) isn\'t arbitrary — every bit traded from one field to another changes a real capacity ceiling. More timestamp bits extend the usable lifespan before epoch rollover; more worker bits allow more concurrently active generator nodes (relevant for very large horizontally-scaled fleets); more sequence bits raise the per-node per-millisecond throughput ceiling. Discord\'s variant, for instance, uses a different epoch and bit layout tuned for its own node count and throughput needs, and Sonyflake trades some timestamp precision (10ms units instead of 1ms) for more worker-ID bits, since its use case had many more nodes but lower per-node throughput requirements. Interviewers often want to see this reasoning explicitly, not just the numbers memorized.',
      },
      {
        title: 'Clock skew and the risk of duplicate or out-of-order IDs',
        body: 'The entire uniqueness guarantee within a worker depends on the local clock only moving forward. If NTP corrects the clock backward (which does happen, especially after a VM migration or leap-second smear), the generator could produce a timestamp equal to or earlier than one it already issued, risking a duplicate ID if the sequence counter also happens to collide. Production Snowflake implementations detect this explicitly: if the current time is less than the last recorded timestamp, the generator either blocks and waits until the clock catches up, throws an error and refuses to issue IDs until it does, or — in more defensive designs — maintains a small buffer/offset to absorb minor backward jumps. This is the single most-cited real-world failure mode of Snowflake-style generators and is worth naming explicitly in an interview.',
        diagram: `flowchart TD
  check{"current time < last issued timestamp?"}:::compute
  wait[Block briefly until clock catches up]:::compute
  reject[Reject: throw clock-skew error]:::compute
  proceed[Proceed: increment sequence or reset for new ms]:::compute

  check -->|"yes, minor backward jump"| wait
  check -->|"yes, severe/sustained skew"| reject
  check -->|"no"| proceed`,
      },
      {
        title: 'Worker ID assignment and the coordination it can\'t fully avoid',
        body: 'The design\'s core promise — no coordination per ID — has one asterisk: worker IDs themselves must be unique across the fleet, which does require *some* coordination, just infrequent coordination. Static config (manually assigning worker IDs) works at small scale but doesn\'t survive dynamic autoscaling. A common production pattern uses a coordination service (ZooKeeper, etcd, or even a database row with an atomic claim) that a node queries once at startup to claim an unused worker ID slot from the fixed pool (e.g. 0-1023), releasing it on graceful shutdown; if a node crashes without releasing, a lease/TTL mechanism reclaims the slot after a timeout. This bounds the "coordination tax" to node startup/shutdown events rather than the request hot path, which is the key insight that makes the whole approach scale.',
      },
      {
        title: 'Snowflake vs. UUID vs. database auto-increment',
        body: 'A database auto-increment column is simplest and perfectly ordered but doesn\'t work across multiple independent database shards/instances without either a single bottlenecked sequence generator or awkward range-partitioning tricks (assign shard A the range 1-1M, shard B 1M-2M, etc., which is brittle and hard to rebalance). UUIDv4 needs zero coordination and zero shared state at all, but at 128 bits it\'s twice the storage cost of a Snowflake ID, is not sortable by creation time (making time-range queries and index locality poor — random UUIDs cause B-tree index fragmentation because inserts land all over the tree rather than at the end), and offers no debuggable timestamp. Snowflake-style IDs sit deliberately in between: compact, sortable, no per-request coordination, at the cost of the added implementation complexity of clock and worker-ID management that neither alternative requires.',
      },
    ],
    tradeoffs: [
      {
        title: 'Monotonicity vs. simplicity of a stateless design',
        body: 'Maintaining the "last timestamp + sequence" state per worker is what gives IDs their sortability and per-node uniqueness guarantee, but it means the generator is stateful (even if only in-memory) and must handle edge cases like clock rollback and sequence overflow correctly, or risk producing duplicates. A fully stateless alternative (e.g. hashing random bytes with a timestamp, no sequence tracking) avoids that state-management complexity entirely but sacrifices strict per-millisecond ordering guarantees and slightly increases collision risk at extremely high throughput, since it relies on randomness rather than a guaranteed-unique counter.',
      },
      {
        title: 'Global time-ordering vs. sharded/regional issuance',
        body: 'Because different workers issue IDs concurrently and independently, IDs are only "roughly" time-ordered globally — two IDs generated in the same millisecond by different workers have no defined relative order even though both encode the same timestamp, and clock skew between machines/datacenters can make a "later" event get an ID that sorts earlier. Systems that need strict global ordering (not just approximate chronological grouping) must layer an additional mechanism (a logical clock, or accepting the write to a single ordered log) on top — the Snowflake approach explicitly trades perfect global ordering for the ability to generate IDs with zero coordination, which is the right trade for the vast majority of use cases (primary keys, cursors, sharding keys) that only need rough chronological locality.',
      },
      {
        title: 'Embedding metadata in the ID vs. keeping IDs opaque',
        body: 'Packing timestamp and worker-ID into the ID itself is enormously useful for debugging (you can decode any ID and know roughly when and where it was created) and for using the ID directly as a natural sort/partition key, but it also leaks information — worker count, issuance rate, and approximate creation time become derivable by anyone who can see IDs, which matters if IDs are exposed in public URLs (e.g. an object ID revealing exactly when it was created can leak business-sensitive information like signup timing or content freshness). Systems with that concern either keep IDs opaque (add a UUID as a public-facing alias while using Snowflake IDs internally) or accept the leakage as a minor and usually acceptable cost.',
      },
    ],
    failureMode: {
      title: "What Happens When a Node's Clock Jumps Backward?",
      body: 'The entire per-worker uniqueness guarantee depends on the local clock only moving forward, so an NTP correction (or VM migration) that moves time backward risks issuing a timestamp equal to or earlier than one already issued. Production generators detect this explicitly by comparing the current time to the last issued timestamp: a minor backward jump causes the generator to briefly block until the clock catches up, while a severe or sustained skew causes it to reject requests and refuse to issue IDs rather than risk a silent duplicate. The worker-ID coordination service (etcd/ZooKeeper) is a much lower-stakes dependency by comparison — it is only consulted rarely, at node startup, so its downtime blocks new nodes from joining but has no effect on already-running workers, which keep issuing IDs from purely local state. This asymmetry — a hard, immediate failure mode from clock skew versus a soft, deferred one from coordination-service unavailability — is exactly why clock handling gets the most attention in production Snowflake implementations.',
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/ids',
        description: "Generate a single new ID (centralized microservice mode, for clients that don't embed the generator library).",
        example: '// Response 200\n{ "id": "1859239481230123008", "timestampMs": 1752670800000, "workerId": 42, "sequence": 7 }',
      },
      {
        method: 'POST',
        path: '/v1/ids/batch?count=100',
        description: 'Generate a batch of IDs in one call, amortizing network overhead for high-throughput clients using centralized mode.',
        example: '// Response 200\n{ "ids": ["1859239481230123008", "1859239481230123009"] }',
      },
      {
        method: 'GET',
        path: '/v1/ids/{id}/decode',
        description: 'Decode an ID back into its embedded timestamp, worker id, and sequence number for debugging/auditing.',
        example: '// Response 200\n{ "id": "1859239481230123008", "timestampMs": 1752670800000, "createdAt": "2026-07-16T12:00:00.000Z", "workerId": 42, "sequence": 7 }',
      },
      {
        method: 'POST',
        path: '/v1/worker-ids/claim',
        description: 'Called once by a node at startup to atomically claim an unused worker-ID slot from the fixed pool (internal, not client-facing).',
        example: '// Response 200\n{ "workerId": 42, "leaseExpiresAt": "2026-07-16T12:10:00Z" }',
      },
    ],
    keyTechnologies: [
      { term: 'Snowflake Algorithm', definition: 'A scheme for packing a timestamp, worker id, and sequence counter into a single 64-bit integer, originated at Twitter, generating unique roughly-ordered IDs without per-request coordination.' },
      { term: 'Epoch', definition: 'A custom reference point (rather than the Unix epoch) chosen so the 41-bit timestamp field has maximum useful range before rollover.' },
      { term: 'NTP (Network Time Protocol)', definition: 'The protocol used to keep server clocks synchronized; corrections can occasionally move a clock backward, which Snowflake generators must detect and handle.' },
      { term: 'Bit-Packing', definition: 'Encoding multiple small integer fields (timestamp, worker id, sequence) into contiguous bit ranges of a single fixed-width integer.' },
      { term: 'Worker ID Allocation', definition: 'The (infrequent) coordination step where a node claims a unique numeric identity from a bounded pool via a service like etcd or ZooKeeper.' },
      { term: 'Monotonic Sequence Counter', definition: 'A per-millisecond, per-worker counter that increments for each ID issued within the same timestamp, resetting when the millisecond advances.' },
    ],
    selfAudit: [
      {
        question: "What happens if two datacenters' clocks drift relative to each other?",
        answer: "IDs remain unique (uniqueness depends only on each worker's own clock moving forward, not cross-datacenter agreement), but global time-ordering becomes only approximate — an event that happened later in wall-clock time could get an ID that sorts earlier if its datacenter's clock lags, which the design explicitly accepts in exchange for zero-coordination issuance.",
      },
      {
        question: 'What happens when the 1,024-worker-ID pool is exhausted by autoscaling?',
        answer: 'Either the bit allocation is redesigned to trade sequence or timestamp bits for more worker bits (a breaking change requiring a migration), or nodes are grouped so multiple processes share a worker ID by partitioning the sequence space between them — both are why worker/sequence bit widths should be sized generously up front.',
      },
      {
        question: 'What happens if a single worker tries to issue more than 4,096 IDs in one millisecond?',
        answer: 'The sequence counter overflows; the generator briefly blocks/spins until the clock advances to the next millisecond rather than reusing a sequence value, trading a microsecond-scale stall for a hard uniqueness guarantee.',
      },
      {
        question: "A node crashes without releasing its worker ID — does that break the system?",
        answer: 'No — the coordination service issues worker-ID claims with a lease/TTL, so an unreleased slot is automatically reclaimed after the lease expires and can be reassigned to a new node, bounding the impact to a temporary reduction in the available worker pool.',
      },
      {
        question: 'Is it safe to expose Snowflake IDs directly in public-facing URLs?',
        answer: 'It leaks the approximate creation time and relative issuance rate (worker id, sequence) of a resource, which can matter for business-sensitive timing information; systems concerned about this expose an opaque UUID alias publicly while using the Snowflake ID internally for storage/sharding.',
      },
    ],
    cheatSheet: [
      { question: 'Which approach?', answer: 'A Snowflake-style bit-packed 64-bit ID — compact, sortable, and needs no per-request coordination.' },
      { question: 'Where does state live?', answer: 'In-memory on each worker: the last-issued timestamp plus the current sequence counter.' },
      { question: 'How to make it atomic?', answer: 'No cross-node atomicity is needed; each worker only guards its own local state.' },
      { question: 'What if the coordination service (etcd) is down?', answer: 'Already-running workers keep issuing IDs fine; only new worker startup is blocked.' },
      { question: 'How is it layered?', answer: 'A rare worker-ID claim at startup, then pure in-process generation on the hot path.' },
      { question: 'How does it scale across datacenters?', answer: "Each worker's clock only needs to move forward locally; global ordering across workers is approximate, not exact." },
      { question: 'What is the headline clock-skew failure mode?', answer: 'Detecting a backward time jump and blocking/rejecting rather than risking a duplicate ID.' },
    ],
    expectedDepth: {
      mid: 'Explain the bit-packing idea at a high level, understand why an in-memory or single-DB auto-increment fails once you have more than one shard, and know UUIDs as an alternative along with their storage/sortability tradeoffs.',
      senior: 'Reason about bit allocation (timestamp/worker/sequence) as a tunable product decision, explain why worker-ID coordination only happens at startup rather than per request, and describe how the generator detects and handles clock skew.',
      staffPlus: 'Discuss cross-datacenter clock skew and its effect on global ordering guarantees, worker-ID pool exhaustion under aggressive autoscaling and how to migrate the bit layout, information leakage from exposing IDs publicly, and how this design compares to alternatives like hybrid logical clocks or a centralized ID service for workloads that need stricter ordering.',
    },
    keyTakeaways: [
      'Bit-packing timestamp + worker id + sequence gives unique, roughly-ordered IDs with zero per-request coordination.',
      'Worker-ID allocation is the only coordination point, and it happens rarely, at startup, not per ID.',
      'Clock skew — a backward time jump — is the single most-cited real failure mode; detect and handle it explicitly.',
      'The 41/10/12 bit split is tunable — it is a capacity and product decision, not a fixed constant.',
    ],
    relatedDesigns: ['url-shortener', 'chat-system', 'key-value-store'],
  },
  {
    slug: 'key-value-store',
    title: 'Key-Value Store (Redis / DynamoDB)',
    difficulty: 'Advanced',
    icon: 'pi pi-database',
    color: '#8b5cf6',
    concepts: ['Consistent Hashing', 'Vector Clocks / Version Vectors', 'Quorum Reads/Writes (R+W>N)', 'Merkle Trees', 'LSM-Tree Storage Engine'],
    companies: ['Amazon (DynamoDB)', 'Redis Labs', 'LinkedIn (Voldemort)', 'Discord (ScyllaDB)'],
    summary: 'A horizontally scalable, fault-tolerant distributed store providing simple get/put/delete operations on arbitrary keys, trading relational query power for extreme availability and low, predictable latency.',
    tldr: 'Partition keys with consistent hashing (virtual nodes) across a leaderless, gossip-coordinated cluster, and make consistency a per-operation knob via quorum reads/writes (R + W > N) with vector clocks to reconcile concurrent writes when they disagree — trading strict consistency for availability during partitions (AP over CP).',
    problemFraming: "Amazon built the system this design is modeled on, Dynamo, after discovering that a traditional single-master, strongly-consistent database made their shopping cart service unavailable during exactly the moments — flash sales, holiday traffic spikes — when it mattered most that a customer could still add an item to their cart. A naive key-value layer built on modulo-based sharding (hash(key) % node count) falls apart the moment the cluster is resized: adding or removing one node remaps nearly every key to a different owner, forcing a near-total data reshuffle under live traffic. And once you accept that any replica should be able to serve a write for availability's sake, you inherit a genuinely hard problem: two clients can concurrently update the same key on different replicas with no single serialization point to say which happened first, so the system has to detect and reconcile real conflicts rather than assume a master will sort it out. The challenge is building a store that keeps working, with low predictable latency, even while nodes fail or a network partition splits the cluster in two.",
    priorArt: [
      { title: "Amazon's Dynamo paper (2007)", description: 'The foundational paper describing consistent hashing for partitioning, quorum-based (R/W/N) reads and writes, vector clocks for conflict detection, and gossip-based membership — nearly every mechanism in this design traces back to it.' },
      { title: 'Consistent hashing (Karger et al., 1997, originally for Akamai)', description: 'The hash-ring partitioning scheme that lets nodes join or leave with only their adjacent arc of keys moving, avoiding the near-total reshuffle that naive modulo sharding causes.' },
      { title: 'Merkle trees (Ralph Merkle)', description: "A hash-tree structure that lets two replicas compare just their root hashes and recurse only into differing subtrees, which is what makes anti-entropy repair between replicas O(log N) instead of a full data scan." },
      { title: 'Apache Cassandra', description: "A production system directly descended from Dynamo's design (leaderless replication, consistent hashing with virtual nodes, tunable consistency, LSM-tree storage engine) that validates this architecture at large real-world scale." },
    ],
    coreEntities: [
      { name: 'Node', description: 'A physical/logical server owning a set of virtual nodes, i.e. arcs of the consistent-hash ring.' },
      { name: 'Key/Value Entry', description: 'The stored unit, versioned with a vector clock and replicated across N nodes.' },
      { name: 'Preference List', description: 'The ordered list of N replica nodes responsible for a given key.' },
      { name: 'VectorClock', description: 'A causality-tracking version tag that distinguishes causally-ordered updates from true concurrent conflicts.' },
      { name: 'Coordinator', description: 'The node or client that fans a request out to replicas and aggregates quorum responses.' },
    ],
    requirements: {
      core: [
        'Support basic put(key, value), get(key), and delete(key) operations with low, predictable latency',
        'Support versioned writes so concurrent updates to the same key can be detected and reconciled',
        'Replicate every key across multiple nodes for fault tolerance and read scalability',
        'Allow the cluster to grow or shrink (add/remove nodes) with minimal data movement and no downtime',
        'Support tunable consistency per operation (e.g. choose stronger consistency for critical reads, weaker for high-throughput ones)',
      ],
      belowTheLine: [
        'Secondary indexes or range queries beyond simple key lookup',
        'Multi-datacenter active-active replication with configurable conflict-resolution policies per keyspace',
        'First-class TTL-based automatic key expiration',
        'A change-data-capture stream so downstream consumers can subscribe to key mutations',
      ],
      nonFunctionalTable: [
        { metric: 'Availability during network partition', target: 'Continues serving reads/writes on both sides of a partition (AP over CP)' },
        { metric: 'p99 get/put latency', target: 'Single-digit milliseconds, even at hundreds of nodes' },
        { metric: 'Scalability', target: 'Roughly linear scale-out by adding commodity nodes' },
        { metric: 'Single point of failure', target: 'None anywhere, including the metadata/coordination layer (gossip-based, no central master)' },
        { metric: 'Failure recovery', target: 'Automatic re-replication of under-replicated data after node/disk failure, no manual intervention' },
      ],
    },
    capacityEstimate: 'Consider a cluster storing 500M keys with an average value size of 1KB, giving roughly 500GB of raw data before replication. With a replication factor of 3 (standard for surviving up to 2 simultaneous node/rack failures), total stored data is 1.5TB, distributed across, say, 30 nodes of ~64GB usable disk-relevant capacity each after accounting for compaction overhead in an LSM-tree engine — comfortably fits with room to grow. At 50,000 reads/sec and 10,000 writes/sec average (a common 5:1 read-heavy skew for KV workloads), and each node handling its fair share of ~replication-factor/node-count of that traffic, a 30-node cluster sees roughly 1,700-5,000 ops/sec per node — well within what commodity hardware handles for point lookups with proper indexing (LSM memtable + bloom filters keep most reads to one or two disk seeks). Network overhead for replication (each write fanning out to 2 replica nodes) roughly triples internal cluster write traffic: 10,000 writes/sec * 1KB * 2 extra replicas ≈ 20MB/s of inter-node replication bandwidth, trivial for a modern datacenter network.',
    architecture: 'A distributed KV store partitions its keyspace across many nodes using consistent hashing: each key is hashed onto a logical ring, and each node owns a contiguous arc of that ring (often subdivided into virtual nodes per physical node to smooth load distribution and make rebalancing finer-grained). A client (or a routing layer/coordinator node) hashes the requested key, walks the ring to find the N nodes responsible for it (the "preference list"), and sends the request to those replicas directly or via a coordinator that fans the request out on the client\'s behalf — this is the core mechanism that lets the cluster scale by simply adding nodes, each of which takes over a slice of the ring from its neighbors, moving only the data in that slice rather than reshuffling the whole dataset.\n\nWrites are sent to all N replicas for a key, but the client only waits for W acknowledgments before considering the write successful (a "quorum write"); reads similarly query R replicas and, if their versions disagree, reconcile them using vector clocks or version vectors to determine causal ordering (or surface the conflict to the application layer if the divergence is genuinely concurrent rather than causally ordered). Choosing R + W > N gives strong-ish (quorum) consistency guarantees, while R + W ≤ N favors availability and latency at the cost of potentially reading stale data — this R/W/N knob is exactly the tunable consistency the system exposes per operation.\n\nEach node\'s local storage is typically an LSM-tree-based engine (like RocksDB or a custom SSTable implementation): writes go to an in-memory memtable and a write-ahead log for durability, then get flushed to disk as sorted, immutable SSTables, which are periodically compacted in the background to reclaim space from overwritten/deleted keys and keep read amplification bounded. Cluster membership, ring ownership, and failure detection are handled by a gossip protocol between nodes (each node periodically exchanges state with a few random peers) rather than a centralized coordinator, so there\'s no single component whose failure takes down cluster coordination — this is the key architectural difference from a master-based system like a traditional sharded relational database.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[App Server]:::compute
  db[(Single DB Node)]:::database

  client --> api
  api -->|"GET/PUT key"| db`,
      },
      {
        title: 'Core Design: Consistent Hash Ring with Quorum Reads/Writes',
        mermaid: `flowchart LR
  client[Client]:::client
  coord[Coordinator Node]:::compute
  n1[("Node A")]:::database
  n2[("Node B")]:::database
  n3[("Node C")]:::database

  client -->|"PUT key, N=3, W=2"| coord
  coord --> n1
  coord --> n2
  coord --> n3
  n1 -.->|"ack"| coord
  n2 -.->|"ack"| coord
  coord -.->|"success once W acks received"| client`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Smart Client]:::client
  ring{{Consistent Hash Ring}}:::compute
  n1[("Node A - LSM Engine")]:::database
  n2[("Node B - LSM Engine")]:::database
  n3[("Node C - LSM Engine")]:::database
  gossip{{Gossip: membership + failure detection}}:::compute

  client -->|"hash(key) -> preference list"| ring
  ring --> n1
  ring --> n2
  ring --> n3
  n1 <-.->|"gossip"| gossip
  n2 <-.->|"gossip"| gossip
  n3 <-.->|"gossip"| gossip
  n1 -->|"anti-entropy repair (Merkle tree diff)"| n2`,
      },
      {
        title: 'Core Flow: Quorum Write with Hinted Handoff (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant Co as Coordinator
  participant A as Replica A
  participant B as Replica B
  participant D as Replica C

  C->>Co: PUT key=v1 (N=3, W=2)
  Co->>A: write(key, v1, vectorClock)
  Co->>B: write(key, v1, vectorClock)
  Co->>D: write(key, v1, vectorClock)
  A-->>Co: ack
  B-->>Co: ack
  Co-->>C: success (W=2 satisfied)
  Note over D: D was slow/unreachable - a peer holds a hint and replays it on recovery`,
      },
    ],
    approaches: [
      {
        name: 'Single-Master Relational Database',
        description: 'One primary node accepts all writes, with reads optionally served from replicas.',
        pros: ['Strong consistency by default', 'Simple mental model', 'Mature tooling'],
        cons: ['Write throughput and availability are capped by one node', 'A hard failover event on primary loss', 'Does not scale writes horizontally'],
        usedBy: 'Traditional RDBMS-backed applications',
      },
      {
        name: 'Leaderless, Quorum-Based Replication (Dynamo-Style)',
        description: 'Any replica accepts writes; consistency is a tunable per-operation knob via R/W/N quorums, with vector clocks reconciling conflicts.',
        pros: ['No single point of failure', 'Writes are accepted on both sides of a network partition (AP)', 'Roughly linear horizontal scale-out'],
        cons: ['Concurrent writes can produce real conflicts requiring explicit reconciliation', 'Tunable consistency pushes a genuinely hard decision onto every call site'],
        usedBy: 'Amazon DynamoDB, Apache Cassandra, Riak',
      },
      {
        name: 'Consensus-Based Replication (Raft/Paxos)',
        description: 'An elected leader per shard replicates writes to followers with a majority-acknowledgment protocol, refusing writes on the minority side of a partition.',
        pros: ['Every acknowledged write is immediately, strongly consistent everywhere', 'Simpler application-level reasoning — no siblings to merge'],
        cons: ['Unavailable for writes on the minority side of a partition', 'Leader election adds failover latency'],
        usedBy: 'etcd, CockroachDB, Google Spanner (with TrueTime)',
      },
    ],
    whereThisFits: [
      { layer: 'Client / Coordinator', blocks: 'Hashing the key and locating its preference list', key: 'hash(key) -> ring position', example: 'A smart client library resolves N=3 replica nodes before sending the request' },
      { layer: 'Replica nodes', blocks: 'Accepting writes/reads and providing local durability', key: 'key -> versioned value', example: 'A quorum write acked by 2 of 3 replicas (W=2)' },
      { layer: 'Local storage engine', blocks: 'Turning writes into fast sequential I/O', key: 'key -> SSTable location', example: 'LSM-tree memtable + WAL, compacted into SSTables on disk' },
      { layer: 'Background repair (gossip / anti-entropy)', blocks: 'Detecting and healing replica drift without blocking the hot path', key: 'Merkle-tree root hash per range', example: 'An anti-entropy job diffs two replicas in O(log N) comparisons' },
    ],
    deepDive: [
      {
        title: 'Consistent hashing and virtual nodes',
        body: 'Naive modulo-based sharding (key hash % node count) breaks catastrophically when a node is added or removed, since nearly every key remaps to a different node, forcing a near-total data reshuffle. Consistent hashing fixes this by mapping both keys and nodes onto a fixed hash ring; adding or removing a node only affects the keys in the adjacent arc, not the whole ring. Plain consistent hashing still risks uneven load if physical nodes are few and unlucky in their ring placement, so production systems (DynamoDB, Cassandra) assign each physical node many "virtual nodes" scattered around the ring — this smooths load distribution statistically and, critically, makes rebalancing after a node join/leave spread evenly across many other nodes rather than dumping the entire burden on one or two neighbors.',
        diagram: `flowchart LR
  ring{{Hash Ring}}:::compute
  vn1[VNode A1]:::database
  vn2[VNode A2]:::database
  vn3[VNode B1]:::database
  vn4[VNode B2]:::database
  vn5[VNode C1]:::database

  ring --> vn1
  ring --> vn2
  ring --> vn3
  ring --> vn4
  ring --> vn5`,
      },
      {
        title: 'Vector clocks and reconciling concurrent writes',
        body: 'In a system that accepts writes on any replica for availability, two clients can concurrently update the same key on different replicas before either write propagates — there\'s no single serialization point to say which happened "first." A vector clock attaches, per key version, a map of {node: counter} that tracks which nodes have seen which update, letting the system detect whether one version causally descends from another (safe to auto-resolve, keep the newer) or whether two versions are truly concurrent (siblings, requiring either a last-writer-wins policy based on timestamp, or surfacing both versions to the application for domain-specific merge logic, like a shopping cart union). This is fundamentally different from a single-master system where the master simply serializes all writes and no such ambiguity can arise — the cost of write-availability-everywhere is that conflict detection and resolution becomes an explicit, visible part of the design.',
      },
      {
        title: 'Anti-entropy and Merkle trees for replica repair',
        body: 'Replicas can silently drift out of sync — a node was down during a write, or a message was dropped — and comparing entire key ranges byte-by-byte between replicas to detect drift would be prohibitively expensive at scale. Merkle trees solve this efficiently: each replica builds a tree of hashes where leaf nodes hash small key ranges and each parent hashes its children, so two replicas can compare just their root hashes first, and only recurse into subtrees where hashes differ, narrowing down to the specific divergent keys in O(log N) comparisons rather than O(N). This "anti-entropy" background process runs continuously and independently of the read/write hot path, gradually repairing drift without requiring synchronous coordination on every operation.',
      },
      {
        title: 'Read repair and hinted handoff for masking failures',
        body: 'Two complementary mechanisms paper over transient failures without blocking client-visible latency: read repair triggers when a quorum read discovers that some replicas returned a stale version, and the coordinator opportunistically pushes the newer version to the stale replicas in the background after already returning the correct value to the client — fixing drift as a side effect of normal reads. Hinted handoff addresses the case where a replica is temporarily down during a write: another node briefly holds the write on the failed node\'s behalf ("here\'s a hint for you") and replays it once the original node recovers, so the write still succeeds and the temporarily-down node catches up automatically rather than requiring a full anti-entropy repair for what was just a short blip.',
      },
    ],
    tradeoffs: [
      {
        title: 'Availability vs. consistency during partitions (the CAP trade)',
        body: 'A system like DynamoDB or Cassandra explicitly chooses availability and partition tolerance over strict consistency (AP over CP): during a network partition, both sides of the split keep accepting reads and writes rather than one side refusing service to preserve a single consistent view, which means clients can observe stale or conflicting data until the partition heals and reconciliation runs. A CP system (like a traditional consensus-based store, e.g. one built on Raft/Paxos) instead refuses writes on the minority side of a partition to guarantee every acknowledged write is immediately consistent everywhere, at the direct cost of unavailability during that partition. Neither choice is universally correct — it depends on whether the application can tolerate stale reads (a social media feed can; a bank ledger generally cannot) more than it can tolerate downtime.',
      },
      {
        title: 'Tunable per-request consistency vs. cognitive complexity',
        body: 'Exposing R and W as per-operation knobs is powerful — a critical read can request R=N (all replicas, strongest consistency, highest latency) while a high-throughput analytics read can use R=1 (fastest, weakest guarantee) — but it pushes a genuinely hard distributed-systems decision onto every call site in application code, and misuse (an engineer picks R=1,W=1 for something that actually needed strong consistency) causes subtle, hard-to-debug correctness bugs rather than a clean failure. Systems that instead offer a small number of named consistency levels (e.g. "eventual," "strong," "read-your-writes") trade some flexibility for making the safe choice more obvious and the dangerous choice harder to reach for by accident.',
      },
      {
        title: 'LSM-tree write optimization vs. read/space amplification',
        body: 'LSM-tree storage engines turn random writes into fast sequential appends (memtable + WAL), which is why they dominate write-heavy KV workloads compared to B-tree engines that do in-place random-access updates. The cost shows up later: a read for a given key may need to check the memtable and multiple SSTable levels before finding the most recent version (read amplification), and background compaction to merge and garbage-collect overwritten SSTables consumes disk I/O and temporarily doubles space usage for the tables being merged (space and write amplification). Systems tune compaction strategy (size-tiered vs. leveled) to bias toward write throughput or read latency depending on the dominant workload, since optimizing fully for one makes the other measurably worse.',
      },
    ],
    failureMode: {
      title: 'What Happens When a Node or an Entire Rack Fails?',
      body: 'Because the design is leaderless, there is no failover event to wait for: the other nodes already in a failed node\'s preference list keep serving reads and writes for its key ranges immediately, with no coordination pause. Writes destined for the failed node during the outage are held by a peer via hinted handoff and replayed automatically once the node recovers, so no acknowledged write is lost. If the node is permanently lost rather than just briefly unreachable, anti-entropy comparison (Merkle trees) against surviving replicas plus re-replication onto a new node restores the full replication factor without any manual intervention. The visible cost during this window is narrower, not zero — the cluster may briefly be unable to satisfy the strictest quorum (e.g. W=3 on a 3-replica key), but it degrades to a slightly weaker quorum (W=2) rather than any outage.',
    },
    apiInterface: [
      {
        method: 'PUT',
        path: '/v1/keys/{key}?w=2',
        description: 'Write a value with a tunable write quorum W (number of replica acks required before success is returned).',
        example: '// Request\n{ "value": { "cartItems": ["sku_1", "sku_9"] }, "w": 2 }\n\n// Response 200\n{ "key": "cart:user_772", "vectorClock": { "nodeA": 4, "nodeB": 2 } }',
      },
      {
        method: 'GET',
        path: '/v1/keys/{key}?r=2',
        description: 'Read a value with a tunable read quorum R. Returns sibling versions if concurrent writes are unresolved.',
        example: '// Response 200\n{ "key": "cart:user_772", "value": { "cartItems": ["sku_1", "sku_9"] }, "vectorClock": { "nodeA": 4, "nodeB": 2 } }',
      },
      {
        method: 'DELETE',
        path: '/v1/keys/{key}',
        description: 'Delete a key. Implemented as a tombstone write replicated like any other value, garbage-collected after a grace period.',
        example: '// Response 202 Accepted\n{ "key": "cart:user_772", "tombstoneAt": "2026-07-16T12:00:00Z" }',
      },
      {
        method: 'GET',
        path: '/v1/keys/{key}/versions',
        description: 'List all unresolved sibling versions of a key for application-level conflict resolution when writes were truly concurrent.',
        example: '// Response 200\n{ "siblings": [ { "value": {}, "vectorClock": {"nodeA": 4} }, { "value": {}, "vectorClock": {"nodeB": 2} } ] }',
      },
      {
        method: 'GET',
        path: '/v1/cluster/status',
        description: 'Admin endpoint returning ring membership, per-node health, and any under-replicated key ranges currently being repaired.',
        example: '// Response 200\n{ "nodes": [ { "id": "nodeA", "status": "up", "vnodes": 256 } ], "underReplicatedRanges": 0 }',
      },
    ],
    keyTechnologies: [
      { term: 'Consistent Hashing', definition: 'Maps both keys and nodes onto a fixed hash ring so that adding/removing a node only reshuffles an adjacent arc of keys, not the whole keyspace.' },
      { term: 'Vector Clock', definition: 'A per-key {node: counter} map used to detect causal ordering between versions and identify truly concurrent (sibling) writes that need reconciliation.' },
      { term: 'Quorum (R+W>N)', definition: 'A tunable consistency scheme where a write succeeds after W replica acks and a read queries R replicas; R+W>N yields strong-ish consistency, R+W<=N favors availability/latency.' },
      { term: 'Merkle Tree', definition: 'A tree of hashes enabling two replicas to find divergent keys in O(log N) comparisons instead of comparing every key, powering efficient anti-entropy repair.' },
      { term: 'Gossip Protocol', definition: 'A decentralized peer-to-peer exchange of cluster state (membership, health) between random node pairs, avoiding any single coordinator for failure detection.' },
      { term: 'LSM-Tree Storage Engine', definition: 'A write-optimized local storage engine (memtable + WAL, flushed to sorted SSTables, periodically compacted) that turns random writes into sequential appends.' },
    ],
    selfAudit: [
      {
        question: 'Two clients concurrently write different values to the same key — what does a subsequent read return?',
        answer: 'If the vector clocks show one write causally descends from the other, the system auto-resolves to the newer one; if they are truly concurrent siblings, the read returns both versions (or a last-writer-wins timestamp resolution) and the application decides how to merge them.',
      },
      {
        question: 'What happens to in-flight requests while a new node is joining and virtual nodes are being reassigned?',
        answer: 'Consistent hashing with virtual nodes means the join only affects keys in the arcs being handed off; those specific keys briefly route to both old and new owners during handoff, while the vast majority of the keyspace is entirely unaffected and continues serving normally.',
      },
      {
        question: 'What is the practical effect of choosing R=1, W=1 versus R=3, W=3 on a 3-replica key?',
        answer: 'R=1,W=1 gives the lowest latency and highest availability but the weakest consistency (a read might miss the latest write from another replica); R=3,W=3 requires all replicas to be reachable for every operation, giving strong consistency but zero tolerance for a single replica being slow or down — most systems pick something in between, like R=2,W=2 on N=3.',
      },
      {
        question: 'A disk fails on one node — how does the cluster recover without manual intervention?',
        answer: "Gossip-based failure detection marks the node down, its replicas on other nodes continue serving reads/writes for its key ranges, hinted handoff queues writes meant for it, and once it's replaced/restarted, anti-entropy (Merkle tree comparison) re-syncs it to full replication automatically.",
      },
      {
        question: 'Why not just use a single-master relational database with read replicas instead of this whole design?',
        answer: 'A single master caps write throughput and availability to one node/region and creates a hard failover event on master loss; the leaderless, quorum-based design trades that simplicity for writes accepted on any replica anywhere, at the cost of needing explicit conflict detection/resolution that a single-master system never has to deal with.',
      },
    ],
    cheatSheet: [
      { question: 'Which approach?', answer: 'Leaderless, quorum-based replication (Dynamo-style) — availability over strict consistency, tunable per operation.' },
      { question: 'Where does state live?', answer: 'Sharded across nodes via consistent hashing with virtual nodes; each key replicated to N nodes.' },
      { question: 'How to make writes consistent-ish?', answer: 'Quorum: R + W > N gives strong-ish consistency, R + W <= N favors availability and latency.' },
      { question: 'What happens on node failure?', answer: 'Other replicas keep serving immediately; hinted handoff queues writes; anti-entropy re-syncs on recovery.' },
      { question: 'How is it structured?', answer: 'Hash ring with virtual nodes, then replica nodes, then LSM-tree local storage, coordinated via gossip.' },
      { question: 'How does it handle concurrent writes?', answer: 'Vector clocks detect causal order vs. true conflicts; genuinely concurrent siblings are surfaced to the app.' },
      { question: 'Why LSM-tree over B-tree locally?', answer: 'It turns random writes into sequential appends, trading some read/space amplification for write throughput.' },
    ],
    expectedDepth: {
      mid: 'Explain the basic get/put/replication concept, recognize that a single master caps write scale, and understand simple hash-based sharding across nodes.',
      senior: 'Explain consistent hashing with virtual nodes, quorum reads/writes (R/W/N), vector clocks vs. last-writer-wins, and the write-vs-read tradeoffs of an LSM-tree engine compared to a B-tree.',
      staffPlus: 'Reason about AP vs. CP as a genuine product and domain decision, design anti-entropy and hinted-handoff mechanics for automatic failure recovery, discuss the operational risk of exposing tunable consistency as a per-call-site knob, and compare leaderless systems against consensus-based alternatives (Raft/Spanner) for workloads that need strict consistency.',
    },
    keyTakeaways: [
      'Consistent hashing with virtual nodes avoids the near-total reshuffle that modulo sharding causes on resize.',
      'Quorum (R + W > N) makes consistency a tunable per-operation knob rather than one fixed global guarantee.',
      'Vector clocks let the system detect true write conflicts instead of assuming a single master will serialize everything.',
      'Leaderless replication trades write-availability-everywhere for the burden of explicit conflict reconciliation.',
    ],
    relatedDesigns: ['url-shortener', 'pastebin', 'unique-id-generator'],
  },
{
    slug: 'url-shortener',
    title: 'URL Shortener (Bitly / TinyURL)',
    difficulty: 'Beginner',
    icon: 'pi pi-link',
    color: '#3b82f6',
    concepts: ['Base62 encoding', 'Key-value storage', 'Cache-aside pattern', 'Consistent hashing', 'Rate limiting'],
    companies: ['Bitly', 'TinyURL', 'Google', 'Amazon'],
    summary: 'A service that maps long URLs to short, shareable aliases and redirects users at scale, testing your grasp of ID generation and read-heavy caching.',
    tldr: 'The whole design collapses into one tradeoff: since redirects outnumber writes roughly 100:1, every architectural decision — pre-allocated key blocks instead of a hot counter, cache-aside reads with long TTLs, async click logging — exists purely to keep the redirect path a single cache lookup.',
    problemFraming: 'At first glance this looks like a CRUD problem: store a mapping, look it up. But a service like Bitly or TinyURL has to mint unique, non-sequential codes for hundreds of millions of URLs while simultaneously serving tens of thousands of redirects per second with sub-100ms latency, and those two goals pull in different directions. The naive fix — an auto-increment primary key in a single relational database, base62-encoded on read — creates a hot row that every write contends on, produces guessable/enumerable codes (a security and scraping problem), and forces every redirect through the same database that writes are hammering. The real difficulty is decoupling key generation from the write path and decoupling the read-heavy redirect path from both, without introducing collisions or stale data on a service where "the link just doesn\'t work" is a highly visible failure.',
    priorArt: [
      { title: 'Twitter Snowflake', description: 'Distributed ID generation scheme (worker ID + timestamp + sequence bits) that avoids a single global counter bottleneck — the same principle behind pre-allocating key blocks per API server here.' },
      { title: 'Amazon Dynamo (consistent hashing)', description: 'The partitioning technique DynamoDB and Cassandra use under the hood to distribute the short-code keyspace across nodes without a central router.' },
      { title: 'MD5/SHA-256 truncation shorteners', description: 'The classic hash-and-truncate approach used by early URL shorteners; borrowed as the alternative to counter-based encoding, with its collision-retry tradeoff explicitly discussed in the deep dive.' },
      { title: 'Optimistic/conditional writes (DynamoDB ConditionExpression)', description: 'The mechanism this design leans on to resolve custom-alias race conditions atomically instead of overwriting a concurrent writer.' },
    ],
    coreEntities: [
      { name: 'ShortLink', description: 'The mapping between a code and a destination long URL, plus TTL and ownership metadata.' },
      { name: 'ClickEvent', description: 'An immutable record of a single redirect — code, timestamp, referrer, coarse geo.' },
      { name: 'KeyBlock', description: 'A pre-claimed range of unused short codes that an API server hands out locally.' },
      { name: 'AliasReservation', description: 'The uniqueness guard used to atomically resolve a race on a user-chosen custom code.' },
    ],
    requirements: {
      core: [
        'Given a long URL, generate a unique short alias (e.g. short.ly/aZ9kLq)',
        'Redirect a short URL to its original long URL with a 301/302 HTTP response',
        'Allow users to optionally pick a custom alias',
        'Support link expiration after a configurable TTL',
        'Provide basic click analytics (count, referrer, timestamp) per short link'
      ],
      belowTheLine: [
        'QR code generation per short link',
        'A bulk/batch shortening API for marketing campaigns',
        'Branded/custom domains per customer (white-label shortening)',
        'A/B destination testing — routing a percentage of clicks to a variant URL',
      ],
      nonFunctionalTable: [
        { metric: 'Redirect availability', target: 'Succeeds even during partial outages — availability favored over strict consistency' },
        { metric: 'Redirect latency', target: '< 100ms at p99' },
        { metric: 'Scale', target: 'Billions of stored URLs; tens of thousands of redirects/sec at peak' },
        { metric: 'Code collision & guessability', target: 'No collisions; codes not sequentially enumerable or guessable' },
        { metric: 'Durability', target: 'A shortened link must not silently disappear once created' },
      ]
    },
    capacityEstimate: 'Assume 100M new URLs shortened per month and a 100:1 read/write ratio typical of link services, giving roughly 10B redirects per month. Writes average ~40 URLs/sec, but redirects average ~4,000/sec with peak traffic 3-5x that, so plan for ~15-20K QPS at peak. Each stored record (short code, long URL, metadata, timestamps) is roughly 500 bytes; at 100M new URLs/month that is 50GB/month, or about 3TB over 5 years — trivial for modern storage but still worth sharding for write throughput and index size. With 7-character base62 codes we have 62^7 ≈ 3.5 trillion possible codes, comfortably covering years of growth. A cache sized to hold the hottest 20% of active links (the classic 80/20 access skew) at 500 bytes each for, say, 200M hot entries needs about 100GB of RAM, split across a Redis cluster.',
    architecture: 'Clients hit a global load balancer that fans requests to a stateless fleet of API servers behind it. The write path (POST /shorten) validates the submitted URL, generates a unique key, and persists the mapping to a distributed key-value store such as DynamoDB or Cassandra, chosen for its horizontal write scalability and simple key-based access pattern. The read path (GET /{code}) is the dominant workload, so it is optimized separately: a cache-aside layer (Redis) sits in front of the database, and cache misses fall through to the store and populate the cache with a short TTL plus LRU eviction.\n\nUnique key generation is the crux of the write path. Two common approaches: (1) a base62 encoding of an auto-incrementing, globally-unique ID minted by a dedicated ID-generation service (e.g. Twitter Snowflake-style, or a pre-generated pool of unused keys held in a key-value table and claimed atomically), or (2) hashing the long URL (MD5/SHA-256) and truncating to 7 characters, with a collision-check-and-retry loop. Pre-generated key pools avoid hot-row contention on a single counter and let shortening happen with a single fast lookup-and-mark-used operation instead of a hash-and-verify round trip.\n\nAnalytics are handled asynchronously: each redirect emits a lightweight event (short code, timestamp, coarse geo/referrer) onto a Kafka topic, which stream consumers aggregate into a separate analytics store (e.g. a columnar store or time-series DB) so click logging never sits on the critical redirect path. A background expiry sweeper (or TTL support native to the datastore) removes or archives expired links. The whole service is deployed across multiple regions with the datastore replicated asynchronously, since eventual consistency on a newly created link propagating a few hundred milliseconds late is an acceptable trade for global read latency.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[API Server]:::compute
  db[(Relational DB)]:::database

  client -->|"POST /shorten"| api
  api -->|"INSERT, auto-increment id"| db
  client -->|"GET /{code}"| api
  api -->|"SELECT long_url WHERE code = ?"| db`,
      },
      {
        title: 'Core Design: KV Store + Cache-Aside Reads + Pre-Allocated Key Pool',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  api[API Servers]:::compute
  idsvc[[ID Allocator]]:::compute
  cache[("Redis Cache")]:::cache
  kv[("DynamoDB / Cassandra")]:::database

  client --> lb --> api
  api -->|"claim key block (rare)"| idsvc
  api -->|"write mapping"| kv
  api -->|"check cache"| cache
  cache -->|"miss"| kv
  api -->|"populate cache"| cache`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  api[API Servers]:::compute
  idsvc[[ID Allocator]]:::compute
  cache[("Redis Cache")]:::cache
  kv[("DynamoDB / Cassandra")]:::database
  queue[["Kafka"]]:::async
  analytics[(Analytics Store)]:::database
  kvR[("DynamoDB Replica - Region 2")]:::database

  client --> lb --> api
  api -->|"claim key block"| idsvc
  api -->|"write mapping"| kv
  api -->|"check cache"| cache
  cache -->|"miss"| kv
  api -->|"populate cache"| cache
  api -->|"click event"| queue --> analytics
  kv -.->|"async replication"| kvR`,
      },
      {
        title: 'Core Flow: Redirect with Cache-Aside (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant L as Load Balancer
  participant A as API Server
  participant R as Redis Cache
  participant K as KV Store
  participant Q as Kafka

  C->>L: GET /aZ9kLq
  L->>A: route request
  A->>R: GET aZ9kLq
  alt cache hit
    R-->>A: long URL
  else cache miss
    A->>K: GET aZ9kLq
    K-->>A: long URL
    A->>R: SET aZ9kLq (TTL)
  end
  A->>Q: publish click event (async, off critical path)
  A-->>C: 302 Location: long URL`,
      },
    ],
    approaches: [
      {
        name: 'Auto-Increment + Base62 Encode on a Single DB',
        description: 'One relational auto-increment column mints the next ID, base62-encoded on write and decoded on read.',
        pros: ['Dead simple', 'Guaranteed unique', 'Sequential IDs produce compact codes'],
        cons: ['A single hot row every write contends on', 'Sequential codes are guessable/enumerable', 'The database sits on both the write and the read hot path'],
        usedBy: 'Early/toy URL shorteners',
      },
      {
        name: 'Hash-and-Truncate (MD5/SHA of the URL)',
        description: 'Hash the long URL and truncate to N characters, retrying with a different seed on collision.',
        pros: ['No coordinated allocator needed', 'Identical URLs can optionally dedupe to the same code'],
        cons: ['Needs a collision-check-and-retry loop against storage', 'Added write latency', 'Codes are not naturally time-ordered'],
        usedBy: 'Some early hash-based shortener implementations',
      },
      {
        name: 'Pre-Allocated Key-Block Pool',
        description: 'A dedicated ID allocator hands each API server a block of unused base62 keys ahead of time, and servers assign keys locally with zero round trip per request.',
        pros: ['No hot counter contention', 'No collision handling needed', 'Low write latency', 'Unused blocks are a negligible cost given a trillions-large keyspace'],
        cons: ['Requires an allocator service as an extra moving part', 'A crashed server can waste part of its claimed block'],
        usedBy: 'Production-scale link shorteners (Bitly-style systems)',
      },
    ],
    whereThisFits: [
      { layer: 'Write path (Shorten)', blocks: 'Minting a unique code without contention', key: 'pre-claimed key block', example: 'An API server hands out the next key from its local block of 1000' },
      { layer: 'Read path (Redirect)', blocks: 'Serving the dominant, latency-sensitive traffic', key: 'short code -> long URL', example: 'A cache-aside Redis lookup at < 100ms p99' },
      { layer: 'Storage tier', blocks: 'A durable, horizontally scalable key-value mapping', key: 'short code', example: 'DynamoDB/Cassandra partitioned by code hash' },
      { layer: 'Async analytics path', blocks: 'Click tracking off the critical redirect path', key: 'click event', example: 'A Kafka topic consumed into a time-series analytics store' },
    ],
    deepDive: [
      {
        title: 'Choosing a key-generation strategy',
        body: 'Counter-based encoding (base62 of a monotonic ID) guarantees no collisions and short codes, but a single global counter becomes a bottleneck and leaks creation order/volume. Sharding the counter (e.g. one range of IDs per server, or Snowflake-style worker-ID + timestamp + sequence bits) removes the bottleneck at the cost of slightly longer codes. Hash-based approaches (truncated MD5 of the URL) are naturally distributed and let identical URLs optionally map to the same code, but need a collision-retry loop and a uniqueness check against storage, adding latency and complexity. Most production systems land on a hybrid: a service that pre-allocates blocks of unused base62 keys to each API server, so each server can hand out keys locally without contention or a network round trip per request, only refilling its block occasionally.',
        diagram: `flowchart LR
  api[API Server]:::compute
  idsvc[[ID Allocator]]:::compute
  pool[("Unused Key Pool")]:::database

  api -->|"request block of 1000 keys (rare)"| idsvc
  idsvc -->|"claim atomically"| pool
  idsvc -->|"return block of keys"| api`,
      },
      {
        title: 'Cache invalidation and cold-start misses',
        body: 'Because reads dominate roughly 100:1 over writes, cache hit rate drives overall latency more than any other single factor. A cache-aside strategy with a reasonably long TTL (hours) works well because mappings are immutable once created — the only invalidation trigger is expiration or manual deletion, both rare events, so stale-cache risk is low compared to typical CRUD systems. The harder problem is the thundering-herd effect on a newly viral link: a burst of concurrent misses for the same key can hammer the database simultaneously. Mitigate with request coalescing (a single in-flight fetch per key, with other requests waiting on it) or a short negative-cache entry plus jittered retry, and pre-warming the cache for links detected as trending via the analytics stream.'
      },
      {
        title: 'Custom aliases and namespace collisions',
        body: 'Allowing user-chosen aliases turns short codes into a shared namespace with race conditions: two users could submit the same custom alias within milliseconds of each other. This requires a conditional write (e.g. DynamoDB\'s ConditionExpression or a unique index constraint in a relational store) so the second writer fails fast and can be told the alias is taken, rather than silently overwriting the first mapping. It also means custom aliases can\'t safely reuse the pre-allocated key-pool mechanism used for auto-generated codes — they need a distinct code path with an existence check as part of the same atomic operation, and a reservation table (or simply the primary table\'s uniqueness constraint) as the source of truth.'
      }
    ],
    tradeoffs: [
      {
        title: 'Availability vs. strict consistency on writes',
        body: 'A multi-region deployment with asynchronous replication means a short URL created in one region might not be immediately redirectable from another for a few hundred milliseconds. For this domain that is an easy trade to accept — a shortener is not a ledger, and a brief propagation delay on a brand-new link is far less costly than an outage that blocks redirects for existing, already-replicated links. Systems that instead chose strong consistency (synchronous multi-region writes) would pay meaningfully higher write latency for a guarantee almost no user-facing workflow actually needs.'
      },
      {
        title: '301 vs. 302 redirects',
        body: 'A 301 (permanent redirect) lets browsers and intermediate caches/CDNs cache the redirect target, cutting server load and improving perceived latency on repeat visits — but it also means the origin server stops seeing subsequent clicks on that link, which breaks click analytics. A 302 (temporary redirect) forces every click back to the server, preserving accurate click counts and letting you change the destination later, at the cost of higher backend traffic. Most production link shorteners use 302 specifically because click tracking is a core product feature, accepting the extra QPS as the price of that data.'
      },
      {
        title: 'Short-code length vs. keyspace exhaustion risk',
        body: 'Shorter codes are more shareable and look cleaner, but shrink the available keyspace and raise collision probability as the corpus grows into the billions. Six base62 characters (~57 billion combinations) looked ample at small scale but can feel tight against a 20-year growth horizon; seven characters (~3.5 trillion) trades a barely-noticeable length increase for a keyspace that comfortably outlives the product, which is why most real systems default to 7 rather than 6.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Key-Value Store Is Unreachable?',
      body: "Because reads dominate writes roughly 100:1, the cache-aside layer masks most of an outage: already-cached hot links keep redirecting normally since a cache hit never touches the underlying store at all. Cold reads (uncached links) and every new-shorten write fail while the store is down, and the practical choice is to fail closed on those — returning a clear error rather than a silent broken redirect — since correctness (never sending a user to the wrong or a stale destination) matters more here than partial availability. If the deployment is multi-region with asynchronous replication, reads can potentially be served from a healthy region's replica while the primary region recovers, at the cost of the same brief propagation staleness the design already accepts for newly created links. Once the store recovers, cache entries repopulate naturally on the next miss with no special recovery step needed.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/shorten',
        description: 'Create a short URL for a given long URL. Supports optional custom alias and expiration TTL.',
        example: '// Request\n{ "longUrl": "https://example.com/very/long/path", "customAlias": null, "expiresInSec": null }\n\n// Response 201\n{ "code": "aZ9kLq", "shortUrl": "https://short.ly/aZ9kLq", "longUrl": "https://example.com/very/long/path" }',
      },
      {
        method: 'GET',
        path: '/{code}',
        description: 'Redirect to the original long URL. Emits an async click event for analytics before responding.',
        example: '// Response 302\nLocation: https://example.com/very/long/path',
      },
      {
        method: 'PUT',
        path: '/v1/links/{code}',
        description: 'Update settings on an existing link (owner only), such as changing expiration or destination.',
        example: '// Request\n{ "expiresInSec": 604800 }\n\n// Response 200\n{ "code": "aZ9kLq", "expiresAt": "2026-07-23T12:00:00Z" }',
      },
      {
        method: 'GET',
        path: '/v1/links/{code}/analytics',
        description: 'Fetch aggregated click analytics (count, referrers, timestamps) for a short link.',
        example: '// Response 200\n{ "code": "aZ9kLq", "totalClicks": 15234, "topReferrers": [ { "source": "twitter.com", "clicks": 8021 } ] }',
      },
      {
        method: 'DELETE',
        path: '/v1/links/{code}',
        description: 'Delete a short link, making it immediately unresolvable (subject to a brief cache/CDN staleness window).',
        example: '// Response 204 No Content',
      },
    ],
    keyTechnologies: [
      { term: 'Base62 Encoding', definition: 'Encodes a numeric ID using 62 alphanumeric characters, producing compact, URL-safe short codes from a monotonic counter or Snowflake-style ID.' },
      { term: 'Pre-Allocated Key Pool', definition: 'A block of unused short codes claimed atomically by an API server ahead of time, letting it hand out keys locally with zero network round trip per request.' },
      { term: 'Cache-Aside Pattern', definition: 'The API checks Redis first on read, falling through to the KV store on a miss and populating the cache — effective here because mappings are immutable once created.' },
      { term: 'Conditional Write', definition: 'An atomic write that only succeeds if a condition holds (e.g. "key does not already exist"), used to prevent race conditions on custom alias creation.' },
      { term: '301 vs. 302 Redirect', definition: 'A 301 (permanent) is cacheable by browsers/CDNs, cutting load but breaking click tracking; a 302 (temporary) forces every click back to the server, preserving analytics.' },
      { term: 'Consistent Hashing', definition: 'The partitioning scheme used by the underlying KV store (DynamoDB/Cassandra) to distribute the URL-mapping keyspace across nodes.' },
    ],
    selfAudit: [
      {
        question: 'A link goes viral and gets 50,000 redirect requests in the same second — what breaks first?',
        answer: "Nothing at the cache layer if it's already warm; the risk is a thundering herd on first virality before the cache is populated, mitigated by request coalescing (one in-flight DB fetch per key) and pre-warming the cache once the analytics stream detects a spike in click velocity.",
      },
      {
        question: 'Two users submit the same custom alias within milliseconds — what happens?',
        answer: 'Both writes race to a conditional write against the KV store; the store guarantees only one succeeds atomically, and the loser gets an explicit "alias taken" error rather than silently overwriting the winner\'s mapping.',
      },
      {
        question: 'A server crashes after claiming a block of keys but before using most of them — are those keys lost forever?',
        answer: "They're unused but not lost — the allocator tracks claimed ranges, and an unused block can be reclaimed after a lease timeout or simply left permanently retired (a negligible waste given a 3.5-trillion-code keyspace at 7 characters).",
      },
      {
        question: 'Why choose 302 over 301 given that 301 would reduce server load?',
        answer: "Because click analytics (count, referrer, timestamp) is a stated functional requirement — a 301 lets browsers/CDNs cache the redirect and stop hitting the origin, which would silently undercount clicks on repeat visits, so 302 is chosen specifically to keep every click observable.",
      },
      {
        question: 'A link is created in one region — can it 404 briefly if accessed from another region right away?',
        answer: 'Yes, if replication is asynchronous — this is an accepted trade for availability and low write latency; the alternative (synchronous multi-region writes) would slow down every single shorten request to guard against a rare, brief propagation window on brand-new links.',
      },
    ],
    cheatSheet: [
      { question: 'Which key-generation approach?', answer: 'A pre-allocated key-block pool — it avoids both hot-counter contention and hash-collision handling.' },
      { question: 'Where does state live?', answer: 'The KV store (DynamoDB/Cassandra) holds mappings; Redis cache-aside sits in front for reads.' },
      { question: 'How to make custom aliases safe under races?', answer: 'A conditional write (exists-check-and-set) so only one of two concurrent claims can succeed.' },
      { question: 'What if the KV store is down?', answer: 'Cached hot links keep redirecting; cold reads and all writes fail until it recovers.' },
      { question: 'How is it layered?', answer: 'The write path (key allocator + KV store) is fully decoupled from the read path (cache-aside redirect).' },
      { question: 'How does it scale reads vs. writes?', answer: 'Reads dominate roughly 100:1, so nearly every design choice optimizes the redirect path, not the write path.' },
      { question: '301 or 302?', answer: '302, because click analytics is a stated requirement and a 301 would let browsers/CDNs cache past the origin.' },
    ],
    expectedDepth: {
      mid: 'Explain base62 encoding, propose a relational auto-increment approach, and understand that redirects need to be fast and cached given the read-heavy access pattern.',
      senior: 'Compare counter-based vs. hash-based key generation, design a cache-aside layer with appropriate TTLs, resolve custom-alias race conditions with a conditional write, and justify choosing 302 over 301 given the analytics requirement.',
      staffPlus: 'Design a pre-allocated key-block pool to remove counter contention entirely, reason about multi-region asynchronous replication tradeoffs, mitigate thundering-herd effects on a newly viral link, and weigh short-code length (6 vs. 7 characters) against a multi-decade growth horizon.',
    },
    keyTakeaways: [
      'Nearly every architectural choice exists to keep the redirect path a single fast cache lookup, since reads outnumber writes roughly 100:1.',
      'Pre-allocated key blocks avoid both hot-counter contention and hash-collision handling.',
      'Custom aliases need a conditional write, not a plain insert, to avoid silently overwriting a race winner.',
      '302 over 301 is a deliberate choice driven by the click-analytics requirement, not an oversight.',
    ],
    relatedDesigns: ['pastebin', 'key-value-store', 'rate-limiter'],
  },
  {
    slug: 'social-feed',
    title: 'Twitter (X) / Threads — Social Feed',
    difficulty: 'Intermediate',
    icon: 'pi pi-comments',
    color: '#8b5cf6',
    concepts: ['Fan-out on write vs. read', 'Timeline generation', 'Celebrity/hot-key problem', 'Graph storage', 'Ranking pipeline'],
    companies: ['Twitter (X)', 'Meta (Threads/Instagram)', 'LinkedIn', 'Pinterest'],
    summary: 'A social timeline that lets users post short updates and see a ranked feed aggregated from everyone they follow, testing fan-out strategy and hot-key handling at scale.',
    tldr: "The design center of gravity is the fan-out strategy: push new posts into followers' precomputed timelines for most users so reads are a cheap cache lookup, but flip to pull-based fan-out-on-read for celebrity accounts so a single post from a 50M-follower account doesn't trigger 50M writes.",
    problemFraming: 'The obvious approach — when a user opens their feed, query the posts of everyone they follow and merge/sort on the fly — looks fine until you picture Twitter (X) or Threads at hundreds of millions of DAU: a user following 500 accounts would trigger 500 fan-in reads per timeline load, tens of thousands of times a second, all hitting the posts table directly. Flip the naive fix around — precompute every follower\'s timeline at post time instead — and you hit the opposite wall: a celebrity account with 50M followers publishing one post now means 50M synchronous writes, an operation no fan-out worker pool can absorb without falling hopelessly behind. Real systems need a design that makes normal posts cheap to fan out and celebrity posts cheap to publish, simultaneously, which is why neither pure push nor pure pull survives contact with real follower-count distributions.',
    priorArt: [
      { title: "Twitter's early timeline fan-out architecture", description: 'Twitter\'s own engineering writeups on fan-out-on-write timelines and the "celebrity problem" (colloquially the Justin Bieber problem) directly motivate the hybrid push/pull split used here.' },
      { title: 'Facebook/Meta TAO', description: 'A graph-aware caching layer built for the social graph read pattern (friends/followers), the same class of problem the follower-graph service here needs to solve at scale.' },
      { title: 'Lambda architecture (batch + stream ranking)', description: 'The pattern of combining a precomputed base (cached timeline) with a real-time merge step (celebrity pull sources, ranking) at read time, rather than recomputing everything from scratch.' },
    ],
    coreEntities: [
      { name: 'Post', description: 'The atomic content unit — author, text/media references, timestamp, engagement counts.' },
      { name: 'Follow Edge', description: 'A directed relationship in the social graph; drives both fan-out targeting and pull-based reads.' },
      { name: 'Timeline Entry', description: "A lightweight reference (post ID + timestamp) precomputed into a follower's cached feed." },
      { name: 'Engagement Counter', description: 'A sharded, eventually-consistent tally of likes/replies/reposts attached to a post.' },
    ],
    requirements: {
      core: [
        'Users can post short text/media updates ("tweets")',
        'Users can follow/unfollow other users and view a follower/following graph',
        'Users can view a home timeline composed of posts from accounts they follow',
        'Support likes, replies, and reposts on individual posts',
        'Support a basic ranking or chronological ordering of the timeline',
        'Search for posts and users by keyword or handle'
      ],
      belowTheLine: [
        'Personalized ML-ranking model beyond simple recency/affinity heuristics',
        'Real-time trending topics/hashtags surfaced platform-wide',
        'Direct messages between users',
        'Creator analytics dashboard (impressions, engagement over time)',
      ],
      nonFunctionalTable: [
        { metric: 'Timeline read latency', target: 'Well under 200ms p99 for a home timeline fetch' },
        { metric: 'Celebrity fan-out cost', target: 'O(1) publish cost regardless of follower count (hybrid fan-out)' },
        { metric: 'Write availability', target: 'No post failures during breaking-news/live-event traffic spikes' },
        { metric: 'Engagement count consistency', target: 'Eventually consistent; likes/reposts propagate within a few seconds' },
        { metric: 'Scale', target: 'Hundreds of millions of DAU; billions of stored posts' },
      ]
    },
    capacityEstimate: 'Assume 300M daily active users, each viewing their timeline ~5 times/day and posting ~0.5 times/day on average. That is 1.5B timeline reads/day (~17,000 QPS average, 3-5x at peak, so design for ~60-80K read QPS) and 150M new posts/day (~1,700 QPS average writes). Each post is small — 280 characters of text plus metadata is under 1KB, but a meaningful fraction (~30%) attach media averaging 200KB-2MB; call it a blended 300KB/post including media, giving ~45TB/day of new content, dominated by media stored in object storage/CDN rather than the primary database. If fan-out-on-write pushes each post into follower timeline caches, and the median user has 200 followers, that is 150M posts × 200 = 30B fan-out write operations/day — this is precisely why celebrity accounts (10M+ followers) get special-cased into a hybrid fan-out model rather than multiplying that cost further.',
    architecture: 'On the write path, a post service accepts new posts, persists them to a sharded post store (sharded by post ID or author ID), and pushes the post into a fan-out pipeline via a message queue (Kafka). A separate follower-graph service, backed by a graph-optimized store or a sharded relational table indexed by both follower and followee, resolves who needs to receive the post. For most users, a fan-out worker writes a lightweight reference (post ID + timestamp) into each follower\'s precomputed timeline, stored in a fast key-value store like Redis or Cassandra as a bounded, time-ordered list — this is "fan-out on write," and it makes timeline reads cheap because they are just a cache lookup.\n\nCelebrity accounts break this model: pushing a single post to 50M followers instantly would overwhelm the fan-out workers and cache writes. These accounts are handled with fan-out on read (or a hybrid): their posts are not pushed into every follower\'s timeline cache; instead, at read time, the timeline service merges the follower\'s precomputed timeline with a small set of "pull" sources — posts from accounts the follower follows that exceed a follower-count threshold. This keeps celebrity posts affordable to publish while adding only a small, bounded merge cost to timeline reads for their followers.\n\nOn the read path, a client requests its home timeline; the timeline service fetches the precomputed list from cache, pulls in any celebrity-sourced posts, hydrates post IDs into full post objects (batched multi-get against the post store, itself cache-fronted), and passes the result through a ranking service that reorders by an engagement-prediction model or simple recency/affinity heuristic before returning. Media referenced by posts is served directly from a CDN, decoupled entirely from the timeline hot path. Likes, replies, and repost counts are maintained as approximate, eventually-consistent counters (sharded counters or a CRDT-like increment scheme) updated asynchronously off the write path so a viral post\'s like button doesn\'t become a write bottleneck.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[API Server]:::compute
  pg[(PostgreSQL)]:::database
  client -->|"POST /posts"| api
  client -->|"GET /timeline"| api
  api -->|"INSERT INTO posts"| pg
  api -->|"SELECT posts WHERE author_id IN (following) ORDER BY created_at"| pg`,
      },
      {
        title: 'Core Design: Fan-out on Write',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Post Service]:::compute
  queue[["Kafka"]]:::async
  fanout[Fan-out Worker]:::compute
  fgraph[(Follower Graph)]:::database
  tcache[("Timeline Cache")]:::cache
  postdb[(Post Store)]:::database

  client -->|"POST /posts"| api
  api -->|"persist post"| postdb
  api -->|"post event"| queue
  queue --> fanout
  fanout -->|"lookup followers"| fgraph
  fanout -->|"push post id"| tcache`,
      },
      {
        title: 'Handling Celebrities: Hybrid Fan-out on Read',
        mermaid: `flowchart LR
  client[Client]:::client
  tapi[Timeline Service]:::compute
  tcache[("Timeline Cache")]:::cache
  hotcache[("Hot-Accounts Cache")]:::cache
  postdb[(Post Store)]:::database

  client -->|"GET /timeline"| tapi
  tapi -->|"fetch precomputed follower list"| tcache
  tapi -->|"merge in celebrity posts"| hotcache
  tapi -->|"hydrate post ids"| postdb`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[Load Balancer]:::edge
  post[Post Service]:::compute
  timeline[Timeline Service]:::compute
  rank[Ranking Service]:::compute
  queue[["Kafka"]]:::async
  fanout[Fan-out Worker]:::compute
  fgraph[(Follower Graph)]:::database
  tcache[("Timeline Cache")]:::cache
  hotcache[("Hot-Accounts Cache")]:::cache
  postdb[(Post Store)]:::database
  search[("Search Index")]:::storage
  cdn[["CDN (media)"]]:::edge

  client --> lb --> post
  lb --> timeline
  post -->|"persist"| postdb
  post -->|"post event"| queue --> fanout
  fanout -->|"followers"| fgraph
  fanout -->|"push post id"| tcache
  timeline -->|"precomputed list"| tcache
  timeline -->|"celebrity posts"| hotcache
  timeline -->|"hydrate"| postdb
  timeline --> rank --> client
  postdb -.->|"index"| search
  client -->|"media bytes"| cdn`,
      },
      {
        title: 'Publish + Hybrid Fan-out (Sequence)',
        mermaid: `sequenceDiagram
  participant U as Author
  participant P as Post Service
  participant Q as Kafka
  participant F as Fan-out Worker
  participant G as Follower Graph
  participant T as Timeline Cache

  U->>P: POST /posts
  P->>P: persist post to Post Store
  P-->>U: 201 Created
  P->>Q: publish PostCreated event
  Q->>F: consume event
  F->>G: is author above celebrity follower-count threshold?
  alt regular account
    F->>G: fetch follower list
    F->>T: push post id to each follower's timeline
  else celebrity account
    F->>T: publish to hot-accounts cache only
  end`,
      },
    ],
    approaches: [
      {
        name: 'Fan-out on Write',
        description: "Push a new post into every follower's precomputed timeline cache at post time, so a timeline read is a cheap cache lookup.",
        pros: ['Reads are O(1) cache hits', 'Timeline load latency stays flat regardless of follow-graph size', 'Simple read path'],
        cons: ['Publish cost scales with follower count', 'Celebrity accounts create a fan-out blowup', 'Wastes writes on followers who never open the app'],
        usedBy: 'Twitter/X and Threads for the vast majority of (non-celebrity) accounts',
      },
      {
        name: 'Fan-out on Read',
        description: 'Defer aggregation until timeline load: merge candidate posts from followed accounts at request time instead of precomputing.',
        pros: ['O(1) publish cost regardless of follower count', 'No wasted work for inactive followers', 'Naturally handles celebrities'],
        cons: ['Every read pays a scatter-gather cost across all followed accounts', 'Read latency grows with follow-graph size', 'Harder to cache effectively'],
        usedBy: 'Small/early-stage feed products, or as the celebrity-only fallback in larger systems',
      },
      {
        name: 'Hybrid Fan-out',
        description: 'Fan-out-on-write for regular accounts below a follower-count threshold, fan-out-on-read for accounts above it, merged at timeline-read time.',
        pros: ['Bounds worst-case publish cost to O(1)', 'Keeps the common-case read path cheap', 'Matches real follower-count power-law distributions'],
        cons: ['Two code paths to build, test, and operate', 'Requires a merge/dedupe step on every read', 'Threshold tuning is an ongoing operational decision'],
        usedBy: 'Twitter (X), Threads, and effectively every feed product at hundreds-of-millions-of-DAU scale',
      },
    ],
    whereThisFits: [
      { layer: 'Ingestion', blocks: 'Post creation, persistence, event emission', key: 'Author ID / Post ID', example: 'Post Service writes to Post Store, emits PostCreated to Kafka' },
      { layer: 'Fan-out', blocks: 'Distributing new posts to follower timelines', key: 'Follower Graph + threshold check', example: 'Regular accounts fan out; accounts >1M followers skip to hot-accounts cache' },
      { layer: 'Serving', blocks: 'Timeline assembly and hydration', key: 'Cached timeline + celebrity merge', example: 'Timeline Service merges precomputed cache with hot-accounts posts' },
      { layer: 'Ranking', blocks: 'Reordering candidates by relevance', key: 'Engagement-prediction model or heuristic', example: 'Re-rank 200 candidates down to the 20 shown first' },
    ],
    deepDive: [
      {
        title: 'The celebrity fan-out problem',
        body: 'Pure fan-out-on-write is elegant until an account with 50M followers posts: naively that is 50M individual cache writes for a single tweet, which can take minutes and saturate fan-out workers, delaying every other user\'s fan-out in the same queue. The standard fix is a hybrid model with a follower-count threshold (commonly somewhere around 1M-10M): below it, fan-out-on-write as normal; above it, skip fan-out entirely and instead let timeline reads merge in the celebrity\'s recent posts at request time from a small, separately cached "hot accounts" post list. This bounds worst-case publish cost to O(1) regardless of follower count, at the price of a slightly more expensive read for anyone who follows a celebrity — an acceptable trade since reads are naturally more parallelizable and cacheable than a single synchronous fan-out burst.',
        diagram: `flowchart TD
  post[New Post by Author]:::compute
  check[Follower count above threshold?]:::compute
  fanout[Fan-out to each follower's Timeline Cache]:::async
  hot[Publish to Hot-Accounts Cache]:::cache
  read[Timeline Service merges cache + hot-accounts posts at read time]:::compute

  post --> check
  check -->|"No"| fanout
  check -->|"Yes (celebrity)"| hot
  fanout --> read
  hot --> read`,
      },
      {
        title: 'Timeline ranking vs. pure recency',
        body: 'A purely chronological timeline is simple to build (a merge of sorted per-follow lists) but not what most modern feed products ship — engagement-optimized ranking reorders candidates by a learned model considering recency, author affinity, predicted engagement probability, and content type. This adds a distinct "candidate generation → feature enrichment → scoring → re-ranking" pipeline downstream of the raw timeline fetch, typically as its own service so the ranking model can be iterated on independently of the storage layer. The trade-off is architectural complexity and added latency (an extra network hop and model inference per timeline request) in exchange for meaningfully higher engagement — most large-scale feed systems consider this worth it, but it is a legitimate reason a system-design answer might scope ranking out for an MVP.'
      },
      {
        title: 'Sharding the follower graph',
        body: 'A follower graph needs to answer two very different queries efficiently: "who follows user X" (needed for fan-out) and "who does user X follow" (needed to build a chronological pull-based timeline as a fallback or for celebrities). Sharding purely by follower ID makes the first query fast but the second requires scatter-gather across many shards, and vice versa for sharding by followee ID. Production systems typically maintain two denormalized indexes — a followers-of and a following-of table, each sharded on its own primary access key — accepting double the write cost on follow/unfollow (which is a low-frequency operation) to keep both critical read paths single-shard operations.'
      },
      {
        title: 'Approximate counters under high write contention',
        body: 'A single viral post can receive tens of thousands of likes per second, and naive row-level increments on one counter row create severe lock contention and hot-partition throttling in most databases. The standard mitigation is sharded counters — splitting one logical counter into N physical counter rows (or Redis keys) and summing them on read, spreading write load across N partitions — combined with periodic asynchronous flush of in-memory increment buffers rather than a database write per single like. The visible count is therefore an eventually-consistent approximation for a brief window, which is a deliberate and acceptable trade since exact real-time like counts have essentially no product value over "close enough within a second or two."'
      }
    ],
    tradeoffs: [
      {
        title: 'Fan-out on write vs. fan-out on read',
        body: 'Write-time fan-out makes reads cheap (a cache hit) at the cost of expensive, storage-heavy writes and the celebrity blowup problem; read-time fan-out makes writes cheap (O(1) regardless of follower count) but pushes aggregation cost onto every timeline read, which is far more frequent than posting. Since reads outnumber writes by roughly two orders of magnitude in this domain, pure fan-out-on-read for everyone would be too slow, and pure fan-out-on-write for everyone breaks on celebrities — hence the near-universal hybrid, which is really an admission that neither pure strategy is viable at this scale.'
      },
      {
        title: 'Consistency of engagement counts vs. write throughput',
        body: 'Strongly consistent like/reply counters would require serializing writes per post, which collapses under viral load; eventually consistent, sharded, asynchronously-flushed counters scale horizontally but mean the number shown to a user can lag reality by a second or more and can even (rarely) be slightly inconsistent across replicas during a network partition. For vanity metrics like counts, this is an easy call in favor of availability and throughput — nobody notices a like count that\'s off by three for two seconds.'
      },
      {
        title: 'Ranked feed complexity vs. time-to-ship and explainability',
        body: 'A learned ranking model improves engagement but is opaque (hard to explain why a post appears where it does), expensive to operate (feature pipelines, model retraining, A/B infrastructure), and adds a scoring hop to every timeline request\'s latency budget. A simpler recency- or affinity-weighted heuristic is easier to reason about, cheaper to run, and ships faster, at the cost of leaving engagement gains on the table — a legitimate choice for a smaller product or an MVP-scoped interview answer.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Timeline Cache Goes Down?',
      body: "The timeline cache (Redis/Cassandra holding precomputed fan-out results) is the load-bearing dependency for every home-timeline read, so its outage can't simply mean 'no feed.' The standard degradation path falls back to a pull-based query — hitting the follower graph and post store directly to reconstruct a chronological timeline for the fraction of users actively requesting one during the outage — which is far more expensive per request but keeps the product minimally functional. This works only because the fallback query pattern (scatter-gather over a bounded follow list) is exactly the fan-out-on-read path already built for celebrities, just applied to everyone temporarily. Fan-out workers queue their writes upstream of the cache rather than failing, so once the cache recovers, the backlog drains and precomputed timelines catch back up without any lost posts.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/posts',
        description: 'Create a new post. Media is uploaded separately and referenced by object key.',
        example: '// Request\n{ "text": "excited for the launch", "mediaKeys": ["m_991"] }\n\n// Response 201\n{ "postId": "p_58213", "createdAt": "2026-07-16T10:02:00Z" }',
      },
      {
        method: 'GET',
        path: '/v1/timeline?cursor={cursor}&limit=20',
        description: "Fetch the caller's ranked home timeline, merging precomputed fan-out results with any followed celebrity accounts.",
        example: '// Response 200\n{ "posts": [ { "postId": "p_58213", "author": "u_12", "score": 0.91 } ], "nextCursor": "eyJvZ..." }',
      },
      {
        method: 'POST',
        path: '/v1/follows/{userId}',
        description: 'Follow a user; updates both the followers-of and following-of denormalized indexes.',
        example: '// Response 204 No Content',
      },
      {
        method: 'POST',
        path: '/v1/posts/{postId}/likes',
        description: 'Like a post. Applied against a sharded counter and flushed asynchronously.',
        example: '// Response 202 Accepted\n{ "accepted": true }',
      },
      {
        method: 'GET',
        path: '/v1/search?q={query}&type=posts',
        description: 'Keyword search over posts and users via an inverted index.',
        example: '// Response 200\n{ "results": [ { "postId": "p_58213", "snippet": "...launch..." } ] }',
      },
    ],
    keyTechnologies: [
      { term: 'Fan-out on Write', definition: "Push a new post into every follower's precomputed timeline cache at post time, so reads are cheap cache lookups." },
      { term: 'Fan-out on Read', definition: 'Defer aggregation to read time, merging candidate posts from followed accounts when the timeline is actually requested.' },
      { term: 'Hybrid Fan-out', definition: 'Fan-out-on-write for normal accounts, fan-out-on-read for accounts above a follower-count threshold, avoiding celebrity write blowups.' },
      { term: 'Sharded Counter', definition: 'A logical counter split across N physical rows/keys to spread write contention, summed on read for an eventually-consistent total.' },
      { term: 'Follower Graph', definition: 'The directed social graph of who-follows-whom, typically stored as two denormalized indexes optimized for opposite query directions.' },
      { term: 'Candidate Generation / Re-ranking', definition: 'A two-stage pipeline that first assembles a bounded candidate set of posts, then scores and reorders that smaller set with a ranking model.' },
    ],
    selfAudit: [
      {
        question: 'What happens if a user unfollows someone right after a fan-out push already delivered a post into their timeline cache?',
        answer: 'The stale entry is harmless and short-lived — timeline reads can filter against the current follow-graph state, or simply let the entry age out naturally, since a single leftover post in a bounded, time-ordered cache is not worth a synchronous cleanup pass.',
      },
      {
        question: 'How do you handle a user who follows 10,000 accounts and expects a fast timeline?',
        answer: "Fan-out-on-write already solved this on the write side (the post lands directly in their cache regardless of how many accounts they follow); the remaining cost is a slightly larger celebrity-merge step at read time, bounded by the number of celebrities they follow, not their total follow count.",
      },
      {
        question: 'What happens if a fan-out worker crashes mid-fan-out to a large follower list?',
        answer: 'The fan-out job is idempotent and resumable from the queue offset — a retried job simply re-pushes the post id into follower caches it may have already reached, which is a harmless duplicate write, not a correctness bug.',
      },
      {
        question: 'How do you avoid showing duplicate posts when merging a regular precomputed timeline with pulled celebrity posts?',
        answer: 'The merge step dedupes by post id before ranking, and celebrity posts are excluded from the precomputed cache entirely (never fanned out), so the two sources are disjoint by construction rather than requiring runtime dedup logic.',
      },
      {
        question: "How does search scale across billions of posts without slowing down as the corpus grows?",
        answer: "Search runs against a separately maintained inverted index updated asynchronously off the same post-creation event stream, decoupled from the timeline hot path, and is sharded by term/post-id so index size growth doesn't linearly slow any single query.",
      },
    ],
    cheatSheet: [
      { question: 'Which fan-out strategy?', answer: 'Hybrid — fan-out-on-write for most accounts, fan-out-on-read for celebrities.' },
      { question: 'Where does timeline state live?', answer: 'A precomputed, bounded, time-ordered list per user in Redis/Cassandra.' },
      { question: 'How to avoid the celebrity blowup?', answer: 'A follower-count threshold routes big accounts to fan-out-on-read instead of pushing to millions of caches.' },
      { question: 'What if the timeline cache is down?', answer: 'Fall back to pull-based scatter-gather over the follow graph — slower, still correct.' },
      { question: 'How to keep counts fast under viral load?', answer: 'Sharded, asynchronously-flushed counters instead of one row-level increment per like.' },
      { question: 'Chronological or ranked?', answer: 'Ranked by a downstream scoring service, decoupled from storage so it can be iterated on independently.' },
      { question: 'How does the follower graph stay fast both ways?', answer: 'Two denormalized indexes — followers-of and following-of — each sharded on its own key.' },
    ],
    expectedDepth: {
      mid: "Explain fan-out-on-write as the basic mechanism — pushing a new post into followers' cached timelines — and recognize that a naive on-read query joining posts against the follow graph does not scale for high-follower-count users. Propose Redis or a similar cache to store precomputed timelines.",
      senior: 'Articulate the celebrity/hot-key problem explicitly and propose a hybrid fan-out model with a follower-count threshold. Discuss sharding the follower graph in two directions (followers-of / following-of) to keep both fan-out and pull queries single-shard. Cover eventually-consistent, sharded counters for likes/replies under viral write load.',
      staffPlus: "Design the full candidate-generation -> feature-enrichment -> scoring -> re-ranking pipeline as an independently evolving service, and reason about its added latency budget. Address multi-region timeline consistency, cache-cold-start for new followers, and graceful degradation when the fan-out queue backs up during a global event. Discuss how search, trending, and recommendations reuse the same event stream without coupling to the timeline hot path.",
    },
    keyTakeaways: [
      "No single fan-out strategy survives real follower-count distributions — the hybrid is not an optimization, it's a requirement",
      'Precomputed timelines trade write cost for read speed; the trade only breaks down at the extreme tail (celebrities)',
      "Ranking is a separable concern from storage — build the timeline pipeline so it can ship chronological first, ranked later",
      'Engagement counts are vanity metrics — always prefer eventual consistency and sharded counters over strict accuracy',
    ],
    relatedDesigns: ['photo-sharing', 'notification-system', 'news-aggregator'],
  },
  {
    slug: 'chat-system',
    title: 'Chat System (WhatsApp / iMessage)',
    difficulty: 'Intermediate',
    icon: 'pi pi-send',
    color: '#10b981',
    concepts: ['WebSocket connection management', 'Message ordering & delivery guarantees', 'End-to-end encryption', 'Presence & typing indicators', 'Offline message queuing'],
    companies: ['WhatsApp (Meta)', 'Apple (iMessage)', 'Slack', 'Discord'],
    summary: 'A real-time messaging system supporting one-on-one and group chats with reliable delivery, presence, and offline sync across billions of persistent connections.',
    tldr: 'Because a single logical conversation is spread across thousands of stateful connection servers, the load-bearing piece of this design is the connection registry that maps user ID to gateway server — every message delivery, presence update, and offline-queue decision starts with that lookup.',
    problemFraming: 'A one-on-one chat between two open sockets on the same server is trivial; the hard problem appears once you scale to WhatsApp or iMessage numbers — hundreds of millions of concurrent persistent connections spread across a fleet of thousands of gateway servers, where the sender and recipient are almost certainly attached to different machines. The naive approach of routing all traffic through one server, or broadcasting every message to every server hoping the recipient is there, either can\'t scale past a few hundred thousand connections or wastes enormous fan-out bandwidth. Layer in delivery guarantees (at-least-once with strict per-conversation ordering), offline users who need messages queued for later, and end-to-end encryption that denies the server any plaintext to reason about, and you get a routing problem that has to be solved correctly before presence, read receipts, or group chats can even be discussed.',
    priorArt: [
      { title: 'Signal Protocol (Double Ratchet)', description: 'The end-to-end encryption scheme WhatsApp itself adopted; provides per-message forward-secret keys so the server only ever stores and routes ciphertext.' },
      { title: "WhatsApp's Erlang/FreeBSD connection-handling architecture", description: 'WhatsApp\'s well-documented use of lightweight Erlang processes to hold millions of concurrent sockets per machine informed the "stateful gateway server holding many idle connections cheaply" model here.' },
      { title: 'Kafka partitioned append log', description: "The per-conversation ordered, durable log used as the message store mirrors Kafka's per-partition ordering guarantee, which is explicitly invoked as the mental model for conversation ordering." },
      { title: 'Redis pub/sub for ephemeral presence', description: 'A standard pattern for broadcasting short-lived, non-durable state (typing indicators, online status) without paying the cost of durable storage for data that\'s harmless to lose.' },
    ],
    coreEntities: [
      { name: 'Conversation', description: 'A 1:1 or group thread grouping an ordered sequence of messages.' },
      { name: 'Message', description: 'A single unit with sender, ciphertext payload, and a per-conversation sequence number.' },
      { name: 'Connection Registry Entry', description: "Maps a user/device to the specific gateway server currently holding its socket." },
      { name: 'Delivery Receipt', description: 'Per-recipient sent/delivered/read state for a message, propagated as its own low-priority event.' },
    ],
    requirements: {
      core: [
        'Send and receive text messages in one-on-one and group conversations',
        'Show message delivery state: sent, delivered, read (read receipts)',
        'Support offline users — messages queue and deliver on reconnect',
        'Show online/last-seen presence and typing indicators',
        'Support media attachments (images, video, voice notes)',
        'Sync message history across a user\'s multiple devices'
      ],
      belowTheLine: [
        'Message editing/deletion with edit history propagated across devices',
        'Disappearing/ephemeral messages with a TTL',
        'Full-text search across (client-side-indexed) encrypted message history',
        'Emoji reactions and threaded replies',
      ],
      nonFunctionalTable: [
        { metric: 'Delivery latency (online recipient)', target: '< 200ms end-to-end' },
        { metric: 'Delivery guarantee', target: 'At-least-once, with client-side dedup by message ID' },
        { metric: 'Concurrent connections', target: 'Hundreds of millions of persistent WebSocket connections' },
        { metric: 'Ordering', target: 'Strict per-conversation ordering via monotonic sequence numbers' },
        { metric: 'Confidentiality', target: 'End-to-end encrypted; server stores ciphertext only' },
      ]
    },
    capacityEstimate: 'Assume 500M daily active users, each sending an average of 40 messages/day, giving 20B messages/day (~230K messages/sec average, with evening peaks 3-4x that, so design for roughly 800K-1M msgs/sec at peak). If ~20% of DAUs are concurrently online at any given moment, that is 100M simultaneous persistent WebSocket connections to size the connection-handling tier for — at roughly 10-50KB of server-side memory per idle connection (socket buffers, session state), that is 1-5TB of RAM spread across the fleet, meaning thousands of connection-handling servers each holding on the order of tens of thousands of sockets. A text message with metadata is roughly 1KB once encrypted and wrapped; 20B messages/day of metadata alone is ~20TB/day, while media attachments (a meaningful fraction of messages, averaging a few hundred KB each) dominate actual storage and are pushed to object storage rather than the message-log database, which mainly needs to hold small encrypted blobs plus routing metadata.',
    architecture: 'Clients maintain a persistent WebSocket (or a custom binary protocol over TCP) to a fleet of stateful gateway/connection servers, fronted by a load balancer capable of sticky, long-lived connection routing. A connection registry — typically a distributed cache like Redis — maps each user ID to the specific gateway server (and connection ID) currently holding their socket, since with hundreds of millions of connections spread across thousands of servers, any component that needs to deliver a message must first look up where that recipient is currently attached.\n\nWhen a client sends a message, it goes to its own connection server, which writes it to a durable, ordered message store (often modeled as a per-conversation append-only log, similar in spirit to how Kafka partitions work, ensuring ordering within a conversation) and acknowledges the sender. The server then looks up the recipient\'s connection location via the registry: if the recipient is online, the message is pushed directly to their gateway server and forwarded over their open socket; if offline, it is placed in a per-user offline queue and delivered on reconnect, with a push notification triggered through the notification system to wake the client. Message delivery state (sent/delivered/read) is tracked as a small state machine per message per recipient, propagated back to the sender as separate low-priority events so read receipts don\'t block message delivery itself.\n\nGroup chats fan a single sent message out to N recipients using the same per-user delivery path, which is why large groups (hundreds of members) are handled as a bounded fan-out job rather than blocking the sender\'s send-ack on all N deliveries completing. Presence (online/offline/typing) is maintained as ephemeral, short-TTL state in the same connection registry and broadcast via lightweight pub/sub to relevant conversation participants rather than persisted durably, since presence is inherently transient and stale presence data is harmless. End-to-end encryption (commonly a double-ratchet-style protocol, as used by Signal and WhatsApp) means the server only ever handles ciphertext for message bodies — key exchange and encryption happen entirely client-side, so the server\'s message store and logs deliberately provide no plaintext value even to an internal attacker.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  server[Chat Server]:::compute
  db[(Message Table)]:::database

  clientA -->|"POST /messages"| server
  server -->|"INSERT message"| db
  clientB -->|"GET /messages?since=..."| server
  server -->|"SELECT new messages"| db`,
      },
      {
        title: 'Core Design: Persistent Connections + Registry',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  gwA[Gateway Server A]:::compute
  gwB[Gateway Server B]:::compute
  registry[("Connection Registry")]:::cache
  log[(Message Log)]:::database

  clientA -->|"WebSocket"| gwA
  clientB -->|"WebSocket"| gwB
  gwA -->|"persist + ack"| log
  gwA -->|"lookup recipient's gateway"| registry
  gwA -->|"forward message"| gwB
  gwB -->|"push"| clientB`,
      },
      {
        title: 'Offline Queueing and Presence',
        mermaid: `flowchart LR
  gwA[Gateway Server]:::compute
  offline[["Offline Queue"]]:::async
  push[Push Notification Service]:::compute
  presence[("Presence Store")]:::cache
  clientB[Client B, offline]:::client

  gwA -->|"recipient offline"| offline
  offline -->|"trigger wake"| push
  push -->|"APNs/FCM"| clientB
  gwA -.->|"update online/typing state"| presence`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  lb[Load Balancer]:::edge
  gwA[Gateway Server]:::compute
  gwB[Gateway Server]:::compute
  registry[("Connection Registry")]:::cache
  log[(Per-Conversation Message Log)]:::database
  offline[["Offline Queue"]]:::async
  push[Push Notification Service]:::compute
  presence[("Presence Store")]:::cache
  media[("Media Object Storage")]:::storage

  clientA -->|"WebSocket"| lb
  clientB -->|"WebSocket"| lb
  lb --> gwA
  lb --> gwB
  gwA -->|"persist, ordered"| log
  gwA -->|"lookup recipient"| registry
  gwA -->|"online: forward"| gwB --> clientB
  gwA -->|"offline: enqueue"| offline --> push --> clientB
  gwA -.->|"presence/typing"| presence
  clientA -->|"upload attachment"| media`,
      },
      {
        title: 'Message Send + Delivery (Sequence)',
        mermaid: `sequenceDiagram
  participant A as Sender
  participant GwA as Gateway (Sender)
  participant Reg as Connection Registry
  participant GwB as Gateway (Recipient)
  participant B as Recipient
  participant Log as Message Log

  A->>GwA: send message
  GwA->>Log: append message, assign per-conversation seq
  Log-->>GwA: durable ack
  GwA-->>A: sent
  GwA->>Reg: lookup recipient's gateway
  alt recipient online
    GwA->>GwB: forward message
    GwB->>B: push over WebSocket
    B-->>GwB: delivered ack
    GwB-->>GwA: delivered receipt
  else recipient offline
    GwA->>GwA: enqueue in offline queue
    GwA->>B: trigger push notification
  end`,
      },
    ],
    approaches: [
      {
        name: 'Client Polling',
        description: 'Clients periodically call an HTTP endpoint asking "anything new since X?" instead of holding an open connection.',
        pros: ['Trivial to build on stateless HTTP infra', 'No connection-draining concerns on deploy', 'Works behind restrictive proxies/firewalls'],
        cons: ['Cannot hit sub-200ms delivery latency without punishing poll frequency', 'Wastes bandwidth/battery on empty polls', 'Does not scale to real-time presence/typing'],
      },
      {
        name: 'Broadcast to All Servers',
        description: "Every gateway server receives every message and drops it if it isn't holding the recipient's socket, avoiding a routing lookup.",
        pros: ['No connection-registry dependency', 'Simple mental model — no lookup step'],
        cons: ['Fan-out bandwidth scales with total server count, not recipient count', 'Wildly wasteful at thousands of gateway servers', 'Does not scale past a small fleet'],
      },
      {
        name: 'Persistent Connections + Connection Registry',
        description: "Clients hold a long-lived WebSocket to a stateful gateway; a distributed registry maps user ID to gateway so any server can route a message to exactly the right destination.",
        pros: ['Sub-200ms push delivery', 'Routing cost is O(1) via a single registry lookup', 'Scales to hundreds of millions of concurrent connections'],
        cons: ['Gateway tier becomes stateful, complicating deploys/scale-down', 'Registry becomes a critical-path dependency for every delivery', 'Requires heartbeats/TTL to avoid stale routing entries'],
        usedBy: 'WhatsApp, iMessage, Slack, Discord',
      },
    ],
    whereThisFits: [
      { layer: 'Connection Tier', blocks: 'Holding persistent sockets and presence state', key: 'User/device ID -> gateway instance', example: '100M+ sockets spread across thousands of stateful gateway servers' },
      { layer: 'Routing (Connection Registry)', blocks: 'Locating a recipient before every delivery', key: 'User ID -> gateway address', example: 'Redis lookup on the critical path of every cross-server send' },
      { layer: 'Durability (Message Log)', blocks: 'Ordered, durable per-conversation storage', key: 'Conversation ID + sequence number', example: 'Append-only log, Kafka-partition-style ordering guarantee' },
      { layer: 'Delivery (Offline Queue + Push)', blocks: 'Reaching disconnected recipients', key: 'Per-user offline queue', example: 'APNs/FCM wake trigger when the recipient has no open socket' },
    ],
    deepDive: [
      {
        title: 'Locating a recipient across a sharded connection fleet',
        body: 'With connections spread across thousands of stateful gateway servers, any server that needs to deliver a message to an arbitrary user must first resolve "which gateway server currently holds this user\'s socket." A distributed registry (Redis or a custom in-memory service) keyed by user ID, storing the gateway server address and connection ID, answers this in a single lookup. The registry entry is written on connect, deleted on disconnect, and given a heartbeat-refreshed TTL so a crashed gateway that never sent a clean disconnect doesn\'t leave a stale, misleading entry pointing recipients at a dead server. This registry becomes a critical-path dependency for every message send, so it\'s typically deployed as its own highly available, sharded cluster distinct from the message-store database.',
        diagram: `flowchart LR
  gw1[Gateway Server 1]:::compute
  gw2[Gateway Server 2]:::compute
  gwN[Gateway Server N]:::compute
  registry[("Connection Registry (Redis)")]:::cache

  gw1 -->|"on connect: SET userId -> gw1"| registry
  gw2 -->|"on connect: SET userId -> gw2"| registry
  gwN -->|"heartbeat refresh TTL"| registry
  gw1 -->|"lookup recipient's gateway"| registry`,
      },
      {
        title: 'Guaranteeing ordering and at-least-once delivery',
        body: 'Messages within one conversation must arrive in a consistent order even though sender and recipient may be attached to different gateway servers and the network can reorder or duplicate packets. The standard approach assigns each message a monotonically increasing sequence number scoped to the conversation (not globally), generated at write time to the durable log, so recipients can detect gaps and reorder locally even if delivery arrives out of order. At-least-once delivery means the server retains a message in the offline/pending queue until it receives an explicit application-level ack from the recipient client (not just a TCP ack, which only confirms the socket layer, not that the client processed it) — this necessarily means clients must deduplicate by message ID, since retries after a missed ack can and will deliver the same message twice.'
      },
      {
        title: 'Multi-device sync without a single source of truth device',
        body: 'A user reading messages on both a phone and a laptop needs delivery and read-state to converge across devices without either being the sole authority. The common design treats the server-side message store as the durable source of truth and each device as a client that syncs against it, tracking its own last-synced sequence number per conversation; sending a message from any device writes to the same conversation log, and reading on any device propagates a read-receipt event that all other devices consume to update their local read markers. For end-to-end encrypted systems this is considerably harder because each device typically holds distinct encryption keys, requiring either per-device message re-encryption on send (sender encrypts the same message separately for each of the recipient\'s registered devices) or a device-linking protocol that shares session keys across a user\'s own devices — WhatsApp\'s and Signal\'s multi-device designs both had to solve this non-trivial key-fanout problem explicitly.'
      },
      {
        title: 'Efficient group chat fan-out at scale',
        body: 'A message to a 250-person group must be durably delivered to 250 distinct recipients without making the sender wait for all 250 deliveries or serializing them through one bottlenecked worker. The practical approach decouples the sender\'s acknowledgment (which only requires the message to be durably written to the group\'s log) from the fan-out (an asynchronous job that reads the group membership list and enqueues one per-recipient delivery task, parallelized across workers). This bounds sender-perceived latency to the write-log-and-ack step regardless of group size, while delivery to individual members completes on its own time, gated only by whether each member is online now or needs offline queuing.'
      }
    ],
    tradeoffs: [
      {
        title: 'End-to-end encryption vs. server-side features',
        body: 'End-to-end encryption means the server cannot read message content, which precludes server-side search, spam/abuse content scanning, and rich link-preview generation without client cooperation — features that are trivial to build when the server holds plaintext. Products that ship E2E encryption (WhatsApp, iMessage, Signal) accept this feature ceiling as the cost of a genuine privacy guarantee, while products prioritizing content moderation or server-side search (many enterprise chat tools) either skip E2E entirely or apply it only selectively.'
      },
      {
        title: 'Stateful connection servers vs. stateless horizontal scaling',
        body: 'Persistent WebSocket connections inherently make the gateway tier stateful — a given user\'s socket lives on one specific server, unlike a stateless HTTP API server that can be freely load-balanced per request. This makes deployments and scale-down operations harder (draining connections gracefully rather than just killing a pod) and requires the connection-registry lookup on every cross-server delivery, adding a dependency and a hop that a stateless architecture wouldn\'t need. The alternative — short-lived polling instead of persistent connections — would be simpler to scale but cannot deliver sub-200ms push latency, which is a hard product requirement for chat.'
      },
      {
        title: 'Global sequence numbers vs. per-conversation sequence numbers',
        body: 'A single global message-sequence counter would make cross-conversation ordering trivial but creates a severe write bottleneck and a single point of contention across the entire system\'s message volume. Scoping sequence numbers per conversation removes that bottleneck (each conversation\'s counter is independent and can live on whichever shard holds that conversation) at the cost of losing any meaningful way to globally order messages across different conversations — an acceptable loss, since no chat product actually needs global cross-conversation ordering.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Connection Registry Goes Down?',
      body: "The connection registry is the single lookup every cross-server delivery depends on, so its unavailability means no gateway can determine where a recipient's socket currently lives. The safe degradation path is to fail closed on routing but not on durability: every in-flight send still gets durably appended to the per-conversation message log, and instead of attempting a live push, the system treats every recipient as if they were offline, routing messages into the offline queue for later delivery. This trades real-time delivery latency for zero message loss — a chat product's users tolerate a delayed message far better than a lost one — and once the registry recovers, queued messages drain through the normal offline-delivery path. Because the registry is deployed as its own highly available, sharded cluster distinct from the message store, a registry outage is decoupled from message durability by design, not by luck.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/conversations/{conversationId}/messages',
        description: "Send a message; server assigns a per-conversation sequence number and persists before acking.",
        example: '// Request\n{ "ciphertext": "base64...", "clientMessageId": "cm_881a" }\n\n// Response 201\n{ "messageId": "m_9931", "seq": 4821 }',
      },
      {
        method: 'GET',
        path: '/v1/conversations/{conversationId}/messages?before={seq}&limit=50',
        description: 'Page through message history in a conversation, ordered by sequence number.',
        example: '// Response 200\n{ "messages": [ { "messageId": "m_9930", "seq": 4820 } ] }',
      },
      {
        method: 'WS',
        path: '/v1/stream',
        description: 'Persistent connection for real-time message delivery, presence, and typing indicators.',
        example: '// Server push\n{ "type": "message", "conversationId": "c_12", "seq": 4821, "ciphertext": "..." }',
      },
      {
        method: 'POST',
        path: '/v1/conversations/{conversationId}/messages/{messageId}/receipts',
        description: 'Report delivered/read state for a message, propagated to the sender and other devices.',
        example: '// Request\n{ "status": "read" }\n\n// Response 204 No Content',
      },
      {
        method: 'GET',
        path: '/v1/presence/{userId}',
        description: "Fetch a user's current online/last-seen presence from the ephemeral presence store.",
        example: '// Response 200\n{ "userId": "u_44", "online": false, "lastSeen": "2026-07-16T09:58:00Z" }',
      },
    ],
    keyTechnologies: [
      { term: 'Connection Registry', definition: "A distributed cache mapping user ID to the specific gateway server/connection currently holding that user's socket." },
      { term: 'Per-Conversation Sequence Number', definition: 'A monotonically increasing counter scoped to one conversation, used to detect gaps and preserve ordering without a global bottleneck.' },
      { term: 'Double Ratchet', definition: 'The Signal-style key-exchange protocol that continuously rotates encryption keys per message, giving forward secrecy for end-to-end encrypted chat.' },
      { term: 'Offline Queue', definition: "A per-user durable queue holding messages for a currently-disconnected recipient until they reconnect or a push notification wakes them." },
      { term: 'Read Receipt State Machine', definition: 'The sent -> delivered -> read progression tracked per message per recipient, propagated as low-priority events separate from the message itself.' },
      { term: 'Sticky Connection Routing', definition: 'Load balancer behavior that pins a long-lived WebSocket to a specific backend gateway instance for the life of the connection.' },
    ],
    selfAudit: [
      {
        question: 'What happens if a gateway server crashes while it still holds thousands of open connections?',
        answer: 'The registry entries for those users expire via TTL once heartbeats stop, clients detect the dropped socket and reconnect to a healthy gateway through the load balancer, and any messages addressed to them in the interim are queued in the offline path rather than lost.',
      },
      {
        question: 'How do you handle sending a message to a 250-person group where 50 recipients are currently offline?',
        answer: "The sender is acked as soon as the message is durably written to the group's log; a separate fan-out job enqueues one delivery task per member, and the 50 offline members simply get their tasks routed into the offline queue instead of a live socket, with no impact on the other 200 real-time deliveries.",
      },
      {
        question: 'How does multi-device sync behave if a user reads a message on their phone while composing a reply on their laptop?',
        answer: "The read event is written against the server-side message log and published to all of that user's registered devices, so the laptop's read marker updates via the same sync channel — no device is authoritative, they all converge against the shared log.",
      },
      {
        question: 'What happens if the connection registry itself becomes temporarily unavailable?',
        answer: "In-flight sends can't resolve recipient location, so the system degrades to queuing everything as if recipients were offline (guaranteeing no message loss) until the registry recovers, trading real-time delivery for continued durability during the outage.",
      },
      {
        question: 'How do you prevent duplicate delivery when a client reconnects mid-send after a network blip?',
        answer: 'Every message carries a stable message ID from creation; clients dedupe on that ID regardless of how many times it\'s redelivered by the at-least-once pipeline, so a reconnect-triggered retry is visually a no-op rather than a duplicate message.',
      },
    ],
    cheatSheet: [
      { question: 'Which transport?', answer: 'Persistent WebSocket/TCP, not polling — polling cannot hit sub-200ms push latency.' },
      { question: 'Where does connection state live?', answer: "A connection registry (Redis) mapping user ID to the gateway holding that user's socket." },
      { question: 'How to make delivery ordered?', answer: 'Per-conversation monotonic sequence numbers assigned at write time to the durable log.' },
      { question: 'What if the registry is down?', answer: 'Degrade to treating everyone as offline — queue everything, lose nothing, deliver late.' },
      { question: 'How is it layered?', answer: 'Gateway (connections) → Registry (routing) → Message log (durability) → Offline queue/push (reach disconnected).' },
      { question: 'How does it scale to hundreds of millions of connections?', answer: 'A stateful, sharded gateway fleet where each server cheaply holds tens of thousands of idle sockets.' },
      { question: 'Why does the server never see plaintext?', answer: 'End-to-end (double-ratchet) encryption is done entirely client-side, foreclosing server-side search and moderation.' },
    ],
    expectedDepth: {
      mid: 'Connect two clients through a server and understand why per-instance in-memory routing fails once there is more than one server. Propose a persistent WebSocket connection instead of polling to hit real-time delivery latency, and a basic message table for history.',
      senior: 'Design the connection registry as the routing primitive, explain per-conversation sequence numbers for ordering, and design the offline-queue + push-notification wake path for disconnected recipients. Discuss at-least-once delivery with client-side message-ID dedup.',
      staffPlus: "Design multi-device sync without a single authoritative device, including the E2E-encryption key-fanout problem across a user's own devices. Reason about decoupling large-group fan-out from the sender's ack, and the operational cost of a stateful connection tier (graceful draining on deploy vs. stateless HTTP scaling). Address registry outages and connection-fleet rebalancing during regional failover.",
    },
    keyTakeaways: [
      'The hard problem is routing, not messaging — everything starts from "which gateway holds this socket right now"',
      'Per-conversation sequence numbers avoid a global bottleneck while preserving the only ordering guarantee that actually matters',
      'At-least-once delivery plus client-side idempotent dedup beats trying to engineer exactly-once delivery server-side',
      'End-to-end encryption is a feature ceiling, not a free add-on — it forecloses server-side search and content moderation',
    ],
    relatedDesigns: ['notification-system', 'collaborative-editing', 'social-feed'],
  },
  {
    slug: 'notification-system',
    title: 'Notification System',
    difficulty: 'Intermediate',
    icon: 'pi pi-bell',
    color: '#f59e0b',
    concepts: ['Multi-channel fan-out (push/email/SMS)', 'Priority queueing', 'Idempotency & deduplication', 'Rate limiting & user preferences', 'Third-party provider abstraction'],
    companies: ['Uber', 'Amazon', 'Netflix', 'LinkedIn'],
    summary: 'A backend service that reliably delivers push, email, and SMS notifications on behalf of many internal producers, handling provider failover, throttling, and user preferences.',
    tldr: 'The load-bearing decision is decoupling ingestion from delivery with a durable queue and a worker pool behind it — that single seam is what lets the system absorb 10x traffic bursts, prioritize OTPs over marketing blasts, and fail over providers, all without ever back-pressuring the calling service.',
    problemFraming: "It's tempting to let each internal service just call APNs, SendGrid, or Twilio directly when it needs to notify a user — but at the scale of a platform like Uber or Netflix, dozens of producer services would each need to reinvent user preferences, provider rate-limit handling, retries, and deduplication, and a promotional campaign kicking off to 50M users at once would blow straight through provider-imposed sending caps and get the account throttled or suspended. Worse, with no shared priority mechanism, a marketing blast fired by one service can starve a password-reset SMS fired by another, even though the two have wildly different latency requirements. The problem isn't sending a notification — that's one API call — it's absorbing bursty, multi-tenant producer traffic while still guaranteeing that security-critical messages get through fast and duplicate sends don't pile up.",
    priorArt: [
      { title: 'Netflix Hystrix (circuit breaker pattern)', description: 'The circuit-breaker-triggered failover to a secondary provider described here is a direct application of Hystrix-style failure isolation, stopping cascading failures when one push/email/SMS provider degrades.' },
      { title: 'Idempotency keys (Stripe API design)', description: 'Stripe popularized idempotency-key request deduplication for payment APIs; the same pattern prevents a retried producer call from double-sending a notification.' },
      { title: 'Dead-letter queues (Amazon SQS)', description: "The retry-with-backoff-then-DLQ pattern for permanently failing sends (invalid token, unsubscribed number) mirrors SQS's standard DLQ mechanism for poison messages." },
      { title: 'Priority queue lanes (e.g. RabbitMQ priority queues / separate Kafka topics per tier)', description: 'Separating OTP/security traffic from bulk marketing traffic into distinct priority lanes is the same technique used in message-broker priority queueing to prevent low-priority floods from starving urgent messages.' },
    ],
    coreEntities: [
      { name: 'Notification Request', description: 'A single submitted request — recipient, template ID, priority, idempotency key.' },
      { name: 'Template', description: 'A localized, channel-specific message definition with variable substitution slots.' },
      { name: 'Preference', description: 'Per-user, per-channel, per-category opt-in/opt-out and quiet-hours state.' },
      { name: 'Delivery Attempt', description: 'A record of one send try against one provider, with outcome and status.' },
    ],
    requirements: {
      core: [
        'Accept notification requests from many internal services via an API',
        'Deliver notifications through push, email, and SMS channels',
        'Respect per-user notification preferences and opt-outs per channel/category',
        'Support templated messages with variable substitution and localization',
        'Deduplicate and suppress redundant notifications within a time window',
        'Provide delivery status tracking (queued, sent, delivered, failed)'
      ],
      belowTheLine: [
        'Adaptive send-time optimization (deliver when a user is most likely to engage)',
        "Per-user notification 'budget' / fatigue limiting across categories",
        'A/B testing framework for template and copy variants',
        'Self-serve delivery/engagement analytics dashboard for producer teams',
      ],
      nonFunctionalTable: [
        { metric: 'Burst absorption', target: 'Queue absorbs 10x+ average load spikes (e.g. 200K/sec bursts) without dropping' },
        { metric: 'Delivery guarantee', target: 'At-least-once with idempotency-key dedupe' },
        { metric: 'Provider failover', target: 'Automatic failover to a secondary provider after a circuit-breaker trip' },
        { metric: 'High-priority latency (OTP/security)', target: 'Low latency even during concurrent bulk marketing sends' },
        { metric: 'Rate-limit compliance', target: 'Zero provider-imposed throttling or account suspension incidents' },
      ]
    },
    capacityEstimate: 'Assume an internal platform generating 2B notifications/day across all producer services (order updates, marketing, security alerts, social activity), averaging ~23,000/sec but with batch-job spikes (e.g. a promotional campaign to 50M users kicked off at once) that can momentarily demand 200K+/sec, so the ingestion and queueing layer must absorb at least an order of magnitude above steady-state average. If the channel split is roughly 70% push, 20% email, 10% SMS, that\'s ~1.4B push notifications/day (cheap, sub-cent each), ~400M emails/day, and ~200M SMS/day — SMS at even $0.005-0.01 per message is $1M-2M/day, which is precisely why SMS is reserved for high-priority/critical notifications and gated by stricter rate limits and cost controls than push. Each notification record (recipient, channel, template ID, payload, status, timestamps) is roughly 1-2KB; at 2B/day that\'s 2-4TB/day of tracking data, so delivery-status history is typically retained only 30-90 days in hot storage and rolled off to cold storage or aggregated afterward.',
    architecture: 'Internal services (order service, marketing platform, security service, etc.) call a notification API rather than talking to push/email/SMS providers directly, submitting a request with a recipient ID, template ID, and template variables. The API server validates the request, checks it against an idempotency key (so retried producer calls don\'t double-send), and publishes it onto a message queue rather than sending synchronously — decoupling ingestion from delivery is what lets the system absorb bursty producer traffic without back-pressuring the calling service.\n\nA pool of worker consumers reads from the queue, and for each notification: looks up the recipient\'s channel preferences and opt-out status from a preferences store, resolves the template (with localization and variable substitution) from a template service, and checks it against a deduplication/suppression cache keyed on recipient+category+time-window to avoid, say, sending five nearly-identical "your order shipped" pushes within a minute due to upstream retries. Distinct queues (or distinct priority lanes within one queue, e.g. via priority-aware consumers or separate topics per priority tier) separate time-sensitive notifications like OTPs and security alerts from bulk/marketing traffic, so a marketing blast never starves a password-reset code behind it.\n\nOnce a channel is chosen, the worker hands off to a channel-specific adapter — a push adapter talking to APNs/FCM, an email adapter talking to SendGrid/SES, an SMS adapter talking to Twilio — each wrapped in a provider-abstraction layer supporting automatic failover to a secondary provider on error or rate-limit response, and each independently rate-limited to stay under provider-imposed sending caps. Delivery outcomes (success, bounce, provider error) are written to a status-tracking store and, where providers support it, delivery/read callbacks (webhooks) update that status asynchronously after the fact. A separate retry mechanism with exponential backoff and a dead-letter queue handles transient provider failures, while permanently failing sends (invalid token, unsubscribed number) are surfaced back to producers or used to auto-update the recipient\'s preference record.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  producer[Order Service]:::compute
  push[APNs/FCM]:::compute
  email[SendGrid]:::compute
  sms[Twilio]:::compute
  producer -->|"synchronous send"| push
  producer -->|"synchronous send"| email
  producer -->|"synchronous send"| sms`,
      },
      {
        title: 'Core Design: API + Queue + Preferences',
        mermaid: `flowchart LR
  producer[Internal Service]:::compute
  api[Notification API]:::edge
  dedupe[("Idempotency/Dedup Cache")]:::cache
  queue[["Notification Queue"]]:::async
  worker[Delivery Worker]:::compute
  prefs[("Preferences Store")]:::cache

  producer -->|"POST /notifications"| api
  api -->|"idempotency check"| dedupe
  api -->|"enqueue"| queue
  queue --> worker
  worker -->|"resolve preferences"| prefs`,
      },
      {
        title: 'Provider Abstraction and Failover',
        mermaid: `flowchart LR
  worker[Delivery Worker]:::compute
  adapter[Channel Adapter]:::compute
  primary[Primary Provider]:::compute
  secondary[Secondary Provider]:::compute
  status[(Delivery Status Store)]:::database

  worker --> adapter
  adapter -->|"send"| primary
  adapter -.->|"circuit breaker: failover"| secondary
  adapter -->|"record outcome"| status`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  producer[Internal Services]:::compute
  api[Notification API]:::edge
  dedupe[("Idempotency/Dedup Cache")]:::cache
  hiq[["High-Priority Queue"]]:::async
  bulkq[["Bulk Queue"]]:::async
  worker[Delivery Workers]:::compute
  prefs[("Preferences Store")]:::cache
  templates[(Template Store)]:::database
  adapter[Channel Adapter]:::compute
  push[APNs/FCM]:::compute
  email[SendGrid/SES]:::compute
  sms[Twilio]:::compute
  status[(Delivery Status Store)]:::database
  dlq[["Dead-Letter Queue"]]:::async

  producer -->|"POST /notifications"| api
  api --> dedupe
  api -->|"high priority"| hiq
  api -->|"bulk/marketing"| bulkq
  hiq --> worker
  bulkq --> worker
  worker --> prefs
  worker --> templates
  worker --> adapter
  adapter --> push
  adapter --> email
  adapter --> sms
  adapter --> status
  adapter -.->|"exhausted retries"| dlq`,
      },
      {
        title: 'Idempotent Send With Preference Check (Sequence)',
        mermaid: `sequenceDiagram
  participant S as Producer Service
  participant API as Notification API
  participant Q as Queue
  participant W as Delivery Worker
  participant Pr as Preferences Store
  participant P as Push Provider

  S->>API: POST /notifications (idempotencyKey)
  API->>API: check dedup cache
  API-->>S: 202 Accepted
  API->>Q: enqueue
  Q->>W: consume
  W->>Pr: check opt-in/opt-out
  alt opted in
    W->>P: send(payload)
    P-->>W: success
    W->>W: mark delivered, update status store
  else opted out
    W->>W: suppress, mark skipped
  end`,
      },
    ],
    approaches: [
      {
        name: 'Synchronous Direct Provider Calls',
        description: 'Each producer service calls APNs/SendGrid/Twilio directly at the moment it needs to notify a user.',
        pros: ['No shared infrastructure to build or operate', 'Simplest possible mental model for a single producer'],
        cons: ['Every producer reinvents preferences, retries, and rate limiting', 'A burst from one producer can blow through provider-imposed sending caps', 'No shared priority — a marketing blast can starve a security OTP'],
      },
      {
        name: 'Single Undifferentiated Queue',
        description: 'All producers enqueue onto one shared queue consumed by a generic worker pool, decoupling ingestion from delivery but without priority separation.',
        pros: ['Solves burst absorption and back-pressure on producers', 'Simpler to operate than multiple lanes'],
        cons: ['A large low-priority backlog (bulk marketing) can still delay high-priority sends behind it', 'No resource-level isolation between tenants/priorities'],
      },
      {
        name: 'Priority-Lane Queue with Provider Abstraction',
        description: 'Separate queues (or dequeue priorities) per priority tier, each with dedicated worker pools and rate-limit budgets, feeding a common channel-adapter layer with per-provider circuit breakers.',
        pros: ['High-priority sends are never starved by bulk traffic', 'Provider outages fail over automatically via circuit breaker', 'Rate-limit budgets are enforced per channel, protecting provider accounts'],
        cons: ['More infrastructure and operational surface area (multiple queues, adapters, breakers)', 'Requires upfront tiering decisions (which traffic is "high priority")'],
        usedBy: 'Uber, Amazon, Netflix, LinkedIn-scale internal notification platforms',
      },
    ],
    whereThisFits: [
      { layer: 'Ingestion', blocks: 'API validation and idempotency', key: 'Idempotency key', example: 'POST /notifications checked against dedup cache before enqueueing' },
      { layer: 'Queueing', blocks: 'Burst absorption and priority isolation', key: 'Priority tier -> dedicated lane', example: 'OTP lane with dedicated workers, separate from the bulk marketing lane' },
      { layer: 'Delivery', blocks: 'Preference resolution, templating, provider dispatch', key: 'Channel adapter per provider', example: 'Push via APNs/FCM, failing over to a secondary on circuit-breaker trip' },
      { layer: 'Tracking', blocks: 'Delivery status and outcome recording', key: 'Notification ID', example: 'Status store updated by provider webhooks (delivered/bounced/failed)' },
    ],
    deepDive: [
      {
        title: 'Idempotency across an at-least-once pipeline',
        body: 'Every hop in this pipeline — the producer\'s HTTP retry, the queue\'s at-least-once redelivery semantics, the worker\'s own retry-on-failure logic — can cause the same logical notification to be processed more than once. The fix is layering idempotency keys throughout: producers supply a client-generated idempotency key (often a hash of recipient + template + a producer-side business event ID) that the API deduplicates against before enqueueing, and downstream, the actual send operation to the provider is guarded by a separate check against a short-TTL "already sent" cache keyed by that same identifier. Without this, a worker crash-and-retry after successfully calling the push provider but before acking the queue message would silently double-send — a real failure mode, not a theoretical one, in any at-least-once queue-backed pipeline.'
      },
      {
        title: 'Priority lanes and starvation prevention',
        body: 'Mixing a security OTP and a marketing campaign in the same undifferentiated queue means a sudden 50M-notification marketing blast can delay a time-critical OTP by minutes, which is a real usability and security failure. The fix is either separate queues per priority tier with dedicated worker pools sized so high-priority lanes are never resource-starved by low-priority backlog, or a single queue with priority-aware dequeuing plus strict concurrency caps on low-priority consumers. The key design decision is that priority must be enforced at the resource level (dedicated workers, dedicated rate-limit budget) rather than just a sort order in a shared queue, since a shared queue with unbounded low-priority producers can still saturate downstream provider rate limits that high-priority traffic also depends on.',
        diagram: `flowchart LR
  otp[OTP / Security Alert]:::compute
  marketing[Marketing Campaign]:::compute
  hiq[["High-Priority Queue"]]:::async
  bulkq[["Bulk Queue"]]:::async
  hiworkers[Dedicated High-Priority Workers]:::compute
  bulkworkers[Rate-Capped Bulk Workers]:::compute
  provider[Provider]:::compute

  otp --> hiq --> hiworkers --> provider
  marketing --> bulkq --> bulkworkers --> provider`,
      },
      {
        title: 'Provider abstraction and cross-provider failover',
        body: 'Third-party push/email/SMS providers have outages, and a system with no failover path simply stops delivering that channel during one. The channel adapter layer defines a common internal interface (send(recipient, payload) -> status) implemented separately per provider, with a circuit breaker per provider that trips after a threshold of consecutive failures or elevated error rate, routing subsequent sends to a configured secondary provider (e.g. SendGrid failing over to SES, or one SMS aggregator failing over to another). This adds real complexity — template formats, delivery-status semantics, and rate-limit rules differ per provider, so the abstraction layer has to normalize all of that — but it is the only way to keep a stated SLA when providers are external dependencies with their own uptime you don\'t control.'
      },
      {
        title: 'User preference resolution and consent enforcement',
        body: 'Notification preferences aren\'t a single opt-in/opt-out flag; they\'re a matrix of channel x category x quiet-hours x locale that must be resolved correctly before every single send, and getting this wrong is a compliance problem (CAN-SPAM, TCPA for SMS, GDPR) as much as a UX one. The preference store needs to be read on the hot path for every notification, which makes it latency-sensitive at the same throughput as the whole pipeline — commonly solved with a heavily cached preferences read-through layer, refreshed on write with cache invalidation, since preferences change far less often than notifications are sent. Category-level granularity (e.g. "order updates" vs. "promotions") matters because regulators and users alike distinguish transactional notifications, which often can\'t be opted out of, from marketing ones, which legally must support opt-out.'
      }
    ],
    tradeoffs: [
      {
        title: 'Decoupled async delivery vs. synchronous delivery guarantees',
        body: 'Queueing every notification for asynchronous delivery protects producers from being blocked or failing when the notification pipeline is under load, and lets the system smooth out bursty traffic — but it means a producer that calls the API gets an "accepted" response, not a "delivered" response, so any producer that needs a hard delivery guarantee before proceeding (rare, but real for some OTP flows) must poll or subscribe to a separate status callback rather than relying on the initial API response. Most notification volume doesn\'t need that guarantee, which is why async-by-default with an opt-in synchronous/status-polling path for the minority that do is the common design.'
      },
      {
        title: 'Aggressive deduplication vs. suppressing legitimate repeats',
        body: 'A tight deduplication window catches noisy upstream retries and prevents spammy duplicate notifications, but too aggressive a window (or too coarse a dedup key) can accidentally suppress two genuinely distinct notifications that happen to share a template and recipient within a short window — e.g. two separate orders shipping minutes apart. This is why dedup keys typically include a producer-supplied event ID rather than just recipient+template, trading a small amount of engineering overhead on the producer side for correctness on distinguishing "retry of the same event" from "two different events that look similar."'
      },
      {
        title: 'Channel cost vs. reliability and urgency',
        body: 'SMS is dramatically more expensive per message than push notifications and has meaningfully higher deliverability for urgent use cases (it doesn\'t depend on the recipient having the app installed, network-reachable push tokens, or notification permissions granted), while push is nearly free but silently fails for uninstalled apps, expired tokens, or disabled permissions. Systems handle this by tiering channel selection to urgency and cost tolerance — OTPs and security alerts justify SMS\'s cost because failed delivery has real consequences, while routine engagement notifications stay on push, with email as the low-cost, best-effort middle tier for anything non-urgent.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Notification Queue Is Unavailable?',
      body: "The queue is the seam that decouples every producer from delivery, so its unavailability means the API can no longer accept new requests durably. The API returns an error to producers rather than silently dropping requests, and producers retry with backoff — safe because every request already carries an idempotency key, so a retried submission after a transient queue blip cannot become a duplicate send once the queue recovers. For the highest-priority tier (OTPs, security alerts), some systems configure a synchronous direct-send bypass straight to the provider that skips the queue entirely during an outage, accepting the loss of dedup/preference-checking rigor for that narrow, latency-critical case rather than let account security notifications go undelivered. Bulk/marketing traffic has no such bypass — it simply waits, since a delayed promotional notification has no real cost.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/notifications',
        description: 'Submit a notification request with recipient, template ID, and variables. Requires an idempotency key.',
        example: '// Request\n{ "recipientId": "u_5521", "templateId": "order_shipped", "vars": { "orderId": "o_881" }, "priority": "high", "idempotencyKey": "evt_a91c" }\n\n// Response 202 Accepted\n{ "notificationId": "n_7712" }',
      },
      {
        method: 'GET',
        path: '/v1/notifications/{notificationId}/status',
        description: 'Query delivery status history for a submitted notification.',
        example: '// Response 200\n{ "status": "delivered", "channel": "push", "attempts": 1 }',
      },
      {
        method: 'PUT',
        path: '/v1/users/{userId}/preferences',
        description: 'Update per-channel, per-category notification preferences and opt-outs.',
        example: '// Request\n{ "category": "promotions", "channel": "sms", "optedIn": false }\n\n// Response 204 No Content',
      },
      {
        method: 'POST',
        path: '/v1/notifications/batch',
        description: 'Submit a bulk batch of notifications (e.g. a marketing campaign), routed to the bulk priority lane.',
        example: '// Request\n{ "templateId": "promo_summer", "recipients": ["u_1","u_2","u_3"] }\n\n// Response 202 Accepted\n{ "batchId": "b_331", "accepted": 3 }',
      },
      {
        method: 'POST',
        path: '/v1/webhooks/provider-callback',
        description: 'Inbound webhook used by providers (SendGrid, Twilio) to report async delivery/bounce/failure status.',
        example: '// Request\n{ "provider": "sendgrid", "notificationId": "n_7712", "event": "delivered" }',
      },
    ],
    keyTechnologies: [
      { term: 'Idempotency Key', definition: 'A client-supplied unique identifier that the pipeline deduplicates against at every hop to prevent double-sends on retry.' },
      { term: 'Priority Queue Lanes', definition: 'Separate queues (or dequeue priorities) with dedicated worker pools so low-priority bulk traffic can never starve time-sensitive sends.' },
      { term: 'Circuit Breaker', definition: 'A per-provider failure detector that trips after a threshold of errors, routing subsequent sends to a secondary provider automatically.' },
      { term: 'Template Engine', definition: 'The service resolving a template ID plus variables into a localized, channel-specific rendered message body.' },
      { term: 'Dead-Letter Queue', definition: 'A holding queue for notifications that exhausted all retries, preserved with failure metadata for investigation rather than silently dropped.' },
      { term: 'Provider Abstraction Layer', definition: 'A common internal send() interface implemented per external provider, normalizing differing APIs, rate limits, and status semantics.' },
    ],
    selfAudit: [
      {
        question: 'What happens when a producer service accidentally calls the notification API in a retry loop, submitting the same event 100 times?',
        answer: "The idempotency key (derived from the producer's business event ID) is checked at the API layer before enqueueing, so the first call is processed and the other 99 are recognized as duplicates and short-circuited without a second send.",
      },
      {
        question: 'How do you prevent a 50M-notification marketing blast from delaying a password-reset OTP?',
        answer: "The OTP is enqueued onto a dedicated high-priority lane with its own worker pool and rate-limit budget, isolated by resource allocation, not just queue ordering, so the marketing blast saturating the bulk lane has no path to starve the OTP's dedicated capacity.",
      },
      {
        question: 'What happens if your primary SMS provider goes down mid-campaign?',
        answer: "The channel adapter's circuit breaker trips after a threshold of consecutive failures and automatically routes subsequent sends to the configured secondary SMS provider, with the outage surfaced via status/monitoring rather than blocking the queue.",
      },
      {
        question: 'How do you handle a user changing their notification preferences while related notifications are already queued?',
        answer: 'Preference checks happen at send time (worker reads the current preference state just before dispatch), not at enqueue time, so an opt-out that lands before a queued notification is processed correctly suppresses it rather than relying on a stale snapshot.',
      },
      {
        question: "How do you avoid exceeding a provider's account-level rate limit and getting the account suspended?",
        answer: "Each channel adapter enforces its own token-bucket-style rate limit tuned below the provider's documented cap, and the priority-lane worker pools are sized so aggregate throughput across all lanes never exceeds that shared budget, even during simultaneous high- and low-priority bursts.",
      },
    ],
    cheatSheet: [
      { question: 'Which architecture?', answer: 'Decouple ingestion from delivery via a durable queue plus a worker pool — never call providers synchronously.' },
      { question: 'Where does state live?', answer: 'A cached preferences store on the hot path, plus an append-heavy delivery-status store off it.' },
      { question: 'How to make sends idempotent?', answer: 'An idempotency key checked at the API layer, and again just before provider dispatch.' },
      { question: 'What if the queue goes down?', answer: 'Producers retry with backoff (safe due to idempotency keys); OTP tier may have a direct-send bypass.' },
      { question: 'How is it layered?', answer: 'Ingestion → priority-lane queue → preference/template resolution → channel adapter → provider.' },
      { question: 'How does it prevent starvation at scale?', answer: 'Dedicated worker pools and rate-limit budgets per priority lane, not just sort order in a shared queue.' },
      { question: 'How does provider failover work?', answer: 'A per-provider circuit breaker trips on sustained errors and reroutes sends to a secondary provider automatically.' },
    ],
    expectedDepth: {
      mid: 'Propose an API plus a queue instead of every producer calling providers directly, and explain why per-producer duplicated send logic (retries, preferences, rate limits) is a maintenance and reliability problem. Know that push/email/SMS require different provider integrations.',
      senior: 'Design end-to-end idempotency keys, priority lanes with dedicated worker pools, and a provider-abstraction layer with circuit-breaker failover. Explain why preference checks must happen at send time, not enqueue time, and why dedup keys need a producer-supplied event ID rather than just recipient+template.',
      staffPlus: 'Reason about cost-aware channel selection (SMS cost vs. push deliverability) at platform scale, compliance-driven preference matrices (TCPA/GDPR/CAN-SPAM), dead-letter handling and reconciliation for permanently failing sends, and how a multi-tenant producer platform prevents one internal team\'s traffic from exhausting a shared provider rate-limit budget.',
    },
    keyTakeaways: [
      'Decoupling ingestion from delivery via a queue is the one design decision that makes everything else possible',
      'Priority must be enforced with dedicated resources (workers, rate-limit budget), not just queue ordering',
      'Idempotency has to be layered at every hop of an at-least-once pipeline, not bolted on once at the API',
      'Channel choice is a cost/reliability trade, not a preference — SMS buys deliverability, push buys near-zero cost',
    ],
    relatedDesigns: ['chat-system', 'social-feed', 'rate-limiter'],
  },
  {
    slug: 'photo-sharing',
    title: 'Photo Sharing (Instagram / Pinterest)',
    difficulty: 'Intermediate',
    icon: 'pi pi-image',
    color: '#ec4899',
    concepts: ['Object storage & CDN distribution', 'Image processing pipeline', 'Feed generation & fan-out', 'Multi-resolution transcoding', 'Metadata database sharding'],
    companies: ['Instagram (Meta)', 'Pinterest', 'Google Photos', 'Snapchat'],
    summary: 'A media-centric platform for uploading, processing, and serving photos at global scale, where the design center of gravity is efficient storage, transcoding, and CDN delivery rather than the metadata itself.',
    tldr: 'The system deliberately splits into two independent pipelines with almost nothing in common — a "pixels" pipeline (object storage, async transcoding, CDN edge delivery) and a "metadata" pipeline (feed generation, likes, comments) — because forcing image bytes and social metadata through the same storage and caching tier is what makes naive designs fall over.',
    problemFraming: "It's easy to model this as \"store an image, show it in a feed,\" but Instagram- or Pinterest-scale photo sharing has to handle a read:write ratio above 100:1 on multi-megabyte objects, not small rows — a single popular photo might be viewed millions of times while being written once. The naive approach of storing image bytes as database blobs and serving them straight from application servers falls apart almost immediately: the database bloats with unindexable binary data, application servers become bandwidth-bound serving pixels instead of business logic, and every viewer worldwide hits the same origin regardless of geography, guaranteeing terrible latency at global scale. Add the requirement to generate multiple derivative resolutions per upload without blocking the uploader, plus content moderation before an image is even eligible to show up in someone's feed, and the real problem becomes orchestrating an asynchronous processing pipeline that's fully decoupled from both the upload acknowledgment and the CDN-backed read path.",
    priorArt: [
      { title: 'Facebook Haystack', description: 'Meta\'s purpose-built object storage system for photos, designed to minimize per-photo filesystem metadata overhead at billions-of-objects scale — the direct ancestor of the "write once to a durable object store, never touch it from the app tier again" pattern used here.' },
      { title: 'CDN edge caching (CloudFront/Akamai/Fastly)', description: 'Standard practice of pulling from and caching origin object-store derivatives at edge locations, which is why the design routes essentially all read traffic away from origin infrastructure entirely.' },
      { title: 'WebP/AVIF adoption for image compression', description: 'The industry shift to next-gen codecs over JPEG, cited in the capacity estimate as a lever for reducing the ~200PB/year storage growth without changing the architecture.' },
      { title: 'Staged visibility / eventual-consistency publishing (common in async media pipelines)', description: 'The pattern of only marking content "ready" after derivative generation and moderation complete, so nothing partially-processed is ever exposed to viewers — analogous to how video platforms gate playback until transcoding finishes.' },
    ],
    coreEntities: [
      { name: 'Original Asset', description: 'The immutable uploaded file stored once in object storage; the app tier never touches it again.' },
      { name: 'Derivative', description: 'A generated resolution/format variant (thumbnail, feed, full-res) served from the CDN.' },
      { name: 'Processing Job', description: 'The async unit of work (transcode + moderate) that gates a post reaching feed-eligible status.' },
      { name: 'Metadata Record', description: 'The sharded row tracking owner, caption, tags, and processing status, decoupled from the pixels.' },
    ],
    requirements: {
      core: [
        'Users can upload photos (and short videos) with captions and tags',
        'Generate multiple resolutions/thumbnails of each photo for different display contexts',
        'Users can follow others and view a feed of recent posts from followed accounts',
        'Support likes, comments, and saves on posts',
        'Serve images quickly regardless of the viewer\'s geographic location',
        'Support basic content moderation on uploaded media'
      ],
      belowTheLine: [
        'Visual-similarity search and an explore/discovery feed',
        'Ephemeral stories content with automatic expiry',
        'Creator monetization and reach/impressions analytics',
        'Client-side filters and editing applied pre-upload',
      ],
      nonFunctionalTable: [
        { metric: 'Read:write ratio', target: '> 100:1 photo views to uploads' },
        { metric: 'Image load latency (global)', target: 'Served from CDN edge; sub-100ms typical' },
        { metric: 'Durability of originals', target: 'Multi-region replicated; effectively zero data loss' },
        { metric: 'Upload acknowledgment latency', target: 'Ack returned before transcoding/moderation completes' },
        { metric: 'Storage scale', target: 'Exabyte-scale with tiered hot/cold storage' },
      ]
    },
    capacityEstimate: 'Assume 500M daily active users, 100M new photos uploaded per day, and each photo viewed an average of 100 times across its lifetime feed exposure — that\'s roughly 10B photo views/day (~115,000 reads/sec average, several times that at peak), a read-to-write ratio above 100:1 that justifies CDN-first architecture. A single original upload averages 2-3MB; at 100M uploads/day that\'s 200-300TB/day of new original content. Each original is transcoded into several derivative sizes (thumbnail ~10KB, feed-resolution ~200KB, full-resolution ~1-2MB), roughly doubling total stored bytes per photo to ~5-6MB including all derivatives, so total new storage is closer to 500-600TB/day, or ~180-220PB/year before any deduplication or compression optimization — which is why platforms at this scale invest heavily in aggressive compression (e.g. WebP/AVIF over JPEG) and tiered storage (hot object storage for recent/popular photos, cheaper cold storage for old, rarely-viewed originals).',
    architecture: 'A client uploads a photo to an upload service via a pre-signed URL or direct multipart upload, writing the original file straight into a durable object store (S3 or equivalent) rather than routing raw bytes through application servers, which keeps the app tier stateless and avoids bottlenecking uploads on business logic. The upload service records a metadata row (owner, caption, tags, original object key, upload timestamp, processing status) into a sharded relational or document database, then publishes an event onto a queue to trigger asynchronous processing — the client receives an upload acknowledgment immediately rather than waiting for transcoding to finish, since generating multiple derivative resolutions can take seconds and shouldn\'t block the UI.\n\nAn image-processing pipeline, consuming from that queue, generates the required derivative sizes (thumbnail, feed, full-resolution), strips EXIF data for privacy, runs automated content-moderation classifiers (nudity/violence/spam detection models) against the image, and writes each derivative back to object storage under a predictable key scheme, then updates the metadata row\'s processing status to "ready." Only once derivatives exist does the photo become eligible to appear in feeds or search — this staged-visibility approach avoids ever serving a broken or unprocessed image to viewers.\n\nOn the read side, the feed-generation service works much like a social-feed system: a follower-graph lookup plus a fan-out or pull-based timeline assembly produces a list of post IDs, which are hydrated with metadata from a cache-fronted metadata store. The actual image bytes, however, are never served by the application tier at all — clients fetch images directly from a CDN, which pulls from and caches the object store\'s derivative files at edge locations close to the viewer, so the overwhelming majority of the read traffic (billions of image loads/day) never touches origin infrastructure beyond the initial cache-miss fetch. Likes, comments, and saves follow the same asynchronous-counter and event patterns common to social systems, decoupled from the image-serving hot path entirely, since a photo\'s pixels and a photo\'s engagement metadata have fundamentally different access patterns and don\'t belong in the same storage or caching tier.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  server[App Server]:::compute
  db[(Photos Table w/ BLOB)]:::database

  client -->|"POST /upload (raw bytes)"| server
  server -->|"INSERT photo blob"| db
  client -->|"GET /photos/{id}"| server
  server -->|"SELECT blob"| db`,
      },
      {
        title: 'Core Design: Object Storage + Async Transcoding',
        mermaid: `flowchart LR
  client[Client]:::client
  upload[Upload Service]:::compute
  s3[("Object Storage")]:::storage
  metadb[(Metadata Store)]:::database
  queue[["Processing Queue"]]:::async
  worker[Transcoding Worker]:::compute

  client -->|"pre-signed URL upload"| s3
  client -->|"register metadata"| upload
  upload -->|"write row status=pending"| metadb
  upload -->|"publish event"| queue
  queue --> worker
  worker -->|"read original"| s3
  worker -->|"write derivatives"| s3
  worker -->|"status=ready"| metadb`,
      },
      {
        title: 'Feed and CDN Delivery',
        mermaid: `flowchart LR
  client[Client]:::client
  cdn[["CDN"]]:::edge
  s3[("Object Storage")]:::storage
  feed[Feed Service]:::compute
  cache[("Metadata Cache")]:::cache
  metadb[(Metadata Store)]:::database
  fgraph[(Follower Graph)]:::database

  client -->|"GET /feed"| feed
  feed --> fgraph
  feed --> cache
  cache --> metadb
  client -->|"GET image bytes"| cdn
  cdn -->|"origin fetch on miss"| s3`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[API Gateway]:::edge
  upload[Upload Service]:::compute
  s3[("Object Storage")]:::storage
  metadb[(Metadata Store, sharded)]:::database
  cache[("Metadata Cache")]:::cache
  queue[["Processing Queue"]]:::async
  worker[Transcode + Moderation Worker]:::compute
  feed[Feed Service]:::compute
  fgraph[(Follower Graph)]:::database
  cdn[["CDN"]]:::edge

  client --> lb --> upload
  client -->|"pre-signed upload"| s3
  upload -->|"pending metadata"| metadb
  upload -->|"publish event"| queue --> worker
  worker --> s3
  worker -->|"status=ready"| metadb
  lb --> feed
  feed --> fgraph
  feed --> cache --> metadb
  client -->|"image bytes"| cdn --> s3`,
      },
      {
        title: 'Upload to Feed-Eligible (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant U as Upload Service
  participant S3 as Object Storage
  participant Q as Processing Queue
  participant W as Transcode/Moderation Worker
  participant M as Metadata Store

  C->>S3: upload original (pre-signed URL)
  C->>U: register upload (owner, caption, tags)
  U->>M: write row (status=pending)
  U-->>C: 201 Accepted (optimistic "uploaded")
  U->>Q: publish UploadCreated event
  Q->>W: consume event
  W->>S3: fetch original
  W->>W: generate derivatives + run moderation classifiers
  W->>S3: write derivatives
  alt moderation passes
    W->>M: status=ready (feed-eligible)
  else flagged for review
    W->>M: status=pending_review (visible only to poster)
  end`,
      },
    ],
    approaches: [
      {
        name: 'Eager Transcoding',
        description: 'Generate every derivative resolution upfront at upload time, before the post is marked feed-eligible.',
        pros: ['Every read is served by a pre-made file — consistently fast', 'No first-request latency penalty for any known size'],
        cons: ['Multiplies storage cost by the number of variants', 'Wastes compute on derivatives that may never be requested'],
      },
      {
        name: 'On-Demand Transcoding',
        description: 'Generate a given resolution only the first time it is requested, then cache the result at the CDN edge.',
        pros: ['Lower storage footprint — only pay for what is actually viewed', 'Saves upfront worker compute at upload time'],
        cons: ['Slower first request for any given size (cache-miss transcode latency)', 'Harder to bound worst-case read latency during a viral spike'],
      },
      {
        name: 'Hybrid (Eager Common Sizes + On-Demand Fallback)',
        description: 'Eagerly generate the handful of sizes known to cover the overwhelming majority of requests (thumbnail, feed, full-res), falling back to on-demand generation for anything unusual.',
        pros: ['Covers the common case with zero first-load penalty', 'Avoids eagerly paying for every conceivable device/layout size', 'CDN absorbs the rare on-demand cache-miss cost'],
        cons: ['Two code paths (eager pipeline + on-demand fallback) to build and operate', 'Requires tracking which sizes are "common enough" to eagerly generate'],
        usedBy: 'Instagram, Pinterest',
      },
    ],
    whereThisFits: [
      { layer: 'Ingestion', blocks: 'Accepting uploads without blocking on processing', key: 'Pre-signed URL + metadata row', example: 'Client uploads directly to object storage, then registers metadata separately' },
      { layer: 'Processing', blocks: 'Transcoding and moderation', key: 'Async queue + explicit state machine', example: 'pending -> processing -> ready / pending_review' },
      { layer: 'Storage', blocks: 'Durable originals plus tiered derivatives', key: 'Object storage with hot/cold tiers', example: 'Recent, popular photos in hot tier; old, rarely-viewed originals in cold storage' },
      { layer: 'Delivery', blocks: 'Global low-latency reads', key: 'CDN edge cache keyed by derivative', example: '/img/{id}/feed.webp served from the nearest edge, never touching origin' },
    ],
    deepDive: [
      {
        title: 'Asynchronous transcoding without blocking uploads',
        body: 'If a client had to wait for every derivative resolution to be generated before getting an upload confirmation, mobile upload UX would feel broken on anything but a fast connection — transcoding a handful of resolutions plus running moderation models can easily take several seconds. Decoupling this into an event-driven pipeline (upload event -> queue -> worker pool generates derivatives -> status update) lets the client show an optimistic "uploaded" state immediately while processing happens in the background, with the UI polling or subscribing to a status update for the moment the post becomes feed-eligible. The trickier design point is idempotent, resumable processing: a worker crash mid-transcode shouldn\'t either duplicate-process the image or leave it stuck in "processing" forever, which argues for a state machine per upload (pending -> processing -> ready/failed) with a timeout-triggered retry rather than a fire-and-forget job.',
        diagram: `flowchart LR
  pending[pending]:::compute
  processing[processing]:::compute
  ready[ready / feed-eligible]:::compute
  review[pending_review]:::compute
  failed[failed - retry]:::compute

  pending --> processing
  processing -->|"derivatives + moderation pass"| ready
  processing -->|"borderline confidence"| review
  processing -->|"worker crash / timeout"| failed
  failed -->|"retry"| processing
  review -->|"human approves"| ready`,
      },
      {
        title: 'Choosing derivative sizes and the storage-vs-compute trade',
        body: 'Generating and storing every plausible resolution upfront (eager transcoding) maximizes read-time speed — any client request is served by pulling a pre-made file — but multiplies storage cost by the number of variants and wastes work on derivatives that may never be requested (a niche display size, an unusual aspect ratio crop). On-demand transcoding (generating a resolution the first time it\'s requested, then caching it) saves storage and upfront compute at the cost of a slower first request for any given size. Most large platforms land on a hybrid: eagerly generate the handful of sizes known to cover the overwhelming majority of requests (thumbnail, feed-width, full-res) and fall back to on-demand generation, cached at the CDN edge, for anything unusual — since eagerly transcoding for every conceivable device pixel density and layout is not worth the storage cost relative to how rarely most of those exact sizes get requested.'
      },
      {
        title: 'CDN cache strategy and cache-key design for images',
        body: 'Serving 10B+ image views/day directly from origin storage would be both slow (cross-region latency) and prohibitively expensive in egress bandwidth, so the CDN layer is not an optimization but a structural requirement of the design. Cache keys need to encode the derivative size/format actually being requested (e.g. a URL path segment for resolution and format, like /img/{photoId}/feed.webp vs. /img/{photoId}/thumb.jpg) so the CDN can cache each variant independently rather than caching one blob and hoping it fits every use. Cache invalidation is comparatively rare — once a derivative is generated it almost never changes (a deleted photo is handled by removing metadata visibility rather than mutating the cached file, and format upgrades are handled by versioned URLs rather than in-place invalidation) — which is precisely the access pattern CDNs are best at: near-immutable content with an extremely high read-to-write ratio.'
      },
      {
        title: 'Automated content moderation in the critical processing path',
        body: 'Running nudity/violence/spam classifiers against every uploaded image is computationally nontrivial at 100M uploads/day, and putting it in the synchronous upload path would slow every single upload down to the speed of the slowest classifier. Placing moderation inside the same asynchronous processing pipeline as transcoding — running in parallel with derivative generation, gating final "feed-eligible" status on both completing — keeps upload latency low while still preventing unmoderated content from reaching a public feed. The harder engineering problem is tiered escalation: automated classifiers handle the high-confidence bulk of cases (clearly fine, clearly violating) instantly, while borderline-confidence results get queued for human review, with the post held in a limited-visibility state (visible to the poster, not yet in others\' feeds) until that review resolves — balancing moderation accuracy against not indefinitely blocking every legitimate post behind a review queue.'
      }
    ],
    tradeoffs: [
      {
        title: 'Eager vs. on-demand transcoding',
        body: 'As covered in the deep dive, eager generation trades storage cost and wasted compute for consistently fast reads, while on-demand generation trades a slower first-load for lower storage footprint. The right balance shifts with the platform\'s read-to-write ratio and size-diversity of client requests — a platform serving mostly one canonical app UI can get away with fewer eager sizes than one serving embeddable images across arbitrary third-party layouts (Pinterest\'s use case skews more toward the latter than Instagram\'s).'
      },
      {
        title: 'Feed staleness vs. moderation thoroughness',
        body: 'Gating feed visibility on moderation completion protects other users from harmful content but introduces a delay between upload and appearing in others\' feeds — usually sub-second for automated-only decisions, but potentially minutes for anything escalated to human review. Skipping the gate (publish-then-moderate, removing content after the fact if flagged) minimizes latency and feels more "live," but means some users will see content before it\'s been checked, which most consumer platforms consider an unacceptable trust and safety risk regardless of the UX cost.'
      },
      {
        title: 'Multi-region origin replication cost vs. durability and latency',
        body: 'Replicating original photo files across multiple regions (not just CDN edge caches, but origin object storage itself) protects against a full regional outage or data-center-level data loss and improves origin-fetch latency for CDN cache misses in distant regions, but multiplies storage cost by the replication factor and adds write-path complexity (replication lag, conflict handling on rare concurrent metadata updates). Given that user-uploaded photos are typically irreplaceable — there\'s no way to regenerate a lost original — most platforms accept the extra storage cost as non-negotiable for originals, while being more willing to skip aggressive multi-region replication for regenerable derivatives, which can simply be re-transcoded from the original if lost.'
      }
    ],
    failureMode: {
      title: 'What Happens When Object Storage Is Unavailable?',
      body: "Object storage holds the one thing in this system that cannot be regenerated — the original upload — so its unavailability has to be treated differently for reads versus writes. Reads mostly survive a transient outage untouched, because the overwhelming majority of image views are served from CDN edge caches that already hold the relevant derivatives and never touch origin at all; only a genuine cache miss on an unusual size fails during the window. Writes cannot be allowed to silently drop or fake success: an upload that can't durably land in object storage must fail loudly back to the client so it can retry, since accepting a metadata row for an original that was never actually persisted would create an unrecoverable, permanently broken post. This asymmetry is why originals get non-negotiable multi-region replication despite the storage cost — losing one is unrecoverable — while derivatives are treated as cheap and disposable, regenerable from the original whenever storage needs to reclaim space.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/photos/upload-url',
        description: 'Request a pre-signed URL for direct client-to-object-storage upload of the original file.',
        example: '// Response 200\n{ "uploadUrl": "https://storage.example.com/...", "objectKey": "orig/2026/07/16/x91.jpg" }',
      },
      {
        method: 'POST',
        path: '/v1/photos',
        description: 'Register metadata for an already-uploaded original, kicking off async processing.',
        example: '// Request\n{ "objectKey": "orig/2026/07/16/x91.jpg", "caption": "sunset", "tags": ["travel"] }\n\n// Response 201\n{ "photoId": "ph_5521", "status": "pending" }',
      },
      {
        method: 'GET',
        path: '/v1/feed?cursor={cursor}&limit=20',
        description: "Fetch the caller's feed of feed-eligible posts from followed accounts.",
        example: '// Response 200\n{ "posts": [ { "photoId": "ph_5521", "thumbUrl": "https://cdn.example.com/img/ph_5521/thumb.webp" } ] }',
      },
      {
        method: 'POST',
        path: '/v1/photos/{photoId}/likes',
        description: 'Like a photo; recorded via the same async, sharded-counter pattern used across engagement features.',
        example: '// Response 202 Accepted\n{ "accepted": true }',
      },
      {
        method: 'GET',
        path: '/v1/photos/{photoId}?resolution=feed',
        description: 'Resolve a photo to its CDN-servable derivative URL for a given display resolution.',
        example: '// Response 200\n{ "photoId": "ph_5521", "url": "https://cdn.example.com/img/ph_5521/feed.webp" }',
      },
    ],
    keyTechnologies: [
      { term: 'Pre-signed URL', definition: 'A time-limited, authenticated URL letting a client upload directly to object storage without routing raw bytes through app servers.' },
      { term: 'Object Storage', definition: 'A durable, horizontally scalable blob store (e.g. S3-class) purpose-built for large, variable-size, write-once/read-many content.' },
      { term: 'Eager vs. On-Demand Transcoding', definition: 'Generating derivative resolutions upfront at upload time versus lazily on first request, trading storage cost against first-load latency.' },
      { term: 'CDN Cache-Key Design', definition: 'Encoding derivative size/format into the cache key (e.g. a URL path segment) so each variant caches independently at the edge.' },
      { term: 'Content Moderation Classifier', definition: 'An automated model scoring uploaded media for policy violations (nudity, violence, spam) as part of the async processing pipeline.' },
      { term: 'Staged Visibility', definition: "Gating a post's appearance in others' feeds on processing/moderation completion, while it remains visible only to its author beforehand." },
    ],
    selfAudit: [
      {
        question: 'What happens if a transcoding worker crashes halfway through generating derivatives?',
        answer: 'The upload sits in an explicit "processing" state with a timeout; a supervisor detects the stall and retries the job from scratch against the durable original in object storage, which is safe because derivative generation is idempotent and re-running it just overwrites the same output keys.',
      },
      {
        question: 'How do you serve a request for an unusual resolution that was never eagerly generated?',
        answer: 'The request falls through to on-demand transcoding — generated once from the original, written to object storage under the standard key scheme, and cached at the CDN edge so every subsequent request for that exact size is now a cache hit.',
      },
      {
        question: 'What happens when a photo is deleted but a derivative is still cached at CDN edges worldwide?',
        answer: "Deletion removes the metadata row's feed visibility immediately, which is what matters for correctness; the stale CDN edge copy is either explicitly purged via an invalidation call or simply ages out under a bounded TTL, since a briefly-still-fetchable deleted image via a direct URL is an acceptable, bounded staleness window.",
      },
      {
        question: 'How do you avoid falling behind on moderation during a viral upload burst?',
        answer: 'Moderation runs as an independently scalable stage of the same queue-backed pipeline as transcoding, so a burst just grows the queue depth and worker fleet elastically rather than blocking uploads; genuinely uncertain cases queue for human review while high-confidence automated decisions keep flowing at full throughput.',
      },
      {
        question: 'How do you keep storage costs bounded as media accumulates indefinitely?',
        answer: 'Originals move to progressively cheaper, higher-latency storage tiers as they age and stop being actively viewed, derivatives for cold content can be deleted and regenerated on the rare cold-read rather than kept forever, and modern compressed formats (WebP/AVIF) are used over legacy JPEG to cut bytes-per-photo across the board.',
      },
    ],
    cheatSheet: [
      { question: 'Which storage model?', answer: 'Object storage for pixels, a separate sharded database for metadata — never mix the two.' },
      { question: 'Where does processing state live?', answer: 'An explicit state machine per upload (pending/processing/ready/pending_review), not a boolean flag.' },
      { question: 'How to make transcoding safe on retry?', answer: 'Idempotent worker output — a retried job just overwrites the same derivative keys.' },
      { question: 'What if object storage is down?', answer: 'Reads mostly survive via CDN cache hits; writes fail loudly and retry — originals never get a lossy fail-open path.' },
      { question: 'How is it layered?', answer: 'Ingestion → async processing → tiered storage → CDN delivery, each independently scalable.' },
      { question: 'How does it handle a >100:1 read:write ratio?', answer: 'The CDN absorbs it — origin only ever sees cache misses, not raw view volume.' },
      { question: 'How does moderation avoid blocking uploads?', answer: 'It runs inside the same async pipeline as transcoding, gating feed-eligibility, not upload acknowledgment.' },
    ],
    expectedDepth: {
      mid: 'Propose object storage instead of database BLOB columns, and explain why async transcoding is needed so uploads are not blocked waiting for every derivative resolution to generate. Know that a CDN, not application servers, should serve image bytes.',
      senior: "Design the upload processing state machine (pending/processing/ready/pending_review), articulate the eager-vs-on-demand transcoding trade, and design CDN cache-key structure per derivative size/format. Explain why the pixels pipeline and the metadata/engagement pipeline must be architecturally separate.",
      staffPlus: 'Reason about exabyte-scale storage economics and hot/cold tiering, multi-region replication policy that treats irreplaceable originals differently from regenerable derivatives, and tiered content-moderation escalation (automated classifiers plus human review) that never indefinitely blocks a legitimate post. Discuss how this system\'s feed-serving path converges with a general social-feed design while keeping bytes and metadata on entirely separate infrastructure.',
    },
    keyTakeaways: [
      'Pixels and metadata are different workloads and must live in different storage and caching tiers',
      'An explicit processing state machine, not a boolean, is what makes staged visibility and crash recovery both possible',
      'A CDN is structural, not an optimization, once read:write ratio crosses 100:1 on multi-megabyte objects',
      'Originals are irreplaceable and get first-class durability; derivatives are regenerable and get whichever storage tier is cheapest',
    ],
    relatedDesigns: ['social-feed', 'video-streaming', 'pastebin'],
  },
{
    slug: 'ticket-booking',
    title: 'Ticket Booking (BookMyShow / Ticketmaster)',
    difficulty: 'Intermediate',
    icon: 'pi pi-ticket',
    color: '#f59e0b',
    concepts: ['Distributed locking', 'Seat-map state machine', 'Idempotency keys', 'Time-boxed holds', 'Payment orchestration'],
    companies: ['Ticketmaster', 'BookMyShow', 'StubHub', 'Eventbrite'],
    summary: 'A high-contention booking platform where thousands of users race to lock the same seats for a popular show, and only one can win each seat.',
    tldr: "Seat state is a single-owner, conditionally-written state machine (AVAILABLE -> HELD -> CONFIRMED) sharded by venue+showtime, while all seat-map browsing is served from a separate, eventually-consistent CQRS cache — so contention on a handful of hot rows never has to pay for the read volume of a flash sale.",
    problemFraming: 'The hard part isn\'t booking a single seat, it\'s that a stadium tour on Ticketmaster or a blockbuster premiere on BookMyShow can put millions of people racing for the same few thousand seats within seconds of tickets going live. A naive design that runs a plain `UPDATE seats SET status=\'BOOKED\' WHERE seat_id=?` behind a login page will double-sell seats the instant two requests read the same stale status and both proceed to write, and it collapses the moment casual browsing traffic shares a connection pool with actual booking writes. That last point matters more than it looks: seat-map views outnumber real hold attempts by roughly 20:1 during an on-sale, so whatever mechanism keeps seat mutation correct must not also become the bottleneck for people who are just looking. Any workable design has to split "is this seat still mine to try for" (cheap, frequent, tolerant of staleness) from "did my hold actually win" (rare, must be authoritative) into two different systems with two different consistency guarantees.',
    priorArt: [
      { title: 'Optimistic Concurrency Control (compare-and-swap on a version column)', description: 'The same conditional-write pattern used by DynamoDB conditional expressions and Cassandra lightweight transactions — a losing writer gets zero rows affected and retries against fresh state instead of blocking behind a lock.' },
      { title: 'Redlock (Redis distributed locking algorithm)', description: 'A cross-node mutual-exclusion algorithm for the highest-contention seats, giving a short-lived lease so at most one client can attempt to convert a hold at a time.' },
      { title: "Virtual waiting rooms (Queue-it, and Ticketmaster's own queueing system)", description: "Real production systems that admit users into the booking flow in signed, rate-limited batches rather than all at once, converting an uncontrolled thundering herd into an admission-controlled one before it ever reaches the seat map." },
      { title: 'CQRS (Command Query Responsibility Segregation, Fowler/Greg Young)', description: 'The architectural split behind serving seat-map reads from a cache fed by change-data-capture, while keeping seat mutation on a strongly consistent write path that reads never touch.' },
    ],
    coreEntities: [
      { name: 'Seat', description: 'The atomic bookable unit — status, version, and held_until timestamp.' },
      { name: 'Hold', description: 'A time-boxed claim on one or more seats pending payment.' },
      { name: 'Booking', description: 'The immutable, confirmed record created once payment succeeds.' },
      { name: 'Showtime Partition', description: 'The (venue, showtime) shard that scopes all contention for a given event to one partition.' },
    ],
    requirements: {
      core: [
        'Users can browse events/venues and view a real-time seat map with availability',
        'Users can hold a set of seats for a limited window (e.g. 5-10 minutes) while completing checkout',
        'Users can confirm payment to convert a hold into a permanent booking',
        'Expired or abandoned holds must automatically release seats back to inventory',
        'System must prevent double-booking of the same seat under any concurrency pattern',
        'Users can cancel a confirmed booking within policy, triggering a refund workflow'
      ],
      belowTheLine: [
        'Dynamic/surge pricing based on real-time demand',
        'Waitlists for sold-out events with automatic notification on release',
        'Bundled/group holds across multiple linked events (e.g. season tickets)',
        'A fraud/bot-detection dashboard for ops to monitor anomalous hold patterns',
      ],
      nonFunctionalTable: [
        { metric: 'Seat-state consistency', target: 'Strong consistency; zero double-bookings' },
        { metric: 'Seat-map read latency', target: '< 200ms p99, even at flash-sale peak' },
        { metric: 'Browse availability', target: 'Browsing stays up independent of booking/payment path health' },
        { metric: 'Burst scalability', target: 'Absorbs 100x baseline traffic for major on-sales' },
        { metric: 'Auditability', target: '100% of seat state transitions logged immutably' },
      ]
    },
    capacityEstimate: 'Assume 50M monthly active users, with sharp spikes around popular on-sales: a single blockbuster concert can draw 2M concurrent seat-map viewers within the first 5 minutes. Read QPS during a flash sale: 2M users polling seat status every 3s ≈ 660K QPS on reads, which must be served mostly from cache, not the seat-state database. Write QPS (hold/confirm/release) is far lower — maybe 5% of viewers actually attempt a hold, giving ~33K hold-attempts/sec, and these must serialize per-seat. A large venue has ~50K seats; storing seat state (status, holder, expiry, version) at ~200 bytes/seat gives 10MB per event — trivial to keep entirely in a cache/in-memory grid. Across 100K active events, seat-state storage is ~1TB, easily fitting a sharded relational or key-value store, while historical booking records (for analytics/refunds) grow at ~500M rows/year at ~1KB each, ~500GB/year.',
    architecture: 'Clients hit an API gateway fronted by a CDN for static event/venue metadata and images. Seat-map reads are served from a read-optimized cache layer (Redis cluster keyed by venue+showtime) that is updated via change-data-capture from the authoritative seat-state store, so browsing traffic never touches the hot write path directly. The booking service itself owns seat-state transitions and is the only component allowed to mutate seat status; it is sharded by (venue_id, showtime_id) so that all contention for a given show lands on a small, dedicated partition rather than fanning out globally.\n\nWhen a user requests a hold, the booking service attempts a conditional write per seat — either a Redis `SETNX`-style lock with a TTL, or a row-level optimistic update (`UPDATE seats SET status=\'HELD\', version=version+1 WHERE seat_id=? AND status=\'AVAILABLE\' AND version=?`) against the primary datastore. A background reaper (or the TTL expiry itself) sweeps holds past their deadline and republishes those seats as available, fanning out an invalidation to the cache and to any clients watching that seat map over a WebSocket/SSE channel.\n\nOn successful hold, an idempotency key tied to the checkout session is issued; the payment orchestration service (a separate bounded context, likely using a saga) charges the user and, on success, calls back into the booking service to flip HELD → CONFIRMED atomically, writing an immutable booking record. If payment fails or times out, the saga compensates by releasing the hold immediately rather than waiting for TTL expiry, improving inventory liquidity. Everything downstream — email confirmations, ticket generation (QR codes), analytics — is driven off an event stream (Kafka) so the booking service itself stays lean and doesn\'t block on side effects.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  server[Booking Server]:::compute
  db[(Seats Table)]:::database

  client -->|"GET /seats"| server
  server -->|"SELECT * FROM seats"| db
  client -->|"POST /book seatId"| server
  server -->|"UPDATE seats SET status='BOOKED'"| db`,
      },
      {
        title: 'Core Design: Conditional Writes + Cached Reads',
        mermaid: `flowchart LR
  client[Client]:::client
  cache[("Seat-Map Cache")]:::cache
  booking[Booking Service, sharded by venue+showtime]:::compute
  seatdb[(Seat-State Store)]:::database

  client -->|"GET /seats (cached)"| cache
  client -->|"POST /hold"| booking
  booking -->|"conditional UPDATE ... WHERE status=AVAILABLE AND version=?"| seatdb
  seatdb -->|"CDC"| cache`,
      },
      {
        title: 'Payment Saga and Hold Expiry',
        mermaid: `flowchart LR
  booking[Booking Service]:::compute
  payment[Payment Orchestration - Saga]:::compute
  reaper[Hold Reaper]:::compute
  seatdb[(Seat-State Store)]:::database
  events[["Kafka"]]:::async

  booking -->|"issue idempotency key"| payment
  payment -->|"charge, then confirm HELD to CONFIRMED"| seatdb
  payment -.->|"failure: release hold"| seatdb
  reaper -->|"sweep expired holds"| seatdb
  seatdb -->|"booking events"| events`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  cdn[["CDN"]]:::edge
  waitroom[Virtual Waiting Room]:::edge
  gateway[API Gateway]:::edge
  cache[("Seat-Map Cache")]:::cache
  booking[Booking Service, sharded]:::compute
  seatdb[(Seat-State Store)]:::database
  payment[Payment Orchestration]:::compute
  reaper[Hold Reaper]:::compute
  events[["Kafka"]]:::async
  ws[WebSocket Fan-out]:::compute

  client --> cdn
  client --> waitroom --> gateway
  gateway -->|"seat map reads"| cache
  gateway -->|"hold/confirm"| booking
  booking --> seatdb
  booking --> payment
  reaper --> seatdb
  seatdb -->|"CDC"| cache
  seatdb --> events --> ws --> client`,
      },
      {
        title: 'Hold to Confirmed Booking (Sequence)',
        mermaid: `sequenceDiagram
  participant U as User
  participant B as Booking Service
  participant DB as Seat-State Store
  participant P as Payment Saga
  participant R as Hold Reaper

  U->>B: POST /hold {seatIds}
  B->>DB: conditional UPDATE AVAILABLE->HELD, held_until=now+5m
  DB-->>B: success (or 409 if already held)
  B-->>U: hold confirmed, idempotencyKey
  U->>P: confirm payment(idempotencyKey)
  alt payment succeeds
    P->>DB: UPDATE HELD->CONFIRMED
    P-->>U: booking confirmed
  else payment fails or times out
    P->>DB: release hold immediately
    P-->>U: booking failed
  end
  R->>DB: sweep seats past held_until, revert to AVAILABLE`,
      },
    ],
    approaches: [
      {
        name: 'Pessimistic Locking',
        description: "Take a row-level lock (SELECT ... FOR UPDATE) on a seat before allowing any hold attempt to proceed.",
        pros: ['Simple to reason about — only one transaction touches a seat at a time', 'Guarantees no wasted downstream work'],
        cons: ['Serializes throughput per seat under contention', 'A stalled transaction can cascade lock contention to everyone behind it', 'Users perceive queuing delay as a hung UI'],
      },
      {
        name: 'Optimistic Concurrency Control',
        description: "A version column checked in the UPDATE's WHERE clause; concurrent writers race, exactly one wins, losers get zero rows affected and retry against fresh state.",
        pros: ['Non-blocking — losers fail fast instead of queuing', 'Scales throughput far better under high contention', 'Instant, clear rejection signal to losing clients'],
        cons: ['Pushes complexity into client-side retry logic', 'A user can fill out part of checkout before discovering the seat is gone'],
        usedBy: 'DynamoDB conditional expressions, Cassandra lightweight transactions',
      },
      {
        name: 'Distributed Lock (Redlock) for Hottest Seats',
        description: 'A cross-node mutual-exclusion lease (e.g. via Redis) fronting the database specifically for the highest-contention seats during a flash sale.',
        pros: ['Absorbs extreme lock-thrashing before it reaches disk', 'Bounds worst-case contention on a handful of hot rows'],
        cons: ['Adds an extra coordination hop and another moving part to operate', 'Lease expiry/renewal edge cases need careful handling'],
        usedBy: 'High-demand on-sales layered on top of the primary optimistic-write path',
      },
    ],
    whereThisFits: [
      { layer: 'Edge', blocks: 'Admission control before the booking flow', key: 'Signed queue token', example: 'Virtual waiting room admits users in rate-limited batches' },
      { layer: 'Read Path', blocks: 'Seat-map browsing at flash-sale volume', key: 'Venue + showtime cache', example: 'CDC-fed Redis cache serves ~660K QPS without touching the seat-state store' },
      { layer: 'Write Path', blocks: 'Seat-state mutation', key: '(venue_id, showtime_id) shard', example: "Conditional UPDATE guarded by the seat's version column" },
      { layer: 'Settlement', blocks: 'Payment and confirmation', key: 'Idempotency key per checkout session', example: 'Saga charges the card, then flips HELD to CONFIRMED atomically' },
    ],
    deepDive: [
      {
        title: 'Preventing double-booking under contention',
        body: 'The core correctness problem is that thousands of clients may attempt to hold the same seat within milliseconds of each other. Pessimistic row locks (SELECT ... FOR UPDATE) work but serialize throughput per seat and risk lock contention cascading if a transaction stalls. Optimistic concurrency control — a version column checked in the UPDATE\'s WHERE clause — scales better because failed attempts don\'t block others, they just retry against fresh state; the loser gets a clear "seat no longer available" signal instantly. For the highest-contention shows, a distributed lock service (Redis with Redlock, or a per-seat lease in a strongly consistent store like etcd/ZooKeeper) can front the database, absorbing the lock-thrashing before it ever reaches disk. The key design decision is that seat mutation must always go through a single logical owner per seat — sharding by venue+showtime ensures that owner is a small, well-provisioned partition instead of a global bottleneck.',
        diagram: `flowchart TD
  req1[Request A: hold seat 12]:::compute
  req2[Request B: hold seat 12]:::compute
  db[(Seat row: status=AVAILABLE, version=5)]:::database

  req1 -->|"UPDATE ... WHERE version=5"| db
  req2 -->|"UPDATE ... WHERE version=5"| db
  db -->|"first writer wins, version becomes 6"| req1
  db -->|"0 rows affected, retry with fresh version"| req2`,
      },
      {
        title: 'Hold expiry as a distributed timer problem',
        body: 'Every hold needs a reliable "give this seat back if the user vanishes" mechanism, and this is trickier than it looks. Relying purely on client-driven cancellation fails if the browser tab crashes. A TTL on the cache entry is elegant but the cache and the source-of-truth database can drift if the TTL fires but the corresponding DB row update fails. The more robust pattern stores an explicit `held_until` timestamp in the authoritative store and treats any read of a HELD seat past that timestamp as implicitly AVAILABLE (lazy expiry), backed by a periodic sweeper job that does the actual state flip and cache invalidation for seats nobody happens to read. This combination — lazy expiry for correctness, active sweeping for cache freshness — avoids depending on any single timer firing exactly on time.'
      },
      {
        title: 'Scaling seat-map reads independently from writes',
        body: 'Because reads outnumber writes by roughly 20:1 during a flash sale, the read path is architected to never touch the transactional seat-state store. A per-show seat bitmap (one bit or small enum per seat) is cached and pushed to subscribers over WebSocket/SSE so clients see near-real-time updates without polling. This bitmap is derived from the CDC stream off the seat-state database, giving eventual consistency on the read side — a client might briefly see a seat as available a few hundred milliseconds after someone else grabbed it, but the actual hold attempt still goes through the strongly consistent write path, which will correctly reject it. This CQRS-style split is what lets the system absorb 100x read spikes without over-provisioning the write tier.'
      },
      {
        title: 'Queueing users before they even reach the seat map',
        body: 'For extreme on-sales (e.g. a stadium tour announcement), even the read path can be overwhelmed, and worse, letting everyone into the seat-selection UI simultaneously just moves the contention problem earlier. Systems like Ticketmaster front the whole flow with a virtual waiting room: users are assigned a randomized queue position (often via a signed token with a timestamp, verified stateless-ly at the edge) and admitted into the booking flow in controlled batches sized to what the booking service can handle per second. This converts an uncontrolled thundering herd into a rate-limited admission process, and it\'s arguably the single highest-leverage design decision for these systems — it protects every downstream component for free.'
      }
    ],
    tradeoffs: [
      {
        title: 'Optimistic vs pessimistic concurrency on seat locks',
        body: 'Pessimistic locking (row locks, distributed mutexes) gives simple reasoning and guarantees no wasted work downstream, but under high contention it creates queuing delay that users perceive as a hung UI, and a slow or crashed lock-holder can stall everyone behind it. Optimistic concurrency avoids blocking and scales throughput, but it pushes complexity into retry logic and means a user can fill out part of checkout before discovering their seat is gone. Most production systems land on optimistic writes for the hold step (fast, non-blocking) but pessimistic, short-lived locks around the final payment-confirmation step, where correctness matters more than raw throughput and the seat is already effectively won.'
      },
      {
        title: 'Strong consistency for seats vs a fully async, cache-first design',
        body: 'A pure CQRS/cache-first design would maximize read throughput and resilience but risks seat-state staleness feeding back into the write path — a client acting on a stale cache read could waste a round-trip attempting to hold an already-taken seat. This system deliberately accepts that tradeoff for reads (cheap, frequent, tolerable staleness) while refusing it for writes (rare, must be authoritative). The alternative — making every read strongly consistent — would require the write-tier database to absorb 660K QPS directly, which is not economically or technically sensible for a system where 95% of that traffic never results in a hold.'
      },
      {
        title: 'TTL length for holds: conversion vs inventory liquidity',
        body: 'A longer hold window (10+ minutes) reduces the chance a genuine buyer loses their seat mid-checkout due to slow payment forms, improving conversion and user trust. A shorter window (2-3 minutes) keeps inventory liquid during scarcity, so seats abandoned by indecisive or malicious users (bots grabbing seats to resell) come back online faster for real buyers. Ticketing platforms often tune this dynamically — short TTLs during a hot on-sale, longer TTLs for everyday low-demand bookings — rather than picking one fixed value.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Seat-State Store Is Unavailable?',
      body: "Unlike a rate limiter, this system cannot fail open on writes — allowing holds or confirmations through without the authoritative store would risk double-selling the same seat, which is a far worse outcome than temporary unavailability. The correct behavior is to fail closed on the write path: new hold and confirm requests are rejected with a clear retry-later response while the store is down, and the virtual waiting room can be used to shed incoming load rather than let requests pile up retrying against a dead dependency. Seat-map browsing, however, keeps working almost unaffected, because reads are served from a CDC-fed cache that is decoupled from the transactional store precisely for this reason — users can keep looking at (increasingly stale) availability even while nobody can actually complete a booking. Already-confirmed bookings remain valid throughout, since confirmation is a durable, already-committed fact that doesn't depend on the store being reachable afterward.",
    },
    apiInterface: [
      {
        method: 'GET',
        path: '/v1/events/{eventId}/seatmap',
        description: 'Fetch the current seat map with live availability, served from the cache-backed read model.',
        example: '// Response 200\n{ "seats": [ { "seatId": "A12", "status": "AVAILABLE" }, { "seatId": "A13", "status": "HELD" } ] }',
      },
      {
        method: 'POST',
        path: '/v1/holds',
        description: 'Attempt to place a time-boxed hold on one or more seats via a conditional write.',
        example: '// Request\n{ "eventId": "ev_44", "seatIds": ["A12", "A13"] }\n\n// Response 201\n{ "holdId": "h_991", "expiresAt": "2026-07-16T10:07:00Z" }',
      },
      {
        method: 'POST',
        path: '/v1/bookings/confirm',
        description: 'Convert an active hold into a confirmed booking after payment succeeds. Idempotent per key.',
        example: '// Request\n{ "holdId": "h_991", "idempotencyKey": "chk_5a1" }\n\n// Response 200\n{ "bookingId": "bk_2201", "status": "CONFIRMED" }',
      },
      {
        method: 'DELETE',
        path: '/v1/holds/{holdId}',
        description: 'Explicitly release a hold before it expires, returning seats to inventory immediately.',
        example: '// Response 204 No Content',
      },
      {
        method: 'POST',
        path: '/v1/bookings/{bookingId}/cancel',
        description: 'Cancel a confirmed booking within policy and trigger the refund workflow.',
        example: '// Request\n{ "reason": "customer_request" }\n\n// Response 202 Accepted\n{ "refundStatus": "pending" }',
      },
    ],
    keyTechnologies: [
      { term: 'Optimistic Concurrency Control', definition: 'A conditional update pattern (compare-and-swap on a version column) that lets concurrent seat holds fail fast and retry instead of blocking behind a lock.' },
      { term: 'Distributed Lock (Redlock)', definition: 'A cross-node locking algorithm using Redis to guarantee only one client can hold a given seat lease at a time under high contention.' },
      { term: 'Saga Pattern', definition: 'An orchestration pattern for multi-step transactions (hold -> charge -> confirm) with explicit compensating actions if a later step fails.' },
      { term: 'CQRS', definition: 'Command Query Responsibility Segregation — separating the strongly consistent seat-write path from a cached, eventually-consistent seat-read path.' },
      { term: 'Virtual Waiting Room', definition: 'An edge-verified queueing mechanism that admits users into the booking flow in rate-limited batches rather than all at once.' },
      { term: 'Lazy + Active Hold Expiry', definition: 'Treating any read of a hold past its held_until timestamp as expired (correctness), backed by a periodic sweeper for cache freshness and cleanup.' },
    ],
    selfAudit: [
      {
        question: 'What happens if two users click "book" on the same seat within milliseconds of each other?',
        answer: 'Both requests race on a conditional UPDATE guarded by the seat\'s version column; exactly one succeeds and flips the row to HELD, the other gets zero rows affected and is told instantly that the seat is no longer available, with no possibility of both holds succeeding.',
      },
      {
        question: 'How do you handle a hold expiring at the exact moment payment is being processed?',
        answer: "The payment saga's confirm step performs its own conditional check against current seat state before flipping HELD to CONFIRMED; if the reaper already reclaimed the seat, confirmation fails cleanly and the user is told to retry, rather than silently confirming a seat that's no longer theirs.",
      },
      {
        question: 'What if the CDC pipeline lags and the seat-map cache still shows a seat as available after it has actually been taken?',
        answer: 'That staleness only affects the read-only seat map display; the actual hold attempt always goes through the strongly consistent write path against the authoritative store, which will correctly reject it — the CQRS split means stale reads never translate into stale writes.',
      },
      {
        question: 'How do you prevent bots from mass-holding seats just to resell them?',
        answer: 'Per-account and per-IP rate limits on hold requests, CAPTCHA or proof-of-work at the virtual waiting room entry, shorter hold TTLs during high-demand on-sales, and anomaly detection on hold-to-confirm conversion rate all combine to make bulk botting economically and mechanically harder without punishing genuine buyers.',
      },
      {
        question: 'What happens during a regional outage of the payment provider mid-flash-sale?',
        answer: 'Holds remain valid and seats stay reserved up to their TTL while payment retries against the provider or fails over to a secondary processor; if payment cannot complete before expiry, the hold is released back to inventory exactly as it would be for an abandoned checkout, so the outage degrades conversion but never corrupts seat state.',
      },
    ],
    cheatSheet: [
      { question: 'Which concurrency model?', answer: 'Optimistic (version-column CAS) for holds; a short pessimistic lock only around the final payment confirm.' },
      { question: 'Where does seat state live?', answer: 'A single authoritative store sharded by (venue, showtime) — never the read cache.' },
      { question: 'How to make hold+confirm atomic?', answer: 'A conditional UPDATE in the WHERE clause — zero rows affected means you lost, retry against fresh state.' },
      { question: 'What if the seat-state store goes down?', answer: 'Fail closed on writes (no new holds/confirms); reads keep serving stale-but-safe data from cache.' },
      { question: 'How is it layered?', answer: 'Waiting room (admission) → cached reads (CQRS) → sharded conditional writes → payment saga.' },
      { question: 'How does it handle 100x read spikes?', answer: 'A CDC-fed cache absorbs browsing traffic entirely; writes never see that volume.' },
      { question: 'How do holds expire reliably?', answer: 'Lazy expiry (treat any read past held_until as available) plus an active sweeper — no single timer has to fire exactly on time.' },
    ],
    expectedDepth: {
      mid: "Propose a status column with UPDATE ... WHERE status='AVAILABLE' and recognize that a plain read-then-write double-books seats under concurrency. Know that holds need an expiry mechanism so abandoned checkouts release inventory.",
      senior: 'Design optimistic concurrency control with a version column, separate cached seat-map reads from the transactional write path (CQRS), and design the hold-expiry mechanism combining a TTL with an active sweeper job.',
      staffPlus: "Design the payment saga with explicit compensating actions on failure, a sharding strategy by (venue, showtime) that bounds contention to a small dedicated partition, and a virtual waiting room as admission control ahead of the entire flow. Address anti-bot/anti-scalping measures and dynamic hold-TTL tuning without punishing legitimate high-demand buyers.",
    },
    keyTakeaways: [
      'Never let browsing traffic and seat-mutation traffic share a storage/consistency tier — the ratio between them is too extreme',
      'Optimistic concurrency (fail fast, retry) beats pessimistic locks once real contention hits',
      'Fail-closed is the correct choice here — unlike a rate limiter, failing open on a seat lock means double-selling inventory',
      'The virtual waiting room is the single highest-leverage decision — it protects every downstream component for free',
    ],
    relatedDesigns: ['stock-broker', 'digital-wallet', 'ride-sharing'],
  },
  {
    slug: 'news-aggregator',
    title: 'News Aggregator (Google News)',
    difficulty: 'Intermediate',
    icon: 'pi pi-globe',
    color: '#3b82f6',
    concepts: ['Web crawling pipeline', 'Locality-sensitive hashing', 'Article clustering', 'Ranking/personalization', 'Inverted index'],
    companies: ['Google', 'Apple News', 'Flipboard', 'SmartNews'],
    summary: 'A pipeline that continuously crawls thousands of publishers, groups near-duplicate coverage of the same event, and ranks clusters into a personalized feed.',
    tldr: 'New articles are shingled/embedded and inserted into a time-windowed locality-sensitive-hashing index, so each incoming article only has to be compared against candidates in its own hash buckets — turning what would be an O(n^2) same-story dedup problem at 100M articles/day into a near-constant-time lookup.',
    problemFraming: 'When a major story breaks — an election result, a plane crash, an earnings surprise — hundreds of the 50,000+ publishers Google News crawls will independently publish coverage within minutes of each other, and a naive feed would show a user fifty near-identical headlines about the same event instead of one clustered story with fifty sources. The obvious first approach — compare every new article against every other recent article to detect duplicates — falls apart at scale: even a modest 72-hour rolling window holds on the order of 300 million articles, so pairwise comparison means roughly 300M^2 operations, which is computationally infeasible no matter how much hardware you throw at it. There\'s a second naive failure mode too: computing a personalized ranking by scanning the full corpus per request can\'t possibly keep up with millions of feed loads per minute. The problem is really two sub-problems in disguise — sub-linear duplicate detection, and precomputed rather than on-demand ranking — and both have to be solved before "aggregation" becomes remotely real-time.',
    priorArt: [
      { title: 'MinHash + Locality-Sensitive Hashing (Broder, 1997)', description: 'The classic web-scale near-duplicate detection technique this design borrows directly: hashing document shingles so that similar documents land in the same buckets, letting you compare only candidates instead of the whole corpus.' },
      { title: 'SimHash for near-duplicate web pages (Manku, Jain & Sarma, Google, 2007)', description: "Google's own published technique for detecting near-duplicates at web-crawl scale using hamming-distance comparisons on compact fingerprints — the same underlying idea applied to clustering same-event coverage." },
      { title: '"Google News Personalization: Scalable Online Collaborative Filtering" (Das, Datar, Garg, Rajaram — WWW 2007)', description: "A real published paper describing Google News's actual production architecture for blending collaborative-filtering signals into a personalized, precomputed feed rather than ranking per request." },
      { title: 'Inverted index (classic IR structure, e.g. Apache Lucene)', description: 'The standard term-to-document index structure used for the keyword/topic search requirement, built asynchronously off the same ingestion pipeline that feeds clustering.' },
    ],
    coreEntities: [
      { name: 'Article', description: 'A single ingested piece of content with extracted text, metadata, and an embedding/fingerprint used for clustering.' },
      { name: 'Cluster (Story)', description: 'A group of near-duplicate articles judged to cover the same real-world event, the unit ranking and feeds actually operate on.' },
      { name: 'Source (Publisher)', description: 'A crawled origin with a crawl cadence, robots.txt policy, and a computed authority score.' },
      { name: 'Topic', description: 'A taxonomy node (e.g. Politics, Tech) that clusters are scored and ranked within before personalization.' },
      { name: 'UserInterestProfile', description: "Derived signals from a user's reading history/preferences used to re-rank topic-level candidates into a personal feed." },
    ],
    requirements: {
      core: [
        'Continuously crawl and ingest articles from tens of thousands of publisher sources',
        'Deduplicate and cluster articles covering the same real-world story',
        'Rank clusters within a topic/category by freshness, source authority, and engagement',
        'Serve a personalized feed per user based on reading history and preferences',
        'Support search over the article corpus by keyword and topic',
        'Detect and surface breaking news with low latency from publish to feed'
      ],
      belowTheLine: [
        'Cross-language clustering so the same event reported in different languages still merges into one story',
        'Publisher-facing analytics dashboard showing referral traffic and click-through per article',
        'User-controlled topic following/muting with push notifications for followed topics',
        'Automated misinformation/fact-check flagging surfaced alongside a cluster',
      ],
      nonFunctionalTable: [
        { metric: 'Crawl-to-feed latency (breaking news)', target: 'Under a few minutes from publish to feed' },
        { metric: 'Feed read throughput', target: 'Millions of feed loads/minute at peak, served from cache' },
        { metric: 'Dedup/clustering scale', target: 'Handles 100M+ new articles/day without full pairwise (O(n^2)) comparison' },
        { metric: 'Ranking consistency', target: 'Eventually consistent ranking signals; feed staleness bounded to a few minutes' },
        { metric: 'Crawl fault tolerance', target: 'Partial publisher crawl failures degrade freshness for those sources only, never block feed serving' },
      ]
    },
    capacityEstimate: 'Assume ingestion from 50,000 publisher sources producing an average of 2 articles/source/day, giving ~100M new articles/day (~1,150/sec average, bursty around news cycles). Each article, with text, metadata, and extracted entities, averages ~10KB, so raw daily storage is ~1TB/day, or ~365TB/year before any compression — mitigated by storing full HTML only transiently and keeping extracted text plus a compressed archive link long-term, cutting this to roughly 100TB/year. On the read side, assume 200M daily active users loading a feed of 20 articles roughly 5 times/day: that is 1B feed renders/day, ~11,600 QPS average, spiking to 5-10x that during major news events — must be served almost entirely from a precomputed, cached feed rather than computed per-request. Clustering runs over a rolling window (say, the last 72 hours of articles, ~300M articles) using a sketch-based similarity index rather than full pairwise comparison, since naive pairwise comparison at that scale is combinatorially infeasible (300M^2).',
    architecture: 'A fleet of distributed crawlers, coordinated by a crawl scheduler, pulls from a prioritized frontier queue of publisher URLs/RSS feeds/sitemaps, respecting robots.txt and per-domain rate limits. Fetched pages go through a normalization stage (boilerplate stripping, article-text extraction, language detection, entity extraction via NLP) and land in a raw content store (object storage) plus a structured metadata store. This decouples "getting the bytes" from "understanding the content," so crawler throughput isn\'t gated by NLP latency.\n\nExtracted articles flow into a clustering service that groups near-duplicate or same-event coverage. Rather than comparing every new article against the full corpus, articles are embedded (via a text embedding model or simpler shingling/MinHash) and inserted into a locality-sensitive hashing (LSH) index bucketed by time window; a new article only needs to be compared against candidates in its own LSH buckets, which is what makes this tractable at 100M articles/day. Clusters that match an existing story get merged (updating cluster metadata like earliest-published time, source count, and representative headline); genuinely new clusters spawn a new story entity, which is what powers "breaking news" detection — a burst of independent sources publishing near-simultaneously on a previously unseen cluster is itself a strong breaking-news signal.\n\nRanking happens in two layers: an offline/near-real-time layer scores clusters per topic using signals like source authority, freshness decay, and click-through velocity, writing precomputed topic rankings to a cache; and an online layer personalizes the final feed per user by blending those topic rankings with the user\'s embeddings/interest profile, typically as a lightweight re-ranking pass over a few hundred candidate clusters rather than the full corpus. Feed requests are served from this precomputed, per-user-ish cache, with a CDN and edge cache absorbing the bulk of read traffic; a search service separately maintains an inverted index over article text for keyword queries, updated asynchronously from the same ingestion pipeline.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  crawler[Crawler]:::compute
  pg[(Articles Table)]:::database
  client[Client]:::client
  crawler -->|"INSERT article, published_at"| pg
  client -->|"GET /feed"| pg
  pg -->|"SELECT * ORDER BY published_at DESC LIMIT 20"| client`,
      },
      {
        title: 'Core Design: Crawl, Extract, and Cluster',
        mermaid: `flowchart LR
  publisher[Publisher Sites]:::client
  crawler[Crawler Fleet]:::compute
  queue[["Ingestion Queue (Kafka)"]]:::async
  extractor[Extraction/NLP Worker]:::compute
  raw[("Raw Content Store")]:::storage
  cluster[Clustering Service]:::compute
  lsh[("LSH Bucket Index")]:::cache
  meta[("Article/Cluster Metadata Store")]:::database

  publisher --> crawler --> queue --> extractor
  extractor --> raw
  extractor --> meta
  extractor -->|"embed"| cluster
  cluster <-->|"bucket lookup"| lsh
  cluster --> meta`,
      },
      {
        title: 'Core Design: Ranking and Personalized Feed Serving',
        mermaid: `flowchart LR
  meta[("Cluster Metadata")]:::database
  ranker[Offline Ranking Job]:::compute
  rankcache[("Topic Ranking Cache")]:::cache
  cdn[["CDN / Edge Cache"]]:::cache
  api[Feed API]:::edge
  personalize[Personalization Re-ranker]:::compute
  client[Client]:::client

  meta --> ranker --> rankcache
  client --> cdn --> api
  api --> rankcache --> personalize --> client`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  publisher[Publisher Sites]:::client
  crawler[Crawler Fleet]:::compute
  queue[["Ingestion Queue"]]:::async
  extractor[Extraction/NLP]:::compute
  raw[("Raw Content Store")]:::storage
  cluster[Clustering Service]:::compute
  lsh[("LSH Bucket Index")]:::cache
  meta[("Metadata / Cluster Store")]:::database
  search[("Inverted Search Index")]:::storage
  ranker[Ranking Job]:::compute
  rankcache[("Topic Rank Cache")]:::cache
  cdn[["CDN / Edge Cache"]]:::cache
  api[Feed API]:::edge
  personalize[Personalization Re-ranker]:::compute
  client[Client]:::client

  publisher --> crawler --> queue --> extractor
  extractor --> raw
  extractor --> cluster
  cluster <--> lsh
  cluster --> meta --> search
  meta --> ranker --> rankcache
  client --> cdn --> api
  api --> rankcache --> personalize --> client
  api -->|"keyword search"| search`,
      },
      {
        title: 'Breaking News Detection (Sequence)',
        mermaid: `sequenceDiagram
  participant P as Publishers
  participant C as Crawler
  participant E as Extractor/NLP
  participant CL as Clustering Service
  participant R as Ranking Job
  participant F as Feed API
  participant U as User

  P->>C: new article published
  C->>E: fetch + extract text
  E->>CL: embed + candidate bucket lookup
  alt matches existing cluster
    CL->>CL: merge into cluster, bump source count
  else no match
    CL->>CL: spawn new cluster
  end
  CL->>R: source-velocity signal
  R->>R: score as breaking if velocity exceeds threshold
  R->>F: push updated top-ranked cluster
  U->>F: GET /feed
  F-->>U: breaking story surfaced`,
      },
    ],
    approaches: [
      {
        name: 'Naive Pairwise Comparison',
        description: 'Compare every new article against every other recent article for similarity to detect duplicates. Correct in principle but O(n^2) — infeasible past a few thousand documents, let alone a 300M-article rolling window.',
        pros: ['Perfectly accurate — no approximation', 'Trivial to reason about'],
        cons: ['O(n^2) — computationally infeasible at scale', 'Cannot run within any real-time latency budget'],
      },
      {
        name: 'Locality-Sensitive Hashing (MinHash/SimHash)',
        description: 'Embed or shingle each article and bucket it via LSH so similar articles land in the same bucket with high probability; only compare against candidates in matching, time-windowed buckets.',
        pros: ['Collapses corpus-wide search to a few hundred candidates', 'O(1)-ish insert/lookup per article', 'Proven at Google web-crawl scale (SimHash)'],
        cons: ['Approximate — recall/precision tuning is inherently lossy', 'Bucket/threshold mistuning either fragments or falsely merges stories'],
        usedBy: 'Google News-style clustering pipelines; SimHash at Google web-crawl scale',
      },
      {
        name: 'Graph-based ANN (HNSW)',
        description: "Index dense semantic embeddings in a Hierarchical Navigable Small World graph instead of hash buckets, trading LSH's simplicity for better recall on genuinely semantic (not just lexical) similarity.",
        pros: ['Better recall for semantic near-duplicates LSH misses', 'Well-suited to dense embedding models'],
        cons: ['Higher memory and build/update cost than LSH', 'Harder to reason about time-windowed eviction than simple hash buckets'],
      },
    ],
    whereThisFits: [
      { layer: 'Crawl & Ingestion', blocks: 'Fetching raw articles, respecting robots.txt/politeness', key: 'Per-publisher source', example: 'Poll high-velocity wire services every minute; a small blog crawled hourly' },
      { layer: 'Clustering & Dedup', blocks: 'Grouping near-duplicate coverage into one story', key: 'LSH bucket within a rolling time window', example: 'A new article compares against ~a few hundred candidates in its own buckets, not the whole corpus' },
      { layer: 'Ranking', blocks: 'Scoring clusters by authority, freshness, engagement', key: 'Per-topic offline/near-real-time job', example: 'Topic rankings recomputed continuously and written to a cache' },
      { layer: 'Feed Serving', blocks: 'Personalized re-ranking and read-path caching', key: 'Per-user candidate re-rank over a small set', example: 'CDN + edge cache absorb the bulk of ~1B feed renders/day' },
    ],
    deepDive: [
      {
        title: 'Clustering without pairwise comparison at scale',
        body: 'The naive approach — compare every new article against every existing article for similarity — is O(n^2) and impossible past a few thousand documents. The practical fix is approximate nearest-neighbor search: represent each article as a vector (TF-IDF/SimHash for cheap lexical similarity, or a dense embedding for semantic similarity) and index it with LSH or a graph-based ANN structure (HNSW). LSH buckets vectors so that similar items land in the same bucket with high probability, collapsing the search space from "the whole corpus" to "a few hundred candidates in matching buckets." Clustering then becomes: hash the new article, look up its buckets, run a cheaper exact similarity check only against that candidate set, and either merge into an existing cluster (if similarity exceeds a threshold) or spawn a new one. Bucketing by a rolling time window is essential too — a story from six months ago should never be a merge candidate for today\'s article, which both improves precision and shrinks the search space further.',
        diagram: `flowchart LR
  article[New Article]:::compute
  embed[Embed / Shingle]:::compute
  lsh[("LSH Buckets")]:::cache
  candidates[Candidate Set Compare]:::compute
  existing[("Existing Cluster")]:::database
  newc[("New Cluster")]:::database

  article --> embed --> lsh -->|"bucket lookup"| candidates
  candidates -->|"similarity > threshold"| existing
  candidates -->|"no match"| newc`,
      },
      {
        title: 'Detecting breaking news from crawl velocity',
        body: 'Breaking news is fundamentally a signal about the rate and independence of coverage, not the content itself. The system tracks, per cluster, the count of distinct sources publishing into it within a sliding window (e.g. last 30 minutes) and the slope of that count over time. A cluster that goes from 1 source to 15 independent, previously-uncorrelated sources within 20 minutes is a strong breaking-news candidate, especially if those sources historically don\'t syndicate from one another. This is deliberately different from just "most clicked," because click volume lags publication by definition — velocity-based detection lets breaking stories surface into feeds before engagement data exists to validate them, at the cost of occasional false positives on coordinated PR pushes that need separate spam/reprint filtering.'
      },
      {
        title: 'Source authority and the cold-start ranking problem',
        body: 'Ranking clusters requires a notion of source credibility/authority so that a wire-service report doesn\'t get outranked by a low-quality reprint farm that happened to publish a catchier headline. This is typically modeled similarly to PageRank — sources that get cited/linked/syndicated by other reputable sources accrue authority, computed offline and refreshed periodically rather than per-request. The cold-start problem shows up for genuinely new publishers or novel topics with no historical engagement data; the mitigation is a hybrid score that blends the (possibly zero-confidence) authority prior with content-based signals — structured metadata quality, byline presence, publish-time consistency — so new-but-legitimate sources aren\'t permanently buried behind an authority signal they haven\'t had time to earn.'
      },
      {
        title: 'Personalization as re-ranking, not re-computation',
        body: 'Fully personalizing the entire corpus per user per request would be prohibitively expensive at hundreds of millions of DAU. Instead, personalization is architected as a two-stage retrieve-then-rank pipeline: topic-level rankings are computed once, shared across all users interested in that topic, and cached; the per-user step only re-ranks a small candidate set (the top-K clusters across the user\'s subscribed/inferred topics) using a lightweight model over user embeddings. This keeps the expensive part (corpus-wide ranking) amortized across users and the cheap part (final re-rank) proportional to feed size, not corpus size — the same retrieve-then-rank pattern used broadly in recommendation systems.'
      }
    ],
    tradeoffs: [
      {
        title: 'Crawl freshness vs politeness/cost',
        body: 'Crawling every publisher every few seconds would maximize freshness but would hammer smaller publisher sites and burn crawl budget disproportionately on low-value sources. The system instead assigns adaptive crawl frequencies per source based on historical publish cadence and authority — high-velocity wire services get polled every minute or via push (webhooks/PubSubHubbub where supported), while a small regional blog might get crawled hourly. This trades a small amount of freshness on low-value sources for dramatically better resource utilization and crawl politeness.'
      },
      {
        title: 'Approximate clustering (recall) vs precision',
        body: 'LSH-based clustering is inherently approximate — tuning it toward high recall (aggressively merging borderline-similar articles) risks conflating genuinely distinct stories that happen to share entities, while tuning toward high precision (strict merge thresholds) risks fragmenting one real event into several near-duplicate clusters, diluting its apparent importance in ranking. There is no threshold that is universally correct; most systems bias toward precision for cluster identity (better to have a few duplicate clusters than to merge unrelated stories) and clean up fragmentation downstream via a secondary, slower cluster-merging pass that can afford more expensive comparisons on a much smaller candidate set.'
      },
      {
        title: 'Global topic ranking vs full per-user personalization',
        body: 'Fully global ranking is cheap and consistent but ignores individual interest, while fully per-user ranking (scoring the entire corpus individually per user) is the ideal user experience but computationally unaffordable at scale. The two-stage retrieve-then-rank design is a deliberate middle ground, and its cost is that personalization is bounded by the quality of the topic-level candidate set — if a user\'s true interest doesn\'t map cleanly onto the predefined topic taxonomy, the re-ranking stage never even sees the relevant clusters as candidates.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Clustering/Dedup Service Goes Down?',
      body: 'If the clustering service or its LSH bucket index becomes unavailable, incoming articles simply back up in the durable ingestion queue rather than being dropped, since Kafka retention means nothing is lost, only delayed. The system fails open on the serving side: the feed API keeps serving the last successfully computed, cached topic rankings and cluster assignments, so users see a working, if increasingly stale, feed rather than an outage. What it cannot safely do is start showing un-clustered raw articles as validated stories, since that would flood users with duplicate near-identical headlines the moment volume resumes — new articles simply wait in the backlog until clustering recovers, prioritizing correctness of story grouping over absolute freshness. Once the service returns, it drains the backlog in publish order per topic, and breaking-news detection is the first signal to re-normalize since it depends on recent source velocity, not raw availability.',
    },
    apiInterface: [
      {
        method: 'GET',
        path: '/v1/feed?topic={topic}&cursor={cursor}',
        description: 'Return a personalized, paginated feed of top-ranked story clusters for the current user.',
        example: '// Response 200\n{ "entries": [ { "clusterId": "cl_88213", "headline": "...", "sourceCount": 42, "rank": 1 } ], "nextCursor": "opaque_token" }',
      },
      {
        method: 'GET',
        path: '/v1/breaking',
        description: 'Return currently surfacing breaking-news clusters ranked by source-velocity signal.',
        example: '// Response 200\n{ "entries": [ { "clusterId": "cl_91002", "sourceCount": 15, "velocityWindowMin": 20 } ] }',
      },
      {
        method: 'GET',
        path: '/v1/search?q={keyword}&topic={topic}',
        description: 'Keyword search over the article corpus using the async-updated inverted index.',
        example: '// Response 200\n{ "results": [ { "articleId": "a_5521", "headline": "...", "publisher": "Reuters", "publishedAt": "2026-07-15T10:03:00Z" } ] }',
      },
      {
        method: 'GET',
        path: '/v1/clusters/{clusterId}',
        description: 'Return full detail for a story cluster: representative headline, all contributing sources, and timeline.',
        example: '// Response 200\n{ "clusterId": "cl_88213", "firstPublished": "...", "sources": [ { "publisher": "AP", "articleId": "a_1" } ] }',
      },
    ],
    keyTechnologies: [
      { term: 'LSH (Locality-Sensitive Hashing)', definition: 'A hashing scheme that maps similar vectors to the same bucket with high probability, collapsing near-duplicate search from full corpus scan to a small candidate set.' },
      { term: 'SimHash / MinHash', definition: 'Cheap lexical fingerprinting techniques that produce compact signatures preserving approximate similarity, used to embed articles before LSH bucketing.' },
      { term: 'HNSW', definition: 'Hierarchical Navigable Small World graphs — a graph-based approximate nearest-neighbor index offering an alternative to LSH for dense embedding similarity search.' },
      { term: 'Inverted Index', definition: 'A search data structure mapping each term to the list of documents containing it, enabling fast keyword lookup over the article corpus.' },
      { term: 'PageRank-style Authority', definition: 'A source-credibility score computed from citation/syndication graphs, where authority accrues to sources cited by other reputable sources.' },
      { term: 'Retrieve-then-Rank', definition: 'A two-stage recommendation pattern: cheaply retrieve a small candidate set (topic-level ranking), then apply an expensive personalized re-rank only to that small set.' },
    ],
    selfAudit: [
      {
        question: 'What happens when a coordinated PR push causes many affiliated sites to publish near-simultaneously, mimicking breaking-news velocity?',
        answer: 'Velocity-based detection alone would false-positive on this, so the source-count signal is weighted by source independence (excluding known syndication/affiliate relationships), and a secondary spam/reprint classifier can down-rank clusters whose "independent" sources share templated content or publishing infrastructure.',
      },
      {
        question: 'How do you avoid a wire-service story being republished verbatim by hundreds of outlets counting as hundreds of independent sources?',
        answer: 'Verbatim or near-verbatim republication is itself caught by the same LSH similarity check used for clustering, so syndicated copies collapse into the same cluster and are tagged as reprints rather than counted as independent corroborating sources for velocity/authority purposes.',
      },
      {
        question: 'What is the failure mode if the clustering similarity threshold is mistuned?',
        answer: 'Too loose merges genuinely distinct stories that share entities (false merge, hurts precision); too strict fragments one real event into several near-duplicate clusters that dilute its apparent importance in ranking. The system biases toward precision (favoring fragmentation) since a slower downstream cluster-merging pass can clean up fragments on a much smaller candidate set, whereas a bad merge is hard to undo.',
      },
      {
        question: 'How does the system stay useful for a brand-new user with no reading history?',
        answer: 'Cold-start users fall back to the globally-ranked topic feed (the same topic-level ranking every user sees before personalization), with the re-ranking stage activating once enough interaction signal accumulates — this is the same retrieve-then-rank pipeline, just running with an empty personalization step initially.',
      },
    ],
    cheatSheet: [
      { question: 'Which clustering approach?', answer: 'LSH/MinHash-based approximate similarity search, never full pairwise comparison.' },
      { question: 'Where does personalization state live?', answer: "A per-user interest profile that re-ranks a small, precomputed topic-level candidate set — never the full corpus." },
      { question: 'How is dedup made consistent?', answer: 'Correctness comes from time-windowed, bucket-scoped comparison, not locking — merges are asynchronous and idempotent.' },
      { question: 'What happens if clustering goes down?', answer: 'Fail open by serving cached rankings while new articles buffer safely in the durable ingest queue.' },
      { question: 'How is it layered?', answer: 'Crawl → extract → cluster → rank → personalize/serve, each independently scalable.' },
      { question: 'How does it handle scale/distribution?', answer: 'Time-windowed LSH buckets and per-topic ranking jobs so no single component ever touches the whole corpus.' },
      { question: 'How is breaking news detected?', answer: 'Via a burst of independent-source velocity into a cluster, not click/engagement volume.' },
    ],
    expectedDepth: {
      mid: 'Recognize that comparing every new article against every other article for duplicate detection is infeasible at scale, and propose some form of fingerprinting (SimHash/MinHash) to group similar content instead. Understand that a personalized feed can\'t be computed by scanning the whole corpus per request and needs some form of precomputation or caching.',
      senior: 'Design the crawl → extract → cluster → rank → serve pipeline end to end, articulate why clustering needs LSH-style candidate bucketing instead of pairwise comparison, and separate offline topic-level ranking from a cheap per-user re-rank (retrieve-then-rank). Discuss source-authority scoring and how breaking news is detected from source velocity rather than lagging engagement signals.',
      staffPlus: 'Address the precision/recall tuning of clustering thresholds and why the system should bias toward precision (fragmentation) over false merges, plus the secondary slower reconciliation pass that cleans up fragments. Discuss adaptive crawl scheduling by source authority/velocity, the cold-start ranking problem for new publishers, and defenses against coordinated publishing (PR pushes, syndication) gaming the breaking-news velocity signal.',
    },
    keyTakeaways: [
      'Near-duplicate detection at scale is an approximate-nearest-neighbor problem, not a comparison problem',
      'Breaking news is a source-velocity signal — many independent sources, fast — not an engagement signal',
      'Personalization is cheapest as a re-rank of a small precomputed candidate set, never a full corpus scan',
      'Source authority stops low-quality reprint farms from outranking original reporting',
      'Bias clustering toward precision — fragmented duplicates are easier to fix downstream than a bad merge',
    ],
    relatedDesigns: ['social-feed', 'notification-system', 'photo-sharing'],
  },
  {
    slug: 'job-scheduler',
    title: 'Distributed Job Scheduler',
    difficulty: 'Advanced',
    icon: 'pi pi-clock',
    color: '#8b5cf6',
    concepts: ['Leader election', 'Consistent hashing/sharding', 'Exactly-once vs at-least-once execution', 'Distributed locks/leases', 'Time-wheel data structures'],
    companies: ['Uber', 'Airbnb', 'LinkedIn', 'Netflix'],
    summary: 'A fault-tolerant cron-like system that reliably fires millions of scheduled and recurring jobs across a fleet, even as nodes fail and clocks drift.',
    tldr: "Scheduling decisions (an in-memory time wheel or min-heap owned by a shard) are decoupled from job execution by a durable queue, so a slow or failing job callback never backs up the clock — and a per-job-instance lease plus idempotent consumers turn at-least-once queue delivery into effectively-once execution.",
    problemFraming: 'At Uber- or Airbnb-scale, tens of millions of registered jobs mean the system routinely has to fire tens of thousands of triggers in the same second — the classic case being every cron schedule that happens to land on the top of the hour or midnight UTC colliding at once. The naive design — a single cron process running `SELECT * FROM jobs WHERE due_at <= now()` every second and calling the target directly — has two fatal problems: it\'s a single point of failure where a crash mid-tick either silently drops jobs that were due or double-fires jobs that were mid-dispatch when it died, and it conflates "decide it\'s time" with "do the work," so one slow HTTP callback blocks every other job queued behind it in that same process. Neither problem is solvable by just adding more cron processes naively, because now two processes might pick up the same due job and fire it twice. The real design challenge is achieving fault tolerance and effectively-once firing without a single node ever owning the entire job set or the entire execution path.',
    priorArt: [
      { title: 'Hierarchical Timing Wheels (Varghese & Lauck, 1987)', description: "The classic O(1) timer data structure this design's in-memory near-term scheduling structure is built on — the same construct underlies Linux kernel timers, Netty, and Kafka's delayed-operation purgatory." },
      { title: 'Chubby / ZooKeeper leader election', description: 'The coordination primitive used to elect a leader per shard and safely rebalance job ownership when scheduler nodes join or leave, preventing two nodes from ever believing they own the same shard simultaneously.' },
      { title: 'Quartz Scheduler and Apache Airflow', description: 'Widely used production job schedulers that establish the same separation this design uses between a persisted job definition store and an active in-memory scheduling tier that polls it.' },
      { title: 'Unix cron', description: "The single-node mental model (cron expressions, fixed schedules) this design generalizes — cron's well-known failure mode of not surviving a crashed or overlapping run is exactly what the lease-plus-durable-queue mechanism here is designed to fix." },
    ],
    coreEntities: [
      { name: 'Job', description: 'The durable definition of scheduled work: cron expression or one-off time, payload reference, retry policy, owner.' },
      { name: 'Fire Instance (Trigger)', description: 'One specific due-execution of a job at a scheduled time — the actual unit dispatched and deduplicated.' },
      { name: 'Shard / Lease', description: 'A time-bound ownership grant assigning a slice of jobs to one scheduler node, safely reassigned on failure.' },
      { name: 'Execution Record', description: "An audit-trail row capturing one attempt's status, timestamps, and error for a fire instance." },
      { name: 'Dependency Edge', description: 'A DAG edge declaring that one job may only fire after another job succeeds.' },
    ],
    requirements: {
      core: [
        'Users/services can register one-off and recurring (cron-style) jobs with a target execution time',
        'Jobs execute exactly once (or with well-defined at-least-once semantics and idempotent consumers)',
        'Support job priorities, retries with backoff, and dead-letter handling for permanently failing jobs',
        'Support dynamic add/update/cancel of jobs without restarting the scheduler fleet',
        'Provide execution history/audit trail per job for debugging and SLAs',
        'Support dependent/chained jobs (job B runs only after job A succeeds)'
      ],
      belowTheLine: [
        'A web dashboard visualizing job DAGs, upcoming fires, and per-job SLA compliance',
        "Per-owner/per-target throttling so one team's jobs cannot monopolize shared execution capacity",
        'Reusable, parameterized job templates that multiple teams can instantiate instead of defining schedules from scratch',
        'Cross-region failover of the scheduler tier itself for disaster recovery',
      ],
      nonFunctionalTable: [
        { metric: 'Fault tolerance', target: 'No single point of failure; scheduler node crash causes zero dropped or duplicated fires' },
        { metric: 'Scale', target: 'Tens of millions of registered jobs; thousands of triggers/sec sustained, bursting to tens of thousands/sec' },
        { metric: 'Scheduling latency SLA', target: 'A job due at time T fires within a small window (e.g. ±5s)' },
        { metric: 'Tier independence', target: 'Scheduling tier and execution/worker tier scale horizontally and independently' },
        { metric: 'Durability', target: 'Job definitions and execution state survive node/AZ restarts and failures' },
      ]
    },
    capacityEstimate: 'Assume 20M actively registered jobs across the org, with an average firing frequency such that the system must trigger ~5,000 jobs/sec sustained, bursting to 50,000/sec at common boundaries like the top of every hour or midnight UTC when many cron schedules coincide. Each job definition (schedule, payload reference, retry policy, owner metadata) is ~1KB, giving ~20GB for the definitions store — small, but requiring an index sharded by next-fire-time for efficient range scans. Execution history at 5,000 fires/sec average is ~432M executions/day; storing a compact execution record (~200 bytes: job id, start/end time, status, attempt count) is ~86GB/day, or ~31TB/year, which is why history is typically retained hot for a short window (7-30 days) and rolled off to cold storage/data warehouse after. The scheduling tier itself needs to hold enough near-future jobs in memory to fire within SLA — if using a time-wheel with 1-second granularity covering the next hour, that is 3,600 buckets holding a combined tens of thousands of pending job references at any moment, trivially fitting in memory per shard.',
    architecture: 'Job definitions (cron expression or one-off timestamp, payload/callback reference, retry policy, owner) are written to a durable, replicated metadata store — a sharded relational database or a distributed KV store like a Cassandra/DynamoDB-style system — indexed by next-fire-time. The scheduler tier is horizontally partitioned, typically by consistent hashing on job ID or by time-bucket ownership, so each scheduler node is responsible only for a slice of jobs rather than scanning the entire table; a coordination layer (ZooKeeper/etcd) handles leader election per shard and rebalances shard ownership when nodes join or leave.\n\nEach scheduler node maintains an in-memory near-term structure — commonly a hierarchical time wheel or a min-heap keyed by fire-time — populated by periodically polling its shard of the metadata store for jobs due in the next lookahead window (e.g. the next 5-10 minutes), so it isn\'t doing expensive full-table scans on every tick. When a job\'s time arrives, the scheduler doesn\'t execute it directly; it publishes a trigger message to a durable queue (Kafka/SQS), decoupling "deciding it\'s time" from "doing the work." A separate, independently scalable pool of worker/executor nodes consumes from that queue, performs the actual job (an HTTP callback, a task invocation, etc.), and reports success/failure back, which is what allows the scheduling tier and the execution tier to scale independently — a spike in slow-running jobs doesn\'t back up the scheduling decision path.\n\nExactly-once-ish semantics are approximated via a distributed lock or lease per job-instance (e.g. "job X\'s 3pm run") acquired before dispatch, combined with idempotency keys threaded through to the worker/consumer so that even if a trigger is redelivered (at-least-once queue semantics), the actual side effect is applied only once. Failed executions are retried with exponential backoff by re-enqueuing with a delay, and jobs that exhaust retries land in a dead-letter queue with alerting. All state transitions (scheduled, dispatched, running, succeeded, failed, retried) are written to an execution-history store for observability and SLA auditing, consumed asynchronously so it never sits on the critical dispatch path.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  cron[Single Cron Process]:::compute
  db[(Jobs Table)]:::database
  target[Target Service]:::compute

  cron -->|"poll every 1s: SELECT * WHERE due_at <= now()"| db
  cron -->|"HTTP callback"| target`,
      },
      {
        title: 'Core Design: Sharded Scheduling with a Time Wheel',
        mermaid: `flowchart LR
  db[("Sharded Job Store")]:::database
  coord[["etcd / ZooKeeper"]]:::async
  sched[Scheduler Shard]:::compute
  wheel[("In-Memory Time Wheel")]:::cache
  queue[["Trigger Queue (Kafka)"]]:::async
  worker[Execution Worker]:::compute

  db -->|"poll next-fire-time window"| sched
  coord -.->|"leader election / lease"| sched
  sched --> wheel
  wheel -->|"job due"| queue --> worker`,
      },
      {
        title: 'Incremental: Retries, Dead-Letter, and Audit History',
        mermaid: `flowchart LR
  worker[Execution Worker]:::compute
  target[Target Callback]:::compute
  history[("Execution History Store")]:::database
  dlq[["Dead-Letter Queue"]]:::async
  queue[["Trigger Queue"]]:::async

  worker -->|"invoke"| target
  target -->|"success / fail"| worker
  worker -->|"write status"| history
  worker -->|"retry with backoff"| queue
  worker -->|"retries exhausted"| dlq`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client / Service]:::client
  api[Scheduler API]:::edge
  db[("Sharded Job Store")]:::database
  coord[["etcd / ZooKeeper"]]:::async
  sched[Scheduler Shards]:::compute
  wheel[("Time Wheel")]:::cache
  queue[["Trigger Queue"]]:::async
  worker[Execution Workers]:::compute
  target[Target Callbacks]:::compute
  history[("Execution History")]:::database
  dlq[["Dead-Letter Queue"]]:::async

  client -->|"register / cancel job"| api --> db
  db -->|"poll lookahead window"| sched
  coord -.->|"leader election"| sched
  sched --> wheel --> queue --> worker
  worker --> target
  worker --> history
  worker -->|"retries exhausted"| dlq`,
      },
    ],
    approaches: [
      {
        name: 'Single Cron Process (Naive)',
        description: 'One process polls a jobs table every second and calls targets directly. Simple, but a single point of failure that either drops or double-fires jobs on crash, and blocks all jobs behind one slow callback.',
        pros: ['Trivial to implement and understand', 'No coordination infrastructure needed'],
        cons: ['Single point of failure — crash drops or duplicates fires', 'One slow job callback blocks every other job queued behind it', "Cannot scale past one process's throughput"],
      },
      {
        name: 'Min-Heap Priority Queue per Node',
        description: 'Each scheduler node holds all its pending jobs in a min-heap keyed by fire-time. Straightforward and precise, but costs O(log n) per insert/removal and loads far-future jobs into memory unnecessarily.',
        pros: ['Simple, well-understood data structure', 'Exact ordering, no bucket granularity tradeoff'],
        cons: ['O(log n) per insert/removal at millions of jobs', 'Unbounded memory if far-future jobs are loaded eagerly'],
      },
      {
        name: 'Hierarchical Time Wheel',
        description: 'Buckets jobs by coarse-to-fine time granularity (hour wheel cascading to minute/second wheels), giving O(1) amortized insert and fire operations with bounded memory since only the near-term window is resident.',
        pros: ['O(1) amortized insert/fire', 'Bounded memory — only near-term jobs held at fine granularity', 'Proven at scale (Kafka purgatory, Netty, Linux kernel timers)'],
        cons: ['More implementation complexity (cascading buckets)', 'Still needs a durable store as the actual source of truth'],
        usedBy: 'Kafka delayed-operation purgatory, Netty timers — adapted here for distributed cron at Uber/Airbnb/LinkedIn scale',
      },
      {
        name: 'Message-Broker Native Delay Scheduling',
        description: 'Push job triggers directly into a broker\'s native delay feature (e.g. SQS delay queues) instead of maintaining a custom scheduling tier, letting the broker own the "wait until due" logic.',
        pros: ['Offloads scheduling infrastructure entirely to the broker', 'Simple for a small number of jobs or short delays'],
        cons: ['Most brokers cap max delay far below "months out"', 'No first-class support for cron-style recurrence, priorities, or DAG dependencies'],
      },
    ],
    whereThisFits: [
      { layer: 'Job Definition / API', blocks: 'Register, update, cancel jobs without a scheduler restart', key: 'Durable, replicated metadata store', example: "PATCH /jobs/{id} updates a cron expression, effective within seconds" },
      { layer: 'Coordination / Sharding', blocks: 'Assigning ownership of job slices to nodes', key: 'Leader election + lease per shard (etcd/ZooKeeper)', example: "Shard 7's lease expires on node crash; another node claims it and re-scans durable state" },
      { layer: 'Scheduling (Time Wheel)', blocks: 'Deciding when a job is due', key: 'In-memory near-term structure per shard', example: 'Only jobs due in the next 5-10 minute lookahead window are resident' },
      { layer: 'Execution / Workers', blocks: 'Actually performing the job and reporting status', key: 'Independently-scaled pool consuming a durable trigger queue', example: "A spike in slow jobs never backs up the scheduling decision path" },
    ],
    deepDive: [
      {
        title: 'Sharding a live schedule without dropped or duplicated fires',
        body: 'When a scheduler node crashes or a shard rebalance happens (nodes added/removed), the jobs it owned must be picked up by another node without either a gap (job silently missed) or duplication (two nodes both fire it). The standard approach is a lease-based ownership model: each shard owner holds a time-bound lease (via etcd/ZooKeeper) that it must renew periodically; if it fails to renew, the lease expires and another node can claim that shard. Crucially, the newly-claiming node must re-scan the shard\'s "due but not yet confirmed dispatched" jobs from the durable metadata store rather than trusting any in-memory state, because the crashed node\'s memory is gone. This makes the metadata store\'s "dispatched" flag (written transactionally before/at trigger time) the actual source of truth for whether a fire happened — the in-memory time wheel is just an optimization to avoid constant polling, never the durable record.',
        diagram: `sequenceDiagram
  participant N1 as Scheduler Node A (owner)
  participant CO as etcd/ZooKeeper
  participant N2 as Scheduler Node B
  participant DB as Job Store

  N1->>CO: renew lease (shard 7)
  Note over N1: Node A crashes
  N1--xCO: lease renewal missed
  CO->>CO: lease expires
  N2->>CO: acquire lease (shard 7)
  CO-->>N2: lease granted
  N2->>DB: re-scan shard 7 "due, not dispatched"
  DB-->>N2: pending jobs
  N2->>N2: resume dispatch from durable state`,
      },
      {
        title: 'Time wheels vs priority heaps for near-term scheduling',
        body: 'A naive min-heap of all pending jobs works but costs O(log n) per insert/removal and, more importantly, doesn\'t bound memory if millions of far-future jobs are loaded eagerly. A hierarchical time wheel (as used in Kafka\'s purgatory and Netty\'s timer) instead buckets jobs by coarse time granularity — e.g. an hour wheel of day-buckets, cascading down to a minute wheel of second-buckets — so insertion and firing are both O(1) amortized, and only jobs within the current lookahead window need to be resident in memory at fine granularity. The tradeoff is added implementation complexity (cascading jobs from coarse to fine wheels as time approaches) versus the heap\'s simplicity; at the scale of tens of millions of jobs, the O(1) behavior and bounded memory footprint of a time wheel generally win.'
      },
      {
        title: 'Clock skew and daylight-saving/cron ambiguity',
        body: 'Distributed scheduling is deceptively sensitive to clock correctness. Scheduler nodes must rely on a synchronized clock source (NTP, or cloud-provider clock sync) because a node whose clock drifts even a few seconds ahead can fire jobs early relative to the rest of the fleet, and a node drifting behind can miss its dispatch window entirely if downstream SLA checks assume wall-clock time. Cron expressions evaluated in local time zones compound this — a job scheduled for "2:30am America/New_York daily" is ambiguous or nonexistent on DST transition days, and a robust scheduler must explicitly define policy (skip, fire once, fire twice) for those edge cases rather than let it emerge as undefined behavior. Most production systems sidestep the whole class of bugs by storing and evaluating all internal fire-times in UTC and only converting to/from local time at the UI/API boundary.'
      },
      {
        title: 'Job dependencies as a DAG, not a linear chain',
        body: 'Supporting "job B runs after job A succeeds" generalizes into a directed acyclic graph of job dependencies, which introduces two hard problems: cycle detection at registration time (rejecting a dependency graph that would deadlock) and efficient "is this job now runnable" evaluation as upstream jobs complete. The common pattern is an event-driven completion signal — when job A succeeds, it publishes a completion event; a separate dependency-resolution service (or the scheduler itself, consulting an adjacency structure keyed by "jobs waiting on A") checks whether all of B\'s dependencies are now satisfied and, if so, enqueues B for dispatch immediately rather than waiting for B\'s own polling cycle. This keeps dependency-triggered jobs latency-competitive with time-triggered ones, at the cost of maintaining a separate, consistency-sensitive dependency graph structure alongside the time-indexed schedule.'
      }
    ],
    tradeoffs: [
      {
        title: 'At-least-once delivery with idempotency vs true exactly-once',
        body: 'Building genuine exactly-once execution across a distributed queue and worker fleet is extremely hard and, in most practical systems, not actually necessary — what\'s needed is at-least-once delivery of the trigger combined with idempotent execution semantics on the consumer side (e.g. a job execution keyed by (job_id, scheduled_fire_time) that a worker checks against before acting). This shifts complexity onto job authors (their handlers must be safely re-runnable) but avoids the substantial coordination overhead (distributed transactions, two-phase commit style protocols) that true exactly-once would require, and scales far better under partial failures.'
      },
      {
        title: 'Polling lookahead window: latency vs load on the metadata store',
        body: 'A shorter lookahead window (scheduler nodes poll the metadata store more frequently for a smaller slice of near-future jobs) reduces the memory footprint per node and reacts faster to newly-inserted jobs, but increases query load on the metadata store. A longer window amortizes query cost but means a job inserted with a near-immediate fire-time might be invisible to the scheduler until the next poll cycle, risking missed SLA. Systems typically solve this by combining periodic polling (for the bulk, near-future population) with an immediate "fast-path" notification (write-through cache invalidation or a direct enqueue) for jobs registered with a fire-time inside the current window, avoiding the worst case of both approaches.'
      },
      {
        title: 'Centralized shard coordination (ZooKeeper/etcd) vs self-organizing gossip',
        body: 'Using a strongly-consistent coordination service for leader election and shard assignment gives simple, well-understood correctness guarantees but makes that coordination service itself a scaling and availability bottleneck if not carefully provisioned and can add rebalancing latency during large fleet changes. A gossip-based, self-organizing approach (nodes agreeing on shard ownership via a distributed hash ring with heartbeats) removes that central dependency and scales more gracefully, at the cost of a harder-to-reason-about system with weaker consistency guarantees during network partitions — split-brain shard ownership becomes a real risk that must be defended against, usually by making duplicate dispatch merely wasteful rather than incorrect via the idempotency layer.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Coordination Service (etcd/ZooKeeper) Goes Down?',
      body: "Existing shard owners keep operating on their currently-held, unexpired lease, so scheduling and dispatch continue uninterrupted for jobs already assigned — the coordination service is only consulted for lease renewal and rebalancing, not for every dispatch decision. What stops working is any change to shard ownership: a node that crashes during the outage leaves its shard's jobs un-promoted until coordination recovers, since no other node can safely claim a lease it can't verify has actually expired. The system deliberately fails safe here rather than guessing ownership — freezing rebalancing is preferable to a coordination-service split-brain that could let two nodes believe they own the same shard, even though duplicate dispatch would be merely wasteful (not incorrect) thanks to idempotency. Heavy alerting fires immediately so operators can intervene before the frozen shards' SLA windows are breached.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/jobs',
        description: 'Register a one-off or recurring (cron-style) job with a target execution time or schedule.',
        example: '// Request\n{ "cron": "0 * * * *", "payloadRef": "s3://jobs/export.json", "retryPolicy": { "maxAttempts": 5, "backoff": "exponential" } }\n\n// Response 201\n{ "jobId": "job_7f21a", "nextFireAt": "2026-07-16T15:00:00Z" }',
      },
      {
        method: 'PATCH',
        path: '/v1/jobs/{jobId}',
        description: "Update a job's schedule, payload, or retry policy without restarting the scheduler fleet.",
        example: '// Request\n{ "cron": "*/15 * * * *" }\n\n// Response 200\n{ "jobId": "job_7f21a", "nextFireAt": "2026-07-16T14:15:00Z" }',
      },
      {
        method: 'DELETE',
        path: '/v1/jobs/{jobId}',
        description: 'Cancel a pending job. Idempotent — cancelling an already-cancelled or already-fired job is a no-op.',
        example: '// Response 204 No Content',
      },
      {
        method: 'GET',
        path: '/v1/jobs/{jobId}/history?limit=50',
        description: 'Return the execution/audit trail (attempts, statuses, timestamps) for a job.',
        example: '// Response 200\n{ "executions": [ { "attempt": 1, "status": "failed", "startedAt": "...", "error": "timeout" }, { "attempt": 2, "status": "succeeded" } ] }',
      },
      {
        method: 'POST',
        path: '/v1/jobs/{jobId}/dependencies',
        description: 'Declare that this job should only run after one or more upstream jobs succeed (rejected if it would create a cycle).',
        example: '// Request\n{ "dependsOn": ["job_1123", "job_9981"] }\n\n// Response 200\n{ "jobId": "job_7f21a", "dependsOn": ["job_1123", "job_9981"] }',
      },
    ],
    keyTechnologies: [
      { term: 'Hierarchical Time Wheel', definition: 'A bucketed timer structure (coarse buckets far out, fine buckets near-term, cascading as time approaches) giving O(1) amortized insert and fire operations.' },
      { term: 'Distributed Lease', definition: 'A time-bound ownership grant (via etcd/ZooKeeper) that a node must periodically renew; failure to renew lets another node safely claim ownership.' },
      { term: 'Leader Election', definition: 'A coordination protocol that designates exactly one node as authoritative owner of a shard or resource at a time, re-run automatically on failure.' },
      { term: 'Consistent Hashing', definition: 'A hashing scheme mapping jobs/shards to nodes such that adding or removing a node only remaps a small fraction of keys, minimizing rebalancing churn.' },
      { term: 'Dead-Letter Queue', definition: 'A holding queue for messages/jobs that exhausted their retry budget, isolating permanently-failing work from healthy throughput and enabling alerting.' },
      { term: 'Idempotent Consumer', definition: 'A worker designed so that processing the same trigger/message more than once produces the same end state as processing it once — the practical substitute for true exactly-once execution.' },
    ],
    selfAudit: [
      {
        question: 'What happens at the top of every hour when thousands of cron schedules coincide and all fire near-simultaneously?',
        answer: 'This is the expected burst case (up to 50,000/sec in the capacity estimate); the trigger queue absorbs the spike so the execution/worker tier drains it at a sustainable rate, and the scheduling tier itself only needs to promote due jobs into the queue, not execute them synchronously, keeping the scheduling decision path decoupled from execution latency.',
      },
      {
        question: 'Two scheduler nodes briefly both believe they own the same shard during a network partition — what stops duplicate fires?',
        answer: 'Duplicate dispatch is made merely wasteful, not incorrect: every trigger carries an idempotency key checked by the worker/consumer before the side effect is applied, so a split-brain double-dispatch results in one execution and one no-op rather than two real side effects.',
      },
      {
        question: 'How do you detect and reject a job dependency graph that would deadlock?',
        answer: 'Cycle detection runs at registration time on the dependency adjacency structure (e.g. DFS for back-edges) before the new dependency edge is persisted, rejecting the request outright rather than allowing a graph that could never resolve.',
      },
      {
        question: "A job's HTTP callback target is down for 10 minutes — what happens to jobs due during that window?",
        answer: 'Failed executions are retried with exponential backoff by re-enqueuing with a delay rather than blocking the scheduling tier; jobs that exhaust their retry budget land in the dead-letter queue with alerting, while healthy jobs on other targets continue firing on schedule unaffected.',
      },
    ],
    cheatSheet: [
      { question: 'Which scheduling structure?', answer: 'A hierarchical time wheel for O(1) amortized near-term scheduling with bounded memory.' },
      { question: 'Where does state live?', answer: 'A durable, sharded metadata store indexed by next-fire-time; the time wheel is only an in-memory optimization.' },
      { question: 'How is dispatch made effectively-once?', answer: 'A per-shard lease plus an idempotency key on (job_id, scheduled_fire_time) checked by the worker before acting.' },
      { question: 'What happens if the coordination service goes down?', answer: 'Existing leases keep working until they expire; rebalancing pauses rather than guessing ownership.' },
      { question: 'How is it layered?', answer: 'Definition store → sharded scheduling tier → durable trigger queue → independently-scaled execution workers.' },
      { question: 'How does it scale/distribute?', answer: 'Consistent hashing shards jobs across scheduler nodes so no single node owns the whole job set.' },
      { question: 'How are job dependencies modeled?', answer: 'As a DAG with cycle detection at registration and event-driven completion signals triggering downstream jobs immediately.' },
    ],
    expectedDepth: {
      mid: 'Propose a jobs table with a due_at column polled every second, and a queue to decouple triggering from execution. Recognize that a single scheduler process is a single point of failure and that in-memory counters/timers vanish on crash or restart.',
      senior: 'Explain sharding via consistent hashing plus leader election so no node owns the whole job set, and why decoupling "decide it\'s time" from "do the work" via a durable queue keeps a slow callback from blocking dispatch. Compare time wheels vs min-heaps, and describe at-least-once delivery plus idempotent consumers as the practical substitute for true exactly-once execution.',
      staffPlus: 'Address lease-based rebalancing correctness — the durable "dispatched" flag as the actual source of truth, never a node\'s in-memory state — plus clock skew and DST/cron ambiguity handled by evaluating everything internally in UTC. Cover DAG-based job dependencies with cycle detection, and the operational tradeoff between centralized coordination (etcd/ZooKeeper, simple but a bottleneck) and gossip-based self-organizing sharding (scales better, harder to reason about under partitions).',
    },
    keyTakeaways: [
      "Decouple deciding it's time from doing the work — a slow job callback should never block scheduling",
      'Time wheels give O(1) amortized scheduling and bounded memory versus an unbounded min-heap',
      "The durable metadata store's dispatched flag is the real source of truth, not any node's in-memory state",
      'At-least-once delivery plus idempotent workers is the practical substitute for genuine exactly-once execution',
      'Model job dependencies as a DAG with cycle detection, not a linear chain',
    ],
    relatedDesigns: ['delayed-trigger-service', 'notification-system', 'ticket-booking'],
  },
  {
    slug: 'delayed-trigger-service',
    title: 'Delayed Trigger Service',
    difficulty: 'Advanced',
    icon: 'pi pi-hourglass',
    color: '#06b6d4',
    concepts: ['Timer wheels/bucketed delay queues', 'At-least-once webhook delivery', 'Exponential backoff with jitter', 'Sharded delay storage', 'Dead-letter queues'],
    companies: ['Stripe', 'Twilio', 'Shopify', 'Uber'],
    summary: 'A general-purpose "set a timer, fire a webhook later" primitive underpinning things like order-timeout reminders, at massive fan-out and precise delay guarantees.',
    tldr: 'Pending triggers live cheaply in coarse-grained, fire-time-bucketed storage; only the near-term slice (the next few minutes) gets promoted by a poller into an active delivery queue — the same hot/cold split as a timing wheel, which is what lets the system hold hundreds of millions of pending triggers without keeping them all in one hot in-memory structure.',
    problemFraming: 'A platform like Stripe or Shopify issuing hundreds of millions of delayed triggers a day — "send this reminder in 15 minutes," "retry this webhook in an hour" — routinely produces synchronized bursts, since lots of triggers scheduled at slightly different times can still converge on firing within the same few-second window after a flash sale or a batch of cart abandonments. The obvious naive approach — an in-process `setTimeout` or a single min-heap holding every pending trigger in memory — cannot survive a deploy or a crash, since anything not yet fired simply vanishes with the process, and it cannot scale past whatever fits in one machine\'s memory when the platform has on the order of 200 million triggers outstanding at any moment, many scheduled months out. There\'s a second failure mode hiding in the delivery step itself: if one tenant\'s webhook endpoint goes down or turns slow, a naive shared worker pool lets that single tenant\'s retries monopolize connections and delay everyone else\'s on-time delivery. The design problem is really about cheaply representing a mostly-far-future set of timers while guaranteeing precise, isolated delivery for the sliver of them that are actually due soon.',
    priorArt: [
      { title: 'Hierarchical Timing Wheels (Varghese & Lauck, 1987)', description: 'The same hot/cold bucket-promotion structure — far-future items sit in coarse buckets and only get moved into fine-grained structures as their deadline approaches — applied here at the storage layer instead of purely in memory.' },
      { title: "Kafka's delayed-operation purgatory", description: 'A production system that solves an analogous problem (holding large numbers of pending, time-bounded operations without scanning them all) using the same bucketed-timer approach, applied here to webhook triggers instead of Kafka requests.' },
      { title: '"Exponential Backoff And Jitter" (Marc Brooker, AWS Architecture Blog)', description: 'The widely-cited retry strategy this design uses directly for failed webhook deliveries — randomized jitter on top of exponential backoff prevents retries from re-synchronizing into another thundering herd.' },
      { title: 'Circuit breaker pattern (Michael Nygard, "Release It!"; popularized in production by Netflix Hystrix)', description: "The isolation mechanism behind per-tenant concurrency limits — tripping a breaker on a consistently failing target stops one tenant's bad endpoint from starving delivery capacity for everyone else." },
    ],
    coreEntities: [
      { name: 'Trigger', description: 'The persisted record of a scheduled fire: target URL, payload, fire-time, retry policy, current status.' },
      { name: 'Fire-Time Bucket', description: "The coarse-to-fine storage partition a trigger lives in until its deadline approaches and it's promoted." },
      { name: 'Delivery Attempt', description: 'One HTTP call record against a webhook target, success or failure, feeding the retry/backoff decision.' },
      { name: 'Idempotency Key', description: 'A stable identifier attached to every delivery so the receiver can dedupe redelivered at-least-once calls.' },
      { name: 'Tenant', description: 'The isolation boundary for per-client concurrency limits and circuit breakers on the delivery worker fleet.' },
    ],
    requirements: {
      core: [
        'Clients schedule an arbitrary one-off action (usually a webhook callback) to fire after a specified delay or at an absolute future time',
        'Clients can cancel or reschedule a pending trigger before it fires',
        'Triggers fire exactly-once from the client\'s perspective (via dedupe/idempotency), even if delivery must be retried internally',
        'Failed webhook deliveries are retried with backoff and eventually dead-lettered with client-visible status',
        'Clients can query the status/history of a scheduled trigger',
        'Support very short delays (seconds) and very long delays (months) through the same API'
      ],
      belowTheLine: [
        'A batch scheduling API to register thousands of triggers in one call',
        'Per-tenant customizable retry/backoff policies instead of one global default',
        'A dashboard for clients to visualize pending/failed triggers and replay dead-lettered ones',
        'Signed webhook payloads (HMAC) so receivers can verify authenticity, not just dedupe',
      ],
      nonFunctionalTable: [
        { metric: 'Fire-time jitter', target: 'Delivery within a few seconds of requested fire-time, even at massive scale' },
        { metric: 'Durability', target: 'A scheduled trigger survives any single node/AZ failure and still fires' },
        { metric: 'Scale', target: 'Horizontally scalable to hundreds of millions of concurrently pending triggers' },
        { metric: 'Backpressure isolation', target: 'A slow or failing downstream webhook target never stalls unrelated triggers' },
        { metric: 'Multi-tenant isolation', target: 'One noisy client cannot degrade delivery latency for other tenants' },
      ]
    },
    capacityEstimate: 'Assume the service backs a large payments/e-commerce platform issuing ~500M new delayed triggers/day (~5,800/sec average, bursting to 30,000/sec around common patterns like "remind in 15 minutes" firing in near-synchronized waves). Each trigger record — target URL, payload (up to a few KB), fire-time, retry policy, tenant ID — averages ~2KB; storing all pending (not-yet-fired) triggers, if the platform has ~200M outstanding at any moment (many with month-long delays), that\'s ~400GB of live "pending" data that must remain efficiently queryable by approaching fire-time. Fired/completed triggers are archived after a retention window (say 30 days) for audit, adding roughly 500M * 2KB = ~1TB/day before archival compression. Delivery attempts, including retries, run maybe 1.2x the base rate (~6,960/sec) against downstream webhook endpoints, each requiring an HTTP call with a timeout budget (commonly 5-10s), meaning the delivery worker fleet must sustain thousands of concurrent in-flight HTTP connections at any given moment purely from retry overhead.',
    architecture: 'Clients call a scheduling API to register a trigger; the request is validated (target URL, delay/fire-time, payload size limits) and persisted durably before the API acknowledges success — durability-before-ack is non-negotiable here since the entire product promise is "this will fire later, guaranteed." The write lands in a storage layer sharded by a hash of trigger ID or tenant, with a secondary index (or separate sharded table) organized by fire-time bucket, since the dominant access pattern is not "look up by ID" but "give me everything due in the next N minutes."\n\nA fleet of scanner/poller processes, one or more per shard, continuously scans the near-future fire-time buckets (typically the next 1-5 minutes) and moves due triggers into a delivery queue (Kafka or a cloud queue service), then marks them as "dispatched" in storage to prevent a re-scan from picking them up again. This mirrors the classic time-wheel pattern: far-future triggers live cheaply in cold, coarse-grained storage, and only the near-term slice gets promoted into an active, fine-grained structure the poller operates on — this is what lets the system hold hundreds of millions of pending triggers without needing hundreds of millions of items in any hot in-memory structure.\n\nA separate, independently-scaled delivery worker fleet consumes from the delivery queue and performs the actual webhook HTTP call, enforcing per-tenant concurrency limits and circuit breakers so a single tenant\'s failing/slow endpoint can\'t starve delivery capacity for everyone else. Successful deliveries are acknowledged and archived; failures are re-enqueued with exponential backoff and jitter (delay recalculated and the trigger re-inserted into the fire-time index at the new, later bucket) up to a max-retry count, after which the trigger moves to a dead-letter store with a client-visible failed status and, typically, an outbound notification/webhook of its own reporting the failure.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Scheduling API]:::compute
  db[(Triggers Table)]:::database
  target[Webhook Target]:::compute

  client -->|"POST /triggers delay=3600s"| api
  api -->|"INSERT row"| db
  api -->|"in-process setTimeout"| target`,
      },
      {
        title: 'Core Design: Hot/Cold Bucket Split with a Poller',
        mermaid: `flowchart LR
  api[Scheduling API]:::edge
  cold[("Fire-Time Bucketed Store")]:::database
  poller[Poller / Scanner]:::compute
  queue[["Delivery Queue"]]:::async
  worker[Delivery Worker]:::compute
  target[Webhook Target]:::compute

  api -->|"persist trigger"| cold
  poller -->|"scan near-term bucket"| cold
  poller -->|"promote due triggers"| queue
  queue --> worker -->|"HTTP callback"| target`,
      },
      {
        title: 'Incremental: Retry Backoff, Dead-Letter, and Tenant Isolation',
        mermaid: `flowchart LR
  worker[Delivery Worker]:::compute
  limiter[Per-Tenant Concurrency Limiter]:::compute
  target[Webhook Target]:::compute
  cold[("Fire-Time Bucket Store")]:::database
  dlq[["Dead-Letter Queue"]]:::async

  worker --> limiter --> target
  target -->|"failure"| worker
  worker -->|"re-bucket with backoff + jitter"| cold
  worker -->|"max retries exceeded"| dlq`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Scheduling API]:::edge
  cold[("Sharded Fire-Time Bucket Store")]:::database
  poller[Poller Fleet]:::compute
  queue[["Delivery Queue"]]:::async
  limiter[Per-Tenant Limiter]:::compute
  worker[Delivery Worker Fleet]:::compute
  target[Webhook Targets]:::compute
  dlq[["Dead-Letter Store"]]:::async
  archive[("Completed / Archive Store")]:::storage

  client -->|"schedule / cancel"| api --> cold
  poller -->|"scan + promote near-term"| cold --> queue
  queue --> worker --> limiter --> target
  target -->|"failure: backoff + jitter"| cold
  worker -->|"success"| archive
  worker -->|"retries exhausted"| dlq`,
      },
    ],
    approaches: [
      {
        name: 'In-Process Timer / Single Min-Heap (Naive)',
        description: 'Hold every pending trigger as an entry in an in-memory min-heap or a language-level setTimeout, firing whichever is soonest.',
        pros: ['Trivial to implement', 'Sub-millisecond fire-time precision while the process is alive'],
        cons: ['Every pending trigger vanishes on crash or deploy', 'Cannot scale past what fits in one machine\'s memory', 'No multi-tenant isolation whatsoever'],
      },
      {
        name: 'Message-Broker Native Delay Queues',
        description: "Use a broker's built-in delayed-delivery feature (e.g. SQS delay seconds, RabbitMQ delayed-message plugin) to hold each trigger until its fire-time.",
        pros: ['Durability and delivery mechanics come for free from the broker', 'Simple to reason about for short delays'],
        cons: ['Most brokers cap max delay far below the months-long horizons this service needs', 'Rescheduling/cancelling an already-enqueued delayed message is awkward or unsupported', 'Cost scales with the number of in-flight delayed messages, which is expensive at hundreds of millions'],
      },
      {
        name: 'Hierarchical Fire-Time-Bucketed Storage + Poller (chosen)',
        description: 'Store triggers in coarse-to-fine time buckets in durable storage; a poller fleet promotes only the near-term slice into an active delivery queue.',
        pros: ['Scales to hundreds of millions of pending triggers with only a small hot working set', 'Full durability via ordinary database replication', 'Cancels/reschedules are simple row updates before promotion'],
        cons: ['More moving parts than a broker-native approach (poller fleet, bucket cascade logic)', 'Fire-time precision is bounded by poll interval, not instantaneous'],
        usedBy: 'Stripe, Twilio, Shopify, Uber-style internal delayed-webhook infrastructure',
      },
    ],
    whereThisFits: [
      { layer: 'Scheduling API', blocks: 'Client-facing schedule/cancel/reschedule requests', key: 'Durability-before-ack', example: 'REST endpoint backed by a sharded durable store' },
      { layer: 'Cold/Bucketed Storage', blocks: 'The bulk of pending triggers, most not due soon', key: 'Coarse buckets far out, fine buckets near-term', example: 'Sharded table partitioned by day/hour bucket' },
      { layer: 'Poller / Promotion', blocks: 'Moving due triggers from cold storage into an active queue', key: 'Cascades buckets as fire-time approaches', example: 'Per-shard scanner fleet' },
      { layer: 'Delivery Workers', blocks: 'The actual outbound webhook HTTP calls', key: 'Per-tenant concurrency limits + circuit breakers', example: 'Independently-scaled worker fleet consuming the delivery queue' },
    ],
    deepDive: [
      {
        title: 'The hot/cold bucket split for hundreds of millions of pending timers',
        body: 'The fundamental scaling challenge is that most pending triggers are not due soon — a platform might have 200M pending triggers but only a few hundred thousand due in the next minute. Structuring storage as fire-time-bucketed cold storage (e.g. a table partitioned by day, or a sharded KV store keyed by day+shard) with a promotion step into a small, fast-moving "near-term" queue mirrors how OS timer wheels handle millions of software timers with only a handful of active buckets. The poller\'s job-security metric is really just "can it scan and promote the near-term bucket within its polling interval without falling behind" — this is why fire-time bucket granularity (coarser buckets far out, finer buckets close in, cascading down as time approaches, exactly like a hierarchical time wheel) matters more for this system\'s scalability than almost any other single design choice.',
        diagram: `flowchart LR
  far[("Cold: Day Buckets")]:::database
  mid[("Warm: Hour Buckets")]:::database
  near[("Hot: Minute Buckets")]:::cache
  poller[Poller]:::compute
  queue[["Delivery Queue"]]:::async

  far -->|"cascade as day approaches"| mid
  mid -->|"cascade as hour approaches"| near
  near --> poller -->|"due now"| queue`,
      },
      {
        title: 'Guaranteeing "exactly-once" fires when the transport is at-least-once',
        body: 'Both the internal delivery queue and the outbound HTTP call are fundamentally at-least-once — a Kafka consumer can be redelivered a message after a crash-before-commit, and a webhook call whose response is lost to a network blip might have actually succeeded on the receiver\'s end. The system exposes an idempotency key (usually the trigger ID plus a monotonic attempt counter, or a stable key the client controls) in every webhook payload/header so the receiving service can dedupe on its side; internally, marking a trigger "dispatched" happens transactionally with the queue publish (or via a two-phase "reserve, then confirm" pattern) so a crashed poller can\'t both leave a trigger un-dispatched forever and also not have visibly claimed it. True end-to-end exactly-once is not achievable without cooperation from the receiver, so the honest framing given to API clients is "delivered at-least-once, with a stable idempotency key for you to dedupe," which is the same contract every major webhook provider actually offers despite marketing language.'
      },
      {
        title: 'Retry backoff without correlated retry storms',
        body: 'Naive exponential backoff — fixed multiplier, no randomness — causes every failing trigger from a given failure event (say, a downstream service\'s 10-minute outage) to retry in lockstep, creating synchronized load spikes against a recovering service exactly when it\'s most fragile. Adding jitter (randomizing each retry\'s delay within a window around the exponential target) desynchronizes the herd. The subtler design point is that retry delay recalculation must re-insert the trigger into the fire-time-bucketed storage at its new future bucket rather than keeping it in an in-memory retry queue, because a long backoff chain (some webhook targets get retried over hours) must survive the delivery worker that\'s handling it crashing mid-retry — the same durability guarantee that applies to the original schedule has to apply to every subsequent retry.'
      },
      {
        title: 'Per-tenant isolation against one bad actor',
        body: 'Because this is a shared multi-tenant service, a single tenant whose webhook endpoint is misconfigured or simply down can generate a disproportionate share of retry traffic and in-flight connections, starving delivery threads/connections that healthy tenants need. The mitigation is a combination of per-tenant rate/concurrency limits on the delivery worker fleet (bulkheading, similar to how a service mesh isolates blast radius), and a circuit breaker per destination endpoint that trips after a threshold of consecutive failures, moving that tenant\'s pending deliveries into a slower "degraded" retry cadence rather than continuing to burn full-rate delivery attempts against an endpoint that is clearly down. This keeps the tail latency for the 99% of healthy tenants insulated from the 1% of misbehaving ones.'
      }
    ],
    tradeoffs: [
      {
        title: 'Fire-time precision vs poll interval and cost',
        body: 'Tighter poll intervals on the near-term bucket (e.g. every 1 second) give better fire-time precision but multiply the number of scan operations against storage and increase baseline infrastructure cost even during quiet periods. Looser intervals (every 10-30 seconds) are cheaper but introduce jitter directly proportional to the interval — a trigger due at T might not actually dispatch until T+interval. Most systems tier this: a very-near-term bucket (next 60 seconds) polled aggressively, and looser polling for buckets further out, since a trigger due in 3 minutes doesn\'t need second-level precision until it approaches the near-term window anyway.'
      },
      {
        title: 'Durability-before-ack vs write latency',
        body: 'Acknowledging the client\'s schedule request only after the trigger is durably persisted (replicated to multiple nodes/AZs) is the only honest choice given the product promise, but it means every scheduling call pays full replication latency, which matters when clients are scheduling triggers in a tight loop (e.g. one per order line item). The mitigation is batching — accepting a batch of trigger registrations in one API call and durably persisting them together — rather than relaxing the durability guarantee itself, since relaxing it (e.g. ack-then-persist-async) would silently break the core guarantee the whole service exists to provide.'
      },
      {
        title: 'Centralized dead-letter visibility vs added storage/complexity',
        body: 'Keeping failed triggers in an easily queryable dead-letter store with rich failure metadata (last error, attempt history) is valuable for client debugging and support escalations, but it means the system permanently retains a growing tail of failure records that must itself be managed (retention policy, indexing for support queries) rather than simply being dropped. Given that webhook failures are usually the client\'s downstream problem, not the scheduler\'s, the design leans toward retaining and surfacing this data generously — the cost is manageable relative to the trust cost of a client\'s trigger silently vanishing with no explanation.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Poller Fleet Stops Promoting Triggers?',
      body: "This is a fail-safe, not a fail-open/fail-closed, failure mode: triggers are never lost, only delayed, since they remain durably persisted in cold storage the whole time — a stalled poller fleet simply means nothing gets promoted into the delivery queue until it recovers. The visible symptom is growing fire-time jitter (triggers firing minutes or hours late) rather than any dropped triggers, because the promotion step is purely additive on top of durable storage rather than a destructive dequeue. The mitigation is horizontally redundant poller instances per shard with health-checked failover, plus alerting on promotion lag (the gap between a trigger's fire-time and when it actually got promoted) as the leading indicator, well before clients would notice missed deliveries.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/triggers',
        description: 'Schedule an arbitrary one-off webhook to fire after a delay or at an absolute future time.',
        example: '// Request\n{ "targetUrl": "https://merchant.example.com/hooks/order-timeout", "fireAt": "2026-07-16T18:30:00Z", "payload": { "orderId": "o_991" }, "idempotencyKey": "trg_a812f" }\n\n// Response 201\n{ "triggerId": "trg_a812f", "status": "pending", "fireAt": "2026-07-16T18:30:00Z" }',
      },
      {
        method: 'PATCH',
        path: '/v1/triggers/{triggerId}',
        description: 'Reschedule a pending trigger to a new fire-time before it fires.',
        example: '// Request\n{ "fireAt": "2026-07-16T19:00:00Z" }\n\n// Response 200\n{ "triggerId": "trg_a812f", "status": "pending", "fireAt": "2026-07-16T19:00:00Z" }',
      },
      {
        method: 'DELETE',
        path: '/v1/triggers/{triggerId}',
        description: 'Cancel a pending trigger before it fires. Idempotent.',
        example: '// Response 204 No Content',
      },
      {
        method: 'GET',
        path: '/v1/triggers/{triggerId}',
        description: 'Return the current status and metadata of a scheduled trigger.',
        example: '// Response 200\n{ "triggerId": "trg_a812f", "status": "delivered", "fireAt": "...", "deliveredAt": "..." }',
      },
      {
        method: 'GET',
        path: '/v1/triggers/{triggerId}/attempts',
        description: 'Return the delivery attempt history (including failures and backoff delays) for a trigger.',
        example: '// Response 200\n{ "attempts": [ { "attempt": 1, "status": "failed", "httpStatus": 503, "at": "..." }, { "attempt": 2, "status": "succeeded", "at": "..." } ] }',
      },
    ],
    keyTechnologies: [
      { term: 'Hierarchical Time Wheel / Bucketed Delay Queue', definition: 'A storage layout that buckets pending timers by fire-time granularity (coarse far out, fine near-term), letting only the near-term slice occupy hot, fast-moving storage.' },
      { term: 'Exponential Backoff with Jitter', definition: 'A retry strategy that grows delay between attempts exponentially while adding randomness, preventing synchronized retry storms against a recovering downstream service.' },
      { term: 'Idempotency Key', definition: 'A client- or system-generated identifier attached to a delivery so the receiver can safely dedupe redelivered at-least-once webhook calls.' },
      { term: 'Circuit Breaker', definition: 'A per-destination failure detector that trips after repeated consecutive failures, temporarily routing traffic to a degraded/slower path instead of continuing to hammer a clearly-down endpoint.' },
      { term: 'Bulkheading', definition: "Partitioning resources (connections, worker concurrency) per tenant so one tenant's failure or overload cannot exhaust capacity needed by others." },
      { term: 'Dead-Letter Queue', definition: 'A terminal holding store for triggers that exhausted their retry budget, surfaced to clients with rich failure metadata rather than silently dropped.' },
    ],
    selfAudit: [
      {
        question: 'What happens to a trigger scheduled six months out if the near-term bucket schema or poller logic changes?',
        answer: "Far-future triggers live in coarse, cold buckets untouched by near-term poller changes; they are only ever read when cascaded down as their fire-time approaches, so schema evolution only needs backward compatibility for the cascade/promotion step, not for every historical write.",
      },
      {
        question: 'Thousands of clients schedule "remind me in 15 minutes" at the exact same moment — does that create a synchronized spike?',
        answer: 'Yes, at the fire-time bucket the poller promotes; this is mitigated by fanning promoted triggers into a queue that the delivery worker fleet drains at a sustainable rate (queue absorbs the burst) and by adding small random jitter to fire-times where the product allows it, rather than promising second-exact delivery for bulk-scheduled reminders.',
      },
      {
        question: 'How is "exactly-once" actually framed to API clients, given the transport is at-least-once?',
        answer: 'The documented contract is at-least-once delivery with a stable idempotency key for the client to dedupe on their side — the same honest framing every major webhook provider uses, since true exactly-once would require receiver cooperation the service cannot guarantee.',
      },
      {
        question: "One tenant's webhook endpoint has been down for hours — how does that not degrade delivery for everyone else?",
        answer: "A circuit breaker trips for that destination after a failure threshold, moving its pending deliveries into a slower degraded retry cadence, and per-tenant concurrency limits (bulkheading) cap how much of the shared worker fleet's capacity that tenant can consume regardless.",
      },
      {
        question: 'What if the poller falls behind and cannot scan the near-term bucket within its polling interval?',
        answer: 'This shows up directly as growing fire-time jitter; the mitigation is horizontally scaling poller instances per shard and tiering poll frequency (aggressive polling only on the very-near-term bucket, looser further out) so added load concentrates capacity where precision actually matters.',
      },
    ],
    cheatSheet: [
      { question: 'Which storage approach for pending triggers?', answer: 'Hierarchical fire-time-bucketed durable storage (coarse buckets far out, fine buckets near-term), not an in-memory heap and not a broker-native delay queue — the former can\'t survive a crash and the latter caps max delay far below the months-long horizons needed.' },
      { question: 'Where does trigger state live?', answer: 'A sharded durable store (by trigger ID or tenant) with a secondary fire-time-bucket index, since the dominant access pattern is "what\'s due soon," not "look up by ID."' },
      { question: 'How is delivery made idempotent?', answer: 'Every webhook call carries a stable idempotency key (trigger ID + attempt counter) so the receiver can dedupe redelivered at-least-once calls; the honest contract is at-least-once, not exactly-once.' },
      { question: 'What happens if the poller falls behind?', answer: 'Fire-time jitter grows but nothing is lost — triggers stay durably persisted until promoted. Mitigate with horizontally scaled pollers and tiered poll frequency.' },
      { question: 'How is it layered?', answer: 'Scheduling API -> cold bucketed storage -> poller/promotion -> delivery queue -> delivery workers with per-tenant limits -> webhook target.' },
      { question: 'How does it scale/distribute?', answer: 'Shard storage and pollers by trigger ID or tenant; scale the delivery worker fleet independently from the poller fleet since their load profiles differ.' },
      { question: 'How are retry storms avoided?', answer: 'Exponential backoff with jitter on failed deliveries, re-bucketed into cold storage rather than held in memory, so retries desynchronize instead of hammering a recovering downstream service in lockstep.' },
    ],
    expectedDepth: {
      mid: 'Can describe the naive in-memory-timer approach, identify why it fails on crash/scale, and propose durable storage plus a polling worker as the fix.',
      senior: 'Designs the hot/cold fire-time-bucket split, articulates the at-least-once + idempotency-key contract, and reasons about backoff-with-jitter to avoid retry storms.',
      staffPlus: 'Discusses hierarchical bucket cascading at hundreds-of-millions scale, per-tenant bulkheading/circuit breakers to isolate noisy neighbors, and the tradeoffs between poll interval, fire-time precision, and infrastructure cost.',
    },
    keyTakeaways: [
      'A hot/cold, fire-time-bucketed storage split is what lets the system hold hundreds of millions of pending triggers without keeping them all in one hot structure.',
      'Durability-before-ack is non-negotiable given the product promise; batching absorbs the latency cost rather than relaxing the guarantee.',
      'The transport is fundamentally at-least-once; the honest contract exposed to clients is at-least-once delivery plus a stable idempotency key.',
      'Backoff needs jitter, not just exponential growth, or retries from a shared failure event resynchronize into another thundering herd.',
      'Per-tenant bulkheading and circuit breakers keep one misbehaving client from degrading delivery latency for everyone else.',
    ],
    relatedDesigns: ['job-scheduler', 'notification-system', 'rate-limiter'],
  },
  {
    slug: 'digital-wallet',
    title: 'Digital Wallet (PhonePe / Venmo)',
    difficulty: 'Advanced',
    icon: 'pi pi-wallet',
    color: '#10b981',
    concepts: ['Double-entry ledger', 'ACID transactions/idempotency', 'Saga pattern for cross-service transfers', 'Event sourcing for balance reconstruction', 'Reconciliation and fraud detection'],
    companies: ['PhonePe', 'Venmo', 'Cash App', 'Paytm'],
    summary: 'A peer-to-peer payments system where money must never be created, destroyed, or duplicated, even under concurrent transfers, retries, and partial failures.',
    tldr: "A user's balance is never a mutable counter — it's the sum of immutable, balanced double-entry ledger rows, and every mutation is idempotency-keyed, which is what makes concurrent transfers composable without lost-update races and makes the whole system self-auditing rather than just self-reporting.",
    problemFraming: 'PhonePe and Cash App-scale wallets process tens of millions of peer-to-peer transfers a day across accounts that are, by definition, always being read and written concurrently by other transfers — a naive design that runs `UPDATE accounts SET balance = balance - amount` followed by a separate `UPDATE ... balance + amount` will lose money or create it out of thin air the moment two transfers touching the same account interleave, because each update reads a "current balance" that the other transaction may have already invalidated. It gets worse on real mobile networks: a client that times out and retries a transfer, without an idempotency key, will silently double-debit the sender because the server has no way to tell a retried request from a second, genuine transfer. And even if concurrency and retries were solved, a mutable balance column gives you no way to explain, after the fact, how an account ended up at an incorrect number — there\'s no history to re-derive it from. The core problem this design has to solve isn\'t moving money per se, it\'s making every balance change provably correct and reconstructable, forever, under concurrency and failure.',
    priorArt: [
      { title: 'Double-entry bookkeeping (Luca Pacioli, 1494)', description: "The centuries-old accounting principle underpinning the whole ledger: every transaction is recorded as a balanced debit/credit pair, so the books are self-checking — any error shows up as a nonzero sum rather than a silently wrong balance." },
      { title: '"Introducing Ledger Store" (Uber Engineering blog)', description: 'A real production write-up of an immutable, append-only financial ledger built on exactly this pattern — balances as derived projections of ledger entries rather than mutable fields — at a scale comparable to this design.' },
      { title: 'Sagas (Garcia-Molina & Salem, 1987)', description: "The long-running-transaction pattern used here for cross-shard transfers and external bank-rail top-ups/withdrawals, where a single ACID transaction isn't possible and compensating actions are needed if a later step fails." },
      { title: 'Idempotency keys (Stripe API design)', description: 'Stripe\'s widely-adopted pattern of a client-generated key attached to every mutating request, which this design uses the same way — a retried "send money" request returns the original result instead of creating a duplicate transfer.' },
    ],
    coreEntities: [
      { name: 'Account', description: "A user's or merchant's wallet, identified by ID, whose balance is a derived projection, not a stored field." },
      { name: 'Ledger Entry', description: 'An immutable, append-only debit or credit row against one account, always written as part of a balanced pair.' },
      { name: 'Transaction', description: 'The client-visible unit of work (a transfer, top-up, or withdrawal) grouping one or more ledger entries.' },
      { name: 'Idempotency Key', description: 'A client-generated identifier that maps a mutating request to its one true resulting transaction across retries.' },
      { name: 'Saga', description: 'The orchestration record tracking a multi-step, cross-shard or cross-rail transaction and its compensating actions.' },
    ],
    requirements: {
      core: [
        'Users can link a bank account/card and top up their wallet balance',
        'Users can send money peer-to-peer to another wallet user, instantly reflected in both balances',
        'Users can withdraw wallet balance back to a linked bank account',
        'Users can view a full, accurate transaction history/statement',
        'System supports merchant payments and refunds in addition to P2P transfers',
        'Failed or duplicate transaction attempts must never result in incorrect balances'
      ],
      belowTheLine: [
        'Scheduled/recurring transfers (e.g. rent, subscriptions)',
        'Multi-currency wallets with FX conversion at transfer time',
        'Split payments across a group of users',
        'Spending analytics and budget alerts for users',
      ],
      nonFunctionalTable: [
        { metric: 'Ledger correctness', target: 'Sum of all ledger entries == 0 at all times (provably balanced)' },
        { metric: 'Consistency', target: 'Strong consistency for balance reads/writes; zero lost updates or double-spends under concurrency' },
        { metric: 'Availability', target: 'Degrades gracefully (queues transfers) during bank-rail outages rather than losing them' },
        { metric: 'Auditability', target: '100% of balance changes traceable to an immutable, append-only ledger record' },
        { metric: 'Idempotency', target: 'Every mutating operation safe to retry with no duplicate financial effect' },
      ]
    },
    capacityEstimate: 'Assume 100M registered users with 20M daily active users performing an average of 2 transactions/day, giving ~40M transactions/day (~460 TPS average, spiking to 5,000+ TPS during peak windows like salary-day or a major sale event). Each transaction, modeled as a double-entry ledger record (debit leg + credit leg, each with account ID, amount, currency, timestamp, transaction ID, and reference metadata), is roughly 500 bytes per leg, so ~1KB/transaction, giving ~40GB/day and ~14.6TB/year of core ledger data — a figure that must be retained indefinitely for regulatory/audit purposes, so cold-tiered storage after an active window (e.g. 1 year hot, then archived) is essential. Balance lookups dominate read traffic: every app open checks balance, so with 20M DAU checking balance ~5 times/day, that\'s 100M reads/day (~1,150 QPS average) that should be served from a fast cache backed by the authoritative ledger, not by summing ledger entries per request. At 5,000 peak TPS with each transaction requiring a strongly consistent read-modify-write on at least two account balances, the ledger database\'s write tier must be provisioned (via sharding by account ID) to sustain roughly 10,000 balance-row updates/sec at peak.',
    architecture: 'The system of record is a double-entry ledger: every transaction is represented as a balanced pair (or set) of debit/credit entries against account IDs, stored as immutable, append-only rows. This is the single most important architectural decision — balances are never stored as a mutable "current balance" field that gets directly decremented/incremented in place; instead, an account\'s balance is defined as the sum of all its ledger entries, which makes the system self-auditing (any discrepancy is detectable by re-summing) and makes concurrent transfers composable without lost-update races, since each transaction is its own new, immutable row rather than a contested update to shared mutable state.\n\nFor performance, a materialized balance cache (backed by the same database or a fast KV store) is maintained alongside the ledger and updated transactionally with each new entry, so that balance reads don\'t require summing potentially millions of historical rows — but the cache is always treated as a derived, rebuildable projection of the ledger, never the source of truth. A P2P transfer request flows through a transaction service that validates sufficient balance (via the cache, then confirmed against the ledger inside the transaction), writes the balanced debit/credit pair atomically (single-database ACID transaction if both accounts are co-located in the same shard; a saga/two-phase commit-style orchestration across shards or across a top-up\'s external bank rail if not), updates both parties\' cached balances, and only then returns success to the client.\n\nEvery mutating request carries a client-generated idempotency key, stored alongside the transaction record, so that a network-retried "send $50" request is detected and returns the original result rather than creating a duplicate transfer — this is what makes the system safe against the inherently unreliable mobile networks its clients run on. External money movement (bank top-ups, withdrawals) is handled by a separate integration layer talking to payment rails/card networks, modeled as its own saga with compensating actions (e.g. if a bank withdrawal is initiated but the rail times out, the wallet balance is only debited once the rail confirms, and a pending-state entry brackets the uncertain window). Asynchronously, a reconciliation service continuously cross-checks the internal ledger against external bank/rail statements and flags mismatches, and a fraud/risk service scores transactions in near-real-time (velocity checks, anomaly detection) against a stream of transaction events, able to hold or reverse suspicious transfers within a short window before they\'re considered final.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Transfer API]:::compute
  pg[(Accounts Table: balance column)]:::database

  client -->|"POST /transfer"| api
  api -->|"UPDATE balance = balance - amount"| pg
  api -->|"UPDATE balance = balance + amount"| pg`,
      },
      {
        title: 'Core Design: Double-Entry Ledger with a Balance Cache',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Transaction Service]:::compute
  ledger[("Append-Only Ledger")]:::database
  cache[("Balance Cache")]:::cache

  client -->|"POST /transfer"| api
  api -->|"write balanced debit/credit rows"| ledger
  api -->|"update derived balance"| cache
  client -->|"GET /balance"| cache`,
      },
      {
        title: 'Incremental: Sharding by Account and Cross-Shard Sagas',
        mermaid: `flowchart LR
  api[Transaction Service]:::compute
  shardA[("Ledger Shard A")]:::database
  shardB[("Ledger Shard B")]:::database
  saga[Saga Orchestrator]:::compute

  api -->|"same-shard transfer"| shardA
  api -->|"cross-shard transfer"| saga
  saga -->|"reserve debit"| shardA
  saga -->|"confirm credit"| shardB
  saga -.->|"compensate on failure"| shardA`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  lb[API Gateway]:::edge
  txn[Transaction Service]:::compute
  ledger[("Sharded Append-Only Ledger")]:::database
  cache[("Balance Cache")]:::cache
  saga[Saga Orchestrator]:::compute
  bank[["Bank Rail / Card Network"]]:::async
  recon[Reconciliation Service]:::compute
  fraud[Fraud/Risk Service]:::compute
  events[["Transaction Event Stream"]]:::async

  client --> lb --> txn
  txn -->|"balanced debit/credit"| ledger
  txn --> cache
  txn <-->|"cross-shard"| saga
  txn <--> bank
  ledger --> events
  events --> recon
  events --> fraud
  recon -.->|"flag mismatch"| ledger
  fraud -.->|"hold / reverse"| txn`,
      },
      {
        title: 'Core Flow: P2P Transfer with Idempotency (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant T as Transaction Service
  participant L as Ledger DB
  participant Cache as Balance Cache

  C->>T: POST /transfer (idempotencyKey=k1, amount=50)
  T->>T: check idempotency key
  alt key seen before
    T-->>C: return cached result
  else new request
    T->>L: BEGIN TXN: check balance, insert debit+credit rows, store key
    L-->>T: committed
    T->>Cache: update sender & receiver balances
    T-->>C: 200 success
  end`,
      },
    ],
    approaches: [
      {
        name: 'Mutable Balance Column (Naive)',
        description: "Store each account's balance as a single column, decremented/incremented in place on every transfer.",
        pros: ['Trivial schema and queries', 'Fast single-row reads'],
        cons: ['Lost-update races under concurrent transfers on the same account', 'No history to reconstruct how a balance was reached', 'No mechanically checkable correctness invariant'],
      },
      {
        name: 'Event Sourcing with On-Demand Replay',
        description: "Store every transfer as an event; reconstruct an account's balance by replaying its full event history on read.",
        pros: ['Full history by construction', 'No separate cache to keep in sync'],
        cons: ['Replaying millions of historical events per read is prohibitively slow at scale', 'Still needs a snapshot/cache strategy in practice, undermining the simplicity'],
      },
      {
        name: 'Double-Entry Ledger + Materialized Balance Cache (chosen)',
        description: 'Balances are the sum of immutable, balanced debit/credit ledger rows; a transactionally-updated cache serves fast reads.',
        pros: ['Mechanically checkable correctness (sum-to-zero invariant)', 'No lost-update races — transfers are new rows, not contested updates', 'Fast reads via the cache without sacrificing auditability'],
        cons: ['More moving parts than a single mutable column', 'Cache must be kept transactionally coupled to the ledger or it can drift'],
        usedBy: 'PhonePe, Venmo, Cash App, Uber Ledger Store',
      },
    ],
    whereThisFits: [
      { layer: 'Transaction Service', blocks: 'Validating and writing balanced debit/credit pairs', key: 'Idempotency-keyed, ACID per shard', example: 'API layer fronting the sharded ledger' },
      { layer: 'Sharded Ledger', blocks: 'The immutable, append-only system of record', key: 'Sharded by account ID', example: 'Relational database with row-level locking' },
      { layer: 'Balance Cache', blocks: 'Fast balance reads on the hot path', key: 'Derived, rebuildable, updated transactionally', example: 'KV store updated in the same transaction as the ledger write' },
      { layer: 'Saga / Bank Rail Integration', blocks: 'Cross-shard transfers and external top-ups/withdrawals', key: 'Compensating actions on partial failure', example: 'Saga orchestrator talking to card networks/bank rails' },
    ],
    deepDive: [
      {
        title: 'Double-entry ledger as the correctness foundation',
        body: 'Modeling money movement as balanced debit/credit pairs, borrowed directly from centuries-old accounting practice, is what gives the system a mechanically checkable invariant: for any closed set of accounts, the sum of all entries is always zero. This means a background job can continuously verify system-wide correctness by summing entries, and any bug that would otherwise silently create or destroy money instead produces a detectable imbalance. Practically, this means "sending $50" is never implemented as two separate updates (subtract from A, add to B) that could partially fail; it\'s implemented as one atomic write of a balanced set of rows. The append-only, immutable nature of ledger rows also means there\'s no "lost update" concurrency hazard on the ledger itself — concurrent transfers from the same account are new rows, not contested writes to one row — though this pushes the concurrency problem onto correctly computing/caching the derived balance, discussed separately.'
      },
      {
        title: 'Preventing double-spends under concurrent transfers',
        body: 'If two transfers debit the same account concurrently, both reading a stale "sufficient balance" snapshot before either commits, the account can go negative — a double-spend. The fix is to make balance-check-and-debit atomic per account: either a database transaction with `SELECT balance FOR UPDATE` (pessimistic, serializing writes per account) or an optimistic check via a version/sequence number on the cached balance combined with a conditional write, retried on conflict. Sharding the ledger by account ID means this contention is naturally scoped to a single account\'s shard rather than a global lock, so the system\'s worst-case serialization point is "how fast can one account process its own transfers," which for the vast majority of accounts (not extreme outliers like a large merchant) is a non-issue. Extreme-outlier accounts (a popular merchant receiving thousands of TPS) need a different strategy — batching/aggregating debits with periodic settlement rather than serializing every individual customer payment against one contended row.',
        diagram: `sequenceDiagram
  participant T1 as Transfer Request 1
  participant T2 as Transfer Request 2
  participant DB as Account Shard (row lock)

  T1->>DB: SELECT balance FOR UPDATE (account A)
  DB-->>T1: balance = 100 (locked)
  T2->>DB: SELECT balance FOR UPDATE (account A)
  Note over T2,DB: blocks until T1 commits
  T1->>DB: debit 80, commit
  DB-->>T1: lock released
  DB-->>T2: balance = 20 (locked)
  T2->>DB: debit 80 -> rejected (insufficient funds)`,
      },
      {
        title: 'Idempotency as the actual mechanism, not a nice-to-have',
        body: 'Mobile clients on unreliable networks will retry a "send money" request that appears to have failed (timeout, dropped connection) when it may have actually succeeded server-side. Without idempotency, this is literally how double-charges happen in production payment systems. The fix is requiring every mutating request to carry a client-generated idempotency key (often a UUID generated once per user action, reused across retries of that same action), and the server persists a mapping from that key to the resulting transaction, returning the cached result on any repeat rather than re-executing the transfer. The subtlety is that this mapping write must be transactionally coupled with the ledger write itself — if the ledger commits but the idempotency-key record fails to save (or vice versa), a retry could still double-execute, so both must be part of the same atomic unit of work.'
      },
      {
        title: 'Reconciliation as an ongoing, not one-time, process',
        body: 'Because top-ups and withdrawals cross a trust boundary into external bank rails/card networks that the wallet doesn\'t control, the internal ledger and the external system of record can drift — a rail might confirm a transaction hours after an initial timeout, or report a transaction the wallet never saw due to a dropped webhook. A dedicated reconciliation service periodically pulls settlement files/statements from each external rail and diffs them against the internal ledger\'s pending/external-facing entries, automatically resolving straightforward mismatches (a late confirmation) and escalating genuine discrepancies to a human ops queue. This is treated as a first-class, continuously-running system component rather than an afterthought precisely because it\'s the backstop that catches every class of bug and external-system inconsistency that unit tests and even the ledger\'s internal correctness checks cannot.'
      }
    ],
    tradeoffs: [
      {
        title: 'Immediate strong consistency vs cross-shard transaction complexity',
        body: 'Co-locating frequent counterparties on the same database shard makes their transfers simple single-node ACID transactions, but real P2P graphs are not shard-friendly — any two arbitrary users might transact, and they\'re unlikely to be on the same shard. Cross-shard transfers require a saga or two-phase-commit-style protocol (reserve funds on the sender\'s shard, then confirm on the receiver\'s shard, with compensation if the second step fails), which is materially more complex and has a longer critical path than a same-shard transfer. Systems accept this complexity because the alternative — a single unsharded ledger database — cannot scale write throughput past a single node\'s ceiling, which is a harder constraint to work around than saga complexity.'
      },
      {
        title: 'Materialized balance cache freshness vs re-derivation cost',
        body: 'Always deriving balance by summing ledger entries is the most trustworthy approach (it can never be "wrong" independent of the ledger) but becomes prohibitively slow for accounts with millions of historical entries. Maintaining a materialized, continuously-updated balance cache solves the performance problem but introduces a second piece of state that can, in principle, drift from the ledger if an update path bypasses the transactional coupling between them. The system\'s answer is to make the cache update mandatory and atomic with the ledger write (same transaction) rather than eventually-consistent, and to run periodic re-derivation checks as a correctness backstop — accepting the small overhead of that verification job in exchange for near-instant balance reads on the hot path.'
      },
      {
        title: 'Fraud-hold friction vs transfer speed',
        body: 'Instantly finalizing every transfer gives the best user experience (money "just arrives") but gives fraud/risk systems no window to intervene before funds are irrecoverably moved and potentially withdrawn to an external account. Introducing a short hold/review window for transactions that trip risk heuristics improves the system\'s ability to reverse fraudulent transfers before real-world money leaves the platform, but it means a subset of legitimate users experience added latency or friction on transactions that get flagged by an imperfect model. Most wallets tune this narrowly — near-zero friction for the vast majority of small, typical-pattern transfers, with holds reserved for statistically unusual amounts, velocities, or first-time-counterparty patterns.'
      }
    ],
    failureMode: {
      title: 'What Happens When a Bank Rail Times Out Mid-Transaction?',
      body: "A top-up or withdrawal that times out against an external bank rail is treated as neither definitively succeeded nor failed — it's held in a pending state bracketed by the saga, and the wallet balance is only debited/credited once the rail's confirmation actually arrives (which may be hours later). This is fail-safe by construction: the ledger never guesses at an uncertain external outcome, so the system can never double-credit a top-up or lose a withdrawal to a race between a timeout and a late confirmation. The reconciliation service is the backstop that closes out any pending transaction once the rail's settlement file arrives, automatically resolving the common case (late confirmation) and escalating genuine mismatches to a human ops queue.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/wallet/topup',
        description: 'Top up wallet balance from a linked bank account/card via the bank rail integration layer.',
        example: '// Request\n{ "sourceId": "card_4471", "amount": 5000, "currency": "USD", "idempotencyKey": "top_9a01" }\n\n// Response 202 Accepted\n{ "transactionId": "txn_c88e2", "status": "pending" }',
      },
      {
        method: 'POST',
        path: '/v1/wallet/transfer',
        description: 'Send money peer-to-peer to another wallet user, reflected atomically in both balances.',
        example: '// Request\n{ "toUserId": "u_5521", "amount": 50, "currency": "USD", "idempotencyKey": "trf_k1" }\n\n// Response 200\n{ "transactionId": "txn_77af1", "status": "completed", "newBalance": 1450 }',
      },
      {
        method: 'POST',
        path: '/v1/wallet/withdraw',
        description: 'Withdraw wallet balance back to a linked bank account.',
        example: '// Request\n{ "destinationId": "bank_112", "amount": 2000, "idempotencyKey": "wd_44b2" }\n\n// Response 202 Accepted\n{ "transactionId": "txn_1a90c", "status": "pending" }',
      },
      {
        method: 'GET',
        path: '/v1/wallet/balance',
        description: 'Return the current available balance, served from the materialized balance cache.',
        example: '// Response 200\n{ "userId": "u_1001", "balance": 1450, "currency": "USD" }',
      },
      {
        method: 'GET',
        path: '/v1/wallet/transactions?cursor={cursor}',
        description: 'Return a paginated, accurate transaction history/statement derived from the immutable ledger.',
        example: '// Response 200\n{ "entries": [ { "transactionId": "txn_77af1", "type": "transfer_out", "amount": -50, "at": "..." } ], "nextCursor": "..." }',
      },
    ],
    keyTechnologies: [
      { term: 'Double-Entry Ledger', definition: 'An accounting model where every transaction is recorded as a balanced debit and credit pair against immutable rows, making system-wide correctness mechanically checkable.' },
      { term: 'Idempotency Key', definition: 'A client-generated identifier persisted alongside a transaction so retried mutating requests return the original result instead of re-executing the effect.' },
      { term: 'Saga Pattern', definition: 'An orchestration pattern for multi-step transactions spanning shards or services, using a sequence of local steps plus compensating actions instead of a single distributed transaction.' },
      { term: 'Pessimistic Locking (SELECT FOR UPDATE)', definition: 'A concurrency-control technique that locks a row for the duration of a transaction, serializing concurrent writers to prevent double-spend races on the same balance.' },
      { term: 'Materialized Balance Cache', definition: "A derived, continuously-updated projection of an account's balance kept for fast reads, always rebuildable from the ledger and never treated as the source of truth." },
      { term: 'Reconciliation', definition: 'An ongoing background process that diffs the internal ledger against external bank/rail statements to detect and resolve drift across the trust boundary.' },
    ],
    selfAudit: [
      {
        question: 'What if the ledger write commits but the idempotency-key record fails to save right after?',
        answer: 'This is why the two writes are required to be part of the same atomic transaction rather than two sequential operations — if they were separate, a crash between them would leave the system unable to detect a retry, risking a double-execute; coupling them transactionally makes that window impossible.',
      },
      {
        question: "How does the design handle a merchant account receiving thousands of TPS, well beyond a normal user's transaction rate?",
        answer: "A single contended row can't serialize thousands of writes/sec no matter how well-indexed the shard is, so extreme-outlier accounts move to a batching/aggregation strategy — debits are aggregated and settled periodically rather than each individual payment serializing against the same row.",
      },
      {
        question: 'A bank rail confirms a top-up transaction three hours after the wallet\'s request already timed out and was marked failed — what happens?',
        answer: 'The reconciliation service periodically diffs external rail statements against internal pending/external-facing ledger entries; a late confirmation like this is a straightforward, automatically-resolvable mismatch that updates the transaction to completed, rather than requiring the customer to notice and dispute it.',
      },
      {
        question: 'How do fraud holds avoid breaking the idempotency/retry contract for a legitimate user whose transfer gets flagged?',
        answer: 'A held transaction is recorded as its own distinct state (pending-review) tied to the original idempotency key, so a client retry during the hold window still returns the same in-flight transaction rather than creating a second attempt, and resolution (release or reverse) updates that one record rather than spawning a parallel one.',
      },
      {
        question: "What happens if a cross-shard transfer's confirm step fails after the reserve step already succeeded?",
        answer: "The saga orchestrator runs a compensating action against the sender's shard — reversing the reservation with its own balanced ledger entry — rather than leaving funds in limbo, so the ledger's zero-sum invariant holds even across the multi-step, cross-shard critical path.",
      },
    ],
    cheatSheet: [
      { question: 'How is balance stored?', answer: "Never as a mutable column — balance is the derived sum of immutable, balanced double-entry ledger rows, backed by a transactionally-updated cache for fast reads." },
      { question: 'How are double-spends prevented under concurrency?', answer: 'Atomic balance-check-and-debit per account, via row-level locking (SELECT FOR UPDATE) or an optimistic version check, scoped to that account\'s shard.' },
      { question: 'How are retried requests handled?', answer: 'Every mutating request carries a client-generated idempotency key, persisted transactionally with the ledger write, so a retry returns the original result instead of double-executing.' },
      { question: 'How do cross-shard transfers work?', answer: 'A saga orchestrator reserves on the sender\'s shard, confirms on the receiver\'s shard, and runs a compensating reversal if the confirm step fails.' },
      { question: 'What happens if a bank rail times out?', answer: 'The transaction sits in a pending state; balance is only mutated once the rail confirms, and a reconciliation service closes out late confirmations automatically.' },
      { question: 'How is correctness audited?', answer: 'The zero-sum invariant — summing all ledger entries for a closed set of accounts always equals zero — lets a background job mechanically detect any bug that would create or destroy money.' },
      { question: 'How are extreme-outlier merchant accounts handled?', answer: 'Batching/aggregating debits with periodic settlement instead of serializing thousands of TPS against one contended row.' },
    ],
    expectedDepth: {
      mid: 'Identifies why a mutable balance column races under concurrent transfers and proposes locking or a version check as the fix.',
      senior: 'Designs the double-entry ledger plus materialized balance cache, and explains idempotency keys as the mechanism preventing double-execution on retry.',
      staffPlus: 'Reasons about cross-shard sagas with compensation, reconciliation against external bank rails as an ongoing process, and the fraud-hold-vs-transfer-speed tradeoff at platform scale.',
    },
    keyTakeaways: [
      "Balance is a derived projection of immutable ledger rows, never a mutable field — this is what makes the system self-auditing.",
      'Idempotency keys, transactionally coupled with the ledger write, are the actual mechanism preventing double-charges on retry, not a nice-to-have.',
      'Sharding by account ID scopes double-spend contention to a single account rather than a global lock, at the cost of needing sagas for cross-shard transfers.',
      'Reconciliation against external bank rails is a first-class, continuously-running component, not an afterthought, because it catches drift nothing else can.',
    ],
    relatedDesigns: ['ticket-booking', 'stock-broker', 'rate-limiter'],
  },
{
    slug: 'food-delivery',
    title: 'Food Delivery (Zomato / Uber Eats)',
    difficulty: 'Advanced',
    icon: 'pi pi-truck',
    color: '#f97316',
    concepts: [
      'Geospatial Indexing (Geohash / H3)',
      'Real-Time Dispatch Matching',
      'WebSocket Location Streaming',
      'ETA Prediction',
      'Idempotent Payment Capture'
    ],
    companies: ['Uber Eats', 'DoorDash', 'Zomato', 'Swiggy'],
    summary:
      'A three-sided marketplace matching diners, restaurants, and delivery partners in real time, with live tracking, dynamic dispatch, and tight delivery-time SLAs.',
    tldr: "The core mechanism is splitting the system into two consistency domains: a strongly-consistent order/payment state machine, and an eventually-consistent geospatial index (Redis GEOADD/GEORADIUS over geohash/H3 cells) that drives dispatch — so a stale delivery-partner dot on a map can never corrupt an order, but a double payment capture is never tolerated.",
    problemFraming: 'Uber Eats, DoorDash, Zomato, and Swiggy all run the same three-sided marketplace under brutal, spiky load: tens of thousands of restaurants, hundreds of thousands of delivery partners, and millions of diners, all converging on the same lunch and dinner windows where demand triples in a matter of minutes. The naive approach — one relational table of partner locations, queried with "SELECT nearest partner ORDER BY distance()" on every order — is a full table scan against a constantly moving population, and it falls over long before you reach city scale, let alone during a Friday-night surge. It also conflates two fundamentally different problems: matching (which partner should get this order, updated every few seconds) and tracking (where is my order right now, updated continuously), which have very different latency, consistency, and durability needs. A single-city outage or spike must not cascade to other cities, which a monolithic, non-partitioned dispatch service cannot guarantee. Getting this right means recognizing that "find nearby partners" is fundamentally a spatial indexing problem, not a query-optimization problem.',
    priorArt: [
      { title: "Uber H3 Hierarchical Geospatial Index", description: "An open-sourced hexagonal grid system originally built for Uber's own dispatch and surge-pricing pipelines; the food-delivery design borrows its core idea of bucketing positions into fixed-size cells so proximity search becomes a cell/neighbor-ring lookup instead of a distance scan." },
      { title: 'DoorDash Engineering: Real-Time Dispatch and Batching', description: "DoorDash has published extensively on batching incoming orders into short windows and solving an assignment problem over couriers rather than greedily assigning nearest-available, which is the same batching/offer-timeout pattern used in this design's dispatch algorithm." },
      { title: 'Kafka as an Ordered, Durable Event Log', description: 'The pattern of publishing order-state transitions to a partitioned, durably-ordered log and having downstream services (dispatch, notification, tracking) consume it independently follows the log-as-source-of-truth architecture popularized by Kafka at LinkedIn and now standard across delivery and ride-hailing platforms.' },
      { title: 'Hungarian Algorithm / Assignment Problem', description: 'The classical polynomial-time solution to bipartite matching (minimizing total cost when pairing two sets) underlies the batched dispatch-scoring step, matching ready orders to available partners by ETA and route efficiency rather than one-at-a-time nearest-neighbor.' },
    ],
    coreEntities: [
      { name: 'Order', description: 'The transactional record moving through an explicit state machine, from PLACED through DELIVERED or CANCELLED.' },
      { name: 'Delivery Partner', description: "A courier whose current cell-bucketed location and availability drive dispatch matching." },
      { name: 'Offer', description: 'A time-boxed proposal of an order to one partner, resolved by accept, decline, or timeout.' },
      { name: 'Geo Cell', description: "A geohash/H3-bucketed unit of space used to index partner locations for fast proximity lookup." },
      { name: 'Restaurant', description: 'A menu/catalog-owning entity that accepts, rejects, or flags order items and triggers dispatch on acceptance.' },
    ],
    requirements: {
      core: [
        'Diners browse nearby restaurants and live menus, then place orders with customizations and delivery instructions.',
        'The platform matches each accepted order to a nearby available delivery partner and re-assigns automatically on decline or timeout.',
        'Diners, restaurants, and delivery partners see live order status transitions and the delivery partner\'s location on a map.',
        'Restaurants receive new orders in near real time and can accept, reject, or flag items as unavailable.',
        'Payments are authorized at checkout and captured on restaurant acceptance, with support for promo codes, tipping, and partial refunds.',
        'Diners and delivery partners can rate each other and the order after delivery completes.'
      ],
      belowTheLine: [
        'Batch/group ordering across multiple restaurants in a single checkout',
        'Surge pricing and dynamic incentive payouts for delivery partners',
        'Scheduled orders for a future delivery window',
        'Real-time partner-facing route optimization across multiple concurrent deliveries',
      ],
      nonFunctionalTable: [
        { metric: 'Dispatch decision latency', target: 'Under a few hundred ms, even during city-wide lunch/dinner peaks' },
        { metric: 'Location fan-out latency', target: '3-5 seconds end-to-end from partner GPS ping to tracker display' },
        { metric: 'Consistency model', target: 'Order/payment state strongly consistent; location, search ranking, and ETA eventually consistent' },
        { metric: 'Geo-isolation', target: 'Per-city partitioning so a traffic spike or outage in one city cannot degrade another' },
        { metric: 'Order placement availability', target: 'Stays available during partial backend failures; live map/tracking degrades first' },
      ]
    },
    capacityEstimate:
      'Assume 10M daily active users across served metros, placing an average of 0.3 orders/day each, giving roughly 3M orders/day, or ~35 orders/sec averaged over 24 hours. Lunch and dinner windows concentrate about 3x that average, so peak platform throughput is ~100-110 orders/sec, each fanning out into 5-8 downstream calls (menu check, payment auth, dispatch, restaurant push, tracking updates) for ~700-800 backend ops/sec at peak. The active delivery fleet is ~500K partners platform-wide, with ~15% (75K) online during peak; each streams a GPS ping every 4 seconds, yielding ~18,750 pings/sec at roughly 150 bytes each, or ~2.8 MB/sec of raw ingest. Order records average 2 KB, so 3M orders/day is ~6 GB/day (~2.2 TB/year) of durable order data, cheap for a sharded relational store; raw location history is downsampled 5-10x before long-term storage.',
    architecture:
      'Diner, restaurant, and delivery-partner apps connect through an API gateway to a set of core services. A Catalog/Menu service owns restaurant and menu data, heavily cached in Redis and a CDN since menus change infrequently; a Search/Discovery service (Elasticsearch, indexed by geohash cell plus cuisine and rating) powers the "restaurants near me" browse experience. The Order service owns the order lifecycle and is backed by a relational store sharded by city or order ID, since orders need strong consistency and transactional guarantees around payment state.\n\nWhen a diner places an order, the Order service authorizes payment, persists the order as PLACED, and publishes an event on a Kafka topic partitioned by city. A Restaurant Notification path pushes the order to the restaurant\'s POS/tablet; on acceptance, payment is captured and the order moves to ACCEPTED, which triggers the Dispatch service. Dispatch queries a geospatial index of available delivery partners near the restaurant (partners stream location over a persistent WebSocket/gRPC connection into a Location Ingestion service, which keeps each partner\'s latest position in a Redis geospatial index with a short TTL), ranks nearby candidates, and pushes a time-boxed offer to the top candidate, falling through to the next on decline or timeout.\n\nAs the order proceeds through PICKED_UP, EN_ROUTE, and DELIVERED, location and status events stream through Kafka to a Notification/fan-out service, which pushes updates over WebSocket connections held at an edge gateway to the diner\'s tracking screen. Durable order and payment state lives in the relational tier; ephemeral state — live locations, active offers, in-flight ETAs — lives in Redis and in-memory caches, so a cache flush never corrupts an order, only briefly degrades the map view.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Diner App]:::client
  api[Order API]:::compute
  pg[(Orders + Partners Table)]:::database

  client -->|"POST /order"| api
  api -->|"INSERT order"| pg
  api -->|"SELECT nearest partner (full table scan)"| pg`,
      },
      {
        title: 'Core Design: Geospatial Index and Dispatch Service',
        mermaid: `flowchart LR
  client[Diner App]:::client
  order[Order Service]:::compute
  pg[("Order DB")]:::database
  queue[["Order Events (Kafka)"]]:::async
  dispatch[Dispatch Service]:::compute
  geo[("Redis Geo Index")]:::cache
  partner[Partner App]:::client

  client -->|"POST /order"| order --> pg
  order -->|"ACCEPTED event"| queue --> dispatch
  dispatch -->|"GEORADIUS nearby partners"| geo
  partner -->|"location ping"| geo
  dispatch -->|"offer"| partner`,
      },
      {
        title: 'Incremental: Live Tracking Fan-Out and ETA',
        mermaid: `flowchart LR
  partner[Partner App]:::client
  ingest[Location Ingestion]:::compute
  geo[("Redis Geo Index")]:::cache
  queue[["Status/Location Stream"]]:::async
  notify[Notification/Fan-out]:::compute
  ws[["Edge WebSocket Gateway"]]:::edge
  diner[Diner App]:::client
  eta[ETA Service]:::compute

  partner -->|"GPS ping every 4s"| ingest --> geo
  ingest --> queue --> notify --> ws --> diner
  queue --> eta --> ws`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  diner[Diner App]:::client
  partner[Partner App]:::client
  restaurant[Restaurant POS]:::client
  gw[API Gateway]:::edge
  catalog[("Catalog/Menu Cache")]:::cache
  search[("Search Index")]:::storage
  order[Order Service]:::compute
  orderdb[("Sharded Order DB")]:::database
  pay[Payment Service]:::compute
  queue[["Kafka: Order Events"]]:::async
  dispatch[Dispatch Service]:::compute
  geo[("Redis Geo Index")]:::cache
  ingest[Location Ingestion]:::compute
  notify[Notification/Fan-out]:::compute
  ws[["WebSocket Gateway"]]:::edge

  diner --> gw
  partner --> gw
  restaurant --> gw
  gw --> catalog
  gw --> search
  gw --> order --> orderdb
  order --> pay
  order -->|"ACCEPTED"| queue --> dispatch
  dispatch -->|"nearby partners"| geo
  partner -->|"GPS ping"| ingest --> geo
  queue --> notify --> ws --> diner
  dispatch -->|"offer"| partner`,
      },
      {
        title: 'Dispatch Offer/Timeout Chain (Sequence)',
        mermaid: `sequenceDiagram
  participant O as Order Service
  participant D as Dispatch Service
  participant Geo as Redis Geo Index
  participant P1 as Partner A (top candidate)
  participant P2 as Partner B (next candidate)

  O->>D: order ACCEPTED (restaurant, items)
  D->>Geo: nearby available partners
  Geo-->>D: [P1, P2, ...]
  D->>P1: offer (15s timeout)
  alt P1 accepts
    P1-->>D: accept
    D->>O: assigned = P1
  else P1 declines or times out
    P1--xD: decline / timeout
    D->>P2: offer (15s timeout)
    P2-->>D: accept
    D->>O: assigned = P2
  end`,
      },
    ],
    approaches: [
      {
        name: 'SQL Table Scan for Nearest Partner (Naive)',
        description: 'Store partner locations in a relational table and query nearest-available with a distance calculation over every row on each order.',
        pros: ['Simple schema, no extra infrastructure'],
        cons: ['Full scan against a constantly-moving population collapses at city scale', 'Cannot sustain lunch/dinner peak load', 'Conflates matching and tracking into one slow query path'],
      },
      {
        name: 'Greedy Nearest-Available Assignment',
        description: 'Assign each order to whichever available partner is currently closest, one order at a time as it arrives.',
        pros: ['Low per-order dispatch latency', 'Simple to reason about and implement'],
        cons: ['Ignores partners already inbound to the same restaurant for another pickup', 'Produces worse aggregate route efficiency than batched assignment', 'Can strand a closer partner arriving moments later'],
      },
      {
        name: 'Geo-Cell Indexing + Batched Assignment (chosen)',
        description: 'Bucket partner locations into geohash/H3 cells for fast proximity lookup, batch ready orders into short windows, and solve a mini assignment problem over candidates.',
        pros: ['Sub-millisecond candidate retrieval regardless of city size', 'Better aggregate route efficiency and partner utilization', 'Scales per-city via partitioning'],
        cons: ['More complex than greedy assignment', 'Batching adds a small deliberate delay to each order', 'Cell size tuning is a real tradeoff (coarse vs fine)'],
        usedBy: 'Uber Eats, DoorDash, Zomato, Swiggy',
      },
    ],
    whereThisFits: [
      { layer: 'Order Service', blocks: 'Strongly-consistent order/payment state machine', key: 'ACID, idempotency-keyed transitions', example: 'Sharded relational store, sharded by city' },
      { layer: 'Dispatch Service', blocks: 'Matching ready orders to available partners', key: 'Batched assignment over geo-cell candidates', example: 'Consumes Kafka order events, queries Redis geo index' },
      { layer: 'Location/Tracking', blocks: 'Live partner position and ETA fan-out', key: 'Eventually consistent, short-TTL, best-effort', example: 'Redis geo index + WebSocket fan-out' },
      { layer: 'Geo-Partitioning', blocks: 'Per-city isolation of load and failure', key: 'City-partitioned Kafka topics and shards', example: 'One city\'s lunch-rush spike stays contained to its shard' },
    ],
    deepDive: [
      {
        title: 'Geospatial Matching with Geohash / H3 Cells',
        body:
          'Finding "delivery partners within 2 km of this restaurant" cannot be a naive scan of a location table at this scale. Positions are bucketed into geohash or H3 cells sized so each cell covers roughly the target search radius; a partner\'s current cell is written on every location update (or only when they cross a cell boundary, to cut write volume). A candidate search becomes a lookup of the target cell plus its ring of neighbors rather than a distance computation over every active partner. Redis geospatial commands (GEOADD/GEORADIUS) or a custom in-memory index built on H3 give sub-millisecond candidate retrieval for tens of thousands of partners per city. The key design tension is cell size: too coarse and searches return too many far-away candidates requiring expensive filtering; too fine and boundary-crossing partners generate excessive index churn.',
        diagram: `flowchart LR
  partner[Delivery Partner]:::client
  ingest[Location Ingestion]:::compute
  geo[("Geohash/H3 Cell Index")]:::cache
  restaurant[Restaurant Cell]:::compute
  dispatch[Dispatch Service]:::compute

  partner -->|"GPS ping"| ingest -->|"write cell + neighbors"| geo
  restaurant -->|"target cell"| dispatch
  dispatch -->|"lookup cell + ring of neighbors"| geo -->|"candidate partners"| dispatch`,
      },
      {
        title: 'The Dispatch Algorithm and Offer Timeout Chains',
        body:
          'Naive "assign to nearest partner" ignores that the nearest partner might already be finishing another delivery two minutes away, or that assigning greedily order-by-order produces worse aggregate outcomes than batching. Production dispatchers typically batch orders that complete their prep-time window within a short rolling interval and solve a mini assignment problem (e.g., a greedy or Hungarian-algorithm-style match) over available partners and ready orders, scoring by ETA, partner idle time, and route efficiency (a partner already inbound to that restaurant for another pickup is favored). Each offer to a partner has a short timeout, typically 12-15 seconds; a decline or timeout immediately re-offers to the next-ranked candidate. The system must track in-flight offers carefully — an accepted-but-not-yet-committed offer must lock the partner from receiving a second concurrent offer.'
      },
      {
        title: 'ETA Prediction Under Uncertainty',
        body:
          'ETA has three independent uncertain legs: restaurant prep time, delivery partner travel to the restaurant, and travel from restaurant to diner. Prep time is modeled per restaurant from historical acceptance-to-ready timestamps rather than a fixed constant, since a busy restaurant on a Friday night behaves very differently from the same restaurant at 3pm. Travel legs use a routing engine (map-matched road network with live traffic weighting) rather than straight-line distance, because straight-line estimates break down badly in dense urban grids with one-way streets and bridges. The displayed ETA is usually a model blending these legs with a live-updating correction term as actual milestones (order accepted, picked up) land, since customers tolerate a shrinking countdown far better than a static estimate that jumps or grows.'
      },
      {
        title: 'Order State Machine and Idempotent Payment Capture',
        body:
          'The order lifecycle (PLACED → ACCEPTED → PREPARING → PICKED_UP → EN_ROUTE → DELIVERED, plus CANCELLED/REFUNDED branches) is modeled as an explicit state machine with a validated set of allowed transitions, enforced at the Order service so a stale or duplicate event (e.g., a retried "accept" push) cannot move an order backward or double-trigger payment capture. Every payment-affecting operation carries an idempotency key derived from the order ID and transition type, so retries from flaky mobile networks or at-least-once message delivery are safe. Cancellations after restaurant acceptance are the hardest case: food may already be in preparation, so refund policy depends on which state the order was in at cancellation time, and that state must be read from the authoritative store, not from a client-cached copy.'
      }
    ],
    tradeoffs: [
      {
        title: 'Batching vs Immediate Dispatch',
        body:
          'Dispatching each order the instant a restaurant accepts it minimizes per-order latency and is simple to reason about, but it dispatches greedily and can leave a partner assigned to a far-away order while a much closer one arrives ninety seconds later. Batching orders into short windows (a few seconds) before running assignment improves aggregate efficiency — fewer miles driven, better partner utilization — at the cost of adding a small, deliberate delay to every order and a more complex assignment algorithm. Most large platforms land on batching during high-density peak periods and near-immediate dispatch during quiet hours, when there are not enough concurrent orders to make batching worthwhile.'
      },
      {
        title: 'Consistency of Order State vs Freshness of Location Data',
        body:
          'Order and payment state cannot tolerate staleness or ambiguity — a double capture or a lost cancellation is a customer-trust and financial problem — so that path goes through a durable, transactional store with careful idempotency. Location data is the opposite: a delivery partner\'s position is inherently stale by the time it is displayed, and briefly showing a slightly wrong dot on a map is harmless. Routing location updates through the same consistency machinery as orders would add latency and load for no real benefit, which is why they are deliberately kept in a separate, best-effort, eventually-consistent path (Redis with short TTLs) rather than unified with the order database.'
      },
      {
        title: 'Push-Based Fan-Out vs Client Polling for Status',
        body:
          'Persistent WebSocket connections deliver order and location updates with low latency and low redundant traffic, but they require holding millions of concurrent stateful connections at the edge, complicating deployment, load balancing, and reconnection handling on flaky mobile networks. Polling is simpler to scale horizontally and tolerates connection drops gracefully, but either wastes bandwidth polling too frequently or feels sluggish polling too rarely. Most systems use a hybrid: WebSocket/push for the live-tracking screen while an order is active, falling back to periodic polling if the socket drops, so the UX stays responsive without making persistent connections a hard dependency for correctness.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Redis Geo Index Goes Down?',
      body: "Because location/dispatch is deliberately kept in a separate, eventually-consistent path from order/payment state, a Redis geo index outage degrades matching and live tracking — new dispatch offers slow or stall, and the map view goes stale — but it never corrupts an in-flight order or double-captures a payment, since those live in the durable, transactional order store. The mitigation is failing open on the tracking UI (show last-known location with a staleness indicator, same as a GPS dropout) and, for dispatch, falling back to a degraded matching strategy (wider retry, cached candidate snapshot, or temporarily routing through a secondary geo-index replica) rather than blocking order acceptance entirely. This separation of consistency domains is the single design decision that keeps a caching-layer outage from becoming a financial-correctness incident.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/orders',
        description: 'Place a new order with items, customizations, and delivery instructions; authorizes payment.',
        example: '// Request\n{ "restaurantId": "r_331", "items": [ { "sku": "combo_1", "qty": 2 } ], "deliveryAddress": {}, "idempotencyKey": "ord_991" }\n\n// Response 201\n{ "orderId": "o_9911", "status": "PLACED", "etaMinutes": 32 }',
      },
      {
        method: 'POST',
        path: '/v1/orders/{orderId}/accept',
        description: 'Restaurant accepts an incoming order, capturing the authorized payment and triggering dispatch.',
        example: '// Response 200\n{ "orderId": "o_9911", "status": "ACCEPTED" }',
      },
      {
        method: 'POST',
        path: '/v1/dispatch/offers/{offerId}/respond',
        description: 'Delivery partner accepts or declines a time-boxed dispatch offer.',
        example: '// Request\n{ "response": "accept" }\n\n// Response 200\n{ "offerId": "of_2231", "orderId": "o_9911", "status": "assigned" }',
      },
      {
        method: 'GET',
        path: '/v1/orders/{orderId}/tracking',
        description: 'Return the current order status and delivery partner location snapshot.',
        example: '// Response 200\n{ "status": "EN_ROUTE", "partnerLocation": { "lat": 12.93, "lng": 77.61 }, "etaMinutes": 8 }',
      },
      {
        method: 'WS',
        path: '/v1/orders/{orderId}/stream',
        description: 'Subscribe to live order status transitions and partner location updates over WebSocket.',
        example: '// Server push\n{ "type": "location", "lat": 12.931, "lng": 77.612, "etaMinutes": 7 }',
      },
    ],
    keyTechnologies: [
      { term: 'Geohash', definition: 'A hierarchical spatial encoding that maps latitude/longitude into a string prefix, letting nearby points share prefixes for fast proximity bucketing.' },
      { term: 'H3', definition: "Uber's hexagonal hierarchical geospatial indexing system, offering more uniform cell shapes and neighbor lookups than square geohash grids." },
      { term: 'Redis GEOADD/GEORADIUS', definition: 'Redis geospatial commands that store points and query members within a radius or bounding cell, giving sub-millisecond nearby-partner lookups.' },
      { term: 'Hungarian Algorithm', definition: 'A polynomial-time algorithm for optimal assignment problems, used to batch-match available delivery partners to ready orders minimizing total cost/distance.' },
      { term: 'Idempotency Key', definition: 'An identifier derived from order ID and transition type attached to payment-affecting operations so retries never double-capture or double-refund.' },
      { term: 'Order State Machine', definition: 'An explicit model of valid order status transitions (PLACED→ACCEPTED→...→DELIVERED) that rejects out-of-order or duplicate transition events.' },
    ],
    selfAudit: [
      {
        question: "What happens if every nearby delivery partner declines or times out on an order's offer chain?",
        answer: 'The dispatch service widens the search radius (next ring of geohash/H3 neighbor cells) and can escalate incentives (surge pay) for that order after a threshold number of declines, while the order itself stays in ACCEPTED with an extended ETA rather than failing outright.',
      },
      {
        question: 'Two dispatch workers process the same order concurrently during a rebalance — could a partner get double-assigned?',
        answer: 'An accepted-but-not-yet-committed offer places a short lock on the partner in the geo index/offer store, so a second concurrent offer to the same partner for a different order is rejected until the first offer resolves, preventing double-assignment.',
      },
      {
        question: "A delivery partner's phone loses GPS signal mid-delivery — what does the diner see?",
        answer: 'The tracking screen shows the last known location with a staleness indicator rather than freezing silently or erroring, since location is explicitly eventually-consistent and best-effort; order status transitions (from restaurant/partner app actions) continue independently of the location feed.',
      },
      {
        question: 'How does geo-partitioning actually stop a spike in one city from affecting another?',
        answer: "Order events are partitioned by city on the Kafka topic, dispatch and geo-index instances are provisioned and scaled per city/region, and the order database is sharded by city — so a lunch-rush spike in one metro saturates only that city's partition/shard, not the shared infrastructure other cities depend on.",
      },
      {
        question: 'A diner cancels an order right as the restaurant marks it PREPARING — what determines the refund outcome?',
        answer: "The Order service reads the authoritative current state from its store (not a client-cached status) at the moment the cancellation request lands, and refund policy branches on that state — a PLACED cancellation is a full refund, while a PREPARING cancellation may apply a partial refund since the restaurant has already incurred cost.",
      },
    ],
    cheatSheet: [
      { question: 'How is nearby-partner search made fast at city scale?', answer: 'Geohash/H3 cell bucketing turns proximity search into a cell-plus-neighbor-ring lookup (Redis GEOADD/GEORADIUS) instead of a distance scan over every active partner.' },
      { question: 'Greedy or batched dispatch?', answer: 'Batched: short rolling windows of ready orders matched against available partners via a mini assignment problem, scoring ETA and route efficiency — better aggregate outcomes than greedy nearest-available.' },
      { question: 'How are offer timeouts handled?', answer: 'Each offer to a partner has a short timeout (~12-15s); decline or timeout immediately re-offers to the next-ranked candidate, with a lock preventing double-assignment mid-offer.' },
      { question: 'How is order/payment consistency kept separate from location freshness?', answer: 'Two consistency domains: strongly-consistent order/payment state in a transactional store, eventually-consistent location/dispatch in Redis with short TTLs — a stale map dot can never corrupt an order.' },
      { question: 'What if the geo index goes down?', answer: 'Dispatch and tracking degrade (slower matching, stale map) but orders and payments are unaffected, since they never depend on the geo index for correctness.' },
      { question: 'How is payment capture made idempotent?', answer: 'Every payment-affecting operation carries an idempotency key derived from order ID and transition type, so retries from flaky networks never double-capture.' },
      { question: 'How does per-city isolation work?', answer: 'Order events partition by city on Kafka; dispatch, geo-index, and database shards are provisioned per city, so one city\'s spike stays contained.' },
    ],
    expectedDepth: {
      mid: 'Identifies that a naive nearest-partner SQL scan cannot scale and proposes a geospatial index as the fix.',
      senior: 'Designs the geo-cell-bucketed dispatch service with batched assignment and offer/timeout chains, and separates order consistency from location freshness.',
      staffPlus: 'Reasons about per-city geo-partitioning for blast-radius isolation, the batching-vs-immediate-dispatch tradeoff under peak load, and how the order state machine keeps idempotent payment capture safe under retries and cancellations.',
    },
    keyTakeaways: [
      'Geohash/H3 cell bucketing turns "nearest partner" from a distance scan into a cell-and-neighbor-ring lookup, which is what makes matching sub-millisecond at scale.',
      'Splitting order/payment (strongly consistent) from location/dispatch (eventually consistent) means a caching-layer outage degrades the map, never the money.',
      'Batched assignment over a short window beats greedy nearest-available on aggregate route efficiency, at the cost of a small deliberate per-order delay.',
      'Per-city partitioning of Kafka topics, dispatch, and database shards is what keeps one city\'s demand spike from cascading platform-wide.',
    ],
    relatedDesigns: ['ride-sharing', 'real-time-leaderboard', 'digital-wallet'],
  },
  {
    slug: 'stock-broker',
    title: 'Stock Broker (Robinhood / Zerodha)',
    difficulty: 'Advanced',
    icon: 'pi pi-chart-line',
    color: '#10b981',
    concepts: [
      'Order Matching Engine (Price-Time Priority)',
      'Sequenced Event Log (Kafka)',
      'Market Data Fan-Out',
      'Risk & Margin Checks',
      'Exactly-Once Order Processing'
    ],
    companies: ['Robinhood', 'Zerodha', 'Interactive Brokers', 'Charles Schwab'],
    summary:
      'A trading platform that accepts orders, enforces risk and margin limits, matches them against a live order book, and streams portfolio and market-data updates with financial-grade correctness.',
    tldr: 'The system treats a single, strictly-ordered append log per instrument as the entire source of truth for order arrival — the in-memory matching engine is just a deterministic, replayable function over that log, which is what makes exactly-once processing and full regulatory auditability possible without sacrificing microsecond-scale matching latency.',
    problemFraming: 'Robinhood, Zerodha, Interactive Brokers, and Charles Schwab all face the same unforgiving constraint: a trading platform cannot lose an order, duplicate a fill, or momentarily show buying power that does not exist, because each of those is a direct financial or regulatory failure rather than a cosmetic bug. Market open, market close, and volatility events (a public example being Robinhood\'s account and infrastructure strain during the 2020-2021 meme-stock surges) can drive order volume to 10-20x normal levels in seconds, and any naive design built on a single relational database — issuing "SELECT best bid/ask FOR UPDATE" and updating balances inline on every order — will buckle under that burst while also creating lock contention that serializes unrelated instruments against each other. The problem is compounded by needing two entirely different correctness regimes at once: nanosecond-sensitive, high-throughput matching, and slow, ACID-strict, seven-year-auditable financial record-keeping. Naively unifying these into one data path is either too slow for matching or too weak for the ledger.',
    priorArt: [
      { title: 'LMAX Disruptor / Business Logic Processor Pattern', description: "LMAX's well-known exchange architecture keeps a single-threaded, in-memory business logic processor per shard backed by a durable input event journal, the same pattern this design uses for a single-threaded, per-instrument matching engine reconstructed from its order log on restart." },
      { title: 'NASDAQ / Exchange Price-Time Priority Order Books', description: "Real exchanges match resting orders using price-then-arrival-time priority on a per-instrument limit order book; this design's price-level-plus-FIFO-queue structure is the standard textbook implementation of that same matching rule." },
      { title: 'Event Sourcing / "Turning the Database Inside Out"', description: "Martin Kleppmann's framing of a durable, ordered log as the primary source of truth — with materialized views (the order book, the ledger) derived from replaying it — is exactly the relationship between the Kafka order log and the matching engine/ledger in this design." },
      { title: 'T+1/T+2 Settlement Cycle', description: 'The real regulatory settlement lag used by U.S. and Indian equity markets is the basis for the ledger tracking separate settled-balance and available-buying-power views rather than treating an executed trade as immediately and fully final.' },
    ],
    coreEntities: [
      { name: 'Order', description: 'A client-submitted request to buy or sell an instrument, carrying type, quantity, price, and an idempotency key.' },
      { name: 'Order Book', description: "Per-instrument bid/ask price levels, each holding a FIFO queue of resting orders awaiting a match." },
      { name: 'Execution', description: 'The result of two orders matching — a trade record with price, quantity, and the two counterparties.' },
      { name: 'Account Ledger', description: "The ACID-consistent record of an account's cash, positions, settled balance, and available buying power." },
      { name: 'Instrument', description: 'A tradable security (equity, option, etc.) with its own dedicated order book and matching partition.' },
    ],
    requirements: {
      core: [
        'Users can place market, limit, and stop orders for equities, and view real-time order book depth and last-traded price.',
        'The system performs pre-trade risk checks (buying power, margin, position limits) before an order reaches the matching engine.',
        'Orders are matched against a price-time-priority order book per instrument, producing trade executions.',
        'Users see real-time portfolio value, open orders, and fill notifications as trades execute.',
        'The platform settles trades (T+1/T+2), updates cash and position balances, and generates statements/tax documents.',
        'Users can cancel or modify open orders, with the system guaranteeing an order cannot be modified after it has started matching.'
      ],
      belowTheLine: [
        'Support for options, futures, and other derivatives beyond simple equities',
        'Fractional share orders',
        'Advanced conditional order types (trailing stop, one-cancels-other, bracket orders)',
        'Programmatic/algorithmic trading API access for power users',
      ],
      nonFunctionalTable: [
        { metric: 'Order acknowledgment latency', target: 'Low tens of ms end-to-end; matching-engine internal latency in microseconds to low milliseconds' },
        { metric: 'Order processing guarantee', target: 'Exactly-once — no order ever lost, duplicated, or matched twice' },
        { metric: 'Consistency & auditability', target: 'Order book and trade history strictly consistent and fully auditable for regulatory record-keeping (7-year retention)' },
        { metric: 'Market data freshness', target: 'Up to a few hundred ms of UI staleness tolerated; the book itself must never be shown self-inconsistent' },
        { metric: 'Burst handling', target: 'Absorb 10-20x normal order volume (market open/close, major news) with zero dropped orders' },
      ]
    },
    capacityEstimate:
      'Assume 5M active accounts, of which 2% (100K) trade on a typical day, placing an average of 3 orders each — about 300K orders/day. Spread over a 6.5-hour trading session that is ~13 orders/sec average, but open and close carry 10-15x that load, so peak sustained throughput needs to be provisioned for roughly 150-200 orders/sec per busy instrument cluster, with headroom to 1,500+/sec platform-wide during volatile events. Each order/execution record is small (~500 bytes including metadata) but must be retained for 7 years for regulatory audit: 300K orders/day x 500 bytes ≈ 150 MB/day, ~55 GB/year, trivial to store but requiring immutable, tamper-evident storage (write-once object storage or an append-only ledger). Market data fan-out is the real bandwidth driver: streaming quotes for 5,000 actively watched symbols to 500K concurrently connected clients at a few updates/sec each is on the order of hundreds of thousands of messages/sec at the WebSocket gateway tier, requiring aggressive fan-out via pub/sub rather than per-client polling of a database.',
    architecture:
      'Client apps submit orders through an Order Gateway, which authenticates the request, assigns it a unique idempotent order ID, and immediately runs it through a Risk/Margin service that checks buying power, existing positions, and account restrictions against a fast in-memory (or Redis-backed) view of account state. Orders that pass risk checks are appended to a durable, strictly ordered log (Kafka, partitioned per instrument or instrument group) — this log is the single source of truth for "what orders exist and in what order they arrived," which is essential for both correctness and regulatory replay.\n\nA Matching Engine consumes each instrument\'s partition in order and maintains that instrument\'s order book — typically two priority structures (bid/ask) ordered by price then arrival time — entirely in memory for speed, with periodic snapshots and the replayable log as its durable backing store. Matches produce Execution events, which are themselves appended to the log and drive three downstream consumers: a Ledger/Settlement service that updates cash and position balances (this is where strict, ACID-style consistency lives, typically backed by a relational database with serializable transactions on the account), a Market Data service that updates the public order book/last-price view and republishes it to a pub/sub fan-out layer, and a Notification service that pushes fill confirmations to the originating user.\n\nMarket data fan-out to clients is deliberately decoupled from the matching path: a dedicated Market Data Gateway tier holds WebSocket connections and subscribes to per-symbol pub/sub topics, so a slow or disconnected client can never add latency back into the matching engine. Historical orders, executions, and statements are written to a durable audit store (append-only, often object storage plus a queryable index) separate from the hot operational path, satisfying long-retention compliance requirements without bloating the low-latency systems.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  api[Order API]:::edge
  pg[(PostgreSQL)]:::database
  client -->|"POST /orders"| api
  api -->|"INSERT INTO orders"| pg
  api -->|"SELECT best bid/ask FOR UPDATE"| pg
  api -->|"UPDATE balances"| pg`,
      },
      {
        title: 'Core Design: Risk Check, Ordered Log, Matching Engine',
        mermaid: `flowchart LR
  client[Client]:::client
  gateway[Order Gateway]:::edge
  risk[Risk/Margin Service]:::compute
  cache[("Account State Cache")]:::cache
  queue[["Kafka (per-instrument log)"]]:::async
  matcher[Matching Engine]:::compute

  client -->|"POST /orders"| gateway
  gateway --> risk
  risk -->|"check buying power"| cache
  risk -->|"pass -> append"| queue
  queue --> matcher`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  client[Client]:::client
  gateway[Order Gateway]:::edge
  risk[Risk/Margin Service]:::compute
  cache[("Account State Cache")]:::cache
  queue[["Kafka (per-instrument log)"]]:::async
  matcher[Matching Engine]:::compute
  ledger[Ledger/Settlement Service]:::compute
  pg[("PostgreSQL Ledger")]:::database
  mdservice[Market Data Service]:::compute
  pubsub[["Market Data Pub/Sub"]]:::async
  mdgw[Market Data Gateway]:::edge
  notif[Notification Service]:::compute
  audit[("Audit Store")]:::storage

  client --> gateway --> risk
  risk --> cache
  risk --> queue --> matcher
  matcher -->|"execution event"| queue
  queue --> ledger --> pg
  queue --> mdservice --> pubsub --> mdgw
  mdgw -.->|"WebSocket quotes"| client
  queue --> notif
  notif -.->|"fill notification"| client
  matcher -->|"orders + executions"| audit`,
      },
      {
        title: 'Core Flow: Order Submission to Fill (Sequence)',
        mermaid: `sequenceDiagram
  participant C as Client
  participant G as Order Gateway
  participant R as Risk Service
  participant K as Kafka (order log)
  participant M as Matching Engine
  participant L as Ledger Service
  participant N as Notification Service

  C->>G: POST /orders (limit buy, idempotencyKey)
  G->>R: check buying power/margin
  R-->>G: pass
  G->>K: append order (durable, ordered)
  K->>M: consume in partition order
  M->>M: match against order book
  M->>K: append execution event
  K->>L: consume execution
  L->>L: debit/credit ledger (ACID)
  K->>N: consume execution
  N->>C: push fill notification`,
      },
    ],
    approaches: [
      {
        name: 'Synchronous DB-Locked Matching (Naive)',
        description: 'Match orders inline against a relational database using SELECT ... FOR UPDATE on the best bid/ask row, updating balances in the same transaction.',
        pros: ['Trivial to build on day one', 'ACID guarantees come for free from the database', 'Easy to reason about for a single instrument at low volume'],
        cons: ['Row locks serialize unrelated orders on the same instrument', 'Collapses under 10-20x open/close burst volume', 'Cannot approach microsecond matching latency'],
      },
      {
        name: 'In-Memory Matching Engine over a Sequenced Log (Chosen)',
        description: "Treat a durable, per-instrument ordered log (Kafka) as the source of truth for order arrival; an in-memory matching engine is a deterministic, replayable function over that log.",
        pros: ['Microsecond-to-millisecond matching latency', 'Exactly-once processing and full regulatory replay for free', 'Cleanly separates hot matching path from the strict-ACID ledger'],
        cons: ['Two distinct correctness regimes to build and operate (log/matching vs. ledger)', 'Recovery logic (replay from offset + snapshot) is nontrivial to get right', 'Requires event-sourcing literacy across the team, not just standard CRUD'],
        usedBy: 'NASDAQ/NYSE-style electronic matching, most modern retail brokerages (Robinhood, Zerodha)',
      },
      {
        name: 'Distributed Lock-Based Sharded Book (Middle Ground)',
        description: "Split a single instrument's book across multiple nodes, coordinating access via a distributed lock instead of pinning the whole book to one thread.",
        pros: ['Some horizontal scaling for the hottest instruments', 'Familiar lock semantics for teams without event-sourcing experience'],
        cons: ['Lock acquisition adds latency to every match attempt', 'Genuine risk of subtle price-time-priority ordering bugs under contention', 'Rarely worth the complexity versus just accepting a bounded hot-instrument queue'],
      },
    ],
    whereThisFits: [
      { layer: 'Order Gateway (Edge)', blocks: 'Auth, idempotency, request shaping', key: 'Account/session token', example: 'Rejects a malformed or duplicate order before it reaches risk checks' },
      { layer: 'Risk/Margin Service', blocks: 'Buying power, margin, position limits', key: 'Account exposure snapshot', example: 'Blocks an order that would exceed available buying power' },
      { layer: 'Matching Engine (per instrument)', blocks: 'Crossing orders into trades', key: 'Instrument log offset', example: 'AAPL book matches a limit buy at $150.25 against a resting ask' },
      { layer: 'Ledger/Settlement', blocks: 'Cash and position finality', key: 'Account ledger transaction', example: 'T+1 settlement moves a trade from pending to settled balance' },
    ],
    deepDive: [
      {
        title: 'Price-Time Priority Matching Internals',
        body:
          'Each instrument\'s order book is two sorted structures — bids and asks — where orders are ranked first by price (best price wins) and, within the same price, by arrival time (first-in-first-matched). This is typically implemented as a price-level map (e.g., a balanced tree or sorted array of price levels) where each level holds a FIFO queue of orders at that price, giving O(log P) access to the best price and O(1) matching within a level. A matching engine is usually single-threaded per instrument specifically to avoid the complexity and latency of locking a shared book across cores; instruments are sharded across matching engine instances by a partition key so no cross-instrument coordination is needed on the hot path. Cancels and modifications must be handled as atomic operations against this same structure to avoid a race where an order is cancelled and matched simultaneously.',
        diagram: `flowchart TD
  book[Order Book: AAPL]:::compute
  bidsTop["Bids @ $150.25: FIFO[o1, o2]"]:::compute
  bidsNext["Bids @ $150.20: FIFO[o3]"]:::compute
  asksTop["Asks @ $150.30: FIFO[o4, o5]"]:::compute
  asksNext["Asks @ $150.35: FIFO[o6]"]:::compute
  book --> bidsTop --> bidsNext
  book --> asksTop --> asksNext
  bidsTop -.->|"price-time match"| asksTop`,
      },
      {
        title: 'Exactly-Once Semantics Through the Order Log',
        body:
          'Financial correctness demands that resubmitting a request after a client timeout never creates a duplicate order and that a crash-and-restart of any service never loses or duplicates a match. The design leans on the ordered log as the single durable checkpoint: the Order Gateway assigns a client-supplied or server-generated idempotency key before writing to the log, so a retried submission is deduplicated at write time rather than relying on downstream services to detect duplicates. The Matching Engine treats its position (offset) in the log as its entire state — on restart, it replays from the last committed offset plus a periodic in-memory snapshot, reconstructing the exact book it had before the crash. This log-as-truth pattern trades some write latency (an order is not "accepted" until durably logged) for the ability to deterministically replay and audit every state transition, which is non-negotiable for a regulated exchange.'
      },
      {
        title: 'Pre-Trade Risk Checks Without Adding Latency',
        body:
          'Every order must be checked against buying power, margin requirements, position/concentration limits, and account restrictions (e.g., pattern day trader rules) before it reaches the matching engine, but running this check against a slow, consistent source of truth on every order would blow the latency budget. The common approach keeps a fast, eventually-refreshed in-memory or Redis view of each account\'s buying power and open-order exposure, updated synchronously whenever an order is accepted or an execution/cancel changes exposure, so risk checks read from a cache that is always at least as current as the account\'s own last action. The genuinely hard edge case is race conditions from multiple concurrent orders on the same account: risk checks and exposure updates for a single account are typically serialized (routed to the same risk-check worker or protected by an account-level lock) so two simultaneous orders cannot both pass a buying-power check that only one can actually satisfy.'
      },
      {
        title: 'Settlement Lag and the Cash/Position Ledger',
        body:
          'A trade executing is not the same as a trade settling — most markets settle T+1, meaning cash and shares do not formally change custodial ownership until one business day later, even though the app shows the position and updated balance immediately. This requires the ledger to track two parallel views per account: settled balance (what has formally cleared) and available/buying power (which includes unsettled proceeds under specific rules, often capped to avoid free-riding). The ledger service is one of the few components in the system that genuinely needs full ACID transactions with serializable isolation, because double-crediting an account or losing a debit is a direct financial loss, unlike a stale market-data tick which is merely a display glitch.'
      }
    ],
    tradeoffs: [
      {
        title: 'In-Memory Matching Speed vs Durability Guarantees',
        body:
          'Keeping the order book fully in memory is what makes microsecond-to-millisecond matching possible, but memory is volatile — a crash mid-match could lose state that has already been acknowledged to a client. The mitigation (writing every order and execution to a durable, ordered log before or immediately as it is processed) reintroduces some latency on the write path in exchange for the ability to fully reconstruct book state after any failure. A pure in-memory design with no durable log would be faster but unacceptable for a regulated financial system; a design that persists every state mutation synchronously to a relational database would be durable but far too slow for active matching, which is why the log-plus-snapshot pattern sits deliberately in between.'
      },
      {
        title: 'Strict Consistency for Money vs Eventual Consistency for Market Data',
        body:
          'Account balances and executions must never be even briefly inconsistent — a user cannot be shown buying power that is not real. Market data (quotes, depth, last price) is the opposite: it is fundamentally a snapshot of a book that is changing continuously, so every client is already seeing a slightly stale view the instant it renders. Applying the same strict-consistency machinery to market data that the ledger requires would be enormously expensive for no real benefit, since traders already understand quotes are momentary; the architecture therefore deliberately spends its consistency budget on money and positions while treating market data fan-out as a best-effort, eventually-consistent broadcast problem.'
      },
      {
        title: 'Single-Threaded-Per-Instrument Matching vs Horizontal Scalability',
        body:
          'Pinning each instrument\'s matching to a single logical thread/process eliminates locking complexity and gives deterministic, easily-audited ordering of matches — a huge win for correctness and regulatory defensibility. Its cost is that a single wildly popular instrument (a meme-stock spike) can become a hot partition that no amount of adding more matching-engine machines can relieve, since that instrument\'s book cannot be split across workers without breaking price-time priority. In practice this is accepted as a bounded, known limitation — worst case, a hot instrument\'s matching queue grows and its acknowledgment latency degrades, which is preferable to the alternative of a distributed, lock-based book that risks silent ordering bugs under load.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Order Log (Kafka) Goes Down?',
      body: 'Unlike a cache used for abuse prevention, the order log is the single source of truth for order arrival, so a fail-open posture (accepting orders without durably logging them) is unacceptable — an order that is acknowledged but never logged can be silently lost, which is a direct financial and regulatory failure. The system must fail closed: the Order Gateway stops accepting new orders (returning a clear rejection) the moment it cannot durably append to the log, rather than risk an unlogged order. Existing resting orders already in the matching engine\'s in-memory book can usually still be cancelled and existing positions remain queryable from the ledger, since those paths do not require new log writes. This is the opposite trade a rate limiter makes: a rate limiter fails open because availability matters more than perfect enforcement, while a trading log fails closed because correctness matters more than availability.',
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/orders',
        description: 'Submit a market, limit, or stop order. Idempotency key required so retried submissions never duplicate an order.',
        example: '// Request\n{ "accountId": "a_5521", "symbol": "AAPL", "side": "buy", "type": "limit", "qty": 10, "limitPrice": 150.25, "idempotencyKey": "ord_88af1" }\n\n// Response 202 Accepted\n{ "orderId": "o_44210", "status": "accepted" }',
      },
      {
        method: 'DELETE',
        path: '/v1/orders/{orderId}',
        description: 'Cancel an open order. Fails with 409 if the order has already started matching.',
        example: '// Response 200\n{ "orderId": "o_44210", "status": "cancelled" }\n\n// Response 409 (already matching)\n{ "error": "order_not_cancellable" }',
      },
      {
        method: 'GET',
        path: '/v1/orders/{orderId}',
        description: 'Fetch current order status, fill quantity, and remaining quantity.',
        example: '// Response 200\n{ "orderId": "o_44210", "status": "partially_filled", "filledQty": 4, "remainingQty": 6 }',
      },
      {
        method: 'GET',
        path: '/v1/accounts/{accountId}/portfolio',
        description: "Return an account's real-time positions, cash balance, and buying power.",
        example: '// Response 200\n{ "cash": 12500.50, "buyingPower": 24800.00, "positions": [ { "symbol": "AAPL", "qty": 25, "avgCost": 148.10 } ] }',
      },
      {
        method: 'WS',
        path: '/v1/market-data/{symbol}/stream',
        description: 'Subscribe to real-time quote, depth, and last-trade updates for a symbol.',
        example: '// Server push\n{ "type": "quote", "symbol": "AAPL", "bid": 150.24, "ask": 150.26, "last": 150.25 }',
      },
    ],
    keyTechnologies: [
      { term: 'Price-Time Priority', definition: 'Order book ranking rule: best price matches first, and among orders at the same price, the earliest-arrived order matches first.' },
      { term: 'Order Book', definition: 'A per-instrument structure of price levels, each holding a FIFO queue of resting orders, split into a bid side and an ask side.' },
      { term: 'Idempotency Key', definition: 'A client- or server-assigned unique token attached to a request so retried submissions are deduplicated rather than double-processed.' },
      { term: 'Sequenced Event Log', definition: 'A durable, strictly-ordered append log (e.g. a Kafka partition per instrument) treated as the single source of truth for order arrival order and state transitions.' },
      { term: 'Buying Power', definition: "An account's available capacity to place new orders, computed from cash, margin, and existing open-order exposure." },
      { term: 'T+1/T+2 Settlement', definition: 'The regulatory delay between a trade executing and cash/shares formally changing custodial ownership.' },
    ],
    selfAudit: [
      {
        question: 'What happens if the matching engine crashes mid-match?',
        answer: "The matching engine holds no state that isn't derivable from the order log — on restart it replays from its last committed log offset plus its most recent in-memory snapshot, reconstructing the exact book state, so an in-flight match is either fully committed to the log (and thus recoverable) or never happened.",
      },
      {
        question: 'What if two orders from the same account race on a buying-power check?',
        answer: 'Risk checks and exposure updates for a single account are serialized — routed to one risk-check worker or protected by an account-level lock — so two concurrent orders can never both pass a check that only one can actually satisfy.',
      },
      {
        question: 'What happens to a single meme-stock instrument that spikes order volume 100x?',
        answer: "Because each instrument is pinned to one matching-engine thread for correctness, that instrument's queue simply grows and its acknowledgment latency degrades — a known, bounded limitation preferred over a distributed lock-based book that risks silent ordering bugs.",
      },
      {
        question: 'How do you prevent a client from being charged for the same order twice after a network retry?',
        answer: 'The Order Gateway assigns and checks an idempotency key before writing to the log, so a retried submission with the same key is recognized and returns the original order\'s status rather than creating a second order.',
      },
      {
        question: 'How would you reconcile a settlement mismatch discovered a day after trades executed?',
        answer: 'Because the ordered log and every execution/ledger transition are immutably retained for audit, the mismatch can be traced by replaying the exact sequence of executions and ledger postings for the affected account against the durable log, rather than trusting only the current ledger snapshot.',
      },
    ],
    cheatSheet: [
      { question: 'Which architecture pattern?', answer: 'A durable per-instrument sequenced log as source of truth, with a deterministic in-memory matching engine replaying it.' },
      { question: 'Where does order state live?', answer: "The Kafka order log is authoritative; the matching engine's book is just a derived, replayable view." },
      { question: 'How to make risk checks atomic?', answer: 'Serialize risk checks and exposure updates per account so two concurrent orders can never both pass a check only one can satisfy.' },
      { question: 'What happens if the order log goes down?', answer: 'Fail closed — reject new orders rather than risk accepting one that never gets durably logged.' },
      { question: 'How is it layered?', answer: 'Gateway (auth/idempotency) → Risk/Margin → Matching Engine → Ledger/Settlement, with market data fanned out separately.' },
      { question: 'How does it scale across instruments?', answer: 'Shard by instrument so each book is single-threaded for correctness, accepting a bounded hot-instrument queue as the tradeoff.' },
      { question: "Why isn't a trade final the instant it executes?", answer: "Because T+1/T+2 settlement means cash and shares don't formally change ownership until later, so the ledger tracks settled balance separately from available buying power." },
    ],
    expectedDepth: {
      mid: 'Explain that orders need to be matched against a live order book and that account balances must update correctly. Propose a relational database with transactions for correctness. Understand at a basic level why price and time matter when matching two orders.',
      senior: 'Articulate why a single relational database with row locks cannot sustain matching at scale, and propose separating a fast in-memory matching engine from a durable order log. Discuss idempotency keys for exactly-once order submission, and the difference between a trade executing and settling (T+1/T+2). Understand why risk checks must be serialized per account.',
      staffPlus: "Design the full split between the sequenced log as source of truth, a deterministic replayable matching engine, and a strictly-ACID ledger, articulating why these need different consistency models. Address hot-instrument scaling limits inherent to single-threaded-per-instrument matching and why that tradeoff is accepted over a distributed lock-based book. Discuss regulatory audit/replay requirements and how they shape the choice of event-sourced architecture over a simpler CRUD design.",
    },
    keyTakeaways: [
      'The order log, not the matching engine, is the actual source of truth — the engine is just a deterministic function over it',
      "Matching speed and ledger correctness need fundamentally different consistency models; don't unify them",
      "Fail closed on the order path — a trading system's job is correctness first, availability second",
      'Price-time priority plus single-threaded-per-instrument matching trades bounded hot-instrument latency for zero ordering bugs',
    ],
    relatedDesigns: ['digital-wallet', 'ticket-booking', 'ride-sharing'],
  },
  {
    slug: 'ride-sharing',
    title: 'Ride Sharing (Uber / Lyft)',
    difficulty: 'Advanced',
    icon: 'pi pi-car',
    color: '#3b82f6',
    concepts: [
      'Geospatial Indexing (S2 / Geohash)',
      'Real-Time Driver-Rider Matching',
      'Dynamic (Surge) Pricing',
      'Live Location Streaming',
      'ETA & Routing Service'
    ],
    companies: ['Uber', 'Lyft', 'Grab', 'Bolt'],
    summary:
      'A ride-hailing platform that matches riders to nearby drivers in real time, streams live location during the trip, and prices rides dynamically based on live supply and demand.',
    tldr: 'Matching is decoupled into a fast, best-effort geospatial layer (S2/geohash cells in Redis) feeding a batched assignment algorithm, while surge pricing is computed as a live per-cell supply/demand signal that gets locked into the trip record at match time so it can never silently drift after the rider has seen a quote.',
    problemFraming: "Uber, Lyft, Grab, and Bolt each run marketplaces where millions of riders and over a million drivers move continuously across a city, and the matching decision has to happen in a few hundred milliseconds against positions that are already stale by the time they are read. A naive approach — \"SELECT * FROM drivers ORDER BY distance(lat,lng) LIMIT 1\" against a live table — cannot keep up with tens of thousands of location pings per second, and even if it could, greedily assigning the single nearest driver to each request independently produces worse city-wide outcomes than briefly batching requests, because drivers are a shared, contested resource under peak demand. Events like concerts, storms, or holidays can spike demand 4x or more in a single neighborhood in minutes, and a system that isn't geo-partitioned will let that local spike degrade matching everywhere else. The problem is really two coupled problems at once — real-time spatial search, and a marketplace-balancing pricing signal — that both have to react on the same short timescale.",
    priorArt: [
      { title: 'Google S2 Geometry Library', description: "A hierarchical spherical-cell indexing scheme (used internally by Uber for exactly this purpose) that discretizes the globe into a searchable cell hierarchy, the basis for the ring-expanding nearby-driver search described in this design." },
      { title: 'Uber H3 Hexagonal Grid', description: "Uber's open-sourced alternative to square geohash cells, offering more uniform neighbor distances for proximity queries — cited here as the geohash/S2 alternative referenced directly in the topic's concept list." },
      { title: 'Bipartite Matching / Assignment Problem', description: 'The batched, ETA-and-efficiency-scored matching of open ride requests to available drivers is a direct application of classical assignment-problem algorithms rather than pure nearest-neighbor greedy matching.' },
      { title: '"Surge Pricing Solves the Wild Goose Chase" (Uber/academic research on dynamic pricing)', description: "Published research analyzing Uber's own trip data showed that dynamic pricing functions as a real-time control loop balancing supply and demand rather than pure profit maximization, the same framing this design uses for locking a surge multiplier at match time." },
    ],
    coreEntities: [
      { name: 'Trip', description: 'The end-to-end record of a ride from request through matching, in-progress, and completion.' },
      { name: 'Offer', description: 'A time-boxed proposal sent to a candidate driver, locking them against other offers until accept/decline/timeout.' },
      { name: 'Geospatial Cell', description: 'An S2/geohash grid cell used to index current driver positions for fast nearby-driver lookups.' },
      { name: 'Surge Zone', description: 'A geographic cell-area over which supply/demand ratio is computed to derive a live pricing multiplier.' },
      { name: 'Location Ping', description: 'A periodic driver position update used to keep the geospatial index and live map fresh.' },
    ],
    requirements: {
      core: [
        'Riders request a trip by specifying pickup and destination, see fare estimates, and are matched to a nearby available driver.',
        'Drivers receive trip requests they can accept or decline within a short window, then navigate to pickup and drop-off.',
        'Both parties see live location of the other and trip status (requested, matched, arriving, in progress, completed) during the trip.',
        'The platform computes dynamic pricing based on real-time supply/demand imbalance in a given area.',
        'Payments are processed automatically at trip completion, including fare, surge multiplier, tolls, and tips.',
        'Riders and drivers rate each other post-trip, and ratings feed into future matching eligibility.'
      ],
      belowTheLine: [
        'Scheduled/advance-booked rides',
        'Multi-stop trips with automatic fare recalculation',
        'Pooled rides matching multiple riders with overlapping routes',
        'Driver-facing demand-heatmap dashboard to guide repositioning',
      ],
      nonFunctionalTable: [
        { metric: 'Matching latency', target: 'Rider-to-driver match completes within a few hundred ms (p99)' },
        { metric: 'Location freshness', target: 'Driver location ingested and queryable within low single-digit seconds' },
        { metric: 'Geo-isolation', target: 'Demand spikes or outages in one city produce zero cross-region blast radius' },
        { metric: 'Consistency model', target: 'Trip and payment state strongly consistent; live location and ETA eventually consistent' },
        { metric: 'Spike resilience', target: 'Matching/pricing pipeline stays available and responsive at 4x+ normal peak demand (concerts, storms, holidays)' },
      ]
    },
    capacityEstimate:
      'Assume 20M monthly active riders across served cities, with ~2M taking a ride on a given day — about 3M trips/day accounting for riders occasionally taking multiple trips. That is ~35 trips/sec on average, but rush hours and Friday/Saturday nights concentrate roughly 4x that, so peak matching throughput needs to comfortably handle 150-200 match requests/sec citywide, with individual dense metros needing dedicated capacity. The active driver fleet is roughly 1-2M drivers globally, with ~10% (100-200K) online at any peak moment, each streaming a location ping every 4 seconds — about 25,000-50,000 pings/sec ingested platform-wide, each ~150 bytes, or a few megabytes/sec of raw ingest. A trip record (pickup/drop-off coordinates, timestamps, fare breakdown, driver/rider IDs) is roughly 1-2 KB; 3M trips/day is 3-6 GB/day (roughly 1.5-2 TB/year), easily handled by a sharded relational store, while raw GPS trails are downsampled before long-term retention.',
    architecture:
      'Rider and driver apps connect through regional API gateways into a set of services partitioned primarily by city/geography, since a ride in one city never needs to match against a driver in another. Drivers maintain a persistent connection (WebSocket or long-lived gRPC stream) to a Location Ingestion service, which writes each driver\'s latest position into a geospatial index — cells sized via S2 or geohash covering a few hundred meters to a couple of kilometers — kept in a fast in-memory/Redis layer, since only the most recent position per driver matters for matching, not history.\n\nWhen a rider requests a trip, the request hits a Matching service, which queries the geospatial index for available drivers in the pickup cell and its neighbors, filters by vehicle type and driver eligibility, and scores candidates by a combination of ETA-to-pickup (from a Routing/ETA service backed by a road-network graph with live traffic weighting) and marketplace efficiency signals. The top candidate receives a time-boxed offer over push notification; on decline or timeout the system falls through to the next candidate, similar in spirit to food-delivery dispatch but tuned for driver idle-time minimization rather than food freshness.\n\nOnce matched, the Trip service becomes the source of truth for trip state, persisted in a relational store sharded by city or trip ID, and both parties receive live updates (driver location, ETA, trip milestones) fanned out through a pub/sub layer to WebSocket connections at an edge gateway. A separate Pricing service continuously computes a supply/demand ratio per geographic cell (open ride requests vs. available nearby drivers) to derive a surge multiplier, which is attached to fare estimates at request time and locked in at the moment of matching so the rider is never charged a fare they did not see quoted. Trip completion triggers payment capture and writes the final trip and fare breakdown to durable storage for receipts and dispute resolution.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  rider[Rider App]:::client
  api[API Server]:::compute
  pg[(PostgreSQL)]:::database
  rider -->|"POST /request-ride (lat, lng)"| api
  api -->|"SELECT * FROM drivers ORDER BY distance(lat,lng) LIMIT 1"| pg
  api -->|"UPDATE drivers SET status='matched'"| pg`,
      },
      {
        title: 'Core Design: Geospatial Index and Matching',
        mermaid: `flowchart LR
  driver[Driver App]:::client
  rider[Rider App]:::client
  gateway[Location Ingestion]:::edge
  geoindex[("Geospatial Index (S2/Geohash)")]:::cache
  matcher[Matching Service]:::compute
  eta[ETA/Routing Service]:::compute

  driver -->|"location ping every 4s"| gateway --> geoindex
  rider -->|"request ride"| matcher
  matcher -->|"query nearby cells"| geoindex
  matcher --> eta`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  rider[Rider App]:::client
  driver[Driver App]:::client
  gw[Regional API Gateway]:::edge
  loc[Location Ingestion]:::edge
  geoindex[("Geospatial Index (Redis)")]:::cache
  matcher[Matching Service]:::compute
  eta[ETA/Routing Service]:::compute
  pricing[Pricing Service]:::compute
  trip[Trip Service]:::compute
  tripdb[("PostgreSQL, sharded by city")]:::database
  pubsub[["Live Update Pub/Sub"]]:::async
  wsgw[WebSocket Gateway]:::edge
  payment[Payment Capture]:::compute

  driver -->|"location ping"| loc --> geoindex
  rider --> gw --> matcher
  matcher -->|"nearby drivers"| geoindex
  matcher --> eta
  matcher --> pricing
  matcher -->|"offer"| driver
  matcher --> trip --> tripdb
  trip --> pubsub --> wsgw
  wsgw -.->|"live location/ETA"| rider
  trip -->|"trip completed"| payment`,
      },
      {
        title: 'Core Flow: Matching With Offer Race Handling (Sequence)',
        mermaid: `sequenceDiagram
  participant Ri as Rider App
  participant M as Matching Service
  participant G as Geospatial Index
  participant D1 as Driver A
  participant D2 as Driver B

  Ri->>M: request ride (pickup coords)
  M->>G: query nearby cells
  G-->>M: candidates [A, B, C]
  M->>M: score by ETA + efficiency
  M->>D1: offer (lock driver A, TTL 10s)
  alt Driver A accepts within TTL
    D1-->>M: accept
    M->>Ri: matched with Driver A
  else Driver A declines or times out
    D1-->>M: decline/timeout
    M->>D2: offer (lock driver B)
    D2-->>M: accept
    M->>Ri: matched with Driver B
  end`,
      },
    ],
    approaches: [
      {
        name: 'Greedy Nearest-Driver Matching (Naive)',
        description: 'Always offer the closest available driver found via the geospatial index.',
        pros: ['Lowest possible latency for any single request', 'Simple to implement and explain', 'Works fine in low-density areas or off-peak hours'],
        cons: ['Suboptimal city-wide utilization under contention', 'Ignores that drivers are a shared, contested resource across many simultaneous requests', 'Can strand a rider seconds after a much closer driver becomes available'],
      },
      {
        name: 'Batched Bipartite Assignment (Chosen)',
        description: 'Batch open ride requests and available drivers over a short rolling window (a few seconds) and solve an assignment problem scored on ETA and fleet-wide efficiency.',
        pros: ['Materially better aggregate fleet utilization', 'Accounts for drivers as a contested, shared resource', 'Scales better during surge, when supply is the binding constraint'],
        cons: ['Adds a small, deliberate delay before an offer is sent', 'More complex scheduler and scoring logic to build and tune', 'Harder to explain to a rider why a particular driver was chosen'],
        usedBy: 'Uber and Lyft in dense metro cores at peak times',
      },
      {
        name: 'Driver-Choice / Auction-Based Matching (Alternative)',
        description: 'Surface open ride requests to nearby drivers and let them choose or bid, rather than the platform assigning a match.',
        pros: ['Gives drivers agency, which can improve retention', 'Naturally incorporates driver preference (destination, trip length)'],
        cons: ['Unpredictable wait times for riders', 'Hard to guarantee a matching-latency SLA', 'More complex UX and cherry-picking of easy/short trips'],
        usedBy: 'Some taxi-hailing apps and driver-choice ride markets',
      },
    ],
    whereThisFits: [
      { layer: 'City/Region Partition', blocks: 'Cross-city isolation', key: 'City ID', example: "A demand spike in one city never consumes another city's matching capacity" },
      { layer: 'Geospatial Cell Index', blocks: 'Nearby-driver lookup', key: 'S2/geohash cell', example: "Ring search expands outward from the rider's cell until enough candidates are found" },
      { layer: 'Matching & Pricing (compute)', blocks: 'Assignment scoring and surge computation', key: 'Trip request', example: 'Batches requests over a short window and locks the surge multiplier at match time' },
      { layer: 'Trip/Payment Persistence', blocks: 'Trip state and payment finality', key: 'Trip ID', example: "The trip record persists the locked fare and driver for later dispute resolution" },
    ],
    deepDive: [
      {
        title: 'Cell-Based Geospatial Indexing for Sub-Second Matching',
        body:
          'Matching a rider to a driver requires answering "which available drivers are near this point" in single-digit milliseconds against a constantly moving population. The standard approach discretizes the map into cells (Google\'s S2 hierarchy or a geohash grid) sized to roughly the expected search radius, and maintains a mapping from cell ID to the set of drivers currently in that cell, updated as drivers cross boundaries. A search expands outward ring by ring from the rider\'s cell — checking the immediate cell, then its neighbors, then the next ring — until enough eligible candidates are found, which is far cheaper than a radius query over a flat table of millions of coordinates. The genuine complexity is keeping this index fresh with minimal write amplification: naively rewriting a driver\'s cell membership on every 4-second ping regardless of movement wastes writes, so systems typically only update the index when a driver actually crosses a cell boundary, tracking raw position separately for display purposes.',
        diagram: `flowchart TD
  center["Rider Cell (S2/Geohash)"]:::cache
  ring1["Ring 1 Neighbors"]:::cache
  ring2["Ring 2 Neighbors"]:::cache
  center -->|"0 candidates found"| ring1
  ring1 -->|"still fewer than K candidates"| ring2`,
      },
      {
        title: 'Matching as a Continuous Assignment Problem',
        body:
          'Treating each ride request independently and greedily assigning the closest driver is simple but demonstrably suboptimal at city scale — it can leave a driver assigned to a far pickup while a much closer request appears seconds later, and it ignores the fact that drivers themselves are a shared, contested resource across many simultaneous requests. Higher-throughput matching engines batch open requests and available drivers over a short rolling window (a few seconds) and solve a bipartite matching or assignment problem scored on ETA-to-pickup and marketplace-level efficiency (minimizing total idle driving), rather than pure nearest-neighbor. The trade is a small, deliberate delay before a match is offered in exchange for materially better fleet utilization, which matters enormously at the margin when driver supply is the binding constraint during a surge.'
      },
      {
        title: 'Surge Pricing as a Real-Time Control Signal',
        body:
          'Surge pricing is not merely "charge more when busy" — it functions as a live control loop that simultaneously discourages some demand and incentivizes idle drivers in adjacent areas to reposition toward the surging zone, restoring balance faster than fixed pricing could. The Pricing service continuously tracks, per geographic cell, a ratio of open/incoming ride requests to available nearby drivers, smoothing this ratio over a short time window to avoid whiplashing the multiplier on every single request. A critical correctness requirement is that the multiplier shown to the rider at request time must be the one actually charged — this means locking the surge value into the trip record at match time rather than recomputing fare from a possibly-changed multiplier at trip completion, which would otherwise let fares fluctuate in ways riders never agreed to.'
      },
      {
        title: 'Handling Driver-Side Race Conditions in Offer Dispatch',
        body:
          'Because a driver might be a candidate for two nearly simultaneous ride requests, the system must guarantee a driver can be "locked" to at most one pending offer at a time, or two riders could both be told the same driver is coming. This is typically implemented with a short-lived lock or status flag on the driver record (e.g., an atomic conditional write such as Redis\'s SETNX or a database row-level update with optimistic concurrency) set the instant an offer is sent and cleared on decline/timeout/accept. The lock TTL must be tuned carefully: too short and a slow-to-respond driver app could be double-offered mid-decision; too long and a driver who declines quickly is needlessly held out of the matching pool, wasting supply during exactly the moments — peak demand — when every available driver matters most.'
      }
    ],
    tradeoffs: [
      {
        title: 'Nearest-Driver Simplicity vs Batched Optimal Assignment',
        body:
          'Always offering the closest driver is easy to implement, easy to explain, and gives the lowest possible latency for any single request. But optimizing purely locally per-request produces worse aggregate outcomes than briefly batching requests and solving a joint assignment, especially at high density where drivers are a genuinely scarce, shared resource. Batching adds real complexity — a scheduler, a small delay budget, and a scoring function balancing ETA against fleet-wide efficiency — and that complexity is only worth paying for in dense urban cores at peak times; many systems fall back to simple nearest-match in low-density areas or off-peak hours where there is rarely more than one reasonable candidate anyway.'
      },
      {
        title: 'Freshness of Location Data vs Ingestion Cost',
        body:
          'Pinging every four seconds from every active driver gives a near-live view of the fleet, which materially improves ETA accuracy and matching quality, but it means ingesting tens of thousands of writes per second platform-wide purely to keep a "current position" field fresh. Lengthening the ping interval cuts ingestion load roughly proportionally but degrades ETA precision and can cause visibly "jumpy" driver icons on the rider\'s map. Most systems resolve this by decoupling display smoothness from index freshness: the app can interpolate a driver\'s icon smoothly between received pings using dead-reckoning off the last known heading and speed, so the backend can ping less frequently than the UI appears to update.'
      },
      {
        title: 'Locking Surge Price at Match Time vs Real-Time Repricing',
        body:
          'Locking the fare multiplier the instant a rider requests a trip gives price certainty and is straightforward to reconcile in a dispute, but it means the platform absorbs the risk if conditions shift dramatically between request and pickup (e.g., a driver cancels and demand has spiked further by the time a new match is found). Continuously repricing until pickup would keep the fare perfectly aligned with live supply/demand at every instant, but erodes rider trust and complicates receipts and refund logic. Virtually all major platforms choose the former — quote-and-lock — treating pricing precision as secondary to the far more valuable property that a rider is never charged something other than what they explicitly agreed to.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Geospatial Index (Redis) Goes Down?',
      body: "Because the platform is geo-partitioned by city, a geospatial index outage is contained to the affected region's matching pipeline and does not cascade to other cities. Within the affected region, matching effectively fails closed — new ride requests cannot find nearby drivers and are queued or shown \"no drivers available\" — since guessing at stale or unindexed positions risks offering a driver who is no longer nearby. Critically, trip state and payment records live in a separate strongly-consistent store, so trips already in progress are completely unaffected by the index outage; only new matching in that region degrades. Recovery is a matter of driver apps re-pinging their position to rebuild the index, which is fast because only the latest position per driver matters, not history.",
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/trips/estimate',
        description: 'Return a fare estimate and current surge multiplier for a given pickup/destination pair.',
        example: '// Request\n{ "pickup": { "lat": 37.77, "lng": -122.41 }, "destination": { "lat": 37.79, "lng": -122.40 } }\n\n// Response 200\n{ "fareEstimateLow": 12.50, "fareEstimateHigh": 15.00, "surgeMultiplier": 1.4 }',
      },
      {
        method: 'POST',
        path: '/v1/trips',
        description: 'Request a ride. Creates a trip in "requested" state and triggers the matching pipeline.',
        example: '// Request\n{ "riderId": "r_2231", "pickup": { "lat": 37.77, "lng": -122.41 }, "destination": { "lat": 37.79, "lng": -122.40 } }\n\n// Response 202\n{ "tripId": "t_88213", "status": "matching" }',
      },
      {
        method: 'POST',
        path: '/v1/trips/{tripId}/respond',
        description: 'Driver accepts or declines an offered trip within the offer TTL window.',
        example: '// Request\n{ "driverId": "d_5510", "response": "accept" }\n\n// Response 200\n{ "tripId": "t_88213", "status": "matched" }',
      },
      {
        method: 'GET',
        path: '/v1/trips/{tripId}',
        description: 'Fetch current trip status, matched driver, and last known ETA.',
        example: '// Response 200\n{ "tripId": "t_88213", "status": "in_progress", "driverId": "d_5510", "etaSeconds": 240 }',
      },
      {
        method: 'WS',
        path: '/v1/trips/{tripId}/stream',
        description: 'Subscribe to live location and ETA updates for the duration of a trip.',
        example: '// Server push\n{ "type": "location", "lat": 37.775, "lng": -122.408, "etaSeconds": 210 }',
      },
    ],
    keyTechnologies: [
      { term: 'S2 Geometry', definition: "Google's hierarchical spherical-cell indexing scheme used to discretize the map into searchable cells for proximity queries." },
      { term: 'Geohash', definition: 'An alternative grid-based geospatial encoding that maps lat/lng into a sortable string prefix, used for cell-based proximity lookups.' },
      { term: 'Bipartite Matching', definition: 'An assignment-problem formulation pairing a batch of open ride requests against available drivers to optimize aggregate ETA/efficiency rather than greedy nearest-neighbor.' },
      { term: 'Surge Multiplier', definition: 'A dynamically computed price multiplier per geographic cell, driven by the ratio of open requests to available drivers, locked into the fare at match time.' },
      { term: 'Distributed Lock (SETNX)', definition: 'An atomic conditional-write primitive used to hold a driver exclusively against one pending offer, preventing double-dispatch.' },
      { term: 'Dead Reckoning', definition: "Client-side interpolation of a driver's position between GPS pings using last known heading/speed, smoothing the UI without increasing ping frequency." },
    ],
    selfAudit: [
      {
        question: 'What if two ride requests both target the same driver at nearly the same instant?',
        answer: 'The driver record is locked with an atomic conditional write (e.g. Redis SETNX) the instant an offer is sent, so only one matching flow can hold the lock — the second request\'s matcher sees the driver as unavailable and moves to its next candidate.',
      },
      {
        question: "What happens if a driver's app loses connectivity mid-trip?",
        answer: 'Trip state itself lives in the strongly-consistent Trip service and is unaffected; only the live-location stream (eventually consistent) goes stale, and the UI falls back to the last known position plus dead-reckoning until pings resume or a timeout flags the driver as disconnected.',
      },
      {
        question: 'How do you prevent the surge price from changing after a rider sees the quote?',
        answer: 'The surge multiplier is locked into the trip record at the moment of matching, not recomputed at trip completion, so the rider is always charged exactly the multiplier they were quoted regardless of how conditions shift afterward.',
      },
      {
        question: 'How does the system handle a city-wide event that spikes demand 10x in one area?',
        answer: "Because the platform is geo-partitioned per city/region, the spike is contained to that region's matching and pricing capacity; batched assignment plus surge pricing throttle demand and pull idle supply from adjacent cells, and other cities' matching pipelines are completely unaffected.",
      },
      {
        question: 'How does ETA stay reasonably accurate when GPS pings only arrive every 4 seconds?',
        answer: "The client interpolates the driver's icon smoothly between pings via dead-reckoning off last known heading and speed, decoupling perceived UI freshness from actual backend ingestion frequency, while the ETA/Routing service recomputes against the road-network graph on each new ping.",
      },
    ],
    cheatSheet: [
      { question: 'Which matching approach?', answer: 'Batched bipartite assignment scored on ETA and fleet efficiency, not pure nearest-neighbor.' },
      { question: 'Where does driver location live?', answer: 'An in-memory geospatial index (Redis) keyed by S2/geohash cell, not a relational table.' },
      { question: 'How to make offers atomic?', answer: 'An atomic conditional write (Redis SETNX) locks a driver to one pending offer at a time.' },
      { question: 'What happens if the geo-index goes down?', answer: 'Matching in that region degrades/pauses, but trip and payment state in the separate strongly-consistent store is unaffected.' },
      { question: 'How is it layered?', answer: 'City/region partition → geospatial cell index → matching/pricing compute → trip persistence.' },
      { question: 'How does it scale across regions?', answer: 'Geo-partition by city so no cross-region coordination is ever needed on the matching hot path.' },
      { question: 'How is surge kept fair to riders?', answer: 'The multiplier is locked into the trip record at match time so it can never silently drift after being quoted.' },
    ],
    expectedDepth: {
      mid: 'Propose a geospatial index (geohash cells) for finding nearby drivers instead of scanning every driver\'s coordinates. Suggest matching the closest available driver to a rider request. Understand at a basic level that driver location needs to update frequently and that this location data doesn\'t need the same consistency guarantees as trip/payment data.',
      senior: 'Explain why greedy nearest-driver matching is suboptimal at city scale and propose batching requests for assignment scoring on ETA plus efficiency. Discuss how to avoid double-dispatching a driver to two riders (atomic locks), and how surge pricing must be locked at match time rather than recomputed later. Understand why the system is geo-partitioned by city.',
      staffPlus: 'Design the full separation between a fast, eventually-consistent geospatial/matching layer and a strongly-consistent trip/payment layer, articulating why these need different guarantees. Discuss the batched bipartite assignment problem in depth, including the delay-vs-efficiency tradeoff, and how surge pricing functions as a real-time supply/demand control loop rather than simple demand-based pricing. Address regional blast-radius containment and how a citywide demand spike is absorbed without degrading other regions.',
    },
    keyTakeaways: [
      'Geospatial cell indexing turns "nearest driver" from a table scan into a bounded ring search',
      'Batching requests for assignment beats greedy nearest-match at city scale under contention',
      'Surge pricing is a live control signal, not just a markup — and must be locked at quote time',
      'Geo-partitioning by city bounds the blast radius of any local outage or demand spike',
    ],
    relatedDesigns: ['food-delivery', 'stock-broker', 'ticket-booking'],
  },
  {
    slug: 'video-streaming',
    title: 'Video Streaming (Netflix / YouTube)',
    difficulty: 'Advanced',
    icon: 'pi pi-video',
    color: '#ef4444',
    concepts: [
      'Chunked Resumable Upload',
      'Distributed Transcoding Pipeline',
      'Adaptive Bitrate Streaming (HLS/DASH)',
      'CDN Edge Caching',
      'Video Metadata & Recommendation Store'
    ],
    companies: ['Netflix', 'YouTube', 'Twitch', 'Hulu'],
    summary:
      'A platform for uploading, transcoding into multiple bitrates/resolutions, and streaming video at scale, leaning heavily on CDN edge caching and adaptive bitrate delivery.',
    tldr: 'Playback is served almost entirely from CDN edge caches using segment-and-manifest adaptive bitrate streaming (HLS/DASH), which decouples the latency-sensitive player experience from the origin entirely — origin storage exists only to seed caches on a miss, never to serve traffic directly at scale.',
    problemFraming: 'Netflix, YouTube, Twitch, and Hulu each need to serve tens of petabytes of video per day to hundreds of millions of viewers, and no origin infrastructure, however large, can serve that volume of traffic directly — a naive "GET /video/{id}.mp4, stream raw bytes from origin" design collapses immediately under both the bandwidth and the concurrent-connection load. It also can\'t adapt: a single fixed-quality file either stalls viewers on degraded networks or wastes bandwidth serving 4K to someone on a throttled connection. Because a small fraction of the catalog (new releases, trending clips) drives most daily views, the real design challenge is building a caching and delivery architecture where popular content is served almost entirely from nearby edge infrastructure while the long tail of rarely-watched videos remains servable without every request becoming a slow, expensive origin fetch. Layered on top of that is the transcoding pipeline itself, which has to turn one uploaded file into many parallel-encoded renditions fast enough to keep up with hundreds of thousands of daily uploads.',
    priorArt: [
      { title: 'Netflix Open Connect', description: "Netflix's purpose-built CDN, deployed as appliances inside ISP networks, is the canonical real-world implementation of the edge-cache-first, origin-as-cold-fallback architecture this design is based on." },
      { title: 'HLS (Apple) and MPEG-DASH', description: 'The two dominant adaptive bitrate streaming standards, both defining the segment-plus-manifest model (short chunked segments, a playlist of available renditions) that this design\'s player and CDN layer implement directly.' },
      { title: 'Netflix "Per-Title Encode Optimization" (Tech Blog)', description: "Netflix's published work on content-aware encoding — analyzing each title's visual complexity to assign bitrates per rendition instead of one fixed ladder for the whole catalog — is the direct source for this design's content-aware encoding deep dive." },
      { title: 'Tiered / Origin-Shield CDN Caching', description: 'The standard edge-then-regional-then-origin cache hierarchy used across major CDNs (Akamai, Cloudflare, Fastly) to absorb cache misses at a nearer tier before they reach origin, matching this design\'s long-tail caching strategy.' },
    ],
    coreEntities: [
      { name: 'Video', description: 'The logical content record a viewer watches, tying together metadata and its set of renditions.' },
      { name: 'Rendition', description: "One resolution/bitrate/codec encoding of a video, part of its bitrate ladder." },
      { name: 'Segment', description: 'A short (2-10s) chunk of a rendition, the smallest unit fetched and cached during playback.' },
      { name: 'Manifest', description: 'A playlist document listing every available rendition and its segment URL pattern, fetched before playback starts.' },
      { name: 'CDN Cache Node', description: 'An edge (or regional) cache serving segments/manifests to viewers, falling back to origin only on a miss.' },
    ],
    requirements: {
      core: [
        'Creators upload video files, which the platform transcodes into multiple resolutions and bitrates for adaptive playback.',
        'Viewers can search/browse a catalog, and stream video with playback that adapts to their network conditions.',
        'The system supports seeking, resuming playback, and multiple simultaneous viewers of live or on-demand content.',
        'Viewing history, watch progress, and engagement (likes, comments, watch time) are tracked per user.',
        'Content metadata (title, thumbnails, captions, categories) is manageable and searchable.',
        'The platform supports content takedown/geo-restriction and digital rights management for licensed content.'
      ],
      belowTheLine: [
        'Live streaming with sub-second glass-to-glass latency',
        'Multi-language audio tracks and subtitle switching mid-playback',
        'Offline downloads for offline viewing',
        'Creator analytics dashboard (retention curves, watch-time funnels)',
      ],
      nonFunctionalTable: [
        { metric: 'Playback start latency', target: '< 1-2 seconds; rebuffering events rare even on variable networks' },
        { metric: 'CDN offload', target: 'Vast majority of bytes served from edge cache; origin fetches are the rare exception, not the norm' },
        { metric: 'Transcoding throughput', target: 'Scales horizontally to match upload volume with no unbounded processing backlog' },
        { metric: 'Regional fault tolerance', target: 'A regional CDN or data-center failure causes no global outage' },
        { metric: 'Storage efficiency', target: 'Multi-rendition storage growth actively managed via tiering/lifecycle policy rather than left unconstrained' },
      ]
    },
    capacityEstimate:
      'Assume 200M monthly active viewers, 30M of whom stream on a given day, averaging 40 minutes of viewing at ~3 Mbps average bitrate (a mix of SD/HD/4K) — that is roughly 30M x 40 x 60 x 3 Mbps ÷ 8 ≈ 27 PB of video served per day, the overwhelming majority of which must come from CDN edge caches rather than origin storage, since serving that from a single origin is infeasible. Uploads are far lower volume: assume 500K new videos/day, averaging 500 MB raw, giving ~250 TB/day of fresh raw footage ingested for transcoding (~90 PB/year raw, before any bitrate ladder is generated). Each video is typically transcoded into 5-8 renditions (e.g., 240p to 4K) plus multiple codecs, multiplying stored bytes by roughly 2-3x versus the raw original after accounting for compression efficiency at lower resolutions — so total stored catalog footprint grows into the hundreds of petabytes to low exabytes range for a mature catalog, driving heavy investment in storage tiering (hot vs. cold/archival) based on content popularity.',
    architecture:
      'Uploads flow through a resumable, chunked upload path — the client splits a large file into multi-megabyte chunks, uploads them (potentially in parallel, potentially resuming after a dropped connection) to an Upload service backed by object storage, and the service assembles and validates the complete file once all chunks arrive. Once an upload completes, a message is published to a transcoding queue, and a fleet of Transcoding workers pulls jobs, each worker (or a pipeline of workers, split by resolution/codec for parallelism) producing a ladder of renditions — several resolutions and bitrates, segmented into short (2-10 second) chunks per the HLS or DASH standard — plus a manifest file describing the available renditions and their segment URLs.\n\nCompleted renditions and manifests are written to origin object storage and metadata (title, duration, available renditions, thumbnails, captions) is written to a Metadata service backed by a database optimized for read-heavy catalog browsing, often paired with a search index (Elasticsearch) for discovery and a separate Recommendation service that consumes watch-history events to drive personalized suggestions. Origin storage is deliberately treated as a cold, durable source of truth rather than the primary read path.\n\nPlayback requests are served almost entirely from a CDN: a viewer\'s client requests the manifest, then fetches segments from the nearest edge cache, with the CDN pulling from origin only on a cache miss (typically only for very unpopular or very recently published content) and caching the result for subsequent viewers in that region. The client\'s adaptive bitrate logic continuously measures achieved download throughput and switches to a higher or lower rendition between segment boundaries, so playback degrades to a lower resolution under network pressure rather than stalling outright. Watch-progress and engagement events stream asynchronously (via a queue) to analytics and recommendation pipelines, decoupled from the latency-sensitive playback path.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  client[Client]:::client
  server[Video Server]:::compute
  storage[("Origin File Storage")]:::storage
  client -->|"GET /video/{id}.mp4"| server
  server -->|"read full file"| storage
  server -->|"stream raw bytes"| client`,
      },
      {
        title: 'Core Design: Upload and Transcoding Pipeline',
        mermaid: `flowchart LR
  creator[Creator]:::client
  upload[Upload Service]:::edge
  raw[("Raw Upload Storage")]:::storage
  queue[["Transcode Queue"]]:::async
  worker[Transcoding Workers]:::compute
  renditions[("Rendition Storage (HLS/DASH segments)")]:::storage

  creator -->|"chunked resumable upload"| upload --> raw
  raw -->|"upload complete event"| queue --> worker
  worker -->|"write bitrate ladder + manifest"| renditions`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  creator[Creator]:::client
  viewer[Viewer]:::client
  upload[Upload Service]:::edge
  raw[("Raw Upload Storage")]:::storage
  queue[["Transcode Queue"]]:::async
  worker[Transcoding Workers]:::compute
  renditions[("Origin Rendition Storage")]:::storage
  meta[Metadata Service]:::compute
  metadb[("Metadata DB")]:::database
  search[("Search Index")]:::storage
  cdn[["CDN Edge Cache"]]:::cache
  rec[Recommendation Service]:::compute
  analytics[["Watch-Event Queue"]]:::async

  creator --> upload --> raw --> queue --> worker --> renditions
  worker --> meta --> metadb
  meta --> search
  viewer -->|"GET manifest"| cdn
  cdn -->|"cache miss"| renditions
  viewer -->|"watch events"| analytics --> rec
  rec --> meta`,
      },
      {
        title: 'Core Flow: Manifest and Segment Fetch With ABR (Sequence)',
        mermaid: `sequenceDiagram
  participant V as Viewer Client
  participant CDN as CDN Edge
  participant O as Origin Storage

  V->>CDN: GET manifest.m3u8
  CDN->>O: fetch (cache miss)
  O-->>CDN: manifest
  CDN-->>V: manifest (now cached for next viewer)
  loop every segment
    V->>CDN: GET segment_N_{rendition}.ts
    CDN-->>V: segment bytes
    V->>V: measure throughput, choose rendition for segment_N+1
  end`,
      },
    ],
    approaches: [
      {
        name: 'Direct Origin Streaming (Naive)',
        description: 'Serve raw video bytes straight from origin storage on every playback request, with no transcoding or caching layer.',
        pros: ['Simple architecture with no transcoding pipeline to build', 'Trivial to implement for a small catalog', 'No CDN integration required'],
        cons: ['Origin bandwidth and connection count collapse at any real scale', 'No adaptive quality — one fixed file either stalls or wastes bandwidth', 'Every single view competes for the same origin capacity'],
      },
      {
        name: 'CDN-Fronted Adaptive Bitrate Streaming (Chosen)',
        description: 'Transcode into a bitrate ladder segmented per HLS/DASH, and serve almost all playback traffic from CDN edge caches, with origin as a cold fallback on cache miss.',
        pros: ['Origin serves only a small fraction of total bytes', 'Player adapts smoothly to changing network conditions', 'Segment-level caching maximizes CDN hit rate for popular content'],
        cons: ['Requires building and operating a full transcoding pipeline', 'Multiplies storage cost across the whole bitrate ladder', 'Cache pre-warming/invalidation adds real operational complexity for new or trending content'],
        usedBy: 'Netflix (Open Connect), YouTube, Twitch, Hulu',
      },
      {
        name: 'Peer-to-Peer-Assisted Delivery (Alternative)',
        description: 'Viewers share already-downloaded segments with nearby peers, supplementing or replacing some CDN edge traffic.',
        pros: ['Can dramatically cut CDN/origin bandwidth cost for very large live events', 'Adds resilience against a regional CDN issue'],
        cons: ['Unpredictable quality for peers behind restrictive NATs/firewalls', 'Complicates DRM and content-security guarantees', 'Uneven adoption makes it hard to rely on as a primary delivery path'],
        usedBy: 'Some large-scale live-event and P2P-CDN-assisted streaming platforms',
      },
    ],
    whereThisFits: [
      { layer: 'Upload/Ingest', blocks: 'Chunked resumable ingestion', key: 'Upload ID', example: 'A client resumes a dropped 500MB upload from the last completed chunk' },
      { layer: 'Transcoding Pipeline', blocks: 'Bitrate ladder generation', key: 'Job/chunk ID', example: 'Source is split into chunks fanned out to workers per rendition' },
      { layer: 'Origin Storage', blocks: 'Cold, durable source of truth', key: 'Video/rendition ID', example: 'Rarely read directly — exists only to seed CDN cache misses' },
      { layer: 'CDN Edge', blocks: 'Playback delivery', key: 'Manifest/segment URL', example: 'A viewer streams almost entirely from the nearest edge cache' },
    ],
    deepDive: [
      {
        title: 'The Transcoding Pipeline and Bitrate Ladder Design',
        body:
          'A single uploaded file must become a "bitrate ladder" — several resolution/bitrate pairs (e.g., 240p at 400 kbps up to 4K at 15+ Mbps) segmented into short chunks, so the client can switch renditions seamlessly mid-playback. Transcoding is CPU/GPU-intensive and embarrassingly parallel across time segments, so large pipelines split a source file into chunks and fan them out to many workers, each independently encoding its chunk at every target rendition, then stitch/verify segment boundaries afterward — turning a single long-running job into many short parallel ones and dramatically reducing wall-clock time for popular or time-sensitive uploads. The ladder itself is not one-size-fits-all: platforms increasingly use content-aware encoding, analyzing each title\'s visual complexity to assign bitrates per rendition (a static talking-head video needs far less bitrate than a fast-motion action sequence to hit the same perceptual quality), trading additional analysis compute for meaningfully lower storage and bandwidth cost at scale.'
      },
      {
        title: 'Adaptive Bitrate Streaming and the Manifest/Segment Model',
        body:
          'HLS and DASH both work by breaking video into short segments (commonly 2-10 seconds) and publishing a manifest listing every available rendition and the URL pattern for its segments. The player downloads a segment, measures the achieved throughput and time-to-first-byte, and uses that measurement to decide whether the next segment should come from a higher, equal, or lower rendition — critically, switching only happens at segment boundaries so there is never a mid-frame quality jump. Segment length is a real design lever: shorter segments let the player react to changing network conditions faster but increase manifest overhead and the number of distinct cacheable objects the CDN must manage; longer segments cache and compress more efficiently but make the player slower to downshift when a network degrades, risking a stall before it can react.'
      },
      {
        title: 'CDN Cache Strategy and the Long-Tail Problem',
        body:
          'A small fraction of the catalog (new releases, trending clips) accounts for a large fraction of daily views, so CDN edge caches can serve most traffic without ever touching origin — but the "long tail" of rarely watched content still needs to be servable without every request becoming a slow, expensive origin fetch. Platforms address this with tiered caching (regional caches behind edge caches, so an edge miss usually still hits a nearby regional cache before falling back to origin) and popularity-aware pre-warming, pushing content proactively toward regions where it is expected to trend (e.g., ahead of a scheduled release) rather than waiting for organic cache misses to populate it. The genuinely hard part is cost: over-provisioning cache capacity for the long tail is wasteful, while under-provisioning causes origin load spikes and higher playback start latency exactly for the content least able to absorb it.',
        diagram: `flowchart LR
  viewer[Viewer]:::client
  edge[["Edge Cache"]]:::cache
  regional[["Regional Cache"]]:::cache
  origin[("Origin Storage")]:::storage
  viewer --> edge -->|"miss"| regional -->|"miss"| origin`,
      },
      {
        title: 'Storage Tiering Across a Video\'s Popularity Lifecycle',
        body:
          'A newly published, trending video justifies keeping every rendition on fast, replicated hot storage close to CDN pull points, but the same video a year later, watched a handful of times a month, does not justify the same storage class. Mature platforms run automated lifecycle policies that demote renditions of aging, low-traffic content to cheaper, higher-latency cold or archival storage, re-hydrating on the rare access rather than keeping everything permanently hot. This requires the metadata layer to track access-frequency signals per video (not just per file) and coordinate storage-tier transitions without ever serving a broken link mid-transition — typically solved by keeping origin object storage as the single logical source of truth with tiering handled transparently underneath it, so the playback path never needs to know which tier a given segment currently lives in.'
      }
    ],
    tradeoffs: [
      {
        title: 'Transcoding Cost/Latency vs Number of Renditions',
        body:
          'Generating more renditions (more resolutions, more codecs like H.264/HEVC/AV1 for different device support) improves playback quality and compatibility across the full range of viewer devices and network conditions, but each additional rendition multiplies transcoding compute cost and storage footprint. Fewer renditions cut cost and speed up time-to-publish, but risk poor experience for viewers at the extremes — very slow connections or very old devices. Most platforms resolve this by prioritizing the render ladder for a video\'s expected audience (e.g., skipping 4K encoding for content unlikely to be watched on large screens) and by generating only the most common renditions immediately at upload, backfilling less-common ones lazily or on first request.'
      },
      {
        title: 'Segment Length: Player Responsiveness vs Caching Efficiency',
        body:
          'Short segments let adaptive bitrate players react quickly to changing network conditions and reduce the time to first playback, but they multiply the number of distinct objects the CDN must cache and track, and each has proportionally more HTTP overhead relative to payload. Long segments are more efficient to cache and transfer but slow the player\'s ability to downshift quality when a network degrades, risking a visible stall before the lower-bitrate segment finishes downloading. There is no universally correct answer — live streaming favors shorter segments to minimize glass-to-glass latency, while on-demand libraries often favor slightly longer segments since playback start delay matters more than split-second adaptiveness.'
      },
      {
        title: 'Aggressive Pre-Warming vs Storage/Bandwidth Cost',
        body:
          'Proactively pushing anticipated popular content to edge caches ahead of expected demand (a new season premiere, a scheduled live event) minimizes cold-start latency and origin load exactly when it matters most, but it means paying for capacity and bandwidth for traffic that has not happened yet and might be over-predicted. Waiting for organic demand to populate caches is cheaper on average but risks a painful cold-start period of high origin load and elevated playback latency right when a title first goes viral or a live event begins. Platforms typically reserve aggressive pre-warming for known, scheduled high-demand events and rely on reactive, popularity-driven caching for everything else, accepting some cold-start cost as the price of not over-provisioning for the long tail.'
      }
    ],
    failureMode: {
      title: 'What Happens When Origin Storage Becomes Unreachable?',
      body: 'Because origin is deliberately a cold fallback rather than the primary read path, an origin outage has almost no effect on already-popular content already sitting in CDN edge caches — the vast majority of daily playback traffic. The impact is concentrated on genuine cache misses: brand-new uploads, very unpopular long-tail videos, and any edge node that has evicted a segment, all of which fail to fetch fresh bytes until origin recovers. A common mitigation is stale-while-revalidate at the CDN layer — serving a slightly stale cached copy rather than a hard failure when origin can\'t be reached for a refresh. The upload/transcoding pipeline backs up during the outage since it writes to origin, but this only delays new publishes; it does not degrade existing playback, which is exactly the isolation the architecture is designed to produce.',
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/videos/uploads',
        description: 'Initiate a chunked resumable upload; returns an uploadId and chunk size to use.',
        example: '// Request\n{ "filename": "trip-vlog.mp4", "sizeBytes": 524288000 }\n\n// Response 201\n{ "uploadId": "u_7712", "chunkSizeBytes": 8388608 }',
      },
      {
        method: 'PUT',
        path: '/v1/videos/uploads/{uploadId}/chunks/{chunkIndex}',
        description: 'Upload a single chunk; safe to retry/resume any chunk independently.',
        example: '// Response 200\n{ "uploadId": "u_7712", "chunkIndex": 12, "received": true }',
      },
      {
        method: 'GET',
        path: '/v1/videos/{videoId}/manifest.m3u8',
        description: 'Fetch the HLS manifest listing available renditions and segment URLs. Served primarily from CDN edge.',
        example: '// Response 200 (abridged)\n#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720p/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/index.m3u8',
      },
      {
        method: 'GET',
        path: '/v1/videos/{videoId}/metadata',
        description: 'Fetch title, duration, thumbnails, captions, and available renditions for a video.',
        example: '// Response 200\n{ "videoId": "v_9931", "title": "Trip Vlog", "durationSec": 812, "renditions": ["240p","360p","720p","1080p"] }',
      },
      {
        method: 'POST',
        path: '/v1/videos/{videoId}/events',
        description: 'Report a watch-progress or engagement event (play, pause, like, watch-time checkpoint).',
        example: '// Request\n{ "userId": "u_221", "type": "watch_progress", "positionSec": 340 }\n\n// Response 202\n{ "accepted": true }',
      },
    ],
    keyTechnologies: [
      { term: 'HLS/DASH', definition: 'Adaptive bitrate streaming protocols that break video into short segments plus a manifest describing available renditions.' },
      { term: 'Bitrate Ladder', definition: 'The full set of resolution/bitrate renditions generated per video so playback can adapt to varying network conditions and devices.' },
      { term: 'Content-Aware Encoding', definition: "Assigning per-title bitrates based on a video's visual complexity rather than a fixed ladder, to hit target quality with less storage/bandwidth." },
      { term: 'Manifest File', definition: 'A playlist document (e.g. .m3u8) listing every available rendition and the URL pattern for its segments, fetched before playback begins.' },
      { term: 'Tiered/Origin-Shield Caching', definition: 'A caching layer structure (edge -> regional -> origin) that absorbs cache misses at a nearer tier before they reach origin storage.' },
      { term: 'Adaptive Bitrate (ABR) Algorithm', definition: "Client-side logic that measures achieved segment download throughput and selects the next segment's rendition accordingly, switching only at segment boundaries." },
    ],
    selfAudit: [
      {
        question: "What happens when a video suddenly goes viral and CDN caches haven't warmed for it?",
        answer: 'The first requests in each region miss the edge cache and fall through to a regional cache or origin, causing a temporary spike in origin load and playback start latency until enough edge nodes have cached the popular segments — mitigated for known scheduled events via proactive pre-warming.',
      },
      {
        question: 'How do you avoid re-transcoding an entire video just to fix captions or a thumbnail?',
        answer: 'Metadata (title, captions, thumbnails) is stored and served independently from the video renditions in the Metadata service, so metadata-only edits never touch the transcoding pipeline or invalidate cached segments.',
      },
      {
        question: "What's the failure mode if a transcoding worker crashes mid-job?",
        answer: "Because a source file is split into independently-encoded chunks per worker, only the in-flight chunk's work is lost; the job queue redelivers that chunk to another worker, and completed chunks/renditions are unaffected.",
      },
      {
        question: 'How do you serve 4K to a viewer on a throttled connection without stalling?',
        answer: "The player's ABR logic measures achieved throughput per segment and downshifts to a lower rendition at the next segment boundary before a stall occurs, trading resolution for continuous playback rather than trying to force the requested quality.",
      },
      {
        question: 'How is storage cost controlled for a catalog with a long tail of rarely-watched videos?',
        answer: 'Automated lifecycle policies demote renditions of aging, low-traffic videos to cheaper cold/archival storage tiers based on tracked access-frequency signals, re-hydrating transparently on the rare access rather than keeping the entire catalog permanently on hot storage.',
      },
    ],
    cheatSheet: [
      { question: 'Which delivery approach?', answer: 'CDN-fronted adaptive bitrate streaming (HLS/DASH), not direct origin streaming.' },
      { question: 'Where does state live?', answer: 'Origin object storage is the cold source of truth; CDN edge caches serve almost all reads.' },
      { question: 'How to make transcoding resilient?', answer: "Split the source into independently-encoded chunks per worker so one crash only loses one chunk's work." },
      { question: 'What happens if origin goes down?', answer: 'Cached/popular content keeps serving from the CDN edge; only fresh cache misses are affected.' },
      { question: 'How is it layered?', answer: 'Upload/ingest → transcoding pipeline → origin storage → CDN edge → player ABR logic.' },
      { question: 'How does it handle massive scale?', answer: 'The CDN edge absorbs the vast majority of daily petabytes served; origin only serves the rare miss.' },
      { question: 'How does playback adapt to bad networks?', answer: 'The player measures per-segment throughput and switches renditions only at segment boundaries.' },
    ],
    expectedDepth: {
      mid: 'Propose transcoding an uploaded video into a few resolutions so different devices/networks can play it. Understand that a CDN is needed to serve video at scale rather than a single server. Explain basic chunked upload for large files.',
      senior: "Explain the manifest-plus-segment model (HLS/DASH) and how a player's adaptive bitrate logic switches renditions at segment boundaries. Discuss why origin storage should be a cold fallback behind a CDN rather than the primary read path, and how transcoding is parallelized across chunks/workers. Understand the long-tail caching problem — most views concentrate on a small fraction of the catalog.",
      staffPlus: 'Design the full separation between the latency-sensitive playback path (CDN-first, eventually consistent) and the ingest/transcoding path (durable, can tolerate backpressure). Discuss content-aware encoding, tiered/origin-shield caching, storage lifecycle tiering across a video\'s popularity curve, and the tradeoffs of proactive cache pre-warming for scheduled high-demand events versus reactive, popularity-driven caching for the long tail.',
    },
    keyTakeaways: [
      'Origin storage should almost never serve traffic directly — the CDN is the actual read path',
      'Adaptive bitrate switches only at segment boundaries, trading resolution for continuous playback',
      'A small fraction of the catalog drives most views; design caching around that skew, not the average',
      'Parallelizing transcoding by chunk turns one long job into many short, independently-recoverable ones',
    ],
    relatedDesigns: ['photo-sharing', 'social-feed', 'news-aggregator'],
  },
  {
    slug: 'collaborative-editing',
    title: 'Collaborative Editing (Google Docs / Notion)',
    difficulty: 'Advanced',
    icon: 'pi pi-file-edit',
    color: '#8b5cf6',
    concepts: [
      'Operational Transformation vs CRDTs',
      'WebSocket Real-Time Sync',
      'Version Vectors & Causality Tracking',
      'Presence & Cursor Broadcasting',
      'Offline Edit Reconciliation'
    ],
    companies: ['Google (Docs)', 'Notion', 'Figma', 'Microsoft (Word/Loop)'],
    summary:
      'A multi-user document editor where concurrent edits from many clients converge to the same consistent document state in real time, with live cursors and offline support.',
    tldr: 'Every client edits a local copy optimistically and instantly, streaming structured operations (not diffs) to a sync layer that applies OT or CRDT merge logic guaranteeing strong eventual consistency — every replica that has seen the same set of operations converges to the identical document, regardless of the order those operations arrived in.',
    problemFraming: 'Google Docs, Notion, Figma, and Microsoft Loop all let dozens of people type into the same document within the same second, and the hard problem is what happens when two users insert different text at the same cursor position while briefly disconnected from each other and then reconnect. A naive approach — each client PUTs its full document body and the server does last-write-wins — silently destroys one user\'s edits every time two people type concurrently, which is unacceptable for a product whose entire value proposition is simultaneous editing. Waiting for a server round-trip before showing a keystroke locally would also make every edit feel laggy, so edits must apply instantly and optimistically on-device, which means conflict resolution has to happen after the fact, not before. The system also has to survive real network partitions and offline periods gracefully — a flight-mode editing session that reconnects hours later must merge cleanly rather than corrupting the document or silently dropping changes.',
    priorArt: [
      { title: 'Operational Transformation (Google Wave / Google Docs lineage)', description: 'OT, the algorithm family originally built for Google Wave and carried into Google Docs, transforms each incoming operation against concurrent operations it did not see before applying it, which is the transform-based merge strategy contrasted with CRDTs in this design.' },
      { title: 'CRDTs — Yjs and Automerge', description: "These widely-used open-source CRDT libraries implement sequence-CRDT algorithms (giving every inserted element a globally unique, orderable ID) that let replicas merge independently with no central authority, the basis for this design's CRDT-based alternative to OT." },
      { title: 'Figma "How Figma\'s Multiplayer Technology Works" (Engineering Blog)', description: "Figma's published account of their multiplayer sync engine — a central server holding authoritative in-memory state per document and broadcasting transformed operations to connected clients — closely mirrors this design's Document Sync service architecture." },
      { title: "Martin Kleppmann's CRDT Research", description: "Kleppmann's papers and talks on strong eventual consistency and collaborative data structures (and his co-authorship of Automerge) formalize the convergence guarantee — replicas that have applied the same operation set always compute identical state — that this design names as its core correctness property." },
    ],
    coreEntities: [
      { name: 'Operation', description: 'A structured edit (insert, delete, format-range) carrying a totally-orderable ID, the unit streamed between clients and the sync service.' },
      { name: 'Document Replica', description: "A client's or the sync service's local mutable copy of a document, converging toward identical state across all replicas." },
      { name: 'Snapshot', description: 'A compacted, materialized document state as of a point in the operation log, avoiding full-history replay on load.' },
      { name: 'Presence Session', description: "Ephemeral, non-durable state tracking a connected user's cursor/selection and live viewing status." },
      { name: 'Logical Clock / Op ID', description: 'A sequence-number-plus-client-id identifier giving every operation a deterministic total order across replicas.' },
    ],
    requirements: {
      core: [
        'Multiple users can simultaneously edit the same document, with each user\'s changes visible to others within a second or two.',
        'Users see live cursors/selections of collaborators currently viewing or editing the document.',
        'Edits made while offline must be reconciled and merged correctly once connectivity is restored.',
        'The system maintains a full version history, allowing users to view and restore previous document states.',
        'Documents support rich structure (text formatting, embedded objects, comments) beyond plain text.',
        'Access control (view/comment/edit permissions) is enforced per document and per user or group.'
      ],
      belowTheLine: [
        'Real-time voice/video huddle integrated directly into the document',
        'AI-assisted co-editing suggestions',
        'Granular field-level locks (e.g. reserving a specific range/cell for one editor)',
        'Live cross-document linking/transclusion that updates as the source changes',
      ],
      nonFunctionalTable: [
        { metric: 'Edit propagation latency', target: 'Well under 1 second between collaborators on a healthy connection' },
        { metric: 'Convergence guarantee', target: 'Strong eventual consistency — all replicas converge to identical document state regardless of operation arrival order' },
        { metric: 'Partition tolerance', target: 'Network partitions and client disconnects never corrupt document state; edits reconcile cleanly on reconnect' },
        { metric: 'History scalability', target: 'Years of accumulated edit history stored without degrading document load time (via snapshot compaction)' },
        { metric: 'Concurrent editor scale', target: 'Tens to low hundreds of simultaneous active editors per document with no linear latency penalty per additional editor' },
      ]
    },
    capacityEstimate:
      'Assume 50M monthly active users, with 5M editing documents concurrently during a peak business-hours window, averaging 2 keystroke-level edit operations/second per active editing session during bursts of typing — that is up to 10M ops/sec at extreme peak, though realistically most users are reading or briefly pausing, so sustained load across the whole active population is closer to 1-2M ops/sec, still substantial. Each edit operation is small (an insert/delete op with position and content, typically 50-200 bytes including metadata), so even at 1M ops/sec that is 50-200 MB/sec of edit-stream traffic platform-wide, which is why ops are batched/coalesced client-side before sending rather than transmitted per keystroke. Document storage itself is modest per document (a typical document body is tens of KB to a few MB) but full edit history multiplies this significantly — a heavily-edited document accumulating years of operations can reach hundreds of MB of raw history, which is why systems periodically compact history into snapshots plus a bounded recent-operations log rather than replaying every operation since document creation.',
    architecture:
      'Each editing client maintains a local, mutable copy of the document and applies its own edits optimistically and instantly, without waiting for a server round-trip — this is essential for perceived responsiveness, since waiting on network latency for every keystroke would feel unusable. Edits are represented as structured operations (insert, delete, format-range, etc.) rather than raw document diffs, and each client streams its operations over a persistent WebSocket connection to a Document Sync service, which is responsible for ordering, transforming, and broadcasting operations to every other connected client editing that document.\n\nThe Sync service holds an authoritative, current in-memory state for each actively-edited document (sharded so a given document is always handled by one owning node, since operation ordering for a single document needs a consistent point of coordination) and applies either Operational Transformation or a CRDT-based merge algorithm to incoming operations: OT transforms an incoming operation against any concurrent operations it did not know about before applying it, while CRDT-based designs give every insertion a globally unique, orderable identifier so operations can be merged commutatively without needing a central transform step. Either way, the goal is the same invariant — every client, regardless of the order operations arrive in, converges to an identical final document.\n\nOperations are also appended to a durable, ordered log per document (backing both crash recovery and version history), and a background process periodically compacts this log into snapshots so reopening an old, heavily-edited document does not require replaying its entire operation history from the beginning. Presence and cursor position are broadcast through the same WebSocket channel but are treated as ephemeral, non-durable state — never written to the operation log — since a lost cursor update has no lasting consequence. Documents themselves, along with permission metadata, live in a separate persistent store (often a document database or blob store for content plus a relational store for permissions/sharing), decoupled from the hot real-time sync path so permission checks and document listing do not compete with the latency-sensitive editing stream.',
    diagrams: [
      {
        title: 'Naive First Cut',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  api[Document API]:::compute
  db[("Document Store")]:::database
  clientA -->|"PUT /documents/{id} (full body)"| api
  clientB -->|"PUT /documents/{id} (full body)"| api
  api -->|"overwrite (last write wins)"| db`,
      },
      {
        title: 'Core Design: Sync Service With OT/CRDT Merge',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  sync[Document Sync Service]:::compute
  oplog[["Operation Log"]]:::async

  clientA -->|"insert/delete ops (WebSocket)"| sync
  clientB -->|"insert/delete ops (WebSocket)"| sync
  sync -->|"transform/merge (OT or CRDT)"| oplog
  sync -.->|"broadcast transformed ops"| clientA
  sync -.->|"broadcast transformed ops"| clientB`,
      },
      {
        title: 'Final Architecture',
        mermaid: `flowchart LR
  clientA[Client A]:::client
  clientB[Client B]:::client
  wsgw[WebSocket Gateway]:::edge
  sync[Document Sync Service]:::compute
  oplog[["Operation Log"]]:::async
  snap[Snapshot Compactor]:::compute
  docstore[("Document/Snapshot Store")]:::database
  permstore[("Permissions Store")]:::database

  clientA --> wsgw
  clientB --> wsgw
  wsgw --> sync
  sync -->|"ops"| oplog
  oplog --> snap --> docstore
  sync -.->|"transformed ops + presence"| wsgw
  wsgw -.-> clientA
  wsgw -.-> clientB
  sync -->|"permission check"| permstore`,
      },
      {
        title: 'Core Flow: Concurrent Edit Convergence (Sequence)',
        mermaid: `sequenceDiagram
  participant A as Client A
  participant B as Client B
  participant S as Document Sync Service

  Note over A,B: Both editing near-simultaneously at the same position
  A->>S: insert("X", pos=5, opId=(t1,A))
  B->>S: insert("Y", pos=5, opId=(t1,B))
  S->>S: order by (t1,A) < (t1,B) via tie-break on client id
  S-->>A: broadcast insert("Y", pos=6)
  S-->>B: broadcast insert("X", pos=5)
  Note over A,B: Both converge to identical text containing X then Y`,
      },
    ],
    approaches: [
      {
        name: 'Last-Write-Wins Full-Document Overwrite (Naive)',
        description: 'Each client PUTs its entire document body; the server simply overwrites with whichever request arrives last.',
        pros: ['Trivial to implement', 'Works fine for a single editor at a time', 'No merge logic or op model needed at all'],
        cons: ['Silently destroys one user\'s edits whenever two people type concurrently', 'No real-time propagation of individual edits', "Completely unusable for the product's actual value proposition"],
      },
      {
        name: 'Operational Transformation (Common Choice)',
        description: 'Transform each incoming operation against concurrent operations it did not see, mediated by a central server that owns canonical ordering.',
        pros: ['Mature, well-understood transform algorithms', 'Straightforward to enforce permissions since one authority checks every op', 'Smaller per-operation metadata than CRDTs over a long history'],
        cons: ["Requires a central server — conflicts can't fully resolve while offline", 'Transform functions must be proven correct per operation type', "Harder to scale a single hot document beyond one owning node"],
        usedBy: 'Google Docs, Figma-style multiplayer sync engines',
      },
      {
        name: 'CRDT-Based Merge (Alternative)',
        description: 'Give every inserted element a globally unique, orderable ID so any two replicas can merge their operation sets independently with no central authority.',
        pros: ['No central authority required for correctness', 'Genuinely peer-to-peer and offline-first', 'Merge determinism is guaranteed by construction, not by proof-per-operation'],
        cons: ['Tombstone/metadata bloat over a long edit history', 'Harder to reason about for complex structural ops like moving a block', 'Permission enforcement is harder without one authority checking every op'],
        usedBy: 'Notion-style apps and libraries such as Yjs and Automerge',
      },
    ],
    whereThisFits: [
      { layer: 'Client (local replica)', blocks: 'Optimistic local apply', key: 'Local op buffer', example: 'Keystrokes render instantly before any server round-trip completes' },
      { layer: 'WebSocket Gateway / Sync Service', blocks: 'Ordering, transform/merge, broadcast', key: 'Document shard owner', example: "One node owns a given document's canonical operation order" },
      { layer: 'Operation Log', blocks: 'Durable history and crash recovery', key: 'Operation sequence number', example: 'Reconstructs document state after a sync node crash' },
      { layer: 'Document/Snapshot Store', blocks: 'Cold persistent state and permissions', key: 'Document ID', example: 'Loading fetches the latest snapshot plus only the ops since it' },
    ],
    deepDive: [
      {
        title: 'Operational Transformation vs CRDTs: The Real Trade',
        body:
          'OT requires every operation to be transformed against every concurrent operation it did not see, using carefully proven transform functions per operation type, and it typically depends on a central server to establish a canonical order and mediate transforms — this makes correctness easier to reason about (there is one authority resolving conflicts) but creates a scaling and offline limitation, since a client cannot fully resolve conflicts without talking to that server. CRDTs (commonly a sequence CRDT like RGA or a tree-based variant, as used in systems like Automerge or Yjs) instead give every inserted element a unique, globally comparable identifier so any two replicas can merge their operation sets independently and deterministically, with no central authority required — genuinely enabling peer-to-peer or fully offline-first editing. The cost is that CRDT metadata (the unique identifiers and tombstones for deletions) can bloat document size over a long edit history far more than an OT-based log, and reasoning about correctness for complex operations (like moving a block, not just inserting/deleting characters) is considerably harder to get right.'
      },
      {
        title: 'Achieving Convergence Under Concurrent Edits',
        body:
          'The core hard problem is this: two users each insert different text at the same cursor position while offline from each other, then reconnect — the system must guarantee both edits survive and every client ends up displaying the identical final text in the identical order, with no coordination between the two users\' clients required to agree on whose edit "goes first." This is solved by making the underlying operation identifiers themselves totally orderable independent of arrival time — for example, combining a logical clock or sequence number with a tie-breaking client ID, so any two operations can always be compared and ordered the same way on every replica regardless of when each replica learned about them. The property being engineered for has a name — strong eventual consistency — meaning replicas that have seen the same set of operations, in any order, always compute the identical state, even though they may briefly disagree while some operations are still in flight.'
      },
      {
        title: 'Presence, Cursors, and Why They Are Not "Real" State',
        body:
          'Live cursor positions and "who is viewing this document" indicators need to update multiple times per second per active user to feel alive, but they carry no lasting meaning once a user leaves — unlike a text edit, a cursor position is not part of the document\'s truth and never needs to be recovered after a crash. This lets presence data take a fundamentally cheaper path: broadcast directly over the same WebSocket fan-out without going through the durable operation log, held only in the Sync service\'s in-memory session state, and simply dropped when a client disconnects (often with a short heartbeat timeout to distinguish a genuine disconnect from a brief network blip). Treating presence with the same durability guarantees as document content would be a significant unnecessary cost, since the entire value of presence data is its immediacy, not its persistence.'
      },
      {
        title: 'Compacting History Without Losing the Ability to Undo',
        body:
          'A document edited daily for three years can accumulate an operation log far larger than the document itself, making "open this document" prohibitively slow if it means replaying every keystroke since creation. Systems solve this by periodically folding a prefix of the operation log into a snapshot — a materialized document state as of a point in time — so loading a document means fetching the latest snapshot plus only the operations since it, not the entire history. The tension is that version history and undo/redo functionality often want fine-grained access to intermediate states, so compaction cannot simply discard old operations outright; instead, older snapshots are retained at decreasing granularity (frequent recent snapshots, sparser older ones), similar in spirit to how time-series systems downsample old data, trading exact historical granularity for bounded storage growth.',
        diagram: `flowchart LR
  oplog[["Operation Log (all ops since creation)"]]:::async
  snap1[("Snapshot @ 1,000 ops")]:::database
  snap2[("Snapshot @ 5,000 ops")]:::database
  recent[["Ops since last snapshot"]]:::async
  load[Document Load]:::compute
  oplog -.->|"periodic compaction"| snap1
  oplog -.->|"periodic compaction"| snap2
  snap2 --> load
  recent --> load`,
      }
    ],
    tradeoffs: [
      {
        title: 'Optimistic Local Apply vs Guaranteed Global Ordering',
        body:
          'Applying a user\'s own keystrokes to their local document copy instantly, before any server acknowledgment, is what makes an editor feel responsive rather than laggy — but it means the client is temporarily displaying a state that has not yet been reconciled with everyone else\'s concurrent edits. The alternative, waiting for server confirmation before rendering a keystroke, would guarantee every client only ever shows fully-ordered, agreed-upon state, but would make typing feel like using a remote desktop session over a slow link. Every practical collaborative editor accepts optimistic local rendering plus a background reconciliation/transform step, treating brief local divergence as an acceptable cost for the interaction to feel instantaneous.'
      },
      {
        title: 'Central Sync Authority vs Fully Peer-to-Peer Merge',
        body:
          'Routing all operations through a server that owns canonical ordering for a document (common in OT-based systems) makes conflict resolution and permission enforcement straightforward, since there is one place that can be trusted to decide, but it means the document is unreachable for live collaborative editing if that server or its shard is unavailable. Fully peer-to-peer CRDT-based merging removes that single point of failure and enables genuine offline editing between peers with no server at all, but pushes conflict-resolution complexity onto every client and makes centralized concerns — like enforcing that a "viewer" cannot actually insert text — considerably harder, since there is no longer one authority checking every operation before it is applied. Most production systems land on a hybrid: CRDT or OT-style merge logic for convergence, but still routed through a server for authentication, permission enforcement, and durable storage.'
      },
      {
        title: 'Fine-Grained Version History vs Storage/Compute Cost',
        body:
          'Keeping every single operation forever gives perfect, granular undo and version history — a user can restore the document to the exact state one keystroke before any given moment, years later. But storing and indexing operation-level history indefinitely for every document, most of which will never be inspected at that granularity, is a real and growing storage cost at scale. Compacting into periodic snapshots trades away that perfect granularity for older history (offering only coarser restore points, e.g., every few minutes or at named checkpoints) in exchange for bounded storage growth, which is the trade nearly every production system makes once documents live long enough to accumulate substantial edit history.'
      }
    ],
    failureMode: {
      title: 'What Happens When the Document Sync Service Shard Owning a Document Crashes?',
      body: 'Because the operation log, not the sync node\'s in-memory session state, is the durable source of truth, a crashed shard loses nothing that matters: a new owning node is assigned for the document and reconstructs current state by loading the latest snapshot plus every operation appended since it. Connected clients simply reconnect (typically to a new WebSocket endpoint) and resume streaming their pending local operations, which merge in through the same OT/CRDT convergence logic as any other concurrent edit. The one piece of state that is genuinely lost is ephemeral presence — live cursors and "who is viewing" indicators — but this is an intentional design choice, since presence was never written to the durable log in the first place and has no lasting meaning. This asymmetry (fail-safe for content, fail-open for presence) is deliberate: paying full durability cost for data that resets harmlessly on reconnect would be pure waste.',
    },
    apiInterface: [
      {
        method: 'POST',
        path: '/v1/documents',
        description: 'Create a new document and its permissions record.',
        example: '// Request\n{ "title": "Q3 Roadmap", "ownerId": "u_331" }\n\n// Response 201\n{ "documentId": "d_9021", "createdAt": "2026-07-16T10:00:00Z" }',
      },
      {
        method: 'WS',
        path: '/v1/documents/{docId}/sync',
        description: 'Persistent stream for exchanging insert/delete/format-range operations and presence updates in real time.',
        example: '// Client send\n{ "type": "op", "op": "insert", "pos": 128, "text": "hello", "opId": [1721, "clientA"] }\n\n// Server broadcast\n{ "type": "op", "op": "insert", "pos": 129, "text": "hello", "opId": [1721, "clientA"] }',
      },
      {
        method: 'GET',
        path: '/v1/documents/{docId}/snapshot',
        description: 'Fetch the latest compacted snapshot plus any operations since it, for fast document load.',
        example: '// Response 200\n{ "snapshotAt": 5000, "content": "...", "opsSince": [ { "op": "insert", "pos": 40, "text": "!" } ] }',
      },
      {
        method: 'GET',
        path: '/v1/documents/{docId}/history?at={timestamp}',
        description: 'Reconstruct and return the document state as of a given point in time for version history/restore.',
        example: '// Response 200\n{ "documentId": "d_9021", "at": "2026-07-10T09:00:00Z", "content": "..." }',
      },
      {
        method: 'PUT',
        path: '/v1/documents/{docId}/permissions',
        description: 'Set view/comment/edit access for a user or group on a document.',
        example: '// Request\n{ "userId": "u_442", "role": "edit" }\n\n// Response 200\n{ "documentId": "d_9021", "userId": "u_442", "role": "edit" }',
      },
    ],
    keyTechnologies: [
      { term: 'Operational Transformation (OT)', definition: 'A conflict-resolution technique that transforms an incoming operation against concurrent operations it did not see, typically mediated by a central server.' },
      { term: 'CRDT', definition: 'Conflict-free Replicated Data Type — a data structure whose operations can be merged commutatively across replicas with no central coordination.' },
      { term: 'RGA (Replicated Growable Array)', definition: 'A sequence CRDT that assigns each inserted element a unique, globally orderable identifier, enabling deterministic merge of concurrent text insertions.' },
      { term: 'Logical Clock / Version Vector', definition: 'A causality-tracking mechanism (sequence number plus client id, or per-replica counters) used to totally order or compare operations across replicas independent of wall-clock arrival time.' },
      { term: 'Tombstone', definition: 'A marker left in place of a deleted element in a CRDT so concurrent operations referencing that position can still be resolved correctly.' },
      { term: 'Strong Eventual Consistency', definition: 'The guarantee that any two replicas which have seen the same set of operations converge to an identical state, regardless of the order those operations were received in.' },
    ],
    selfAudit: [
      {
        question: 'What happens if two users insert text at the exact same cursor position simultaneously?',
        answer: 'Both operations carry a totally-orderable identifier (a logical clock plus a tie-breaking client id), so every replica applies a deterministic, identical ordering between the two inserts and all clients converge to the same final text containing both edits.',
      },
      {
        question: 'How do you handle a client reconnecting after being offline for days with many local edits?',
        answer: "The client's queued local operations are replayed against the server in their local order and merged using the same OT/CRDT convergence logic as any concurrent edit — the only practical difference from a brief disconnect is the volume of operations to reconcile, not the mechanism.",
      },
      {
        question: 'What if the Document Sync service shard owning a hot document crashes?',
        answer: 'The operation log is the durable source of truth, not the in-memory session state, so a new shard owner is elected/assigned for that document and reconstructs current state from the latest snapshot plus operations since it, while connected clients reconnect and resume streaming.',
      },
      {
        question: 'How do you keep presence/cursor broadcasts from overwhelming the WebSocket fan-out with 200 simultaneous editors?',
        answer: 'Presence updates are debounced/throttled client-side and broadcast only to clients currently viewing that document (not persisted or logged), and can be batched into periodic snapshots of "who is where" rather than broadcasting every micro-movement individually.',
      },
      {
        question: 'How do you prevent CRDT tombstone/metadata bloat from making an old document unbounded in size?',
        answer: "Tombstones for deletions that are older than any client's pending unsynced operations can be safely garbage-collected during snapshot compaction, since no future merge will ever need to reference them once every replica has converged past that point.",
      },
    ],
    cheatSheet: [
      { question: 'Which merge approach?', answer: 'Operational Transformation for centrally-mediated correctness, or CRDTs for offline-first/peer-to-peer editing.' },
      { question: 'Where does canonical state live?', answer: 'One owning Sync Service node holds authoritative in-memory state per document, backed by a durable operation log.' },
      { question: 'How to make ordering deterministic?', answer: 'Give every operation a totally-orderable ID — a logical clock plus a client-id tiebreak.' },
      { question: 'What happens if the owning shard crashes?', answer: 'A new owner is assigned and rebuilds state from the latest snapshot plus the operations logged since it.' },
      { question: 'How is it layered?', answer: 'Client optimistic apply → WebSocket gateway → Sync service (transform/merge) → durable op log → snapshot store.' },
      { question: 'How does it scale across many documents?', answer: 'Shard by document so each doc\'s ordering is owned by exactly one node, with no cross-document coordination.' },
      { question: 'How is presence handled differently from edits?', answer: 'Presence/cursors broadcast ephemerally over the same socket but are never written to the durable operation log.' },
    ],
    expectedDepth: {
      mid: 'Explain why last-write-wins overwrite is unacceptable for simultaneous editors. Propose sending individual edits (not full documents) over a WebSocket so changes propagate in near real time. Understand at a basic level that edits need some way to be ordered consistently across users.',
      senior: 'Compare Operational Transformation and CRDTs at a mechanism level — how each achieves convergence and what each costs (central authority vs. metadata bloat). Explain why edits apply optimistically on the client before server confirmation, and how presence/cursor data is treated differently (ephemeral, non-durable) from actual document content. Discuss snapshot compaction for history scalability.',
      staffPlus: 'Design the full sync architecture: document sharding to one owning node per document, the durable operation log as the actual source of truth versus in-memory session state, and how a totally-orderable operation ID achieves strong eventual consistency independent of arrival order. Address offline reconciliation at scale (a client reconnecting after days with a large queued op backlog), tombstone garbage collection during compaction, and the tradeoff between centralized OT-style permission enforcement and fully peer-to-peer CRDT merging.',
    },
    keyTakeaways: [
      'Optimistic local apply is what makes an editor feel responsive — conflicts get resolved after the fact, not before',
      'OT needs a central authority to mediate; CRDTs trade that away for peer-to-peer/offline-first merging',
      'Strong eventual consistency means replicas that saw the same ops always converge, regardless of arrival order',
      "Presence/cursor data is deliberately never durable — its entire value is immediacy, not persistence",
    ],
    relatedDesigns: ['chat-system', 'real-time-leaderboard', 'notification-system'],
  }
]
