import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'digital-wallet',
  title: 'Digital Wallet (PhonePe / Venmo)',
  difficulty: 'Advanced',
  icon: 'pi pi-wallet',
  color: '#10b981',
  readTimeMinutes: 30,
  topics: ['Double-Entry Ledger', 'Idempotency', 'Reconciliation'],
  companies: ['PhonePe', 'Venmo', 'Razorpay', 'Stripe'],
  prerequisites: ['Saga Pattern', 'Event Sourcing', 'Idempotency'],
  summary:
    'A closed-loop digital wallet modeled as a double-entry ledger: every load, transfer, and withdrawal posts a balanced debit and credit to an append-only Postgres ledger, with Redis caching balances for fast reads and Kafka fanning out events to notifications, history, and reconciliation.',

  understandingProblem:
    "A closed-loop or semi-closed-loop digital wallet lets users load money into a balance, send it peer-to-peer, pay merchants, and withdraw back to a bank. Under the hood it's an accounting system disguised as a consumer app - every \"transfer\" is a pair of debits and credits on a ledger, and every ₹1 or $1 moving in the app must correspond to real money sitting in a partner bank account.",
  realExamples: "Paytm Wallet, PhonePe Wallet, Venmo, Cash App, Google Pay's balance.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  APP["Wallet App"]:::client
  API["Wallet API"]:::compute
  DB[("Users + Balances<br/>one table")]:::database
  BANK["Bank"]:::edge

  APP --> API
  API --> DB
  API --> BANK`,
    },
    whyThisBreaks: [
      'Race conditions on concurrent transfers corrupt balances.',
      'No audit trail - who transferred what, when, why?',
      'No way to reconcile against the real bank account.',
      'A crash between the two updates creates or destroys money.',
      'No idempotency, so retries cause double-debits.',
      'No way to handle async outcomes (bank says "pending" for 3 seconds).',
    ],
    closingNote:
      'The rest of this design evolves this into a system that a regulator, an auditor, and 360 million daily transactions can trust.',
  },

  priorArt: [
    {
      title: 'Modern Treasury - Accounting for Developers',
      description:
        'The reference for how to model a Venmo-style wallet with double-entry: chart of accounts, debit-normal vs. credit-normal accounts, and balance as the aggregate of ledger entries. (Modern Treasury Journal)',
      link: 'https://www.moderntreasury.com/journal/accounting-for-developers-part-i',
    },
    {
      title: 'Uber "Gulfstream"',
      description:
        'Active-active payments with exactly-once semantics via idempotency plus strong consistency, double-entry bookkeeping, and async stream processing of immutable orders. (Uber Engineering blog)',
      link: 'https://www.uber.com/us/en/blog/ubers-payments-platform/',
    },
    {
      title: 'Airbnb "Orpheus"',
      description:
        'Idempotency framework with a three-phase Pre-RPC / RPC / Post-RPC contract, retryable vs. non-retryable error classification, and reads-from-primary-only to avoid replica-lag double-charges. (Airbnb Engineering blog)',
      link: 'https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb',
    },
    {
      title: 'PhonePe on Aerospike',
      description:
        '360M transactions/day served with sub-millisecond balance reads via a partitioned KV store; separates hot OLTP paths from governance/audit stores. (Aerospike Enterprise case study)',
      link: 'https://aerospike.com/blog/phonepe-real-time-transactions-governance',
    },
    {
      title: 'TigerBeetle',
      description:
        'A purpose-built financial database that enforces double-entry and debit/credit invariants at the storage layer itself, showing how far correctness guarantees can be pushed. (tigerbeetle.com)',
      link: 'https://tigerbeetle.com/',
    },
  ],

  coreEntities: [
    { name: 'User', description: 'Wallet holder, identified by phone/email, with KYC state.' },
    {
      name: 'Account',
      description:
        'A logical bucket of money. Each user has one wallet account; the platform owns system accounts (cash-in-bank, fees-collected, etc.).',
    },
    {
      name: 'Journal Entry',
      description: 'A group of ledger lines representing a single logical transaction. All lines sum to zero.',
    },
    { name: 'Ledger Line', description: 'One debit or credit on one account, part of a journal entry. Append-only.' },
    {
      name: 'Transaction',
      description:
        'The user-visible operation (load, send, withdraw). Owns a state machine and refers to its underlying journal entry.',
    },
    {
      name: 'Payment Instrument',
      description: 'A tokenized reference to a bank account, card, or UPI VPA the user has linked.',
    },
  ],

  requirements: {
    core: [
      'Users can load money into the wallet from a bank, card, or UPI.',
      'Users can send money peer-to-peer to another wallet user.',
      'Users can withdraw to a bank account; users and internal systems can view balance and transaction history.',
    ],
    belowTheLine: [
      'Merchant payments with checkout flows (adjacent system)',
      'Split bills, group payments, social feed',
      'Rewards, cashback, subscriptions',
      'KYC, sanctions screening, fraud scoring (assumed; not the design focus)',
      'Cards issued against the wallet balance',
      'Multi-currency, FX, international remittance',
      'Interest / investment features',
    ],
    nonFunctionalTable: [
      {
        metric: 'Correctness',
        target: 'Money can never be created, lost, or duplicated - every unit in a balance must correspond to real money in the partner bank',
      },
      {
        metric: 'Consistency',
        target: 'Strong consistency on the balance and ledger; eventual consistency is fine for the history feed and analytics',
      },
      { metric: 'Latency', target: 'P95 transfer under 500ms; balance check under 100ms' },
      { metric: 'Availability', target: '99.99% on the transfer path - users block on this' },
      { metric: 'Auditability', target: 'Every balance change is traceable to the ledger entries that produced it' },
      { metric: 'Idempotency', target: 'Any operation is safe to retry without side effects' },
      {
        metric: 'Multi-region (below the line)',
        target: 'Single-region-primary with regional read replicas is fine to start - not globally active-active',
      },
      {
        metric: 'Tail latency (below the line)',
        target: 'Sub-100ms P99 is not targeted - bounded by downstream banks and card rails anyway',
      },
    ],
  },

  technologyChoices: [
    {
      tier: 'Ledger of Record',
      purpose: 'Immutable double-entry journal entries and ledger lines - the source of truth for money',
      primaryPick: 'Postgres',
      alternatives: 'MySQL/Aurora, CockroachDB, TigerBeetle',
      whyPrimaryWins:
        'Multi-row ACID transactions and SELECT ... FOR UPDATE give row-level concurrency control on balances for free; DynamoDB transactions cap at 100 items and are expensive, and Cassandra cannot do this at all.',
    },
    {
      tier: 'Balance Cache',
      purpose: 'Sub-millisecond current-balance reads for every app screen',
      primaryPick: 'Redis',
      alternatives: 'Memcached, Valkey, Aerospike',
      whyPrimaryWins: 'Balance reads outnumber writes 100:1; serving them straight from Postgres would burn half the cluster capacity on reads with a 99.9% cache-hit rate.',
    },
    {
      tier: 'Idempotency Keys',
      purpose: 'Maps (userId, idempotencyKey) to a cached response so retries never double-charge',
      primaryPick: 'Redis',
      alternatives: 'DynamoDB with TTL',
      whyPrimaryWins: "SET NX with a TTL gives an atomic acquire-and-expire in one round trip, matching the wallet's Pre-RPC idempotency lease pattern.",
    },
    {
      tier: 'Transaction History Feed',
      purpose: 'Denormalized, range-scannable per-user transaction list for "show me my last 50 transactions"',
      primaryPick: 'Cassandra',
      alternatives: 'ClickHouse, DynamoDB',
      whyPrimaryWins: 'History is read-only after the write; Postgres works until roughly 100GB per table, past which history queries start fighting OLTP writes for the same resource.',
    },
    {
      tier: 'Event Bus',
      purpose: 'Fans out committed ledger writes to notifications, history, and reconciliation without coupling them to the hot path',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pub/Sub, Pulsar',
      whyPrimaryWins: 'Ordering per account/user partition matters for correctness, and Debezium plugs directly into the Postgres WAL to produce that stream.',
    },
    {
      tier: 'Change Data Capture',
      purpose: 'Streams Postgres WAL changes into Kafka without a separate dual-write from application code',
      primaryPick: 'Debezium',
      alternatives: 'Native logical replication',
      whyPrimaryWins: 'Guarantees the event is published if and only if the ledger entry committed - no outbox-consistency bugs from a separate publish step.',
    },
  ],
  technologyChoicesNote:
    "Why Postgres over a NoSQL store for the ledger? Every load, transfer, and withdrawal needs multi-row ACID transactions - DynamoDB transactions cap at 100 items and are expensive, and Cassandra cannot do this at all. SELECT ... FOR UPDATE on balance rows gives row-level concurrency control for free, and partitioning by month keeps the hot set small as the ledger grows. Why Redis over hitting Postgres directly for balance reads? Balance reads outnumber writes roughly 100:1, and routing them through the primary would burn half the cluster's capacity on repetitive reads with a 99.9% chance of returning the same number.",

  scaleEstimation: [
    'Users: 50M DAU, 10M transactions/day',
    'Write QPS: 500 txns/sec peak (double-entry = 1000 ledger writes/sec)',
    'Read QPS: 5K balance checks/sec, 2K transaction history queries/sec',
    'Storage: ~1TB ledger data/year (immutable append-only entries)',
    'Bandwidth: zero tolerance for balance inconsistency - strong consistency required on the write path',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/wallets/:userId/load',
      description: 'Load money into the wallet from a linked bank, card, or UPI instrument.',
      example: '// Body\n{ "amount": 50000, "paymentInstrumentId": "pi_hdfc_1" }\n// Header\nIdempotency-Key: <uuid>\n\n// Response\nTransaction',
    },
    {
      method: 'POST',
      path: '/v1/transfers',
      description: 'Send money peer-to-peer to another wallet user.',
      example: '// Body\n{ "toUserId": "u_42", "amount": 10000, "note": "lunch" }\n// Header\nIdempotency-Key: <uuid>\n\n// Response\nTransaction',
    },
    {
      method: 'POST',
      path: '/v1/wallets/:userId/withdraw',
      description: 'Withdraw money from the wallet back to a linked bank account.',
      example: '// Body\n{ "amount": 20000, "paymentInstrumentId": "pi_hdfc_1" }\n// Header\nIdempotency-Key: <uuid>\n\n// Response\nTransaction',
    },
    {
      method: 'GET',
      path: '/v1/wallets/:userId/balance',
      description: "Return the user's available and pending balance.",
      example: '// Response\n{ "available": 150000, "pending": 20000 }',
    },
    {
      method: 'GET',
      path: '/v1/wallets/:userId/transactions',
      description: "Return the user's transaction history.",
      example: '// Response\nTransaction[]',
    },
    {
      method: 'GET',
      path: '/v1/transactions/:id',
      description: 'Return a single transaction by ID.',
      example: '// Response\nTransaction',
    },
  ],
  apiSecurityNote:
    "userId always comes from the authenticated JWT, never from a path or body for writes. The server computes the authoritative amount and fees; client-side numbers are advisory. Every money-moving API requires an idempotency key. Rate limit per user and per instrument to stop card-testing and credential stuffing.",

  highLevelDesignIntro:
    "Let's build this incrementally, following the three core requirements in order: load money into the wallet, send money peer-to-peer, then read balance and transaction history.",

  builds: [
    {
      title: '1) User Loads Money Into the Wallet',
      body:
        "User adds ₹500 from their bank to their wallet. The interesting twist: this is inherently async, not by choice but because the payment rails we talk to (UPI, cards with 3DS, bank ACH) are themselves async.\n\nWhy we can't make it sync: a UPI collect requires us to request → NPCI → the user's bank app → the user taps approve → the bank debits → we're told, typically 5-30 seconds and sometimes minutes. A card with 3DS needs authorize → bank issues an OTP challenge → user enters OTP → bank confirms → we capture, 10-60 seconds. A direct bank debit / ACH needs authorize → bank runs its batch → settles, hours to days.\n\nNone of these are \"call a function and get an answer in 200ms.\" The shortest path still involves a human tapping a button in another app. If we held an open HTTP connection the whole time, thread pools would exhaust and P99 would balloon to 30s.\n\nSo the system accepts the request, returns 202 Processing immediately, and learns about the final outcome through three backstops: (1) Webhook (primary) - when the rail finishes, it POSTs a signed HTTPS callback to our Payment Gateway Adapter, referencing our internal txn_id that we passed when we initiated the charge. (2) Reconciler (backup) - a cron job polls the rail every 30s for any of our PENDING transactions older than 2 minutes, asking for their definitive status. Catches lost webhooks. (3) Settlement files (end-of-day) - banks and rails send us daily settlement reports; a batch job compares against our ledger and flags breaks for finance.\n\nEach layer backs up the one above it. Industry principle: rail truth always wins.",
      insightCallout:
        "How the Ledger Service actually learns the rail succeeded - it doesn't actively check anything. It's a passive consumer of a rail.confirmed (or rail.failed) event on the event bus. Whoever produces that event - Webhook Handler, Reconciler, or Settlement batch - is responsible for having verified rail truth. Ledger Service just receives \"transaction txn_555 succeeded\" and posts the journal entry.",
      newComponents: [
        {
          name: 'API Gateway',
          description: 'Authenticates users, applies rate limits, and routes to the right service.',
        },
        {
          name: 'Wallet Service',
          description:
            'Orchestrates load/withdraw operations. Creates the transaction row BEFORE calling any external rail - the durable record that we attempted this operation.',
        },
        {
          name: 'Payment Gateway Adapter',
          description:
            'Translates our internal "charge this bank" request into the specific API format each rail expects (UPI, card networks, bank ACH). Think of it as a universal translator between our system and dozens of different bank APIs.',
        },
        {
          name: 'Webhook Handler',
          description:
            'Receives signed callbacks from banks when a charge succeeds or fails. This is how we learn the outcome of async operations.',
        },
        {
          name: 'Reconciler',
          description:
            "A background job that polls rails every 30s for any PENDING transaction older than 2 minutes. The safety net for lost webhooks - if the bank's webhook fails to reach us (network blip, our endpoint was down), the reconciler catches it on the next sweep.",
        },
        {
          name: 'Ledger Service',
          description:
            'The accounting brain. Posts journal entries (balanced debit + credit) to the ledger. Never creates money from nothing - every money movement has two sides that sum to zero. If the math does not balance, the transaction is rejected.',
        },
        {
          name: 'Event Bus (Kafka)',
          description:
            'Carries transaction events to downstream services (notifications, analytics, fraud) without coupling the hot payment path to any of them.',
        },
        {
          name: 'Postgres (ledger primary)',
          description:
            'The sacred source of truth. Stores journal entries and ledger lines. ACID transactions ensure money is never created or destroyed.',
        },
      ],
      diagram: {
        mermaid: `flowchart TD
  APP["Wallet App"]:::client
  GW["API Gateway"]:::edge
  WS["Wallet Service"]:::compute
  PS["Payment Gateway Adapter"]:::compute
  WH["Webhook Handler"]:::compute
  REC["Reconciler"]:::compute
  L["Ledger Service"]:::compute
  DB[("Postgres<br/>ledger primary")]:::database
  K["Event Bus"]:::async
  BANK["External Rail<br/>UPI Cards Bank"]:::edge

  APP -->|"1. POST load funds"| GW
  GW -->|"2. Forward to wallet svc"| WS
  WS -->|"3. Initiate bank charge"| PS
  PS -->|"4. Initiate charge"| BANK
  BANK -->|"5. Webhook callback"| WH
  REC -->|"6. Poll rail status"| BANK
  WH -->|"7. Publish rail confirmed"| K
  REC -->|"8. Publish reconciled result"| K
  K -->|"9. Post journal entry"| L
  L -->|"10. Persist entry"| DB
  WS -->|"11. Read transaction state"| DB`,
      },
      steps: [
        'User taps "Add ₹500 from HDFC Bank" - app calls POST /v1/wallets/:userId/load with an idempotency key',
        'Wallet Service inserts a Transaction row in PENDING state BEFORE making any network call - this row is our durable promise that we attempted this load',
        "Wallet Service calls the Payment Gateway Adapter with our internal txn_id as the reference. Adapter initiates the charge on the UPI rail",
        'Rail responds "accepted, I\'ll tell you later" - we return 202 Processing to the app immediately. User sees "pending" in the UI',
        "Seconds to minutes later, the user approves in their bank app. Bank fires a signed webhook to our Webhook Handler with the result, referencing our txn_id",
        'Webhook Handler verifies the HMAC signature, then publishes a rail.confirmed event to Kafka',
        "Ledger Service consumes the event, locks this specific Transaction row (SELECT * FROM transactions WHERE id = :txnId AND status = 'PENDING' FOR UPDATE - locks only this one row, not all pending), posts a balanced journal entry (DEBIT rail_receivable ₹500, CREDIT user_wallet ₹500), flips status to SUCCEEDED - all in one atomic DB transaction. If the row isn't PENDING (already processed), the query returns 0 rows and we skip - prevents double processing",
        'If the webhook was lost? No problem - the Reconciler polls the rail within 30-60s and produces the same event',
        'Notification fires: "₹500 added to your wallet!"',
      ],
      closingNote:
        "Why persist BEFORE calling the bank? If we called the bank first and crashed before recording the result, we'd have no record that money was charged. The durable PENDING row means: even if everything explodes, we know a charge attempt exists and can reconcile it later. \"Write first, call second\" is the golden rule of payment systems.\n\nTricks that make this safe: our txn_id is passed to the rail on creation so the webhook can tie back to our row; HMAC verification on the webhook - the endpoint is public, only signed payloads are trusted; an idempotent consumer, since the same webhook may be delivered twice, or the webhook and reconciler may both fire, and the WHERE status = PENDING guard ensures the second attempt is a no-op; a state machine guard prevents posting a journal entry for a transaction already in a terminal state.",
    },
    {
      title: '2) User Sends Money to Another Wallet User',
      body: 'Pure internal transfer - no bank rail involved. Fastest and most common operation.',
      insightCallout:
        'Saga pattern = a sequence of local transactions where each step has a compensating action (undo). If step 3 fails, run compensations for steps 2 and 1 to roll back. A peer-to-peer transfer here does not need one, because both wallets live in the same database.',
      newComponents: [
        {
          name: 'Transfer Service',
          description:
            'Handles peer-to-peer sends. Validates sender balance, recipient existence, and daily limits before asking the Ledger Service to post the entry.',
        },
        {
          name: 'Notification Service',
          description: 'Tells both sender and recipient about the transfer via push notification.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  APP["Sender App"]:::client
  GW["API Gateway"]:::edge
  TS["Transfer Service"]:::compute
  L["Ledger Service"]:::compute
  DB[("Postgres<br/>ledger primary")]:::database
  K["Kafka"]:::async
  NOTIF["Notification Service"]:::compute
  RCV["Recipient App"]:::client

  APP -->|"1. POST transfer funds"| GW
  GW -->|"2. Forward to transfer svc"| TS
  TS -->|"3. Validate sender balance"| L
  L -->|"4. Write debit and credit"| DB
  L -->|"5. Publish transfer event"| K
  K -->|"6. Trigger notification"| NOTIF
  NOTIF -->|"7. Push notification"| RCV`,
      },
      steps: [
        'Sender taps "Send ₹100 to Priya" - app calls POST /v1/transfers with an idempotency key',
        'Transfer Service validates: does Priya exist? Is sender KYC-verified? Does sender have ₹100 available? Not a self-transfer? Within daily limits?',
        'Ledger Service atomically posts a journal entry in ONE database transaction: DEBIT user_wallet:sender ₹100 + CREDIT user_wallet:recipient ₹100. Either BOTH happen or NEITHER - money cannot be lost or created',
        'Same transaction writes a transaction_completed event to an outbox table - guarantees the event is published if and only if the ledger entry committed',
        'Debezium (CDC) drains the outbox to Kafka - Notification Service pushes to both users',
        'Response returns to sender with their new balance in ~200ms',
      ],
      closingNote:
        "Why one DB transaction instead of a saga? Both users' wallets are in the same Postgres database. A single transaction gives us atomicity for free - no distributed coordination, no compensating rollbacks, no inconsistency window. This is the beauty of keeping the ledger in one place.",
    },
    {
      title: '3) Balance and Transaction History',
      body:
        "Balance is a derived quantity - the sum of all ledger lines on the user's wallet account. History is the list of those lines enriched with user-facing metadata.",
      newComponents: [
        {
          name: 'Read Service',
          description: 'Serves balance checks and transaction history. Reads from caches and replicas to avoid loading the primary ledger DB.',
        },
        {
          name: 'Redis (balance cache)',
          description:
            "Caches the current balance for sub-millisecond reads. Every app screen checks the balance; we can't hit Postgres 100K times/sec for this.",
        },
        {
          name: 'Cassandra (transaction history feed)',
          description:
            'A denormalized, read-optimized store for "show me my last 50 transactions." Populated from the Kafka event stream.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  APP["Wallet App"]:::client
  GW["API Gateway"]:::edge
  READ["Read Service"]:::compute
  CACHE[("Redis<br/>balance cache")]:::cache
  LEDGER[("Postgres<br/>ledger plus replicas")]:::database
  HIST[("Cassandra<br/>tx history feed")]:::database

  APP -->|"1. GET balance and history"| GW
  GW -->|"2. Forward to read svc"| READ
  READ -->|"3. Lookup cached balance"| CACHE
  READ -->|"4. Fetch from ledger replica"| LEDGER
  READ -->|"5. Fetch tx history"| HIST`,
      },
      steps: [
        'User opens the app - balance check: Read Service hits Redis first (balance:{userId}) - sub-millisecond response, 99.9% cache hit rate',
        'On the rare cache miss, Read Service computes the balance from the ledger and re-caches it. Cache is invalidated automatically on every write via CDC (ledger entry to Kafka to cache invalidation)',
        'User scrolls to transaction history - Read Service queries Cassandra (partitioned by userId, sorted by time). Fast range scans without touching the OLTP database',
      ],
      closingNote:
        "Why not just read from Postgres? Balance reads outnumber writes 100:1. Every app screen triggers a balance check. If we hit Postgres directly, we'd burn half our database capacity on repetitive reads that have a 99.9% chance of returning the same number. Redis absorbs this load for pennies.",
    },
  ],

  coreFlows: [
    {
      title: 'Peer-to-Peer Transfer (Full)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Sender App
  participant GW as API Gateway
  participant TS as Transfer Service
  participant IDE as Idempotency Cache
  participant DB as Postgres Ledger
  participant CDC as Debezium
  participant K as Event Bus
  participant N as Notification

  A->>GW: POST transfers Idempotency-Key
  GW->>TS: forward with JWT
  TS->>IDE: SET NX idem key
  alt retry of completed request
    IDE-->>TS: cached response
    TS-->>A: replay 200
  else first attempt
    TS->>DB: BEGIN tx
    TS->>DB: SELECT FOR UPDATE sender balance
    TS->>TS: validate sufficient funds and limits
    TS->>DB: INSERT journal_entry plus 2 ledger_lines plus outbox
    TS->>DB: UPDATE cached balances sender and recipient
    TS->>DB: COMMIT
    TS->>IDE: cache response 24h
    TS-->>A: 200 SUCCEEDED with new balance
    DB->>CDC: WAL
    CDC->>K: transfer.succeeded
    K->>N: push to both users
  end`,
      },
      nonObviousFailure:
        "If FOR UPDATE times out waiting on another transaction (user sending in rapid succession), we return 429 Retry and the client retries with the same idempotency key - idempotency guarantees no duplicate on retry, even though the underlying lock contention is invisible to the caller.",
    },
    {
      title: 'Load Money From Bank (Full)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Wallet App
  participant WS as Wallet Service
  participant DB as Postgres Ledger
  participant PG as Payment Gateway Adapter
  participant BANK as Bank Rail
  participant REC as Reconciler
  participant K as Event Bus

  A->>WS: POST load Idempotency-Key
  WS->>DB: insert Transaction PENDING
  WS->>PG: charge bank with txn_id
  PG->>BANK: authorize
  alt bank success
    BANK-->>PG: SUCCESS ref_id
    PG-->>WS: SUCCESS
    WS->>DB: insert journal entry debit rail_receivable credit user_wallet
    WS->>DB: UPDATE Transaction to SUCCEEDED
    WS->>K: transaction.succeeded
    WS-->>A: 200 SUCCEEDED
  else bank timeout
    BANK--xPG: timeout
    PG-->>WS: UNKNOWN
    WS->>DB: Transaction remains PENDING
    WS-->>A: 202 PROCESSING
    Note over REC,BANK: reconciler polls every 30s
    REC->>BANK: status by txn_id
    BANK-->>REC: definitive status
    REC->>DB: promote to SUCCEEDED or FAILED
    REC->>K: transaction.succeeded or failed
  end`,
      },
      nonObviousFailure:
        "On a bank timeout, the Transaction stays PENDING and, crucially, no ledger entry exists yet - money has not been declared to exist. Later, when the bank actually settles (1-2 business days), a separate ledger entry reconciles rail_receivable to cash_in_bank. This is the audit-critical piece: the naive fix of \"just credit the wallet optimistically\" would create money that may never actually arrive.",
    },
    {
      title: 'Transaction State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> CREATED
  CREATED --> PENDING: validated plus rail called
  PENDING --> RAIL_CONFIRMED: bank success
  RAIL_CONFIRMED --> SUCCEEDED: ledger posted
  PENDING --> FAILED: bank declined
  PENDING --> RECONCILING: timeout, awaiting reconciler
  RECONCILING --> SUCCEEDED: confirmed by reconciler
  RECONCILING --> FAILED: rejected by reconciler
  SUCCEEDED --> [*]
  FAILED --> [*]
  SUCCEEDED --> REFUNDED: dispute or reversal
  REFUNDED --> [*]`,
      },
      nonObviousFailure:
        'Every transition is a compare-and-set in the DB and emits an event. Illegal transitions (e.g. trying to move a SUCCEEDED transaction back to PENDING) do not throw an error - they simply update 0 rows and no-op silently. Callers must check the affected row count, not assume success from a 200 response.',
    },
  ],

  deepDives: [
    {
      title: "How Do We Model Money Correctly So We Don't Lose a Rupee?",
      problem:
        'The defining question for a wallet. A naive "balance column" approach has been the cause of every "missing ₹1000 from my wallet" customer support ticket since the first digital wallets existed. Race conditions, unreconciled state, and one-sided updates all silently corrupt money.',
      bad:
        "UPDATE users SET balance = balance - X and UPDATE users SET balance = balance + X. Two statements, no atomicity across rows in some DBs, no audit trail, no way to answer \"where did this ₹100 come from?\" or \"what was my balance at 3pm last Tuesday?\" Race conditions under concurrency. You cannot reconcile this against the bank.",
      good:
        'A transactions table that records every transfer, plus balance derived from sum. Append-only log of transfers: {from, to, amount, timestamp}. Balance = SUM(credits) - SUM(debits) WHERE account = user. Much better. But it is still only tracking user-to-user flows - it does not model where money came from (which bank? which rail?) or where fees, promotions, and system money go.',
      simpleTerms:
        'Every money movement writes TWO balanced entries (debit one account, credit another). If debits do not equal credits, the database rejects it - making it physically impossible to create or lose money. Balances are computed from these entries, never stored directly.',
      great:
        "A full double-entry ledger with a chart of accounts, borrowed directly from accounting. journal_entries (id, transaction_id, description, created_at) group ledger_lines (id, journal_entry_id, account_id, direction DEBIT|CREDIT, amount_cents, created_at - append-only, never updated, never deleted) which reference accounts (id, type, name, currency - types include USER_WALLET as a liability to the user, CASH_IN_BANK as our asset, FEES_COLLECTED as our revenue, PROMOTIONS_PAYABLE as our liability, RAIL_RECEIVABLE as an asset in-flight).\n\nAn invariant is enforced at every write: SUM(amount WHERE direction=DEBIT) = SUM(amount WHERE direction=CREDIT) for every journal entry. A DB trigger or application-level check refuses to commit a journal entry that does not balance.\n\nA user transfer of ₹100 from A to B creates one journal entry with two lines: DEBIT user_wallet:A ₹100, CREDIT user_wallet:B ₹100. Loading ₹500 from a bank creates DEBIT rail_receivable ₹500 (money in-flight from bank), CREDIT user_wallet:A ₹500. Later when the bank settles: CREDIT rail_receivable ₹500 (cleared), DEBIT cash_in_bank ₹500 (now sitting in our bank).\n\nBalance for any account at any time = SUM(credits) - SUM(debits) WHERE account_id = X AND created_at <= T. Point-in-time queries are free.\n\nWhy this matters beyond correctness: daily reconciliation requires our cash_in_bank total to equal our bank partner's statement, and if they diverge we know exactly which journal entry caused it; a regulator asking \"how much do you owe users?\" is answered by summing all user_wallet:* balances (the pooled account liability); finance asking \"where did fees come from last month?\" is answered by querying the fees_collected account; every customer support dispute is answerable by pulling the journal entries tied to that transaction ID.\n\nThe mental shift is: balances are not stored, they are computed. Stored balances are a cache; the ledger is the truth.",
    },
    {
      title: 'How Do We Handle Concurrent Transfers From the Same User Without Corruption?',
      problem:
        'User A has ₹100. She taps "send ₹80 to B" and "send ₹50 to C" in rapid succession. Both land on different pods within milliseconds. Without concurrency control, both may pass a naive balance check ("₹100 > ₹80" and "₹100 > ₹50") and proceed, leaving A with -₹30. Money has been created from nothing.',
      bad:
        'Read balance, check, write balance - three statements, no locks. Classic race. Both transactions see the stale balance. Bug guaranteed.',
      good:
        "SELECT ... FOR UPDATE on the user's account row before posting the journal entry. The first transaction acquires a row lock; the second waits. By the time the second checks, it sees A's balance reduced to ₹20 and fails correctly. Implementation: BEGIN; SELECT balance FROM account_balances WHERE account_id = ? FOR UPDATE; validate >= amount; INSERT journal_entries; INSERT ledger_lines (2+ lines, must balance); UPDATE account_balances SET balance = balance - ? WHERE account_id = ?; UPDATE account_balances SET balance = balance + ? WHERE account_id = ?; COMMIT. This works correctly - the account_balances table is a cached projection of the ledger; it is the row we lock on for concurrency control, but the truth is the ledger. Problem: FOR UPDATE serializes concurrent transfers for that one user, which is fine for retail users but not for a \"platform account\" that receives credits from millions of users.",
      simpleTerms:
        'When user A sends money, we lock ONLY A\'s row in the database. Other users\' transactions proceed in parallel unaffected. This prevents double-spending while keeping the system fast for everyone else.',
      great:
        "Row-level locks for user accounts, plus async aggregation for hot platform accounts, plus optimistic concurrency as a safety net.\n\nFor user accounts: use the SELECT FOR UPDATE pattern above (a user rate of ~10 tx/sec is trivial), and add a version column for belt-and-suspenders optimistic control - UPDATE ... WHERE account_id = ? AND version = ?; if 0 rows updated, someone else wrote concurrently and we retry the full transaction.\n\nFor hot platform accounts (e.g. fees_collected receiving credits from every transfer in the system): don't lock a single row - these are credit-only accounts from the platform's perspective. Use a partitioned account pattern: fees_collected_shard_0 through _shard_63, with writes going to a randomly chosen shard and reads summing across all shards. Uber, Stripe, and PhonePe all do this for the same reason - you can't lock a single row that receives 100K writes/sec.\n\nFor the ledger itself: journal_entries and ledger_lines are append-only with auto-increment IDs. No locks needed on writes; readers see a consistent snapshot.\n\nIsolation level: Serializable is correct but slow. Use Repeatable Read (MySQL) or the default Read Committed (Postgres) with explicit FOR UPDATE locks on the specific balance rows we care about. That is the standard financial-system choice.",
    },
    {
      title: 'How Do We Serve Balance Reads at 100K+ QPS Without Hammering the Ledger?',
      problem:
        'Every wallet screen on the app triggers a balance read. 100M active users checking their balance is catastrophic query load if we derive balance from scratch every time. But balance must be accurate, not stale, because it gates the next transfer.',
      bad:
        'Derive balance on every read by summing ledger lines. This sums millions of rows on every GET - a user with 10 years of history pays the cost of everyone before them. Melts the DB.',
      good:
        'A cached account_balances table, updated on every ledger write. Single-row lookup per user. Correctness comes from the same DB transaction that writes the ledger lines - balance updates atomically with the underlying journal entry. Fast reads, guaranteed consistency. Most real wallets stop here, but at PhonePe-scale (360M transactions/day, hundreds of thousands of balance reads/sec) even a single-row Postgres read is pressure on the primary.',
      simpleTerms:
        'Instead of calculating balance from scratch every time (slow), we cache it in Redis. When a transaction happens, we update both the ledger (truth) and the cache (speed). If the cache fails, we fall back to computing from the ledger.',
      great:
        "A three-tier balance cache: Redis hot tier, read replicas, and snapshot rebuilds.\n\n1. Redis cache holds balance:{userId} with a 30s TTL. On every ledger write, the same CDC pipeline that produces Kafka events also invalidates the Redis entry (or writes the new balance directly). Read-your-writes consistency within the write pipeline is preserved by making the API response include the new balance from the DB transaction, not the cache.\n\n2. Read replicas serve cold misses. Read-your-writes is not guaranteed here, but for \"just-checking-my-balance\" reads a second of lag is fine. Critical: reads that gate a write (like \"can A afford this transfer?\") MUST go to primary with FOR UPDATE - never a replica.\n\n3. PhonePe-style: Aerospike or a similar low-latency KV store for the hot balance tier at truly massive scale - sub-ms reads, natively partitioned, designed for 360M+ tx/day workloads. Secondary to the SQL ledger (SQL remains the truth) but serves most balance reads.\n\nFor platform accounts with skew (one account credited by millions of users), precompute running aggregates in a stream processor (Flink) subscribed to the ledger CDC stream - the query never touches the raw ledger.",
      diagram: {
        mermaid: `flowchart LR
  APP["Wallet App"]:::client
  READ["Read Service"]:::compute
  REDIS[("Redis<br/>30s TTL")]:::cache
  REPL[("Postgres read replica")]:::database
  PRIM[("Postgres primary<br/>ledger plus balances")]:::database
  CDC["Debezium CDC"]:::async
  K["Kafka"]:::async

  APP -->|"1. GET balance"| READ
  READ -->|"2. Lookup cached balance"| REDIS
  READ -->|"3. Fallback to replica"| REPL
  PRIM -->|"4. Stream WAL"| CDC
  CDC -->|"5. Stream changes"| K
  K -->|"6. Invalidate balance cache"| REDIS`,
      },
    },
    {
      title: 'How Do We Keep Our Wallet Balances Reconciled With the Real Money in Our Bank Account?',
      problem:
        'Users trust our balance number. But that number is only valid if there is real money in a partner bank account backing it. If our ledger says users collectively hold ₹100 crore in wallets, our bank partner must show ₹100 crore in our pooled account. Any drift is either a bug, a bank-side error, or fraud. Regulators require this reconciliation daily.',
      bad: 'Trust the ledger and hope. You will find out about reconciliation breaks at the worst possible time (regulator audit, customer complaint, bank dispute).',
      good:
        "Nightly batch reconciliation: every night, pull the bank's statement for our pooled account, compute our expected balance from the ledger (SUM(cash_in_bank account)), and compare, alerting on mismatch. Works and is legally required, but \"we find the break 24 hours later\" is too slow - you may have millions more transactions stacked on top of a broken state.",
      great:
        "Continuous reconciliation plus match-as-you-go for external rails plus two-sided state machines, in three layers of defense.\n\n1. Continuous reconciliation at the rail level: every load/withdraw transaction has a state machine that only closes when we've heard back from the bank (PENDING -> RAIL_CONFIRMED -> LEDGER_POSTED -> SETTLED). A reconciler polls rails for any PENDING transaction older than 2 minutes and reads the ground truth, so we never silently diverge.\n\n2. Daily automated reconciliation as a pipeline job: pull bank statements (via bank API or file feed), compute expected from ledger, match line-by-line by external reference, and ticket breaks rather than sweeping them - every mismatch creates an investigation task for ops.\n\n3. TigerBeetle-style invariant at the DB layer (optional, advanced): if using a purpose-built financial DB, the storage engine itself refuses to commit unbalanced entries. Extra defense.\n\nReal-world patterns: a two-sided state machine tracks the transaction in our DB AND mirrors the bank's view, and the two must match at terminal states; sweep jobs flag money held in our rail_receivable or rail_payable accounts older than N hours for investigation; a daily liability report compares SUM(all user_wallet accounts) against the cash_in_bank account, and a divergence greater than $10 pages finance.",
    },
    {
      title: 'How Do We Prevent Double-Debiting on Retries and Across Services?',
      problem:
        "Network failures are guaranteed. A user taps \"send ₹500\" and their phone's radio drops mid-request. Their app retries. Without idempotency, we debit them twice. If our own internal services retry (e.g. Payment Gateway adapter timing out), we may charge the bank twice.",
      bad: 'Trust the client and service retry policies to not cause harm. Guaranteed to eventually send the same user two identical transfers for the same intent.',
      good:
        'An Idempotency-Key header on every money-moving API plus a DB unique constraint. Client sends a UUID; server checks UNIQUE(user_id, idempotency_key). Duplicates return the original response.',
      simpleTerms:
        'Every request gets a unique key. If the same request arrives twice (network retry), we recognize the key and return the same result without processing again. No double-charges, ever.',
      great:
        "An Airbnb Orpheus-style idempotency framework with a three-phase contract, lifted directly from Airbnb's production design: (1) Pre-RPC (DB only) - acquire an idempotency lease in Redis (SET NX PX 60s), insert a Transaction row in PENDING, all within one DB transaction; (2) RPC (network only) - call the payment rail, with no DB writes during this phase, otherwise a slow bank call holds a transaction lock and deadlocks the system; (3) Post-RPC (DB only) - record the rail's response, post the journal entry, update state, atomically.\n\nRules: no network calls during Pre/Post-RPC (one slow downstream service would kill the whole wallet), and no DB writes during RPC (same reason).\n\nTwo critical pieces Airbnb calls out: retryable vs. non-retryable error classification, where 5xx/timeouts/connection resets are retryable (idempotency key NOT burned, a later retry will try again) while 4xx validation errors like \"insufficient funds\" or \"KYC blocked\" are non-retryable (idempotency key IS burned with the error response cached, so future retries return the same 4xx) - misclassification is how you get stuck transactions or double-debits, and every new exception type gets reviewed for retry semantics; and read-from-primary for idempotency state, since checking the idempotency table on a read replica means replica lag between a write and a retry is exactly the window where you accidentally process twice, a subtle bug with a huge blast radius.\n\nA fencing token handles multi-step flows: loads and withdrawals span multiple seconds, so if the Transaction row is picked up for reconciliation while another process is mid-flight, use version optimistic locking (UPDATE ... WHERE id = ? AND version = ?) - zero rows updated means someone else beat you, retry. Downstream processors (card rails, UPI, bank APIs) should also receive a deterministic idempotency key derived from our transaction ID ({txn_id}:{attempt_no}) so even if we retry, the external system dedupes.",
    },
    {
      title: "Balance > 0 but Can't Spend It: How Do We Model Holds, Pending, and Available Balance?",
      problem:
        'A user loads ₹500. The bank says "pending" for up to 2 business days. Should the user see ₹500 in their available balance? No - we have not actually received the money yet. Similarly, if a user sends ₹100 that has not cleared the recipient\'s bank-linked rail yet, that is in flight. We need to distinguish provisional balance from available balance.',
      bad: 'One balance number. Users spend money they do not actually have yet, or we do not let them spend money that is real. Both are bad UX.',
      good:
        'Two balance fields: available and pending. Store both on the cached row. available is what they can spend; pending is inflow that has not cleared. Works for simple cases, but falls apart with refunds, disputes, stuck transactions, and long-tail edge cases - ends up needing more and more fields.',
      great:
        "Model holds as first-class ledger accounts, not flags on a balance row. Every user has multiple sub-accounts: user_wallet:{id}:available (money they can spend), user_wallet:{id}:pending_in (inflow not yet cleared), user_wallet:{id}:pending_out (outflow awaiting settlement), and user_wallet:{id}:hold (frozen for disputes, KYC review, etc.). Transfers between these are ledger entries - \"clearing\" a pending load is just a ledger entry (debit pending_in, credit available). Nothing special. Holds, releases, and clears are all expressible as balanced journal entries.\n\nWhy this is better: zero special-case code paths, since every money-move is a journal entry; auditable, since \"why is ₹100 in my hold account?\" is answered by pulling the journal entry that put it there; easy to reason about regulatory escrow requirements (e.g. funds in pending_in are not yet \"owed\" to users); and unified reporting, since a user's total stake is still just SUM(all their sub-accounts). This is how Venmo, Cash App, and Stripe all model it internally.",
    },
  ],

  selfAudit: [],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  APP["Wallet App"]:::client
  GW["API Gateway"]:::edge

  WS["Wallet Service<br/>load withdraw"]:::compute
  TS["Transfer Service"]:::compute
  LS["Ledger Service"]:::compute
  READ["Read Service"]:::compute
  PG["Payment Gateway Adapters"]:::compute
  REC["Reconciler"]:::compute
  NOTIF["Notification Service"]:::compute
  FRAUD["Fraud Risk Service"]:::compute

  IDE[("Redis<br/>idempotency")]:::cache
  BAL[("Redis<br/>balance cache")]:::cache
  PRIM[("Postgres primary<br/>ledger")]:::database
  REPL[("Postgres read replica")]:::database
  KV[("Aerospike<br/>hot balance reads")]:::cache
  HIST[("Cassandra<br/>tx history feed")]:::database

  CDC["Debezium CDC"]:::async
  K["Kafka"]:::async

  BANK["Rails<br/>UPI Bank Cards"]:::edge
  PUSH["FCM APNs SMS"]:::edge

  APP -->|"Initiate transaction"| GW
  GW -->|"Forward to wallet svc"| WS
  GW -->|"Forward to transfer svc"| TS
  GW -->|"Forward to read svc"| READ

  WS -->|"Check idempotency key"| IDE
  TS -->|"Check idempotency key"| IDE
  WS -->|"Initiate bank charge"| PG
  PG -->|"Initiate charge"| BANK
  TS -->|"Validate sender balance"| LS
  WS -->|"Post journal entry"| LS
  LS -->|"Write ledger entry"| PRIM
  LS -->|"Refresh balance cache"| BAL

  PRIM -->|"Replicate"| REPL
  PRIM -->|"Stream WAL"| CDC
  CDC -->|"Stream changes"| K
  K -->|"Update hot balance"| KV
  K -->|"Invalidate balance cache"| BAL
  K -->|"Append tx history"| HIST
  K -->|"Trigger notifications"| NOTIF
  K -->|"Evaluate fraud rules"| FRAUD

  READ -->|"Lookup cached balance"| BAL
  READ -->|"Fallback to replica"| REPL
  READ -->|"Fetch hot balance"| KV
  READ -->|"Fetch tx history"| HIST

  REC -->|"Poll rail status"| BANK
  REC -->|"Write reconciled entry"| PRIM

  NOTIF -->|"Push via FCM APNs"| PUSH`,
    bullets: [
      'User initiates transaction - Wallet App sends request through API Gateway to Wallet Service or Transfer Service',
      'Idempotency validated - Redis idem cache rejects duplicate requests before any state change',
      'Ledger writes double-entry - Ledger Service persists balanced debit + credit entries to Postgres primary with row-level locking',
      'External rail called if needed - Payment Gateway Adapters charge or credit the bank/UPI',
      'CDC streams changes - Debezium captures WAL changes and publishes to Kafka',
      'Downstream consumers update - Kafka feeds balance cache (Redis), hot balance reads (Aerospike), transaction history (Cassandra), and triggers notifications',
      'Read path serves fast - Read Service checks Redis balance cache first, falls back to Postgres read replica and Cassandra for history',
      'Reconciler ensures integrity - polls bank rails daily, compares with internal ledger, fixes discrepancies',
    ],
  },

  keyTechnologies: [
    {
      term: 'Double-entry Ledger',
      definition:
        'Accounting model where every money movement creates balanced debit + credit entries that sum to zero - money can never be created or destroyed.',
    },
    {
      term: 'Idempotency Key',
      definition:
        'Client-generated UUID attached to every payment request ensuring retries produce the same result without double-charging.',
    },
    {
      term: 'Saga Pattern',
      definition:
        "Sequence of local transactions with compensating actions (e.g. refund) used when operations span multiple services that can't share a DB transaction.",
    },
    {
      term: 'Optimistic Locking (CAS)',
      definition:
        'Compare-and-swap via a version column - UPDATE succeeds only if the version matches, detecting concurrent modifications without holding locks.',
    },
    {
      term: 'Materialized Balance',
      definition:
        'A cached running total derived from the ledger; updated atomically with ledger writes and used for fast balance checks.',
    },
    {
      term: 'Reconciliation',
      definition: 'Periodic comparison of internal ledger state against external bank statements to detect and resolve discrepancies.',
    },
    {
      term: 'Kafka',
      definition: 'Distributed event bus carrying transaction events (via CDC/outbox) to notifications, analytics, and the history feed.',
    },
    {
      term: 'Postgres',
      definition: 'ACID relational database serving as the ledger source of truth with row-level locking for concurrency control on balances.',
    },
  ],

  expectedDepth: {
    mid:
      'Design a basic wallet with balance storage and transfer capability. Understand why double-spend is the core problem - two concurrent requests draining the same balance must not both succeed. Propose database transactions for atomic balance updates and explain why check-then-deduct is a race condition.',
    senior:
      'Propose double-entry ledger (every transaction creates two entries: debit + credit). Explain idempotency keys for safe retries without double-charging. Discuss the saga pattern for multi-party transfers involving external banks and reconciliation with external payment gateways. Articulate why eventual consistency is unacceptable for balance operations.',
    staffPlus:
      'Address distributed ledger consistency across shards (partitioned platform accounts to avoid hot-key contention). Discuss settlement and clearing processes with partner banks, regulatory compliance (PCI-DSS, RBI guidelines for prepaid instruments), and fraud detection patterns (velocity checks, device fingerprinting). Cover how to handle partial failures in multi-step payment flows using three-phase idempotency and the cost of strong consistency at scale.',
  },

  keyTakeaways: [
    'Double-entry ledger - every transaction has debit + credit; the sum must be zero',
    'Persist before calling external - write intent to DB, then call the bank; never the reverse',
    'Idempotency key on every payment - retries are safe',
    'Reconciler compares our ledger with bank statements daily',
  ],

  relatedDesigns: ['stock-broker', 'food-delivery', 'delayed-trigger-service'],
  relatedConcepts: [
    { name: 'Idempotency', description: 'Retried payment requests never double-debit a wallet.' },
    { name: 'Saga Pattern', description: 'Coordinates multi-step transfers with compensating rollbacks on failure.' },
    { name: 'Distributed Locking', description: 'Serializes concurrent debits against the same balance.' },
    { name: 'Event Sourcing & CQRS', description: 'An append-only ledger is the source of truth for every balance.' },
    { name: 'Database Replication', description: 'Keeps the ledger durable and available across nodes.' },
  ],

  simulator: {
    goalDescription: 'Move money between wallets and banks correctly - never create, lose, or duplicate a rupee - while serving fast balance reads.',
    requirementChips: ['Transfer P95 < 500ms', 'Balance check < 100ms', '99.9% balance cache hit rate'],
    targetRps: 7500,
    readRatio: 0.93,
    cacheHitRatio: 0.99,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'edge-gateway', label: 'API Gateway at the edge', kind: 'requires-node-type', nodeType: 'api-gateway' },
      { id: 'balance-cache', label: 'Balance cache for fast reads (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'ledger-store', label: 'Durable double-entry ledger (Postgres)', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'event-bus', label: 'Event bus fanning out ledger writes (Kafka)', kind: 'requires-node-type', nodeType: 'kafka' },
      {
        id: 'compute-tier',
        label: 'Compute tier for wallet, transfer, and ledger services',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice'],
      },
      { id: 'cache-before-ledger', label: 'Balance reads hit cache before the ledger DB', kind: 'requires-cache-before', cacheType: 'redis', sinkType: 'postgresql' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'wallet-1', type: 'app-server', instanceCount: 10, position: { x: 600, y: 200 } },
        { id: 'ledger-1', type: 'microservice', instanceCount: 8, position: { x: 880, y: 200 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 10, position: { x: 1160, y: 80 } },
        { id: 'redis-1', type: 'redis', instanceCount: 4, position: { x: 1160, y: 320 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 4, position: { x: 1440, y: 200 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 8, position: { x: 1720, y: 320 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-wallet', source: 'gw-1', target: 'wallet-1' },
        { id: 'e-wallet-redis', source: 'wallet-1', target: 'redis-1' },
        { id: 'e-wallet-ledger', source: 'wallet-1', target: 'ledger-1' },
        { id: 'e-ledger-pg', source: 'ledger-1', target: 'pg-1' },
        { id: 'e-pg-kafka', source: 'pg-1', target: 'kafka-1' },
        { id: 'e-kafka-cassandra', source: 'kafka-1', target: 'cassandra-1' },
        { id: 'e-kafka-redis', source: 'kafka-1', target: 'redis-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Every load, transfer, and withdrawal posts a balanced debit/credit pair to the Postgres ledger inside the Ledger Service; Redis caches balances at a 99.9% hit rate so reads rarely touch the ledger, and Kafka/CDC fan committed ledger writes out to cache invalidation and the transaction-history feed asynchronously.',
    failureModeNarratives: {
      postgresql: 'The ledger primary is the single source of truth for money movement; if it is unavailable, no load, transfer, or withdrawal can be posted even though cached balances keep serving stale reads.',
    },
    fullDesignLinkSlug: 'digital-wallet',
  },
}

export default topic
