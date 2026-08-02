import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'food-delivery',
  title: 'Food Delivery (Zomato / Uber Eats)',
  difficulty: 'Advanced',
  icon: 'pi pi-truck',
  color: '#f97316',
  readTimeMinutes: 29,
  topics: [
    'Geospatial Indexing (Geohash / H3)',
    'Real-Time Dispatch Matching',
    'WebSocket Location Streaming',
    'ETA Prediction',
    'Idempotent Payment Capture',
  ],
  companies: ['Uber Eats', 'DoorDash', 'Zomato', 'Swiggy'],
  prerequisites: ['Geospatial Indexing', 'Message Queues', 'Idempotency'],
  summary:
    'A three-sided marketplace matching diners, restaurants, and delivery partners in real time. Splits into two consistency domains: a strongly-consistent order/payment state machine, and an eventually-consistent geospatial dispatch-and-tracking layer, so a stale delivery-partner dot on a map can never corrupt an order or double-capture a payment.',

  understandingProblem:
    "Uber Eats, DoorDash, Zomato, and Swiggy all run the same three-sided marketplace under brutal, spiky load: tens of thousands of restaurants, hundreds of thousands of delivery partners, and millions of diners, all converging on the same lunch and dinner windows where demand triples in minutes. The naive approach — one relational table of partner locations, queried with \"SELECT nearest partner ORDER BY distance()\" on every order — is a full table scan against a constantly moving population, and it falls over long before city scale. It also conflates two fundamentally different problems: matching (which partner should get this order, re-evaluated every few seconds) and tracking (where is my order right now, streamed continuously), which have very different latency, consistency, and durability needs. Layered on top of that is a menu that changes availability mid-order, a restaurant that may reject what it just accepted, and a payment that must be authorized before the kitchen starts cooking but only captured once it actually will. Getting this right means recognizing that \"find nearby partners\" is a spatial-indexing problem, not a query-optimization problem, and that order correctness and location freshness deserve two entirely different consistency models.",
  realExamples: 'Uber Eats, DoorDash, Zomato, Swiggy, Grubhub.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Diner App]:::client
  api[Order API]:::edge
  db[("Orders + Partners<br/>one table")]:::database

  client -->|"POST /order"| api
  api -->|"INSERT order"| db
  api -->|"SELECT nearest partner<br/>full table scan"| db`,
    },
    whyThisBreaks: [
      'Full table scan for "nearest partner" against a population that moves every few seconds — collapses long before city scale, let alone during a Friday-night surge.',
      'Matching and tracking are conflated into one slow query path even though they need completely different latency and consistency guarantees.',
      'No restaurant accept/reject step — an order can be dispatched to a partner before the kitchen has confirmed it can even make the food.',
      "No menu/inventory availability check at checkout — a diner can order a dish that sold out five minutes ago, and the system has no way to catch it before the restaurant sees it.",
      'A single synchronous charge with no state machine — a crash between charging the diner and writing the order either loses the charge or loses the order.',
      "One shared database absorbs order writes, dispatch queries, and location pings from every city at once, so a lunch-rush spike in one city degrades every other city's checkout.",
      "In simple terms: at lunch rush, thousands of couriers are moving every few seconds while thousands of orders each need a match in under a second — computing straight-line distance to every courier for every order is like re-sorting a phone book on every phone call.",
    ],
    closingNote:
      'The rest of this design splits matching from tracking, adds a geospatial index and batched dispatch, and treats order/payment as a strongly-consistent state machine layered on top of an eventually-consistent location system.',
  },

  priorArt: [
    {
      title: 'Uber H3 Hierarchical Geospatial Index',
      description:
        "An open-sourced hexagonal grid system originally built for Uber's own dispatch and surge-pricing pipelines; this design borrows its core idea of bucketing positions into fixed-size cells so proximity search becomes a cell/neighbor-ring lookup instead of a distance scan.",
      link: 'https://github.com/uber/h3',
    },
    {
      title: 'DoorDash Engineering: Real-Time Dispatch and Batching',
      description:
        "DoorDash has published extensively on batching incoming orders into short windows and solving an assignment problem over couriers rather than greedily assigning nearest-available — the same batching/offer-timeout pattern used in this design's dispatch algorithm.",
      link: 'https://careersatdoordash.com/blog/next-generation-optimization-for-dasher-dispatch-at-doordash/',
    },
    {
      title: 'Kafka as an Ordered, Durable Event Log',
      description:
        'Publishing order-state transitions to a partitioned, durably-ordered log and having downstream services (dispatch, notification, tracking) consume it independently follows the log-as-source-of-truth architecture standard across delivery and ride-hailing platforms.',
      link: 'https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying',
    },
    {
      title: 'Hungarian Algorithm / Assignment Problem',
      description:
        'The classical polynomial-time solution to bipartite matching (minimizing total cost when pairing two sets) underlies the batched dispatch-scoring step, matching ready orders to available partners by ETA and route efficiency rather than one-at-a-time nearest-neighbor.',
      link: 'https://en.wikipedia.org/wiki/Hungarian_algorithm',
    },
  ],

  coreEntities: [
    { name: 'Order', description: 'The transactional record moving through an explicit state machine, from CREATED through DELIVERED, REJECTED, or CANCELLED/REFUNDED.' },
    { name: 'Menu Item', description: 'A restaurant-owned SKU with price, customizations, and an availability flag (or countable quantity) that checkout and dispatch must respect in real time.' },
    { name: 'Restaurant', description: 'A menu/catalog-owning entity that accepts, rejects, or flags order items; acceptance triggers payment capture and dispatch.' },
    { name: 'Delivery Partner', description: "A courier whose current cell-bucketed location and availability drive dispatch matching." },
    { name: 'Offer', description: 'A time-boxed proposal of an order to one partner, resolved by accept, decline, or timeout, with a lock preventing double-assignment.' },
    { name: 'Geo Cell', description: 'A geohash/H3-bucketed unit of space used to index partner locations for fast proximity lookup, sharded per city.' },
    { name: 'Payout Account', description: "A ledger account per restaurant and per delivery partner tracking what the platform owes them net of commission, settled on a schedule separate from the diner-facing order." },
  ],

  requirements: {
    core: [
      'Diners browse nearby restaurants and live menus, then place orders with customizations and delivery instructions.',
      'The platform matches each accepted order to a nearby available delivery partner and re-assigns automatically on decline or timeout.',
      "Diners, restaurants, and delivery partners see live order status transitions and the delivery partner's location on a map.",
      'Restaurants receive new orders in near real time and can accept, reject, or flag items as unavailable.',
      'Payments are authorized at checkout and captured on restaurant acceptance, with support for promo codes, tipping, and partial refunds.',
      'Diners and delivery partners can rate each other and the order after delivery completes; restaurants and partners are paid out net of commission on a settlement schedule.',
    ],
    belowTheLine: [
      'Batch/group ordering across multiple restaurants in a single checkout',
      'Surge pricing and dynamic incentive payouts for delivery partners',
      'Scheduled orders for a future delivery window',
      'Real-time partner-facing route optimization across multiple concurrent deliveries',
      'Full multi-region active-active (single-region-primary with per-city isolation is the target)',
    ],
    nonFunctionalTable: [
      { metric: 'Dispatch decision latency', target: 'Under a few hundred ms, even during city-wide lunch/dinner peaks' },
      { metric: 'Location fan-out latency', target: '3-5 seconds end-to-end from partner GPS ping to tracker display' },
      { metric: 'Consistency model', target: 'Order/payment state strongly consistent; location, search ranking, and ETA eventually consistent' },
      { metric: 'Geo-isolation', target: 'Per-city partitioning so a traffic spike or outage in one city cannot degrade another' },
      { metric: 'Order placement availability', target: 'Stays available during partial backend failures; live map/tracking degrades first' },
      { metric: 'Payment correctness', target: 'Never capture twice for the same order, and never capture before the restaurant has accepted' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Search Index',
      purpose: 'Restaurant discovery with geo + relevance',
      primaryPick: 'Elasticsearch',
      alternatives: 'Algolia, Meilisearch, Typesense',
      whyPrimaryWins: 'Geo-distance scoring + full-text + facets (cuisine, rating, delivery time) in one query',
    },
    {
      tier: 'Order DB',
      purpose: 'Order state machine + payment records',
      primaryPick: 'Postgres',
      alternatives: 'CockroachDB, MySQL, Spanner',
      whyPrimaryWins: 'ACID for payment consistency; order volume fits sharded Postgres',
    },
    {
      tier: 'Location Store',
      purpose: 'Real-time delivery-partner GPS coordinates',
      primaryPick: 'Redis Geo',
      alternatives: 'PostGIS, ElastiCache, DynamoDB',
      whyPrimaryWins: 'Sub-ms GEORADIUS queries; TTL auto-expires stale partner positions',
    },
    {
      tier: 'Dispatch Workflow',
      purpose: 'Multi-step delivery-partner assignment orchestration',
      primaryPick: 'Temporal',
      alternatives: 'Cadence, Step Functions, custom state machine',
      whyPrimaryWins: 'Handles timeouts, retries, and human-in-loop (partner accept/decline) as a durable workflow',
    },
    {
      tier: 'Event Bus',
      purpose: 'Order events, location streams, notifications',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, RabbitMQ',
      whyPrimaryWins: 'Ordered per-order-id partition; replay for failed consumers',
    },
    {
      tier: 'Real-Time Push',
      purpose: 'Live tracking to the diner app',
      primaryPick: 'WebSocket',
      alternatives: 'SSE, Long Polling, gRPC stream',
      whyPrimaryWins: 'Persistent, low-latency connection for the duration of an active order, with polling as a fallback',
    },
  ],
  technologyChoicesNote:
    "Why Redis Geo over PostGIS for delivery-partner location? At tens of thousands of partners pinging their position every few seconds, PostGIS's disk-backed writes can't keep up - Redis Geo handles this entirely in-memory with O(log N) GEOADD and GEORADIUS operations, and a short TTL naturally expires stale positions without a separate cleanup job.",

  scaleEstimation: [
    'Users: 10M DAU across served metros placing ~0.3 orders/day each → ~3M orders/day (~35 orders/sec average, ~100-110 orders/sec during lunch/dinner peaks, roughly 3x average)',
    'Write QPS: each order fans out into 5-8 downstream calls (menu/availability check, payment auth, dispatch, restaurant push, tracking updates) → ~700-800 backend write ops/sec at peak',
    'Location ingest: ~500K delivery partners platform-wide, ~15% (75K) online at peak, GPS ping every 4s → ~18,750 pings/sec (~2.8 MB/sec raw ingest)',
    'Storage: order records ~2KB average → ~6GB/day (~2.2TB/year) in the sharded order store; raw location history is downsampled 5-10x before long-term retention',
    'Read QPS: restaurant discovery and live-tracking reads dominate — tens of thousands of concurrent WebSocket connections during peak hours, each receiving a location/status push every few seconds rather than polling',
  ],

  apiInterface: [
    {
      method: 'GET',
      path: '/v1/restaurants?lat&lng&cuisine',
      description: "Return nearby restaurants ranked by ETA and rating, backed by a geohash-indexed search service.",
      example: '// Response 200\n[{ "restaurantId": "r_331", "name": "Spice Route", "etaMinutes": 28, "rating": 4.6 }]',
    },
    {
      method: 'GET',
      path: '/v1/restaurants/{restaurantId}/menu',
      description: 'Return the live menu, including per-item availability, served from a cached snapshot.',
      example: '// Response 200\n{ "items": [{ "sku": "combo_1", "price": 899, "available": true }] }',
    },
    {
      method: 'POST',
      path: '/v1/orders',
      description: 'Place a new order with items, customizations, and delivery instructions; authorizes (holds) payment.',
      example: '// Request\n{ "restaurantId": "r_331", "items": [{ "sku": "combo_1", "qty": 2 }], "deliveryAddress": {}, "tip": 200 }\n// Header\nIdempotency-Key: <uuid>\n\n// Response 201\n{ "orderId": "o_9911", "status": "PLACED", "etaMinutes": 32 }',
    },
    {
      method: 'POST',
      path: '/v1/orders/{orderId}/accept',
      description: 'Restaurant accepts an incoming order, capturing the authorized payment and triggering dispatch.',
      example: '// Response 200\n{ "orderId": "o_9911", "status": "ACCEPTED" }',
    },
    {
      method: 'POST',
      path: '/v1/orders/{orderId}/reject',
      description: 'Restaurant rejects the order or flags specific items unavailable; releases the payment hold.',
      example: '// Request\n{ "reason": "item_unavailable", "skus": ["combo_1"] }\n\n// Response 200\n{ "orderId": "o_9911", "status": "REJECTED" }',
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
      description: 'Return the current order status and delivery partner location snapshot (polling fallback).',
      example: '// Response 200\n{ "status": "EN_ROUTE", "partnerLocation": { "lat": 12.93, "lng": 77.61 }, "etaMinutes": 8 }',
    },
    {
      method: 'WS',
      path: '/v1/orders/{orderId}/stream',
      description: 'Subscribe to live order status transitions and partner location updates over WebSocket.',
      example: '// Server push\n{ "type": "location", "lat": 12.931, "lng": 77.612, "etaMinutes": 7 }',
    },
    {
      method: 'POST',
      path: '/v1/orders/{orderId}/rate',
      description: 'Diner or delivery partner rates the counterparty and the order after delivery completes.',
      example: '// Request\n{ "rating": 5, "comment": "great service" }\n\n// Response 200\n{ "status": "recorded" }',
    },
  ],
  apiSecurityNote:
    "userId, restaurantId, and partnerId always come from the authenticated JWT, never trusted from the request body. Menu prices and availability are resolved server-side against the authoritative Catalog/Menu store at checkout, never from a stale client-cached menu. Every payment-affecting endpoint (create order, accept, reject/cancel) requires an Idempotency-Key header so retries from flaky mobile networks never double-charge or double-capture. Rate limit per user and per device to stop scripted order floods.",

  highLevelDesignIntro:
    'Four passes, one per core functional requirement: place an order (with menu/availability validation and payment authorization), get restaurant acceptance and capture payment, dispatch a nearby delivery partner, then stream live status and location back to everyone watching.',

  builds: [
    {
      title: 'FR-1: Diner Browses and Places an Order',
      body:
        "Diners search nearby restaurants, view a live menu, build a cart, and check out. Two things make this trickier than a normal e-commerce checkout: the menu is a fast-changing, restaurant-owned catalog that must be cheap to read but authoritative at the moment of purchase, and the payment cannot be finalized yet because the restaurant hasn't agreed to make the food.",
      insightCallout:
        "Same 'write intent before calling out' rule as the wallet and job-scheduler designs: we persist the order row in CREATED state before hitting the payment rail, so a crash mid-authorization leaves a durable, reconcilable record instead of a lost order.\n\nWe authorize (hold) payment at checkout but only capture on restaurant acceptance — an authorization holds funds without moving money, so if the restaurant rejects the order we release the hold instead of running a refund.",
      newComponents: [
        { name: 'Search/Discovery Service', description: 'Elasticsearch index of restaurants keyed by geohash cell plus cuisine and rating, powering the "restaurants near me" browse experience.' },
        { name: 'Catalog/Menu Service', description: 'Owns restaurant and menu data. Heavily cached in Redis and a CDN since menus change infrequently but are read constantly.' },
        { name: 'Order Service', description: 'Validates the cart against the authoritative menu, orchestrates payment authorization, and owns the order state machine.' },
        { name: 'Postgres (orders, sharded by city)', description: 'Durable source of truth for order rows and their state transitions.' },
        { name: 'Payment Adapter', description: 'Translates our internal "authorize/capture/release" calls into the specific card-network or wallet API.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Diner App]:::client
  gw[API Gateway]:::edge
  search[("Search Index<br/>Elasticsearch")]:::storage
  catalog[("Menu Cache<br/>Redis")]:::cache
  order[Order Service]:::compute
  db[("Postgres<br/>orders by city")]:::database
  pay[Payment Adapter]:::compute

  client -->|"1. Browse nearby restaurants"| gw --> search
  client -->|"2. View menu"| gw --> catalog
  client -->|"3. POST /orders"| gw --> order
  order -->|"4. Re-validate items"| catalog
  order -->|"5. Insert order CREATED"| db
  order -->|"6. Authorize payment"| pay`,
      },
      steps: [
        'Diner opens the app; Search/Discovery service (Elasticsearch indexed by geohash cell + cuisine) returns nearby restaurants ranked by ETA and rating.',
        'Diner taps a restaurant; Catalog/Menu Service returns the live menu from a Redis-cached snapshot invalidated whenever the restaurant updates it (rare writes, extremely hot reads).',
        "Diner builds a cart; on checkout, Order Service re-validates each item's availability against the authoritative menu store — a stale cached menu could still show an item that just sold out.",
        'Order Service inserts an orders row with status CREATED and an idempotency key BEFORE calling any payment rail — the durable record that we attempted this order.',
        "Order Service calls the Payment Adapter to authorize (hold, not capture) the diner's card for the order total plus tip.",
        'On authorization success, the row is updated to PLACED and an order.placed event is published to Kafka, partitioned by restaurant/city. On failure, the row moves to PAYMENT_FAILED and the diner is asked to retry with a different instrument.',
        'Returns 201 Created with the order ID, status, and an initial ETA estimate.',
      ],
      closingNote:
        "Why authorize-then-capture instead of charging immediately? The restaurant hasn't confirmed it can make the order yet — capturing now and refunding on rejection is strictly worse for the diner (money leaves and returns) than never capturing at all. Why validate availability at checkout against the authoritative store instead of trusting the cached menu the diner is looking at? The cache exists purely for read scalability; checkout is the one moment correctness matters more than latency.",
    },
    {
      title: 'FR-2: Restaurant Accepts, Payment Is Captured, Dispatch Is Triggered',
      body:
        "The order now needs a human at the restaurant to say yes. This step also has to survive at-least-once delivery of the acceptance signal itself — a retried push notification or a flaky POS webhook must never trigger a second payment capture.",
      insightCallout:
        "Payment capture carries an idempotency key derived from {orderId}:capture, so even if the restaurant's POS retries the accept webhook, the payment rail itself dedupes the second attempt — the same fencing idea used in the wallet's Orpheus-style idempotency framework.",
      newComponents: [
        { name: 'Restaurant Notification / POS Bridge', description: "Pushes new orders to the restaurant's POS/tablet over a persistent connection or webhook, and relays accept/reject responses back." },
        { name: 'Payment Capture', description: 'Converts a held authorization into an actual charge, guarded by an idempotency key tied to the order.' },
        { name: 'Ledger/Payout Service', description: 'Posts a balanced entry crediting the restaurant payout account (net of commission) and the platform fee account whenever a capture succeeds.' },
        { name: 'Kafka (order events, partitioned by city)', description: 'Carries order.accepted downstream to the Dispatch Service without coupling it to the accept-request path.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  order[Order Service]:::compute
  notify[Restaurant Notification]:::compute
  pos[Restaurant POS]:::client
  pay[Payment Adapter]:::compute
  ledger[Ledger/Payout Service]:::compute
  db[("Postgres<br/>orders + ledger")]:::database
  k[["Kafka: order.accepted"]]:::async
  dispatch[Dispatch Service]:::compute

  order -->|"1. order.placed"| notify --> pos
  pos -->|"2. accept or reject"| notify --> order
  order -->|"3. Capture payment"| pay
  order -->|"4. Post payout entry"| ledger --> db
  order -->|"5. Update status ACCEPTED"| db
  order -->|"6. Publish order.accepted"| k --> dispatch`,
      },
      steps: [
        "order.placed event delivered to Restaurant Notification service, which pushes to the restaurant's POS/tablet over a persistent connection (or webhook if POS-integrated).",
        'Restaurant has a short window (~2 minutes) to accept, reject, or flag specific items unavailable — catching a menu/inventory race even if the checkout-time check missed it.',
        "On accept: Order Service transitions PLACED -> ACCEPTED, calls the Payment Adapter to capture the previously authorized hold, and posts a ledger entry crediting the restaurant's payout account net of platform commission, all guarded by the same idempotency key on retry.",
        'Order Service publishes order.accepted to Kafka, which triggers the Dispatch Service (Build 3).',
        "On reject/flag: the authorization hold is released (never captured, so no refund is needed), the diner is notified, and either the flagged item is dropped with a partial-cart re-confirmation or the whole order is cancelled, depending on diner preference.",
      ],
      closingNote:
        'A reject-before-capture is clean — nothing to undo. A cancellation after capture (diner cancels mid-PREPARING) is not: it needs an actual refund, and refund policy branches on the order\'s state at cancellation time, read from the authoritative store, never from a client-cached status.',
    },
    {
      title: 'FR-3: Dispatch — Matching a Nearby, Available Delivery Partner',
      body:
        "This is where most of the complexity lives. Finding candidates fast requires a geospatial index; picking the right candidate requires more than 'closest wins'; and offering the job to a partner requires a lock so two orders can never both claim the same courier.",
      insightCallout:
        "The geo index only needs to be eventually consistent — a partner's cell entry lagging by a couple of seconds costs us a slightly suboptimal candidate ranking, never an incorrect order. That's why it lives in Redis with a short TTL instead of the transactional order store.",
      newComponents: [
        { name: 'Location Ingestion', description: 'Receives partner GPS pings over a persistent connection and writes cell membership into the geo index.' },
        { name: 'Redis Geo Index (geohash/H3, per city)', description: 'Maps cell ID to the set of available partners currently in it, sharded per city for isolation.' },
        { name: 'Dispatch Service', description: 'Batches ready orders, queries the geo index for candidates, scores them, and manages the offer/timeout chain.' },
        { name: 'Offer/Lock Store (Redis)', description: 'A short-TTL lock keyed by partnerId that prevents a courier from being offered two orders at once.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  order[Order Service]:::compute
  k[["Kafka: order.accepted"]]:::async
  dispatch[Dispatch Service]:::compute
  geo[("Redis Geo Index<br/>per city")]:::cache
  lock[("Offer Lock<br/>Redis TTL")]:::cache
  partnerA[Partner A]:::client
  partnerB[Partner B]:::client
  ingest[Location Ingestion]:::compute

  order --> k --> dispatch
  dispatch -->|"1. Query nearby cells"| geo
  dispatch -->|"2. Lock candidate"| lock
  dispatch -->|"3. Offer, TTL 15s"| partnerA
  partnerA -.->|"decline/timeout"| dispatch
  dispatch -->|"4. Offer next candidate"| partnerB
  partnerA -->|"GPS ping"| ingest --> geo`,
      },
      steps: [
        "Ready orders are batched over a short rolling window (a few seconds); the Dispatch Service queries the restaurant's geo cell and its ring of neighbors for available partners, widening the ring only if fewer than K candidates are found.",
        'Candidates are scored by ETA-to-restaurant, idle time, and route efficiency (a partner already inbound to that restaurant for another pickup is favored) — a small assignment problem, not one-at-a-time nearest-neighbor.',
        'The top candidate is locked in the offer store (SETNX with a TTL slightly longer than the offer window) and sent a time-boxed offer, typically 12-15 seconds.',
        'On accept, the lock is cleared, the order is marked ASSIGNED, and the partner is handed pickup details. On decline or timeout, the lock expires and the next-ranked candidate is offered.',
        "If every nearby candidate declines or times out, the search radius widens to the next ring and, past a threshold, the order stays ACCEPTED with an extended ETA rather than failing outright.",
      ],
      closingNote:
        "Why a Redis lock instead of relying on the dispatcher's own process state? If the dispatcher crashes mid-offer, a lock owned by the process would never expire. A Redis key with its own TTL releases the partner even if the process that created the offer is gone.",
    },
    {
      title: 'FR-4: Live Tracking and ETA Fan-Out',
      body:
        'As the order proceeds through PICKED_UP, EN_ROUTE, and DELIVERED, both the diner and the restaurant want live status and, for the diner, a moving dot on a map. This path is deliberately decoupled from the order/payment path so it can be best-effort without risking correctness.',
      insightCallout:
        "Location updates only rewrite the geo index when a partner crosses a cell boundary, not on every 4-second ping — this keeps write amplification down without losing dispatch accuracy, since only the current cell matters for matching.",
      newComponents: [
        { name: 'Notification/Fan-out Service', description: 'Consumes the status/location Kafka stream and pushes updates to whichever channel (WebSocket or fallback poll) a client is using.' },
        { name: 'WebSocket Gateway', description: "Holds per-order/per-city pub/sub subscriptions and the client's socket, but never touches the order database directly." },
        { name: 'ETA Service', description: 'Consumes the same stream to recompute a blended ETA as real milestones (accepted, picked up) land.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  partner[Partner App]:::client
  ingest[Location Ingestion]:::compute
  geo[("Redis Geo Index")]:::cache
  k[["Kafka: status/location"]]:::async
  notify[Notification/Fan-out]:::compute
  ws[WebSocket Gateway]:::edge
  diner[Diner App]:::client
  eta[ETA Service]:::compute

  partner -->|"GPS ping every 4s"| ingest -->|"cell change only"| geo
  ingest --> k --> notify --> ws --> diner
  k --> eta --> ws`,
      },
      steps: [
        'Partner app streams GPS every ~4 seconds over a persistent connection into Location Ingestion.',
        'Location Ingestion updates the geo index only on a cell-boundary crossing, and publishes every raw ping to the status/location Kafka stream regardless (map display needs more granularity than dispatch does).',
        "Notification/Fan-out consumes the stream and pushes to the diner's WebSocket connection at the edge gateway; the ETA Service consumes the same stream to recompute and push a refreshed countdown.",
        "If the WebSocket drops (backgrounding, network handoff), the client falls back to polling GET /orders/{orderId}/tracking until it can reconnect — correctness of the order never depends on the socket staying open.",
      ],
      closingNote:
        'Why is this its own path instead of reusing the order database? Balance reads outnumber writes by orders of magnitude here too — every open order fans out location pushes every few seconds. Routing that through the same transactional store as payments would add load and latency for a screen that tolerates a few seconds of staleness by design.',
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1 - Order Placement Through Restaurant Acceptance',
      diagram: {
        mermaid: `sequenceDiagram
    actor Diner
    participant OS as Order Service
    participant PG as Postgres
    participant PAY as Payment Adapter
    participant K as Kafka
    participant RN as Restaurant Notification
    participant R as Restaurant POS
    participant LED as Ledger Service

    Diner->>OS: POST /orders (idempotency key)
    OS->>PG: INSERT order CREATED
    OS->>PAY: authorize hold
    PAY-->>OS: authorized
    OS->>PG: UPDATE status PLACED
    OS->>K: publish order.placed
    K->>RN: consume
    RN->>R: push new order
    R-->>RN: accept
    RN->>OS: accept
    OS->>PAY: capture (idempotent)
    OS->>LED: post payout entry
    OS->>PG: UPDATE status ACCEPTED
    OS->>K: publish order.accepted`,
      },
      nonObviousFailure:
        "If the process crashes after the order row is written as CREATED but before the authorization call returns, the order sits in CREATED indefinitely. A reconciler sweeps CREATED orders older than 60s, checks the payment adapter for a matching authorization by idempotency key, and either resumes (mark PLACED) or fails the order (mark PAYMENT_FAILED) — the same reconciler pattern used for wallet rail confirmations.",
    },
    {
      title: 'Flow 2 - Dispatch Offer/Timeout Chain',
      diagram: {
        mermaid: `sequenceDiagram
    participant D as Dispatch Service
    participant Geo as Redis Geo Index
    participant Lock as Offer Lock
    participant P1 as Partner A
    participant P2 as Partner B
    participant O as Order Service

    D->>Geo: nearby available partners
    Geo-->>D: [P1, P2, ...]
    D->>Lock: SETNX lock P1, TTL 20s
    D->>P1: offer, 15s timeout
    alt P1 accepts
        P1-->>D: accept
        D->>Lock: release
        D->>O: assigned = P1
    else P1 declines or times out
        P1--xD: decline/timeout
        D->>Lock: release
        D->>Lock: SETNX lock P2
        D->>P2: offer, 15s timeout
        P2-->>D: accept
        D->>O: assigned = P2
    end`,
      },
      nonObviousFailure:
        "If the Dispatch Service crashes after locking Partner A's offer but before the 15s window resolves, Partner A stays stuck out of the pool unless the lock has its own TTL independent of the dispatcher process. The lock is a Redis key with a TTL slightly longer than the offer window, not a flag the dispatcher owns in memory, so an offer always releases even if the process that created it is gone.",
    },
    {
      title: 'Flow 3 - Live Location Fan-Out During Delivery',
      diagram: {
        mermaid: `sequenceDiagram
    participant P as Partner App
    participant Ing as Location Ingestion
    participant Geo as Redis Geo Index
    participant K as Kafka
    participant N as Notification/Fan-out
    participant WS as WebSocket Gateway
    participant Diner

    loop every 4s
        P->>Ing: GPS ping
    end
    Ing->>Geo: update cell (boundary crossings only)
    Ing->>K: publish location tick
    K->>N: consume
    N->>WS: push update
    WS->>Diner: location + ETA
    Note over Diner: client interpolates<br/>between ticks (dead reckoning)`,
      },
      nonObviousFailure:
        "A partner's phone drops to a weak signal with 20s+ gaps between pings — the diner's map would otherwise jump discontinuously. Client apps interpolate between the last two known pings using dead-reckoning (heading + speed) rather than waiting for the next ping, so the dot appears to move smoothly even though the backend only updates every few seconds — the same trick ride-sharing platforms use to decouple display smoothness from ingestion frequency.",
    },
    {
      title: "Order State Machine",
      diagram: {
        mermaid: `stateDiagram-v2
    [*] --> CREATED
    CREATED --> PLACED: payment authorized
    CREATED --> PAYMENT_FAILED: authorization declined
    PLACED --> ACCEPTED: restaurant accepts, capture succeeds
    PLACED --> REJECTED: restaurant rejects, hold released
    ACCEPTED --> PREPARING
    PREPARING --> READY_FOR_PICKUP
    READY_FOR_PICKUP --> PICKED_UP: partner assigned and collects
    PICKED_UP --> EN_ROUTE
    EN_ROUTE --> DELIVERED
    PLACED --> CANCELLED: diner cancels, hold released
    PREPARING --> CANCELLED: diner cancels, partial refund
    DELIVERED --> REFUNDED: post-delivery dispute
    DELIVERED --> [*]
    REJECTED --> [*]
    PAYMENT_FAILED --> [*]
    CANCELLED --> [*]
    REFUNDED --> [*]`,
      },
      nonObviousFailure:
        "Every transition is a compare-and-set in the DB (UPDATE orders SET status = 'ACCEPTED' WHERE id = ? AND status = 'PLACED'). Illegal or duplicate transitions — a retried restaurant-accept push, a client replaying a stale action — don't throw, they simply update 0 rows and no-op. Callers must check the affected row count, not assume success from a 200 response.",
    },
  ],

  deepDives: [
    {
      title: 'Nearby-Partner Search: Why a Location Table Does Not Scale',
      problem:
        'Finding "delivery partners within 2 km of this restaurant" cannot be a scan of a location table at this scale — positions change every few seconds for tens of thousands of active partners per city.',
      simpleTerms:
        "Instead of asking 'how far is every courier from this restaurant' one by one, we bucket the map into small squares (or hexagons). Finding nearby couriers becomes 'look in this square and its immediate neighbors' instead of scanning the whole city.",
      bad:
        'A relational partners table with lat/lng columns; every order runs SELECT * FROM partners ORDER BY distance(lat,lng) LIMIT K. This is a full scan (or a crude bounding-box index) against a table where every row changes every few seconds. At a few hundred orders/sec and tens of thousands of moving partners, this collapses immediately.',
      good:
        "Redis's native geospatial commands (GEOADD to insert lat/lng, GEORADIUS/GEOSEARCH to query) hold every partner in a single sorted set backed by a geohash-derived score, giving sub-millisecond radius queries. This clears the naive bottleneck, but a single city-wide set is still a single hot key under heavy write load (every 4s partner ping is a write), doesn't isolate one city's load from another's, and widening the search when too few candidates are found means re-querying with a larger radius each time rather than a native ring-expansion primitive.",
      great:
        "Geohash or H3 cell bucketing, sharded per city, with ring expansion and boundary hysteresis. Each partner's position maps to a cell ID sized to roughly the target search radius (a few hundred meters to ~1km depending on city density); the index is a map from cell ID to the set of partner IDs currently in it, held in a per-city Redis instance/cluster so one city's write volume never contends with another's. Dispatch starts a search at the restaurant's cell, checks its immediate ring of neighbors, and only widens to ring 2, 3... if fewer than K candidates are found — most searches resolve at ring 0 or 1. Boundary hysteresis (only rewriting a partner's cell membership once they've moved a small buffer distance past the boundary, not the instant they cross it) cuts index write amplification from partners oscillating near a cell edge. H3's hexagonal cells are often preferred over square geohash cells specifically because every neighbor is equidistant from the center — a geohash cell's diagonal neighbors are farther away than its edge neighbors, which subtly biases ring-expansion search.",
      diagram: {
        mermaid: `flowchart TD
  subgraph "City Shard A"
    center["Restaurant Cell"]:::cache
    ring1["Ring 1 Neighbors"]:::cache
    ring2["Ring 2 Neighbors"]:::cache
    center -->|"0 candidates found"| ring1
    ring1 -->|"still fewer than K"| ring2
  end
  ingest[Location Ingestion]:::compute
  partner[Delivery Partner]:::client
  partner -->|"GPS ping"| ingest -->|"write cell on boundary cross"| center`,
      },
    },
    {
      title: 'Batched Dispatch and the Offer/Timeout Chain',
      problem:
        "Naive 'assign to nearest partner' the instant an order is ready ignores that the nearest partner might already be finishing another delivery two minutes away, and produces worse aggregate outcomes than briefly batching orders and partners together.",
      bad:
        'Assign the single nearest available partner to each order the instant it is ready, one order at a time, with no lock — the same partner can be offered two concurrent orders from different dispatcher threads, and either both offers race or one silently overwrites the other.',
      good:
        'Add an explicit per-partner offer lock (Redis SETNX) so only one offer is outstanding per partner at a time, with a short timeout (12-15s) and sequential fallback to the next-ranked candidate on decline or timeout. This fixes double-assignment and is a big step up, but still evaluates orders one at a time in arrival order, so a partner idle three minutes away can be assigned to a far order while a much closer one appears seconds later.',
      simpleTerms:
        "Rather than handing out delivery jobs one at a time as they arrive, wait a few seconds to see what jobs and couriers are available together, then match them as a group — like a dispatcher looking at the whole board instead of grabbing the first available driver for each call.",
      great:
        "Batch orders that complete their prep-time window within a short rolling interval (a few seconds) and solve a mini assignment problem (greedy or Hungarian-algorithm-style) over available partners and ready orders, scoring by ETA-to-pickup, partner idle time, and route efficiency (a partner already inbound to that restaurant for another pickup is favored). Each offer still uses the same fencing-token-style lock with its own TTL, independent of the dispatcher process, so a dispatcher crash mid-offer can never leave a partner stuck. Past a threshold of consecutive declines for one order, the search ring widens and, eventually, incentives can be escalated for that specific order rather than stalling the whole batch.",
    },
    {
      title: 'Restaurant Menu and Inventory Availability Under Concurrent Orders',
      problem:
        "An item sells out between when a diner views the menu and when they check out, and two diners can race for the last portion of a limited dish at the same moment.",
      simpleTerms:
        "It's a 'sold out' race — two diners both see the last plate of biryani on the menu and both try to order it in the same second.",
      bad:
        "The menu is cached in Redis with no expiry, and the availability flag only flips when the restaurant manually toggles it in the POS, often minutes after the item actually ran out. Diners order dishes that are already gone; the restaurant has to reject the order after the fact, and the diner is left waiting on a rejection instead of never seeing the option at all.",
      good:
        "The menu cache carries a short TTL (30-60s) and checkout re-validates each item's availability boolean against the authoritative Catalog/Menu store, not just against what the diner is looking at. This shrinks the staleness window a lot, but a genuine race still exists inside that window — two checkouts within the same second can both pass the boolean check before either decrements anything.",
      great:
        "For items with a real countable inventory, model available_qty as an atomic counter decremented inside the order-creation transaction: UPDATE menu_items SET available_qty = available_qty - :qty WHERE item_id = :id AND available_qty >= :qty. Zero rows affected means sold out — the order fails fast with a clear message instead of silently being placed unfulfillable. For most items (not literally countable, like a pizza style), a simple available boolean is enough, toggled by the restaurant's POS integration or by staff, and treated as advisory at browse time but authoritative at checkout. The restaurant's own accept/reject step is the final backstop: even if a race slips through both checks, the restaurant can flag the specific item unavailable at acceptance time, and the platform apologizes or partially refunds rather than trusting the software chain blindly all the way through.",
    },
    {
      title: 'Live Order Tracking: WebSocket Push vs Client Polling',
      problem:
        "Diners and restaurants want low-latency updates on order status and delivery-partner location, but holding millions of concurrent connections and pushing on every micro-movement is a real infrastructure cost with its own failure modes.",
      bad:
        'The client polls GET /orders/{orderId}/tracking every 2 seconds regardless of whether anything actually changed. Backend load scales with (open orders x poll frequency) even during quiet periods, wastes battery and bandwidth on mobile networks, and users still perceive latency up to a full poll interval even when something did change.',
      good:
        "Replace polling with a persistent WebSocket per active order; the server pushes only on an actual change (a location tick or a status transition), so update volume tracks real system activity instead of device wall-clock. Latency drops from poll-interval to near-real-time. The genuine cost: holding millions of concurrent stateful connections at the edge is an operationally different problem than a stateless REST tier — connection-heavy load balancing, and reconnection storms if the WebSocket fleet bounces.",
      simpleTerms:
        "Instead of the app asking 'anything new?' every couple of seconds forever, the server taps the app on the shoulder only when something actually changes — fewer wasted requests, and updates arrive faster.",
      great:
        "A hybrid: WebSocket is the primary channel for any order currently active (post-ACCEPTED, pre-DELIVERED), with automatic fallback to short-interval polling if the socket drops (mobile network handoff, app backgrounding) — correctness never depends on a persistent connection staying open. The edge WebSocket gateway holds only connection state and subscribes to a per-order or per-city pub/sub topic; it never touches the order database directly, so a gateway restart just makes clients reconnect and resubscribe with zero data loss, since the source of truth is Kafka/Postgres, not the socket layer. Client-side dead-reckoning interpolation (extrapolating a partner's position between real ticks using last known heading and speed — the same technique ride-sharing platforms use) lets the backend keep pinging every 3-5 seconds without the map looking jumpy, decoupling perceived smoothness from ingestion cost. Location pushes are additionally throttled to a minimum distance/time delta since the last pushed point, and coalesced during idle periods (a partner parked collecting an order), so a stationary courier doesn't wake up every diner's device for nothing.",
    },
    {
      title: 'ETA Prediction Under Three-Way Uncertainty',
      problem:
        'ETA has three independent uncertain legs — restaurant prep time, partner travel to the restaurant, and travel from restaurant to diner — and a naive fixed estimate is wrong in exactly the situations customers notice most (a busy Friday night, a dense one-way street grid).',
      bad:
        'A single fixed formula: prep time is a flat constant (e.g., "15 minutes for every restaurant") and travel time is straight-line distance multiplied by an assumed average speed. This breaks badly the moment a restaurant is unusually busy, or the straight-line path crosses a river or a one-way grid that the real route cannot follow.',
      good:
        'Model prep time per restaurant from historical accept-to-ready timestamps rather than a global constant, and replace straight-line distance with a routing engine (map-matched road network with live traffic weighting) for both travel legs. This is a large accuracy jump, but the estimate is still frozen at order time and can visibly diverge from reality as the order actually plays out.',
      great:
        'A blended, live-updating model: each real milestone as it lands (order accepted, prep started, food ready, partner picked up, en route) replaces a modeled estimate for that leg with an observed timestamp and re-forecasts only the remaining legs. Per-restaurant prep models retrain on a rolling window so a restaurant\'s Friday-night behavior is treated differently from its 3pm behavior. The displayed countdown is smoothed to shrink roughly monotonically rather than jump or grow, because customers tolerate a shrinking number far better than a static or increasing one — even when that means the displayed number briefly lags what the raw model just recomputed.',
    },
    {
      title: 'Order State Machine and Idempotent Payment Capture',
      problem:
        "Network retries and at-least-once delivery are guaranteed to happen. A duplicate 'restaurant accepted' push, or a client replaying a stale action, must never double-capture a payment or move an order backward.",
      bad:
        'Order status is a mutable string column updated by whichever service call lands last, with no check of the current state before writing the new one. A retried accept webhook calls capture twice; a client showing a stale cached "PLACED" screen sends a duplicate accept request that the server happily re-processes.',
      good:
        'An explicit state machine with application-level validation of allowed transitions, plus an idempotency key on payment capture keyed by orderId — a retried capture call returns the original result instead of charging again.',
      great:
        "The same idea enforced at the database layer, not just in application code: every transition is a compare-and-set (UPDATE orders SET status = 'ACCEPTED' WHERE id = ? AND status = 'PLACED'), and payment capture is wrapped in the same database transaction as the state transition, with the idempotency key deterministically derived from {orderId}:capture so even a retried call to the payment rail itself is deduped by the rail, not just by us. Illegal transitions don't throw — they silently affect 0 rows, and callers must check the affected-row count rather than assume success from a 200 response, mirroring the wallet's transaction state machine pattern. Cancellations after acceptance are the hardest case: refund policy branches on which state the order was in at cancellation time, read from the authoritative store at request time, never from a client-cached status — a PLACED cancellation releases the never-captured hold, while a PREPARING cancellation captures then issues a partial refund since the restaurant already incurred food cost.",
    },
  ],

  selfAudit: [
    {
      question: "What happens if every nearby delivery partner declines or times out on an order's offer chain?",
      answer:
        'The dispatch service widens the search radius (next ring of geohash/H3 neighbor cells) and can escalate incentives for that specific order after a threshold number of declines, while the order itself stays ACCEPTED with an extended ETA rather than failing outright.',
    },
    {
      question: 'Two dispatch workers process the same order concurrently during a rebalance — could a partner get double-assigned?',
      answer:
        'An accepted-but-not-yet-committed offer places a Redis lock with its own TTL on the partner, independent of any single dispatcher process, so a second concurrent offer to the same partner is rejected until the first offer resolves or its lock expires.',
    },
    {
      question: "A delivery partner's phone loses GPS signal mid-delivery — what does the diner see?",
      answer:
        'The tracking screen shows the last known location with a staleness indicator, and the client dead-reckons a smoothed position from the last known heading/speed rather than freezing or erroring; order status transitions continue independently of the location feed since they come from a separate event stream.',
    },
    {
      question: 'How does geo-partitioning actually stop a spike in one city from affecting another?',
      answer:
        "Order events are partitioned by city on the Kafka topic, dispatch and geo-index instances are provisioned and scaled per city, and the order database is sharded by city — so a lunch-rush spike in one metro saturates only that city's partition/shard, not shared infrastructure other cities depend on.",
    },
    {
      question: 'A diner cancels an order right as the restaurant marks it PREPARING — what determines the refund outcome?',
      answer:
        'The Order service reads the authoritative current state from its store (never a client-cached status) at the moment the cancellation lands, and refund policy branches on that state — a PLACED cancellation is a full refund of the never-captured hold, while a PREPARING cancellation may apply a partial refund since the restaurant has already incurred cost.',
    },
    {
      question: 'How are restaurants and delivery partners actually paid?',
      answer:
        'Capture posts a ledger entry crediting the restaurant payout account net of commission at acceptance time; delivery-partner payouts accrue per completed delivery. Both are settled on a batch schedule (e.g., weekly) separate from the diner-facing order flow, the same settlement-lag pattern a digital wallet uses between a trade executing and cash actually clearing.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  diner[Diner App]:::client
  partner[Partner App]:::client
  restaurant[Restaurant POS]:::client
  gw[API Gateway]:::edge

  subgraph "Discovery & Catalog"
    search[("Search Index<br/>Elasticsearch")]:::storage
    catalog[("Menu Cache<br/>Redis")]:::cache
  end

  subgraph "Order & Payment"
    order[Order Service]:::compute
    orderdb[("Postgres<br/>orders sharded by city")]:::database
    pay[Payment Adapter]:::compute
    ledger[Ledger/Payout Service]:::compute
  end

  subgraph "Dispatch"
    queue[["Kafka: order events, per city"]]:::async
    dispatch[Dispatch Service]:::compute
    geo[("Redis Geo Index<br/>per city")]:::cache
    lock[("Offer Lock")]:::cache
    ingest[Location Ingestion]:::compute
  end

  subgraph "Live Tracking"
    notify[Notification/Fan-out]:::compute
    ws[WebSocket Gateway]:::edge
    eta[ETA Service]:::compute
  end

  diner --> gw
  restaurant --> gw
  partner --> gw
  gw --> search
  gw --> catalog
  gw -->|"place/accept/reject"| order --> orderdb
  order --> pay
  order --> ledger --> orderdb
  order -->|"ACCEPTED"| queue --> dispatch
  dispatch -->|"nearby partners"| geo
  dispatch -->|"lock candidate"| lock
  dispatch -->|"offer"| partner
  partner -->|"GPS ping"| ingest --> geo
  ingest --> queue --> notify --> ws --> diner
  queue --> eta --> ws`,
    bullets: [
      "Diner browses and orders - Search/Discovery and Menu Cache serve the browse path; Order Service validates availability and authorizes payment on checkout",
      'Restaurant accepts - a push through the Restaurant Notification path captures payment and posts a payout ledger entry, then publishes order.accepted',
      'Dispatch matches a partner - the Dispatch Service batches ready orders, queries the per-city Redis geo index, and runs the offer/timeout chain with a fencing-style lock',
      'Partners stream location - GPS pings update the geo index on cell-boundary crossings and flow into the same Kafka stream that feeds live tracking',
      'Live tracking fans out - Notification/Fan-out pushes over the WebSocket Gateway to the diner, falling back to polling if the socket drops; the ETA Service recomputes a blended estimate as milestones land',
      "Per-city partitioning throughout - Kafka topics, geo-index shards, and the order database are all partitioned by city so one city's peak never degrades another",
    ],
  },

  keyTechnologies: [
    { term: 'Geohash', definition: 'A hierarchical spatial encoding that maps latitude/longitude into a string prefix, letting nearby points share prefixes for fast proximity bucketing.' },
    { term: 'H3', definition: "Uber's hexagonal hierarchical geospatial indexing system, offering more uniform cell shapes and neighbor lookups than square geohash grids." },
    { term: 'Redis GEOADD/GEORADIUS', definition: 'Redis geospatial commands that store points and query members within a radius, giving sub-millisecond nearby-partner lookups before graduating to sharded cell bucketing.' },
    { term: 'Hungarian Algorithm', definition: 'A polynomial-time algorithm for optimal assignment problems, used to batch-match available delivery partners to ready orders, minimizing total cost/distance.' },
    { term: 'Idempotency Key', definition: 'An identifier derived from order ID and transition type attached to payment-affecting operations so retries never double-capture or double-refund.' },
    { term: 'Order State Machine', definition: 'An explicit model of valid order status transitions enforced via compare-and-set writes, rejecting out-of-order or duplicate transition events.' },
    { term: 'Dead Reckoning', definition: "Client-side interpolation of a moving partner's position between real GPS ticks using last known heading and speed, decoupling display smoothness from ingestion frequency." },
    { term: 'Kafka Partitioning by City', definition: 'Partitioning order and location event topics by city so per-city consumer groups and downstream load scale and fail independently of other cities.' },
  ],

  expectedDepth: {
    mid: 'Identifies that a naive nearest-partner SQL scan cannot scale and proposes a geospatial index as the fix. Understands that payment should be authorized before capture and that a restaurant needs to accept an order before it is dispatched.',
    senior:
      'Designs the geo-cell-bucketed dispatch service with batched assignment and offer/timeout chains, separates order consistency from location freshness, and explains why menu availability must be re-checked at checkout against an authoritative store rather than a client-cached menu. Discusses idempotent payment capture and the WebSocket-vs-polling tradeoff for live tracking.',
    staffPlus:
      "Reasons about per-city geo-partitioning for blast-radius isolation, the batching-vs-immediate-dispatch tradeoff under peak load, and how the order state machine keeps idempotent payment capture safe under retries and cancellations. Addresses the countable-inventory race on limited-quantity menu items, the settlement/payout ledger for restaurants and delivery partners as a first-class concern, and how dead-reckoning interpolation and cell-boundary hysteresis decouple perceived UX quality from raw ingestion cost.",
  },

  keyTakeaways: [
    'Geohash/H3 cell bucketing turns "nearest partner" from a distance scan into a cell-and-neighbor-ring lookup, which is what makes matching sub-millisecond at scale.',
    'Splitting order/payment (strongly consistent) from location/dispatch (eventually consistent) means a caching-layer outage degrades the map, never the money.',
    'Batched assignment over a short window beats greedy nearest-available on aggregate route efficiency, at the cost of a small deliberate per-order delay.',
    'Menu availability is advisory at browse time but authoritative at checkout — an atomic counter decrement (or the restaurant\'s own reject step) is the real backstop against overselling.',
    'A hybrid WebSocket-with-polling-fallback, paired with client-side dead reckoning, delivers a smooth live-tracking UX without making a persistent connection a correctness dependency.',
  ],

  relatedDesigns: ['ride-sharing', 'digital-wallet', 'notification-system'],
  relatedConcepts: [
    { name: 'Geospatial Indexing', description: 'Buckets moving delivery-partner positions into cells so nearby-candidate search is a lookup, not a scan.' },
    { name: 'Message Queues', description: 'Decouples order-state transitions from dispatch, tracking, and notification consumers via a partitioned event log.' },
    { name: 'WebSockets & Push Notifications', description: 'Delivers live order status and location updates with lower latency and less redundant traffic than polling.' },
    { name: 'Idempotency', description: 'Guards payment authorization, capture, and restaurant-accept transitions against retries and duplicate delivery.' },
    { name: 'State Machines', description: 'Models the order lifecycle so out-of-order or duplicate transitions are rejected rather than silently corrupting state.' },
  ],

  simulator: {
    goalDescription: 'Match diners, restaurants, and delivery partners in real time without corrupting an order or double-capturing a payment.',
    requirementChips: ['Dispatch decision < few hundred ms', '~18.75K location pings/sec', 'Never double-capture payment'],
    targetRps: 20000,
    readRatio: 0.35,
    cacheHitRatio: 0.9,
    latencyBudgetMsP99: 300,
    rubric: [
      { id: 'edge-gateway', label: 'API Gateway at the edge', kind: 'requires-node-type', nodeType: 'api-gateway' },
      { id: 'geo-index', label: 'Geo index for nearby-partner lookup (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'order-store', label: 'Strongly-consistent order/payment store', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'event-bus', label: 'Partitioned event log for orders and location (Kafka)', kind: 'requires-node-type', nodeType: 'kafka' },
      {
        id: 'compute-tier',
        label: 'Compute tier for order, dispatch, and notification services',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 120 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 120 } },
        { id: 'order-1', type: 'app-server', instanceCount: 10, position: { x: 600, y: 120 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 12, position: { x: 880, y: 40 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 6, position: { x: 880, y: 200 } },
        { id: 'dispatch-1', type: 'microservice', instanceCount: 8, position: { x: 1160, y: 120 } },
        { id: 'geo-1', type: 'redis', instanceCount: 4, position: { x: 1160, y: 280 } },
        { id: 'notify-1', type: 'worker', instanceCount: 6, position: { x: 1440, y: 120 } },
        { id: 'ws-1', type: 'api-gateway', instanceCount: 4, position: { x: 1720, y: 120 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-order', source: 'gw-1', target: 'order-1' },
        { id: 'e-order-pg', source: 'order-1', target: 'pg-1' },
        { id: 'e-order-kafka', source: 'order-1', target: 'kafka-1' },
        { id: 'e-kafka-dispatch', source: 'kafka-1', target: 'dispatch-1' },
        { id: 'e-dispatch-geo', source: 'dispatch-1', target: 'geo-1' },
        { id: 'e-dispatch-pg', source: 'dispatch-1', target: 'pg-1' },
        { id: 'e-kafka-notify', source: 'kafka-1', target: 'notify-1' },
        { id: 'e-notify-ws', source: 'notify-1', target: 'ws-1' },
        { id: 'e-ws-client', source: 'ws-1', target: 'client-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Order/payment state is strongly consistent in Postgres sharded per city, while Kafka fans out order and location events to an eventually-consistent geo-dispatch layer (Redis cell index + offer locks) and a live-tracking layer (WebSocket fan-out), so a stale location or a tracking hiccup can never corrupt an order or double-capture a payment.',
    failureModeNarratives: {
      postgresql: "Only one strongly-consistent order/payment store per city shard; if a city's shard goes down, that city cannot place or accept new orders even though dispatch and tracking for in-flight orders may continue.",
    },
    fullDesignLinkSlug: 'food-delivery',
  },
}

export default topic
