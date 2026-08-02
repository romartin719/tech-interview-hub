import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'ad-serving-system',
  title: 'Ad Serving & Auction System',
  difficulty: 'Advanced',
  icon: 'pi pi-megaphone',
  color: '#dc2626',
  readTimeMinutes: 30,
  topics: ['Real-Time Bidding', 'Second-Price Auctions', 'Budget Pacing', 'Candidate Retrieval'],
  companies: ['Google Ads', 'Meta Ads', 'Amazon Ads'],
  prerequisites: ['Rate Limiter', 'Caching', 'Message Queues'],
  summary:
    'An ad serving system picks the single best-matched, highest-value ad for an incoming request in under 100 milliseconds by narrowing millions of campaigns down to a few hundred candidates through an inverted index, scoring them with a real-time click-through-rate model, settling the winner through a second-price auction, and atomically debiting a shared budget counter before the creative ever leaves the server.',

  understandingProblem:
    "Every time you open an app or load a page with an ad slot on it, something has to decide, in the time it takes to blink, which one of potentially millions of active ad campaigns gets to fill that slot - and how much the advertiser should be charged for it. That decision has real money attached: advertisers are bidding against each other in something closer to a stock exchange than a simple database lookup, publishers want the highest-paying ad that still fits the user's context, and the whole thing has to happen inside a latency budget so tight that if the ad server is even a little slow, the page loads without an ad at all and everyone loses revenue. You need this system to run a fair, fast auction among competing advertisers (fair enough that advertisers trust the platform with real budgets), to respect each advertiser's spending limits down to the last cent without ever letting the same campaign get bid on twice past its budget, to avoid showing the same person the same ad fifty times in a row, and to bill accurately for the clicks and impressions that actually happened - all while a small army of concurrent ad servers around the world make these calls independently, in parallel, thousands of times a second.",
  realExamples:
    "Google's ad systems (Google Ads / AdX / Ad Manager) evaluate ad requests within roughly 100ms end-to-end and serve well over 100 billion ad impressions per day. Meta's ads auction scores every candidate on 'total value' (bid x estimated action rate x ad quality) rather than raw bid, running trillions of these auctions monthly across Facebook and Instagram. The IAB Tech Lab's OpenRTB protocol - the industry-standard bid request/response schema used by essentially every ad exchange and demand-side platform (DSP) - specifies bidder response timeouts typically in the 50-150ms range, which is why 'the ad exchange only waits 100ms for a bid' is a real, load-bearing constraint and not an arbitrary interview number.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  app["Publisher App<br/>needs an ad for this slot"]:::client
  server["Ad Server<br/>single loop over campaigns"]:::compute
  db[("Campaigns Table<br/>5M rows")]:::database
  app -->|"1. Request ad"| server
  server -->|"2. SELECT * FROM campaigns WHERE targeting matches"| db
  db -->|"3. Scan every row, pick highest raw bid"| server
  server -->|"4. Return winning creative, charge the winner their own bid"| app`,
    },
    whyThisBreaks: [
      "Full table scan per request - with 5 million active campaigns, even a fast index-free scan to find targeting matches takes hundreds of milliseconds to seconds, blowing through the ~100ms budget by 10-100x before an auction even starts.",
      "Highest-bidder-pays-own-bid is a first-price auction with no theory behind it - advertisers quickly learn to under-bid their true value to protect margin (bid shading), so the platform never actually captures the value it should, and bidding strategy becomes a guessing game instead of an honest signal.",
      "No budget enforcement - a popular campaign with a $500/day budget can win every single auction it's eligible for in the first 90 seconds of traffic, spend $500 by 9:01am, and then go completely dark for the rest of the day instead of pacing evenly.",
      "No frequency capping - the same user can be shown the identical ad 40 times in one afternoon across different requests, wasting the advertiser's budget on diminishing-returns impressions and degrading the user's experience.",
      "Synchronous click/impression writes - if recording a click means writing straight to the primary billing database on the same request path that served the ad, a burst of 50,000 clicks/sec during a viral moment can lock up that database and take down ad serving itself.",
    ],
    closingNote:
      "The fix isn't one component, it's four: an index that narrows candidates before you rank them, an auction mechanism with real incentive properties, a distributed budget counter that's checked atomically on every win, and an async pipeline that keeps billing off the hot path entirely. Let's build each of those up in order.",
  },

  priorArt: [
    {
      title: 'Google Ad Manager (AdX)',
      description:
        "Runs a real-time unified auction across direct-sold and programmatic demand for every impression, historically settling with a second-price rule before moving large parts of its exchange to first-price auctions in 2019 to close a header-bidding loophole. (Google Ad Manager documentation)",
      link: 'https://support.google.com/admanager/answer/152039?hl=en',
    },
    {
      title: 'OpenRTB (IAB Tech Lab)',
      description:
        "The open protocol that standardizes the bid request/response JSON schema every exchange and DSP speaks, including the bidder response timeout convention (commonly 50-150ms) that makes 'you only get to answer once, fast' an industry norm rather than one company's rule. (IAB Tech Lab OpenRTB spec)",
      link: 'https://iabtechlab.com/standards/openrtb/',
    },
    {
      title: "Meta Ads Auction",
      description:
        "Ranks candidates by 'total value' - bid x estimated action rate x ad quality - rather than raw bid amount, explicitly to reward ads that are both valuable to the advertiser and relevant to the person seeing them. (Meta for Business, 'About ad auctions')",
      link: 'https://www.facebook.com/business/help/430291176997542',
    },
    {
      title: 'Criteo Real-Time Bidding Engine',
      description:
        "One of the largest independent RTB bidders, responding to tens of billions of bid requests a day with real-time CTR/CVR ML inference, all under the same sub-100ms SLA imposed by the exchanges it bids into. (Criteo Engineering blog)",
      link: 'https://ailab.criteo.com/large-scale-machine-learning-criteo/',
    },
    {
      title: 'Amazon DSP',
      description:
        "Publishes explicit budget pacing controls (even, ahead-of-schedule, accelerated) and frequency capping per campaign as first-class advertiser settings, showing pacing is treated as a product feature, not just an internal implementation detail. (Amazon Ads documentation)",
      link: 'https://advertising.amazon.com/library/guides/frequency-capping',
    },
  ],

  coreEntities: [
    { name: 'Campaign', description: "An advertiser's unit of spend: targeting rules, a bid strategy, a budget, a set of creatives, and a status." },
    { name: 'Creative', description: 'The actual ad asset (image, video, text) tied to a campaign, ready to be rendered in a slot.' },
    { name: 'Ad Request', description: "A publisher's real-time question - 'I have this slot, this context, this user, what ad fills it?'" },
    { name: 'Bid', description: "A candidate campaign's offer for a specific ad request: an amount plus the targeting/eligibility that qualified it." },
    { name: 'Auction', description: "The scoring and ranking process that turns a set of bids into one winner and one clearing price." },
    { name: 'Budget Ledger', description: 'The running spend counter per campaign, checked and decremented atomically on every auction win.' },
  ],

  requirements: {
    core: [
      'Serve the best-matched ad for an incoming ad request within a hard ~100ms latency budget',
      'Run an auction among eligible candidate campaigns and determine both a winner and a clearing price',
      "Enforce each campaign's daily and lifetime budget so spend never meaningfully exceeds the cap",
      'Cap how many times a given user can be shown a given ad/campaign per day (frequency capping)',
      'Record every impression and click reliably enough to bill advertisers and report campaign performance',
    ],
    belowTheLine: [
      'Programmatic guaranteed / direct-sold reservation deals with fixed CPM contracts',
      'Cross-device identity resolution and user-graph stitching',
      'Full creative rendering pipeline (video transcoding, dynamic creative optimization)',
      'Multi-currency real-time bid conversion',
      'Header bidding / waterfall mediation across multiple external ad exchanges',
      'Training the CTR/CVR ML models themselves (assume a pretrained model is queried, not trained, on the request path)',
    ],
    nonFunctionalTable: [
      { metric: 'p99 request latency', target: '< 100ms end-to-end, including any external bidder fan-out' },
      { metric: 'Availability', target: '99.99% - a down ad server is 100% lost revenue for that slice of traffic' },
      { metric: 'Throughput', target: 'sustain 1M+ ad requests/sec at global peak' },
      { metric: 'Budget accuracy', target: 'never overspend a campaign budget by more than ~1-2%' },
      { metric: 'Billing durability', target: 'zero lost impression/click events - they are literally the invoice' },
      { metric: 'Frequency cap accuracy', target: 'approximate is acceptable (off-by-one impressions tolerated), never off by orders of magnitude' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Ad Index',
      purpose: 'Candidate retrieval - narrows millions of active campaigns to a few hundred via targeting terms',
      primaryPick: 'Elasticsearch / custom inverted index',
      alternatives: 'Redis-backed in-memory index',
      whyPrimaryWins: 'The same posting-list-lookup-and-merge shape as full-text search turns 5M campaigns into ~300 candidates in single-digit milliseconds, which is the only way retrieval fits inside a 100ms budget at all',
    },
    {
      tier: 'CTR Prediction / ML Serving',
      purpose: 'Real-time inference scoring each surviving candidate by predicted click-through-rate',
      primaryPick: 'TensorFlow Serving / TorchServe',
      alternatives: 'ONNX Runtime, custom C++ inference service',
      whyPrimaryWins: 'Only runs against the ~20-50 survivors of cheaper pruning stages, so sub-10ms inference latency is achievable without needing to score the full candidate set',
    },
    {
      tier: 'Feature Store',
      purpose: 'Precomputed user, context, and ad features fetched by the CTR model at inference time',
      primaryPick: 'Redis / DynamoDB',
      alternatives: 'Feast, Tecton',
      whyPrimaryWins: 'Feature lookups sit directly inside the 100ms request path, so single-digit-millisecond key-value reads are non-negotiable - there is no time budget left for a feature computed on demand',
    },
    {
      tier: 'Budget Ledger',
      purpose: 'Atomic per-campaign spend counter, checked and decremented on every auction win',
      primaryPick: 'Redis (Lua check-and-decrement)',
      alternatives: 'DynamoDB conditional writes',
      whyPrimaryWins: 'Redis DECRBY-style atomic operations run in single-digit microseconds with no lock - a relational row lock would bottleneck at roughly 1K writes/sec per row, nowhere near what hundreds of ad servers winning the same campaign concurrently need',
    },
    {
      tier: 'Impression/Click Event Stream',
      purpose: 'Fire-and-forget beacons for billing, reporting, and fraud detection, entirely off the serving path',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar',
      whyPrimaryWins: 'A durable log lets billing, the pacing algorithm, and fraud detection all consume the exact same click stream independently, without any of them ever being able to add latency back onto ad serving',
    },
    {
      tier: 'Billing & Reporting Warehouse',
      purpose: 'Reconciles actual spend against budgets for invoicing and rolls events up into advertiser-facing dashboards',
      primaryPick: 'ClickHouse / BigQuery',
      alternatives: 'Druid, Redshift',
      whyPrimaryWins: 'Billing reconciliation and campaign-performance reporting are OLAP aggregation problems over tens of terabytes/day of event logs - a columnar warehouse is built for exactly that scan-and-aggregate pattern, not the OLTP hot path',
    },
  ],
  technologyChoicesNote:
    "Why Redis for the budget ledger instead of a relational counter? Every auction win triggers an atomic read-check-decrement against a campaign's remaining budget, and at peak that can hit very high frequency for a single popular campaign. A Redis Lua script executes the check-and-decrement as one atomic, single-digit-microsecond operation with no lock, where a relational row-level lock would bottleneck at roughly 1,000 writes/sec against that same hot row - the exact contention problem this design's own budget-pacing build calls out.",

  scaleEstimation: [
    "Ad requests: a large ad network serves on the order of 1M+ ad requests/sec at peak globally (Google's ad systems alone process well over 100 billion requests/day)",
    'Active campaigns: 5-10 million active campaigns at any moment, narrowed by targeting down to a few hundred candidates per individual request',
    'Bidder fan-out: each request can call out to dozens of internal and external bidders in parallel, each under a 50-80ms hard timeout',
    'Impressions: ~10 billion impressions/day platform-wide; at a typical 0.1-2% CTR that is roughly 10-200 million clicks/day to track and bill',
    'Event storage: raw impression/click event logs run into tens of terabytes/day before aggregation into the reporting warehouse',
    'Budget checks: every auction win triggers at least one atomic read-modify-write against a campaign budget counter - this must be sub-millisecond and correct under massive concurrency',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/ad-request',
      description: 'The hot-path call from a publisher page or app SDK asking for an ad to fill a slot.',
      example:
        '// Request\n{ "slotId": "homepage_banner_1", "context": { "keywords": ["running shoes"], "placement": "mobile_feed" }, "userId": "u_88213" }\n\n// Response 200 (auction completed in 74ms)\n{ "creativeId": "cr_4471", "campaignId": "camp_9102", "clearingPriceCents": 311, "trackingUrl": "https://track.ads/imp?tok=..." }',
    },
    {
      method: 'POST',
      path: '/v1/events/impression',
      description: 'Fire-and-forget beacon fired by the creative when it actually renders on screen.',
      example: '// Request\n{ "impressionId": "imp_991", "campaignId": "camp_9102", "clearingPriceCents": 311, "ts": 1751000000 }\n\n// Response 202\n{ "accepted": true }',
    },
    {
      method: 'POST',
      path: '/v1/events/click',
      description: 'Fire-and-forget beacon fired when a user clicks the rendered creative.',
      example: '// Request\n{ "impressionId": "imp_991", "campaignId": "camp_9102", "ts": 1751000004 }\n\n// Response 202\n{ "accepted": true }',
    },
    {
      method: 'POST',
      path: '/v1/campaigns',
      description: 'Advertiser-facing call to create a new campaign with targeting, bid strategy, and budget.',
      example:
        '// Request\n{ "advertiserId": "adv_55", "targeting": { "keywords": ["running shoes"], "geo": ["US"] }, "maxBidCents": 350, "dailyBudgetCents": 50000 }\n\n// Response 201\n{ "campaignId": "camp_9102", "status": "ACTIVE" }',
    },
    {
      method: 'PATCH',
      path: '/v1/campaigns/{id}/budget',
      description: "Update a campaign's daily or lifetime budget mid-flight.",
      example: '// Request\n{ "dailyBudgetCents": 75000 }\n\n// Response 200\n{ "campaignId": "camp_9102", "dailyBudgetCents": 75000 }',
    },
    {
      method: 'GET',
      path: '/v1/campaigns/{id}/stats',
      description: 'Reporting endpoint returning aggregated impressions, clicks, and spend for a campaign.',
      example: '// Response 200\n{ "impressions": 184213, "clicks": 2711, "spendCents": 48210, "ctr": 0.0147 }',
    },
  ],
  apiSecurityNote:
    "Impression and click beacons must be HMAC-signed with a short-lived token minted at auction time, or anyone could forge tracking calls and fabricate billing events. The exchange-to-bidder path carries pseudo-anonymous targeting data subject to privacy regulation, so callouts to external DSPs run over mTLS with allowlisted endpoints, not open HTTP.",

  highLevelDesignIntro:
    "Let's build this up incrementally: first narrow millions of campaigns down to a manageable candidate set, then rank those candidates with a real-time ML score, then settle the auction with a mechanism that has actual game-theoretic backing, then wrap the whole thing in the budget and frequency guardrails that keep advertisers from being overcharged or users from being spammed - and finally move every non-latency-critical piece off the hot path entirely.",

  builds: [
    {
      title: 'Candidate Retrieval via an Inverted Index',
      body:
        "Scanning every campaign row per request is the first thing to fix. Build an inverted index the same way a search engine does: for every targeting dimension (keyword, audience segment, geography, placement type), maintain a list of campaign IDs that target it. An incoming ad request's context - say the keywords 'running shoes' and placement 'mobile_feed' - becomes a lookup into a handful of these lists, and the union (or intersection, depending on targeting logic) of matching campaign IDs becomes your candidate set.\n\nThis is the same shape of problem as full-text search: millions of documents (campaigns), a small number of query terms (targeting signals), and a data structure that turns 'scan everything' into 'look up a few posting lists and merge them.' A well-built index turns 5 million campaigns into roughly 200-500 candidates in single-digit milliseconds.",
      newComponents: [
        {
          name: 'Targeting Index',
          description: 'An inverted index mapping each targeting term (keyword, segment, geo, placement) to the campaign IDs that target it, refreshed as campaigns change.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  request["Ad Request<br/>keywords, segments, context"]:::client
  index[("Targeting Index<br/>inverted index")]:::cache
  candidates["~300 Candidate Campaigns"]:::compute
  request -->|"1. Lookup targeting terms"| index
  index -->|"2. Union matching campaign IDs"| candidates`,
      },
      closingNote:
        "300 candidates is a manageable number to rank, but it's still far too many to run an expensive ML model against inside a 100ms budget. Before ranking, we need to know how bids actually get onto the table in the first place - which means bringing in real-time bidding.",
    },
    {
      title: 'Real-Time Bid Fan-Out (RTB)',
      body:
        "Not every candidate's bid is known in advance - in a real-time bidding setup, the ad exchange sends a bid request out to internal bidders and external demand-side platforms (DSPs) in parallel, following the OpenRTB schema the whole industry has standardized on, and each bidder has a hard timeout (commonly 50-80ms) to respond with a bid or say nothing at all.\n\nThe critical design choice is that a timeout is not an error - it's just a no-bid. If a DSP is slow or down, the auction proceeds without it rather than waiting and blowing the page's latency budget. This is the same pattern as calling multiple microservices with a deadline and proceeding with whichever responses arrived in time, except here 'whichever responses arrived' directly determines who gets to advertise and how much money changes hands.",
      newComponents: [
        { name: 'Ad Exchange', description: 'The component that fans a bid request out to all eligible bidders in parallel and collects responses within a hard timeout.' },
        { name: 'Bidders (Internal + DSPs)', description: 'Independent systems - some owned by the platform, some external - that receive bid requests and respond with a price they are willing to pay.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  exchange["Ad Exchange"]:::compute
  b1["Internal Bidder"]:::compute
  b2["External DSP A"]:::compute
  b3["External DSP B"]:::compute
  exchange -->|"1. Bid request, 80ms timeout"| b1
  exchange -->|"2. Bid request, 80ms timeout"| b2
  exchange -->|"3. Bid request, 80ms timeout"| b3
  b1 -->|"4. Bid $2.10"| exchange
  b2 -->|"5. Bid $1.85"| exchange
  b3 -.->|"6. Timeout - treated as no-bid"| exchange`,
      },
      insightCallout:
        "A slow bidder must never be allowed to slow down the auction. Hard per-bidder timeouts, enforced with a deadline the caller owns (not one the bidder self-reports), are what keep one flaky DSP from degrading every publisher on the exchange.",
      closingNote:
        "Now every candidate has a raw bid amount. But raw bid alone is a bad way to rank - a $5 bid on an ad nobody will ever click is worth less to everyone than a $2 bid on an ad people love. We need to fold in predicted engagement.",
    },
    {
      title: 'Real-Time CTR Prediction',
      body:
        "Ranking purely by bid amount rewards advertisers for bidding high regardless of whether anyone will actually click - which is bad for users (irrelevant ads) and bad for the platform (an ad nobody clicks earns nothing even if it 'won'). The fix is to rank by expected value: bid x predicted click-through-rate (pCTR), an industry-standard metric called eCPM (effective cost per mille).\n\nComputing pCTR means calling a real-time ML inference service for every surviving candidate, feeding it features about the user (past engagement, demographics), the context (page/app category, time of day), and the ad itself (historical CTR, creative format). This inference call has to happen inside the same 100ms budget as everything else, which is why it only runs against the ~300 candidates that survived retrieval, not the millions of total campaigns.",
      newComponents: [
        { name: 'Feature Store', description: 'A low-latency key-value store holding precomputed user, context, and ad features so the CTR model can fetch them in single-digit milliseconds.' },
        { name: 'CTR Prediction Service', description: 'A real-time ML inference service that scores each candidate with a predicted click-through-rate given the current request context.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  candidates["~300 Candidates"]:::compute
  features[("Feature Store<br/>user + context + ad features")]:::cache
  model["CTR Model<br/>real-time inference"]:::compute
  scored["Scored Candidates<br/>eCPM = bid x pCTR"]:::compute
  candidates -->|"1. Fetch features"| features
  features -->|"2. Feature vector"| model
  candidates -->|"3. Score each candidate"| model
  model -->|"4. Rank by eCPM"| scored`,
      },
      closingNote:
        "With every candidate now scored by eCPM, we have a ranked list. The next question is the one with actual game theory behind it: how do we turn a ranked list into a winner and a price that doesn't invite advertisers to game the system?",
    },
    {
      title: 'Settling the Auction: Second-Price Rule',
      body:
        "The highest eCPM wins the slot - that part is easy. The harder question is what the winner pays. If the winner pays exactly their own bid (first-price), advertisers are incentivized to bid below their true value to protect margin, a behavior called bid shading, which makes the whole market less efficient because bids no longer reflect true willingness to pay.\n\nThe classic fix, a Vickrey (second-price) auction, charges the winner the second-highest bid plus one cent instead of their own bid. This sounds like it costs the platform revenue, but it changes advertiser incentives completely: because your payment doesn't depend on your own bid (only on beating the runner-up), the mathematically dominant strategy is to bid your true value - bidding higher risks overpaying for nothing, bidding lower risks losing an auction you'd have profitably won. Google AdX historically ran on this mechanism for exactly this reason.",
      diagram: {
        mermaid: `flowchart TD
  ranked["Ranked by eCPM<br/>A: 4.20  B: 3.10  C: 1.90"]:::compute
  winner["Winner: Campaign A"]:::compute
  price[("Price paid: 3.11<br/>second-highest + 1 cent")]:::database
  ranked -->|"1. Highest eCPM wins the slot"| winner
  ranked -->|"2. Second-highest sets the price"| price`,
      },
      insightCallout:
        "Second-price auctions are incentive-compatible: truthful bidding is the dominant strategy. That single property is why so much of the ad tech industry converged on this mechanism instead of inventing something more clever.",
      closingNote:
        "The auction mechanism is settled, but knowing who won and what they owe means nothing if we can't actually enforce that a campaign never spends more than its budget - especially with hundreds of ad servers winning auctions for the same campaign concurrently around the world.",
    },
    {
      title: 'Budget Pacing with an Atomic Distributed Counter',
      body:
        "Picture 500 ad server instances across multiple regions, all capable of winning auctions for the same campaign at the same instant. If budget spend is tracked with a plain 'read the remaining budget, then write the new total' against a database row, two servers can both read '$50 remaining,' both commit a $40 spend, and the campaign overspends by $30 in a single collision - and at scale, lock contention on that one hot row throttles the whole system anyway.\n\nThe fix is the exact same primitive a distributed rate limiter uses: a single atomic Redis Lua script that reads the remaining budget, checks it against the clearing price, and decrements it, all in one round trip with no window for another server to interleave. A win is only confirmed if the atomic decrement succeeds; if it fails (budget just ran out), the losing server falls back to the next-ranked candidate instead of retrying the same one.\n\nThat alone prevents overspend, but it doesn't prevent a popular campaign from blowing its entire daily budget in the first few minutes of morning traffic. A pacing algorithm sits on top: it continuously estimates 'how much should this campaign have spent by now, given its daily budget and typical traffic curve' and throttles the campaign's win probability (via a bid multiplier or a random sampling gate) when it's running ahead of pace, so budget is smoothed across the whole day instead of front-loaded.",
      newComponents: [
        { name: 'Budget Ledger (Redis)', description: 'A per-campaign atomic counter, checked and decremented in a single Lua script on every auction win.' },
        { name: 'Pacing Service', description: "Continuously compares actual spend-so-far against an ideal spend curve and throttles a campaign's effective win rate to keep delivery smooth across the day." },
      ],
      diagram: {
        mermaid: `flowchart LR
  win["Auction Win<br/>campaign C1, price 3.11"]:::compute
  lua["Lua Script<br/>check-and-decrement"]:::compute
  redis[("Redis<br/>per-campaign budget counter")]:::cache
  win -->|"1. Attempt to charge campaign"| lua
  lua -->|"2. Atomic GET, check, DECRBY"| redis
  redis -->|"3. Success or insufficient-budget"| lua`,
      },
      closingNote:
        "Budget is protected, but a healthy budget and a good auction score don't stop the same user from being shown the same ad twenty times in an afternoon - that needs its own guardrail.",
    },
    {
      title: 'Frequency Capping',
      body:
        "Even a perfectly-targeted, well-paying ad loses value (and annoys the user) the fiftieth time it's shown to the same person in a day. Frequency capping tracks, per user per campaign, how many times an ad has already been shown, and excludes a candidate from the auction once it hits its cap (e.g., max 3 impressions/day).\n\nThis is a small, high-throughput key-value problem: a counter keyed by userId:campaignId, incremented on every impression, with a TTL that resets it daily. It doesn't need to be perfectly precise - being off by one impression under high concurrency is an acceptable tradeoff for keeping this check as cheap as a single cache read on the hot path.",
      newComponents: [
        { name: 'Frequency Cap Store', description: 'A key-value store keyed by user+campaign holding an impression counter with a 24-hour TTL, checked before a candidate is allowed into the auction.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  req["Candidate for user u_88213<br/>campaign C1"]:::client
  capstore[("Frequency Cap Store<br/>user:campaign counters, 24h TTL")]:::cache
  decision{"count < 3?"}:::compute
  allow["Eligible for auction"]:::compute
  skip["Excluded from this auction"]:::client
  req -->|"1. Read current count"| capstore
  capstore -->|"2. count = 2"| decision
  decision -->|"3. Yes, under cap"| allow
  decision -->|"4. No, at cap"| skip`,
      },
      closingNote:
        "The serving path is now complete: retrieve, bid, score, auction, charge, cap. Everything left - recording what actually happened and billing for it - must never touch this path again, or a traffic spike in tracking becomes an outage in serving.",
    },
    {
      title: 'Async Impression & Click Tracking',
      body:
        "The response to the ad request already includes the winning creative and its clearing price - serving is done. Recording that the impression rendered, and later that it was clicked, has to happen without adding a single millisecond back onto that already-spent 100ms budget.\n\nThe pattern is fire-and-forget: the creative fires a tracking beacon (a tiny async HTTP call or pixel) the moment it renders and again on click, which publishes an event onto a message bus. Downstream, independent consumers read that same event stream for two very different purposes - a billing aggregator that reconciles spend against the budget ledger for invoicing, and a reporting pipeline that rolls events up into the dashboards advertisers see. Neither consumer's speed or availability can ever block ad serving, because they're not in that request's call stack at all.",
      newComponents: [
        { name: 'Tracking Beacon', description: 'A lightweight async endpoint hit by the rendered creative on impression and click, decoupled entirely from the serving request/response cycle.' },
        { name: 'Event Bus (Kafka)', description: 'A durable, high-throughput log that impression and click events are published to, read independently by billing and reporting consumers.' },
        { name: 'Billing Aggregator', description: 'Consumes the event stream to reconcile actual spend against each campaign, feeding invoicing and the pacing algorithm.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  device["User Device"]:::client
  beacon["Tracking Beacon<br/>fire-and-forget"]:::edge
  bus[("Kafka<br/>impression/click events")]:::async
  billing["Billing Aggregator"]:::compute
  warehouse[("Reporting Warehouse")]:::storage
  device -->|"1. Impression/click beacon"| beacon
  beacon -->|"2. Publish event"| bus
  bus -->|"3. Consume for billing"| billing
  bus -->|"4. Consume for reporting"| warehouse`,
      },
      closingNote:
        "This async pipeline is also the natural place to catch a problem that only shows up after the fact: clicks that were never real in the first place.",
    },
    {
      title: 'Click Fraud & Invalid Traffic Detection',
      body:
        "Bots, click farms, and even accidental double-clicks generate clicks that bill advertisers for engagement that was never going to convert into anything. Unmonitored ad platforms commonly see invalid traffic (IVT) rates in the 10-20% range, which is a direct hit to advertiser trust and, eventually, to advertiser retention.\n\nBecause this is fundamentally a detection problem, not a serving problem, it runs entirely off the hot path by consuming the exact same click event stream billing already reads. A fraud detection service scores each click using device fingerprinting, click-timing anomaly patterns (a real user doesn't click an ad 40 times in one second), and IP/IVT reputation signals aligned with IAB/MRC invalid-traffic standards, then retroactively issues billing credits for anything confirmed fraudulent - keeping ad serving itself completely untouched by a computation that would never fit in a 100ms budget anyway.",
      newComponents: [
        { name: 'Fraud Detection Service', description: 'An async consumer of the click event stream that scores each click for bot/IVT signals and issues retroactive billing credits.' },
      ],
      closingNote:
        "With retrieval, scoring, auction, budget, frequency capping, and tracking all in place - plus fraud detection quietly running alongside billing - every piece of the system is accounted for. Let's trace full request flows through it end to end.",
    },
  ],

  coreFlows: [
    {
      title: 'Ad Request to Auction Win',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant App as Publisher App
  participant AS as Ad Server
  participant IDX as Targeting Index
  participant ML as CTR Model
  participant BUD as Budget Ledger

  App->>AS: Request ad for slot
  AS->>IDX: Lookup candidates by targeting
  IDX-->>AS: ~300 candidate campaigns
  AS->>ML: Score candidates (bid x pCTR)
  ML-->>AS: Ranked list by eCPM
  AS->>BUD: Check + atomically decrement budget for top candidate
  BUD-->>AS: OK, remaining budget 412.00
  AS-->>App: Winning creative + clearing price 3.11`,
      },
      nonObviousFailure:
        "If the atomic budget decrement fails for the top-ranked candidate (its budget was exhausted by another server microseconds earlier), the ad server must fall back to the next-ranked candidate immediately rather than re-running retrieval and scoring from scratch - otherwise a single budget collision blows the entire request past its 100ms deadline.",
    },
    {
      title: 'Click Tracking & Billing',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant CDN as Creative CDN
  participant BCN as Tracking Beacon
  participant BUS as Kafka
  participant BILL as Billing Aggregator

  U->>CDN: Click ad creative
  CDN->>BCN: Redirect through signed tracking pixel
  BCN->>BUS: Publish click event (async, fire-and-forget)
  BUS->>BILL: Consume event
  BILL->>BILL: Attribute click to campaign, update spend ledger
  BILL-->>BUS: ack offset`,
      },
      nonObviousFailure:
        "The redirect through the tracking pixel adds a hop the user actually waits on before landing on the advertiser's page - if that beacon call is synchronous and the tracking service is slow, you've reintroduced hot-path latency into the one place it was supposed to be gone for good.",
    },
    {
      title: 'Two Servers Racing for the Last of a Budget',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant S1 as Ad Server 1
  participant S2 as Ad Server 2
  participant R as Redis Budget Counter

  S1->>R: EVALSHA decrement_if_enough(campaign C1, 3.00)
  S2->>R: EVALSHA decrement_if_enough(campaign C1, 3.00)
  R->>R: Only 3.00 remaining - process S1 first, atomically
  R-->>S1: OK, remaining 0.00
  R-->>S2: REJECTED - insufficient budget
  S2->>S2: Fall back to next-ranked candidate`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Second-Price vs First-Price Auctions',
      problem: 'Should the winning advertiser pay exactly what they bid, or the runner-up\'s bid instead? The choice changes how every advertiser on the platform behaves, not just the winner.',
      diagram: {
        mermaid: `flowchart LR
  first["First-Price<br/>winner pays own bid"]:::client
  shade["Advertisers shade bids down<br/>to protect margin"]:::compute
  second["Second-Price<br/>winner pays runner-up + 1 cent"]:::cache
  truth["Dominant strategy:<br/>bid your true value"]:::compute
  first --> shade
  second --> truth`,
      },
      bad: "First-price, naive: the winner pays exactly their own bid. Advertisers quickly learn to under-bid their true value to protect margin - a behavior called bid shading - which means bids stop reflecting real willingness to pay and the market becomes systematically less efficient for everyone, including the platform's own revenue.",
      good: "Second-price (Vickrey) auction: the winner pays the second-highest bid plus one cent. Because your payment no longer depends on your own bid - only on beating the runner-up - the dominant strategy is to bid your true value, which is exactly what Google AdX historically ran on. The catch: once header bidding introduced multiple simultaneous second-price auctions across different exchanges for the same impression, the 'second-highest bid' computed inside any single exchange no longer reflected the true global second-highest bid, letting some participants game the resulting price discrepancy.",
      great: "Unified first-price auctions with transparent price floors and bid-landscape reporting - the direction Google Ad Manager and much of the industry moved in 2019 specifically to close that header-bidding loophole. In a first-price world, individual DSPs now run their own internal bid-shading ML models on behalf of advertisers to approximate the efficiency second-price auctions used to provide, without leaking value across a chain of simultaneous auctions the way the old approach did.",
    },
    {
      title: 'Fitting the Whole Auction Inside 100 Milliseconds',
      problem: "A page load or app impression can wait roughly 100ms total - split across candidate retrieval, bidder fan-out, ML scoring, and the auction itself - before the user notices anything is slow.",
      bad: 'Query every one of the millions of active campaigns synchronously on every request. Even an optimistic linear scan at 1 million comparisons/ms against 5 million campaigns costs several milliseconds just for the scan, and a realistic targeting-match evaluation per campaign pushes that into the hundreds of milliseconds to seconds - blowing the 100ms budget by 10-100x before ranking even starts.',
      good: 'Precompute a flat inverted index and merge posting lists per targeting term, cutting candidates from millions to a few thousand in single-digit milliseconds. This solves retrieval, but a few thousand candidates is still far too many to run an expensive real-time ML CTR inference call against - the ranking stage itself becomes the new bottleneck, quietly moving the 100ms problem one layer downstream instead of solving it.',
      great: "A layered retrieval-then-ranking funnel: a cheap index lookup narrows millions to a few hundred candidates (~5ms), a lightweight linear scoring pass narrows hundreds to roughly 20-50 survivors (~10ms), and only those survivors get the expensive real-time ML pCTR inference call (~20-30ms) that decides final auction order - the same funnel shape Google and Meta use in their own ranking systems. Layered on top, a hard per-bidder timeout (50-80ms) guarantees one slow external DSP callout can never blow the whole request's latency budget.",
    },
    {
      title: 'Preventing Distributed Budget Overspend',
      problem: "Hundreds of ad server instances across multiple regions can win auctions for the same campaign within the same millisecond. Without coordination, a campaign with $1,000 remaining in its daily budget can spend $1,400 in that same second.",
      bad: "A single row in a relational database, read with a plain SELECT and updated afterward with UPDATE campaigns SET spend = spend + :price WHERE id = :id. The read and write aren't atomic together, so two servers can both read '$50 remaining,' both independently decide they can afford a $40 spend, and both commit - overshooting the budget by $30 in one collision. At real concurrency, lock contention on that single hot row also throttles throughput for the whole campaign.",
      good: 'Give every ad server pod a local slice of the budget (remaining_budget / active_pod_count) and let it spend independently, syncing the true remaining budget back every few seconds. This removes the lock contention entirely, but at 500 pods a lagging sync window can still let the campaign overspend by 5-10% right as it approaches exhaustion, and daily pacing becomes uneven because pods drift out of sync with each other.',
      great: "The same primitive a distributed rate limiter uses for its token bucket: one atomic Redis Lua script - GET, check, DECRBY in a single round trip - per campaign, so a win is only confirmed if the decrement actually succeeds, and a losing server falls back to the next-ranked candidate rather than retrying. Layered on top, a pacing algorithm continuously throttles each campaign's effective win probability throughout the day based on actual-spend-vs-ideal-spend-curve, so the budget both never overspends past its cap and doesn't exhaust itself by 9am.",
    },
    {
      title: 'Detecting Click Fraud Without Slowing Down Serving',
      problem: 'Bots and click farms generate clicks that bill advertisers for engagement that never had a real chance to convert - but fraud detection can never run on the 100ms serving path.',
      bad: 'No detection at all: every click is trusted and billed as-is. Unmonitored ad platforms commonly see invalid traffic (IVT) rates in the 10-20% range from bots, competitor click-bombing, or accidental double-clicks, silently draining advertiser budgets and eroding trust in the platform over time.',
      good: 'Static rule-based filters on the tracking path - block known bot IP ranges, reject duplicate clicks from the same IP within one second. Cheap and catches the obvious cases, but sophisticated click farms rotate IPs and device fingerprints faster than any blocklist can be updated, and overly aggressive static rules start rejecting real users sitting behind shared corporate NATs.',
      great: 'An asynchronous fraud pipeline consuming the exact same click event stream billing already reads, scoring each click with device fingerprinting, click-timing anomaly detection, and IVT models aligned with IAB/MRC invalid-traffic standards - all within minutes rather than milliseconds - then retroactively crediting advertisers for confirmed fraudulent clicks. The serving path stays completely untouched while fraud detection still catches what static rules miss.',
    },
  ],

  selfAudit: [
    { question: 'Why second-price instead of first-price?', answer: 'It makes truthful bidding the dominant strategy - though real exchanges have since shifted to first-price to close a header-bidding loophole.' },
    { question: 'How do you fit an auction inside 100ms?', answer: 'A retrieval-then-ranking funnel: index narrows millions to hundreds, lightweight scoring narrows to dozens, only survivors get full ML inference.' },
    { question: 'How do you rank candidates?', answer: 'By eCPM = bid x predicted CTR, computed by a real-time ML inference service.' },
    { question: 'How do you stop concurrent servers from overspending one budget?', answer: 'An atomic Redis Lua check-and-decrement per campaign, the same primitive a rate limiter uses for its token bucket.' },
    { question: "How do you avoid over-showing the same ad?", answer: 'A frequency cap store keyed by user+campaign with a daily TTL, checked before a candidate enters the auction.' },
    { question: 'Where does click/impression tracking happen?', answer: 'Async, fire-and-forget beacons publish to an event bus - never on the request/response path that served the ad.' },
    { question: "What happens if a bidder is slow?", answer: 'A hard per-bidder timeout (50-80ms) treats a non-response as a no-bid; the auction proceeds without it.' },
    { question: 'How do you catch click fraud?', answer: 'An async ML/rules pipeline scores the same click stream billing reads, issuing retroactive credits rather than blocking serving.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  publisher["Publisher / App"]:::client
  server["Ad Server"]:::compute
  index[("Targeting Index")]:::cache
  exchange["RTB Exchange<br/>bidder fan-out"]:::compute
  ctr["CTR Prediction Service"]:::compute
  features[("Feature Store")]:::cache
  budget[("Budget Ledger<br/>Redis")]:::cache
  freqcap[("Frequency Cap Store")]:::cache
  cdn["Creative CDN"]:::edge
  beacon["Tracking Beacon"]:::edge
  bus[("Event Bus<br/>Kafka")]:::async
  billing["Billing Aggregator"]:::compute
  fraud["Fraud Detection"]:::compute
  warehouse[("Reporting Warehouse")]:::storage

  publisher -->|"1. Ad request"| server
  server -->|"2. Candidate lookup"| index
  server -->|"3. Bid request fan-out"| exchange
  server -->|"4. Score candidates"| ctr
  ctr -->|"5. Fetch features"| features
  server -->|"6. Check frequency cap"| freqcap
  server -->|"7. Atomic budget decrement"| budget
  server -->|"8. Serve winning creative"| cdn
  cdn -->|"9. Impression/click"| beacon
  beacon -->|"10. Publish event"| bus
  bus -->|"11. Reconcile spend"| billing
  bus -->|"12. Score for fraud"| fraud
  bus -->|"13. Aggregate for dashboards"| warehouse`,
  },

  keyTechnologies: [
    { term: 'OpenRTB', definition: 'The IAB Tech Lab standard protocol for bid request/response messages exchanged between ad exchanges and bidders, including timeout conventions.' },
    { term: 'Second-Price (Vickrey) Auction', definition: 'An auction mechanism where the winner pays the second-highest bid plus a small increment, making truthful bidding the dominant strategy.' },
    { term: 'eCPM', definition: "Effective cost per mille - bid x predicted CTR x 1000, the standard metric used to rank ad candidates by expected value rather than raw price." },
    { term: 'Inverted Index', definition: 'A data structure mapping each targeting term to the set of campaigns targeting it, used to narrow millions of campaigns to a few hundred candidates quickly.' },
    { term: 'Feature Store', definition: 'A low-latency store of precomputed user, context, and ad attributes fed into a real-time ML model at inference time.' },
    { term: 'Budget Pacing', definition: "An algorithm that throttles a campaign's effective win rate throughout the day so its budget is spent smoothly instead of exhausted immediately." },
    { term: 'Redis Lua Script', definition: 'A small program executed atomically inside Redis, used here to check-and-decrement a campaign budget counter in one round trip with no race window.' },
    { term: 'Invalid Traffic (IVT)', definition: 'Industry term (IAB/MRC) for non-genuine ad traffic - bots, click farms, or accidental interactions - that fraud detection systems aim to filter out of billing.' },
  ],

  expectedDepth: {
    mid:
      "Explain the basic shape: a request comes in, candidate ads are found by targeting, the highest-value one is picked and returned. Understand why a full campaign table scan can't work at scale, and know that clicks/impressions should be tracked without blocking the response.",
    senior:
      "Explain the full funnel: inverted-index retrieval, real-time bidding fan-out with hard timeouts, CTR-based eCPM ranking, and a second-price auction mechanism with its incentive rationale. Propose an atomic Redis counter for budget enforcement and a keyed TTL counter for frequency capping, and be able to justify why tracking must be async off the hot path.",
    staffPlus:
      "Address the second-price-vs-first-price tradeoff and why header bidding pushed the industry toward first-price with bid shading inside DSPs. Discuss budget pacing as a smoothing algorithm, not just an overspend guard, and reason about multi-region consistency for the budget ledger under network partitions. Cover fraud detection as an async, continuously-evolving system rather than a one-time rule set, and discuss cost tradeoffs of running expensive ML inference only on survivors of cheaper pruning stages.",
  },

  keyTakeaways: [
    'A retrieval-then-ranking funnel (index -> lightweight scoring -> full ML inference) is what makes a 100ms budget survivable at millions-of-campaigns scale.',
    'Second-price auctions make truthful bidding the dominant strategy - but header bidding complexity pushed much of the industry toward first-price with DSP-side bid shading instead.',
    'Rank by eCPM (bid x predicted CTR), never by raw bid alone, or the platform rewards irrelevant high bids over relevant ones.',
    'Budget enforcement under massive concurrency needs the same atomic check-and-decrement primitive a distributed rate limiter uses, not a plain read-then-write.',
    'Everything that is not required to produce the response - impression/click tracking, billing, fraud detection - belongs on an async pipeline that can never add latency back onto the serving path.',
    'Frequency capping and budget pacing are both about spreading value over time, not just preventing a single hard limit from being crossed.',
  ],

  relatedDesigns: ['rate-limiter', 'real-time-leaderboard', 'stock-broker', 'news-aggregator'],
  relatedConcepts: [
    { name: 'Real-Time Bidding', description: "The parallel, timeout-bounded bidder fan-out that produces candidate bids for every ad request." },
    { name: 'Auction Theory', description: 'The game-theoretic reasoning behind second-price vs first-price mechanisms and why incentive compatibility matters.' },
    { name: 'Distributed Rate Limiting', description: 'The atomic-counter pattern this design reuses for budget pacing and frequency capping.' },
    { name: 'Candidate Retrieval & Ranking Funnels', description: 'The general pattern of narrowing a huge space cheaply before applying an expensive model to the survivors.' },
    { name: 'Async Event Pipelines', description: 'How impression/click tracking, billing, and fraud detection all consume the same event stream without touching the serving path.' },
  ],

  simulator: {
    goalDescription: 'Pick the best-matched, highest-value ad and settle an auction for millions of concurrent ad requests within a ~100ms budget.',
    requirementChips: ['p99 < 100ms', '1M+ ad requests/sec', 'Atomic budget enforcement'],
    targetRps: 1000000,
    readRatio: 0.85,
    cacheHitRatio: 0.75,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'ad-compute-tier', label: 'Compute tier for retrieval, bidding, and scoring', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'budget-cache', label: 'Atomic cache for the targeting index, budget ledger, and frequency cap', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'event-bus', label: 'Async event bus for impression/click tracking off the hot path', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-budget-spof', label: 'No single point of failure on the auction/budget path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 150, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 6, position: { x: 880, y: 200 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 10, position: { x: 1160, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 8, position: { x: 1440, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-app', source: 'lb-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The ad server narrows candidates through the targeting index and atomically checks/decrements the budget and frequency-cap counters in Redis synchronously on the hot path; impression and click events are only published to Kafka after the response is already sent, so billing and fraud detection never add latency to serving.',
    failureModeNarratives: {
      redis:
        'The budget ledger and frequency-cap store are modeled as a single Redis tier on the hot path for every auction win. If it becomes unavailable, no auction can confirm a charge and ad serving effectively halts even though the compute tier is healthy.',
    },
    fullDesignLinkSlug: 'ad-serving-system',
  },
}

export default topic
