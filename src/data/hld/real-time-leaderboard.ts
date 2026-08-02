import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'real-time-leaderboard',
  title: 'Real-Time Leaderboard',
  difficulty: 'Beginner',
  icon: 'pi pi-trophy',
  color: '#f59e0b',
  readTimeMinutes: 21,
  topics: ['Redis Sorted Sets', 'Sharding', 'Real-Time Updates'],
  companies: ['Dream11', 'Riot Games', 'Amazon', 'Google'],
  prerequisites: ['Caching'],
  summary:
    'A live-updating ranking service that uses a Redis Sorted Set to serve top-N and rank queries in O(log N) instead of a full table sort.',

  understandingProblem:
    "You're building a game or competition with millions of players. Players earn scores, and you need to show a ranked leaderboard in real-time. Anyone can check their rank, see the top players, or see who's around them - all in under 50ms.",
  realExamples:
    "Dream11 fantasy cricket (live scoring), Riot Games ranked mode (100M+ players), Duolingo weekly leaderboards, Strava segments.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  player[Player]:::client
  game[Game Server]:::compute
  pg[("Postgres players table")]:::database
  player --> game
  game -->|"ORDER BY score DESC"| pg`,
    },
    code: `-- Get top 10
SELECT * FROM players ORDER BY score DESC LIMIT 10;

-- Get my rank
SELECT COUNT(*) + 1 FROM players WHERE score > (SELECT score FROM players WHERE id = ?);`,
    whyThisBreaks: [
      'ORDER BY score DESC on 10M rows = full table sort every query',
      '"My rank" requires counting ALL players with higher scores = O(N) per query',
      'At 100K rank queries/sec during a live event, the database melts',
      'Every score update reshuffles the index - write-heavy workloads degrade reads',
      'No way to serve "ranks around me" efficiently without scanning',
    ],
    closingNote:
      'We need a data structure that keeps players sorted automatically and answers rank queries in O(log N), not O(N).',
  },

  priorArt: [
    {
      title: 'Redis Sorted Sets',
      description:
        'Skip-list backed sorted set giving O(log N) for all rank operations. The de-facto standard for real-time leaderboards. Used by Dream11, Riot Games, and most gaming platforms. (Redis documentation)',
      link: 'https://redis.io/docs/latest/develop/data-types/sorted-sets/',
    },
    {
      title: 'Riot Games Leaderboard',
      description:
        'Handles 100M+ ranked players across multiple regions with composite scoring (MMR + LP). Uses Redis with regional sharding. (Riot Engineering)',
    },
    {
      title: 'Discord Activity Status',
      description:
        'Real-time presence and activity leaderboards for millions of concurrent users using Redis pub/sub + sorted sets. (Discord Engineering)',
    },
  ],

  coreEntities: [
    { name: 'Player', description: 'User with a unique ID and a current score.' },
    { name: 'Score', description: "Numeric value representing the player's performance." },
    { name: 'Leaderboard', description: 'A named sorted collection (e.g., leaderboard:weekly:2026-W26).' },
    { name: 'Rank', description: "Player's position (1 = highest score)." },
  ],

  requirements: {
    core: [
      "Update a player's score - when a player completes an action (wins a match, answers a question), their score changes",
      'Get top N players - show the leaderboard: top 10, top 100, etc.',
      "Get a player's rank - \"what position am I?\" among all players",
    ],
    belowTheLine: [
      'Get players around a specific rank (e.g., rank 99-101)',
      'Multiple leaderboards (daily, weekly, all-time)',
      'Real-time push updates (WebSocket) when ranks change',
      'Anti-cheat validation',
    ],
    nonFunctionalTable: [
      { metric: 'Latency', target: '< 50ms for rank queries and score updates' },
      { metric: 'Throughput', target: '50K score updates/sec + 100K rank reads/sec during live events' },
      { metric: 'Availability', target: '99.99% - leaderboard is the main engagement feature' },
      { metric: 'Scale', target: '10M+ players per leaderboard' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Ranking Engine',
      purpose: 'Real-time sorted scores + rank queries',
      primaryPick: 'Redis Sorted Sets',
      alternatives: 'DynamoDB, Cassandra, custom skip-list',
      whyPrimaryWins: 'O(log N) rank/update; the industry standard for leaderboards',
    },
    {
      tier: 'Durable Store',
      purpose: 'Rebuild source if Redis fails',
      primaryPick: 'Postgres',
      alternatives: 'MySQL, DynamoDB, CockroachDB',
      whyPrimaryWins: 'ACID writes for score events; small dataset fits one instance',
    },
    {
      tier: 'Event Bus',
      purpose: 'Fan-out score events to aggregators',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, RabbitMQ',
      whyPrimaryWins: 'Ordered per-partition replay lets the global aggregator merge regionally',
    },
    {
      tier: 'Real-Time Push',
      purpose: 'Live rank updates to clients',
      primaryPick: 'WebSocket',
      alternatives: 'SSE, Long Polling, gRPC stream',
      whyPrimaryWins: 'Bi-directional; players need instant rank changes during live events',
    },
    {
      tier: 'Cache',
      purpose: 'Top-N leaderboard snapshot',
      primaryPick: 'Redis (separate key)',
      alternatives: 'Memcached, Caffeine',
      whyPrimaryWins: 'Same Redis cluster; avoids a cross-system hop for hot reads',
    },
  ],
  technologyChoicesNote:
    'Why Redis over a SQL ORDER BY? A sorted set gives O(log N) for rank lookup and score update - microseconds for 10M entries. SQL requires a full sort or counting query per rank request, which collapses under 100K reads/sec during live events.',

  scaleEstimation: [
    'Users: 10M players, 1M concurrent during live events',
    'Write QPS: 50K score updates/sec during live events',
    'Read QPS: 100K rank queries/sec (leaderboard page loads)',
    'Storage: ~6GB in Redis for 10M entries (key + score + overhead)',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/scores',
      description: "Update a player's score.",
      example: '// Request\n{ "playerId": "player_42", "score": 1500, "gameId": "g_1" }\n\n// Response 200\n{ "newRank": 1547 }',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard?top=100',
      description: 'Return the top-N players.',
      example: '// Response 200\n[{ "playerId": "player_1", "score": 98240, "rank": 1 }, ...]',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard/rank?playerId=player_42',
      description: "Return a player's rank and score.",
      example: '// Response 200\n{ "rank": 1547, "score": 1500 }',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard/around?playerId=player_42&range=5',
      description: 'Return players immediately above and below a given player.',
      example: '// Response 200\n[5 above, player_42, 5 below] with ranks',
    },
  ],
  apiSecurityNote:
    'Score updates should only come from trusted game servers (server-to-server auth), never directly from client apps. Clients can only READ ranks.',

  highLevelDesignIntro: "Let's build this incrementally, one requirement at a time.",

  builds: [
    {
      title: "FR1: Update a Player's Score",
      body:
        'The first thing we need: when a player scores, update the leaderboard instantly. The naive SQL approach fails at scale (see above). We need a data structure designed for sorted data with fast updates.\n\nThe solution: Redis Sorted Set (ZSET).',
      insightCallout:
        'A Redis Sorted Set stores (score, member) pairs and keeps them sorted automatically. Internally it uses a skip list - like a linked list with "express lanes" - giving O(log N) for insert, update, and rank lookup. For 10M players: log2(10M) ≈ 23 comparisons. Microseconds.',
      newComponents: [
        {
          name: 'Game Server',
          description:
            "The backend running your game logic. Knows when a player's score changes. Authoritative source of truth for scores.",
        },
        { name: 'Leaderboard Service', description: 'API layer that translates business requests into Redis commands.' },
        { name: 'Redis Sorted Set', description: 'The star. ZADD to add/update scores, maintains sorted order automatically.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  game[Game Server]:::compute
  svc[Leaderboard Service]:::edge
  redis[("Redis Sorted Set")]:::cache
  game --> svc
  svc -->|"ZADD"| redis`,
      },
      steps: [
        'Player wins a match -> Game Server calculates new score (1500)',
        'Game Server calls Leaderboard Service: POST /scores { playerId: "player_42", score: 1500 }',
        'Leaderboard Service executes: ZADD leaderboard 1500 "player_42"',
        'Redis updates the skip list - player is now in sorted position. Done in ~0.1ms.',
        'Service returns the player\'s new rank (optional: ZREVRANK leaderboard "player_42")',
      ],
      closingNote:
        'Why Redis and not a database? At 50K writes/sec during live events, a database index rebuild would lag behind. Redis keeps everything in memory with O(log N) operations - microsecond response regardless of dataset size.',
    },
    {
      title: 'FR2: Get Top N Players',
      body:
        'Now players want to see the leaderboard. "Show me the top 100." With our Redis Sorted Set already maintaining sorted order, this is trivial.\n\nNo new components needed - Redis already has this built in.',
      steps: [
        'Player opens leaderboard page -> GET /leaderboard?top=100',
        'Leaderboard Service executes: ZREVRANGE leaderboard 0 99 WITHSCORES',
        'Redis returns 100 players sorted by score (highest first) - O(log N + 100)',
        'Service returns the ranked list to the client',
      ],
      diagram: {
        title: 'Core Flow: Get Top N (Sequence)',
        mermaid: `sequenceDiagram
  participant P as Player
  participant S as Leaderboard Service
  participant R as Redis

  P->>S: GET /leaderboard?top=100
  S->>R: ZREVRANGE leaderboard 0 99 WITHSCORES
  R-->>S: 100 players with scores
  S-->>P: Ranked list with positions`,
      },
      closingNote:
        "But what about durability? Redis is in-memory - if it restarts, the leaderboard is gone. We need a persistent backup.\n\nNew component: Postgres - durable source of truth. Every score update is also written to Postgres. If Redis goes down, we rebuild the Sorted Set from the database.",
    },
    {
      title: "FR3: Get a Player's Rank",
      body:
        'The most frequent query: "What\'s MY rank?" With 10M players, this must be instant.\n\nStill no new components - Redis Sorted Set handles this natively.',
      insightCallout:
        'ZREVRANK leaderboard "player_42" -> returns 1546 (0-indexed). O(log N). For 10M players: ~23 operations internally. Microseconds.',
      steps: [
        'Player taps "My Rank" -> GET /leaderboard/rank?playerId=player_42',
        'Service executes: ZREVRANK leaderboard "player_42" -> returns 1546',
        'Service also gets score: ZSCORE leaderboard "player_42" -> returns 1500',
        'Returns { rank: 1547, score: 1500 } (converting 0-indexed to 1-indexed)',
      ],
      closingNote:
        "\"Players around me\" is equally simple: ZREVRANGE leaderboard 1541 1551 WITHSCORES -> 11 players around rank 1547.\n\nThis completes all three core functional requirements with just Redis + Postgres. Now let's address scale.",
    },
  ],

  coreFlows: [
    {
      title: 'Score Update (Full)',
      diagram: {
        mermaid: `sequenceDiagram
  participant G as Game Server
  participant S as Leaderboard Service
  participant R as Redis
  participant P as Postgres

  G->>S: POST /scores playerId=42 score=1500
  S->>R: ZADD leaderboard 1500 player_42
  R-->>S: OK
  S->>R: ZREVRANK leaderboard player_42
  R-->>S: 1546
  S->>P: INSERT INTO scores (player_id, score, ts)
  P-->>S: OK
  S-->>G: 200 newRank=1547`,
      },
      nonObviousFailure:
        'What if the Redis write succeeds but the Postgres insert fails? The live leaderboard shows the new score, but if Redis restarts later, this score is lost during rebuild. Solution: log failed DB writes to a dead-letter queue and retry. Or make the DB write synchronous (acceptable at 50K WPS for a single INSERT).',
    },
  ],

  deepDives: [
    {
      title: 'Regional Sharding - What Happens During a Global Live Event',
      problem:
        "Your game operates worldwide. Players in Asia, Europe, and US all compete. If Redis lives in us-east-1, Asian players get 200ms latency on every interaction. That's unacceptable for \"real-time.\"",
      bad: 'Single global Redis in one region. All players hit it remotely. High latency for 2/3 of the world.',
      good:
        'Deploy a regional Redis read replica per continent; writes still go to the primary region but reads (top-N, rank lookups) are served from the nearest replica, cutting read latency for most traffic at the cost of eventual consistency on very recent writes.',
      great:
        "Shard the leaderboard by region into independent Redis clusters (na-east, eu-west, ap-south), each authoritative for its own players' writes and reads. A lightweight aggregator service periodically merges regional top-N lists into a single global view for cross-region leaderboards, trading a few seconds of staleness on the *global* view for local, low-latency reads and writes everywhere.",
    },
    {
      title: 'Tie-Breaking - When Two Players Have the Same Score',
      problem:
        'Redis Sorted Sets break ties lexicographically by member name. If Player A and Player B both have score 1500, their rank order is alphabetical. But you probably want "whoever scored first ranks higher."',
      simpleTerms:
        "Two players both have 1500 points. Who gets the higher rank? Redis will just sort by their name alphabetically - that's unfair. We need a better tie-breaker.",
      bad: 'Accept lexicographic tie-breaking. Players named "Aaron" always rank above "Zeus" on ties. Not fair.',
      good:
        'Store the timestamp of when the score was reached alongside the raw score, and break ties in application code after fetching a tied range from Redis - correct, but costs an extra round trip whenever a tie is detected.',
      great:
        "Encode the tie-breaker directly into the ZSET score: combine the real score with an inverted timestamp into a single composite number (score * 10^13 + (maxTimestamp - reachedAt)), so Redis's native ordering already reflects \"earliest to reach this score ranks higher\" with zero extra round trips.",
    },
    {
      title: 'Weekly Resets and Historical Leaderboards',
      problem:
        'Many games have weekly/seasonal leaderboards that reset. How do you atomically start a fresh leaderboard without downtime?',
      simpleTerms:
        'Every Monday, the leaderboard should start fresh (everyone back to 0). But how do you swap to a new empty leaderboard without players seeing a blank page for even a second?',
      bad:
        'DEL leaderboard -> create new one. Between delete and first writes, players see empty leaderboard. Even if just for 100ms, during that gap any rank query returns nothing.',
      good:
        'Build the new week\'s leaderboard under a temporary key while the old one keeps serving traffic, then switch the application\'s "current leaderboard key" pointer over once the new key is ready - avoids the empty-page gap but needs the app layer to track which key is current.',
      great:
        "Use Redis's atomic RENAME: build the new leaderboard under leaderboard:next, then RENAME leaderboard:next leaderboard. RENAME is atomic and near-instant even for large sets, so there is no window where the key is missing or partially populated - readers always see either the old or the new leaderboard, never neither.",
    },
    {
      title: 'Read Amplification During Live Events',
      problem:
        'During a tournament final, 1M players all load the leaderboard simultaneously. They\'re all asking for the same "top 100." That\'s 1M identical ZREVRANGE calls hitting Redis.',
      simpleTerms:
        'A million people asking the exact same question ("who\'s in the top 100?") at the same time. Even though each individual question is cheap, a million of them overwhelms even Redis.',
      bad:
        'Let all 1M requests hit Redis directly. Even though each ZREVRANGE is O(log N + 100), at 1M QPS the network bandwidth saturates the Redis node (each response is ~5KB x 1M = 5GB/sec of bandwidth).',
      good:
        'Cache the top-100 response in the API layer with a short TTL (e.g. 1 second) so repeated identical requests within that window are served from local memory instead of hitting Redis - cuts Redis load by orders of magnitude at the cost of up to 1 second of staleness on the top-100 view.',
      great:
        "Combine the short-TTL top-K cache with a WebSocket push channel: instead of every client polling, the leaderboard service pushes rank-diffs only when the cached top-100 actually changes, so most clients never issue a read request at all - Redis only sees the periodic refresh of the cache, not per-client traffic.",
    },
  ],

  selfAudit: [
    {
      question: 'Hot key problem?',
      answer:
        'The leaderboard IS a single key. But Redis ZSET handles 100K+ ops/sec per key. For extreme load, cache top-N results.',
    },
    {
      question: 'Redis goes down?',
      answer:
        'Rebuild from Postgres. Takes minutes for 10M entries. During rebuild, serve stale data from a read replica or return "temporarily unavailable."',
    },
    {
      question: 'Memory budget?',
      answer: '10M entries x ~600 bytes = ~6GB in Redis. Comfortable for any cloud Redis instance.',
    },
    {
      question: 'Anti-cheat?',
      answer: 'Only game servers (authenticated) can submit scores. Never trust client-submitted scores.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  players[Players]:::client
  gs[Game Servers]:::compute
  svc[Leaderboard Service]:::edge
  cache[["Top-K Cache (1s TTL)"]]:::cache
  redis[("Redis Sorted Set - live rankings")]:::cache
  pg[("Postgres - score history")]:::database

  players --> gs --> svc
  players -->|"reads"| svc
  svc --> cache --> redis
  svc --> redis
  svc --> pg`,
  },

  keyTechnologies: [
    {
      term: 'Redis Sorted Set (ZSET)',
      definition: 'O(log N) operations for insert, rank lookup, and range queries. The backbone of real-time leaderboards.',
    },
    { term: 'Skip List', definition: 'Internal data structure Redis uses for sorted sets. Linked list with express lanes for fast traversal.' },
    { term: 'ZADD', definition: "Add or update a member's score. O(log N)." },
    { term: 'ZREVRANK', definition: 'Get rank of a member (0 = highest score). O(log N).' },
    { term: 'ZREVRANGE', definition: 'Get members by rank range (top 10 = range 0-9). O(log N + K).' },
  ],

  expectedDepth: {
    mid: "Propose Redis Sorted Set for real-time ranking. Understand ZADD for updates and ZREVRANK for rank queries. Explain why SQL ORDER BY doesn't scale - it's O(N log N) per query vs O(log N) in Redis. Know that Redis is in-memory and needs a persistent backup (Postgres).",
    senior:
      'Discuss regional sharding - local Redis per geography for low-latency writes. Explain tie-breaking with timestamp encoding. Propose dual-store (Redis for speed, Postgres for durability). Discuss the "1M viewers asking for top 100" problem and how application-level caching with short TTL solves it.',
    staffPlus:
      'Design the tiered architecture for global live events: regional Redis + Kafka + global aggregator. Discuss WebSocket push for live rank updates (only push diffs for visible positions). Address read amplification with a dedicated Top-K cache. Cover anti-cheat (server-authoritative scoring), weekly resets via atomic RENAME, and memory budgeting (~6GB per 100M entries).',
  },

  keyTakeaways: [
    'Redis Sorted Set gives O(log N) rank queries and updates - microseconds for millions of players',
    'ZREVRANGE for top-N, ZREVRANK for "my rank" - both sub-millisecond',
    'Separate hot store (Redis) from cold store (Postgres) for speed + durability',
    'Cache the top-K during live events to handle millions of identical reads',
  ],

  relatedDesigns: ['rate-limiter', 'url-shortener', 'social-feed'],
  relatedConcepts: [
    { name: 'Caching', description: 'Redis sorted sets serve real-time rank queries in-memory.' },
    { name: 'Database Sharding', description: "Partitions scores across segments when a single node can't hold the set." },
    { name: 'Consistency Models', description: 'Trades exact rank freshness against read latency at scale.' },
  ],

  simulator: {
    goalDescription: "Show top players and a user's rank among millions, updating live as scores change.",
    requirementChips: ['Rank query < 50ms', '120K RPS', 'Live updates on score change'],
    targetRps: 120000,
    readRatio: 0.85,
    cacheHitRatio: 0.7,
    latencyBudgetMsP99: 50,
    rubric: [
      { id: 'lb-at-edge', label: 'Load balancer at the edge', kind: 'requires-node-type', nodeType: 'load-balancer' },
      { id: 'sorted-set-store', label: 'Sorted-set store for rankings (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'durable-db',
        label: 'Durable database for scores',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb', 'cassandra'],
      },
      {
        id: 'compute-tier',
        label: 'Compute tier for the API',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 12, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 2, position: { x: 880, y: 200 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 20, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-app', source: 'lb-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-redis-pg', source: 'redis-1', target: 'pg-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Redis Sorted Sets (ZADD/ZREVRANK) give O(log n) rank and top-K in one call. The relational DB is source of truth; Redis serves all reads.',
    failureModeNarratives: {
      'load-balancer': 'Only one load balancer instance on the critical path. If it dies, the whole system goes down.',
    },
    fullDesignLinkSlug: 'real-time-leaderboard',
  },
}

export default topic
