import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'real-time-load-bidding',
  title: 'Real-Time Load Bidding',
  difficulty: 'Advanced',
  icon: 'pi pi-bolt',
  color: '#facc15',
  readTimeMinutes: 24,
  topics: ['OpenRTB Protocol', 'Parallel Bidder Fan-Out', 'Budget Pacing', 'Second-Price Auctions'],
  companies: ['Google AdX', 'The Trade Desk', 'Criteo', 'Amazon Ads'],
  prerequisites: ['Ad Serving and Auction System', 'Caching'],
  summary:
    "A real-time bidding (RTB) system fans a single ad impression opportunity out to dozens of competing demand-side platforms (DSPs) in parallel over the OpenRTB protocol, collects whichever bid responses arrive inside a hard ~100ms deadline while treating every timeout as a silent no-bid, clears a sealed-bid second-price auction among the survivors, and notifies the winner - all while every DSP independently enforces its own real-time campaign budget pacing and frequency caps on the same request path.",

  understandingProblem:
    "An ad exchange and an individual DSP's ad server solve different halves of the same clock. The ad-serving side (picking the best campaign out of an advertiser's own inventory) is one problem; real-time bidding is the wire protocol and timing contract that lets dozens of completely independent companies - Google, The Trade Desk, Criteo, and hundreds of smaller DSPs - compete for the exact same ad impression inside a single HTTP round trip, without any of them trusting each other's infrastructure. The exchange has to treat every DSP as an unreliable, adversarial black box: some are fast, some are slow, some will occasionally be down entirely, and none of that can be allowed to add a single extra millisecond to the page load waiting on them. Meanwhile, on the other side of that same wire, each DSP is independently deciding, for every one of the potentially hundreds of thousands of bid requests it receives per second, three things simultaneously: is this impression worth bidding on at all, how much should it bid, and does bidding on it right now risk blowing a campaign's daily budget before the day is a third over. Get the deadline handling wrong and the auction hangs the page. Get the budget pacing wrong and an advertiser's entire month of spend evaporates by breakfast.",
  realExamples:
    "The IAB Tech Lab's OpenRTB specification is the literal wire format almost the entire industry speaks - a standardized JSON schema for BidRequest and BidResponse objects that lets Google AdX talk to The Trade Desk, Criteo, Amazon DSP, and hundreds of others without custom integrations. Google's Authorized Buyers program documents bidder response timeouts in the same 100-150ms neighborhood that shows up across virtually every major exchange. The Trade Desk reports evaluating on the order of ten million+ bid requests per second across its global infrastructure at peak, the overwhelming majority of which it deliberately no-bids in single-digit milliseconds because the impression, user, or context isn't worth scoring further. Criteo's real-time bidding engine responds to tens of billions of bid requests a day with live ML inference, all under exchange-imposed deadlines it does not control and cannot negotiate per-request.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart TD
  ssp["Publisher / SSP<br/>has an impression to sell"]:::client
  exchange["Exchange<br/>queries one bidder at a time"]:::compute
  d1["DSP 1"]:::compute
  d2["DSP 2"]:::compute
  d3["DSP 3"]:::compute
  ssp -->|"1. Ad opportunity"| exchange
  exchange -->|"2. Bid request, wait for full response"| d1
  d1 -->|"3. Response (or hang)"| exchange
  exchange -->|"4. Bid request, wait for full response"| d2
  d2 -->|"5. Response (or hang)"| exchange
  exchange -->|"6. Bid request, wait for full response"| d3
  d3 -->|"7. Response (or hang)"| exchange
  exchange -->|"8. Whichever bid arrived, pay own price"| ssp`,
    },
    whyThisBreaks: [
      "Latency multiplies with every bidder - querying 40 DSPs sequentially at even a generous 20ms average response time each is 800ms of wall-clock time before an auction can even be scored, roughly 8x over any exchange's ~100ms budget.",
      "No shared deadline - if DSP #3 is having a bad day (GC pause, downstream outage, cold cache), the naive loop just waits on it. There is no mechanism that says 'stop waiting for anyone after 80ms have elapsed' - a single slow bidder blocks the entire impression.",
      "First-bid-wins instead of an auction - because bidders are queried one at a time and the loop typically stops at the first response that clears a floor price, later (possibly higher-value) bidders never even get asked, so the exchange isn't running a real auction at all, just a lucky first match.",
      "Winner pays their own price - with no competitive second-price mechanism, whichever DSP happens to answer first has every incentive to shade its bid as low as possible, since there is no runner-up bid forcing honest price discovery.",
      "No isolation between bidders - a malformed or hanging response from one DSP can tie up the same request-handling thread or connection the exchange needs to move on to the next bidder, turning one bad DSP integration into a cascading slowdown for the whole auction.",
    ],
    closingNote:
      "The fix isn't a faster loop, it's a different shape entirely: query every bidder at the same instant against one shared deadline the exchange owns, so total wall-clock time is bounded by the deadline itself - not by the sum of every bidder's response time, and not by whichever bidder happens to be slowest that millisecond.",
  },

  priorArt: [
    {
      title: 'OpenRTB Specification (IAB Tech Lab)',
      description:
        "The industry-standard bid request/response JSON schema that essentially every ad exchange and DSP implements, including field-level semantics for price floors, deal IDs for private marketplaces, and the nurl/lurl macro-substitution convention for win and loss notifications.",
      link: 'https://iabtechlab.com/standards/openrtb/',
    },
    {
      title: 'Google Authorized Buyers (formerly DoubleClick Ad Exchange / AdX)',
      description:
        "Google's real-time bidding program for third-party DSPs, publishing explicit per-bidder response-time expectations and connection-management guidance so DSPs can budget their own inference latency against a deadline they don't control.",
      link: 'https://developers.google.com/authorized-buyers/rtb/start',
    },
    {
      title: 'The Trade Desk',
      description:
        "One of the largest independent DSPs, publicly describing an infrastructure that evaluates on the order of ten million-plus bid requests per second globally, with the overwhelming majority resolved as fast no-bids to conserve compute for impressions actually worth scoring.",
      link: 'https://www.thetradedesk.com/us/about-us/policies-and-disclosures',
    },
    {
      title: 'Criteo Real-Time Bidding Engine',
      description:
        "A large-scale independent bidder responding to tens of billions of bid requests a day with live CTR/CVR ML inference, all constrained by exchange-imposed timeouts it has no control over - a good reference for what the DSP side of this system has to look like internally.",
      link: 'https://ailab.criteo.com/large-scale-machine-learning-criteo/',
    },
  ],

  coreEntities: [
    { name: 'BidRequest', description: "The OpenRTB payload the exchange sends to every DSP: impression details, floor price, user/context signals, and a deadline the DSP is expected to respect." },
    { name: 'BidResponse', description: "A DSP's answer: a price, the winning creative ID if it wins, and optional deal/campaign metadata - or simply nothing at all if the DSP times out or chooses not to bid." },
    { name: 'Auction', description: "The exchange-side process that collects whichever BidResponses arrived before the deadline, validates them, and clears a winner and a price." },
    { name: 'DSP / Bidder', description: "An independent, external system representing one or more advertisers, responsible for deciding whether to bid, how much, and whether doing so fits the campaign's remaining budget - all within the exchange's deadline." },
    { name: 'Impression', description: "The single, non-reusable opportunity to show one ad to one user in one slot - the unit every bid, win, and dollar in this system is ultimately about." },
    { name: 'Campaign Budget', description: "A DSP-managed daily or lifetime spend cap for a specific advertiser campaign, checked and paced on every bid decision so a campaign never overspends or exhausts itself in the first minutes of the day." },
  ],

  requirements: {
    core: [
      'Fan a single bid opportunity out to dozens of competing DSPs in parallel and collect responses within a hard ~100ms end-to-end deadline',
      'Clear a sealed-bid, second-price auction among whichever valid bid responses arrived in time, determining one winner and one clearing price',
      "Let each DSP enforce its own campaign budget pacing and frequency capping on the bid path so a single popular campaign can't overspend or over-serve under massive concurrency",
      'Filter out bid opportunities that fail fraud or brand-safety checks before they are ever sent to a DSP, and reject bid responses that would violate a price floor or deal term',
    ],
    belowTheLine: [
      'DSP-side bid shading / bid-landscape optimization models that decide exactly how far below true value to bid',
      'Header bidding deduplication (the same impression appearing at multiple exchanges simultaneously)',
      'Video/CTV ad-pod auction sequencing and companion-ad logic',
      'Cross-currency bidding and multi-region billing reconciliation',
      'Post-win creative rendering, viewability measurement, and malware scanning',
    ],
    nonFunctionalTable: [
      { metric: 'p99 end-to-end auction latency', target: '< 100ms from bid opportunity to a winner being notified' },
      { metric: 'Per-DSP bidder deadline', target: '80-120ms hard cutoff, enforced by the exchange, not self-reported by the DSP' },
      { metric: 'Exchange throughput', target: 'sustain 500K-2M bid requests/sec fanned out across all connected DSPs' },
      { metric: 'Budget pacing accuracy', target: "never let a campaign overspend its daily cap by more than ~1-2%, and never exhaust it in the first hour" },
      { metric: 'Bid/win log durability', target: 'zero lost win events - they are the DSP\'s and exchange\'s billing record of record' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Bidder Fan-Out Transport',
      purpose: 'Parallel calls out to dozens of DSPs with one shared deadline the exchange owns',
      primaryPick: 'gRPC with deadline propagation',
      alternatives: 'HTTP/2 with per-request client timeout, raw TCP with custom framing',
      whyPrimaryWins: "A single context deadline propagates to every parallel call and actively cancels in-flight RPCs the instant it expires, freeing connections and threads immediately - a client-side timeout on plain HTTP still leaves the server-side call running to completion, wasting the DSP's own compute on a response nobody will read",
    },
    {
      tier: 'Campaign Budget / Pacing State',
      purpose: "Atomic, sub-millisecond read-check-decrement of a DSP campaign's remaining budget on every bid decision",
      primaryPick: 'Redis (Lua check-and-decrement)',
      alternatives: 'In-process local counters with periodic sync, DynamoDB conditional writes',
      whyPrimaryWins: 'A Redis Lua script executes the check-and-decrement as one atomic, single-digit-microsecond operation with no lock, which is the only way to survive thousands of concurrent bid decisions per second against the same campaign without either overspending or serializing on a hot row',
    },
    {
      tier: 'Auction Compute Tier',
      purpose: 'Rank collected bid responses and clear a winner and price once the deadline closes',
      primaryPick: 'Stateless in-memory auction workers',
      alternatives: 'Auction logic embedded directly in the fan-out gateway',
      whyPrimaryWins: 'Once bids are already sitting in memory, sorting a few dozen numbers and picking a second-price winner is a microsecond-scale operation with zero database calls - keeping the actual auction step a rounding error against the 100ms budget',
    },
    {
      tier: 'Bid/Win/Loss Event Log',
      purpose: 'Durable, async record of every bid request, response, and win for billing reconciliation and analytics',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar',
      whyPrimaryWins: 'A durable log lets billing, spend reconciliation, and campaign reporting all consume the same event stream independently and after the fact, so none of them can ever add latency back onto the live auction path',
    },
    {
      tier: 'Fraud / Brand-Safety Pre-Filter',
      purpose: 'Cheaply reject bid opportunities before they are ever sent to a DSP',
      primaryPick: 'Bloom filter deny-lists + rules engine',
      alternatives: 'Full ML fraud classifier run inline',
      whyPrimaryWins: 'A bloom filter answers "is this publisher domain or IP on a huge blocklist" in microseconds with no false negatives, cheap enough to run on every single opportunity before paying the cost of a full multi-DSP fan-out for traffic that would never bill cleanly anyway',
    },
    {
      tier: 'Edge / Regional Routing',
      purpose: "Minimize pure network RTT on both the publisher-to-exchange and exchange-to-DSP hops",
      primaryPick: 'Anycast + regional exchange points of presence',
      alternatives: 'DNS-based geo routing',
      whyPrimaryWins: "With a 100ms total budget, 20-40ms of pure cross-continent network RTT is often the single biggest line item - routing to the nearest regional PoP, and preferring DSP endpoints co-located in the same cloud region, buys back milliseconds that no amount of faster compute can recover",
    },
  ],
  technologyChoicesNote:
    "The single most important tradeoff in this whole design is querying bidders in parallel against a hard, exchange-owned timeout rather than any kind of sequential or negotiated wait. A DSP that responds after the deadline - whether it's 5ms late or 500ms late - is functionally identical to a DSP that never responded at all: its answer is simply discarded and the auction proceeds without it. This sounds harsh to the slow bidder, but it's the only design that keeps one DSP's bad day from becoming every publisher's bad day. The alternative - waiting a little longer for a bidder that's 'almost done' - has no natural stopping point once you allow it, and reintroduces exactly the unbounded tail latency the parallel-with-deadline design exists to eliminate.",

  scaleEstimation: [
    'Bid request volume: a large exchange fans out on the order of 500K-2M bid requests/sec globally at peak',
    'Bidders per auction: each opportunity is typically sent to 20-100 competing DSPs in parallel, depending on publisher configuration and per-DSP QPS agreements',
    'p99 latency budget: ~100ms end-to-end, with the bidder fan-out step itself typically allotted 60-80ms of that budget',
    'Per-DSP load: a single mid-size DSP can receive 50K-200K bid requests/sec from one exchange alone, and must cheaply no-bid the overwhelming majority in single-digit milliseconds',
    'Event volume: tens of billions of bid request/response/win events per day platform-wide, at roughly 1-2KB per OpenRTB JSON payload',
    'Budget checks: every bid a DSP is willing to make triggers at least one atomic pacing read, and every win triggers an atomic decrement - both must stay sub-millisecond under massive concurrency',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/rtb/bid  (exchange -> DSP)',
      description: "The OpenRTB bid request call. The DSP has until the exchange's deadline (commonly 80-120ms) to return a BidResponse or the request is treated as a no-bid.",
      example:
        '// Request (OpenRTB BidRequest, abbreviated)\n{ "id": "req_88213", "imp": [{ "id": "1", "bidfloor": 1.50, "banner": { "w": 300, "h": 250 } }], "site": { "domain": "publisher.com" }, "device": { "geo": { "country": "USA" } }, "tmax": 100 }\n\n// Response (OpenRTB BidResponse, 200)\n{ "id": "req_88213", "seatbid": [{ "bid": [{ "id": "b1", "impid": "1", "price": 3.75, "adid": "cr_4471", "nurl": "https://dsp.example/win?price=${AUCTION_PRICE}" }] }] }',
    },
    {
      method: 'GET',
      path: '/win  (exchange -> winning DSP, nurl callback)',
      description: 'Best-effort win notification fired by the exchange once the auction clears, with the ${AUCTION_PRICE} macro substituted with the actual clearing price the DSP will be billed.',
      example: '// Exchange calls the DSP-supplied nurl\nGET https://dsp.example/win?price=3.76\n\n// Response 200 (fire-and-forget, DSP does not need to reply meaningfully)',
    },
    {
      method: 'GET',
      path: '/loss  (exchange -> losing DSPs, lurl callback, optional)',
      description: 'Optional best-effort loss notification some exchanges send so DSPs can tune their bidding models, with a reason code and the winning price macro-substituted where policy allows.',
      example: '// GET https://dsp.example/loss?reason=2&winPrice=3.76\n// Response 200',
    },
    {
      method: 'POST',
      path: '/v1/exchange/auction  (SSP / publisher ad server -> exchange)',
      description: 'The internal call from the publisher-facing ad server into the exchange requesting an auction for one impression opportunity.',
      example:
        '// Request\n{ "slotId": "homepage_banner_1", "floorCents": 150, "context": { "domain": "publisher.com", "keywords": ["running shoes"] } }\n\n// Response 200 (auction completed in 91ms)\n{ "creativeId": "cr_4471", "winningDspId": "dsp_the-trade-desk", "clearingPriceCents": 376 }',
    },
  ],
  apiSecurityNote:
    "Every exchange-to-DSP hop runs over mTLS with allowlisted endpoints, never open HTTP - a spoofed bid request could exfiltrate proprietary user/context signals, and a spoofed win notification could fabricate billing events. The ${AUCTION_PRICE} macro in nurl/lurl callbacks must be treated as untrusted by the exchange's own async billing pipeline too: the durable Kafka win-event log, not the best-effort HTTP callback, is the actual source of truth for what a DSP owes.",

  highLevelDesignIntro:
    "Let's build this up incrementally: start by fixing the fan-out shape itself so a hard deadline actually bounds total latency, then layer in a real auction mechanism, then wrap the whole thing in the budget and safety guardrails every DSP and exchange needs on the same hot path, and finally push everything that doesn't have to be synchronous - logging, billing, and even the network hop itself - as close to zero added latency as it can get.",

  builds: [
    {
      title: 'Parallel Bidder Fan-Out With a Hard, Exchange-Owned Deadline',
      body:
        "The fix for the naive sequential loop is to query every eligible DSP at the exact same instant, all sharing one deadline the exchange itself sets and enforces - not one any individual DSP can extend by being slow. This is the classic scatter-gather pattern: fire N parallel RPCs, collect whichever responses land before a single shared context deadline expires, and actively cancel any RPC still in flight the moment that deadline passes so the DSP's own compute isn't wasted on an answer nobody will read.\n\nWorked example: the exchange fans a bid request out to 40 DSPs in parallel with an 80ms deadline. 38 of them respond within 15-60ms. DSP #17 is mid-GC-pause on its own infrastructure and doesn't respond until 220ms have elapsed - well past the deadline. Because the exchange propagated a single 80ms deadline into every one of those 40 RPCs, DSP #17's call is cancelled automatically at the 80ms mark and its eventual (unread) response changes nothing. Total wall-clock time for the fan-out step is 80ms flat, regardless of whether 1 DSP or 40 DSPs are queried - compare that to the naive sequential design's 40 x ~20ms average = 800ms.\n\nThe critical property: a timeout and a genuine no-bid must be indistinguishable to everything downstream. The auction logic never asks 'did DSP #17 time out or choose not to bid' - it just sees 39 candidates instead of 40 and moves on.",
      newComponents: [
        { name: 'Exchange Fan-Out Gateway', description: 'The component that issues one bid request to every eligible DSP in parallel, all sharing a single deadline it owns and enforces.' },
        { name: 'DSP Connection Pool', description: 'Persistent, health-checked connections to each DSP so every auction avoids the cost of a fresh TCP/TLS handshake per request.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  ssp["Publisher / SSP"]:::client
  gw["Exchange Fan-Out Gateway<br/>shared 80ms deadline"]:::edge
  d1["DSP 1"]:::compute
  d2["DSP 2"]:::compute
  d17["DSP 17<br/>slow, GC pause"]:::compute
  ssp -->|"1. Ad opportunity"| gw
  gw -->|"2. Bid request, deadline 80ms"| d1
  gw -->|"3. Bid request, deadline 80ms"| d2
  gw -->|"4. Bid request, deadline 80ms"| d17
  d1 -->|"5. Bid, 22ms"| gw
  d2 -->|"6. Bid, 41ms"| gw
  d17 -.->|"7. Deadline hit at 80ms, RPC cancelled"| gw`,
      },
      closingNote:
        "Now the exchange collects a set of bids in bounded time. But the loop still doesn't have a way to actually clear a winner and a price - it just has a pile of numbers.",
    },
    {
      title: 'Sealed-Bid Second-Price Auction Logic',
      body:
        "Once the deadline closes, the auction worker has whatever subset of BidResponses arrived in time. First, validate: discard any bid missing a price, below the impression's floor price, or malformed. Then sort the survivors by price descending. The highest bidder wins the slot, but - as with any well-run RTB auction - pays the second-highest valid bid plus one cent, not their own price, to keep bidding honest instead of inviting bid shading down to whatever the winner thinks they can get away with.\n\nWorked example: of the 39 valid responses collected within the 80ms deadline, the top five prices are $4.10, $3.75, $3.75 (tie), $2.00, and the impression's floor is $1.50. The $4.10 bidder wins. The clearing price is the second-highest valid bid plus $0.01 - here that's $3.76 (rounding the tie up by the standard one-cent increment). If only a single valid bid exists above the floor - say just the $4.10 bid and nothing else survived - the winner instead pays the floor price of $1.50, since there's no genuine second bid to set a market-based price.\n\nBecause the entire candidate set is already sitting in memory from the fan-out step, this whole process - filter, sort, pick winner and price - is a sort over at most a few dozen numbers, costing microseconds, not milliseconds.",
      diagram: {
        mermaid: `flowchart TD
  bids["Valid Bids Collected<br/>4.10, 3.75, 3.75, 2.00<br/>floor 1.50"]:::compute
  sort["Sort descending, discard below floor"]:::compute
  winner["Winner: 4.10 bidder"]:::compute
  price[("Clearing price: 3.76<br/>second-highest + 1 cent")]:::database
  bids --> sort
  sort -->|"1. Highest wins the slot"| winner
  sort -->|"2. Second-highest sets the price"| price`,
      },
      insightCallout:
        "Sealed-bid means no DSP ever sees a competitor's bid before the auction clears - only the exchange sees all bids simultaneously, which is what makes the second-price mechanism trustworthy rather than gameable.",
      closingNote:
        "The auction mechanism is sound, but nothing yet stops a DSP from winning far more auctions for one campaign than its budget can afford - that guardrail has to live on the DSP's own bid-decision path, before it even answers.",
    },
    {
      title: "Real-Time Budget Pacing Before a DSP Even Decides to Bid",
      body:
        "Every DSP receives far more bid requests per second than it has budget to win auctions for. Before a DSP's ML model even scores whether an impression is worth bidding on, it has to answer a cheaper, faster question first: is this campaign even eligible to bid right now, given how much of its daily budget is already spent and how far into the day we are?\n\nA plain 'stop bidding once the budget hits zero' guard prevents overspend but does nothing to prevent a popular campaign from blowing its entire daily budget in the first few minutes of morning traffic - which is bad for the advertiser (no delivery for the rest of the day) and bad for the DSP (a burst of wins it then has to pace-correct after the fact). The fix is a probabilistic pacing throttle computed from an ideal-spend curve: compare how much the campaign should have spent by now against how much it has actually spent, and use that ratio to decide what fraction of otherwise-eligible bid requests actually get a real bid response versus a silent no-bid.\n\nWorked example: a campaign has a $2,400/day budget with even pacing, meaning an ideal spend rate of $100/hour, or about $1.67/minute. It's 9:05am and the campaign has already spent $180 - roughly 21x ahead of the $8.33 it should have spent by this point in the day. The pacing controller computes a throttle multiplier of ideal_spend_so_far / actual_spend_so_far = 8.33 / 180 ≈ 0.046, meaning only about 4.6% of otherwise-eligible bid requests are allowed to proceed to scoring and bidding; the other ~95.4% are no-bid immediately, cooling the spend rate back toward the ideal curve rather than exhausting the day's budget by breakfast.",
      newComponents: [
        { name: 'Budget Ledger (Redis)', description: "Each campaign's remaining daily budget, checked and atomically decremented on every confirmed win via a Lua script." },
        { name: 'Pacing Controller', description: 'Continuously compares actual spend-so-far against an ideal spend curve and computes a throttle multiplier gating what fraction of eligible bid requests actually get scored and bid on.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  req["Bid Request Arrives"]:::client
  pace["Pacing Controller<br/>throttle = ideal / actual"]:::compute
  redis[("Redis<br/>spend-so-far vs ideal curve")]:::cache
  gate{"Random draw < throttle?"}:::compute
  score["Proceed to scoring/bid"]:::compute
  nobid["Silent no-bid"]:::client
  req --> pace
  pace -->|"1. Read spend curve"| redis
  pace --> gate
  gate -->|"2. Yes, ~4.6%"| score
  gate -->|"3. No, ~95.4%"| nobid`,
      },
      closingNote:
        "Pacing keeps a campaign's spend smooth across the day, but it says nothing about whether the same person is being shown the same ad fifty times in an afternoon - that's a separate, per-user guardrail.",
    },
    {
      title: 'Frequency Capping at Bid Time',
      body:
        "Even a campaign with plenty of budget left shouldn't win the same user's attention over and over in a single day - it wastes spend on diminishing returns and degrades the user's experience. Frequency capping tracks, per user per campaign, how many times an impression has already been won, and excludes a campaign from bidding at all once it hits its cap (e.g., max 3/day).\n\nBecause a single DSP evaluates this on every one of the (up to) hundreds of thousands of bid requests it receives per second, the check has to be as cheap as the pacing check - a single key-value read keyed by userId:campaignId with a 24-hour TTL, incremented only on confirmed wins (via the same async win-event stream that feeds billing), not on every bid attempt. It doesn't need to be perfectly precise: being off by one impression under extreme concurrency is an acceptable tradeoff for keeping this a single cache read on the hot path rather than a stronger, slower coordination mechanism.",
      newComponents: [
        { name: 'Frequency Cap Store', description: 'A key-value store keyed by user+campaign holding a win counter with a 24-hour TTL, checked before a campaign is allowed to bid on a given opportunity.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  req["Bid opportunity for user u_88213<br/>campaign C1"]:::client
  capstore[("Frequency Cap Store<br/>user:campaign, 24h TTL")]:::cache
  decision{"wins today < 3?"}:::compute
  proceed["Eligible to bid"]:::compute
  skip["No-bid, cap reached"]:::client
  req -->|"1. Read win count"| capstore
  capstore -->|"2. count = 2"| decision
  decision -->|"3. Yes, under cap"| proceed
  decision -->|"4. No, at cap"| skip`,
      },
      closingNote:
        "Pacing and frequency capping both live inside the DSP's bid decision. On the exchange side, there's a cheaper filter that should happen even earlier - before a bid request is sent to any DSP at all.",
    },
    {
      title: 'Brand-Safety and Fraud Pre-Filtering Before Fan-Out',
      body:
        "Not every bid opportunity deserves the cost of a full multi-DSP fan-out. Traffic from a known bot IP range, a publisher domain on a brand-safety blocklist, or a slot flagged as non-viewable should never reach a DSP in the first place - sending it out anyway wastes every connected DSP's compute on scoring an impression that would never bill cleanly, and erodes trust in the exchange's traffic quality.\n\nThis filter has to run before fan-out, on every single opportunity, which means it has to be nearly free. A Bloom filter answers 'is this domain/IP/device ID on our deny-list' in microseconds with no false negatives (some false positives are an acceptable tradeoff at this stage), backed by a lightweight rules engine for structural checks like missing required fields or an impossible geo/device combination. Anything that fails this stage is rejected immediately with no DSP ever seeing it - the exchange effectively refuses to sell traffic it already suspects isn't real.",
      newComponents: [
        { name: 'Pre-Filter Service', description: 'A Bloom-filter-backed deny-list plus a rules engine that rejects bid opportunities before any DSP is contacted, filtering out known-bad traffic cheaply and early.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  opp["Bid Opportunity"]:::client
  filter["Pre-Filter Service<br/>Bloom filter + rules"]:::compute
  reject["Rejected<br/>never sent to any DSP"]:::client
  fanout["Proceed to bidder fan-out"]:::edge
  opp --> filter
  filter -->|"1. On deny-list / malformed"| reject
  filter -->|"2. Passes checks"| fanout`,
      },
      closingNote:
        "With retrieval-free filtering, parallel fan-out, a second-price auction, budget pacing, and frequency capping all in place, the live path is complete. Everything left is recording what happened - and that must never touch this path again.",
    },
    {
      title: 'Async Bid/Win/Loss Logging for Billing and Analytics',
      body:
        "The auction has already cleared and the winner already notified by the time anything needs to be logged - none of what follows can add latency back onto a request that already spent its budget. Every bid request, every bid response (won or lost), and every win are published as fire-and-forget events onto a durable log, consumed independently by a billing reconciliation pipeline and an analytics/reporting warehouse.\n\nThere's a subtlety specific to RTB: the OpenRTB win notification (the nurl callback) is a best-effort HTTP call the exchange fires at the winning DSP - it can be dropped, delayed, or never delivered if the DSP's endpoint is briefly unreachable. Relying on that callback alone as the DSP's billing record of truth means occasionally billing nothing for a real win. The fix is for the exchange to also publish every win to its own durable Kafka topic regardless of whether the nurl call succeeded, so the DSP's billing reconciliation can consume the durable log as the source of truth and treat the best-effort HTTP callback purely as a low-latency optimization, not a guarantee.",
      newComponents: [
        { name: 'Bid/Win Event Bus (Kafka)', description: 'A durable log of every bid request, response, and win, published after the response has already been sent, consumed independently by billing and analytics.' },
        { name: 'Billing Reconciliation Service', description: "Consumes the durable win-event log - not the best-effort nurl callback - to compute each DSP's actual owed spend." },
      ],
      diagram: {
        mermaid: `flowchart LR
  win["Auction Clears<br/>winner + price"]:::compute
  notify["Best-effort nurl callback"]:::edge
  bus[("Kafka<br/>durable win events")]:::async
  bill["Billing Reconciliation"]:::compute
  warehouse[("Analytics Warehouse")]:::storage
  win -->|"1. Fire-and-forget"| notify
  win -->|"2. Always published, regardless of #1"| bus
  bus -->|"3. Source of truth"| bill
  bus -->|"4. Aggregate"| warehouse`,
      },
      closingNote:
        "The compute path is now fully async where it can be. The one piece of latency that's neither compute nor a queue - pure network distance - still eats meaningfully into the 100ms budget.",
    },
    {
      title: 'Geo/Latency-Aware Routing to the Nearest Exchange Region',
      body:
        "With a total 100ms budget, pure network round-trip time on two hops - publisher to exchange, and exchange to each DSP - is often the single largest uncontrollable line item, and it's the one piece of latency that no amount of faster auction logic can buy back. A publisher in Singapore whose ad request happens to land on an exchange PoP in Virginia pays roughly 200ms of pure cross-Pacific RTT before a single bid request has even been sent - already blowing the entire budget before any DSP is contacted.\n\nThe fix is the same pattern used anywhere latency-sensitive traffic crosses a continent: anycast routing (or geo-aware DNS) sends the publisher's request to the nearest regional exchange point of presence, and the exchange in turn prefers DSP endpoints that are co-located in the same cloud region or a nearby availability zone. Many large DSPs deliberately run bidding infrastructure inside the same AWS/GCP regions as the exchanges they bid into for exactly this reason - trading infrastructure cost for 10-20ms of network RTT that would otherwise be unrecoverable no matter how fast their ML model runs.",
      newComponents: [
        { name: 'Regional Exchange PoPs', description: 'Multiple geographically distributed exchange deployments, each terminating publisher traffic and DSP connections local to that region.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  pubUS["Publisher, US-East"]:::client
  pubAPAC["Publisher, Singapore"]:::client
  popUS["Exchange PoP, US-East"]:::edge
  popAPAC["Exchange PoP, Singapore"]:::edge
  dspUS["DSPs co-located, US-East"]:::compute
  dspAPAC["DSPs co-located, APAC"]:::compute
  pubUS -->|"1. ~2ms RTT"| popUS
  pubAPAC -->|"2. ~2ms RTT"| popAPAC
  popUS -->|"3. same-region hop"| dspUS
  popAPAC -->|"4. same-region hop"| dspAPAC`,
      },
      closingNote:
        "With regional routing in place, every piece of the design - pre-filtering, parallel fan-out under a hard deadline, a second-price auction, per-DSP budget pacing and frequency capping, async logging, and geo-local routing - is accounted for. Let's trace full request flows through it end to end.",
    },
  ],

  coreFlows: [
    {
      title: 'A Single RTB Auction (Publisher Request to Ad Render)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant SSP as Publisher / SSP
  participant EX as Exchange
  participant D1 as DSP A
  participant D2 as DSP B
  participant D3 as DSP C (slow)

  SSP->>EX: Ad opportunity for slot
  EX->>EX: Pre-filter for fraud/brand safety
  EX->>D1: Bid request, deadline 80ms
  EX->>D2: Bid request, deadline 80ms
  EX->>D3: Bid request, deadline 80ms
  D1-->>EX: Bid $4.10, 22ms
  D2-->>EX: Bid $3.75, 41ms
  EX->>EX: 80ms deadline hits, cancel D3's RPC
  EX->>EX: Clear second-price auction: winner D1, price $3.76
  EX-->>SSP: Winning creative, clearing price $3.76
  EX->>D1: Fire-and-forget win notify (nurl)`,
      },
      nonObviousFailure:
        "If DSP C's response actually arrives a few milliseconds after the deadline expired, the exchange must not retroactively re-run the auction to include it - the auction result was already committed and returned to the publisher at the 80ms mark, and reopening it would both violate the exchange's own latency SLA and make auction outcomes non-deterministic based on network jitter.",
    },
    {
      title: 'Budget Pacing Check During an Auction',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant EX as Exchange
  participant DSP as DSP Bid Handler
  participant PACE as Pacing Controller
  participant R as Redis (spend curve)
  participant ML as CTR/Bid Model

  EX->>DSP: Bid request for campaign C1
  DSP->>PACE: Should C1 bid on this opportunity?
  PACE->>R: Read spend-so-far vs ideal curve
  R-->>PACE: actual=$180, ideal=$8.33 (9:05am)
  PACE->>PACE: throttle = 8.33/180 ≈ 0.046
  PACE-->>DSP: Random draw fails threshold - no-bid
  DSP-->>EX: (no response sent)`,
      },
      nonObviousFailure:
        "If the pacing check itself becomes slow (say, a Redis hot-key bottleneck on a viral campaign), a DSP under a hard exchange deadline is forced to choose between skipping the pacing check (risking overspend) or timing out the whole bid (losing a legitimate opportunity) - which is why the pacing read has to be sub-millisecond, not just 'usually fast.'",
    },
  ],

  deepDives: [
    {
      title: 'Meeting the 100ms Auction Deadline With Slow/Unresponsive Bidders',
      problem: "A page load can wait roughly 100ms total for an ad, and any one of dozens of independently-operated DSPs might be slow, degraded, or fully down at the exact moment their bid request arrives - with the exchange having zero control over their internal infrastructure.",
      bad: "Query bidders sequentially with no timeout at all, waiting for each one's full response before moving to the next. A single slow or hung DSP blocks the entire auction indefinitely, and total latency scales with the number of bidders queried rather than being bounded by anything the exchange controls.",
      good: "Query bidders in parallel, each with its own per-request client-side timeout. This bounds the exchange's own wait time, but the RPC to the slow DSP is often still running on the DSP's side even after the exchange has given up on it - wasting that DSP's compute and, if the exchange's client library doesn't actively tear down the connection, potentially leaking sockets or threads on the exchange's own side too.",
      great: "Propagate a single shared deadline (via gRPC context deadlines or an equivalent mechanism) into every parallel RPC at fan-out time, so the deadline is enforced consistently and actively cancels in-flight calls - on both sides - the instant it expires. Layer a circuit breaker on top that tracks each DSP's rolling timeout rate and automatically reduces (or temporarily zeroes) the QPS routed to a chronically slow bidder, so one degraded DSP can't keep consuming a full share of fan-out capacity across millions of auctions while contributing close to zero winning bids.",
    },
    {
      title: 'Real-Time Budget Pacing Under Massive Auction Concurrency',
      problem: "Thousands of ad servers and DSP instances worldwide can each independently decide to bid on behalf of the same campaign within the same millisecond, and a campaign's daily budget has to survive that concurrency without either overspending or exhausting itself in the first few minutes of traffic.",
      bad: "Check the campaign's remaining budget with a plain read, and only stop bidding once that number hits exactly zero. Because dozens of concurrent bid decisions can all read 'budget remaining: $50' before any of them commits a win, the campaign can overspend well past its cap in a single burst - and even without any overspend bug, nothing stops the campaign from winning its entire day's budget in the first 90 seconds of morning traffic, going dark for the rest of the day.",
      good: "Add an atomic check-and-decrement (the same Redis Lua primitive a distributed rate limiter uses for its token bucket) so a win is only confirmed if the decrement actually succeeds, closing the overspend hole completely. This is a correct hard guardrail, but it's purely reactive - it does nothing to prevent the campaign from still front-loading its entire budget into the first few minutes of traffic before the guardrail kicks in and abruptly cuts it off for the rest of the day.",
      great: "Combine the atomic decrement as a last-resort backstop with a proactive, probabilistic pacing throttle computed continuously from an ideal-spend-vs-actual-spend curve - exactly the mechanism used earlier in this design, where a campaign running 21x ahead of its ideal pace gets throttled down to bidding on roughly 5% of otherwise-eligible opportunities. The atomic decrement guarantees the budget is never technically violated; the pacing throttle is what makes delivery smooth across the whole day instead of a single burst followed by silence.",
    },
  ],

  selfAudit: [
    { question: 'Why parallel fan-out with a shared deadline instead of sequential calls?', answer: 'Total latency is bounded by the deadline itself, not by the sum of every bidder\'s response time - critical when querying dozens of DSPs inside a ~100ms budget.' },
    { question: 'What happens when a DSP does not respond in time?', answer: 'A timeout is treated identically to a genuine no-bid. The exchange-owned deadline actively cancels the RPC and the auction proceeds without that bidder.' },
    { question: 'How is the auction winner and price determined?', answer: 'A sealed-bid second-price auction: highest valid bid wins the slot, pays the second-highest valid bid plus one cent (or the floor price if no second bid exists).' },
    { question: 'How does a single campaign avoid overspending across thousands of concurrent auctions?', answer: 'An atomic Redis Lua check-and-decrement backstop, combined with a proactive pacing throttle that compares actual spend against an ideal spend curve.' },
    { question: 'Why filter for fraud/brand safety before fan-out instead of after?', answer: 'Sending a doomed bid opportunity to dozens of DSPs wastes their compute and erodes trust in the exchange - a cheap Bloom-filter check rejects it before any DSP is even contacted.' },
    { question: 'How is billing reconciled given best-effort win notifications?', answer: "The nurl HTTP callback is best-effort and can be dropped; the durable Kafka win-event log, published regardless of callback delivery, is the actual source of truth for billing." },
    { question: 'Why does regional routing matter for a latency budget this tight?', answer: 'Pure cross-continent network RTT can consume the entire 100ms budget before a single bid request is even sent - no amount of faster compute recovers time lost to network distance.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  ssp["Publisher / SSP"]:::client
  pop["Regional Exchange PoP"]:::edge
  prefilter["Fraud/Brand-Safety<br/>Pre-Filter"]:::compute
  gw["Bidder Fan-Out Gateway<br/>shared deadline"]:::compute
  dsp1["DSP A"]:::compute
  dsp2["DSP B"]:::compute
  dspN["DSP N"]:::compute
  pace[("Pacing / Budget<br/>Redis")]:::cache
  freqcap[("Frequency Cap Store")]:::cache
  auction["Auction Worker<br/>second-price clear"]:::compute
  bus[("Kafka<br/>bid/win events")]:::async
  billing["Billing Reconciliation"]:::compute
  warehouse[("Analytics Warehouse")]:::storage

  ssp -->|"1. Ad opportunity"| pop
  pop -->|"2. Filter check"| prefilter
  prefilter -->|"3. Passes"| gw
  gw -->|"4. Bid request, deadline"| dsp1
  gw -->|"5. Bid request, deadline"| dsp2
  gw -->|"6. Bid request, deadline"| dspN
  dsp1 -->|"7. Budget/pacing check"| pace
  dsp1 -->|"8. Frequency check"| freqcap
  dsp1 -->|"9. Bid response"| gw
  dsp2 -->|"10. Bid response"| gw
  gw -->|"11. Collected bids"| auction
  auction -->|"12. Winner + price"| pop
  pop -->|"13. Winning creative"| ssp
  auction -->|"14. Publish events"| bus
  bus -->|"15. Reconcile spend"| billing
  bus -->|"16. Aggregate"| warehouse`,
  },

  keyTechnologies: [
    { term: 'OpenRTB', definition: 'The IAB Tech Lab standard protocol defining the BidRequest/BidResponse JSON schema and timeout conventions used across virtually every ad exchange and DSP.' },
    { term: 'DSP (Demand-Side Platform)', definition: "A system representing advertisers, receiving bid requests and deciding, per request, whether and how much to bid on behalf of one or more campaigns." },
    { term: 'SSP (Supply-Side Platform)', definition: "A system representing publishers, packaging their ad inventory into bid opportunities and sending them into one or more exchanges to be auctioned." },
    { term: 'Second-Price (Vickrey) Auction', definition: 'An auction mechanism where the winner pays the second-highest valid bid plus a small increment rather than their own bid, making truthful bidding the dominant strategy.' },
    { term: 'Bid Shading', definition: "A DSP's practice of bidding below its true estimated value for an impression to protect margin - most relevant in first-price auction contexts where the winner pays exactly what it bid." },
    { term: 'Frequency Capping', definition: 'A limit on how many times a given user can be shown a given campaign\'s ad within a time window, enforced as a cheap per-user-per-campaign counter check before a bid is placed.' },
    { term: 'Budget Pacing', definition: "An algorithm that throttles a campaign's effective bid rate throughout the day based on actual-spend-vs-ideal-spend, so budget is spent smoothly rather than exhausted immediately." },
  ],

  expectedDepth: {
    mid:
      "Explain the basic shape: an exchange sends a bid request to multiple DSPs, collects responses within a time limit, and picks a winner. Understand why querying bidders one at a time doesn't work at scale, and know that a non-responding DSP should be treated as a no-bid rather than blocking the auction.",
    senior:
      "Explain parallel fan-out with a single shared, actively-enforced deadline (not just a per-call client timeout), the second-price auction mechanism and why it discourages bid shading, and how a DSP enforces its own real-time budget pacing and frequency capping on the bid-decision path. Be able to justify why win/loss logging has to be async and why the durable event log, not the best-effort nurl callback, is the billing source of truth.",
    staffPlus:
      "Address deadline propagation as a systems problem (context cancellation actually freeing resources on both sides, not just bounding the caller's wait), circuit-breaking chronically slow bidders out of fan-out capacity, and the difference between a hard atomic overspend guardrail and a proactive pacing throttle that shapes delivery across the whole day. Discuss regional routing tradeoffs (infra cost vs. network RTT) given how little of a 100ms budget survives a cross-continent round trip, and reason about how OpenRTB's best-effort notification model forces every serious implementation to treat its own durable event log as ground truth rather than the protocol's callbacks.",
  },

  keyTakeaways: [
    "Query every bidder in parallel against one shared, actively-enforced deadline - total latency must be bounded by the deadline, not by the slowest bidder or the sum of every bidder's response time.",
    'A timeout and a genuine no-bid must be indistinguishable to the auction: discarding a late response, not waiting for it, is what keeps one slow DSP from degrading every publisher on the exchange.',
    'Budget pacing needs both a proactive throttle (spend-so-far vs. ideal curve) to spread delivery evenly across the day and a hard atomic decrement as the last-resort guardrail against overspend under concurrency.',
    "Treat the durable async event log, not a best-effort HTTP win callback, as the actual source of truth for billing - protocols built on fire-and-forget notifications will always lose some fraction of them.",
  ],

  relatedDesigns: ['ad-serving-system', 'rate-limiter', 'message-queue'],
  relatedConcepts: [
    { name: 'Scatter-Gather With Deadlines', description: "The parallel fan-out-and-collect pattern with a single shared, actively-enforced timeout that this entire design's latency budget depends on." },
    { name: 'Distributed Rate Limiting / Pacing', description: 'The atomic-counter and proactive-throttle patterns reused here for per-campaign budget pacing and frequency capping.' },
    { name: 'Auction Theory', description: "The game-theoretic reasoning behind second-price mechanisms and why they push bidders toward truthful, rather than shaded, bids." },
  ],
}

export default topic
