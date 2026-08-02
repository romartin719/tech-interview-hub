import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'ticket-booking',
  title: 'Ticket Booking (BookMyShow / Ticketmaster)',
  difficulty: 'Intermediate',
  icon: 'pi pi-ticket',
  color: '#f59e0b',
  readTimeMinutes: 26,
  topics: ['Distributed Locking', 'Seat Reservation', 'Payment Saga', 'TTL Holds', 'Inventory Management'],
  companies: ['Ticketmaster', 'BookMyShow', 'Amazon', 'Flipkart', 'PhonePe'],
  prerequisites: ['Caching', 'Message Queues', 'Saga Pattern'],
  summary:
    "A high-throughput seat-booking platform that uses a Redis SET NX EX distributed lock with a 10-minute TTL to hold seats during checkout, and a payment saga with idempotency keys to confirm bookings or roll back cleanly on failure - without double-booking or double-charging.",

  understandingProblem:
    "A ticket booking platform lets users browse movies and events, view available seats on a seat map, temporarily hold selected seats while completing payment, and receive confirmed tickets. The hard part? When 100K users rush to book seats for a popular movie premiere at the same time, no two users should ever successfully book the same seat, held seats must auto-release if payment isn't completed within 10 minutes, and the system must handle payment failures gracefully without leaving seats in a limbo state.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  User["User Browser"]:::client
  API["API Server"]:::compute
  DB[("Postgres DB")]:::database
  PG["Payment Gateway"]:::edge

  User --> API
  API --> DB
  API --> PG`,
    },
    whyThisBreaks: [
      'Two users select the same seat simultaneously - both see it as "available" - both attempt to book - double-booking',
      'If payment fails after marking seat as "booked," the seat is stuck - no one can book it (orphaned reservation)',
      "Single API server can't handle 100K concurrent users rushing for a hot event (Avengers premiere, IPL final)",
      'No seat hold mechanism - user selects seats, goes to payment, comes back 5 minutes later and seats were taken by someone else',
      'No way to show real-time seat availability updates to other users viewing the same show',
      'Single Postgres DB becomes a write bottleneck when 50K users try to lock seats simultaneously',
    ],
    closingNote:
      'The rest of the doc evolves this into a production-grade booking system with distributed locks, TTL-based holds, and payment saga patterns.',
  },

  priorArt: [
    {
      title: 'Ticketmaster Virtual Queue',
      description:
        'Uses a virtual waiting room during high-demand on-sales. Users are assigned random positions in a queue, preventing thundering herd on the booking system. Processes users in controlled batches. (Ticketmaster Tech Blog)',
      link: 'https://blog.ticketmaster.com/how-ticketmaster-queue-works/',
    },
    {
      title: 'Stripe Idempotency Keys',
      description:
        'Guarantees exactly-once payment processing using client-generated idempotency keys. If a payment request is retried, the same result is returned without double-charging. (Stripe Engineering)',
      link: 'https://stripe.com/blog/idempotency',
    },
    {
      title: 'BookMyShow Engineering',
      description:
        'Handles 20M+ users for major movie releases using Redis-based seat locking with TTL, event-driven architecture with Kafka, and eventual consistency for non-critical reads. (BookMyShow Engineering Blog)',
    },
    {
      title: 'Razorpay Payment Orchestration',
      description:
        'Multi-gateway payment routing with automatic failover. Implements saga pattern for coordinating booking + payment as a distributed transaction. (Razorpay Engineering)',
      link: 'https://razorpay.com/blog/multi-gateway-routing-payment-orchestration-in-india-how-smart-routing-improves-success-rates/',
    },
    {
      title: 'Amazon DynamoDB Transactions',
      description:
        'Demonstrates conditional writes with version checks for exactly-once operations in distributed systems. Used internally for inventory management at Amazon retail. (AWS Blog)',
      link: 'https://aws.amazon.com/blogs/developer/using-improved-conditional-writes-in-dynamodb/',
    },
  ],

  coreEntities: [
    { name: 'Movie/Event', description: 'id, title, genre, language, duration, poster, rating.' },
    { name: 'Show', description: 'id, movieId, cinemaHallId, startTime, endTime, pricing tiers.' },
    { name: 'Seat', description: 'id, hallId, row, number, category (Silver/Gold/Platinum), status.' },
    {
      name: 'ShowSeat',
      description: 'showId + seatId composite, state (AVAILABLE/HELD/BOOKED), heldBy, heldUntil, bookedBy.',
    },
    {
      name: 'Booking',
      description: 'id, userId, showId, seatIds[], status (INITIATED/HELD/CONFIRMED/CANCELLED/EXPIRED), paymentRef, totalAmount.',
    },
    {
      name: 'Payment',
      description: 'id, bookingId, amount, status (PENDING/SUCCESS/FAILED/REFUNDED), gateway, idempotencyKey.',
    },
  ],

  requirements: {
    core: [
      'Browse and select seats - users view available shows, see a real-time seat map, and select specific seats for booking',
      'Hold seats and complete payment - selected seats are temporarily held (10 min TTL) while user completes payment; seats auto-release on expiry',
      'Confirm booking - after successful payment, seats are permanently marked as booked and user receives a ticket/confirmation',
    ],
    belowTheLine: [
      'Browse movies/events by city, genre, language',
      'Cancellation and refunds',
      'Promotional codes and discounts',
      'Notifications (booking confirmation, show reminders)',
      'Reviews and ratings',
      'Waitlist for sold-out shows',
    ],
    nonFunctionalTable: [
      { metric: 'No double-booking', target: 'Two users must never successfully book the same seat - strong consistency on seat state' },
      { metric: 'Hold expiry', target: 'Held seats auto-release exactly at TTL expiry (10 min); no manual intervention needed' },
      { metric: 'Peak concurrency', target: 'Handle 100K+ concurrent booking attempts for a single hot show (movie premiere, concert)' },
      { metric: 'Booking latency', target: 'Seat hold acquired in < 500ms; end-to-end booking (select -> pay -> confirm) < 30 seconds' },
      { metric: 'Availability (browsing)', target: '99.99% - eventual consistency acceptable for browsing' },
      { metric: 'Seat map render', target: '< 2 seconds with real-time availability' },
      { metric: 'Payment processing SLA', target: '< 10 seconds' },
      { metric: 'Catalog scale', target: 'Support 50K+ shows across 1000+ cinemas' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Seat Lock Store',
      purpose: 'seatId -> userId + expiryTime, atomic CAS + TTL expiry',
      primaryPick: 'Redis Cluster',
      alternatives: 'DynamoDB (conditional writes), Hazelcast',
      whyPrimaryWins: 'SET NX EX gives an atomic compare-and-swap plus auto-release in one round trip; a single shard handles 300K+ ops/sec where Postgres row-level locks would deadlock and exhaust the connection pool at 100K concurrent holders',
    },
    {
      tier: 'Booking DB',
      purpose: 'Booking lifecycle state, seat assignments, payment refs',
      primaryPick: 'Postgres',
      alternatives: 'CockroachDB, TiDB',
      whyPrimaryWins: 'ACID transactions plus a UNIQUE(showId, seatId) WHERE status=CONFIRMED constraint make it the final backstop against double-booking even if Redis has a split-brain',
    },
    {
      tier: 'Event Catalog',
      purpose: 'Movies, shows, cinemas, schedules',
      primaryPick: 'Postgres read replicas',
      alternatives: 'MongoDB',
      whyPrimaryWins: 'Read-heavy browsing traffic scales horizontally on replicas while writes (new shows) stay rare and go to the primary',
    },
    {
      tier: 'Cache',
      purpose: 'Show listings and aggregated seat-availability snapshots',
      primaryPick: 'Redis Cluster',
      alternatives: 'Memcached',
      whyPrimaryWins: 'A few seconds of staleness on "45/200 seats left" is fine for browsing, so caching it keeps thousands of concurrent viewers off the DB entirely',
    },
    {
      tier: 'Event Bus',
      purpose: 'Booking lifecycle events (confirmed, expired, seat released)',
      primaryPick: 'Kafka',
      alternatives: 'Redpanda, Kinesis, RabbitMQ',
      whyPrimaryWins: 'A single booking triggers 5+ downstream actions (email, seat-map invalidation, analytics, invoicing); consumer groups let each react independently without blocking the booking path',
    },
    {
      tier: 'Payment Gateway',
      purpose: 'External charge/refund processing',
      primaryPick: 'Razorpay or Stripe',
      alternatives: 'PayU, PayTM',
      whyPrimaryWins: "Client-generated idempotency keys guarantee exactly-once charging on retry, which the saga's compensating-refund step depends on",
    },
  ],
  technologyChoicesNote:
    "Why Redis over Postgres row-level locks for seat holds? During a hot on-sale, 100K users can hit the same show in 10 seconds - Redis's single-threaded SET NX EX resolves each contention in one atomic round trip, while Postgres SELECT ... FOR UPDATE would serialize competing transactions behind lock waits and exhaust the connection pool. Postgres still backstops the system with a unique constraint, so a Redis split-brain can never actually produce a double-booked seat.",

  scaleEstimation: [
    'Users: 10M DAU, 100K+ concurrent during hot event launch (Avengers premiere, IPL final)',
    'Write QPS: 50K booking attempts/min peak (~833/sec sustained, bursty during on-sale windows)',
    'Read QPS: 300K seat-status reads/sec during on-sale (50K users refreshing seat maps every 2-3s)',
    'Storage: ~500GB booking data/year (5M bookings/day x booking + payment metadata)',
    'Bandwidth: ~1 Gbps at peak (seat map pushes via SSE + API responses)',
    'Technology choices: Booking DB -> Postgres (booking lifecycle state, seat assignments, payment refs); Seat Lock Store -> Redis Cluster (seatId -> userId + expiryTime, atomic CAS + TTL expiry); Event Catalog -> Postgres read replicas (movies, shows, cinemas, schedules); Event Bus -> Kafka or Redpanda (booking lifecycle events, pub/sub per show); Cache -> Redis Cluster (show listings, seat availability snapshots); Queue -> SQS or Kafka (virtual waiting room, FIFO with priorities); Payment Gateway -> Razorpay or Stripe (external transactions via webhooks)',
    'Why Redis for seat locks, not Postgres row-level locks? During a hot event, 100K users hit the system in 10 seconds. Each seat lock attempt is a SET seatId NX EX 600 (atomic check-and-set with 10-min TTL). Redis handles 300K+ ops/sec per shard in-memory - Postgres row-level locks would create massive lock contention, connection pool exhaustion, and deadlocks',
    "Why Kafka for booking events? A single booking triggers 5+ downstream actions: send confirmation email, update seat map cache, record analytics, trigger invoice generation, update show occupancy counter. Kafka's consumer groups let each downstream service process independently without blocking the booking path",
  ],

  apiInterface: [
    {
      method: 'GET',
      path: '/api/v1/shows/{showId}/seats',
      description:
        'Returns current availability. HELD seats show as unavailable. Auth: JWT Bearer token.',
      example: '// Response\n{ seats: [{ seatId, row, number, category, status, price }] }',
    },
    {
      method: 'POST',
      path: '/api/v1/bookings/hold',
      description:
        'Idempotency via clientRequestId header. Hold TTL = 10 minutes. Auth: JWT Bearer token.',
      example:
        '// Request\n{ showId, seatIds: ["A1", "A2", "A3"] }\n\n// Response\n{ bookingId, status: "HELD", expiresAt, totalAmount }',
    },
    {
      method: 'POST',
      path: '/api/v1/bookings/{bookingId}/pay',
      description:
        'Idempotency key prevents double-charge on retry. Auth: JWT Bearer token.',
      example:
        '// Request\n{ paymentMethod: "upi", idempotencyKey: "uuid-v4" }\n\n// Response\n{ bookingId, status: "CONFIRMED", paymentId, tickets: [] }',
    },
    {
      method: 'DELETE',
      path: '/api/v1/bookings/{bookingId}',
      description: 'Cancels a booking and releases its held/booked seats. Auth: JWT Bearer token.',
      example: '// Response\n{ status: "CANCELLED", seatsReleased: ["A1", "A2", "A3"] }',
    },
    {
      method: 'GET',
      path: '/api/v1/movies?city=bangalore&date=2026-01-15',
      description: 'Auth: Optional (public endpoint, rate limited).',
      example: '// Response\n{ movies: [{ id, title, shows: [{ showId, time, cinema, availability }] }] }',
    },
  ],

  highLevelDesignIntro: "Let's build this incrementally, one functional requirement at a time.",

  builds: [
    {
      title: 'FR1: Browse Shows and View Seat Map',
      body:
        "The first interaction: user opens the app, picks a city, selects a movie, chooses a show time, and sees a seat map with real-time availability (green = available, red = booked, yellow = held by someone else). This is a read-heavy path - thousands of users viewing the same show's seat map simultaneously.",
      insightCallout:
        'We cache at the "show availability" level (e.g., "Show X has 45/200 seats available") for browsing, but hit the seat lock store directly for the actual seat map. Browsing doesn\'t need perfect consistency - a 5-second stale count is fine.',
      newComponents: [
        { name: 'API Gateway', description: 'Entry point for all client requests. Handles auth, rate limiting, and routing.' },
        { name: 'Catalog Service', description: 'Serves movie listings, show schedules, and cinema information. Read-heavy, cacheable.' },
        {
          name: 'Seat Service',
          description:
            'Returns the seat map for a specific show. Combines static layout (seat positions) with dynamic state (available/held/booked).',
        },
        { name: 'Redis Cache', description: 'Caches show listings and aggregated availability.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  User["User Browser"]:::client
  GW["API Gateway"]:::edge
  CAT["Catalog Service"]:::compute
  SS["Seat Service"]:::compute
  RC[("Redis Cache")]:::cache
  DB[("Postgres Catalog DB")]:::database
  RL[("Redis Lock Store")]:::cache

  User -->|"1. Browse shows"| GW
  GW -->|"2. Forward to catalog svc"| CAT
  GW -->|"3. Forward to seat svc"| SS
  CAT -->|"4. Lookup cached shows"| RC
  CAT -->|"5. Fetch show from DB"| DB
  SS -->|"6. Acquire seat lock"| RL
  SS -->|"7. Read seat availability"| DB`,
      },
      steps: [
        'User selects city + movie -> Catalog Service returns shows from Redis cache (or Postgres on cache miss)',
        'User picks a show time -> Seat Service fetches the seat layout for that cinema hall (static - cached aggressively)',
        'Seat Service reads all lock keys for this show from Redis: MGET show:{showId}:seat:A1, show:{showId}:seat:A2, ...',
        'Any key that exists = seat is HELD or BOOKED. Null = AVAILABLE.',
        'Returns combined seat map to the client with status per seat',
        'Client renders the seat map with color coding',
      ],
      closingNote:
        "Why not query Postgres for seat status? During a hot event, 50K users are viewing the same show's seat map. That's 50K queries/sec hitting the DB for seat status. Redis handles this trivially (MGET is O(N) where N = number of seats, typically 200-400). Postgres would require connection pooling gymnastics and still hit I/O limits.",
    },
    {
      title: 'FR2: Hold Seats with TTL',
      body:
        'When a user selects seats and clicks "Proceed to Payment," we need to temporarily reserve those seats so no one else can book them during the 10-minute payment window. If payment isn\'t completed, seats auto-release.',
      insightCallout:
        'A distributed lock with TTL means: "this seat belongs to User A for the next 10 minutes. If User A doesn\'t complete the booking, the lock auto-expires and the seat becomes available again."',
      newComponents: [
        { name: 'Booking Service', description: 'Orchestrates the booking lifecycle. Creates bookings, coordinates seat holds, triggers payment.' },
        { name: 'Lock Manager', description: 'Acquires distributed locks on seats with TTL. The critical path for preventing double-booking.' },
        {
          name: 'Hold Expiry Reconciler',
          description:
            "Background job that cleans up bookings whose holds expired without payment. Handles edge cases where Redis TTL fires but the booking record in Postgres isn't updated. Runs every 30 seconds, scans bookings in HELD status where expiresAt < now, updates status to EXPIRED in Postgres, and publishes a seats.released event to Kafka. Redis TTL handles the lock release automatically, but the reconciler ensures Postgres state is consistent.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  User["User Browser"]:::client
  GW["API Gateway"]:::edge
  BS["Booking Service"]:::compute
  LM["Lock Manager"]:::compute
  RL[("Redis Lock Store")]:::cache
  DB[("Booking DB Postgres")]:::database
  REC["Hold Expiry Reconciler"]:::compute

  User -->|"1. POST book seats"| GW
  GW -->|"2. Forward to booking svc"| BS
  BS -->|"3. Acquire lock"| LM
  LM -->|"4. SET NX seat lock"| RL
  BS -->|"5. Write booking record"| DB
  REC -->|"6. Release expired locks"| RL
  REC -->|"7. Cancel expired holds"| DB`,
      },
      steps: [
        'User selects seats A1, A2, A3 and clicks "Proceed to Payment" -> POST /bookings/hold',
        'Booking Service creates a booking record in Postgres with status INITIATED',
        'Booking Service calls Lock Manager to acquire locks on all 3 seats atomically',
        'Lock Manager executes a Redis Lua script (atomic multi-key operation):\nFor each seatId in [A1, A2, A3]:\n  SET show:{showId}:seat:{seatId} {bookingId} NX EX 600\nIf ANY SET fails (seat already locked) -> release all acquired locks -> return FAILED',
        'If all locks acquired -> Booking Service updates booking status to HELD, sets expiresAt = now + 10 min',
        'Returns booking confirmation to user with countdown timer',
        'If locks failed -> return error "Some seats are no longer available" + which specific seats are taken',
      ],
      closingNote:
        "Why atomic all-or-nothing? If a user selects 3 seats and we lock them one by one, we might lock A1 and A2 but fail on A3 (taken by someone else). Now we have a partial hold - user can't complete the booking but seats are locked. The Lua script ensures atomicity: either ALL seats are locked or NONE are.",
    },
    {
      title: 'FR3: Complete Payment and Confirm Booking',
      body:
        "After seats are held, the user has 10 minutes to complete payment. Payment can fail (insufficient funds, gateway timeout, OTP expired). We need to handle all failure modes without losing the booking or double-charging.\n\nWhat if payment fails?\n- Gateway timeout: Payment Service retries with same idempotencyKey (gateway returns same result without re-charging)\n- Insufficient funds: Return failure to user. Hold remains active - user can retry with different payment method within the 10-minute window\n- Hold expires during payment: Payment Service checks hold validity before finalizing. If expired, returns error even if payment succeeded, triggering an automatic refund via compensating transaction",
      newComponents: [
        {
          name: 'Payment Service',
          description: 'Orchestrates payment flow. Calls external payment gateway, handles retries, ensures exactly-once via idempotency keys.',
        },
        { name: 'Payment Gateway (External)', description: 'Razorpay, Stripe, or similar. Processes the actual money transfer.' },
        {
          name: 'Confirmation Service',
          description:
            'After successful payment, finalizes the booking: marks seats as permanently BOOKED, generates ticket/QR code, triggers confirmation notifications.',
        },
        { name: 'Kafka', description: 'Decouples booking confirmation from downstream actions (email, analytics, seat map update).' },
      ],
      diagram: {
        mermaid: `flowchart LR
  User["User Browser"]:::client
  BS["Booking Service"]:::compute
  PS["Payment Service"]:::compute
  PGW["Payment Gateway"]:::edge
  CONF["Confirmation Service"]:::compute
  KF[["Kafka"]]:::async
  DB[("Booking DB")]:::database
  NS["Notification Service"]:::compute

  User -->|"1. POST confirm payment"| BS
  BS -->|"2. Initiate payment"| PS
  PS -->|"3. Charge via gateway"| PGW
  PGW -->|"4. Webhook payment result"| PS
  PS -->|"5. Confirm to booking svc"| BS
  BS -->|"6. Generate e-ticket"| CONF
  CONF -->|"7. Read booking details"| DB
  CONF -->|"8. Publish booking confirmed"| KF
  KF -->|"9. Send confirmation email"| NS`,
      },
      steps: [
        'User clicks "Pay Rs 750" -> POST /bookings/{bookingId}/pay with idempotencyKey',
        'Booking Service verifies hold is still valid (not expired) by checking Redis lock exists AND booking status is HELD',
        'Booking Service calls Payment Service with amount + idempotencyKey',
        'Payment Service calls external gateway (Razorpay): creates a payment intent, user completes UPI/card/net-banking',
        'Gateway sends webhook on success -> Payment Service updates payment status to SUCCESS',
        'Booking Service updates booking status to CONFIRMED, converts Redis lock from TTL-based to permanent (remove TTL or set 24hr TTL until show time)',
        'Confirmation Service generates ticket with QR code, publishes booking.confirmed event to Kafka',
        'Kafka consumers: Notification Service sends email/SMS, Analytics records the booking, Seat Map cache is invalidated',
      ],
      closingNote:
        "Why idempotency keys? Network failures between our server and the payment gateway mean we can't know if a payment was processed. If we retry without idempotency, user gets double-charged. With a client-generated idempotencyKey, the gateway guarantees exactly-once processing - same key = same result.",
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1: Seat Hold with Concurrent Competition',
      diagram: {
        mermaid: `sequenceDiagram
  participant U1 as User 1
  participant U2 as User 2
  participant GW as API Gateway
  participant BS as Booking Service
  participant LM as Lock Manager
  participant Redis as Redis Lock Store

  Note over U1,U2: Both want seat A5 for same show
  U1->>GW: POST /bookings/hold (seats: [A5, A6])
  U2->>GW: POST /bookings/hold (seats: [A5, A7])
  GW->>BS: User1 hold request
  GW->>BS: User2 hold request
  BS->>LM: Lock [A5, A6] for User1
  BS->>LM: Lock [A5, A7] for User2
  LM->>Redis: SET show:1:seat:A5 booking1 NX EX 600
  Redis-->>LM: OK (User1 wins)
  LM->>Redis: SET show:1:seat:A6 booking1 NX EX 600
  Redis-->>LM: OK
  LM-->>BS: All locks acquired for User1
  LM->>Redis: SET show:1:seat:A5 booking2 NX EX 600
  Redis-->>LM: nil (FAILED - already locked)
  LM-->>BS: Lock failed for User2 on seat A5
  BS-->>U1: 200 OK - Seats held. Pay within 10 min.
  BS-->>U2: 409 Conflict - Seat A5 unavailable`,
      },
      nonObviousFailure:
        "What if the Booking Service crashes after acquiring locks in Redis but before writing the booking to Postgres? The Redis locks have a 10-minute TTL - they'll auto-expire. The reconciler won't find a matching booking in Postgres (it was never written), so no cleanup needed. The seats become available again after TTL expires. Worst case: 10 minutes of phantom unavailability for those seats.",
    },
    {
      title: 'Flow 2: Payment Completion with Failure Handling',
      diagram: {
        mermaid: `sequenceDiagram
  participant User
  participant BS as Booking Service
  participant PS as Payment Service
  participant PGW as Payment Gateway
  participant Redis as Redis Locks
  participant DB as Postgres

  User->>BS: POST /bookings/{id}/pay
  BS->>Redis: Check lock exists for bookingId
  Redis-->>BS: Lock valid (5 min remaining)
  BS->>PS: Process payment (amount + idempotencyKey)
  PS->>PGW: Create payment intent
  PGW-->>PS: Payment processing...
  alt Payment succeeds
      PGW-->>PS: Success + transactionId
      PS-->>BS: Payment confirmed
      BS->>DB: Update booking: CONFIRMED
      BS->>Redis: PERSIST lock (remove TTL)
      BS-->>User: 200 OK - Booking confirmed + ticket
  else Payment fails (insufficient funds)
      PGW-->>PS: Failed: insufficient funds
      PS-->>BS: Payment failed
      BS-->>User: 402 - Payment failed. Retry with another method.
      Note over Redis: Hold still valid. User can retry.
  else Hold expired during payment
      PGW-->>PS: Success + transactionId
      PS->>BS: Payment confirmed
      BS->>Redis: Check lock exists
      Redis-->>BS: Lock expired (nil)
      BS->>PS: Trigger refund
      PS->>PGW: Refund transactionId
      BS-->>User: 410 Gone - Hold expired. Refund initiated.
  end`,
      },
      nonObviousFailure:
        'Payment gateway sends a success webhook but our server crashes before processing it. The gateway will retry the webhook (typically 3-5 times over 24 hours). Payment Service uses the idempotencyKey to detect duplicate webhooks and skip re-processing. If all webhook retries fail, a reconciler job polls the gateway every 5 minutes for recent payments and matches them against pending bookings.',
    },
    {
      title: 'Booking Lifecycle State Machine',
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> INITIATED : User selects seats
  INITIATED --> HELD : All locks acquired
  INITIATED --> FAILED : Lock conflict (seats taken)
  HELD --> CONFIRMED : Payment success
  HELD --> EXPIRED : TTL expired (10 min)
  HELD --> CANCELLED : User cancels
  CONFIRMED --> REFUNDED : Admin refund or cancellation policy
  EXPIRED --> [*]
  FAILED --> [*]
  CONFIRMED --> [*]
  CANCELLED --> [*]
  REFUNDED --> [*]`,
        bullets: [
          'Each transition emits a Kafka event consumed by: Notification Service (user updates), Seat Map Cache (invalidation), Analytics (conversion tracking), and the Reconciler (consistency checks).',
        ],
      },
    },
  ],

  deepDives: [
    {
      title: 'Deep Dive 1: Preventing Double-Booking - Distributed Locking Strategies',
      problem:
        '1000 users click "Hold Seat A5" within the same second for a hot show. Exactly one must succeed; 999 must fail cleanly.',
      bad:
        'Application-level check-then-act. `if seat.status == AVAILABLE then seat.status = HELD`. Classic race condition - 10 threads all see "AVAILABLE" and all proceed.',
      good:
        'Postgres row-level lock. `SELECT ... FOR UPDATE` on the seat row, then update status. Works for moderate concurrency, but under 1000 concurrent transactions, you get lock contention, connection pool starvation, and 5+ second response times. Postgres serializes all competing transactions - they queue up behind each other.',
      great:
        'Redis `SET NX EX` (atomic conditional set with TTL). SET NX = "Set only if Not eXists" - an atomic compare-and-swap in one round trip. Combined with EX (expire), it gives us a lock that auto-releases.\n\nMechanism: (1) Lock key format: show:{showId}:seat:{seatId} -> value: {bookingId}:{userId}:{timestamp}. (2) Lock acquisition via a Lua script for multi-seat atomicity - for each requested seat, SET seatKey bookingId NX EX 600; if any SET returns nil (someone else holds it), roll back by deleting all keys just set and return FAILED + which seat was taken; otherwise return SUCCESS. (3) NX guarantees only one caller succeeds for each seat - Redis is single-threaded per shard. (4) EX 600 (10 minutes) ensures auto-release if payment isn\'t completed. (5) Sharding: keys are sharded by showId across the Redis cluster - one hot show maps to one shard, so that shard handles all lock contention for that show.\n\nWhy not Redlock? Redlock (consensus across N Redis nodes) adds 3-5ms latency and complexity. For seat booking, a single Redis shard with persistence (AOF every second) is sufficient. The worst case of a Redis crash is: users who had holds lose them (10-minute window restarts). This is acceptable - they can re-select and re-hold. We don\'t need the durability guarantees of Redlock.\n\nBackstop: Postgres as final gate. Even though Redis handles the fast path, the Booking Service writes the confirmed booking to Postgres with a unique constraint: UNIQUE(showId, seatId) WHERE status = \'CONFIRMED\'. If Redis somehow fails (split-brain, data loss), Postgres prevents actual double-booking at the persistence layer.',
      diagram: {
        mermaid: `flowchart LR
  LM["Lock Manager"]:::compute
  R1[("Redis Shard 1")]:::cache
  R2[("Redis Shard 2")]:::cache
  R3[("Redis Shard 3")]:::cache
  BS["Booking Service"]:::compute

  BS -->|"1. Acquire seats"| LM
  LM -->|"2. Show:1:seat:A*"| R1
  LM -->|"3. Show:1:seat:B*"| R2
  LM -->|"4. Show:2:seat:*"| R3`,
      },
    },
    {
      title: 'Deep Dive 2: Seat Hold Expiry - TTL + Reconciler Pattern',
      problem:
        "User holds seats, goes to make tea, never pays. Those seats must become available again exactly at TTL expiry. But Redis TTL deletion is lazy (checked on access or via periodic sampling) - there's no guarantee of exact-millisecond release.",
      simpleTerms:
        "When you select a seat, we lock it for 10 minutes using Redis with an auto-expiry timer. If you don't pay in time, the lock disappears automatically and the seat becomes available again. A background job double-checks that Redis and the database agree.",
      bad:
        'Application timer. Start a setTimeout(10 min) on the API server. If the server restarts, timer is lost. Seats stay held forever.',
      good:
        'Rely purely on Redis TTL. When another user queries seat status, the key is gone (expired), so they can lock it. Works for the lock itself, but: the booking record in Postgres still says "HELD" - inconsistency.',
      great:
        'Redis TTL for lock release + background reconciler for state consistency + Kafka event for downstream notifications.\n\nMechanism: (1) Redis TTL (primary) - the lock key expires after exactly 600 seconds; after expiry, any new SET NX on that key will succeed, so the seat becomes available for others. (2) Reconciler (consistency) - runs every 30 seconds, queries Postgres for bookings WHERE status = \'HELD\' AND expires_at < NOW(); for each, updates status to EXPIRED, publishes a booking.expired event to Kafka, and Kafka consumers notify the user ("Your hold expired") and update analytics. (3) Redis Keyspace Notifications (optional enhancement) - subscribe to __keyevent@0__:expired events so a lock expiry immediately triggers the Postgres update instead of waiting for the 30-second reconciler sweep.\n\nEdge case - race between payment and expiry: user pays at minute 9:58 (2 seconds before expiry). Payment gateway takes 5 seconds to process. By the time we get the success response, the Redis TTL has expired and someone else might have locked the seat. Solution: before calling the payment gateway, extend the Redis lock by 2 minutes (safety buffer) via EXPIRE show:{showId}:seat:{seatId} 720. This gives us time to process the payment response. If payment fails, we explicitly DEL the lock.',
    },
    {
      title: 'Deep Dive 3: Payment Failure Handling - Saga Pattern with Compensating Transactions',
      problem:
        "Booking involves two systems: our seat lock (Redis + Postgres) and an external payment gateway. These can't be in a single database transaction. What if payment succeeds but our server crashes before confirming the booking? What if we confirm the booking but payment actually failed (gateway network error)?",
      simpleTerms:
        'Booking involves multiple steps (lock seat -> charge card -> confirm). If step 2 fails (card declined), we automatically "undo" step 1 (release the seat). Each step has a pre-defined rollback action.',
      bad:
        "Wrap everything in a distributed transaction (2PC / XA). External payment gateways don't support 2PC. Even if they did, 2PC is fragile under network partitions - the coordinator becomes a single point of failure.",
      good:
        'Optimistic approach - assume payment will succeed, confirm booking first, then process payment. If payment fails, roll back the booking. Problem: user already has a "confirmed" ticket for a brief moment (bad UX and potential fraud vector).',
      great:
        "Saga pattern with explicit compensating transactions (borrowing from Stripe's idempotency key pattern and Razorpay's orchestration).\n\nSaga steps: (1) Verify hold is still valid (Redis lock exists) - read-only check, no compensation needed. (2) Extend lock TTL by 2 min (safety buffer) - compensating transaction: restore original TTL. (3) Call payment gateway with idempotencyKey - compensating transaction: refund payment. (4) On success: update booking to CONFIRMED - no compensation needed. (5) On failure: release lock explicitly - no compensation needed.\n\nIdempotency key lifecycle: (1) Client generates a UUID v4 as idempotencyKey before clicking Pay. (2) Server stores {idempotencyKey: bookingId, status: PROCESSING} in Redis with 24hr TTL. (3) If the same request arrives again (retry), check Redis: if status = PROCESSING, return \"still processing\"; if status = SUCCESS, return cached response; if status = FAILED, allow retry with same key. (4) Gateway uses the same key: same charge is never processed twice.\n\nHandling \"zombie payments\" (success webhook arrives after hold expired): Payment Service receives a success webhook for a booking that's already EXPIRED - it immediately triggers a refund via the gateway API, records this as an auto-refunded transaction, and alerts the ops dashboard (unusual but not a bug).",
      diagram: {
        mermaid: `flowchart LR
  BS["Booking Service Orchestrator"]:::compute
  PS["Payment Service"]:::compute
  RL[("Redis Locks")]:::cache
  DB[("Postgres")]:::database
  PGW["Payment Gateway"]:::edge
  KF[["Kafka"]]:::async

  BS -->|"1. Verify hold"| RL
  BS -->|"2. Initiate payment"| PS
  PS -->|"3. Charge"| PGW
  PGW -->|"4. Success/Fail"| PS
  PS -->|"5. Result"| BS
  BS -->|"6. Confirm or rollback"| DB
  BS -->|"7. Event"| KF`,
      },
    },
    {
      title: 'Deep Dive 4: Hot Event Scaling - Virtual Waiting Room + Queue',
      problem:
        'Avengers premiere - 500K users hit the booking page in 10 seconds. The Redis lock store for that show gets 500K SET NX attempts/sec. Even Redis will struggle, and the API servers will be overwhelmed.',
      simpleTerms:
        'During a hot event (Avengers premiere), instead of letting 500K people hammer the system simultaneously, we put them in a virtual queue. We let them through in batches of 1000, preventing the system from crashing while keeping it fair (first come, first served).',
      bad:
        'Let everyone hit the system simultaneously. API gateway hits rate limits, users get 503 errors, keep retrying (thundering herd), system stays overloaded for minutes. Unfair - users with faster connections win.',
      good:
        'Rate limit at the API gateway (500 requests/sec). Most users get rejected. Better for the system, but terrible UX - "try again later" for 499K users.',
      great:
        "Virtual waiting room with fair queue (borrowing from Ticketmaster's approach).\n\nMechanism: (1) Trigger - when a show's booking page hits > 10K concurrent viewers (tracked via WebSocket connections or session counter), activate the waiting room for that show. (2) Assign position - each user arriving at the booking page gets a random position in the queue (not first-come-first-served - avoids bot advantage); position = hash(userId + salt + timestamp_bucket). (3) Drip processing - Waiting Room Service dequeues users at a controlled rate (100-500 users/sec) based on the downstream system's capacity. (4) User experience - user sees \"You're #4,521 in line. Estimated wait: 2 minutes.\" Position updates in real-time via SSE. (5) When it's their turn - user gets a time-limited token (2 minutes validity) that allows them to access the seat selection page; token is validated at the API Gateway. (6) Overflow - if all seats are sold while users are in queue, remaining queue members are notified \"Sold Out\" and the queue is drained.\n\nWhy random position instead of arrival order? Arrival-order queues reward bots and users with faster network connections. Random assignment is fairer and eliminates the incentive to DDoS the system at second zero.\n\nCapacity math: a cinema hall has 300 seats. Even if all 300 are booked in one go (unlikely - most users book 2-4 seats), we only need ~100 successful booking attempts. Processing 500 users/sec means the entire queue is served in ~17 minutes for a 500K-user queue. With 80% dropping off or failing, actual booking completes in 3-5 minutes.",
      diagram: {
        mermaid: `flowchart LR
  Users["500K Users"]:::client
  WR["Waiting Room Service"]:::edge
  Q[["Priority Queue SQS"]]:::async
  BS["Booking Service"]:::compute
  RL[("Redis Locks")]:::cache

  Users -->|"1. Enter waiting room"| WR
  WR -->|"2. Assign position"| Q
  Q -->|"3. Dequeue 100/sec"| BS
  BS -->|"4. Acquire seat lock"| RL`,
      },
    },
    {
      title: 'Deep Dive 5: Seat Map Real-Time Updates',
      problem:
        "1000 users are viewing the same seat map. When User A holds seat A5, all other users should see it turn yellow (held) within 2-3 seconds. Otherwise, they'll select the same seat and get frustrated when their hold fails.",
      bad:
        'Polling. Each user\'s browser polls GET /seats every 2 seconds. 1000 users x 1 request/2sec = 500 requests/sec just for one show\'s seat map. Wasteful.',
      good:
        'Short polling with aggressive caching. Cache the seat map in Redis with 3-second TTL. 500 requests/sec all hit cache. Works, but users still see stale data for up to 3 seconds.',
      great:
        'Server-Sent Events (SSE) for seat status push + event-driven invalidation.\n\nMechanism: (1) When a user opens the seat map page, the browser opens an SSE connection: GET /sse/v1/shows/{showId}/seats (long-lived HTTP connection with text/event-stream). (2) Gateway registers this connection to a show-specific channel. (3) When any seat\'s status changes (held, released, booked), the Booking Service publishes to Kafka topic show.{showId}.seat-updates. (4) A Seat Update Consumer reads from Kafka and pushes to all SSE connections for that show via Redis Pub/Sub -> SSE Gateway. (5) Client receives data: {"seatId": "A5", "status": "held", "heldBy": "someone"} and updates the seat map UI immediately.\n\nWhy SSE instead of WebSocket? Seat map updates are server-to-client only (users don\'t send data back over this connection). SSE is simpler, works over HTTP/2 multiplexing, auto-reconnects, and requires no upgrade handshake. WebSocket would be overkill for a one-directional push.\n\nScaling: with SSE over HTTP/2, a single gateway can hold 100K+ connections (far cheaper than WebSocket). For hot shows with 50K concurrent viewers, 1 gateway instance suffices for the seat map push path.',
    },
  ],

  selfAudit: [
    {
      question: 'Dedicated search index?',
      answer:
        'Not needed for core booking flow. Movie/event discovery can use Postgres full-text search or Elasticsearch for advanced filtering (genre, language, nearby cinemas). Low priority - not on the critical booking path.',
    },
    {
      question: 'Stale reads after writes?',
      answer:
        'Seat map has 2-3 second lag via SSE push (acceptable). After YOUR hold succeeds, your own UI updates immediately (optimistic). Other users may attempt the same seat and fail - clean error handling.',
    },
    {
      question: 'Single points of failure?',
      answer:
        'Redis lock store uses Redis Cluster (3+ shards, each with a replica). Booking Service is stateless, horizontally scaled. Postgres uses primary + synchronous standby for booking confirmations.',
    },
    {
      question: 'Dead-letter / reconciliation?',
      answer:
        'Reconciler every 30s cleans expired holds. Failed payment webhooks go to DLQ with exponential retry (1min, 5min, 30min). Orphaned bookings (INITIATED for > 15 min) are auto-cancelled.',
    },
    {
      question: 'Data freshness across caches?',
      answer:
        'Catalog cache TTL = 60s (acceptable for movie listings). Seat map is real-time via SSE. Aggregated availability ("45 seats left") is eventually consistent (5s lag).',
    },
    {
      question: 'Cost at scale?',
      answer:
        'Redis Cluster (6 nodes for locks): ~$2000/month. Kafka (3 brokers): ~$1500/month. API + Booking Service (20 instances): ~$4000/month. Postgres RDS (primary + standby): ~$2000/month. Total: ~$10K/month for 1M bookings/day platform.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  UA["User Browser and App"]:::client

  LB["Load Balancer"]:::edge
  GW["API Gateway"]:::edge
  WR["Waiting Room"]:::edge
  SSE["SSE Gateway"]:::edge

  CAT["Catalog Service"]:::compute
  SS["Seat Service"]:::compute
  BS["Booking Service"]:::compute
  LM["Lock Manager"]:::compute
  PS["Payment Service"]:::compute
  CONF["Confirmation Service"]:::compute
  NS["Notification Service"]:::compute
  REC["Reconciler"]:::compute

  KF[["Kafka"]]:::async
  Q[["Booking Queue"]]:::async

  PG[("Postgres Booking DB")]:::database
  RL[("Redis Lock Store")]:::cache
  RC[("Redis Cache")]:::cache
  RPS[("Redis Pub/Sub")]:::cache

  PGW["Payment Gateway"]:::edge
  FCM["FCM and Email"]:::edge

  UA -->|"Open ticket page"| LB
  LB -->|"Route API"| GW
  LB -->|"Route SSE"| SSE
  GW -->|"Route to waiting room"| WR
  WR -->|"Enqueue user position"| Q
  Q -->|"Dequeue for booking"| BS
  GW -->|"Forward to catalog svc"| CAT
  GW -->|"Forward to seat svc"| SS
  GW -->|"Forward to booking svc"| BS
  CAT -->|"Lookup cached shows"| RC
  CAT -->|"Fetch show from DB"| PG
  SS -->|"Read seat availability"| RL
  BS -->|"Acquire lock"| LM
  LM -->|"SET NX seat lock"| RL
  BS -->|"Write booking record"| PG
  BS -->|"Initiate payment"| PS
  PS -->|"Charge via gateway"| PGW
  BS -->|"Publish booking event"| KF
  KF -->|"Generate e-ticket"| CONF
  KF -->|"Send confirmation"| NS
  KF -->|"Push seat status update"| SSE
  CONF -->|"Read booking details"| PG
  NS -->|"Push via FCM and email"| FCM
  REC -->|"Release expired locks"| RL
  REC -->|"Cancel expired holds"| PG
  SSE -->|"Check limit"| RPS
  RPS -->|"Broadcast to clients"| SSE`,
    bullets: [
      'User sends request - hits the Load Balancer, routed through API Gateway',
      'Waiting Room queues during surge - hot event on-sales throttle via the Booking Queue',
      'Catalog Service serves seat map - reads from Redis Cache (or Postgres on miss)',
      'Seat Service checks availability - queries Redis Lock Store for real-time seat state',
      'Booking Service acquires lock - Lock Manager does a Redis SET NX with TTL on selected seats',
      'Payment is processed - Payment Service calls the external Payment Gateway with idempotency key',
      'Booking confirmed and persisted - writes to Postgres, emits event to Kafka',
      'Downstream consumers react - Confirmation Service generates ticket, Notification Service sends email/push, SSE Gateway updates live seat maps',
      'Reconciler handles orphans - releases expired locks and syncs Redis with Postgres',
    ],
  },

  keyTechnologies: [
    {
      term: 'Redis SET NX (distributed lock)',
      definition: 'Atomic "set if not exists" command used to acquire a seat lock - only one caller succeeds, preventing double-booking.',
    },
    {
      term: 'TTL-based hold',
      definition: "Lock keys expire automatically after 10 minutes, releasing seats if payment isn't completed.",
    },
    {
      term: 'CQRS',
      definition:
        'Command Query Responsibility Segregation - separating the write path (seat locks, bookings) from read path (seat map browsing) for independent scaling.',
    },
    {
      term: 'Kafka',
      definition: 'Event bus carrying booking lifecycle events to downstream services (notifications, analytics, seat map invalidation).',
    },
    {
      term: 'WebSocket',
      definition: 'Persistent connection for pushing real-time seat availability updates to users viewing the same show.',
    },
    {
      term: 'Postgres',
      definition: 'ACID-compliant relational DB serving as the booking source of truth with unique constraints as a double-booking backstop.',
    },
    {
      term: 'Idempotency Key',
      definition: 'Client-generated UUID ensuring payment retries never double-charge - gateway returns the same result for repeated keys.',
    },
  ],

  expectedDepth: {
    mid: 'Design a basic seat selection and booking system with a database. Recognize the concurrency problem - two users selecting the same seat simultaneously. Propose a locking mechanism with prompting. You should articulate why naive check-then-act creates race conditions and sketch a happy-path flow from seat selection through payment.',
    senior:
      'Propose Redis SET NX with TTL for seat holds. Explain atomic multi-seat locking via a Lua script (all-or-nothing semantics). Discuss the payment saga pattern and idempotency without prompting. Recognize the need for a hold expiry reconciler to keep Postgres consistent with Redis TTL state. Articulate why Postgres row-level locks fail under 100K concurrent users.',
    staffPlus:
      'Address the thundering herd problem on hot events by proposing a virtual waiting room or queue-based admission control. Discuss Postgres as a backstop with unique constraints even when Redis is the fast path. Proactively mention how CDN invalidation works for seat maps, zombie payment handling (success webhook after hold expiry), and the cost trade-off of keeping expired holds in Redis vs background cleanup. Quantify the peak load numbers and explain capacity planning.',
  },

  keyTakeaways: [
    'Redis SET NX EX gives atomic seat locking with auto-release via TTL',
    'All-or-nothing Lua script prevents partial seat holds',
    'Saga pattern with idempotency keys handles payment failures safely',
    'Virtual waiting room protects the system during hot event on-sales',
  ],

  relatedDesigns: ['stock-broker', 'digital-wallet', 'job-scheduler'],
  relatedConcepts: [
    { name: 'Distributed Locking', description: "Holds seats during checkout so two users can't book the same seat." },
    { name: 'Saga Pattern', description: 'Coordinates seat hold, payment, and confirmation with compensating rollbacks.' },
    { name: 'Idempotency', description: 'Retried payment callbacks never double-charge a booking.' },
    { name: 'Database Replication', description: 'Keeps seat inventory durable and available across nodes.' },
  ],

  simulator: {
    goalDescription:
      'Let 100K+ users compete for the same seats during a hot on-sale without double-booking, using a TTL-based distributed lock and a payment saga to confirm or roll back cleanly.',
    requirementChips: ['Seat hold acquired < 500ms', '300K seat-status reads/sec', 'Zero double-booking'],
    targetRps: 300000,
    readRatio: 0.97,
    cacheHitRatio: 0.9,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'lb-at-edge', label: 'Load balancer at the edge', kind: 'requires-node-type', nodeType: 'load-balancer' },
      {
        id: 'seat-lock-store',
        label: 'Distributed seat lock store (Redis SET NX EX)',
        kind: 'requires-node-type',
        nodeType: 'redis',
      },
      {
        id: 'durable-booking-db',
        label: 'Durable booking DB as the double-booking backstop',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql'],
      },
      {
        id: 'compute-tier',
        label: 'Compute tier for catalog/seat/booking services',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice'],
      },
      {
        id: 'event-bus',
        label: 'Event bus for booking lifecycle events',
        kind: 'requires-node-type',
        nodeType: ['kafka', 'sqs', 'rabbitmq'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 600, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 30, position: { x: 880, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 6, position: { x: 1160, y: 100 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 12, position: { x: 1160, y: 300 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 1440, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 6, position: { x: 1720, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-gw', source: 'lb-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-app-kafka', source: 'app-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker-pg', source: 'worker-1', target: 'pg-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Redis SET NX EX gives an atomic, auto-expiring lock per seat so exactly one of many concurrent holders wins; Postgres is the durable backstop with a unique constraint on (showId, seatId, CONFIRMED), and Kafka decouples booking confirmation from downstream ticketing and notification work.',
    failureModeNarratives: {
      redis:
        "Nearly all seat-map reads and every seat hold go through the Redis lock store; if it goes down, the system can no longer safely tell whether a seat is available, so booking must halt rather than risk a double-sale.",
    },
    fullDesignLinkSlug: 'ticket-booking',
  },
}

export default topic
