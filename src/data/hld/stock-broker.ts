import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'stock-broker',
  title: 'Stock Broker (Robinhood / Zerodha)',
  difficulty: 'Advanced',
  icon: 'pi pi-chart-line',
  color: '#10b981',
  readTimeMinutes: 32,
  topics: [
    'Order Matching Engine (Price-Time Priority)',
    'Sequenced Event Log (Kafka)',
    'Market Data Fan-Out',
    'Risk & Margin Checks',
    'Exactly-Once Order Processing',
  ],
  companies: ['Robinhood', 'Zerodha', 'Interactive Brokers', 'Charles Schwab'],
  prerequisites: ['Event Sourcing', 'Idempotency', 'Pub/Sub Fan-Out', 'Database Indexing'],
  summary:
    'A trading platform that accepts orders, enforces risk and margin limits, matches them against a live per-instrument order book with price-time priority, and streams portfolio and market-data updates to millions of connected clients with financial-grade correctness on the money side and best-effort freshness on the market-data side.',

  understandingProblem:
    "A retail brokerage lets a user place an order to buy or sell a security, matches that order against other users' orders (or routes it to an exchange), updates the user's cash and position balances, and shows them a live-updating order book, portfolio, and fill confirmation. Underneath the simple UI sit two systems with opposite personalities fighting for the same request: a matching engine that must be blisteringly fast (microseconds to low milliseconds) and a ledger that must be perfectly correct (an account can never be shown buying power that doesn't exist, and a trade can never be silently lost or duplicated). Market open, market close, and volatility spikes - Robinhood's well-documented strain during the 2020-2021 meme-stock surges is the canonical public example - can drive order volume to 10-20x normal levels in seconds, and the two failure modes (losing an order, or momentarily corrupting a balance) are not cosmetic bugs, they are financial and regulatory incidents.",
  realExamples: "Robinhood, Zerodha, Interactive Brokers, Charles Schwab, E*TRADE, the NASDAQ/NYSE matching cores that many of these ultimately route into.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  CLIENT["Client App"]:::client
  API["Order API"]:::edge
  PG[("PostgreSQL<br/>orders + balances")]:::database

  CLIENT -->|"1. POST /orders"| API
  API -->|"2. INSERT INTO orders"| PG
  API -->|"3. SELECT best bid/ask FOR UPDATE"| PG
  API -->|"4. UPDATE balances"| PG`,
    },
    whyThisBreaks: [
      "Row locks on \"best bid/ask FOR UPDATE\" serialize every order on an instrument behind a single database row - two unrelated traders end up blocking each other.",
      'A relational database issuing synchronous SELECT/UPDATE per order tops out at hundreds of TPS on a single hot row, not the microsecond-scale matching a real exchange needs.',
      'No durable, ordered record of "what arrived when" separate from the matching result - you cannot replay history to prove to a regulator that price-time priority was honored.',
      'A crash between reading the order book and writing the balance update can create or destroy money, or match an order twice.',
      'No idempotency - a client retry after a timeout submits the same order again, and now the user is filled twice.',
      "In simple terms: a trader taps \"buy\" and their connection blips before the response arrives. Did the order go through? If the client blindly retries, does the user now own 200 shares instead of 100?",
      'No separation between matching (needs to be fast) and settlement (needs to be ACID-strict) - one database transaction is being asked to do both jobs at once, and it does neither well.',
      "No burst headroom - market open/close routinely sees 10-20x normal order volume in the first and last few minutes of the session, and a single write-locked table has no way to absorb that.",
    ],
    closingNote:
      "The rest of this design pulls those two jobs apart: a durable ordered log plus an in-memory matching engine for speed and auditability, and a strictly-ACID ledger for money, connected by events instead of a shared lock.",
  },

  priorArt: [
    {
      title: 'LMAX Disruptor / Business Logic Processor Pattern',
      description:
        "LMAX's well-known exchange architecture keeps a single-threaded, in-memory business logic processor per shard backed by a durable input event journal - this design uses the same pattern for a single-threaded, per-instrument matching engine that is reconstructed from its order log on restart.",
      link: 'https://martinfowler.com/articles/lmax.html',
    },
    {
      title: 'NASDAQ / NYSE Price-Time Priority Order Books',
      description:
        "Real exchanges match resting orders using price-then-arrival-time priority on a per-instrument limit order book. This design's price-level-plus-FIFO-queue structure is the standard textbook implementation of that same matching rule.",
      link: 'https://www.sec.gov/files/rules/other/nasdaqllcf1a4_5/e_sysdesc.pdf',
    },
    {
      title: 'Event Sourcing - "Turning the Database Inside Out"',
      description:
        "Martin Kleppmann's framing of a durable, ordered log as the primary source of truth, with materialized views (the order book, the ledger) derived by replaying it, is exactly the relationship between the Kafka order log and the matching engine/ledger here.",
      link: 'https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html',
    },
    {
      title: 'T+1/T+2 Settlement Cycle',
      description:
        'U.S. and Indian equity markets settle trades one to two business days after execution. This design mirrors that by having the ledger track separate settled-balance and available-buying-power views instead of treating an executed trade as immediately and fully final.',
      link: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/new-t1-settlement-cycle-what-investors-need-know-investor-bulletin',
    },
    {
      title: 'Robinhood 2020-2021 Meme-Stock Infrastructure Strain',
      description:
        'Publicly documented order volume spikes of 10-20x normal drove outages and trading restrictions across several retail brokerages, motivating the design choices here around per-instrument sharding, fail-closed order logging, and decoupled market-data fan-out.',
      link: 'https://en.wikipedia.org/wiki/GameStop_short_squeeze',
    },
    {
      title: 'Pub/Sub Fan-Out at Exchange Scale (Bloomberg/Reuters Market Data Distribution)',
      description:
        'Commercial market-data vendors distribute price ticks to hundreds of thousands of consumers by treating the feed as a broadcast problem - one publish, many independent fan-out tiers - rather than a per-client query, which is the same shape this design uses for the WebSocket gateway tier.',
    },
  ],

  coreEntities: [
    { name: 'Order', description: 'A client-submitted request to buy or sell an instrument, carrying type (market/limit/stop), quantity, price, and an idempotency key.' },
    { name: 'Order Book', description: 'Per-instrument bid/ask price levels, each holding a FIFO queue of resting orders awaiting a match.' },
    { name: 'Execution (Fill)', description: 'The result of two orders matching - a trade record with price, quantity, timestamp, and the two counterparties.' },
    { name: 'Instrument', description: 'A tradable security (equity, ETF, option) with its own dedicated order book and matching partition.' },
    { name: 'Position', description: "A user's current holding in an instrument - quantity and average cost, derived from the ledger's execution history." },
    {
      name: 'Account Ledger',
      description: "The ACID-consistent double-entry record of an account's cash, positions, settled balance, and available buying power.",
    },
    { name: 'Watchlist / Quote Subscription', description: 'The set of symbols a connected client wants live price and depth updates for.' },
  ],

  requirements: {
    core: [
      'Users can place market, limit, and stop orders for equities, and view real-time order book depth and last-traded price.',
      'The system performs pre-trade risk checks (buying power, margin, position limits) before an order reaches the matching engine.',
      'Orders are matched against a price-time-priority order book per instrument, producing trade executions.',
      'Users see real-time portfolio value, open orders, and fill notifications as trades execute.',
      'The platform settles trades (T+1/T+2), updates cash and position balances, and generates statements/tax documents.',
      'Users can cancel or modify open orders, with the system guaranteeing an order cannot be modified after it has started matching.',
    ],
    belowTheLine: [
      'Support for options, futures, and other derivatives beyond simple equities',
      'Fractional share orders',
      'Advanced conditional order types (trailing stop, one-cancels-other, bracket orders)',
      'Programmatic/algorithmic trading API access for power users',
      'Cross-exchange smart order routing and best-execution arbitration (assume a single matching venue)',
      'KYC, AML, and tax-reporting pipelines beyond generating raw statement data',
    ],
    nonFunctionalTable: [
      { metric: 'Order acknowledgment latency', target: 'Low tens of ms end-to-end; matching-engine internal latency in microseconds to low milliseconds' },
      { metric: 'Order processing guarantee', target: 'Exactly-once - no order ever lost, duplicated, or matched twice' },
      { metric: 'Money consistency', target: 'Strong consistency on cash, positions, and buying power - never briefly shown balances that are not real' },
      { metric: 'Market data freshness', target: 'Up to a few hundred ms of UI staleness tolerated on quotes/depth; the book itself must never be shown self-inconsistent' },
      { metric: 'Auditability', target: 'Order book and trade history strictly consistent and replayable, retained 7 years for regulatory record-keeping' },
      { metric: 'Burst handling', target: 'Absorb 10-20x normal order volume (market open/close, major news) with zero dropped orders' },
      { metric: 'Fan-out scale', target: 'Stream quotes/depth to 500K+ concurrently connected clients across thousands of symbols' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Order Book (Matching Engine)',
      purpose: 'Active limit orders, price-time-priority per instrument',
      primaryPick: 'In-memory price-level map (TreeMap) per symbol',
      alternatives: 'Redis Sorted Set, LMAX Disruptor',
      whyPrimaryWins: 'A single-threaded, lock-free, in-process structure gives O(log P) best-price lookup and O(1) matching within a level - matching needs microsecond latency, not a network round-trip.',
    },
    {
      tier: 'Order Log',
      purpose: 'Durable, strictly-ordered append log of every order/cancel, partitioned per instrument',
      primaryPick: 'Kafka',
      alternatives: 'Redpanda, Kinesis',
      whyPrimaryWins: "Partition-per-instrument ordering is the entire input to price-time priority, and the log doubles as the replay source that reconstructs the matching engine's book after a crash.",
    },
    {
      tier: 'Ledger of Record',
      purpose: 'Double-entry journal entries for cash, positions, and settlement state',
      primaryPick: 'Postgres (partitioned by date)',
      alternatives: 'CockroachDB, TiDB',
      whyPrimaryWins: 'Full ACID transactions with serializable isolation are non-negotiable for money - the one place in the system that cannot trade correctness for speed.',
    },
    {
      tier: 'Account State Cache',
      purpose: 'Fast buying-power and exposure reads for pre-trade risk checks',
      primaryPick: 'Redis Cluster',
      alternatives: 'Memcached',
      whyPrimaryWins: "Sub-ms reads keep risk checks off the ACID ledger's critical path while still reflecting the account's own last action synchronously.",
    },
    {
      tier: 'Portfolio Store',
      purpose: 'User holdings, cash, and P&L for read-heavy portfolio views',
      primaryPick: 'Postgres (CQRS read replica)',
      alternatives: 'DynamoDB, ScyllaDB',
      whyPrimaryWins: "Reads outnumber writes heavily on this path; a replica absorbs portfolio-screen traffic without contending with the ledger's write path.",
    },
    {
      tier: 'Market Data Fan-Out',
      purpose: 'Broadcast quote/depth updates to hundreds of thousands of connected clients',
      primaryPick: 'Kafka + WebSocket gateway fleet',
      alternatives: 'Redis Pub/Sub, SNS + SQS fan-out',
      whyPrimaryWins: 'One publish per tick regardless of subscriber count, with fan-out pushed down to a horizontally-scaled, stateless edge tier that never touches the matching engine.',
    },
  ],
  technologyChoicesNote:
    "Why Postgres over a NoSQL store for the ledger? Orders are relational (order -> fills -> settlements) and need ACID transactions for balance deductions, and regulators need complex audit queries that a wide-column store can't answer - the matching engine gets its speed from in-memory structures, not from the database. Why Kafka for the order and execution logs? Orders need event replay for reconciliation and partitioning by symbol for ordered matching, and a log-based model lets multiple independent consumers (ledger, market data, notifications) read the same stream without coupling to each other.",

  scaleEstimation: [
    'Accounts: 5M active accounts; ~2% (100K) trade on a typical day, placing ~3 orders each - about 300K orders/day',
    'Order write throughput: ~13 orders/sec average over a 6.5-hour session, but open/close bursts hit 10-15x that - provision for 150-200 orders/sec per busy instrument cluster, headroom to 1,500+/sec platform-wide',
    'Market data fan-out: 5,000 actively watched symbols streamed to 500K concurrently connected clients at a few updates/sec each - hundreds of thousands of messages/sec at the WebSocket gateway tier',
    'Order/execution storage: ~500 bytes/record x 300K/day ≈ 150MB/day, ~55GB/year - tiny in volume, but must be immutable and retained 7 years for audit',
    'Ledger writes: every execution posts at least 2 ledger lines (double-entry) plus a position update - roughly 2-3x the raw execution rate in ledger row writes',
    'Read QPS: portfolio/balance reads dominate - 50K+ reads/sec at peak from app screens refreshing on every price tick',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/orders',
      description: 'Submit a market, limit, or stop order. Idempotency key required so retried submissions never duplicate an order.',
      example:
        '// Request\n{ "accountId": "a_5521", "symbol": "AAPL", "side": "buy", "type": "limit", "qty": 10, "limitPrice": 150.25, "idempotencyKey": "ord_88af1" }\n\n// Response 202 Accepted\n{ "orderId": "o_44210", "status": "accepted" }',
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
      description: 'Fetch current order status, filled quantity, and remaining quantity.',
      example: '// Response 200\n{ "orderId": "o_44210", "status": "partially_filled", "filledQty": 4, "remainingQty": 6 }',
    },
    {
      method: 'GET',
      path: '/v1/accounts/{accountId}/portfolio',
      description: "Return an account's real-time positions, cash balance, and buying power.",
      example:
        '// Response 200\n{ "cash": 12500.50, "settledCash": 9800.00, "buyingPower": 24800.00, "positions": [ { "symbol": "AAPL", "qty": 25, "avgCost": 148.10 } ] }',
    },
    {
      method: 'GET',
      path: '/v1/instruments/{symbol}/book',
      description: 'Return a snapshot of current order book depth (top N price levels per side).',
      example: '// Response 200\n{ "symbol": "AAPL", "bids": [ { "price": 150.24, "qty": 400 } ], "asks": [ { "price": 150.26, "qty": 250 } ] }',
    },
    {
      method: 'WS',
      path: '/v1/market-data/{symbol}/stream',
      description: 'Subscribe to real-time quote, depth, and last-trade updates for a symbol.',
      example: '// Server push\n{ "type": "quote", "symbol": "AAPL", "bid": 150.24, "ask": 150.26, "last": 150.25 }',
    },
    {
      method: 'WS',
      path: '/v1/accounts/{accountId}/stream',
      description: 'Subscribe to real-time order status, fill, and portfolio updates for the authenticated account.',
      example: '// Server push\n{ "type": "fill", "orderId": "o_44210", "filledQty": 6, "avgFillPrice": 150.25 }',
    },
  ],
  apiSecurityNote:
    "accountId is always derived from the authenticated session token, never trusted from the request body. Every order-mutating call requires an idempotency key, checked server-side against a store keyed by (accountId, idempotencyKey) before the order ever reaches risk checks. WebSocket streams authenticate once at connect time and are scoped to the account's own data; market-data streams are read-only and rate-limited per connection to stop a client from silently subscribing to thousands of symbols and starving the fan-out tier.",

  highLevelDesignIntro:
    "Let's build this incrementally, one functional requirement at a time: get an order safely and durably accepted, match it against a live book, settle the resulting trade correctly, stream the outcome (and everyone else's market data) back out in real time, and finally handle cancels/modifies without racing the matcher.",

  builds: [
    {
      title: '1) Accept an Order Safely - Risk Check, Then a Durable Ordered Log',
      body:
        "A user submits a limit buy for 10 shares of AAPL at $150.25. Before this order can touch a matching engine, two things must happen in order: we must know the account can actually afford it (or has the shares to sell), and we must durably record that this order was ever submitted, in the exact order it arrived, before we do anything else with it.\n\nWhy risk check first: letting an order that would overdraw an account anywhere near the matching engine means a bug or race in risk logic can directly create phantom buying power - a financial loss, not a display glitch. Why the durable log second, before matching: if the process accepting orders crashes after telling the client \"accepted\" but before matching ever sees the order, that order must still exist somewhere durable, or we've silently lost a trade a client believes they placed.\n\nThe log is not just a queue - it is the entire source of truth for \"what orders exist and in what order they arrived.\" This is the piece that makes both correctness and regulatory replay possible without slowing down matching itself.",
      insightCallout:
        "The order log is partitioned per instrument (or per instrument-shard for very liquid names). This guarantees the Matching Engine consuming a partition sees orders for that instrument in the exact order they were accepted - which is the entire input to price-time priority. Cross-instrument ordering does not matter and is never assumed anywhere in the design.",
      newComponents: [
        { name: 'Order Gateway', description: 'Authenticates the request, validates shape (symbol exists, qty > 0, price present for limit orders), and checks the idempotency key before anything else happens.' },
        {
          name: 'Risk/Margin Service',
          description:
            "Checks buying power, existing open-order exposure, margin requirements, and account restrictions (e.g. pattern-day-trader rules) against a fast, synchronously-updated view of account state - not the slow ledger of record.",
        },
        { name: 'Account State Cache (Redis, per-account)', description: "Holds each account's current buying power and open-order exposure. Updated synchronously the instant an order is accepted or an execution/cancel changes exposure, so risk checks always read state at least as current as the account's own last action." },
        { name: 'Order Log (Kafka, partitioned per instrument)', description: 'A durable, strictly-ordered append log. The single source of truth for order arrival order - not a transient queue that can be replayed and forgotten.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  CLIENT["Client App"]:::client
  GW["Order Gateway"]:::edge
  RISK["Risk/Margin Service"]:::compute
  CACHE[("Account State Cache<br/>Redis")]:::cache
  LOG[["Order Log<br/>Kafka, per-instrument"]]:::async

  CLIENT -->|"1. POST /orders + idempotency key"| GW
  GW -->|"2. Check idempotency key"| CACHE
  GW -->|"3. Forward for risk check"| RISK
  RISK -->|"4. Read buying power + exposure"| CACHE
  RISK -->|"5. Reserve exposure"| CACHE
  RISK -->|"6. Pass -> append order"| LOG`,
      },
      steps: [
        'Client calls POST /v1/orders with an Idempotency-Key header - Order Gateway checks (accountId, idempotencyKey) against the cache; a repeat returns the original response with zero side effects',
        'Order Gateway validates shape and forwards to the Risk/Margin Service',
        "Risk service reads the account's current buying power and open-order exposure from the Account State Cache (not the ledger of record - too slow for the hot path)",
        'If the order would exceed buying power, margin, or position limits, it is rejected immediately with a 400 and never reaches the log',
        "If it passes, risk service atomically reserves the order's notional against the account's exposure in the cache (so a second concurrent order from the same account sees the reservation), then the Order Gateway appends the order to the per-instrument partition of the Kafka order log",
        'Order Gateway returns 202 Accepted the moment the append is durably acknowledged by Kafka - not before',
      ],
      closingNote:
        "Why reserve exposure before appending, not after matching? Two orders from the same account submitted milliseconds apart must not both pass a buying-power check that only one can actually satisfy - covered in depth later. Why 202, not 200? The order is accepted for processing, not yet matched; the client's UI shows \"working\" and later receives a WebSocket push when it fills, exactly like the async-settlement pattern in the wallet design, except here the async step is milliseconds, not seconds.",
    },
    {
      title: '2) Match the Order - Price-Time Priority Per Instrument',
      body:
        "The Matching Engine is a single-threaded, in-memory process per instrument (or per instrument-shard) that consumes its Kafka partition strictly in order and maintains that instrument's live order book. Single-threaded is a deliberate choice, not a limitation we haven't fixed yet: it eliminates locking entirely, which is what lets matching run in microseconds instead of milliseconds, and it makes the sequence of matches trivially reproducible for audit.\n\nThe book itself is two sorted structures - bids and asks - ranked first by price (best price wins) and, within the same price, by arrival time (first in, first matched). A resting limit order sits in a FIFO queue at its price level until a compatible order arrives on the other side.",
      insightCallout:
        "The Matching Engine holds no state that isn't derivable from the order log. Its entire durable identity is \"my Kafka offset plus my last snapshot.\" A crash-and-restart replays from the last committed offset, reconstructing the exact book it had a moment before - this is what makes exactly-once-in-effect processing possible without a distributed transaction.",
      newComponents: [
        {
          name: 'Matching Engine (per-instrument, single-threaded)',
          description: "Consumes its instrument's Kafka partition in order, maintains the live order book in memory, and produces Execution events when a buy and sell cross.",
        },
        { name: 'Order Book (in-memory)', description: 'Price-level map per side (bid/ask), each level a FIFO queue of resting orders, giving O(log P) access to the best price and O(1) matching within a level.' },
        { name: 'Snapshot Store', description: 'Periodic serialized snapshots of each order book, so recovery replays only the log entries since the last snapshot rather than the entire history.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  LOG[["Order Log<br/>Kafka, per-instrument"]]:::async
  MATCHER["Matching Engine<br/>single-threaded per instrument"]:::compute
  BOOK[("Order Book<br/>in-memory")]:::compute
  SNAP[("Snapshot Store")]:::storage
  EXECLOG[["Execution Log<br/>Kafka"]]:::async

  LOG -->|"1. Consume in partition order"| MATCHER
  MATCHER -->|"2. Update book"| BOOK
  MATCHER -->|"3. Periodic snapshot"| SNAP
  MATCHER -->|"4. Emit execution event"| EXECLOG`,
      },
      steps: [
        "Matching Engine reads the next order off its instrument's partition - a limit buy for 10 AAPL @ $150.25",
        'It checks the ask side: is there a resting sell at $150.25 or below? If the best ask is $150.26, no match - the order rests on the bid side at the $150.25 level, appended to the end of that FIFO queue',
        'If a compatible resting sell exists (say 6 shares @ $150.24 from an earlier order), the engine matches greedily: 6 shares execute at the resting order\'s price ($150.24 - price-time priority means the resting order\'s price wins), leaving 4 shares of the incoming buy still unfilled',
        'The engine continues walking the ask side until the incoming order is fully filled or no more compatible asks exist at an acceptable price - any unfilled remainder rests on the book',
        'Every match produces an Execution event (price, quantity, buy order id, sell order id, timestamp) appended to a separate Execution Log (also Kafka), which is the input to settlement, market data, and notifications',
        'Cancels and modifies are themselves messages on the same per-instrument partition, processed in the same strict order as new orders - never as a side-channel that could race the matcher',
      ],
      closingNote:
        "Why is the resting order's price used, not the incoming order's? This is the standard exchange convention: the order that was there first sets the trade price, which is also why time priority matters within a price level - it determines who gets filled first when a large incoming order can't fill everyone at that price.",
    },
    {
      title: '3) Settle the Trade - the Ledger Is Its Own Strict World',
      body:
        "An Execution event is not the same thing as money moving. The Ledger/Settlement Service consumes the Execution Log and, in one ACID transaction per execution, posts a balanced double-entry journal entry, updates the buyer's and seller's positions, and adjusts each account's available buying power. Crucially, cash does not become fully \"theirs\" the instant the trade executes - most equity markets settle T+1, so the ledger tracks two parallel views: settled balance (what has formally cleared with the custodian) and available buying power (which can include a portion of unsettled proceeds under specific rules, capped to prevent free-riding).",
      insightCallout:
        "This is the one place in the whole system that mirrors the digital-wallet design's rigor almost exactly: money correctness requires the same double-entry discipline whether the source of the transaction is a peer-to-peer transfer or a stock trade. The difference is just what's on the two sides of the entry - cash and a position, instead of cash and cash.",
      newComponents: [
        { name: 'Ledger/Settlement Service', description: "Consumes the Execution Log and posts balanced double-entry journal entries per fill - the one component in the system that runs full ACID transactions with serializable isolation on the account it touches." },
        { name: 'Postgres (Ledger of Record)', description: 'Append-only journal_entries and ledger_lines tables. The truth for cash, positions, settled balance, and buying power.' },
        { name: 'Clearing/Custodian Adapter', description: "Talks to the clearing house/custodian for the actual T+1/T+2 settlement of cash and share ownership, and reports back when a trade formally clears." },
      ],
      diagram: {
        mermaid: `flowchart LR
  EXECLOG[["Execution Log<br/>Kafka"]]:::async
  LEDGER["Ledger/Settlement Service"]:::compute
  PG[("Postgres<br/>ledger of record")]:::database
  CACHE[("Account State Cache<br/>Redis")]:::cache
  CLEAR["Clearing/Custodian Adapter"]:::edge
  CUSTODIAN["Custodian / Clearing House"]:::edge

  EXECLOG -->|"1. Consume execution"| LEDGER
  LEDGER -->|"2. Post balanced journal entry"| PG
  LEDGER -->|"3. Refresh buying power"| CACHE
  LEDGER -->|"4. Notify pending settlement"| CLEAR
  CLEAR -->|"5. Confirm T+1 settlement"| CUSTODIAN
  CUSTODIAN -->|"6. Settlement confirmed"| CLEAR
  CLEAR -->|"7. Move pending -> settled"| PG`,
      },
      steps: [
        'Ledger service consumes an Execution event: buyer bought 10 AAPL @ $150.25 from seller',
        'In one DB transaction: DEBIT buyer_cash $1502.50, CREDIT buyer_position:AAPL 10 shares (pending settlement); mirrored entries CREDIT seller_cash $1502.50 (pending), DEBIT seller_position:AAPL 10 shares',
        "Buyer's available buying power drops immediately (they can't spend money twice), but their settled cash balance does not change until settlement confirms - this is the buying-power-vs-settled split",
        "Ledger refreshes the buyer's and seller's Account State Cache entries so the next risk check sees accurate exposure within milliseconds",
        'Clearing/Custodian Adapter reports the trade for T+1 settlement; a day later the custodian confirms and a follow-up journal entry moves the position and cash from pending to settled',
        'If settlement fails or is reversed (rare, but happens - a busted trade), a compensating journal entry unwinds the pending entries; because the ledger is append-only, this is a new entry, never an edit to history',
      ],
      closingNote:
        "Why not just wait for settlement to show the user their new position? Because a user who just bought AAPL expects to see it in their portfolio immediately - hiding it for a day would be a broken product experience, and it isn't necessary: the buying-power/settled-balance split lets us show the position right away while still being financially honest about what has and hasn't formally cleared.",
    },
    {
      title: '4) Stream Real-Time Market Data and Fills to Millions of Clients',
      body:
        "Two very different real-time streams leave this system: a per-account stream (order status, fills, portfolio value - must reach exactly the right user) and a public market-data stream (quotes, depth, last price for a symbol - broadcast to every client watching that symbol, potentially hundreds of thousands of them). Both are deliberately kept off the matching engine's critical path: a slow or disconnected client must never be able to add latency back into matching.",
      insightCallout:
        "The Matching Engine never talks to a client connection directly, not even indirectly through a synchronous call. It only ever publishes an event to a topic. Everything from there - fan-out, WebSocket delivery, per-client filtering - lives in a separate tier that can degrade, lag, or even fall over without affecting whether trades match correctly.",
      newComponents: [
        { name: 'Market Data Service', description: 'Consumes Execution and order-book-delta events, maintains the public best-bid/ask/last-price view per symbol, and republishes it to a pub/sub layer.' },
        { name: 'Market Data Pub/Sub (topic per symbol)', description: 'A broadcast layer (e.g. Kafka or Redis Pub/Sub depending on fan-out shape) that decouples "a price changed" from "how many clients care."' },
        { name: 'Market Data Gateway (WebSocket fleet)', description: 'Holds millions of long-lived WebSocket connections, subscribes to the symbols each client is watching, and pushes updates. Horizontally scaled and stateless beyond the subscription set.' },
        { name: 'Notification/Fill Service', description: "Consumes execution events matching a specific account and pushes a targeted fill notification over that account's private WebSocket stream." },
      ],
      diagram: {
        mermaid: `flowchart LR
  EXECLOG[["Execution Log<br/>Kafka"]]:::async
  MDS["Market Data Service"]:::compute
  PUBSUB[["Market Data Pub/Sub<br/>topic per symbol"]]:::async
  MDGW["Market Data Gateway<br/>WebSocket fleet"]:::edge
  NOTIF["Notification/Fill Service"]:::compute
  CLIENTA["Client A<br/>watching AAPL"]:::client
  CLIENTB["Client B<br/>owns the order"]:::client

  EXECLOG -->|"1. Consume execution + book delta"| MDS
  MDS -->|"2. Publish updated quote"| PUBSUB
  PUBSUB -->|"3. Fan out to subscribers"| MDGW
  MDGW -.->|"4. WebSocket push"| CLIENTA
  EXECLOG -->|"5. Consume execution for this account"| NOTIF
  NOTIF -.->|"6. Private WebSocket push"| CLIENTB`,
      },
      steps: [
        'Matching Engine emits an execution and, separately, a book-delta event ("new best bid is $150.25, 400 shares deep") whenever the top of book changes - both go to Kafka, never to a client directly',
        'Market Data Service maintains the authoritative current quote/depth per symbol in memory and republishes only the delta (not the full book) to that symbol\'s pub/sub topic - most updates are tiny',
        'Market Data Gateway nodes each hold a large pool of WebSocket connections; on client subscribe, a node joins the pub/sub topic for that symbol and begins forwarding updates to every connection subscribed to it - one publish serves however many clients are watching, no per-client fan-out cost at the source',
        'A client disconnecting or falling behind on reads only affects that one WebSocket - a slow reader gets backpressure or is dropped and reconnects, and cannot stall the topic for anyone else',
        'In parallel, the Notification/Fill Service consumes the same Execution Log but filters to events touching a specific accountId, pushing a private fill update only to that user\'s own WebSocket connection',
        "Portfolio value shown in the app is computed client-side (or by a thin aggregator) from the account's positions plus the latest streamed quotes - it is not a separately computed and pushed value, avoiding yet another fan-out path",
      ],
      closingNote:
        "Why not just let clients poll a REST endpoint for quotes? At 500K concurrently active clients wanting sub-second freshness, polling means millions of redundant reads per second hitting the same handful of hot symbols. Pub/sub inverts the cost: one price change, one publish, fan-out done by a tier built for exactly that job, not by the price-computing service itself.",
    },
    {
      title: '5) Cancel and Modify - Racing the Matcher Safely',
      body:
        "A cancel or modify request has one hard requirement: it must never race a resting order that has already started matching. Because the same per-instrument Kafka partition carries both new orders and cancel/modify requests, and the Matching Engine processes that partition strictly in order, a cancel is just another message that gets sequenced relative to everything else touching that instrument - there is no separate fast path that could jump ahead of a match already in flight.",
      insightCallout:
        "We don't try to \"pull\" an order out of the book optimistically from the API layer. The cancel is appended to the log and the Matching Engine is the only thing allowed to remove an order from its own in-memory book - this is what makes the 409 \"already matching\" response correct instead of a guess.",
      steps: [
        'Client calls DELETE /v1/orders/{orderId} - Order Gateway looks up which instrument partition the order lives on and appends a CANCEL message to that same partition',
        "Matching Engine processes messages strictly in arrival order: if the CANCEL is read before the order has matched, the engine removes it from the book and emits an order.cancelled event - risk service releases the reserved exposure",
        "If the order already matched (fully or partially) by the time the CANCEL is processed, the engine emits an order.cancel_rejected event for any unfilled remainder that no longer exists, or applies the cancel only to whatever quantity is still resting",
        'Modify (e.g. changing price) is implemented as an atomic cancel-then-replace within the same log message, processed as one unit by the engine so there is never a window where the old order is gone but the new one isn\'t live yet',
      ],
      closingNote:
        "This is the same principle as the job-scheduler's lazy cancellation via a flag, applied to an even stricter domain: you cannot forcibly delete a message that a downstream consumer may have already acted on, so the safe move is to let the single authoritative consumer (the Matching Engine) decide the outcome, and report back what actually happened rather than what the client hoped would happen.",
    },
  ],

  coreFlows: [
    {
      title: 'Order Submission to Fill (Full Path)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant G as Order Gateway
  participant R as Risk Service
  participant CA as Account Cache
  participant K as Order Log (Kafka)
  participant M as Matching Engine
  participant EL as Execution Log
  participant L as Ledger Service
  participant MD as Market Data Service
  participant N as Notification Service

  C->>G: POST /orders (limit buy, idempotencyKey)
  G->>CA: check idempotency key
  G->>R: forward for risk check
  R->>CA: read buying power + exposure
  R->>CA: reserve exposure for this order
  R->>K: append order (durable, per-instrument order)
  G-->>C: 202 Accepted
  K->>M: consume in partition order
  M->>M: match against resting book
  M->>EL: append execution event
  EL->>L: consume execution
  L->>L: post balanced journal entry (ACID)
  L->>CA: refresh buying power
  EL->>MD: consume execution + book delta
  MD-->>C: WebSocket quote/depth update
  EL->>N: consume execution for this account
  N-->>C: WebSocket fill notification`,
      },
      nonObviousFailure:
        "If the Order Gateway crashes after Kafka durably acknowledges the append but before the 202 reaches the client, the client sees a timeout and may retry with the same idempotency key. The retry is safe - the idempotency check at step 2 sees the key already reserved and returns the original acceptance instead of appending a second order - but the underlying order is still live and will fill exactly once regardless of how many times the client retries.",
    },
    {
      title: 'Order Cancellation Racing a Fill',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant G as Order Gateway
  participant K as Order Log (Kafka)
  participant M as Matching Engine
  participant EL as Execution Log

  C->>G: DELETE /orders/{id}
  G->>K: append CANCEL message (same partition as the order)
  Note over M,K: engine is mid-processing another incoming order
  M->>M: incoming sell crosses and fills the resting order first
  M->>EL: append execution event
  M->>K: consume CANCEL (arrives after the fill)
  M->>M: order no longer exists on book
  M->>EL: append order.cancel_rejected (already filled)
  EL-->>C: fill notification, not a cancel confirmation`,
      },
      nonObviousFailure:
        "The client sent the cancel first from its own perspective, but the Matching Engine only honors the order it observes in its partition, and that partition may have already delivered the crossing order before the cancel arrives. There is no way to make this race disappear - the correct behavior is to always let the engine's observed order win and clearly report back which outcome happened, rather than pretend the cancel raced successfully.",
    },
    {
      title: 'Order Lifecycle State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> ACCEPTED: risk check passed, logged
  ACCEPTED --> RESTING: no immediate match, sits on book
  ACCEPTED --> PARTIALLY_FILLED: matched against part of the book
  RESTING --> PARTIALLY_FILLED: later incoming order matches part
  RESTING --> FILLED: later incoming order matches all
  RESTING --> CANCELLED: cancel processed before any match
  PARTIALLY_FILLED --> FILLED: remainder matched
  PARTIALLY_FILLED --> CANCELLED: remainder cancelled
  ACCEPTED --> REJECTED: exchange/engine-level rejection
  FILLED --> [*]
  CANCELLED --> [*]
  REJECTED --> [*]`,
      },
      nonObviousFailure:
        'A CANCEL message that arrives after an order has already reached FILLED does not throw an error inside the engine - it simply produces a cancel_rejected event and the state machine never transitions. Callers must read the returned event, not assume a DELETE call succeeded just because the HTTP request itself returned 200.',
    },
  ],

  deepDives: [
    {
      title: 'How Do We Match Orders Fairly and Fast? (Price-Time Priority Internals)',
      problem:
        "The order book must resolve two competing pressures: it needs to enforce a fair, auditable matching rule (best price first, then first-come-first-served) and it needs to do this at microsecond-to-low-millisecond latency under 10-20x burst load. Naive designs either sacrifice fairness for speed or speed for fairness.",
      simpleTerms:
        "Think of a deli counter with a take-a-number system, but for each price. If two people want to sell at $150.25, whoever pulled a ticket first gets matched first. The 'ticket' is just the order in which we durably logged the order.",
      bad:
        "Store all resting orders in a flat list and scan it for a match on every incoming order. O(N) per order, and worse, if two threads are allowed to touch the book at once, you get lost updates or a match applied twice under concurrency.",
      good:
        "A sorted structure per side (bids and asks), typically a balanced tree or sorted array of price levels, gives O(log P) access to the best price. Each level holds an ordinary queue of orders. This is correct and reasonably fast for moderate volume, but if multiple threads or processes can touch the same book concurrently, you're back to needing locks, and lock contention on a hot instrument reintroduces exactly the latency problem this structure was supposed to solve.",
      great:
        "Single-threaded ownership per instrument, backed by a durable input log, is the pattern real exchanges and LMAX-style systems converge on. Each instrument (or shard of very liquid instruments) is pinned to exactly one matching-engine thread/process - no locks are needed because nothing else is ever allowed to touch that book. The price-level map holds a FIFO queue per level, giving O(log P) best-price lookup and O(1) matching within a level. Because the engine only ever consumes its own Kafka partition in order, the sequence of matches is entirely deterministic and can be replayed byte-for-byte from the log for audit or disaster recovery.\n\nThe real cost of this design is that a single instrument's throughput is capped by one thread - covered in the meme-stock deep dive below - but the correctness and latency wins are large enough that virtually every serious matching engine, real or retail-broker-internal, makes this same trade.",
      diagram: {
        mermaid: `flowchart TD
  BOOK["Order Book: AAPL"]:::compute
  BIDTOP["Bids @ $150.25<br/>FIFO: o1, o2"]:::compute
  BIDNEXT["Bids @ $150.20<br/>FIFO: o3"]:::compute
  ASKTOP["Asks @ $150.30<br/>FIFO: o4, o5"]:::compute
  ASKNEXT["Asks @ $150.35<br/>FIFO: o6"]:::compute
  BOOK --> BIDTOP --> BIDNEXT
  BOOK --> ASKTOP --> ASKNEXT
  BIDTOP -.->|"price-time match"| ASKTOP`,
      },
    },
    {
      title: 'How Do We Guarantee an Order Is Never Lost or Matched Twice?',
      problem:
        "Financial correctness demands that a client retry after a network timeout never creates a duplicate order, and that a crash-and-restart of any service - Order Gateway, Matching Engine, Ledger - never loses or duplicates a match. True exactly-once delivery across a network boundary is impossible in the general case; the achievable goal is at-least-once delivery plus idempotent, replayable processing that behaves as exactly-once.",
      simpleTerms:
        "If your phone drops signal right after you tap 'buy' and you tap it again, the system needs to recognize 'oh, this is the same request' rather than buying the stock twice.",
      bad:
        "No idempotency key and no durable checkpoint. A retried HTTP request creates a second order; a crashed Matching Engine loses whatever was in memory and has no way to know what it had already processed.",
      good:
        "A client-supplied idempotency key checked against a store before an order is accepted, plus a Matching Engine that periodically snapshots its book to disk. This catches the common cases - most retries, most crashes - but leaves gaps: what if the crash happens between accepting the order and appending it to the log? What if the snapshot is stale by thousands of orders?",
      great:
        "The order log itself is the exactly-once mechanism, not a bolt-on check. The Order Gateway assigns and validates the idempotency key before the log append happens, so a retried submission is deduplicated at write time rather than relying on every downstream service to independently detect duplicates. The Matching Engine treats its Kafka offset as its entire durable identity - on restart it loads its last snapshot, then replays every log entry after that snapshot's offset, deterministically reconstructing the exact book state it had a moment before crashing, because processing a Kafka partition in order is itself a pure, deterministic function.\n\nThis means an order is either durably in the log (and will eventually be processed exactly once, however many times the engine restarts) or it never left the client - there is no in-between state where the system 'sort of' has it. The cost is that an order is not considered accepted until the log append is durably acknowledged, which trades a small amount of write latency for eliminating an entire category of lost-or-duplicated trades.",
    },
    {
      title: 'How Do We Run Pre-Trade Risk Checks Without Adding Latency?',
      problem:
        "Every order must be checked against buying power, margin, position limits, and account restrictions before it reaches the matching engine, but running this check against the slow, ACID-strict ledger of record on every single order would blow the latency budget entirely.",
      bad:
        "Query the ledger of record synchronously on every order: SELECT current_balance, open_orders FROM ledger WHERE account_id = ?. Correct, but each check now costs a full round trip to the strictly-consistent database, and under burst volume that database becomes the bottleneck for every order in the system, not just the ones touching money.",
      good:
        "Keep a fast, synchronously-updated cache (Redis) of each account's buying power and open-order exposure, refreshed the instant an order is accepted or an execution/cancel changes exposure. Risk checks read only from this cache. This is fast and correct for the common case, but it introduces a subtle race: two orders from the same account submitted milliseconds apart can both read the same buying-power snapshot before either has updated it.",
      simpleTerms:
        "We don't ask the slow, careful accountant every time someone wants to trade - we keep a fast running tally that updates immediately after every order, and only the accountant's books are the real truth.",
      great:
        "Serialize risk checks and exposure updates per account, on top of the fast cache. Every order from a given account is routed to the same risk-check worker (or protected by an account-level lock in the cache layer, e.g. a Redis Lua script that reads-checks-reserves atomically in one round trip). This means two concurrent orders from the same account cannot both pass a buying-power check that only one can actually satisfy - the second one sees the first's reservation and is correctly rejected or queued.\n\nCrucially, this serialization is scoped to a single account, not to the whole risk service - accounts are independent, so this adds essentially zero latency for the overwhelming majority of orders (a typical retail account places a handful of orders per day, never two in the same millisecond), while completely closing the race for the rare account that does submit concurrently. The reservation itself uses a short TTL and is released or converted into a real ledger update the moment the order resolves (fills, is rejected, or is cancelled), so a crashed risk-check worker can never permanently strand an account's buying power.",
    },
    {
      title: 'How Do We Model Cash, Positions, and Margin So We Never Create or Lose Money?',
      problem:
        "A naive 'balance column' approach - UPDATE accounts SET cash = cash - X - is the root cause of every 'my portfolio value is wrong' support ticket. It has no audit trail, no way to answer 'why did my buying power change,' and no natural way to represent that a trade has executed but not yet settled.",
      bad:
        "Two columns, cash and buying_power, both mutated directly by application code on every fill. Race conditions under concurrent fills on the same account, no way to reconstruct history, and every new feature (margin, pending settlement, dividends) means bolting on another ad-hoc column.",
      good:
        "An append-only ledger of {account, symbol, delta, reason, timestamp} rows, with cash and position quantity computed as running sums. This is a real improvement - it's auditable and append-only - but it still isn't double-entry: a single row records 'account X gained $500' with no corresponding row saying where the $500 came from, so the invariant 'total money in the system never changes, it only moves' is not mechanically enforced anywhere.",
      simpleTerms:
        "Every trade writes two balanced entries - one account's cash goes down exactly as much as their new position is worth, and the counterparty's mirror entries move the opposite way. If the two sides don't sum to zero, the database refuses to commit it, which makes it physically impossible to create or lose money.",
      great:
        "A full double-entry ledger with a chart of accounts, the same discipline a wallet or bank uses. journal_entries (id, execution_id, created_at) group ledger_lines (id, journal_entry_id, account_id, direction DEBIT|CREDIT, amount_cents, asset_type CASH|SHARES, created_at - append-only, never updated or deleted), referencing accounts of type USER_CASH, USER_POSITION:{symbol}, CASH_PENDING_SETTLEMENT, and POSITION_PENDING_SETTLEMENT.\n\nA buy of 10 AAPL @ $150.25 posts two mirrored journal entries at once: DEBIT user_cash $1502.50 / CREDIT cash_pending_settlement $1502.50 (cash is committed immediately but not yet formally paid to the seller's custodian), and DEBIT position_pending_settlement:AAPL 10 shares / CREDIT user_position:AAPL 10 shares (the position shows up in the user's portfolio right away, for product UX, while a parallel settled_position:AAPL account only updates a day later once the custodian confirms). buying_power is then computed as settled cash minus a margin-adjusted reservation for any position not yet settled, never as a single stored column.\n\nAn invariant enforced at every write: SUM(DEBIT) = SUM(CREDIT) for every journal entry, checked in the same transaction that writes the lines - if the math doesn't balance, the write is rejected outright. This is what makes 'where did this $500 go' always answerable (pull the journal entries referencing that execution_id), what makes daily reconciliation against the custodian mechanical rather than forensic, and what makes margin/buying-power calculations a pure function over the ledger rather than a pile of special-cased column updates.",
    },
    {
      title: 'How Do We Stream Real-Time Market Data to Millions of Connected Clients?',
      problem:
        "Every actively-watched symbol changes price potentially many times per second, and hundreds of thousands of clients may be watching the same handful of popular symbols simultaneously. Naively treating this as 'notify N clients on every price change' means the cost of a single price tick scales with the number of watchers, not with the number of ticks - the exact inversion of what a broadcast problem should look like.",
      bad:
        "Clients poll a REST endpoint for the latest quote every second. At 500K concurrently active clients, this is 500K redundant reads/sec hitting the same small set of hot symbols, and freshness is bounded by the poll interval, not by how fast the price actually changed.",
      good:
        "Move to WebSockets with a naive per-client fan-out: when a price changes, iterate over every connection subscribed to that symbol and push directly from the service that computed the new price. This removes the polling waste, but now the price-computing service itself is doing O(subscribers) work per tick - a hot symbol with 200K watchers turns every single price update into 200K outbound writes from one process, which does not scale and couples market-data delivery directly to matching-adjacent infrastructure.",
      simpleTerms:
        "Instead of the price-calculator personally mailing a letter to every single person who cares about AAPL, it posts one notice on a public bulletin board (a pub/sub topic), and a separate army of mail carriers (the WebSocket gateway fleet) who already know who's watching what deliver it from there.",
      great:
        "A pub/sub broadcast tier fully decoupled from the price-computing service, with fan-out pushed down to the edge. The Market Data Service, on consuming an execution or book-delta event, computes the new quote once and publishes a single message to that symbol's topic - its cost per tick is now O(1), independent of subscriber count. A horizontally-scaled fleet of stateless Market Data Gateway nodes each hold a large pool of long-lived WebSocket connections; each node subscribes only to the topics at least one of its connected clients cares about, and on receiving a topic message, fans it out to just its own local subscribers.\n\nThis means the total fan-out work (one write per client) still has to happen somewhere, but it happens at the edge tier that was built to scale horizontally for exactly this job, and it happens completely independently per gateway node - a slow client or a gateway node under load never touches the Market Data Service or, more importantly, the Matching Engine. A client that falls behind on reads gets backpressure or is disconnected and told to reconnect and resubscribe (fetching a fresh snapshot first) rather than being allowed to build an unbounded backlog that consumes memory on the gateway node forever.\n\nFor truly hot symbols (a viral meme stock with 200K simultaneous watchers), gateway nodes can further coalesce updates - if three price changes happen within the same 50ms window before a slow client's socket buffer drains, only the latest is sent, since a stale intermediate quote has no value to a human looking at a screen. This is safe specifically because market data is explicitly eventually-consistent and best-effort, unlike the ledger.",
      diagram: {
        mermaid: `flowchart LR
  EXECLOG[["Execution Log<br/>Kafka"]]:::async
  MDS["Market Data Service"]:::compute
  TOPIC[["Pub/Sub Topic<br/>per symbol"]]:::async
  GW1["Gateway Node 1"]:::edge
  GW2["Gateway Node 2"]:::edge
  GWN["Gateway Node N"]:::edge
  C1["Clients on Node 1"]:::client
  C2["Clients on Node 2"]:::client
  CN["Clients on Node N"]:::client

  EXECLOG -->|"1. Consume execution + delta"| MDS
  MDS -->|"2. Publish once per tick"| TOPIC
  TOPIC -->|"3. Fan out"| GW1
  TOPIC -->|"3. Fan out"| GW2
  TOPIC -->|"3. Fan out"| GWN
  GW1 -.->|"4. Push to local subscribers"| C1
  GW2 -.->|"4. Push to local subscribers"| C2
  GWN -.->|"4. Push to local subscribers"| CN`,
      },
    },
    {
      title: 'How Do We Handle a Single Instrument That Spikes 100x in Volume?',
      problem:
        "Pinning each instrument to a single matching-engine thread (the earlier deep dive's answer for correctness and speed) has an obvious cost: a viral meme-stock event can drive one instrument's order rate to 100x its normal level, and no amount of adding more matching-engine machines helps a single thread that owns one instrument's book.",
      bad:
        "Ignore the problem and let the hot instrument's queue grow unbounded. Acknowledgment latency for that one symbol silently balloons from milliseconds to seconds or worse, and because everything shares the same Kafka cluster, if operators aren't careful the hot partition's backlog can also start starving unrelated consumers reading from adjacent partitions on the same brokers.",
      good:
        "Isolate hot instruments onto dedicated matching-engine processes and dedicated Kafka partitions/brokers, so a runaway symbol's queue growth is contained to its own hardware and cannot degrade unrelated, calm instruments. This is a real mitigation used in production - most retail brokerages provision extra matching capacity for known high-volume names.",
      great:
        "Accept the bounded degradation as a deliberate trade-off, communicated end-to-end, rather than trying to eliminate it. A distributed, lock-based book that split one instrument across multiple workers was explicitly rejected earlier because it risks silent price-time-priority ordering bugs under contention - the actual failure mode of that approach is 'we might match orders in the wrong order and not notice for a while,' which is strictly worse than 'this one symbol is temporarily slower.'\n\nInstead: (1) proactively shard known-hot instruments onto their own dedicated matching processes and Kafka partitions ahead of anticipated events (earnings, IPOs), (2) monitor per-instrument queue depth and matching latency as a first-class metric, alerting well before user-visible degradation, (3) apply admission control at the Order Gateway for a specific instrument once its queue depth crosses a threshold - reject new orders for that symbol with a clear 'temporarily unable to accept orders, please retry' rather than silently queueing them behind an already-large backlog, which at least gives the client an honest, fast answer instead of a slow, misleading one, and (4) communicate the degraded state to the market-data stream too, so client apps can show 'order book delayed' banners rather than implying false real-time freshness.\n\nThis mirrors how real exchanges handle circuit breakers and trading halts on individual names - the system is explicitly designed to let one instrument degrade gracefully and visibly rather than pretend uniform performance is achievable at unbounded burst volume.",
    },
    {
      title: 'How Do We Settle Trades and Reconcile With the Custodian?',
      problem:
        "An execution happening inside our system is not the same as a trade being formally settled - cash and share ownership do not legally transfer until the custodian/clearing house confirms settlement, typically one business day later (T+1). If our ledger's view of 'settled' ever diverges from the custodian's actual records, that's either a bug, a custodian-side error, or something a regulator needs to see explained.",
      bad:
        "Trust our own ledger and assume settlement 'just happens' in the background with no active verification. Divergence is discovered only when a customer complaint or an audit surfaces it, by which point potentially thousands of trades have compounded on top of the broken state.",
      good:
        "Nightly batch reconciliation: pull the custodian's settlement report, compute our expected settled positions/cash from the ledger, and diff them, alerting on mismatch. This is legally required and catches real problems, but a 24-hour detection window means a systemic issue (a bad batch job, a custodian outage) can silently compound for a full day before anyone notices.",
      great:
        "Continuous, event-driven reconciliation layered on top of the nightly batch, not instead of it. Every execution's settlement status moves through an explicit state machine (EXECUTED -> PENDING_SETTLEMENT -> SETTLED, or -> SETTLEMENT_FAILED) and a reconciler polls the Clearing/Custodian Adapter for any execution stuck in PENDING_SETTLEMENT past its expected T+1 window, rather than waiting for an end-of-day batch to notice. When the custodian confirms settlement, that's an event that immediately posts the follow-up journal entry moving cash_pending_settlement to settled cash and position_pending_settlement to settled position - the same event-driven pattern used everywhere else in this design, not a separate one-off job.\n\nThe nightly batch remains as a second, independent layer of defense: pull the custodian's full settlement report, compute expected settled balances by summing the ledger, and diff line-by-line by execution reference, ticketing (not auto-fixing) any mismatch for a human to investigate. A daily liability report - SUM(all user_cash + user_position accounts) compared against what the custodian reports we're holding on behalf of clients - is the single number a regulator or auditor asks for, and it is only trustworthy because every ledger entry that produced it is immutable and traceable back to a specific execution.",
    },
  ],

  selfAudit: [
    {
      question: 'What happens if the matching engine crashes mid-match?',
      answer:
        "The matching engine holds no state that isn't derivable from the order log - on restart it replays from its last committed log offset plus its most recent in-memory snapshot, reconstructing the exact book state, so an in-flight match is either fully committed to the log (and thus recoverable) or never happened.",
    },
    {
      question: 'What if two orders from the same account race on a buying-power check?',
      answer:
        'Risk checks and exposure reservations for a single account are serialized - routed to one risk-check path or protected by an account-scoped atomic reservation - so two concurrent orders can never both pass a check that only one can actually satisfy.',
    },
    {
      question: 'What happens to a single meme-stock instrument that spikes order volume 100x?',
      answer:
        "Because each instrument is pinned to one matching-engine thread for correctness, that instrument's queue grows and its acknowledgment latency degrades in a contained, monitored way - a known, bounded limitation preferred over a distributed lock-based book that risks silent ordering bugs, with admission control kicking in before the backlog becomes unbounded.",
    },
    {
      question: 'How do you prevent a client from being charged for the same order twice after a network retry?',
      answer:
        "The Order Gateway checks an idempotency key before the order ever reaches the log, so a retried submission with the same key returns the original order's status rather than creating a second order.",
    },
    {
      question: 'How does market data fan-out avoid melting under a viral symbol with 200K watchers?',
      answer:
        'The price-computing service publishes exactly once per tick regardless of subscriber count; fan-out to individual WebSocket connections happens at a horizontally-scaled, stateless gateway tier that can coalesce updates for slow clients without ever touching the matching or ledger paths.',
    },
    {
      question: 'How would you reconcile a settlement mismatch discovered a day after trades executed?',
      answer:
        'Because the ordered log and every execution/ledger transition are immutably retained for audit, the mismatch can be traced by replaying the exact sequence of executions and ledger postings for the affected account against the durable log, rather than trusting only the current ledger snapshot.',
    },
    {
      question: 'Why does buying power drop immediately but settled cash lag a day behind?',
      answer:
        "Buying power must reflect committed exposure the instant an order fills, so a user can never spend the same money twice, but the cash has not formally settled with the custodian yet - modeling these as two separate ledger views (pending vs. settled) lets both be true and correct at once."
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  CLIENT["Client Apps"]:::client

  subgraph "Order Acceptance"
    GW["Order Gateway"]:::edge
    RISK["Risk/Margin Service"]:::compute
    CACHE[("Account State Cache<br/>Redis")]:::cache
  end

  subgraph "Matching"
    LOG[["Order Log<br/>Kafka, per-instrument"]]:::async
    MATCHER["Matching Engine<br/>single-threaded per instrument"]:::compute
    SNAP[("Snapshot Store")]:::storage
    EXECLOG[["Execution Log<br/>Kafka"]]:::async
  end

  subgraph "Money"
    LEDGER["Ledger/Settlement Service"]:::compute
    PG[("Postgres<br/>ledger of record")]:::database
    CLEAR["Clearing/Custodian Adapter"]:::edge
    CUSTODIAN["Custodian / Clearing House"]:::edge
  end

  subgraph "Real-Time Fan-Out"
    MDS["Market Data Service"]:::compute
    TOPIC[["Market Data Pub/Sub"]]:::async
    MDGW["Market Data Gateway<br/>WebSocket fleet"]:::edge
    NOTIF["Notification/Fill Service"]:::compute
  end

  AUDIT[("Audit Store<br/>7-year retention")]:::storage

  CLIENT -->|"POST/DELETE orders"| GW
  GW -->|"check idempotency"| CACHE
  GW -->|"forward for risk check"| RISK
  RISK -->|"read + reserve exposure"| CACHE
  RISK -->|"pass -> append"| LOG
  LOG --> MATCHER
  MATCHER -->|"snapshot"| SNAP
  MATCHER -->|"execution event"| EXECLOG
  MATCHER -->|"orders + executions"| AUDIT

  EXECLOG --> LEDGER
  LEDGER -->|"balanced journal entry"| PG
  LEDGER -->|"refresh buying power"| CACHE
  LEDGER -->|"report for settlement"| CLEAR
  CLEAR -->|"confirm T+1"| CUSTODIAN
  CUSTODIAN -->|"settlement confirmed"| CLEAR
  CLEAR -->|"settled entry"| PG

  EXECLOG --> MDS
  MDS -->|"publish quote/depth"| TOPIC
  TOPIC --> MDGW
  MDGW -.->|"WebSocket quotes"| CLIENT

  EXECLOG --> NOTIF
  NOTIF -.->|"fill notification"| CLIENT`,
    bullets: [
      'Client submits or cancels an order - Order Gateway checks idempotency, forwards to Risk/Margin Service for a buying-power/margin check against the fast Account State Cache',
      'Orders that pass risk are appended to a durable, per-instrument-partitioned order log (Kafka) - this log is the sole source of truth for order arrival order',
      'The Matching Engine, single-threaded per instrument, consumes its partition in order, maintains an in-memory order book, and emits Execution events on a separate log',
      'The Ledger/Settlement Service consumes executions and posts balanced double-entry journal entries to Postgres, distinguishing settled balance from available buying power',
      'A Clearing/Custodian Adapter tracks T+1/T+2 settlement and posts follow-up entries when cash/shares formally clear',
      'The Market Data Service computes quote/depth updates once per tick and publishes to a pub/sub topic; a horizontally-scaled WebSocket gateway fleet fans out to millions of connections',
      'A Notification/Fill Service delivers per-account order and fill updates over a private WebSocket stream, decoupled from the public market-data path',
      'Every order and execution is durably retained in an append-only audit store for 7-year regulatory record-keeping and replay',
    ],
  },

  keyTechnologies: [
    { term: 'Price-Time Priority', definition: 'Order book ranking rule: best price matches first, and among orders at the same price, the earliest-arrived order matches first.' },
    { term: 'Order Book', definition: 'A per-instrument structure of price levels, each holding a FIFO queue of resting orders, split into a bid side and an ask side.' },
    { term: 'Sequenced Event Log', definition: 'A durable, strictly-ordered append log (a Kafka partition per instrument) treated as the single source of truth for order arrival order and state transitions.' },
    { term: 'Idempotency Key', definition: 'A client- or server-assigned unique token attached to a request so retried submissions are deduplicated rather than double-processed.' },
    { term: 'Double-Entry Ledger', definition: 'Accounting model where every money/position movement creates balanced debit and credit entries that sum to zero - money can never be created or destroyed.' },
    { term: 'Buying Power', definition: "An account's available capacity to place new orders, computed from settled cash, margin, and existing open-order exposure - distinct from settled balance." },
    { term: 'T+1/T+2 Settlement', definition: 'The regulatory delay between a trade executing and cash/shares formally changing custodial ownership.' },
    { term: 'Pub/Sub Fan-Out', definition: 'A broadcast pattern where a publisher writes once per event and a separate, horizontally-scaled tier handles delivery to however many subscribers exist, decoupling publish cost from subscriber count.' },
    { term: 'Single-Threaded Business Logic Processor', definition: 'A per-shard (here, per-instrument) processing model with no internal locking, trading horizontal scalability of a single shard for deterministic, replayable correctness.' },
    { term: 'Kafka', definition: 'Distributed, partitioned log used both as the durable order/execution source of truth and as the transport for market-data and notification fan-out.' },
  ],

  expectedDepth: {
    mid:
      'Explain that orders need to be matched against a live order book and that account balances must update correctly. Propose a relational database with transactions for correctness. Understand at a basic level why price and time matter when matching two orders, and why showing a stale balance is worse than showing a stale stock price.',
    senior:
      'Articulate why a single relational database with row locks cannot sustain matching at scale, and propose separating a fast in-memory matching engine from a durable order log. Discuss idempotency keys for exactly-once order submission, why risk checks must be serialized per account, and the difference between a trade executing and settling (T+1/T+2). Propose a pub/sub layer for market data instead of per-client polling.',
    staffPlus:
      "Design the full split between the sequenced log as source of truth, a deterministic replayable matching engine, and a strictly-ACID double-entry ledger, articulating why these need fundamentally different consistency models. Address hot-instrument scaling limits inherent to single-threaded-per-instrument matching and why that trade is accepted over a distributed lock-based book. Design the market-data fan-out tier as a genuinely separate scaling problem from matching. Discuss regulatory audit/replay requirements, continuous settlement reconciliation with a custodian, and how all of this shapes the choice of an event-sourced architecture over a simpler CRUD design.",
  },

  keyTakeaways: [
    'The order log, not the matching engine, is the actual source of truth - the engine is just a deterministic, replayable function over it',
    "Matching speed and ledger correctness need fundamentally different consistency models; keep them as separate systems connected by events, never one shared transaction",
    'Fail closed on the order path - a trading system optimizes for correctness first, availability second',
    'Price-time priority plus single-threaded-per-instrument matching trades bounded hot-instrument latency for zero ordering bugs',
    'Buying power (immediate) and settled balance (T+1/T+2) must be modeled as two distinct ledger views, not one balance field',
    'Market-data fan-out to millions of clients is a broadcast problem solved with pub/sub and a horizontally-scaled edge tier - it must never sit on the matching engine\'s critical path',
  ],

  relatedDesigns: ['digital-wallet', 'real-time-leaderboard', 'notification-system'],
  relatedConcepts: [
    { name: 'Event Sourcing & CQRS', description: 'An append-only order/execution log is the source of truth; the order book and ledger are derived, replayable views over it.' },
    { name: 'Idempotency', description: 'Retried order submissions never create duplicate orders or double fills.' },
    { name: 'Distributed Locking', description: 'Account-scoped serialization prevents concurrent orders from both passing a buying-power check only one can satisfy.' },
    { name: 'Pub/Sub Fan-Out', description: 'Decouples market-data publish cost from the number of clients watching a symbol.' },
    { name: 'Database Replication', description: 'Keeps the ledger of record durable and available for reads without slowing down the write path.' },
  ],

  simulator: {
    goalDescription: 'Accept orders safely, match them against a live per-instrument order book, and keep account balances strongly consistent while streaming market data to millions of viewers.',
    requirementChips: ['Exactly-once order processing', '50K reads/sec + 1.5K orders/sec', 'Order ack latency in the tens of ms', 'Zero dropped orders at 10-20x burst'],
    targetRps: 50000,
    readRatio: 0.97,
    cacheHitRatio: 0.75,
    latencyBudgetMsP99: 40,
    rubric: [
      { id: 'order-log', label: 'Durable ordered log for orders/executions (Kafka)', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'account-cache', label: 'Fast account-state cache for risk checks (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'ledger-db', label: 'ACID ledger of record', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'compute-tier', label: 'Compute tier for risk checks and matching', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-point', label: 'No single point of failure on the order path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'risk-1', type: 'microservice', instanceCount: 6, position: { x: 600, y: 120 } },
        { id: 'matcher-1', type: 'worker', instanceCount: 10, position: { x: 600, y: 280 } },
        { id: 'cache-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 8, position: { x: 880, y: 280 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 15, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-risk', source: 'gw-1', target: 'risk-1' },
        { id: 'e-risk-cache', source: 'risk-1', target: 'cache-1' },
        { id: 'e-risk-kafka', source: 'risk-1', target: 'kafka-1' },
        { id: 'e-kafka-matcher', source: 'kafka-1', target: 'matcher-1' },
        { id: 'e-matcher-kafka', source: 'matcher-1', target: 'kafka-1' },
        { id: 'e-kafka-ledger', source: 'kafka-1', target: 'pg-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Risk checks reserve exposure against a fast Redis cache before an order is appended to a durable per-instrument Kafka log; a single-threaded matching engine consumes that log and emits executions back onto Kafka, which the ledger service consumes to post ACID double-entry journal entries to Postgres.',
    failureModeNarratives: {
      'api-gateway': "Only one Order Gateway instance sits on the critical path for every order; if it goes down, no order can even reach a risk check or the durable log, let alone get matched.",
    },
    fullDesignLinkSlug: 'stock-broker',
  },
}

export default topic
