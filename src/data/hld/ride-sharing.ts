import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'ride-sharing',
  title: 'Ride Sharing (Uber / Lyft)',
  difficulty: 'Advanced',
  icon: 'pi pi-car',
  color: '#3b82f6',
  readTimeMinutes: 29,
  topics: [
    'Geospatial Indexing (S2 / Geohash)',
    'Real-Time Driver-Rider Matching',
    'Dynamic (Surge) Pricing',
    'Live Location Streaming',
    'ETA & Routing Service',
  ],
  companies: ['Uber', 'Lyft', 'Grab', 'Bolt'],
  prerequisites: ['Geospatial Indexing', 'Distributed Locking', 'WebSockets'],
  summary:
    'A ride-hailing marketplace that matches riders to nearby drivers within a few hundred milliseconds, streams live location for the duration of a trip, and prices rides dynamically from a real-time supply/demand signal that gets locked into the trip record at match time so a rider is never charged something they never agreed to.',

  understandingProblem:
    "Uber, Lyft, Grab, and Bolt each run marketplaces where millions of riders and over a million drivers move continuously across a city, and the matching decision has to happen in a few hundred milliseconds against positions that are already stale by the time they're read. A naive approach - scan every driver row and sort by distance - can't keep up with tens of thousands of location pings per second, and even if it could, greedily assigning the single nearest driver to each request independently produces worse city-wide outcomes than briefly batching requests, because drivers are a shared, contested resource under peak demand. Events like concerts, storms, or holidays can spike demand 4x or more in a single neighborhood within minutes, and a system that isn't geo-partitioned lets that local spike degrade matching everywhere else. Underneath the map UI, this is really three coupled problems on the same short timescale: fast spatial search over a moving population, a marketplace-balancing pricing signal, and a trip lifecycle that has to settle payment exactly once no matter how the first two hiccup.",

  realExamples:
    "Uber's own engineering blog documents the S2-based geospatial layer and the internal DISCO dispatch-optimization system that batches ride requests against available drivers rather than matching greedily one at a time. Uber also open-sourced H3, its hexagonal grid system, specifically because square geohash cells have non-uniform neighbor distances that made ring-expansion search and surge-zone boundaries behave inconsistently at scale.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  rider[Rider App]:::client
  api[API Server]:::edge
  db[("Postgres<br/>drivers + trips")]:::database

  rider -->|"1. POST /request-ride (lat, lng)"| api
  api -->|"2. SELECT * FROM drivers ORDER BY distance(lat,lng) LIMIT 1"| db
  api -->|"3. UPDATE drivers SET status='matched'"| db`,
    },
    whyThisBreaks: [
      "A distance-ordered table scan over every driver row can't run in a few hundred milliseconds once the fleet is in the tens of thousands - there's no index that helps a raw distance() computation over lat/lng columns.",
      'Two riders requesting near-simultaneously can both read the same driver as "available" before either write lands - both get matched to the same driver.',
      "In simple terms: rider A and rider B both see driver D as the nearest option and both submit at nearly the same instant. Whoever's UPDATE runs second either overwrites the first match or fails - either way, someone thinks they have a driver who is actually already on their way to someone else.",
      "Every driver location ping (every few seconds, from over a hundred thousand concurrent drivers) becomes a write against the same drivers table that matching reads from - the read and write paths fight over the same rows and indexes.",
      'Greedy nearest-driver assignment, even if made race-free, is provably suboptimal city-wide: it can strand a rider seconds after a much closer driver frees up, because each request is scored in isolation with no view of the other requests competing for the same drivers.',
      'There is no separation between "driver is nearby" (which changes every few seconds and can tolerate staleness) and "trip and payment state" (which must never be wrong) - a single table conflates two workloads with completely different consistency needs.',
      'No pricing signal at all - a flat fare cannot absorb a 10x demand spike during a concert letdown, so the platform either runs out of drivers with no lever to pull, or a rider is quoted a price that has nothing to do with how scarce a driver actually is right now.',
      'No live status for either party once matched - the rider has no way to see the driver approaching, and a dropped connection looks identical to a driver who never left.',
    ],
    closingNote:
      'The rest of this doc separates that single overloaded table into two consistency domains - a fast, eventually-consistent geospatial/matching layer and a strongly-consistent trip/payment layer - and builds up the matching, pricing, tracking, and settlement pieces one functional requirement at a time.',
  },

  priorArt: [
    {
      title: 'Google S2 Geometry Library',
      description:
        "A hierarchical spherical-cell indexing scheme, used internally at Uber for exactly this purpose, that discretizes the globe into a searchable cell hierarchy - the basis for the ring-expanding nearby-driver search in this design.",
      link: 'https://github.com/google/s2geometry',
    },
    {
      title: 'Uber H3 Hexagonal Grid',
      description:
        "Uber's open-sourced alternative to square geohash cells. Hexagons give every neighbor cell the same center-to-center distance, which makes ring-expansion search and surge-zone boundaries behave far more consistently than a square grid, where diagonal neighbors are ~41% farther away than edge neighbors.",
      link: 'https://www.uber.com/us/en/blog/h3/',
    },
    {
      title: "Uber's DISCO Dispatch Optimization",
      description:
        "Uber's internally described system that periodically solves a batched assignment problem across open trip requests and available drivers in a region, rather than matching each request the instant it arrives - the direct inspiration for the batched-matching deep dive here.",
      link: 'https://highscalability.com/how-uber-scales-their-real-time-market-platform/',
    },
    {
      title: 'Bipartite Matching / Assignment Problem',
      description:
        'The batched, ETA-and-efficiency-scored matching of open ride requests to available drivers is a direct application of classical assignment-problem algorithms (min-cost bipartite matching) rather than pure nearest-neighbor greedy matching.',
      link: 'https://en.wikipedia.org/wiki/Assignment_problem',
    },
    {
      title: '"Surge Pricing Solves the Wild Goose Chase" (research on Uber trip data)',
      description:
        "Academic analysis of Uber's own trip data showing dynamic pricing functions as a real-time control loop balancing supply and demand - simultaneously damping some demand and pulling idle drivers toward the surging area - rather than pure profit maximization. This is the same framing used here for locking a surge multiplier at match time.",
      link: 'https://www.microsoft.com/en-us/research/publication/surge-pricing-solves-wild-goose-chase/',
    },
  ],

  coreEntities: [
    { name: 'Rider', description: 'The account requesting a trip - profile, payment methods, home/work saved locations, rating.' },
    { name: 'Driver', description: 'The account fulfilling trips - vehicle info, eligibility/background-check status, current online/offline state, rating.' },
    { name: 'Vehicle', description: 'Make, model, plate, capacity, and the product tier it qualifies for (economy, XL, premium).' },
    {
      name: 'Trip',
      description: 'The end-to-end record of a ride from request through matching, in-progress, and completion - the single strongly-consistent source of truth for the ride.',
    },
    { name: 'Offer', description: 'A time-boxed proposal sent to a candidate driver, locking them against other offers until accept/decline/timeout.' },
    { name: 'Geospatial Cell', description: 'An S2/geohash/H3 grid cell used to index current driver positions for fast nearby-driver lookups.' },
    { name: 'Surge Zone', description: 'A geographic cell-area over which supply/demand ratio is computed to derive a live pricing multiplier.' },
    { name: 'Location Ping', description: "A periodic driver position update used to keep the geospatial index, live map, and ETA fresh." },
    { name: 'Ledger Entry', description: 'A double-entry record (rider charge, platform fee, driver payable) written at trip settlement, from which driver payouts are reconciled.' },
  ],

  requirements: {
    core: [
      'Riders request a trip by specifying pickup and destination, see a fare estimate with the current surge multiplier, and are matched to a nearby available driver.',
      'Drivers receive trip offers they can accept or decline within a short window, then navigate to pickup and drop-off.',
      'Both parties see live location of the other and trip status (requested, matched, driver arriving, in progress, completed) during the trip.',
      'The platform computes dynamic pricing based on real-time supply/demand imbalance in a given area, and locks the quoted multiplier into the trip at match time.',
      'Payments are captured automatically at trip completion - fare, surge multiplier, tolls, and tip - and settled to the driver via a durable ledger.',
      'Riders and drivers rate each other post-trip, and ratings feed into future matching eligibility.',
    ],
    belowTheLine: [
      'Scheduled / advance-booked rides.',
      'Multi-stop trips with automatic fare recalculation mid-trip.',
      'Pooled rides matching multiple riders with overlapping routes.',
      'Driver-facing demand-heatmap dashboard to guide repositioning.',
      'Full cross-border / cross-currency payment support - assume a single currency region per deployment.',
    ],
    nonFunctionalTable: [
      { metric: 'Matching latency', target: 'Rider-to-driver match completes within a few hundred ms (p99).' },
      { metric: 'Location freshness', target: 'Driver location ingested and queryable within low single-digit seconds.' },
      { metric: 'Geo-isolation', target: 'Demand spikes or outages in one city produce zero cross-region blast radius.' },
      { metric: 'Consistency model', target: 'Trip and payment state strongly consistent; live location and ETA eventually consistent.' },
      { metric: 'Spike resilience', target: 'Matching/pricing pipeline stays available and responsive at 4x+ normal peak demand (concerts, storms, holidays).' },
      { metric: 'Payment correctness', target: 'Exactly-once fare capture per trip; driver payout always reconciles from an append-only ledger, never recomputed ad hoc.' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Live Location Index',
      purpose: 'Real-time driver positions, updated every few seconds',
      primaryPick: 'Redis GEO (GEOADD/GEORADIUS)',
      alternatives: 'PostGIS, Elasticsearch geo_point',
      whyPrimaryWins: 'Sub-ms proximity search in memory is essential to keep matching inside the sub-second SLA at 25K-50K location writes/sec',
    },
    {
      tier: 'Trip/Payment Store',
      purpose: 'Strongly-consistent trip lifecycle and ledger state',
      primaryPick: 'Postgres (sharded by city)',
      alternatives: 'CockroachDB, TiDB',
      whyPrimaryWins: 'ACID transactions keep trip status and ledger writes correct - the one workload here that cannot tolerate eventual consistency',
    },
    {
      tier: 'Event Bus',
      purpose: 'Fan out ride-lifecycle events and location pings to independent consumers',
      primaryPick: 'Kafka',
      alternatives: 'Redpanda, Kinesis, Pub/Sub',
      whyPrimaryWins: 'A single ride generates 8-10 state transitions; consumer groups let each downstream service process independently without blocking others',
    },
    {
      tier: 'Offer Lock / Availability Cache',
      purpose: 'Atomic driver locking plus high-QPS availability and ETA reads',
      primaryPick: 'Redis Cluster (SET NX EX)',
      alternatives: 'Memcached',
      whyPrimaryWins: 'Atomic compare-and-set with a self-releasing TTL is what actually prevents double-dispatch, not the matching logic itself',
    },
    {
      tier: 'Real-Time Delivery',
      purpose: 'Push live location and ETA to rider/driver apps during a trip',
      primaryPick: 'WebSocket Gateway + Redis Pub/Sub',
      alternatives: 'SSE, gRPC streaming',
      whyPrimaryWins: 'Persistent connections deliver low-latency updates without the redundant traffic of polling; polling stays only as a fallback',
    },
    {
      tier: 'Analytics Store',
      purpose: 'Historical trips and demand patterns feeding pricing and reporting',
      primaryPick: 'ClickHouse',
      alternatives: 'BigQuery, Redshift, Druid',
      whyPrimaryWins: 'Columnar time-series storage answers demand-pattern queries cheaply without competing with the live trip/payment path',
    },
  ],
  technologyChoicesNote:
    "Why Redis GEO over PostGIS for live driver positions? At 500K+ location updates/sec, Redis GEO's in-memory sorted set with geohash encoding gives sub-millisecond proximity search, which is essential for the 30-second matching SLA - PostGIS would buckle under that write rate. Kafka earns its place the same way on the event side: a single ride generates 8-10 state transitions, and consumer groups let matching, pricing, tracking, and settlement each process independently without blocking one another.",

  scaleEstimation: [
    'Users: ~20M monthly active riders across served cities, with ~2M taking a ride on a given day - roughly 3M trips/day accounting for riders occasionally taking multiple trips.',
    'Write QPS (trips): ~35 trip requests/sec average, but rush hours and Friday/Saturday nights concentrate roughly 4x that - peak matching throughput needs to comfortably absorb 150-200 requests/sec city-wide, with dense metros provisioned independently.',
    'Write QPS (location): active driver fleet is roughly 1-2M drivers globally, with ~10% (100K-200K) online at any peak moment, each streaming a location ping every ~4 seconds - 25,000-50,000 pings/sec platform-wide, a few MB/sec of raw ingest at ~150 bytes/ping.',
    'Read QPS: rider apps polling/streaming trip status plus driver apps polling for offers adds another tens of thousands of reads/sec against the geospatial and trip layers, dominated by the live-tracking stream rather than the matching path itself.',
    'Storage: a trip record (pickup/drop-off coordinates, timestamps, fare breakdown, driver/rider IDs) is roughly 1-2 KB; 3M trips/day is 3-6 GB/day (~1.5-2 TB/year), easily handled by a store sharded by city. Raw GPS trails are downsampled before long-term retention - only the latest position per driver matters for matching.',
    'Technology choices: Geospatial index -> Redis (GEOADD/GEORADIUS or a custom S2/H3 cell-bucket structure) for sub-millisecond nearby-driver lookups; Trip/Payment store -> Postgres sharded by city for ACID trip and ledger writes; Offer lock -> Redis SET NX EX for atomic driver locking; Live updates -> Kafka + Redis Pub/Sub fanned out to a WebSocket edge gateway; Routing/ETA -> a preprocessed road-network graph service, not a live third-party API call on the matching hot path.',
    'Why not query the trip/driver database directly for nearby drivers? At 25,000-50,000 location writes/sec plus a matching read on every one of ~200 requests/sec, a relational index on lat/lng cannot keep both workloads fast - Redis handles the geospatial hot path in memory while Postgres stays reserved for the strongly-consistent trip and money path.',
    'Why geo-partition by city instead of one global matching cluster? A ride in one city never needs to match against a driver in another, so partitioning by city/region bounds the blast radius of any local demand spike or infrastructure outage to that region alone.',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/trips/estimate',
      description: 'Return a fare estimate and current surge multiplier for a given pickup/destination pair.',
      example:
        '// Request\n{ "pickup": { "lat": 37.77, "lng": -122.41 }, "destination": { "lat": 37.79, "lng": -122.40 } }\n\n// Response 200\n{ "fareEstimateLow": 12.50, "fareEstimateHigh": 15.00, "surgeMultiplier": 1.4, "etaToPickupSec": 180 }',
    },
    {
      method: 'POST',
      path: '/v1/trips',
      description: 'Request a ride. Requires an Idempotency-Key header. Creates a trip in "REQUESTED" state and triggers the matching pipeline.',
      example:
        '// Request\n{ "riderId": "r_2231", "pickup": { "lat": 37.77, "lng": -122.41 }, "destination": { "lat": 37.79, "lng": -122.40 } }\n\n// Response 202\n{ "tripId": "t_88213", "status": "MATCHING" }',
    },
    {
      method: 'POST',
      path: '/v1/trips/{tripId}/respond',
      description: 'Driver accepts or declines an offered trip within the offer TTL window.',
      example: '// Request\n{ "driverId": "d_5510", "response": "accept" }\n\n// Response 200\n{ "tripId": "t_88213", "status": "MATCHED" }',
    },
    {
      method: 'GET',
      path: '/v1/trips/{tripId}',
      description: 'Fetch current trip status, matched driver, and last known ETA.',
      example: '// Response 200\n{ "tripId": "t_88213", "status": "IN_PROGRESS", "driverId": "d_5510", "etaSeconds": 240 }',
    },
    {
      method: 'WS',
      path: '/v1/trips/{tripId}/stream',
      description: 'Subscribe to live location, ETA, and status updates for the duration of a trip.',
      example: '// Server push\n{ "type": "location", "lat": 37.775, "lng": -122.408, "etaSeconds": 210 }',
    },
    {
      method: 'POST',
      path: '/v1/trips/{tripId}/cancel',
      description: 'Rider or driver cancels the trip. Cancellation policy (fee or none) depends on the trip status at cancel time.',
      example: '// Response 200\n{ "tripId": "t_88213", "status": "CANCELLED", "cancellationFee": 0 }',
    },
    {
      method: 'POST',
      path: '/v1/trips/{tripId}/rate',
      description: 'Submit a post-trip rating (1-5) and optional comment for the other party.',
      example: '// Request\n{ "raterRole": "rider", "rating": 5, "comment": "Great driver" }\n\n// Response 200\n{ "status": "RECORDED" }',
    },
  ],
  apiSecurityNote:
    "JWT bearer auth required on every endpoint, scoped separately for rider vs driver tokens. Ride requests and payment captures carry an idempotency key so retries from a flaky mobile connection never create duplicate trips or double-charge a fare. Location pings are signed by the driver app and rate-limited per driver ID to prevent a compromised client from flooding the geospatial index with spoofed positions.",

  highLevelDesignIntro:
    'Five passes, each adding one functional requirement: ingest driver location, match and dispatch a ride, stream live trip status, price dynamically, and settle payment.',

  builds: [
    {
      title: 'FR-1: Ingest Driver Location and Build the Geospatial Index',
      body:
        "Before any matching can happen, the system needs a fast, fresh, queryable view of where every online driver currently is. Drivers stream a location ping every few seconds over a persistent connection, and those pings need to land in a structure that answers \"who is near this point?\" in single-digit milliseconds - not a relational table scan.",
      insightCallout:
        "We only rewrite a driver's cell membership in the geospatial index when they actually cross a cell boundary, not on every single ping - at tens of thousands of pings/sec, indexing every ping regardless of movement would be pure write amplification for no matching benefit, since matching only cares which cell a driver is currently in.",
      newComponents: [
        {
          name: 'Location Ingestion Service',
          description: 'Terminates the persistent WebSocket/gRPC stream from each driver app and validates/rate-limits incoming pings.',
        },
        {
          name: 'Geospatial Index (Redis)',
          description: "In-memory structure keyed by S2/H3/geohash cell ID, mapping cell -> set of driver IDs currently in that cell.",
        },
        {
          name: 'Driver Registry',
          description: 'Durable store of driver metadata (vehicle type, eligibility, online/offline state) and the last-known raw position for display.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  driver[Driver App]:::client
  ingest[Location Ingestion]:::edge
  geo[("Geospatial Index<br/>Redis, S2/H3 cells")]:::cache
  reg[("Driver Registry")]:::database

  driver -->|"1. location ping every 4s (lat, lng, heading)"| ingest
  ingest -->|"2. update cell membership if boundary crossed"| geo
  ingest -->|"3. update last-known position"| reg`,
      },
      steps: [
        "Driver app opens a persistent connection to the Location Ingestion Service and streams (lat, lng, heading, speed) roughly every 4 seconds",
        "Ingestion computes the driver's current S2/H3 cell from the raw coordinates",
        "If the cell is unchanged since the last ping, only the raw position in the Driver Registry is refreshed (for map display / dead reckoning) - the geospatial index write is skipped",
        "If the cell changed, the driver is removed from the old cell's set and added to the new cell's set in Redis - an O(1) SREM + SADD pair",
        "Cells are sized to roughly the expected search radius (a few hundred meters in a dense downtown, a couple of kilometers in a suburb) so a ring search rarely has to expand more than 1-2 rings to find enough candidates",
      ],
      closingNote:
        "Why Redis over a relational table for driver position? Matching needs to ask \"who's near this point\" tens of thousands of times a minute against a population that's rewriting its own position just as often - an in-memory cell-bucket structure answers that in O(1) per cell, while a lat/lng-indexed relational table would need either a full geospatial index rebuild or accept second-plus staleness under this write volume. Cell-boundary-only writes cut the write rate by roughly an order of magnitude versus indexing on every raw ping, since most 4-second movements don't cross a cell edge.",
    },
    {
      title: 'FR-2: Request a Ride and Match to a Driver',
      body:
        "A rider requests a trip; the system has to find a nearby, eligible, available driver and get them to accept - without ever offering the same driver to two riders at once, and without pure greedy nearest-match leaving the fleet worse off city-wide.",
      insightCallout:
        "The offer lock (Redis SET NX EX) is what actually prevents double-dispatch - it, not the matching logic itself, is the correctness boundary. Matching can be as smart or as approximate as we want; the lock guarantees that whichever flow wins the race is the only one that gets the driver.",
      newComponents: [
        { name: 'Matching Service', description: 'Batches open trip requests over a short rolling window and scores candidate drivers against them.' },
        { name: 'ETA/Routing Service', description: 'Scores candidates by real road-network travel time to pickup, not straight-line distance.' },
        { name: 'Offer Lock (Redis SET NX EX)', description: 'Atomically locks a driver against one pending offer at a time, with a short TTL as a safety net.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  rider[Rider App]:::client
  gw[API Gateway]:::edge
  match[Matching Service]:::compute
  geo[("Geospatial Index")]:::cache
  eta[ETA/Routing Service]:::compute
  lock[("Offer Lock<br/>Redis SET NX EX")]:::cache
  driver[Driver App]:::client

  rider -->|"1. POST /trips (pickup, dest)"| gw
  gw -->|"2. forward request"| match
  match -->|"3. query nearby cells, ring expand"| geo
  match -->|"4. score candidates by ETA"| eta
  match -->|"5. SET NX EX lock candidate"| lock
  match -->|"6. push time-boxed offer"| driver`,
      },
      steps: [
        'Rider submits a trip request; the Matching Service adds it to a short rolling batch window (a couple of seconds) rather than matching it in isolation',
        "At each batch tick, Matching queries the Geospatial Index for the rider's cell and expanding rings around it until enough eligible candidates are found",
        'ETA/Routing Service scores each candidate by real road-network travel time to pickup, not straight-line distance',
        'Matching solves a small assignment problem across the batch of open requests and available drivers, picking the pairing that minimizes total ETA/idle time rather than assigning each request its single closest driver',
        'For the winning pairing, Matching attempts SET show_offer:{driverId} {tripId} NX EX 15 in Redis - if it fails, the driver was already claimed by a concurrent match and this flow falls through to the next-ranked candidate',
        'On lock success, an offer is pushed to the driver app with a 10-15s countdown; accept confirms the trip as MATCHED and releases the lock permanently in the driver\'s favor, decline or TTL expiry releases the lock and re-offers the next candidate',
      ],
      closingNote:
        "Why batch instead of matching each request the instant it arrives? Always assigning the single nearest driver per request is simple and minimizes latency for that one request, but it ignores that drivers are a shared, contested resource - a few seconds of batching lets the assignment consider several requests and several drivers together, meaningfully improving fleet-wide idle time and pickup ETAs during exactly the peak periods where it matters most.",
    },
    {
      title: 'FR-3: Live Trip Tracking (Location Streaming)',
      body:
        "Once matched, both rider and driver need to see live position, ETA, and status changes without either side polling the trip API into the ground. This is a one-directional, high-fan-out delivery problem, structurally separate from the trip's authoritative state.",
      insightCallout:
        "Location and ETA updates during a trip are explicitly eventually consistent - a stale map dot for a couple of seconds is harmless. Trip status transitions (matched, arriving, in progress, completed) come from the strongly-consistent Trip service and are never inferred from the location stream, so a location hiccup can never make the app think a trip ended or started that didn't.",
      newComponents: [
        { name: 'Live Update Pub/Sub', description: 'Fans out position/ETA/status changes for a trip to every subscriber (rider + driver apps) as they happen.' },
        { name: 'WebSocket Gateway', description: 'Holds the persistent client connection at the edge and pushes updates with no client polling required.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  driver[Driver App]:::client
  ingest[Location Ingestion]:::edge
  pubsub[["Live Update Pub/Sub"]]:::async
  wsgw[WebSocket Gateway]:::edge
  rider[Rider App]:::client

  driver -->|"1. location ping"| ingest
  ingest -->|"2. publish position + ETA"| pubsub
  pubsub -->|"3. fan out to trip subscribers"| wsgw
  wsgw -->|"4. push over socket"| rider`,
      },
      steps: [
        "While a trip is active, each of the driver's location pings is also published to a per-trip channel on the Live Update Pub/Sub, keyed by tripId",
        'The WebSocket Gateway holds a persistent connection per active rider/driver app screen and subscribes it to that channel for the duration of the trip',
        'On each publish, subscribers immediately receive the new position and a recomputed ETA - no polling required',
        "The client interpolates the driver's icon smoothly between pings using dead reckoning off last known heading/speed, so the UI appears to update more often than the backend actually pings",
        "If the socket drops (tunnel, elevator, flaky network), the client falls back to short-interval polling of GET /v1/trips/{tripId} until the socket reconnects - the UI shows a staleness indicator rather than freezing silently",
      ],
      closingNote:
        "WebSocket push vs. polling is a real trade-off, not a free win: persistent connections deliver low-latency, low-redundant-traffic updates but require holding hundreds of thousands of concurrent stateful connections at the edge, which complicates load balancing and reconnection handling on mobile networks. Polling is simpler to scale horizontally and tolerates drops gracefully but either wastes bandwidth polling too often or feels sluggish polling too rarely. The hybrid used here - push while the trip is active, poll as a fallback - keeps the UX responsive without making a persistent connection a hard dependency for correctness, the same trade this problem faces in food-delivery live tracking.",
    },
    {
      title: 'FR-4: Dynamic Surge Pricing as a Live Control Loop',
      body:
        "The platform needs to price a ride based on how scarce drivers are right now in that area - and once a rider has seen a quote, the price they're charged must be exactly that quote, no matter how conditions change in the seconds or minutes before pickup.",
      insightCallout:
        "Surge pricing isn't just a markup - it's a real-time control loop that simultaneously discourages some demand and pulls idle drivers from adjacent, calmer cells toward the surging one. The one correctness rule that matters more than the pricing model itself: the multiplier gets written into the trip record at match time and is never recomputed later.",
      newComponents: [
        { name: 'Pricing Service', description: 'Computes a smoothed supply/demand ratio per geospatial cell and derives a live surge multiplier.' },
        { name: 'Supply/Demand Counters (Redis)', description: 'Per-cell counters of open ride requests vs. available nearby drivers, updated continuously as requests and driver states change.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  rider[Rider App]:::client
  pricing[Pricing Service]:::compute
  agg[("Supply/Demand Counters<br/>per cell, Redis")]:::cache
  match[Matching Service]:::compute
  trip[("Trip Record")]:::database

  rider -->|"1. request fare estimate"| pricing
  pricing -->|"2. read smoothed ratio for cell"| agg
  match -->|"3. update open-request/available-driver counts"| agg
  pricing -->|"4. lock multiplier into trip at match time"| trip`,
      },
      steps: [
        'As requests arrive and drivers go online/offline/busy, Matching keeps a rolling, exponentially-smoothed count per cell of open requests and available nearby drivers',
        'Pricing Service derives a multiplier from that ratio, smoothed over a short window (tens of seconds) to avoid the multiplier whiplashing on every single request',
        'A fare estimate call reads the current multiplier for the pickup cell and returns it alongside the base fare range - this value is advisory, not yet binding',
        'When a trip actually gets matched, the multiplier active at that instant is written once into the trip record and never touched again for that trip',
        "Trip completion computes the final fare from base rate + locked surge multiplier + tolls + tip - never from whatever the multiplier happens to be at that later moment",
      ],
      closingNote:
        "Why lock at match time instead of continuously repricing until pickup? Continuous repricing keeps the fare perfectly aligned with live supply/demand at every instant, but it erodes rider trust and complicates every downstream receipt and refund calculation. Locking at match/quote time means the platform occasionally absorbs a little pricing precision if conditions shift sharply afterward, in exchange for the far more valuable guarantee that a rider is never charged something other than what they explicitly saw and agreed to.",
    },
    {
      title: 'FR-5: Trip Completion, Payment Settlement, and Ratings',
      body:
        "When the driver marks a trip complete, the platform has to finalize the fare, capture payment from the rider exactly once, and make the driver's payable amount reconciliable from a durable ledger rather than recomputed ad hoc later - then let both parties rate each other.",
      insightCallout:
        "Payment capture and the driver's payout are deliberately not the same write. Capture happens once, immediately, against the rider. The driver's payable amount is a ledger entry derived from that capture, settled to their bank account in a separate batch process - so a dispute or chargeback days later never has to reverse money that's already left the platform.",
      newComponents: [
        { name: 'Payment Service', description: 'Finalizes the fare and captures payment from the rider with an idempotency key derived from the trip ID.' },
        { name: 'Ledger', description: 'Append-only double-entry record (rider charge, platform fee, driver payable) that all payout and reporting logic reads from.' },
        { name: 'Rating Service', description: 'Collects post-trip ratings from both parties and rolls them into each account\'s eligibility score.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  driver[Driver App]:::client
  rider[Rider App]:::client
  tripsvc[Trip Service]:::compute
  pay[Payment Service]:::compute
  pgw[Payment Gateway]:::edge
  db[("Postgres<br/>trips + ledger")]:::database
  kafka[["Kafka"]]:::async

  driver -->|"1. mark trip completed"| tripsvc
  tripsvc -->|"2. finalize fare (base + surge + tolls - promo)"| pay
  pay -->|"3. capture from rider, idempotency key = tripId"| pgw
  pgw -->|"4. webhook result"| pay
  pay -->|"5. write ledger entry in same txn as trip COMPLETED"| db
  tripsvc -->|"6. publish trip.completed"| kafka
  rider -->|"7. submit rating"| tripsvc`,
      },
      steps: [
        'Driver taps "End Trip" -> Trip Service computes the final fare from the locked surge multiplier, distance/time from the routing service, and any tolls',
        'Payment Service calls the external gateway with idempotencyKey = tripId + captureAttempt, so a retry after a timeout never double-charges the rider',
        'On capture success, a single database transaction updates the trip to COMPLETED and writes a ledger entry: debit rider, credit platform fee, credit driver-payable - this is the only place a driver\'s earnings are ever written',
        "Trip Service publishes trip.completed to Kafka; consumers send the receipt, invalidate the trip's live-update channel, and open a rating prompt on both apps",
        'Driver payouts are a nightly batch settlement job that sums unpaid ledger entries per driver and initiates a bank transfer - never a synchronous, per-trip wire transfer that would need reversing on every dispute',
        'Either party can submit a rating within a grace window; ratings roll into a trailing average that future matching eligibility checks read',
      ],
      closingNote:
        "Why a ledger instead of just a `driverEarnings` column that gets incremented per trip? Increment-in-place is not idempotent - a retried write double-counts. An append-only ledger is: replaying the same completed-trip event twice produces the same entries if keyed by tripId, disputes and refunds are new offsetting entries rather than destructive edits, and the payout batch job can always recompute \"how much do we owe driver D\" from scratch by summing the ledger, which is the property that actually matters for financial correctness.",
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1 - Matching With Offer Race Handling',
      diagram: {
        mermaid: `sequenceDiagram
    actor Rider
    participant M as Matching Service
    participant G as Geospatial Index
    participant L as Offer Lock (Redis)
    participant D1 as Driver A
    participant D2 as Driver B

    Rider->>M: request ride (pickup coords)
    M->>G: query nearby cells, ring expand
    G-->>M: candidates [A, B, C]
    M->>M: score by ETA + fleet efficiency
    M->>L: SET NX EX offer:A tripId 15
    L-->>M: OK (lock acquired)
    M->>D1: offer (TTL 15s)
    alt Driver A accepts within TTL
        D1-->>M: accept
        M->>Rider: matched with Driver A
    else Driver A declines or times out
        D1-->>M: decline/timeout
        M->>L: SET NX EX offer:B tripId 15
        L-->>M: OK
        M->>D2: offer (TTL 15s)
        D2-->>M: accept
        M->>Rider: matched with Driver B
    end`,
      },
      nonObviousFailure:
        "What if Matching crashes after acquiring the offer lock but before the push notification actually reaches Driver A's app? The lock has a 15s TTL, so it self-heals - the driver never sees an offer, the lock expires, and the driver becomes eligible for the next batch. Worst case is a 15-second window where Driver A looks unavailable to everyone else for a trip they never even saw.",
    },
    {
      title: 'Flow 2 - Live Location Streaming During an Active Trip',
      diagram: {
        mermaid: `sequenceDiagram
    participant Driver
    participant Ingest as Location Ingestion
    participant PS as Live Update Pub/Sub
    participant WS as WebSocket Gateway
    actor Rider

    Rider->>WS: open /v1/trips/{id}/stream
    WS->>PS: subscribe to trip channel
    loop every ~4s while trip active
        Driver->>Ingest: location ping
        Ingest->>PS: publish position + recomputed ETA
        PS->>WS: fan out to trip subscribers
        WS-->>Rider: push location update
    end
    Note over Rider,WS: socket drops (tunnel/elevator)
    Rider->>Rider: fall back to polling GET /trips/{id}
    Note over Rider,WS: socket reconnects
    Rider->>WS: re-subscribe to trip channel`,
      },
      nonObviousFailure:
        "If the WebSocket Gateway instance holding the rider's connection is redeployed mid-trip, the rider's app sees a clean disconnect and immediately falls back to polling - it never mistakes a gateway restart for the driver going silent, because trip status itself is read fresh from the Trip Service on every poll, not inferred from the absence of a push.",
    },
    {
      title: 'Flow 3 - Surge Price Locked at Match Time',
      diagram: {
        mermaid: `sequenceDiagram
    actor Rider
    participant P as Pricing Service
    participant Agg as Supply/Demand Counters
    participant M as Matching Service
    participant T as Trip Record

    Rider->>P: GET fare estimate
    P->>Agg: read smoothed ratio for cell
    Agg-->>P: ratio = 2.1x demand
    P-->>Rider: surgeMultiplier = 1.4 (advisory)
    Rider->>M: POST /trips (request ride)
    M->>P: read current multiplier at match instant
    P-->>M: surgeMultiplier = 1.6 (demand rose)
    M->>T: write trip with lockedSurgeMultiplier = 1.6
    Note over Agg,P: demand later drops to 1.1x
    Note over T: trip fare still uses 1.6 - never recomputed`,
      },
      nonObviousFailure:
        'The multiplier shown on the fare estimate (1.4) and the one actually locked at match time (1.6) can legitimately differ, because demand moved in the seconds between quote and match - riders are told the estimate is advisory precisely for this reason, and the trip record, not the earlier estimate, is the only value that ever determines what gets charged.',
    },
    {
      title: "Trip Lifecycle State Machine",
      diagram: {
        mermaid: `stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> MATCHING: enters batch window
    MATCHING --> MATCHED: offer accepted
    MATCHING --> NO_DRIVERS_FOUND: no candidates after retries
    MATCHED --> DRIVER_ARRIVING: driver en route to pickup
    DRIVER_ARRIVING --> IN_PROGRESS: rider picked up
    DRIVER_ARRIVING --> CANCELLED_BY_RIDER: rider cancels before pickup
    DRIVER_ARRIVING --> CANCELLED_BY_DRIVER: driver cancels before pickup
    IN_PROGRESS --> COMPLETED: drop-off confirmed
    IN_PROGRESS --> CANCELLED_BY_RIDER: rare mid-trip cancellation
    COMPLETED --> PAID: payment captured
    PAID --> DISPUTED: chargeback or rider dispute
    NO_DRIVERS_FOUND --> [*]
    CANCELLED_BY_RIDER --> [*]
    CANCELLED_BY_DRIVER --> [*]
    PAID --> [*]
    DISPUTED --> [*]`,
        bullets: [
          'Every transition publishes a Kafka event consumed by: the live-update channel (status push), analytics, the ratings prompt trigger, and the ledger/settlement reconciler.',
          'A cancellation fee applies only from DRIVER_ARRIVING onward, once a specific driver has already committed idle time to the trip.',
        ],
      },
    },
  ],

  deepDives: [
    {
      title: 'Cell-Based Geospatial Indexing for Sub-Second Matching',
      problem:
        'Matching a rider to a driver requires answering "which available drivers are near this point" in single-digit milliseconds against a population that is moving and re-pinging every few seconds. What structure makes that fast at a million-driver fleet scale?',
      simpleTerms:
        "Instead of checking the distance from every single driver to the rider (which gets slow fast), we chop the map into small tiles and only look at drivers in the rider's tile and the tiles right around it.",
      bad: "Scan every online driver's stored lat/lng and compute distance to the rider, sort, take the closest. Correct, but O(N) per request against a population in the hundreds of thousands - completely unworkable at request volume.",
      good: 'A fixed-precision geohash grid: encode every driver\'s position into a geohash string prefix, bucket drivers by that prefix, and query the rider\'s bucket plus its neighbors. Turns an O(N) scan into a bounded lookup, but square geohash cells have non-uniform neighbor distances - a diagonal neighbor is ~41% farther away than an edge neighbor - which distorts ring-expansion search near cell boundaries.',
      great:
        "S2 or H3 hierarchical cells instead of flat geohash strings, sized to roughly the expected search radius (a few hundred meters downtown, a couple of kilometers in suburbs). H3's hexagons give every neighbor the same center-to-center distance, so ring expansion (check cell, then ring 1, then ring 2...) behaves predictably regardless of which direction the nearest drivers happen to be. The genuinely hard part isn't the read path - it's keeping the index cheap to write: only rewrite a driver's cell membership when they actually cross a cell boundary (tracked by comparing new cell ID to last cell ID on each ping), not on every 4-second ping regardless of movement, cutting index writes by roughly an order of magnitude versus indexing raw position directly. Raw position for map display is tracked separately from cell membership so display smoothness never depends on index-write frequency.",
      diagram: {
        mermaid: `flowchart TD
  center["Rider Cell (S2/H3)"]:::cache
  ring1["Ring 1 Neighbors"]:::cache
  ring2["Ring 2 Neighbors"]:::cache

  center -->|"0 candidates found"| ring1
  ring1 -->|"still fewer than K candidates"| ring2`,
      },
    },
    {
      title: 'Preventing Double-Dispatch: Locking a Driver Against Concurrent Offers',
      problem:
        'A driver can legitimately be the top candidate for two nearly-simultaneous ride requests. Without a hard guarantee, two riders could both be told the same driver is on the way.',
      bad: 'Check-then-act in application code: `if driver.status == AVAILABLE then driver.status = OFFERED`. Classic race - two matching flows both read AVAILABLE before either write lands, both proceed.',
      good: "A database row-level lock (`SELECT ... FOR UPDATE` on the driver row) serializes concurrent offer attempts. Correct, but under real peak load - thousands of concurrent match attempts across a city - this creates lock contention and connection-pool pressure on the same store that also needs to serve strongly-consistent trip writes.",
      great:
        "Redis `SET NX EX` as the actual lock, entirely decoupled from the trip database: `SET offer:{driverId} {tripId} NX EX 15`. NX makes it an atomic compare-and-set - only one caller can ever win for a given driver - and EX gives it a 15-second self-releasing TTL so a crashed matching flow can never strand a driver locked forever. On decline or accept, the key is explicitly deleted (accept instead re-writes it with a much longer TTL tied to the trip). A monotonic fencing value stored alongside the tripId protects against a very late, out-of-order accept arriving after the offer already expired and was re-offered to someone else - the app checks the fencing value on accept and rejects a stale one. Postgres still enforces a `UNIQUE(driverId) WHERE status = 'ON_TRIP'` constraint as a last-line backstop in case the lock layer itself ever has a split-brain moment.",
      diagram: {
        mermaid: `flowchart LR
  match[Matching Service]:::compute
  lock[("Redis<br/>offer:{driverId} lock")]:::cache
  driver[Driver App]:::client
  db[("Postgres<br/>UNIQUE(driverId) backstop")]:::database

  match -->|"1. SET NX EX offer lock"| lock
  lock -->|"2. OK or nil"| match
  match -->|"3. push offer if lock won"| driver
  driver -->|"4. accept"| match
  match -->|"5. write ON_TRIP, unique constraint enforced"| db`,
      },
    },
    {
      title: 'Matching as a Batched Assignment Problem',
      problem:
        'Treating every ride request independently and greedily assigning the closest driver is simple, but it is demonstrably worse for the fleet as a whole than briefly considering several requests and drivers together.',
      bad: 'Pure greedy nearest-match, one request at a time, first-come-first-served. Simple and low-latency per request, but can leave a driver committed to a farther pickup while a much closer request appears seconds later - there is no mechanism to reconsider.',
      good: 'A slightly wider candidate list per request (top-5 nearest instead of top-1), still matched independently. Marginally better, but still ignores that drivers are a shared resource being competed for by multiple simultaneous requests.',
      great:
        'A short rolling batch window (a couple of seconds) collects open requests and available drivers, then solves a min-cost bipartite assignment (conceptually the Hungarian algorithm, though production systems use faster approximations at this scale) scored on ETA-to-pickup plus a fleet-efficiency term that penalizes long deadhead (empty) driving. The trade is a small, deliberate delay before an offer goes out, in exchange for materially better aggregate idle time and pickup ETAs city-wide - the same trade Uber has described publicly for its DISCO dispatch-optimization system. In low-density areas or off-peak hours, the batch degrades gracefully to effectively greedy matching anyway, since there is rarely more than one reasonable candidate - the added complexity only earns its keep in dense, contested conditions.',
      diagram: {
        mermaid: `flowchart LR
  reqs["Open Requests<br/>batch window"]:::compute
  drivers["Available Drivers<br/>batch window"]:::compute
  solver["Assignment Solver<br/>ETA + efficiency scoring"]:::compute
  offers["Ranked Offers"]:::compute

  reqs --> solver
  drivers --> solver
  solver --> offers`,
      },
    },
    {
      title: 'Surge Pricing as a Real-Time Supply/Demand Control Loop',
      problem:
        'Pricing needs to reflect how scarce drivers are right now in a given area, react fast enough to matter, and never change on a rider after they have already seen and accepted a quote.',
      simpleTerms:
        "The price goes up a bit when there are way more people wanting a ride than drivers available nearby - that extra bit both nudges some riders to wait a few minutes and nudges idle drivers in calmer nearby areas to head over. Once you're matched to a driver, the price you agreed to never changes, even if the surge level changes right after.",
      bad: 'A fixed markup schedule by time of day (e.g., always 1.3x during rush hour) with no relationship to actual live conditions. Misses real spikes entirely (a sudden storm) and overcharges on quiet days that happen to fall in the scheduled window.',
      good: 'Compute open-requests-to-available-drivers ratio per cell at request time and reprice again at trip completion based on whatever the ratio is by then. Reacts to real conditions, but a rider can be charged a fare that reflects conditions they never saw quoted - a correctness and trust problem, not just a UX one.',
      great:
        "A continuously updated, exponentially-smoothed ratio per cell (smoothing window in the tens of seconds, to avoid the multiplier whiplashing on every single request or driver state change) derives the live multiplier. The one rule that overrides everything else: whatever multiplier is active at the moment a trip is matched gets written once into the trip record and is never recomputed, regardless of how the ratio moves afterward - fare estimates shown before matching are explicitly advisory. Cells are aggregated at more than one grid resolution (fine cell + its parent region) so a rider standing exactly on a cell boundary doesn't see the multiplier flicker between two very different values depending on which side of an arbitrary line they're on.",
      diagram: {
        mermaid: `flowchart LR
  cell1[("Cell A<br/>ratio 2.1x")]:::cache
  cell2[("Cell B<br/>ratio 1.0x")]:::cache
  pricing[Pricing Service]:::compute
  trip[("Trip Record<br/>locked multiplier")]:::database

  cell1 --> pricing
  cell2 --> pricing
  pricing -->|"multiplier active at match instant"| trip`,
      },
    },
    {
      title: 'Real-Time Trip Tracking: WebSocket vs Polling',
      problem:
        "Rider and driver both need a near-live view of position, ETA, and status for the duration of a trip, without either overloading the backend with millions of stateful connections or feeling laggy.",
      bad: "Client polls GET /trips/{id} every 1-2 seconds for the whole trip duration. At even a modest fraction of concurrently active trips, this is a huge, mostly-wasted request volume - most polls return unchanged data.",
      good: "Server-Sent Events or short polling backed by an aggressively cached snapshot (few-second TTL). Cuts backend load a lot since most reads hit cache, but every client still sees data that's stale by up to the cache TTL, and SSE alone can't carry client-to-server signals if the trip screen ever needs any (e.g., a driver ping).",
      great:
        "Persistent WebSocket connection for the duration of an active trip screen, fed by the Live Update Pub/Sub, with a client-side fallback to polling if the socket drops. This gives push-based, low-latency, low-redundant-traffic updates while the trip matters most, without making the persistent connection a hard dependency for correctness - trip status itself always comes from a fresh read of the Trip Service, never inferred from silence on the socket. On the client, dead reckoning interpolates the driver's icon smoothly between the actual ~4-second pings using last known heading and speed, so perceived UI freshness is decoupled from backend ingestion frequency - this is the same tracking trade-off food-delivery live tracking makes, and for the same reason: only a screen the user is actively staring at (an in-progress trip) justifies holding a stateful connection open.",
      diagram: {
        mermaid: `flowchart LR
  client[Rider/Driver App]:::client
  wsgw[WebSocket Gateway]:::edge
  pubsub[["Live Update Pub/Sub"]]:::async
  poll[Polling Fallback]:::edge

  client -->|"1. open socket while trip active"| wsgw
  wsgw --> pubsub
  client -.->|"2. socket drops"| poll
  poll -.->|"3. GET /trips/id every few seconds"| client`,
      },
    },
    {
      title: 'ETA and Routing Under Live Traffic',
      problem:
        "Both matching (to score candidate drivers) and the rider-facing display need an ETA that reflects actual road travel time - not straight-line distance - and it has to come back in well under 50ms per query at matching volume.",
      bad: 'Straight-line (haversine) distance divided by an assumed average speed. Fast to compute, but wildly inaccurate in any real city - a river, a highway with no nearby on-ramp, or a one-way grid can turn a "close" straight-line pickup into a 10-minute detour.',
      good: 'Shortest-path search (Dijkstra/A*) over the actual road-network graph with static edge weights (posted speed limits). Materially more accurate than haversine, but a plain shortest-path search over a full metro road graph is too slow to run per-candidate at matching volume, and static weights ignore that a road is currently jammed.',
      great:
        "A preprocessed road-network graph (contraction hierarchies or a similar precomputed shortest-path index, the technique behind engines like OSRM/Valhalla) answers multi-source shortest-path queries in single-digit milliseconds instead of running a fresh search per query. Edge weights are continuously updated from aggregated live GPS trace speeds across the fleet, not static speed limits, so a query made during a traffic jam reflects that jam. ETA is recomputed periodically during an active trip (not just once at match time) as the driver's actual route and traffic conditions evolve, and hot origin-destination pairs (common commute corridors) are cached, since the same query pattern repeats heavily during rush hour.",
      diagram: {
        mermaid: `flowchart LR
  req["Candidate driver + pickup"]:::compute
  graph[("Preprocessed Road Graph<br/>contraction hierarchies")]:::storage
  live[("Live Traffic Weights<br/>from fleet GPS traces")]:::cache
  eta["ETA Result"]:::compute

  req --> graph
  live --> graph
  graph --> eta`,
      },
    },
    {
      title: 'Trip State Machine, Idempotent Payment Capture, and Driver Payout',
      problem:
        "A trip moves through many states, and at completion the platform must capture the rider's payment exactly once, split it into platform fee and driver payable, and make that payable amount reconcilable even if a crash happens mid-settlement.",
      simpleTerms:
        'When a trip ends, we charge the rider once (never twice, even on retry) and write down exactly how much of that goes to the driver in a permanent record - the driver\'s actual payout happens later in a batch, calculated from that record, not wired instantly per trip.',
      bad: "Charge the rider's card directly when the driver taps 'End Trip', then increment a `driver.balance` column by the driver's share. No idempotency key, so a client retry or a flaky gateway response double-charges the rider; incrementing a balance in place means a duplicate or out-of-order write permanently corrupts that driver's earnings with no way to recompute it.",
      good: "Add an idempotency key (derived from tripId) on the payment capture call, so retries are safe against double-charging the rider. Still write the driver's payable amount into a mutable running-total field rather than an append-only record - safer on the charge side, but a payout dispute or refund still has nothing to reconstruct from.",
      great:
        "Idempotency key = tripId + captureAttempt against the payment gateway, so any retry (client-side or our own after a timeout) returns the same result instead of charging twice. On successful capture, a single database transaction does two things atomically: mark the trip COMPLETED and append a ledger entry - debit rider, credit platform fee, credit driver-payable - keyed by tripId so replaying the same completed-trip event twice is a no-op, not a double credit. The driver's payable balance is never stored directly; it's always the sum of unsettled ledger entries for that driver, computed fresh by a nightly batch settlement job that initiates the actual bank transfer and marks those entries settled. This means a chargeback or rider dispute days later is a new offsetting ledger entry, not a destructive edit to a balance column, and \"how much do we owe driver D\" is always answerable by summing history rather than trusting a running total that might have drifted.",
      diagram: {
        mermaid: `flowchart LR
  tripsvc[Trip Service]:::compute
  pay[Payment Service]:::compute
  pgw[Payment Gateway]:::edge
  ledger[("Ledger<br/>append-only")]:::database
  batch[Nightly Payout Batch]:::compute

  tripsvc -->|"1. finalize fare"| pay
  pay -->|"2. capture, idempotency key = tripId"| pgw
  pgw -->|"3. result"| pay
  pay -->|"4. COMPLETED + ledger entry, one txn"| ledger
  batch -->|"5. sum unsettled entries per driver"| ledger`,
      },
    },
  ],

  selfAudit: [
    {
      question: 'What if two ride requests both target the same driver at nearly the same instant?',
      answer:
        'The driver is locked with an atomic Redis SET NX EX the instant an offer is sent - only one matching flow can hold that key, so the second flow sees the lock already held and immediately falls through to its next-ranked candidate.',
    },
    {
      question: "What happens if a driver's app loses connectivity mid-trip?",
      answer:
        "Trip state lives in the strongly-consistent Trip service and is completely unaffected; only the live-location stream (already eventually consistent) goes stale, and the rider's UI falls back to the last known position plus dead reckoning until pings resume or a timeout flags the driver as disconnected.",
    },
    {
      question: 'How do you prevent the surge multiplier from changing after a rider sees a quote?',
      answer:
        'The multiplier active at the exact moment a trip is matched is written once into the trip record and never recomputed - the earlier fare estimate is explicitly advisory, and the locked value in the trip is the only one that ever determines the final charge.',
    },
    {
      question: 'How does the system handle a city-wide event that spikes demand 10x in one area?',
      answer:
        "The platform is geo-partitioned by city/region, so the spike is contained to that region's matching and pricing capacity; batched assignment plus surge pricing throttle demand and pull idle supply from adjacent cells, and every other city's matching pipeline is completely unaffected.",
    },
    {
      question: 'How does ETA stay reasonably accurate when GPS pings only arrive every ~4 seconds?',
      answer:
        "The client interpolates the driver's icon smoothly between pings via dead reckoning off last known heading and speed, decoupling perceived UI freshness from actual backend ingestion frequency, while the ETA/Routing service recomputes against the live-traffic-weighted road graph on each new ping.",
    },
    {
      question: 'Can a rider ever get double-charged for the same trip?',
      answer:
        "No - payment capture uses an idempotency key derived from the trip ID, so a client retry or a gateway timeout-and-retry always resolves to the same single charge rather than creating a second one.",
    },
    {
      question: "What if the process crashes between capturing the rider's payment and writing the driver's ledger entry?",
      answer:
        'Both the trip-COMPLETED update and the ledger entry write happen in one database transaction, so that failure mode cannot happen - either both land or neither does, and a reconciler can safely retry the whole settlement step against the idempotency key if the capture itself needs to be re-verified with the gateway.',
    },
    {
      question: 'Single points of failure?',
      answer:
        'The geospatial index (Redis) is sharded and replicated per region; a regional outage degrades matching/tracking in that region only (fails closed on new matches, existing trips unaffected since trip/payment state lives in a separate store). The Trip/Payment store runs primary + synchronous standby per city shard.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  rider[Rider App]:::client
  driver[Driver App]:::client

  subgraph "Edge"
    gw[Regional API Gateway]:::edge
    ingest[Location Ingestion]:::edge
    wsgw[WebSocket Gateway]:::edge
  end

  subgraph "Matching and Pricing"
    geo[("Geospatial Index<br/>Redis, S2/H3 cells")]:::cache
    match[Matching Service]:::compute
    eta[ETA/Routing Service<br/>preprocessed road graph]:::compute
    lock[("Offer Lock<br/>Redis SET NX EX")]:::cache
    pricing[Pricing Service]:::compute
    agg[("Supply/Demand Counters")]:::cache
  end

  subgraph "Trip and Payment"
    tripsvc[Trip Service]:::compute
    tripdb[("Postgres<br/>sharded by city")]:::database
    pay[Payment Service]:::compute
    pgw[Payment Gateway]:::edge
    ledger[("Ledger")]:::database
    batch[Nightly Payout Batch]:::compute
  end

  subgraph "Real-Time Delivery"
    pubsub[["Live Update Pub/Sub"]]:::async
    kafka[["Kafka<br/>trip lifecycle events"]]:::async
  end

  subgraph "Observability"
    metrics[Prometheus]:::compute
    traces[OpenTelemetry + Jaeger]:::compute
    olap[("Analytics Store")]:::database
  end

  driver -->|"location ping"| ingest
  ingest -->|"update cell membership"| geo
  ingest -->|"publish position + ETA"| pubsub
  rider -->|"request ride / fare estimate"| gw
  gw --> match
  match -->|"nearby drivers"| geo
  match --> eta
  match -->|"read/update supply-demand"| agg
  pricing -->|"read ratio"| agg
  match -->|"read multiplier at match instant"| pricing
  match -->|"acquire driver lock"| lock
  match -->|"offer"| driver
  match -->|"create trip"| tripsvc
  tripsvc --> tripdb
  tripsvc --> pubsub
  pubsub --> wsgw
  wsgw -.->|"live location/ETA/status"| rider
  wsgw -.->|"live status"| driver
  tripsvc -->|"trip completed"| pay
  pay -->|"capture, idempotency key"| pgw
  pay -->|"COMPLETED + ledger entry, one txn"| ledger
  batch -->|"sum unsettled entries"| ledger
  tripsvc -->|"lifecycle events"| kafka
  match -->|"metrics"| metrics
  tripsvc -->|"traces"| traces
  tripdb -->|"replicate"| olap`,
    bullets: [
      "Driver location streams into the Geospatial Index and, while a trip is active, into the Live Update Pub/Sub for tracking",
      'Matching queries the geospatial index and ETA/Routing service, checks the current surge multiplier, and locks a candidate driver via the offer lock before pushing an offer',
      'A confirmed match creates a strongly-consistent Trip record; the locked surge multiplier travels with it permanently',
      'Live updates fan out through Pub/Sub to a WebSocket Gateway, with client-side polling as a fallback if the socket drops',
      'Trip completion triggers payment capture (idempotent) and an atomic ledger write; a nightly batch job settles driver payouts from the ledger',
      'Trip lifecycle events publish to Kafka for downstream notification, analytics, and reconciliation consumers',
      'City/region partitioning runs through every layer above the client, so one region\'s spike or outage never crosses into another',
    ],
  },

  keyTechnologies: [
    { term: 'S2 Geometry', definition: "Google's hierarchical spherical-cell indexing scheme used to discretize the map into searchable cells for proximity queries." },
    { term: 'H3 Hexagonal Grid', definition: "Uber's open-sourced hexagonal alternative to square geohash cells, giving uniform neighbor distances for ring-expansion search." },
    { term: 'Geohash', definition: 'A grid-based geospatial encoding mapping lat/lng into a sortable string prefix, used for simpler cell-based proximity bucketing.' },
    { term: 'Bipartite Matching', definition: 'An assignment-problem formulation pairing a batch of open ride requests against available drivers to optimize fleet-wide ETA/efficiency rather than greedy nearest-neighbor.' },
    { term: 'Surge Multiplier', definition: 'A dynamically computed, smoothed price multiplier per geographic cell driven by the live open-requests-to-available-drivers ratio, locked into the fare at match time.' },
    { term: 'Distributed Lock (SET NX EX)', definition: "An atomic conditional-write primitive that holds a driver exclusively against one pending offer, preventing double-dispatch, with a TTL as a self-healing safety net." },
    { term: 'Dead Reckoning', definition: "Client-side interpolation of a driver's position between GPS pings using last known heading/speed, smoothing the UI without increasing ping frequency." },
    { term: 'Contraction Hierarchies', definition: 'A road-network preprocessing technique enabling sub-50ms shortest-path/ETA queries at matching volume instead of running a fresh graph search per query.' },
    { term: 'Append-Only Ledger', definition: 'A double-entry record of every trip settlement (rider charge, platform fee, driver payable) from which payouts and disputes are always reconstructed, never recomputed from a mutable balance.' },
  ],

  expectedDepth: {
    mid:
      "Propose a geospatial index (geohash cells) for finding nearby drivers instead of scanning every driver's coordinates. Suggest matching the closest available driver to a rider request. Recognize that driver location updates frequently and doesn't need the same consistency guarantees as trip/payment data. Sketch a basic happy-path flow from request through matching to completion.",
    senior:
      "Explain why greedy nearest-driver matching is suboptimal at city scale and propose batching requests for assignment scoring on ETA plus efficiency. Discuss how to avoid double-dispatching a driver to two riders using an atomic lock with a TTL. Explain why surge pricing must be locked at match time rather than recomputed later, and why the geospatial/matching layer is deliberately eventually consistent while trip/payment state is strongly consistent. Understand why the system is geo-partitioned by city.",
    staffPlus:
      "Design the full separation between the fast, eventually-consistent geospatial/matching/pricing layer and the strongly-consistent trip/payment/ledger layer, articulating why each needs different guarantees. Go deep on the batched bipartite assignment problem including the delay-vs-efficiency tradeoff, on surge pricing as a real-time control loop rather than simple markup pricing, and on WebSocket-vs-polling for live tracking as a genuine engineering trade-off rather than an obvious choice. Address idempotent payment capture and why driver payouts must be reconciled from an append-only ledger rather than a mutable balance, plus regional blast-radius containment under a city-wide demand spike.",
  },

  keyTakeaways: [
    'Geospatial cell indexing (S2/H3) turns "nearest driver" from a table scan into a bounded ring search, with writes minimized by only re-indexing on cell-boundary crossings',
    'A Redis SET NX EX lock, not the matching logic itself, is what actually prevents double-dispatching a driver to two riders',
    'Batched bipartite assignment beats greedy nearest-match at city scale under contention, at the cost of a small deliberate delay',
    'Surge pricing is a live supply/demand control loop, locked into the trip at match time so it can never drift after a rider agrees to a quote',
    'WebSocket push with a polling fallback, plus client-side dead reckoning, decouples perceived tracking freshness from actual ping frequency',
    'Payment capture is idempotent per trip, and driver payouts are always reconciled from an append-only ledger rather than a mutable balance',
  ],

  relatedDesigns: ['food-delivery', 'ticket-booking', 'digital-wallet'],
  relatedConcepts: [
    { name: 'Geospatial Indexing', description: 'Cell-based indexing (S2/H3/geohash) turns nearby-driver search into a bounded ring lookup instead of a distance scan.' },
    { name: 'Distributed Locking', description: 'An atomic conditional write holds a driver against one pending offer at a time, preventing double-dispatch.' },
    { name: 'Pub/Sub / Message Queues', description: 'Fans out live location and trip-lifecycle events to tracking subscribers and downstream consumers without coupling them to the write path.' },
    { name: 'Idempotency', description: 'Idempotency keys on ride requests and payment capture make retries from flaky mobile networks safe against duplicates and double-charges.' },
  ],

  simulator: {
    goalDescription: 'Match riders to nearby drivers within a few hundred milliseconds and stream live location, while keeping trip and payment state strongly consistent.',
    requirementChips: ['Match in under a few hundred ms p99', '50K location pings/sec', 'No double-dispatch of a driver'],
    targetRps: 50000,
    readRatio: 0.45,
    cacheHitRatio: 0.5,
    latencyBudgetMsP99: 300,
    rubric: [
      { id: 'geo-index', label: 'Geospatial index + offer lock (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'trip-db', label: 'Strongly-consistent trip/payment store', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'compute-tier', label: 'Compute tier for matching, ETA, and pricing', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'live-updates', label: 'Async fan-out for live location/status', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-point', label: 'No single point of failure on the matching path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'match-1', type: 'microservice', instanceCount: 8, position: { x: 600, y: 200 } },
        { id: 'geo-1', type: 'redis', instanceCount: 4, position: { x: 880, y: 120 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 6, position: { x: 880, y: 280 } },
        { id: 'trip-1', type: 'postgresql', instanceCount: 12, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-match', source: 'gw-1', target: 'match-1' },
        { id: 'e-match-geo', source: 'match-1', target: 'geo-1' },
        { id: 'e-match-trip', source: 'match-1', target: 'trip-1' },
        { id: 'e-match-kafka', source: 'match-1', target: 'kafka-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Matching queries the Redis geospatial index for nearby drivers and atomically locks a candidate before writing a strongly-consistent trip to Postgres; live location and status updates fan out through a Kafka-backed pub/sub layer, keeping the eventually-consistent tracking path fully decoupled from trip/payment consistency.',
    failureModeNarratives: {
      'redis': "The geospatial index and the driver offer lock both live in one Redis tier on the matching hot path - if it isn't sharded and replicated per region, an outage there stalls all new matching in that region even though existing in-progress trips are unaffected.",
    },
    fullDesignLinkSlug: 'ride-sharing',
  },
}

export default topic
