import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'qa-forum',
  title: 'Q&A Forum (Quora / StackOverflow)',
  difficulty: 'Intermediate',
  icon: 'pi pi-question-circle',
  color: '#0ea5e9',
  readTimeMinutes: 24,
  topics: ['Ranking Algorithms', 'Search Indexing', 'Fan-out Notifications', 'Reputation Systems'],
  companies: ['Quora', 'Stack Overflow', 'Reddit'],
  prerequisites: ['Caching', 'Message Queues'],
  summary:
    'A Q&A forum lets users post questions, submit competing answers, and vote them into a ranked order, backed by denormalized vote counters, a background-computed rank score blending votes/recency/reputation, a search index kept in sync via CDC, and an async fan-out pipeline for notifications so a viral question never blocks the request path.',

  understandingProblem:
    "A Q&A forum - Quora, Stack Overflow, Reddit - solves a different problem than a chat app or a feed: the goal isn't to show you everything in order, it's to surface the single best answer to a question out of dozens of competing ones, and to make that answer discoverable to someone asking the same question two years from now. That means the system needs three things working together: a way to rank answers so the best one - not just the newest one - floats to the top; a search index so questions don't get re-asked and re-answered a thousand times; and a reputation mechanism so the community can self-police who gets to vote, edit, and moderate without a human reviewing every action. Underneath all of that is a write pattern that looks deceptively simple (post a question, post an answer, cast a vote) but a read pattern that is brutally skewed - one popular question about 'React useEffect cleanup' gets read by 500,000 people and answered by 15, so the system has to be built read-optimized from day one.",
  realExamples:
    'Stack Overflow serves roughly 1.3 billion page views a month off a famously small fleet of servers (a handful of web servers and two SQL Server boxes for years, per their public engineering blog) because nearly everything is cached. Stack Overflow reputation gates: 15 rep to upvote, 125 to downvote, 2000 to edit others\' posts, 10000 to access moderator tools. Quora reports hundreds of millions of monthly visitors and uses topic-based ML ranking to decide which answer to show first on a question with 200+ answers.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  api["API Server"]:::compute
  db[("Single Postgres DB<br/>questions, answers, votes")]:::database
  client --> api
  api --> db`,
    },
    whyThisBreaks: [
      'Vote count via COUNT(*) - to show "247 upvotes" on a popular answer, you run SELECT COUNT(*) FROM votes WHERE answer_id = X on every single page render. An answer with 250,000 votes means scanning 250,000 rows every time anyone views the question.',
      'View count writes on every pageview - a trending question gets 50,000 views in an hour; writing UPDATE questions SET views = views + 1 fifty thousand times an hour serializes on that one row and starves other writers.',
      'Full-text search via LIKE - finding "how to reverse a linked list" across 20 million questions with WHERE title LIKE \'%reverse%linked%list%\' does a full table scan and times out well before you hit 1 million rows.',
      'Synchronous notification fan-out - a question followed by 80,000 people gets a new answer, and the API handler loops through all 80,000 followers writing a notification row and sending a push before it returns 200 - the client waits 30+ seconds or the request just times out.',
      'No duplicate detection - five different people ask "why is my React component re-rendering" as five separate questions with zero overlapping text to catch with LIKE, fragmenting the 3 good answers across 5 pages nobody finds.',
    ],
    closingNote:
      "Every one of these breaks for the same underlying reason: treating a read-heavy, fan-out-heavy workload as if it were a handful of simple CRUD writes. We fix this by denormalizing the things we read constantly (vote counts, view counts), computing the expensive things (ranking, search, notifications) asynchronously in the background, and only hitting the primary database for the writes that truly need strict consistency.",
  },

  priorArt: [
    {
      title: 'Stack Overflow Engineering',
      description:
        "Nick Craver's public architecture write-ups describe an aggressively cached read path: a tiny number of SQL Server boxes behind Redis and heavy HTTP caching, with Elasticsearch as a separate read-optimized store for search rather than querying the relational DB directly. (Stack Overflow Engineering blog, 'The Architecture - 2016')",
      link: 'https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/',
    },
    {
      title: "Reddit's Hot Ranking Algorithm",
      description:
        'Reddit open-sourced its "hot" sort in 2008: order = log10(max(|ups - downs|, 1)) with a sign for net direction, plus a linear term for seconds since post creation divided by a constant - a logarithmic vote term so the difference between 100 and 1000 votes matters less than the difference between 1 and 10, combined with time decay so older posts naturally fall. (Reddit engineering blog, "reddit\'s ranking algorithm")',
      link: 'https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx',
    },
    {
      title: 'Evan Miller - Wilson Score Interval',
      description:
        'His widely cited article "How Not To Sort By Average Rating" shows why naively sorting by (upvotes - downvotes) or by percentage favors low-vote-count outliers, and proposes the Wilson score lower bound as a statistically sound way to sort by "how confident are we this is actually good," which Reddit adopted for its "best" comment sort.',
      link: 'https://www.evanmiller.org/how-not-to-sort-by-average-rating.html',
    },
    {
      title: 'Quora Feed and Answer Ranking',
      description:
        "Quora's engineering blog has described a machine-learned ranking model for both the home feed and answer ordering on a question page, blending signals like topic relevance, answerer credibility, and engagement velocity rather than a single hand-tuned formula - the ML-ranking successor to the vote-plus-recency heuristics used by earlier Q&A sites.",
      link: 'https://engineering.quora.com/A-Machine-Learning-Approach-to-Ranking-Answers-on-Quora',
    },
    {
      title: 'Twitter/Facebook Fan-out Hybrid',
      description:
        'Both systems solved the "celebrity problem" - a single write fanning out to millions of followers - with a hybrid: fan-out-on-write for normal accounts (push the update to every follower\'s cache immediately) and fan-out-on-read for accounts with huge followings (compute the update lazily when a follower checks in). The same split applies directly to a question with 100,000 followers.',
      link: 'http://highscalability.com/blog/2013/7/8/the-architecture-twitter-uses-to-deal-with-150m-active-users.html',
    },
  ],

  coreEntities: [
    { name: 'Question', description: 'The root post: title, body, tags, author, denormalized view count and answer count.' },
    { name: 'Answer', description: 'A response to a question: body, author, denormalized vote score, rank score, accepted flag.' },
    { name: 'Comment', description: 'A short, unranked note attached to a question or answer - no voting, no ranking, just clarification.' },
    { name: 'Vote', description: 'An immutable audit row (voter_id, target_id, direction, timestamp) used to enforce one-vote-per-user and to recompute counters if needed.' },
    { name: 'Reputation Event', description: 'An append-only ledger entry (+10 for an upvoted answer, -2 for a downvoted one) that sums to a user\'s current reputation.' },
    { name: 'Tag', description: 'A topic label on a question used for search faceting, following/subscriptions, and expertise-based routing.' },
  ],

  requirements: {
    core: [
      'Post questions and answers - users can create a question with a title, body, and tags, and submit one or more answers to any question',
      'Vote on answers - users can upvote or downvote an answer once; the running score is visible immediately',
      'Rank answers - answers on a question are ordered by a blend of vote score, recency, and answerer reputation, not strictly by vote count or post time',
      'Search - users can find existing questions by keyword before posting a duplicate',
      'Notify followers - users who follow a question or asked it get notified (in-app and/or push) when a new answer or comment is added',
    ],
    belowTheLine: [
      'Real-time collaborative answer editing (multiple people co-drafting one answer)',
      'Monetization / paid answers or "Quora+"-style subscription gating',
      'Multi-language auto-translation of questions and answers',
      'Video/audio answers beyond simple attachment storage',
      'Full recommendation-feed personalization (treated as a separate feed-ranking system)',
    ],
    nonFunctionalTable: [
      { metric: 'Read-heavy', target: '~200:1 read-to-write ratio (a popular question is read far more than it is answered)' },
      { metric: 'Vote read latency', target: 'p99 < 100ms to render a question page with all answers and current scores' },
      { metric: 'Search latency', target: 'p99 < 200ms for a keyword search across tens of millions of questions' },
      { metric: 'Notification delivery', target: 'Best-effort within 60 seconds of the triggering answer/comment, never blocking the write' },
      { metric: 'Vote consistency', target: 'Exactly-once per (user, target) - no double voting, no lost votes' },
      { metric: 'Availability', target: '99.9% for reads; brief write degradation acceptable during traffic spikes' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Primary Database',
      purpose: 'Questions, answers, votes, and users at Stack-Overflow-scale (~20M questions, ~60M answers)',
      primaryPick: 'Postgres',
      alternatives: 'MySQL, CockroachDB, Aurora',
      whyPrimaryWins: 'ACID guarantees for atomic vote-counter updates, and the whole corpus fits in one instance with read replicas at this scale',
    },
    {
      tier: 'Cache',
      purpose: 'Hot question pages and denormalized vote/view counters',
      primaryPick: 'Redis',
      alternatives: 'Memcached, Varnish, Caffeine',
      whyPrimaryWins: 'A ~200:1 read-to-write ratio makes the cache load-bearing, not optional; TTL invalidation on vote or new-answer events keeps it fresh',
    },
    {
      tier: 'Search',
      purpose: 'Full-text question search and tag filtering across tens of millions of questions',
      primaryPick: 'Elasticsearch',
      alternatives: 'Algolia, Meilisearch, Typesense',
      whyPrimaryWins: 'BM25 relevance ranking scales to 10M+ questions with tag facets, and CDC keeps it in sync without dual writes',
    },
    {
      tier: 'CDN',
      purpose: 'Static assets and cached HTML for SEO-critical question pages',
      primaryPick: 'CloudFront',
      alternatives: 'Cloudflare, Fastly, Akamai',
      whyPrimaryWins: 'Most traffic to a mature Q&A site is search-engine bots hitting question pages, so edge caching dominates total request volume',
    },
    {
      tier: 'Async Processing',
      purpose: 'Rank-score recomputation and search-index sync off the write path',
      primaryPick: 'Kafka',
      alternatives: 'RabbitMQ, SQS, Redis Streams',
      whyPrimaryWins: 'A durable, replayable log lets a CDC connector stream every committed change exactly once, and a stuck consumer can replay from offset without losing events',
    },
  ],
  technologyChoicesNote:
    "Why Postgres instead of sharding? At roughly 10M questions x 50M answers x ~2KB average body, the corpus is about 100GB of text - it fits comfortably in a single instance with read replicas, the same footprint Stack Overflow itself runs on, so sharding would only add complexity this read-heavy, moderate-write system doesn't yet need.",

  scaleEstimation: [
    'Content volume: ~20M questions, ~60M answers accumulated over years (Stack-Overflow-scale corpus)',
    'Read QPS: ~50,000 question-page reads/sec at peak vs. ~250 answer/question writes/sec - roughly 200:1',
    'Vote QPS: ~2,000 votes/sec at peak, each a read-modify-write against a denormalized counter, not a full recount',
    'Storage: 60M answers x ~2KB average body = ~120GB raw text; the search index (with token postings) runs 3-5x that, ~500GB-600GB',
    'Fan-out: a viral question can have 100,000+ followers; a notification burst of that size must be a queue of 100,000 async jobs, not 100,000 inline writes',
    'Notification volume: ~5M notification events/day across new answers, comments, and accepted-answer marks',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/questions',
      description: 'Create a new question.',
      example: '// Request\n{ "title": "How does connection pooling work?", "body": "...", "tags": ["postgres", "database"] }\n\n// Response 201\n{ "id": "q_9f21a", "createdAt": "2026-08-02T10:00:00Z" }',
    },
    {
      method: 'GET',
      path: '/v1/questions/{id}',
      description: 'Fetch a question with its top-ranked answers (paginated by rank score).',
      example: '// Response 200\n{ "id": "q_9f21a", "title": "...", "answers": [{ "id": "a_1", "score": 342, "rankScore": 89.2, "isAccepted": true }] }',
    },
    {
      method: 'POST',
      path: '/v1/questions/{id}/answers',
      description: 'Submit a new answer to a question.',
      example: '// Request\n{ "body": "You need a pool because..." }\n\n// Response 201\n{ "id": "a_88f2", "questionId": "q_9f21a" }',
    },
    {
      method: 'POST',
      path: '/v1/answers/{id}/votes',
      description: 'Cast (or change) a vote on an answer. Idempotent per user via the votes table unique constraint.',
      example: '// Request\n{ "direction": "up" }\n\n// Response 200\n{ "answerId": "a_88f2", "newScore": 343 }',
    },
    {
      method: 'GET',
      path: '/v1/search',
      description: 'Full-text search over questions and answers, backed by the search index, not the primary DB.',
      example: '// Request: GET /v1/search?q=connection+pooling&tags=postgres\n\n// Response 200\n{ "results": [{ "id": "q_9f21a", "title": "...", "snippet": "...pooling works by...", "score": 12.4 }] }',
    },
    {
      method: 'GET',
      path: '/v1/questions/{id}/duplicates',
      description: 'Return semantically similar existing questions, used to warn a user before they finish posting.',
      example: '// Response 200\n{ "candidates": [{ "id": "q_11cc", "title": "What is a DB connection pool?", "similarity": 0.91 }] }',
    },
  ],
  apiSecurityNote:
    'Reading questions and answers is public and unauthenticated, but posting, voting, and editing require an authenticated session, and vote/edit/moderation endpoints additionally check the caller\'s reputation against the privilege threshold for that action server-side, never trusting a client-supplied reputation value.',

  highLevelDesignIntro:
    "Let's build this up incrementally: start by fixing the two things that break immediately under read load (vote counters and view counts), then layer in search, ranking, async notifications, reputation, duplicate detection, and moderation - each build solves one specific bottleneck the previous step left exposed.",

  builds: [
    {
      title: 'Denormalized Vote Counters',
      body:
        "The naive COUNT(*) over a votes table dies the moment any answer gets popular. The fix: keep a `score` integer column directly on the answer row, and treat the votes table purely as an append-only ledger for idempotency and auditability - it exists to answer \"has this user already voted on this answer?\", not to compute the live count.\n\nOn every vote: check the votes table for an existing (user_id, answer_id) row inside a transaction. If none exists, insert it and atomically increment answers.score by +1 or -1 (UPDATE answers SET score = score + 1 WHERE id = X). If the user is flipping their vote (up to down), do both the delete/insert on the ledger and a +/-2 adjustment to the counter in the same transaction. Reading the score is now a single indexed row lookup - O(1) - regardless of whether the answer has 3 votes or 300,000.",
      newComponents: [
        { name: 'Votes Ledger Table', description: 'Append-only record of (voter_id, target_id, direction, timestamp) enforcing a unique constraint on (voter_id, target_id) so a user can only have one active vote per target.' },
        { name: 'Denormalized score column', description: 'An integer counter on the questions/answers row, updated atomically alongside the ledger write, read directly with no aggregation at render time.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api["API Server"]:::compute
  votes[("Votes ledger<br/>audit + idempotency")]:::database
  answers[("Answers table<br/>score column")]:::database
  client -->|"1. POST vote up"| api
  api -->|"2. INSERT vote row"| votes
  api -->|"3. UPDATE score +1"| answers
  api -->|"4. Return new score"| client`,
      },
      insightCallout:
        'The votes ledger and the score counter are two different data structures answering two different questions: "did this exact user already vote?" (ledger, needs a unique-key lookup) vs. "what is the total right now?" (counter, needs O(1) reads). Conflating them into one COUNT(*) query is the single most common Q&A-forum design mistake.',
      closingNote:
        'Vote reads are now cheap, but the counter is still a hot row under contention during a vote storm on a viral answer - the next problem is view counts, which are read far more often than votes are written.',
    },
    {
      title: 'Async, Batched View Counts',
      body:
        "View counts have the opposite problem from votes: they're written on every single page load, not just meaningful user actions, so writing to the primary DB per view creates massive write amplification for a number nobody needs to the exact integer. The fix: make the write asynchronous and batched.\n\nEach API server increments an in-memory or Redis counter (INCR question:{id}:views) on every page view - this is essentially free, sub-millisecond, and absorbs the burst. A background job runs every 10-30 seconds, reads all the dirty counters (or drains a small write-behind queue), and flushes the deltas to the primary DB in a single batched UPDATE per question rather than one UPDATE per view. A trending question with 50,000 views/hour turns into roughly 120-360 batched DB writes/hour instead of 50,000.",
      newComponents: [
        { name: 'Redis View Counters', description: 'Per-question INCR counters absorbing all view traffic without touching the primary DB.' },
        { name: 'View-Count Flusher (async worker)', description: 'Periodic job that drains dirty Redis counters and batches them into the primary DB as deltas.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api["API Server"]:::compute
  redis[("Redis<br/>INCR view counters")]:::cache
  flusher["View-Count Flusher<br/>every 15-30s"]:::async
  db[("Primary DB<br/>views column")]:::database
  client -->|"1. View question"| api
  api -->|"2. INCR views"| redis
  flusher -->|"3. Drain dirty keys"| redis
  flusher -->|"4. Batched UPDATE delta"| db`,
      },
      closingNote:
        "View counts are now approximate but the primary DB is no longer the bottleneck for the most frequent write in the system. The next gap is finding content at all - the naive LIKE-based search falls over long before we reach millions of questions.",
    },
    {
      title: 'Search via a Dedicated Index',
      body:
        "Relational databases are built for exact-match and range queries on structured columns, not ranked full-text relevance across millions of free-text documents. The fix: stand up a dedicated search index (Elasticsearch or OpenSearch) that stores a denormalized, search-optimized copy of every question and answer, and route all search traffic there instead of the primary DB.\n\nKeeping the index in sync has two viable patterns: dual writes, where the API writes to the primary DB and the search index in the same request path (simple but risks the index drifting if one write fails silently), or change data capture (CDC), where a tool like Debezium tails the primary DB's write-ahead log and streams every insert/update into a Kafka topic that a consumer applies to the search index. CDC is the production-grade choice because it guarantees the index reflects every committed write exactly once, decoupled from the request path, with no risk of an API bug silently skipping the index update.",
      newComponents: [
        { name: 'Elasticsearch Cluster', description: 'Inverted-index-backed search engine storing tokenized question/answer text, tags, and scores for fast ranked full-text queries.' },
        { name: 'CDC Pipeline (Debezium + Kafka)', description: 'Tails the primary database\'s write-ahead log and streams every committed change into Kafka, from which a consumer updates the search index.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  api["API Server"]:::compute
  db[("Primary DB")]:::database
  cdc["CDC connector<br/>tails WAL"]:::async
  kafka[/"Kafka topic<br/>db.changes"/]:::async
  indexer["Index consumer"]:::compute
  es[("Elasticsearch")]:::storage
  client[Client]:::client
  api -->|"1. Write question/answer"| db
  cdc -->|"2. Tail write-ahead log"| db
  cdc -->|"3. Publish change event"| kafka
  indexer -->|"4. Consume change"| kafka
  indexer -->|"5. Upsert document"| es
  client -->|"6. Search query"| es`,
      },
      insightCallout:
        "CDC decouples 'did the write succeed' from 'did the search index get updated' - the API only has to guarantee the primary DB write; the index eventually catches up, which is the right tradeoff since search results being a few seconds stale is invisible to users but a lost write is not.",
      closingNote:
        'Search now scales independently of the primary DB, but a keyword index only catches questions that share vocabulary - it does nothing for the far more common case of someone asking the same question in completely different words.',
    },
    {
      title: 'Semantic Duplicate Detection',
      body:
        "A keyword search for \"why does my useEffect fire twice\" won't surface a prior question titled \"React 18 double-invoking my effect on mount\" even though they're the same question, because there's near-zero literal word overlap. The fix is a vector similarity search layered on top of the keyword index: run every new question's title+body through an embedding model at write time, store the resulting vector in a vector index (a dedicated store like pgvector/Pinecone, or Elasticsearch's vector field support), and at question-compose time, embed the draft text and query the index for nearest neighbors by cosine similarity.\n\nIf the top match crosses a similarity threshold (e.g., > 0.85), surface it to the user as \"this looks similar to an existing question\" before they finish posting - the same UX Stack Overflow uses on its \"Ask Question\" page, just backed by semantic rather than keyword matching.",
      newComponents: [
        { name: 'Embedding Service', description: 'Converts question text into a fixed-length vector capturing semantic meaning, called both on write (to index) and on question-compose (to query).' },
        { name: 'Vector Index', description: 'Stores embeddings and supports fast approximate nearest-neighbor search by cosine similarity across millions of questions.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  draft["User drafting a question"]:::client
  api["API Server"]:::compute
  embed["Embedding Service"]:::compute
  vindex[("Vector Index<br/>question embeddings")]:::storage
  draft -->|"1. Draft title + body"| api
  api -->|"2. Embed draft text"| embed
  embed -->|"3. Query nearest neighbors"| vindex
  vindex -->|"4. Top similar questions"| api
  api -->|"5. Suggest before posting"| draft`,
      },
      closingNote:
        'Duplicate suggestions reduce fragmentation before it happens, but the site\'s core value proposition - picking the best answer out of several - still needs a real ranking function, not just chronological or raw-vote-count ordering.',
    },
    {
      title: 'Ranking Answers: Score, Recency, and Reputation',
      body:
        "Sorting purely by vote count rewards old answers unfairly - an answer posted on day one has had years to accumulate votes that a genuinely better answer posted last month hasn't had time to earn. Sorting purely by newest buries good answers under noise. The fix is a computed rank score blending three signals: raw vote score, a time-decay term so recent activity counts more, and the answerer's reputation as a mild credibility signal.\n\nA practical formula, in the spirit of Reddit's hot-ranking approach: rankScore = log10(max(votes, 1)) + (answererReputationBucket x 0.1) - (hoursSincePosted / decayConstant). The logarithm means the jump from 10 to 100 votes matters as much as 100 to 1000 - it dampens runaway vote counts from simply being first. Recomputing this for every answer on every page read would be wasteful, so rankScore is a stored column, recomputed by a background job whenever an answer's vote count changes meaingfully or on a periodic sweep (e.g., every 15 minutes) to let the time-decay term keep moving even without new votes.",
      newComponents: [
        { name: 'Rank Score Column', description: 'A precomputed, stored numeric column on the answer row that the read path sorts by directly - no per-request computation.' },
        { name: 'Rank Recompute Worker', description: 'Background job triggered on vote events and on a periodic sweep to keep rankScore current as time decays and votes accumulate.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  vote["Vote event"]:::async
  queue[/"Rank recompute queue"/]:::async
  worker["Rank Recompute Worker"]:::compute
  answers[("Answers table<br/>rankScore column")]:::database
  cron["Periodic sweep<br/>every 15 min"]:::async
  vote -->|"1. Enqueue recompute"| queue
  queue -->|"2. Consume"| worker
  worker -->|"3. Write new rankScore"| answers
  cron -->|"4. Trigger time-decay refresh"| worker`,
      },
      insightCallout:
        'A raw vote score alone is statistically unreliable for low sample sizes - an answer with 2 upvotes/0 downvotes looks "perfect" (100%) but with only 2 votes that\'s a weak signal. The Wilson score lower bound (covered in the deep dive below) fixes exactly this by asking "how confident are we, given the sample size" rather than just "what is the ratio."',
      closingNote:
        'Ranking is solved for a single question page, but a new answer or comment still needs to reach everyone following that question - and doing that inline, in the request path, is exactly the fan-out problem that broke the naive first cut.',
    },
    {
      title: 'Async Notification Fan-out',
      body:
        "Notifying followers synchronously inside the answer-submission request means the response time is proportional to the follower count - fine for a question with 12 followers, catastrophic for one with 100,000. The fix: the write path only ever enqueues a single fan-out job; a pool of background workers does the actual per-follower work.\n\nFor most questions (say, under a few thousand followers), fan-out-on-write is simplest: a worker pulls the follower list and writes one notification row (or push payload) per follower, which can be parallelized across many workers reading off the same queue. For the rare viral question with 100,000+ followers, fan-out-on-write becomes its own bottleneck (100,000 writes per new answer), so those \"celebrity\" questions are flagged and switched to fan-out-on-read: no notification rows are pre-written; instead, each follower's client checks a lightweight \"question X has new activity since your last visit\" marker when they next open the app, and the expensive per-follower notification lookup happens lazily and only for people who actually come back.",
      newComponents: [
        { name: 'Fan-out Queue (Kafka/SQS)', description: 'Decouples the answer-submission write from notification delivery - the API enqueues one message and returns immediately.' },
        { name: 'Notification Worker Pool', description: 'Consumes fan-out jobs, resolves follower lists, and writes/pushes notifications in parallel, batching where possible.' },
      ],
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant API as API Server
  participant Q as Fan-out Queue
  participant W as Notification Workers
  participant N as Notification Store

  U->>API: POST new answer
  API->>Q: enqueue fan-out job
  API-->>U: 201 Created (fast)
  Q->>W: deliver job
  W->>W: resolve follower list
  W->>N: write notification per follower
  W->>W: push to online followers`,
      },
      insightCallout:
        'The write path never blocks on follower count - it enqueues one message whether the question has 3 followers or 300,000, which is the entire trick. Everything expensive happens after the 201 response has already gone back to the client.',
      closingNote:
        'Fan-out is decoupled, but the system still trusts every vote and edit equally regardless of who performs it - the next piece is a reputation system that gates privileges and resists gaming.',
    },
    {
      title: 'Reputation System and Privilege Gating',
      body:
        "Letting a brand-new, unverified account downvote content or edit other people's posts invites abuse - vote manipulation rings, spam edits, and drive-by downvoting of rivals. The fix: track reputation as an append-only ledger of signed events (an answer getting upvoted grants the author +10, a downvote costs -2), sum it into a cached current-reputation value, and gate specific actions behind specific thresholds checked server-side on every privileged action.\n\nTypical thresholds, mirroring Stack Overflow's real gates: 15 reputation to cast an upvote at all, 125 to downvote (downvoting is made slightly more expensive to discourage casual abuse), 2000 to edit someone else's post directly, 10000 to access moderation tools. Because reputation gates real capabilities, the ledger itself needs abuse resistance: cap reputation gained per question/answer per day to blunt vote-ring farming, require a minimum account age before reputation-gated actions unlock, and weight votes from very-low-reputation or newly created accounts less heavily (or exclude them from reputation-granting entirely) when detected as part of a suspicious voting pattern.",
      newComponents: [
        { name: 'Reputation Ledger', description: 'Append-only log of signed reputation events, auditable and replayable, similar in spirit to the votes ledger.' },
        { name: 'Reputation Cache', description: 'A fast-read current-reputation value per user, incrementally updated from the ledger, checked on every privileged action.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  vote["Vote/edit event"]:::async
  ledger[("Reputation Ledger<br/>append-only")]:::database
  cache[("Reputation Cache")]:::cache
  gate{"Reputation >= threshold?"}:::compute
  allow["Action allowed"]:::compute
  deny["403 Forbidden"]:::client
  vote -->|"1. Append signed event"| ledger
  ledger -->|"2. Update running total"| cache
  gate -->|"3. Read cached rep"| cache
  gate -->|"4. Pass"| allow
  gate -->|"5. Fail"| deny`,
      },
      closingNote:
        'Reputation gates most abuse at the privilege boundary, but a low-reputation account can still post outright spam or harassment before hitting any threshold - that needs its own moderation pipeline running on every new piece of content.',
    },
    {
      title: 'Moderation and Spam Pipeline',
      body:
        "Reputation thresholds prevent misuse of privileges but do nothing to stop a fresh account from posting spam links, harassment, or scraped content the moment it signs up. The fix: run every new question, answer, and comment through an async moderation pipeline before (or immediately after) it goes live, rather than relying purely on manual human review.\n\nOn write, content is enqueued to a moderation worker that runs cheap heuristics first (link-to-known-spam-domain lists, rate limits on posts-per-minute per account, duplicate-content hashing to catch copy-pasted spam) and a lightweight ML classifier second (toxicity/spam scoring). Content scoring above a high-confidence spam threshold is auto-hidden immediately; content in a gray zone is left visible but queued for human moderator review; clean content passes through untouched. This mirrors the real-world pattern used by large forums: cheap rules catch the obvious cases instantly and for free, ML catches the ambiguous cases, and humans are reserved for the genuinely hard judgment calls.",
      newComponents: [
        { name: 'Moderation Queue', description: 'Every new post is enqueued here before or immediately after going live, decoupling moderation latency from post latency.' },
        { name: 'Spam Classifier + Rule Engine', description: 'Combines cheap heuristics (rate limits, domain blocklists, duplicate-content hashing) with an ML toxicity/spam score to triage content.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  post["New post"]:::client
  api["API Server"]:::compute
  mq["Moderation Queue"]:::async
  rules["Rule Engine<br/>rate limits, blocklists"]:::compute
  ml["ML Spam Classifier"]:::compute
  hidden["Auto-hidden"]:::database
  human["Human review queue"]:::async
  clean["Stays visible"]:::database
  post -->|"1. Submit"| api
  api -->|"2. Post live optimistically"| clean
  api -->|"3. Enqueue for moderation"| mq
  mq -->|"4. Cheap checks"| rules
  rules -->|"5. Score"| ml
  ml -->|"6. High confidence spam"| hidden
  ml -->|"7. Gray zone"| human`,
      },
      closingNote:
        'With denormalized counters, async views, a search index, semantic dedup, computed ranking, decoupled fan-out, reputation gating, and moderation all in place, the design now handles the read-heavy, fan-out-heavy, trust-sensitive nature of a real Q&A forum end to end.',
    },
  ],

  coreFlows: [
    {
      title: 'User Submits a New Answer',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant API as API Server
  participant DB as Primary DB
  participant MQ as Moderation Queue
  participant FQ as Fan-out Queue
  participant IX as Index Queue

  U->>API: POST /questions/{id}/answers
  API->>DB: INSERT answer row
  API->>MQ: enqueue moderation check
  API->>FQ: enqueue notification fan-out
  API->>IX: change captured via CDC
  API-->>U: 201 Created`,
      },
      nonObviousFailure:
        'If the API enqueues the fan-out job before the DB transaction commits, a worker can race ahead and notify followers about an answer that a concurrent rollback then makes disappear - fan-out and index events must only be enqueued after the primary write is durably committed, ideally via CDC rather than an in-request enqueue.',
    },
    {
      title: 'User Casts a Vote',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant API as API Server
  participant DB as Primary DB
  participant RQ as Rank Recompute Queue

  U->>API: POST /answers/{id}/votes
  API->>DB: BEGIN transaction
  API->>DB: check votes ledger for existing vote
  API->>DB: INSERT/UPDATE vote row
  API->>DB: UPDATE answers SET score = score +/- 1
  API->>DB: COMMIT
  API->>RQ: enqueue rank recompute
  API-->>U: 200 OK with new score`,
      },
      nonObviousFailure:
        'Without the unique constraint on (voter_id, answer_id) enforced inside the same transaction as the counter update, a double-click or retried request can apply the same vote twice, inflating the score - the ledger check and the counter increment must be atomic together, not two separate round trips.',
    },
    {
      title: 'User Searches Before Asking',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant API as API Server
  participant ES as Elasticsearch
  participant EM as Embedding Service
  participant VX as Vector Index

  U->>API: GET /search?q=connection pooling
  API->>ES: keyword query
  ES-->>API: top matching questions
  U->>API: draft new question text
  API->>EM: embed draft text
  EM->>VX: nearest-neighbor query
  VX-->>API: semantically similar questions
  API-->>U: "did you mean" suggestions + search results`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Ranking Answers Fairly',
      problem:
        'A question has three answers: one from day one with 400 upvotes and 350 downvotes (net +50), one posted last week with 8 upvotes and 0 downvotes, and one posted yesterday with 2 upvotes and 0 downvotes. Which goes first?',
      bad:
        'Sort purely by net vote count (upvotes - downvotes). The day-one answer with net +50 wins despite a nearly 50/50 approval split, simply because it has had years to accumulate both up and downvotes - raw net score conflates "controversial but old" with "actually the best answer."',
      good:
        'Sort by upvote percentage instead (upvotes / total votes). Now the answer with 2 upvotes and 0 downvotes (100%) beats the answer with 8 upvotes and 0 downvotes (also 100%) essentially at random, and both beat a genuinely well-vetted answer with 300 upvotes and 20 downvotes (94%) - percentage alone is statistically unreliable at low sample sizes; 2 votes is not the same confidence level as 320 votes.',
      great:
        "Use the Wilson score lower bound: a statistical confidence interval on the true upvote proportion, computed from the observed votes and sample size, and sort by the lower bound of that interval rather than the raw percentage. An answer with 2/2 upvotes gets a modest lower bound (not much data, so we can't be confident it's really 100%), while an answer with 300/320 gets a high lower bound (large sample, consistent signal) - this is exactly the technique Reddit adopted for its 'best' comment sort, and it can be blended with a time-decay term (Reddit's 'hot' formula) so recency still matters for a stream of otherwise-similar answers.",
    },
    {
      title: 'View Count Accuracy vs. Write Load',
      problem: "A trending question gets 80,000 views in one hour. Writing to the primary DB on every view would mean 80,000 UPDATE statements contending for the same row.",
      bad: 'Write UPDATE questions SET views = views + 1 to the primary DB synchronously on every page load. At 80,000 views/hour that is roughly 22 writes/sec sustained on one row just for this one question, and row-level lock contention gets dramatically worse the moment two trending questions are hot at the same time.',
      good: 'Increment a Redis counter per view instead of hitting the DB, and flush it to the DB once, say, every minute. This absorbs the write burst, but a naive implementation that flushes and resets the Redis key can lose the delta accumulated between the last flush and a crash or restart of the flusher process.',
      great:
        'Increment the Redis counter on every view (sub-millisecond, effectively free), and have the flusher read-and-not-reset the counter, instead tracking the last-flushed value per question and computing the delta itself each cycle, writing that delta as a single batched UPDATE. This makes the flush idempotent-safe against a crash between reading and writing, and because view counts are a UX nicety rather than a financial or security-critical number, being off by a few views for a few seconds is an acceptable, invisible tradeoff for the write-amplification savings.',
    },
    {
      title: 'Finding Duplicate Questions',
      problem: 'Five users separately ask essentially the same question in five different phrasings, splitting the same 3 good answers across five orphaned pages that never accumulate enough votes to rank well.',
      bad: "Rely on the user to manually search before posting, with no system enforcement. In practice most users skip this step entirely or search with different keywords than the eventual question text, so duplicates accumulate at scale regardless of the search box being technically available.",
      good: 'Run a keyword-overlap or tag-overlap check (e.g., Jaccard similarity on shared tags/title tokens) against existing questions and warn if overlap crosses a threshold. This catches questions that reuse similar vocabulary but completely misses paraphrases - "why does useEffect run twice" vs. "React 18 double invoking my effect" share almost no literal tokens despite being the same question.',
      great:
        'Embed the draft question into a vector space with a semantic embedding model and run an approximate nearest-neighbor search against a vector index of all existing question embeddings, surfacing anything above a cosine-similarity threshold (e.g., 0.85) as a likely duplicate before the user finishes posting. This catches paraphrases that share no vocabulary at all because it compares meaning, not tokens, and it runs in tens of milliseconds against millions of existing questions when backed by an approximate-NN index rather than exact comparison.',
    },
    {
      title: 'Reputation Abuse Resistance',
      problem: "A ring of five fake accounts upvotes each other's answers repeatedly to farm reputation and eventually unlock edit or moderation privileges.",
      bad: 'Reputation is simply the raw sum of votes received, with no caps or account-age checks. A coordinated ring of even a handful of accounts can trivially push each other past every privilege threshold within days by voting on each other\'s content in a loop.',
      good: 'Cap the reputation a single user can gain per day and require a minimum account age (e.g., 30 days) before reputation-gated actions like downvoting or editing unlock. This slows down obvious farming but a patient ring willing to wait out the age requirement and stay under the daily cap can still eventually succeed, just more slowly.',
      great:
        "Treat votes as a graph and run anomaly detection over it: accounts that vote almost exclusively on each other's content, accounts created around the same time with overlapping IP/device fingerprints, and accounts whose voting pattern deviates sharply from typical engagement all get flagged for reduced vote weight or exclusion from reputation grants entirely, independent of the simpler per-day caps and account-age gates, which still apply as a first line of defense. This mirrors how large platforms detect coordinated inauthentic behavior - the caps and age checks catch casual abuse cheaply, and graph-based clustering catches the coordinated cases that patience alone can get past.",
    },
  ],

  selfAudit: [
    { question: 'Why not COUNT(*) for vote totals?', answer: 'O(n) scan per read on a popular answer - denormalize into a stored score column instead.' },
    { question: 'How do you keep search in sync with the DB?', answer: 'CDC (e.g. Debezium tailing the WAL into Kafka) rather than dual writes, so no index update is ever silently skipped.' },
    { question: 'How do you rank answers?', answer: 'A stored rankScore blending log-scaled vote score, time decay, and answerer reputation, recomputed async, not per-read.' },
    { question: 'How do you avoid COUNT-of-votes bias at low sample sizes?', answer: 'Wilson score lower bound instead of raw upvote percentage - accounts for sample-size confidence.' },
    { question: 'How does notification fan-out avoid blocking the write?', answer: 'The write only enqueues one fan-out job; a worker pool resolves followers and delivers async.' },
    { question: 'How do celebrity questions (100k+ followers) avoid a fan-out storm?', answer: 'Switch from fan-out-on-write to fan-out-on-read - lazily compute "new activity" when the follower checks in.' },
    { question: 'How do you find duplicate questions with different wording?', answer: 'Embed the text and run nearest-neighbor vector search, not keyword matching.' },
    { question: 'How do you stop reputation farming?', answer: 'Per-day reputation caps, account-age gates, plus graph-based clustering to catch coordinated voting rings.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  clients[Clients]:::client
  api["API Servers"]:::compute
  db[("Primary DB<br/>questions, answers,<br/>votes ledger, rep ledger")]:::database
  viewcache[("Redis<br/>view counters")]:::cache
  flusher["View-Count Flusher"]:::async
  cdc["CDC Connector"]:::async
  kafka[/"Kafka"/]:::async
  es[("Elasticsearch<br/>search index")]:::storage
  vindex[("Vector Index<br/>dup detection")]:::storage
  embed["Embedding Service"]:::compute
  rankworker["Rank Recompute Worker"]:::compute
  fanoutq[/"Fan-out Queue"/]:::async
  notifworkers["Notification Workers"]:::compute
  modq[/"Moderation Queue"/]:::async
  modworker["Moderation Worker"]:::compute

  clients -->|"Read/write"| api
  api -->|"Writes"| db
  api -->|"View pings"| viewcache
  flusher -->|"Drain + batch"| viewcache
  flusher -->|"Batched delta"| db
  cdc -->|"Tail WAL"| db
  cdc -->|"Publish change"| kafka
  kafka -->|"Index update"| es
  clients -->|"Search"| es
  api -->|"Embed draft"| embed
  embed -->|"Nearest-neighbor query"| vindex
  db -->|"Vote event"| rankworker
  rankworker -->|"Write rankScore"| db
  api -->|"Enqueue fan-out"| fanoutq
  fanoutq -->|"Deliver"| notifworkers
  api -->|"Enqueue moderation"| modq
  modq -->|"Score content"| modworker
  modworker -->|"Hide/flag"| db`,
  },

  keyTechnologies: [
    { term: 'Denormalized Counter', definition: 'A precomputed aggregate (like a vote score) stored on the row itself instead of computed at read time via a JOIN/COUNT, trading write complexity for O(1) reads.' },
    { term: 'CDC (Change Data Capture)', definition: 'Streaming every committed database write out as an event (often by tailing the write-ahead log) so downstream systems like a search index stay in sync without dual writes.' },
    { term: 'Wilson Score Lower Bound', definition: 'A statistical confidence interval on a proportion (like upvote rate) that accounts for sample size, used to rank items fairly with few votes vs. many votes.' },
    { term: 'Fan-out-on-write vs. fan-out-on-read', definition: 'Pushing an update to every follower immediately (write) vs. computing it lazily when each follower checks in (read) - the standard hybrid fix for the "celebrity" scale problem.' },
    { term: 'Vector/Embedding Search', definition: 'Converting text into a numeric vector capturing meaning, then finding nearest neighbors by similarity - used here for semantic duplicate-question detection, not just keyword matching.' },
    { term: 'Reputation Ledger', definition: 'An append-only, auditable log of reputation-affecting events summed into a cached total, mirroring the votes ledger pattern for the same durability/auditability reasons.' },
    { term: 'Elasticsearch', definition: 'A distributed, inverted-index-backed search engine optimized for ranked full-text queries at a scale relational databases are not built for.' },
  ],

  expectedDepth: {
    mid:
      "Identify that vote counts and view counts need to be denormalized/cached rather than computed live, and that search needs a dedicated index rather than SQL LIKE queries. Propose a basic ranking rule (votes + recency) and recognize that notifications for a popular question shouldn't block the answer-submission request.",
    senior:
      'Design the full incremental build-up: votes ledger + counter separation, CDC-based search sync, a concrete rank-score formula with justification (why log-scaled votes, why time decay), and an async fan-out pipeline with a queue. Discuss the Wilson score lower bound or an equivalent statistically sound alternative to raw vote percentage, and reputation thresholds that gate privileges.',
    staffPlus:
      "Address the celebrity-question fan-out problem with a fan-out-on-write/fan-out-on-read hybrid and quantify when to switch between them. Cover semantic duplicate detection via embeddings and vector search as a first-class feature, not an afterthought. Discuss reputation-system abuse resistance via graph-based vote-ring detection, moderation pipeline design (cheap rules -> ML -> human review triage), and the tradeoffs of CDC vs. dual writes for keeping the search index consistent under partial failures.",
  },

  keyTakeaways: [
    'Denormalize vote/view counters onto the row itself - never compute aggregates like COUNT(*) at read time for hot content',
    'Keep an append-only votes/reputation ledger for idempotency and auditability, separate from the fast-read counter it feeds',
    'Rank by a computed score (log-scaled votes + recency decay + reputation, or a Wilson-score-style confidence bound), not raw vote count or post time alone',
    'Sync a dedicated search index via CDC rather than dual writes so it can never silently drift from the primary DB',
    'Fan out notifications asynchronously, and switch celebrity-scale questions from fan-out-on-write to fan-out-on-read to avoid a 100,000-write burst on a single answer',
    'Gate privileges (voting, editing, moderation) behind a reputation system, and treat reputation-farming as an adversarial graph problem, not just a threshold check',
  ],

  relatedDesigns: ['social-feed', 'notification-system', 'news-aggregator', 'real-time-leaderboard'],
  relatedConcepts: [
    { name: 'Ranking Algorithms', description: 'Wilson score, Reddit-style hot ranking, and blended recency/reputation scoring underpin how answers and comments are ordered.' },
    { name: 'Search Indexing', description: 'Elasticsearch plus CDC-based sync is the standard pattern for keeping a read-optimized search index consistent with a primary datastore.' },
    { name: 'Fan-out Patterns', description: 'Fan-out-on-write vs. fan-out-on-read is the core tradeoff behind notifying followers of a new answer without blocking the write path.' },
    { name: 'Reputation Systems', description: 'Append-only reputation ledgers and privilege thresholds are a recurring pattern anywhere a community self-moderates.' },
  ],

  simulator: {
    goalDescription: 'Serve a heavily read-skewed question/answer workload with fast vote reads, keyword search, and non-blocking notification fan-out.',
    requirementChips: ['Vote read p99 < 100ms', '50K reads/sec peak', '~200:1 read:write ratio'],
    targetRps: 50000,
    readRatio: 0.95,
    cacheHitRatio: 0,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'durable-db', label: 'Primary DB for questions, answers, and the votes ledger', kind: 'requires-node-type', nodeType: ['postgresql', 'mysql', 'mongodb'] },
      { id: 'search-index', label: 'Dedicated search index for keyword queries', kind: 'requires-node-type', nodeType: 'elasticsearch' },
      { id: 'compute-tier', label: 'Compute tier for the API servers', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'fanout-queue', label: 'Async queue for notification fan-out', kind: 'requires-node-type', nodeType: ['kafka', 'rabbitmq', 'sqs'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 15, position: { x: 600, y: 200 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 12, position: { x: 880, y: 120 } },
        { id: 'es-1', type: 'elasticsearch', instanceCount: 6, position: { x: 880, y: 280 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-app', source: 'lb-1', target: 'app-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-app-es', source: 'app-1', target: 'es-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The primary DB is the source of truth for votes/questions/answers via a denormalized score column; Elasticsearch is a CDC-synced copy serving all search traffic so search load never touches the primary DB; Kafka decouples notification fan-out from the answer-submission write path.',
    failureModeNarratives: {
      postgresql: 'The primary DB is the single source of truth for questions, answers, and the votes ledger. If it becomes unavailable, no new content or votes can be written, even though cached search results may still serve briefly.',
    },
    fullDesignLinkSlug: 'qa-forum',
  },
}

export default topic
