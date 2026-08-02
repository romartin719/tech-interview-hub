import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'rate-limiter',
  title: 'Rate Limiter',
  difficulty: 'Intermediate',
  icon: 'pi pi-shield',
  color: '#ef4444',
  readTimeMinutes: 22,
  topics: ['Token Bucket', 'Sliding Window Algorithms', 'Redis Lua Scripts'],
  companies: ['Stripe', 'Cloudflare', 'Amazon', 'GitHub'],
  prerequisites: ['Caching', 'Message Queues'],
  summary:
    'A distributed rate limiter blocks clients that exceed a request quota by checking a shared Redis counter with an atomic Lua script before a request reaches the backend, returning HTTP 429 with retry guidance when the quota is spent.',

  understandingProblem:
    'When you use an API - say Twitter or Stripe - you can only make a certain number of requests per minute. Go over the limit and you get a "429 Too Many Requests" error. That\'s a rate limiter. You need one to protect servers (one angry client sending 1M requests shouldn\'t crash the service for everyone), enforce fair usage (free-tier users get 100 calls/min, paid users get 10000), control cost (downstream services like databases and third-party APIs have their own limits), and for security (stopping brute-force login attempts, credential stuffing, and DDoS).',
  realExamples:
    'GitHub API: 5000 requests/hour per authenticated user. Stripe API: 100 requests/sec per account. Twitter API: 300 tweets/3 hours per user.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  api["API Server<br/>HashMap counter"]:::compute
  db[("Your DB")]:::database
  client --> api
  api --> db`,
    },
    whyThisBreaks: [
      'Multiple servers - you have 10 API pods. Each has its own counter. Client hits different pods and effectively gets 10x the limit.',
      'Server restart - counters vanish. Everyone gets a fresh quota after every deploy.',
      'Memory - 10 million unique users = 10 million map entries = OOM risk.',
      'Window boundaries - client sends 100 requests at 11:59:59, another 100 at 12:00:01. Both windows allow it, but 200 requests arrive in 2 seconds.',
    ],
    closingNote:
      "We need every pod to check and update a single, shared, blazing-fast counter instead of its own private one - that's exactly what Redis buys us.",
  },

  priorArt: [
    {
      title: 'Stripe Rate Limiting',
      description:
        'Uses token bucket with Redis Lua scripts. Publishes rate limit headers (X-RateLimit-Limit, Remaining, Reset) as the API industry standard. (Stripe Engineering blog)',
      link: 'https://stripe.com/blog/rate-limiters',
    },
    {
      title: 'Cloudflare Rate Limiting',
      description:
        'Processes 45M+ HTTP requests/sec. Uses sliding window counters at the edge for IP-level limits, with per-customer limits at the application layer. (Cloudflare blog)',
      link: 'https://blog.cloudflare.com/counting-things-a-lot-of-different-things/',
    },
    {
      title: 'Kong Gateway',
      description:
        'Open-source API gateway with pluggable rate limiting (local, Redis-backed, or cluster-wide). Shows the three-tier pattern: edge -> gateway -> service. (Kong rate limiting plugin)',
      link: 'https://developer.konghq.com/plugins/rate-limiting/',
    },
    {
      title: 'Google Cloud Armor',
      description:
        'Demonstrates adaptive rate limiting that adjusts thresholds based on request patterns rather than fixed rules. (Google Cloud docs)',
      link: 'https://docs.cloud.google.com/armor/docs/adaptive-protection-overview',
    },
  ],

  coreEntities: [
    { name: 'Rule', description: 'Defines a limit: identifier type (user/IP/key), max requests, time window, algorithm.' },
    { name: 'Counter', description: 'Tracks current usage for a specific client + window combination.' },
    { name: 'Window', description: 'The time boundary (fixed 1-min, sliding, or token bucket refill rate).' },
    { name: 'Decision', description: 'The result of a rate check: ALLOW or REJECT, with remaining quota.' },
  ],

  requirements: {
    core: [
      'Limit requests per client - enforce a max number of requests per time window (e.g., 100 requests/minute per user)',
      'Return clear feedback - rejected requests get HTTP 429 with headers showing limit, remaining quota, and reset time',
      'Support multiple granularities - limit by user ID, API key, IP address, or endpoint',
    ],
    belowTheLine: [
      'Adaptive limits (auto-adjust based on system load)',
      'Per-endpoint weighting (expensive operations cost more tokens)',
      'Allowlists/blocklists',
      'Rate limit dashboard for API consumers',
    ],
    nonFunctionalTable: [],
  },

  technologyChoices: [
    {
      tier: 'Counter Store',
      purpose: 'Rate limit counters per client per window',
      primaryPick: 'Redis',
      alternatives: 'Memcached, DynamoDB, Hazelcast',
      whyPrimaryWins: "Atomic INCR + TTL in one round-trip; sub-ms latency won't bottleneck the request path",
    },
    {
      tier: 'Rule Store',
      purpose: 'Rate limit rules and quotas',
      primaryPick: 'Postgres',
      alternatives: 'MySQL, DynamoDB, etcd',
      whyPrimaryWins: 'Low-write config data; relational queries for admin dashboards',
    },
    {
      tier: 'Edge Layer',
      purpose: 'IP-level blocking before app servers',
      primaryPick: 'Cloudflare WAF',
      alternatives: 'AWS WAF, Kong, Envoy rate-limit filter',
      whyPrimaryWins: 'Drops abusive traffic before it hits your infra',
    },
    {
      tier: 'Scripting',
      purpose: 'Atomic check-and-increment logic',
      primaryPick: 'Redis Lua scripts',
      alternatives: 'Redis Functions, application-level locks',
      whyPrimaryWins: 'Lua executes atomically on Redis - no race conditions between read and increment',
    },
    {
      tier: 'Sync Layer',
      purpose: 'Cross-node counter aggregation for distributed limiting',
      primaryPick: 'Redis Cluster',
      alternatives: 'Envoy global rate limiting, Consul',
      whyPrimaryWins: 'Shared counters across all API servers without local-only drift',
    },
  ],
  technologyChoicesNote:
    'Why Redis over application-level counters? With 10+ API servers, each tracking its own counter means the real limit is N x configured limit. A shared Redis counter gives a global view. Lua scripts make the check-increment-expire atomic, eliminating TOCTOU races.',

  scaleEstimation: [
    'Users: Millions of API clients (both internal services and external developers)',
    'Write QPS: 1M rate-limit checks/sec (every API request triggers a counter check)',
    'Read QPS: Same as write - each check is a read-modify-write on the counter',
    'Storage: ~10GB counter storage in Redis (key per client per window, short TTL)',
    'Bandwidth: Sub-ms latency per check - rate limiter must not become the bottleneck',
  ],

  apiInterface: [],

  highLevelDesignIntro:
    "Let's build this up incrementally: start with a single shared counter, layer in the right algorithm for the job, then decide where to enforce it and how to survive Redis going down.",

  builds: [
    {
      title: 'Shared Counter in Redis',
      body:
        "The naive HashMap breaks the moment you have more than one API pod. The fix: all pods talk to the SAME counter in Redis instead of keeping their own. Doesn't matter which pod handles the request - the global count is always accurate.\n\nWhat is Redis? An in-memory database that responds in under 1 millisecond. Perfect for counters because it's fast enough to check on every single request without slowing down your API.",
      newComponents: [
        {
          name: 'Multiple API Pods',
          description: 'Your application servers running behind a load balancer. Requests hit any of them randomly.',
        },
        {
          name: 'Redis (shared counters)',
          description:
            'A single, blazing-fast in-memory database that ALL pods talk to. It holds the rate-limit counters so every pod sees the same global count.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  pod1["API Pod 1"]:::compute
  pod2["API Pod 2"]:::compute
  pod3["API Pod 3"]:::compute
  redis[("Redis<br/>shared counters")]:::cache
  client -->|"1. Request to pod 1"| pod1
  client -->|"2. Request to pod 2"| pod2
  client -->|"3. Request to pod 3"| pod3
  pod1 -->|"4. INCR rate counter"| redis
  pod2 -->|"5. INCR rate counter"| redis
  pod3 -->|"6. INCR rate counter"| redis`,
      },
      closingNote:
        'With a shared counter in place, the remaining question is which algorithm decides ALLOW vs REJECT. There are 5 main approaches - you need to know all of them for interviews, but Token Bucket and Sliding Window Counter are the most common in production.',
    },
    {
      title: 'Algorithm 1: Fixed Window Counter',
      body:
        'Divide time into fixed intervals (e.g., every 60 seconds). Maintain one counter per user per window. Each request increments the counter. If counter exceeds the limit, reject. At the window boundary, the counter resets to 0.\n\nExample: limit 100 requests/min, window 12:00:00-12:00:59. Request #73 at 12:00:45 -> counter=73 -> ALLOW. Request #101 at 12:00:58 -> counter=101 -> REJECT (429). Clock hits 12:01:00 -> counter resets to 0.\n\nRedis implementation:\nkey = "rate:{userId}:{minute_number}"\ncount = INCR key\nif count == 1: EXPIRE key 60   (auto-cleanup)\nif count > limit: REJECT\nelse: ALLOW\n\nThe boundary burst problem: a user sends 100 requests at 12:00:58 (end of window 1) - allowed. Then 100 more at 12:01:01 (start of window 2) - also allowed. Result: 200 requests in 3 seconds, but technically "within limits" in both windows.',
      diagram: {
        mermaid: `flowchart LR
  subgraph W1["Window 12:00-12:01"]
    A["100 requests at 12:00:58"]
  end
  subgraph W2["Window 12:01-12:02"]
    B["100 requests at 12:01:01"]
  end
  result["200 requests in 3 seconds!"]:::client
  A -->|"1. Window A: 100 reqs"| result
  B -->|"2. Window B: 100 reqs"| result`,
      },
      closingNote:
        'Pros: dead simple (one INCR + one EXPIRE), minimal memory (1 counter per user), O(1) per request. Cons: boundary burst allows 2x the limit, not accurate for tight limits, resets abruptly. Used by: GitHub API (60/hour for unauthenticated), Twitter/X (15-minute fixed windows), Slack API.',
    },
    {
      title: 'Algorithm 2: Sliding Window Log',
      body:
        'Store the exact timestamp of EVERY request in a sorted list (Redis Sorted Set). On each new request: remove all entries older than now - window_size, count the remaining entries, and if count < limit, allow and add the new timestamp; else reject.\n\nExample: limit 5 requests/60s, current time 12:01:30, stored timestamps [12:00:25, 12:00:45, 12:01:05, 12:01:20, 12:01:28]. Purging entries before 12:00:30 removes 12:00:25, leaving 4 remaining. 4 < 5 -> ALLOW, add 12:01:30 to the set.\n\nRedis implementation:\nkey = "rate:{userId}"\nnow = current_timestamp_ms\n\nZREMRANGEBYSCORE key 0 (now - window_ms)  (purge old)\ncount = ZCARD key                          (count remaining)\nif count < limit:\n    ZADD key now now                       (log this request)\n    ALLOW\nelse:\n    REJECT\n\nMemory: for a user with a 10,000 requests/hour limit, that is 10,000 timestamps stored per user. At 8 bytes each = 80KB per user. With 1M users = 80GB. Expensive.',
      closingNote:
        'Pros: perfectly accurate, zero boundary burst, true rolling window, no approximation. Cons: memory-heavy (stores every timestamp), O(n) cleanup on each request. Used by: payment/billing systems where exact counts are non-negotiable. Not practical for high-volume public APIs.',
    },
    {
      title: "Algorithm 3: Sliding Window Counter (Cloudflare's approach)",
      body:
        'This is the "best of both worlds" - accuracy of sliding window + memory of fixed window. Keep TWO counters: one for the current fixed window, one for the previous window. Estimate the rolling count using a weighted formula:\n\nestimated_count = current_window_count + (previous_window_count x overlap_percentage)\n\nThe overlap percentage is how much of the previous window is still "within" our rolling window.\n\nExample: limit 100/min, current time 12:01:45 (45s into the current window). Previous window (12:00-12:01): 80 requests. Current window (12:01-12:02): 30 requests so far. Overlap: 15s of the old window still counts = 15/60 = 25%. Estimated count: 30 + (80 x 0.25) = 30 + 20 = 50 -> under 100 -> ALLOW.\n\nRedis implementation:\nprev_key = "rate:{userId}:{prev_minute}"\ncurr_key = "rate:{userId}:{curr_minute}"\nelapsed = seconds_into_current_window\nweight = (window_size - elapsed) / window_size\n\nestimated = GET curr_key + GET prev_key x weight\nif estimated < limit:\n    INCR curr_key\n    ALLOW\nelse:\n    REJECT',
      diagram: {
        mermaid: `flowchart LR
  subgraph prevWindow["Previous Window 12:00-12:01<br/>80 requests"]
    overlap["Last 15s<br/>still counts<br/>80 x 0.25 = 20"]:::cache
  end
  subgraph currWindow["Current Window 12:01-12:02<br/>30 requests so far"]
    now["We are here<br/>at 12:01:45"]:::client
  end
  total["Estimated: 30 + 20 = 50"]:::compute
  overlap -->|"1. Weight previous"| total
  currWindow -->|"2. Add current"| total`,
      },
      closingNote:
        'Pros: smooth (no boundary bursts), O(1) memory (just 2 counters per user), Cloudflare tested this at 400M requests with a 0.003% error rate. Cons: approximate (~0.003% error rate), slightly more logic than fixed window. Memory: same as fixed window - 2 integers per user, ~16MB at 1M users. Used by: Cloudflare (45M+ req/sec), most modern REST APIs - the go-to choice when you need accuracy without the memory cost of a sliding log.',
    },
    {
      title: 'Algorithm 4: Token Bucket (most popular in production)',
      body:
        'Think of a bucket that fills with tokens at a steady rate. Each request costs one token. If the bucket is empty, the request is rejected. This allows controlled bursts.\n\nHow it works: each user has a bucket with a maximum capacity (e.g., 10 tokens). Tokens are added at a fixed refill rate (e.g., 1 token every 6 seconds = 10/minute). Each request consumes 1 token. If the bucket is empty, reject with 429. Tokens never exceed max capacity.\n\nExample: bucket capacity 10, refill rate 1 token/6s (10/min). At 12:00:00 the bucket is full (10 tokens). User sends 8 requests instantly -> 8 tokens consumed -> 2 remaining -> all ALLOWED. At 12:00:06, 1 token refills -> bucket = 3. At 12:00:12, 1 more -> bucket = 4. User sends 5 requests -> 4 used, 1 rejected.\n\nWhy bursts are OK: the bucket starts full, so a user can "burst" up to 10 requests instantly, then must wait for refills. Over time the average rate converges to the refill rate (10/min) - this matches real user behavior, since people don\'t send requests at a perfectly steady rate.\n\nRedis implementation (lazy refill, no background timer):\nkey = "bucket:{userId}"\nstored = GET key -> {tokens: 7, last_refill: 1750000000}\n\nelapsed = now - last_refill\nnew_tokens = elapsed x refill_rate\ntokens = min(capacity, stored.tokens + new_tokens)\n\nif tokens >= 1:\n    tokens -= 1\n    SET key {tokens, last_refill: now}\n    ALLOW\nelse:\n    SET key {tokens, last_refill: now}\n    REJECT\n\nLazy refill: instead of a background timer adding tokens, we calculate how many tokens SHOULD have been added since the last request. Same result, zero background processes.',
      diagram: {
        mermaid: `flowchart TD
  bucket["Token Bucket<br/>capacity = 10<br/>current = 7 tokens"]:::cache
  refill["Refill<br/>+1 token every 6 sec"]:::compute
  req["Request arrives<br/>costs 1 token"]:::client
  check{"tokens >= 1?"}:::compute
  allow["Allow<br/>tokens -= 1"]:::compute
  reject["429 Reject"]:::client
  refill -->|"1. Adds tokens up to max"| bucket
  req -->|"2. Consume token"| check
  check -->|"3. Yes"| allow
  check -->|"4. No"| reject
  bucket -->|"5. Serve content"| check`,
      },
      closingNote:
        'Pros: allows natural burst behavior, smooth long-term rate enforcement, memory efficient (~50 bytes/user), best UX for API consumers. Cons: two values stored per user (tokens + timestamp), tuning capacity + refill rate takes thought, needs Redis for sync in distributed systems. Used by: Stripe, AWS API Gateway, GitHub, Amazon - the industry default for public APIs.',
    },
    {
      title: 'Algorithm 5: Leaky Bucket',
      body:
        "Like token bucket but inverted: requests go INTO the bucket, and leak out at a constant rate. If the bucket overflows, requests are dropped.\n\nHow it works: incoming requests are added to a queue (the bucket) with a fixed capacity. A background worker processes requests from the queue at a constant, steady rate. If the queue is full when a new request arrives, drop it (429).\n\nThink of it as water pouring into a bucket with a small hole at the bottom. Water drains at a constant rate. If you pour too fast, the bucket overflows and water spills (requests are rejected).\n\nExample: bucket size 5, leak rate 1 request processed every 200ms (5/sec outflow). 10 requests arrive simultaneously - the first 5 fill the bucket and queue up, the next 5 find the bucket full and are REJECTED. Over the next second, the 5 queued requests are processed one every 200ms.\n\nKey difference from Token Bucket: Token Bucket controls how many requests a user can SEND (input shaping); Leaky Bucket controls how fast requests are PROCESSED (output shaping). Token Bucket allows bursts; Leaky Bucket smooths everything to a constant output rate.",
      diagram: {
        mermaid: `flowchart LR
  inflow["Burst of 10 requests"]:::client
  bucket["Leaky Bucket<br/>capacity = 5<br/>leak rate = 1 per 200ms"]:::cache
  outflow["Steady output<br/>1 req every 200ms"]:::compute
  drop["Dropped<br/>5 requests overflow"]:::client
  inflow -->|"1. 5 fit"| bucket
  inflow -->|"2. 5 overflow"| drop
  bucket -->|"3. Constant drip"| outflow`,
      },
      closingNote:
        "Pros: perfectly smooth output (protects backends), prevents downstream overload, simple FIFO queue implementation. Cons: no burst tolerance (strict constant rate), adds latency (requests wait in queue), old requests processed before new ones. Used by: Shopify REST API (bucket size 40, leak rate 2/sec), Netflix (streaming traffic shaping). Best for protecting downstream services that can't handle spikes.",
      insightCallout:
        'Comparison table - Fixed Window: ~8 bytes/user, 2x burst at boundaries, low accuracy, best for simple internal APIs/MVPs. Sliding Window Log: O(n)/80KB+ at scale, no burst (perfect), perfect accuracy, best for billing/payment systems. Sliding Window Counter: ~16 bytes/user, smooth, ~99.99% accuracy, best for most public REST APIs. Token Bucket: ~50 bytes/user, controlled bursts, high accuracy, best for user-facing APIs (Stripe, AWS). Leaky Bucket: ~50 bytes-1KB, no burst (smooths all), high accuracy, best for traffic shaping and backend protection.',
    },
    {
      title: 'Choosing the Right Algorithm',
      body:
        'Decision flowchart: start by asking whether the system needs to allow short bursts. If yes, use Token Bucket. If no, ask whether exact precision is required - if yes, use Sliding Window Log; if approximate is fine, ask whether you need to shape outbound traffic - if yes, use Leaky Bucket, otherwise use Sliding Window Counter. For the simplest possible case, Fixed Window is always an option.',
      diagram: {
        mermaid: `flowchart TD
  start["What does your system need?"]:::client
  q1{"Allow short bursts?"}:::compute
  q2{"Need exact precision?"}:::compute
  q3{"Shaping outbound traffic?"}:::compute
  tb["Token Bucket<br/>Stripe, AWS, GitHub"]:::cache
  swc["Sliding Window Counter<br/>Cloudflare, most APIs"]:::cache
  swl["Sliding Window Log<br/>Payment and billing systems"]:::cache
  lb["Leaky Bucket<br/>Shopify, Netflix"]:::cache
  fw["Fixed Window<br/>Simple internal use"]:::cache
  start -->|"1. Which algorithm?"| q1
  q1 -->|"2. Yes"| tb
  q1 -->|"3. No"| q2
  q2 -->|"4. Yes exact"| swl
  q2 -->|"5. No approx OK"| q3
  q3 -->|"6. Yes smooth output"| lb
  q3 -->|"7. No just cap input"| swc
  start -->|"8. Simplest possible"| fw`,
      },
      insightCallout:
        'Interview tip: start with Token Bucket as your default answer. If the interviewer asks "what if we can\'t tolerate any burst?" switch to Sliding Window Counter. If they ask "what if we need to protect a fragile downstream?" go with Leaky Bucket.',
      closingNote: "With an algorithm chosen, the next question is where in the stack to actually enforce it.",
    },
    {
      title: 'Where to Rate Limit (3 Layers)',
      body:
        'Why three layers instead of one? Each layer catches a different class of threat at a different cost. Edge blocks volumetric DDoS attacks before they hit your infrastructure (cheapest, highest volume). Gateway enforces business rules like "free vs paid tier" (requires knowing who the user is). Service-level limits handle domain logic only your code understands ("max 5 password resets per hour"). Skipping layers means you\'re either blocking too much (service-level can\'t handle DDoS volume) or too little (edge doesn\'t know your business rules).\n\nEdge (Cloudflare/WAF) blocks DDoS, bots, and abusive IPs, keyed by IP address. Example: "No IP can send >1000 req/sec".\nGateway (Kong/Envoy) enforces per-user quotas, keyed by API key or user ID. Example: "Free tier: 100/min. Paid: 10000/min".\nService level enforces domain-specific limits, keyed per resource. Example: "Max 5 password reset emails/hour".',
      newComponents: [
        { name: 'Edge / WAF (Cloudflare)', description: 'Blocks DDoS, bots, and abusive IPs before traffic reaches your infrastructure.' },
        { name: 'API Gateway (Kong/Envoy)', description: 'Enforces per-user quotas by API key or user ID, differentiating free vs paid tiers.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  l1["Layer 1: Edge"]:::edge
  l2["Layer 2: Gateway"]:::edge
  l3["Layer 3: Service<br/>your code<br/>domain-specific"]:::compute
  backend[Backend]:::compute
  client -->|"1. Incoming request"| l1
  l1 -->|"2. Pass to user limit"| l2
  l2 -->|"3. Evaluate rate limit"| l3
  l3 -->|"4. Allow"| backend`,
      },
      closingNote:
        'Edge blocks volumetric attacks cheaply (before they hit your servers). Gateway enforces business rules. Service handles logic that only your code understands.',
    },
    {
      title: 'What Happens When Redis Goes Down?',
      body:
        'This is a classic interview question. Three options: Fail-Closed (reject all requests), Fail-Open (allow all requests), or Fallback (switch to a local in-memory bucket).',
      newComponents: [
        {
          name: 'Local Fallback Bucket',
          description: 'A per-pod, in-memory token bucket each pod switches to independently when Redis is unreachable.',
        },
      ],
      diagram: {
        mermaid: `flowchart TD
  down["Redis is down"]:::cache
  fc["Fail-Closed<br/>reject all requests"]:::compute
  fo["Fail-Open<br/>allow all requests"]:::compute
  fb["Fallback<br/>local in-memory bucket"]:::compute
  down -->|"1. Redis unavailable"| fc
  down -->|"2. Redis unavailable"| fo
  down -->|"3. Redis unavailable"| fb
  fc -->|"4. Global outage"| bad["Users locked out"]:::client
  fo -->|"5. No protection"| ok["Backend might overload"]:::client
  fb -->|"6. Graceful"| good["Slightly inaccurate but safe"]:::client`,
      },
      closingNote:
        'Best answer for interviews: "Fail-open with a local fallback. If Redis is unreachable, each pod switches to a local in-memory token bucket. Less accurate (each pod enforces limit/N independently) but the API stays up. Alert on Redis being down so ops investigates."',
    },
    {
      title: 'Response Headers',
      body:
        'When your API has rate limiting, always return these headers so clients can self-throttle.\n\nOn success:\nHTTP/1.1 200 OK\nX-RateLimit-Limit: 100        (max requests per window)\nX-RateLimit-Remaining: 87     (how many left)\nX-RateLimit-Reset: 1750860060 (when the window resets, unix timestamp)\n\nOn rejection:\nHTTP/1.1 429 Too Many Requests\nRetry-After: 42               (seconds to wait before retrying)\nX-RateLimit-Limit: 100\nX-RateLimit-Remaining: 0',
      closingNote:
        'These four headers - Limit, Remaining, Reset, and Retry-After - are the contract every rate-limited API should honor so well-behaved clients can back off on their own.',
    },
  ],

  coreFlows: [
    {
      title: 'Request Allowed',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant GW as API Gateway
  participant R as Redis
  participant API as Backend API

  C->>GW: GET /api/search
  GW->>GW: extract API key from header
  GW->>R: EVALSHA token_bucket_check
  R->>R: refill tokens based on elapsed time
  R->>R: tokens >= 1 so decrement
  R-->>GW: ALLOWED remaining=87
  GW->>API: forward request
  API-->>GW: 200 response
  GW-->>C: 200 with X-RateLimit-Remaining 87`,
      },
    },
    {
      title: 'Request Rejected',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant GW as API Gateway
  participant R as Redis

  C->>GW: GET /api/search
  GW->>R: EVALSHA token_bucket_check
  R->>R: tokens = 0
  R-->>GW: REJECTED reset_in=42s
  GW-->>C: 429 Too Many Requests with Retry-After 42`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Distributed Rate Limiting',
      problem: 'You have 10 API servers. If each uses its own counter, the total allowed = 10x the limit.',
      diagram: {
        mermaid: `flowchart TD
  subgraph problemBox["Without shared state"]
    p1["Pod 1: count=50"]:::compute
    p2["Pod 2: count=50"]:::compute
    p3["Pod 3: count=50"]:::compute
    total["Total: 150 but limit is 100!"]:::client
  end
  subgraph solutionBox["With Redis"]
    r1["Pod 1"]:::compute
    r2["Pod 2"]:::compute
    r3["Pod 3"]:::compute
    redis["Redis: count=100"]:::cache
    r1 -->|"1. INCR rate counter"| redis
    r2 -->|"2. INCR rate counter"| redis
    r3 -->|"3. INCR rate counter"| redis
  end`,
      },
      bad:
        'No shared state at all - each pod keeps its own independent counter. Pod 1 counts 50, Pod 2 counts 50, Pod 3 counts 50 - total 150 requests get through even though the limit is 100, because no pod knows what the others have already allowed.',
      good:
        'Two partial fixes exist short of full centralization: sticky routing, where the load balancer always sends a given client to the same pod (simple, but causes uneven load distribution across pods), or local + periodic sync, where each pod counts locally and syncs to Redis every 100ms (fast, but can overshoot the limit by about 10%).',
      great:
        'Centralized Redis: every request checks the one shared counter, so Pod 1, Pod 2, and Pod 3 all call INCR against the same Redis key and the count is always exactly 100, never 150 - accurate but adds 0.5-2ms of latency per request. Interview answer: for protective limits (abuse prevention), local + periodic sync is fine - 10% overshoot is acceptable. For strict limits (billing, credits), always check centralized Redis.',
    },
    {
      title: 'Handling Burst Traffic',
      problem:
        "Limit is 100/minute. Client sends all 100 in the first second. Technically within quota, but backend can't handle 100 concurrent requests from one client.",
      bad:
        'A single sustained-rate limit only (e.g. 100 requests/minute, enforced by any of the algorithms above). This technically allows a client to legally spend its entire minute of quota in the first second, which is exactly the failure mode above - the backend still gets slammed with 100 concurrent requests even though the client never went "over the limit."',
      good:
        'Enforce only a tight per-second cap uniformly (e.g. 10 requests/second) in place of the per-minute limit. This prevents the spike, but on its own it also throttles legitimate clients who want to use their full per-minute allowance in a smooth, non-bursty way - it conflates "no spikes" with "lower overall throughput."',
      great:
        'Two-tier limiting: enforce a burst check (max 10 requests in any 1-second window) and a sustained check (max 100 requests in any 60-second window) together - both must pass. This is what Stripe does; they publish both a per-second and a per-minute limit, so clients get the full 100/minute allowance but can never slam the backend with more than 10 in any given second.',
      diagram: {
        mermaid: `flowchart TD
  req["Incoming request"]:::client
  burst["Burst check<br/>max 10 per second"]:::compute
  sustain["Sustained check<br/>max 100 per minute"]:::compute
  allow["Allow"]:::compute
  reject["429 Reject"]:::client
  req -->|"1. Check burst"| burst
  burst -->|"2. Pass"| sustain
  burst -->|"3. Fail"| reject
  sustain -->|"4. Pass"| allow
  sustain -->|"5. Fail"| reject`,
      },
    },
  ],

  selfAudit: [
    { question: 'Which algorithm?', answer: 'Token Bucket - allows bursts, caps sustained rate.' },
    { question: 'Where to store counters?', answer: 'Redis - sub-ms latency, atomic Lua, built-in TTL.' },
    { question: 'How to make it atomic?', answer: 'Redis Lua script - read + check + decrement in one operation.' },
    { question: 'What if Redis is down?', answer: 'Fail-open + local fallback. Never be a single point of failure.' },
    { question: 'Where to put it?', answer: '3 layers: Edge (IP/DDoS) -> Gateway (per-user) -> Service (domain logic).' },
    { question: 'How to handle distributed?', answer: 'Centralized Redis for strict limits; local sync for soft limits.' },
    {
      question: 'What headers to return?',
      answer: 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  clients[Clients]:::client
  edge["Edge WAF<br/>IP limits and DDoS"]:::edge
  gateway["API Gateway<br/>per-user limits"]:::edge
  ratelimiter["Rate Limit Check<br/>Redis Lua script"]:::compute
  redis[("Redis Cluster<br/>token buckets")]:::cache
  rules[("Rules Config<br/>limit per tier")]:::database
  backend["Backend Services"]:::compute
  analytics["Analytics<br/>limit events"]:::async

  clients -->|"Incoming request"| edge
  edge -->|"IP check pass"| gateway
  gateway -->|"Read cache"| ratelimiter
  ratelimiter -->|"INCR rate counter"| redis
  ratelimiter -->|"Load limit rules"| rules
  gateway -->|"Allowed"| backend
  ratelimiter -->|"Publish change"| analytics`,
  },

  keyTechnologies: [
    { term: 'Redis', definition: 'An in-memory database. Responds in < 1ms. Used for counters, caches, and fast lookups.' },
    {
      term: 'Lua script',
      definition:
        'A tiny program that runs INSIDE Redis. Lets you read + check + write atomically in one network call. No race conditions between "check count" and "increment count".',
    },
    {
      term: 'API Gateway',
      definition: 'A server that sits in front of your APIs. Handles auth, rate limiting, routing. Examples: Kong, Envoy, AWS API Gateway.',
    },
    {
      term: 'CDN / Edge',
      definition: 'Servers at the "edge" of the network, close to users worldwide. Cloudflare, CloudFront. First line of defense.',
    },
    {
      term: 'Token Bucket',
      definition: 'Algorithm: bucket of tokens, refills at a steady rate. Each request costs a token. Empty bucket = rejected.',
    },
    { term: 'HTTP 429', definition: 'Standard HTTP status code meaning "Too Many Requests." Client should back off and retry later.' },
  ],

  expectedDepth: {
    mid:
      'Explain the token bucket or fixed window algorithm. Propose Redis INCR for counting requests per time window. Understand why in-memory counters fail across multiple servers - each server has its own count, so a client can exceed limits by hitting different servers.',
    senior:
      'Compare token bucket vs sliding window vs sliding window log - articulate the tradeoffs (burst tolerance, memory, precision). Propose Redis Lua scripts for atomic check-and-increment. Discuss multi-tier limiting (edge + gateway + service) and what happens when Redis goes down (fail-open vs fail-closed tradeoff).',
    staffPlus:
      'Address distributed rate limiting across multiple regions with eventual consistency (local counters + periodic sync vs centralized Redis). Discuss adaptive rate limits that adjust dynamically based on system load (shed traffic before the backend saturates). Cover per-endpoint granularity (expensive operations like writes get tighter limits than cheap reads) and cost-based limiting where each operation has a "weight" consuming tokens proportionally.',
  },

  keyTakeaways: [
    'Token bucket allows bursts; sliding window is smoother but more complex',
    'Redis Lua scripts make check-and-increment atomic - no race conditions',
    'Apply at multiple levels: per-user, per-IP, per-endpoint, global',
    'Return 429 with Retry-After header - good API citizenship',
  ],

  relatedDesigns: ['url-shortener', 'real-time-leaderboard', 'notification-system'],
  relatedConcepts: [
    { name: 'Rate Limiting', description: 'The core algorithms (token bucket, sliding window) this whole design is built on.' },
    { name: 'Caching', description: 'Redis holds the per-client counters for sub-millisecond checks.' },
    { name: 'Distributed Locking', description: 'Atomic check-and-decrement via Lua keeps counts correct across many pods.' },
  ],

  simulator: {
    goalDescription: 'Check every incoming request against a shared quota before it reaches the backend, without becoming the bottleneck yourself.',
    requirementChips: ['1M checks/sec', 'Sub-ms check latency', 'No pod-local counters'],
    targetRps: 1000000,
    readRatio: 0.5,
    cacheHitRatio: 0,
    latencyBudgetMsP99: 5,
    rubric: [
      {
        id: 'edge-gateway',
        label: 'Gateway/edge tier enforcing per-user limits',
        kind: 'requires-node-type',
        nodeType: ['api-gateway', 'load-balancer'],
      },
      { id: 'token-bucket-store', label: 'Shared counter store for rate-limit state (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'backend-tier',
        label: 'Backend compute tier receiving allowed traffic',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-gateway', label: 'No single point of failure on the enforcement path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 8, position: { x: 320, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 26, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 12, position: { x: 880, y: 120 } },
        { id: 'app-1', type: 'app-server', instanceCount: 70, position: { x: 880, y: 280 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-gw', source: 'lb-1', target: 'gw-1' },
        { id: 'e-gw-redis', source: 'gw-1', target: 'redis-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The API Gateway runs an atomic Redis Lua script (EVALSHA) to check-and-decrement the token bucket for each request in a single round trip; only requests that pass are forwarded to the backend, so Redis absorbs 100% of rate-limit checks while the backend only ever sees allowed traffic.',
    failureModeNarratives: {
      redis:
        'All rate-limit state lives in Redis; if the Redis cluster is unreachable, every gateway instance has no shared source of truth for counters and must fall back to fail-open or a local in-memory bucket.',
    },
    fullDesignLinkSlug: 'rate-limiter',
  },
}

export default topic
