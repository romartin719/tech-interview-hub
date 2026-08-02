import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'freight-logistics-system',
  title: 'Freight Logistics System',
  difficulty: 'Advanced',
  icon: 'pi pi-truck',
  color: '#b45309',
  readTimeMinutes: 24,
  topics: ['Route Optimization', 'Real-Time GPS Tracking', 'Capacity-Aware Dispatch', 'Multi-Hop Hub Routing'],
  companies: ['Flexport', 'Convoy', 'UPS', 'FedEx'],
  prerequisites: ['Message Queues', 'Nearby Service'],
  summary:
    'A freight logistics platform moves shipments through a multi-hop network of cross-dock hubs by computing capacity- and time-window-aware routes, assigning each hop to a carrier vehicle with enough remaining space, ingesting continuous GPS pings to track every truck in near real time, and automatically re-optimizing when a leg runs late.',

  understandingProblem:
    "Flexport, Convoy, UPS, and FedEx all solve the same underlying problem: a shipment rarely travels directly from pickup to delivery. It gets trucked to a regional hub, consolidated with other freight headed the same direction, cross-docked onto a different trailer, driven to a second or third hub, and finally delivered on a local route - each hop run by a different truck, sometimes a different carrier entirely, under a hard delivery time window the customer was promised. The naive approach - one shipments table with a human dispatcher manually picking a truck - falls apart because it is fundamentally three interlocking optimization problems wearing one trenchcoat: routing (which sequence of hubs minimizes time/cost while respecting the delivery window), assignment (which specific vehicle, with its specific remaining capacity and schedule, should carry this leg), and tracking (where is this shipment right now, and is it still on schedule). Layered on top: trucks break down, drivers hit traffic, hubs get backed up at the loading dock, and a shipment that was on-time an hour ago can suddenly need a completely different route through the network. Getting this right means recognizing that route computation is a constrained optimization problem (the Vehicle Routing Problem, not a shortest-path lookup), that capacity is a ledger that must never be oversold, and that location tracking is a high-volume, eventually-consistent stream that must never block the strongly-consistent shipment and capacity state underneath it.",
  realExamples:
    'Flexport freight forwarding, Convoy digital truckload brokerage, UPS ORION route optimization (driving directions for ~55,000 delivery routes daily), FedEx package tracking and hub sortation network.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Shipper]:::client
  api[Shipment API]:::edge
  db[("Shipments table<br/>origin, destination, status")]:::database
  dispatcher["Human dispatcher<br/>picks a truck by phone/spreadsheet"]:::compute

  client -->|"POST /shipment"| api
  api -->|"INSERT shipment"| db
  dispatcher -->|"reads open shipments"| db
  dispatcher -->|"manually assigns truck"| db`,
    },
    whyThisBreaks: [
      'No route at all - a shipment row just has an origin and destination. Nobody has computed which hubs it should pass through, so the dispatcher guesses based on habit, not on live capacity or traffic.',
      'Capacity lives in someone\'s head - a dispatcher assigns a shipment to a truck without checking whether that truck already has 90% of its weight allowance committed to other shipments, so trucks get overbooked and freight gets bumped at the dock.',
      "No time-window awareness - the assignment doesn't check whether the truck's remaining schedule can actually make the delivery window, so shipments quietly go late with nobody noticing until the customer calls.",
      'Zero visibility once the truck leaves the dock - the shipments table has no live location, so "where is my freight" is answered by calling the driver\'s cell phone.',
      'No reaction to delays - if a truck breaks down or hits a multi-hour traffic jam, nothing in the system notices; the shipment silently drifts off schedule until someone downstream escalates.',
      'A single table cannot represent a multi-hop journey - a shipment that goes origin -> Hub A -> Hub B -> destination has three separate legs, each with its own carrier, vehicle, and status, which a flat row simply cannot model.',
    ],
    closingNote:
      "The rest of this design breaks the journey into an explicit multi-hop route made of hub-to-hub legs, treats vehicle capacity as a ledger that assignment must respect, and adds a continuous GPS ingestion pipeline so location and ETA are always live instead of a phone call away.",
  },

  priorArt: [
    {
      title: 'Flexport Freight Visibility Platform',
      description:
        'Flexport built its brokerage and freight-forwarding business around end-to-end shipment visibility across ocean, air, and trucking legs, unifying tracking events from many carriers into one timeline the shipper can see in real time.',
      link: 'https://www.flexport.com/platform/',
    },
    {
      title: 'Convoy Digital Freight Matching',
      description:
        'Convoy matched shippers directly to truckload carriers using an automated pricing and matching engine instead of manual broker phone calls, treating carrier capacity and lane demand as data to optimize rather than relationships to manage.',
      link: 'https://www.convoy.com/',
    },
    {
      title: 'UPS ORION Route Optimization',
      description:
        "UPS's On-Road Integrated Optimization and Navigation system computes optimized driving routes for tens of thousands of delivery drivers daily, factoring in package data, delivery windows, and road network constraints - this design's route-optimization service borrows the same capacity/time-window-constrained solver approach.",
      link: 'https://about.ups.com/us/en/our-stories/innovation-driven/orion-know-the-facts.html',
    },
    {
      title: 'FedEx Hub-and-Spoke Sortation Network',
      description:
        'FedEx built its entire network around hub-and-spoke consolidation - packages flow through regional sort facilities rather than direct point-to-point routes - the same cross-dock hub model this design uses for multi-hop freight routing.',
      link: 'https://www.fedex.com/en-us/about/company-structure.html',
    },
  ],

  coreEntities: [
    {
      name: 'Shipment',
      description: 'The unit of freight moving from origin to destination, potentially spanning several hub-to-hub legs, tracked through an explicit status (CREATED -> ROUTED -> IN_TRANSIT -> DELIVERED, with EXCEPTION/DELAYED branches).',
    },
    {
      name: 'Route',
      description: "An ordered sequence of legs (origin -> Hub A -> Hub B -> destination) computed by the optimization service under capacity and delivery time-window constraints; recomputed whenever a leg materially deviates from plan.",
    },
    {
      name: 'Leg',
      description: 'One hop of a route between two points (origin/hub/destination), owned by exactly one carrier vehicle at a time, with its own planned and actual start/end times.',
    },
    {
      name: 'Carrier',
      description: 'A trucking company (or owner-operator) contracted to move freight, exposing a fleet of vehicles, service-area constraints, and contracted lane pricing.',
    },
    {
      name: 'Vehicle',
      description: 'A physical truck with a weight/volume capacity, a driver, a live GPS-reported location, and a schedule of committed legs that assignment must check before adding another.',
    },
    {
      name: 'Hub',
      description: 'A cross-dock warehouse facility where freight is consolidated, sorted, and transferred between inbound and outbound legs, with a finite number of dock doors and a daily consolidation schedule.',
    },
    {
      name: 'TrackingEvent',
      description: 'An immutable, append-only record of a shipment or vehicle location/status change (GPS ping, dock scan, hub arrival/departure, delay flag) - the source of truth for the live tracking timeline.',
    },
  ],

  requirements: {
    core: [
      'Shippers create a shipment with origin, destination, weight/volume, and a delivery time window, and the system computes a multi-hop route through the hub network.',
      'Each leg of the route is assigned to a specific carrier vehicle with sufficient remaining capacity, respecting that vehicle\'s existing schedule and service area.',
      'The system ingests continuous GPS location pings from vehicles and exposes a live tracking status and timeline for every in-transit shipment.',
      'The system predicts and continuously refreshes a delivery ETA, detects when a leg is running materially late, and automatically re-routes or re-assigns the affected shipment.',
    ],
    belowTheLine: [
      'Automated carrier freight quoting and spot-market bidding',
      'Multi-modal transport legs (rail, ocean, air) beyond over-the-road trucking',
      'Cross-border customs and compliance documentation',
      'Driver hours-of-service (HOS) compliance scheduling',
      'Dynamic lane pricing based on real-time supply/demand',
    ],
    nonFunctionalTable: [
      { metric: 'Route computation latency', target: 'Under a few seconds for a single shipment spanning up to ~5 hops; full nightly network-wide re-optimization completes within its overnight batch window' },
      { metric: 'GPS ping-to-tracking-page latency', target: '10-15 seconds end-to-end from vehicle ping to an updated location on the shipper-facing tracker' },
      { metric: 'Consistency model', target: 'Shipment status, capacity ledger, and carrier assignment strongly consistent; live location and ETA eventually consistent' },
      { metric: 'Durability / chain of custody', target: 'Every status transition and tracking event durably logged and immutable, for billing disputes and compliance audits' },
      { metric: 'Availability', target: 'Shipment creation and tracking reads stay available during a partial optimization-service outage; route computation degrades to a cached/simple fallback rather than blocking intake' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Shipment / Capacity DB',
      purpose: 'Shipment records, route/leg state machine, and the per-vehicle capacity ledger',
      primaryPick: 'Postgres',
      alternatives: 'CockroachDB, MySQL, Spanner',
      whyPrimaryWins: 'ACID transactions guarantee capacity is decremented exactly once per assignment - never double-booking a truck',
    },
    {
      tier: 'Tracking Event Store',
      purpose: 'Append-only GPS pings, dock scans, and status events at high write volume',
      primaryPick: 'Cassandra',
      alternatives: 'DynamoDB, TimescaleDB, InfluxDB',
      whyPrimaryWins: 'Time-ordered, partitioned by shipment/vehicle ID, and built for very high write throughput with no update-in-place cost',
    },
    {
      tier: 'Geospatial Routing Engine',
      purpose: 'Road-network shortest/fastest path and live-traffic-aware travel time per leg',
      primaryPick: 'OSRM / commercial routing API',
      alternatives: 'GraphHopper, Valhalla, Google Maps Routing API',
      whyPrimaryWins: 'Pre-built, continuously updated road graph with turn restrictions and traffic weighting - reimplementing this in-house is not worth it',
    },
    {
      tier: 'Route Optimization Service',
      purpose: 'Multi-stop, capacity- and time-window-aware Vehicle Routing Problem (VRP) solver',
      primaryPick: 'Google OR-Tools',
      alternatives: 'Gurobi / CPLEX (commercial solvers), jsprit',
      whyPrimaryWins: 'Open-source, purpose-built for VRP with capacity and time-window constraints, integrates directly with the routing engine\'s distance matrix',
    },
    {
      tier: 'Location Ingestion Pipeline',
      purpose: 'Real-time GPS ping ingestion at fleet scale, decoupled from downstream consumers',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar',
      whyPrimaryWins: 'Durable, ordered, partitioned-by-vehicle log that absorbs bursty ping traffic without back-pressuring the trucks sending it',
    },
    {
      tier: 'ETA / Notification Service',
      purpose: 'Incrementally recompute ETA per tracking event and fan out status/delay notifications',
      primaryPick: 'Kafka Streams consumer + webhook/WebSocket fan-out',
      alternatives: 'Flink, cron-based periodic batch recompute',
      whyPrimaryWins: 'Recomputes only the affected shipment\'s ETA on each relevant event instead of re-scanning every in-transit shipment on a timer',
    },
  ],
  technologyChoicesNote:
    "Why does full route optimization run as a periodic/triggered batch job instead of recomputing on every GPS ping? The VRP is NP-hard - solving it for a network-wide batch of shipments and vehicles takes seconds to minutes, not milliseconds, and running it on every one of thousands of pings per second would either fall permanently behind or thrash driver assignments as the solver's output flickers between near-equally-good routes. Instead, the optimizer runs on a cadence (e.g., nightly for network-wide planning, plus event-triggered for a single delayed shipment) and location pings only feed into a much cheaper incremental process: checking whether a leg has drifted enough from plan to warrant kicking off a fresh, narrowly-scoped optimization run.",

  scaleEstimation: [
    'Shipments: ~200K new shipments/day across a national network (~2-3/sec average, bursty around business-day open/close) - each spanning 1-3 hub legs on average',
    'GPS ping ingestion: ~150K active vehicles pinging every 30 seconds -> ~5,000 pings/sec sustained, ~7-8K/sec at peak driving hours',
    'Tracking event storage: ~5,000 pings/sec x 86,400s ≈ 430M events/day; retained hot for ~90 days for live tracking/dispute resolution, then archived to cold storage',
    'Route optimization: a full network-wide re-optimization runs nightly per region (dozens of regions, each a bounded VRP instance); incremental single-shipment re-routes triggered by delay detection run tens of thousands of times/day',
    'Hub network: several hundred cross-dock hubs nationally, each with a bounded number of dock doors and a fixed daily consolidation/departure schedule',
    'Carrier fleet: tens of thousands of contracted vehicles across hundreds of carrier companies, each vehicle carrying its own live capacity ledger',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/shipments',
      description: 'Create a new shipment with origin, destination, weight/volume, and delivery time window; triggers route computation.',
      example: '// Request\n{ "origin": {"lat":41.85,"lng":-87.65}, "destination": {"lat":33.75,"lng":-84.39}, "weightKg": 4200, "volumeM3": 18, "deliverBy": "2026-09-02T17:00:00Z" }\n\n// Response 201\n{ "shipmentId": "shp_88213", "status": "ROUTED", "legs": 2 }',
    },
    {
      method: 'GET',
      path: '/v1/shipments/{shipmentId}/tracking',
      description: 'Return the current status, active leg, last known location, and live ETA for a shipment.',
      example: '// Response 200\n{ "status": "IN_TRANSIT", "currentLeg": "l_2", "location": {"lat":36.16,"lng":-86.78}, "etaMinutes": 210 }',
    },
    {
      method: 'POST',
      path: '/v1/shipments/{shipmentId}/legs/{legId}/assign',
      description: 'Assign a specific route leg to a carrier vehicle with sufficient remaining capacity.',
      example: '// Request\n{ "carrierId": "c_501", "vehicleId": "v_9042" }\n\n// Response 200\n{ "legId": "l_2", "status": "ASSIGNED", "vehicleId": "v_9042" }',
    },
    {
      method: 'POST',
      path: '/v1/vehicles/{vehicleId}/location',
      description: 'Ingest a GPS location ping from a vehicle (called by the telematics device/driver app every ~30s).',
      example: '// Request\n{ "lat": 36.16, "lng": -86.78, "speedKph": 104, "timestamp": "2026-08-28T14:02:11Z" }\n\n// Response 202\n{ "accepted": true }',
    },
    {
      method: 'POST',
      path: '/v1/shipments/{shipmentId}/reroute',
      description: 'Trigger a re-optimization of the remaining route, either automatically (delay detected) or manually (dispatcher override).',
      example: '// Request\n{ "reason": "leg_delayed", "delayMinutes": 95 }\n\n// Response 200\n{ "shipmentId": "shp_88213", "status": "ROUTED", "newEtaMinutes": 260 }',
    },
    {
      method: 'GET',
      path: '/v1/hubs/{hubId}/dock-schedule',
      description: 'Return the cross-dock schedule for a hub - inbound arrivals, outbound departures, and dock door assignments for a given day.',
      example: '// Response 200\n{ "hubId": "hub_14", "date": "2026-08-28", "docks": [{ "door": 3, "inbound": "l_2", "window": "13:30-14:00" }] }',
    },
  ],
  apiSecurityNote:
    'Vehicle location pings are authenticated per-device with a telematics-unit credential scoped to that specific vehicle, so a compromised device can only misreport its own truck\'s position, never spoof another vehicle\'s leg. Carrier and dispatcher actions (assign, reroute) are authorized against the caller\'s carrier/company ID from the JWT, never a client-supplied field - a carrier can only see and act on legs it has been assigned. Capacity-affecting writes (assign, reroute) go through the same idempotency-key discipline as payment systems, since a retried assignment call must never double-commit a vehicle\'s capacity.',

  highLevelDesignIntro:
    "Eight incremental passes: start with a single-hop shipment and manual assignment to establish the state machine, add multi-hop hub routing, make assignment capacity-aware, wire up real-time GPS ingestion, layer in ETA prediction, handle mid-route delays with automatic re-routing, add hub-side cross-dock scheduling, and finish with customer-facing tracking and notifications.",

  builds: [
    {
      title: 'Shipment Intake and a Direct Point-to-Point Baseline',
      body:
        "Before tackling multi-hop routing, get the fundamentals right for the simplest possible case: a shipment that goes directly from origin to destination on one truck. This establishes the durable state machine and the capacity ledger that every later build depends on.\n\nA shipment is created with origin, destination, weight/volume, and a delivery time window, and persisted with status CREATED before anything else happens - the same 'write intent before calling out' discipline used in payment and dispatch systems, so a crash immediately after intake still leaves a durable, reconcilable record instead of a lost shipment.",
      newComponents: [
        { name: 'Shipment Service', description: 'Owns shipment creation and the shipment status state machine (CREATED -> ROUTED -> ASSIGNED -> IN_TRANSIT -> DELIVERED).' },
        { name: 'Postgres (shipments, legs, capacity ledger)', description: 'Durable source of truth for shipment/leg rows and each vehicle\'s committed capacity, updated inside ACID transactions.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Shipper]:::client
  gw[API Gateway]:::edge
  svc[Shipment Service]:::compute
  db[("Postgres<br/>shipments + capacity ledger")]:::database

  client -->|"1. POST /shipments"| gw --> svc
  svc -->|"2. INSERT shipment CREATED"| db
  svc -->|"3. UPDATE status ROUTED"| db`,
      },
      closingNote:
        'A direct point-to-point shipment is the degenerate case of a route with exactly one leg. Every entity introduced here - Shipment, Leg, capacity ledger - carries forward unchanged once routes grow multiple hops; only the route-computation step gets more interesting from here.',
    },
    {
      title: 'Multi-Hop Routing Through the Hub Network',
      body:
        "Most freight does not travel directly - it is cheaper and more capacity-efficient to consolidate many shipments headed the same general direction through a shared hub, then split them back out onto local routes near the destination. A route is now an ordered sequence of legs: origin -> Hub A -> Hub B -> destination, each with its own planned arrival/departure window.\n\nExample: a shipment from Chicago to Atlanta doesn't need a dedicated truck driving 700 miles half-empty. Instead it rides a Chicago-to-Nashville trunk leg consolidated with dozens of other shipments, gets cross-docked at the Nashville hub onto a Nashville-to-Atlanta leg, and arrives via a route that's cheaper per shipment even though it involves an extra handoff.",
      insightCallout:
        "The routing engine computes travel time/distance between candidate hub pairs (a distance matrix), but which hubs to actually route through, and in what order, is a separate optimization decision layered on top - that's what Build 3's VRP solver formalizes once capacity enters the picture.",
      newComponents: [
        { name: 'Hub Directory', description: 'The set of cross-dock facilities and the trunk lanes connecting them, used as candidate waypoints for multi-hop routes.' },
        { name: 'Route Service', description: 'Given an origin, destination, and constraints, selects a sequence of hubs and materializes the shipment\'s Leg rows.' },
        { name: 'Geospatial Routing Engine', description: 'Computes road-network travel time/distance for each candidate origin-hub, hub-hub, and hub-destination pair.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  svc[Route Service]:::compute
  routing[Geospatial Routing Engine]:::compute
  hubs[("Hub Directory")]:::database
  db[("Postgres<br/>legs")]:::database

  svc -->|"1. Candidate hubs near origin/dest"| hubs
  svc -->|"2. Travel time per candidate pair"| routing
  svc -->|"3. Pick best hub sequence"| svc
  svc -->|"4. Insert legs: origin-HubA, HubA-HubB, HubB-dest"| db`,
      },
      closingNote:
        'Right now "best hub sequence" is just shortest total travel time - it doesn\'t yet know whether any vehicle actually has room for this freight, or whether the hub\'s dock can even receive it on time. That\'s what capacity-aware assignment adds next.',
    },
    {
      title: 'Capacity-Aware Carrier and Vehicle Assignment',
      body:
        "A route is only useful once every leg has a specific vehicle with enough remaining weight/volume capacity to actually carry it, without violating that vehicle's existing schedule or its carrier's service area. This turns assignment into a bin-packing problem layered on top of the routing decision - the two are solved together as a Vehicle Routing Problem (VRP), not sequentially, because the cheapest route is worthless if no vehicle can service it on time.\n\nExample: a 4,200kg shipment needs a leg from Chicago to the Nashville hub. Three carrier vehicles service that lane; Vehicle A already has 8,500kg committed against a 10,000kg limit (only 1,500kg free - not enough), Vehicle B has 6,000kg free but its schedule has it departing two hours after this shipment's window closes, and Vehicle C has 5,000kg free and an open departure slot - Vehicle C gets the assignment, and its capacity ledger is decremented by 4,200kg inside the same transaction that marks the leg ASSIGNED.",
      insightCallout:
        "Capacity is a ledger, not a cache. The decrement UPDATE vehicles SET committed_kg = committed_kg + :kg WHERE vehicle_id = :id AND committed_kg + :kg <= capacity_kg happens inside the same transaction as the leg assignment - if two shipments race for the last slot on a vehicle, the database's row-level locking (not application logic) is what guarantees only one of them wins.",
      newComponents: [
        { name: 'Route Optimization Service (VRP solver)', description: 'Given ready shipments, available vehicles, and constraints, jointly picks a hub sequence and a vehicle for each leg that respects capacity and time windows.' },
        { name: 'Vehicle Capacity Ledger', description: 'A per-vehicle running total of committed weight/volume, decremented atomically at assignment time and released if a leg is cancelled or reassigned.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  svc[Route Optimization Service]:::compute
  ledger[("Capacity Ledger<br/>Postgres")]:::database
  vA["Vehicle A<br/>1,500kg free"]:::client
  vB["Vehicle B<br/>schedule conflict"]:::client
  vC["Vehicle C<br/>5,000kg free, open slot"]:::client

  svc -->|"1. Query candidates for lane"| ledger
  ledger -->|"2. Return capacity + schedule"| svc
  svc -.->|"3. Rejected: too full"| vA
  svc -.->|"4. Rejected: schedule conflict"| vB
  svc -->|"5. Assign leg, decrement capacity"| vC
  svc -->|"6. Commit inside one transaction"| ledger`,
      },
      closingNote:
        'This makes assignment correct at the moment it happens. But a shipment is committed for hours or days after assignment, and the real world does not hold still - vehicles break down, hubs run late, traffic happens. The rest of the design is about staying correct as time passes.',
    },
    {
      title: 'Real-Time GPS Tracking Ingestion Pipeline',
      body:
        "Every vehicle's telematics unit streams a GPS ping every ~30 seconds. At fleet scale (thousands of pings per second) this cannot write synchronously into the same Postgres instance holding shipment and capacity state - location is a firehose of high-volume, loosely-structured events, while shipment state is low-volume and must stay perfectly consistent. The fix is the same split food-delivery and ride-sharing platforms use: route location through Kafka into a purpose-built time-series store, entirely decoupled from the transactional path.\n\nA ping also does more than record a dot on a map: crossing into a hub's geofence (a virtual boundary around the facility) is what actually triggers the leg's ARRIVED status - nobody has to manually scan the truck in for the system to know it reached the hub.",
      insightCallout:
        "Geofencing turns 'is this truck at the hub yet' from a manual check into an automatic one: when a ping's coordinates fall inside a hub's registered radius, Location Ingestion emits a leg.arrived event without any human action, the same pattern used for automatic hub-arrival and delivery-completion detection industry-wide.",
      newComponents: [
        { name: 'Location Ingestion Service', description: 'Receives GPS pings, checks them against registered hub geofences, and publishes both the raw ping and any triggered arrival/departure events to Kafka.' },
        { name: 'Kafka (vehicle location stream)', description: 'A partitioned-by-vehicle-ID durable log absorbing bursty ping traffic, decoupling the ingestion write path from every downstream consumer.' },
        { name: 'Tracking Event Store (Cassandra)', description: 'An append-only, time-ordered store of every ping and status event, partitioned by shipment/vehicle for fast timeline reads.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  vehicle[Vehicle Telematics]:::client
  ingest[Location Ingestion]:::compute
  geofence["Hub Geofence Check"]:::compute
  k[["Kafka: vehicle.location"]]:::async
  store[("Tracking Event Store<br/>Cassandra")]:::database
  shipsvc[Shipment Service]:::compute

  vehicle -->|"1. GPS ping every 30s"| ingest
  ingest -->|"2. Check hub boundaries"| geofence
  geofence -.->|"3. leg.arrived (if inside)"| k
  ingest -->|"4. Publish raw ping"| k
  k -->|"5. Consume"| store
  k -->|"6. Consume arrival events"| shipsvc`,
      },
      closingNote:
        'Location is now flowing continuously and hub arrivals are detected automatically - but a raw stream of coordinates is not yet an answer to "when will this arrive." That requires turning ticks into a live ETA.',
    },
    {
      title: 'ETA Prediction and Continuous Refresh',
      body:
        "A useful ETA has to account for three independently uncertain things: remaining travel time on the current leg (live traffic, not a flat average speed), the hub's own dwell/cross-dock time (how long freight typically sits before its next leg departs), and any legs still ahead in the route. Recomputing this from scratch on every single GPS ping would be wasteful; instead, the ETA service listens to the same tracking-event stream and only recomputes when something material happens - a new ping updates the current leg's remaining-distance estimate, while a leg.arrived event replaces a modeled hub-transfer time with the observed one and rolls the estimate forward.\n\nExample: a shipment's original ETA assumed a 45-minute Nashville hub dwell time based on that hub's historical average. The truck actually arrives 20 minutes early and a leg.departed event fires 30 minutes later than the historical average would have predicted - the ETA service immediately re-forecasts only the remaining leg using the observed departure time, rather than waiting for the next scheduled recompute.",
      newComponents: [
        { name: 'ETA Service', description: 'A stream-processing consumer that maintains a live ETA per shipment, updating it incrementally as tracking events and hub milestones land.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  k[["Kafka: tracking events"]]:::async
  eta[ETA Service]:::compute
  cache[("ETA Cache<br/>Redis")]:::cache
  api[Tracking API]:::edge
  client[Shipper]:::client

  k -->|"1. ping / leg.arrived / leg.departed"| eta
  eta -->|"2. Recompute remaining legs"| eta
  eta -->|"3. Write current ETA"| cache
  client -->|"4. GET tracking"| api -->|"5. Read"| cache`,
      },
      closingNote:
        "ETA answers 'when will it arrive if nothing changes.' The harder, more valuable question is what to do the moment something clearly has changed - a truck sitting still on the highway for two hours is not a normal traffic delay, it's an exception.",
    },
    {
      title: 'Detecting and Handling Mid-Route Delays with Automatic Re-Routing',
      body:
        "A leg is flagged as delayed when its live ETA drifts past its planned arrival by more than a threshold (e.g., 60+ minutes), or when GPS pings stop arriving for an unusually long window (possible breakdown or connectivity loss). Detecting a delay is only half the problem - deciding what to do about it is the harder half, because a re-route has to consider whether it's still even possible to hit the customer's delivery window, and if not, whether an alternate carrier can absorb the remaining legs.\n\nExample: a Nashville-to-Atlanta leg that should take 4 hours is still moving after 6, with a 95-minute delay now baked into the ETA. This crosses the delay threshold, and the system automatically triggers a re-route for the remaining portion of the shipment's journey: the Route Optimization Service re-solves just the unfinished suffix of the route (not the already-completed Chicago-to-Nashville leg), checking whether a different vehicle already at the Nashville hub can pick up the freight and still make the window, or whether the delivery window itself needs to be renegotiated with the customer.",
      insightCallout:
        "Re-optimization only ever re-solves the remaining, not-yet-departed suffix of a route - the completed legs are historical fact and never get rewritten. This keeps each re-route computation small (a handful of remaining legs, not the whole original route) and keeps the tracking history immutable for billing and audit purposes.",
      newComponents: [
        { name: 'Delay Detector', description: 'A stream-processing rule evaluating each ETA update against the leg\'s planned window, emitting a leg.delayed event past a configurable threshold.' },
        { name: 'Exception Handling Workflow', description: 'Orchestrates the delayed-shipment response: attempt automatic re-route first, escalate to a human dispatcher only if no feasible alternative exists.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  eta[ETA Service]:::compute
  detector[Delay Detector]:::compute
  k[["Kafka: leg.delayed"]]:::async
  workflow[Exception Handling Workflow]:::compute
  vrp[Route Optimization Service]:::compute
  dispatcher["Human Dispatcher<br/>escalation only"]:::client

  eta -->|"1. ETA drifts past threshold"| detector
  detector -->|"2. Publish leg.delayed"| k --> workflow
  workflow -->|"3. Re-solve remaining suffix"| vrp
  vrp -.->|"4. No feasible alternative"| dispatcher
  vrp -->|"5. New route + vehicle assignment"| workflow`,
      },
      closingNote:
        'Delay handling closes the loop on shipments already moving through the network. The next gap is upstream of that: a hub can only cross-dock as fast as its physical dock doors allow, and that constraint needs its own scheduling layer.',
    },
    {
      title: 'Warehouse Cross-Dock Scheduling',
      body:
        "A hub has a finite number of physical dock doors, and every inbound trailer needs one long enough to unload, sort freight onto outbound trailers, and depart. Without explicit scheduling, ten trucks converging on a six-door hub at the same hour just queue in the yard, and every downstream leg planned around an on-time hub transfer slips.\n\nExample: Hub 14 has 8 dock doors. The nightly optimization run knows, for every hub in the network, roughly how many inbound legs are scheduled to arrive in each hour window - it assigns each inbound leg a specific door and a bounded dwell window (e.g., 30-45 minutes) before the connecting outbound leg must depart, and staggers arrivals so no more legs are scheduled to arrive in an hour than there are doors to receive them.",
      newComponents: [
        { name: 'Dock Scheduling Service', description: "Assigns each inbound leg a specific dock door and time window at its destination hub, staggering arrivals to fit the hub's physical door count." },
        { name: 'Hub Capacity Ledger', description: 'Tracks door occupancy per hub per time window, the facility-level analogue of the vehicle capacity ledger.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  vrp[Route Optimization Service]:::compute
  dock[Dock Scheduling Service]:::compute
  ledger[("Hub Capacity Ledger")]:::database
  hub["Hub 14<br/>8 dock doors"]:::storage

  vrp -->|"1. Legs arriving at Hub 14"| dock
  dock -->|"2. Check door availability per window"| ledger
  dock -->|"3. Assign door + dwell window"| ledger
  dock -->|"4. Publish schedule"| hub`,
      },
      closingNote:
        'With dock scheduling in place, every leg in the network - trunk hauls between hubs and final-mile deliveries alike - has a fully planned path from origin to destination. The last piece is making all of this visible to the people actually waiting on the freight.',
    },
    {
      title: 'Customer-Facing Tracking and Notifications',
      body:
        "Shippers and receivers want two things: a live tracking page they can check anytime, and a push (webhook, email, SMS) the moment something meaningful changes - departed a hub, delayed, out for delivery, delivered. This is deliberately the last, thinnest layer: it reads from state everything else already produces, so it can be entirely best-effort without risking the correctness of the shipment and capacity state underneath it.",
      insightCallout:
        "The same 'never let the eventually-consistent layer touch the strongly-consistent one' rule from the food-delivery and ride-sharing designs applies here: the notification path only ever consumes tracking events and shipment-status transitions, it never writes back to the shipment or capacity ledger, so a notification-fan-out outage degrades to 'no push, tracking page still works' rather than corrupting anything.",
      newComponents: [
        { name: 'Notification/Fan-out Service', description: 'Consumes shipment status and tracking events, and pushes updates to whichever channel (webhook, email, SMS, WebSocket) the shipper subscribed to.' },
        { name: 'Tracking API', description: 'A read-only, cache-backed endpoint serving the current status/location/ETA for the shipper-facing tracking page.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  k[["Kafka: status + tracking events"]]:::async
  notify[Notification/Fan-out]:::compute
  webhook[Shipper Webhook]:::client
  api[Tracking API]:::edge
  cache[("ETA + Status Cache")]:::cache
  shipper[Shipper Portal]:::client

  k -->|"1. Consume"| notify -->|"2. Push on meaningful change"| webhook
  k -->|"3. Consume"| cache
  shipper -->|"4. GET tracking"| api -->|"5. Read"| cache`,
      },
      closingNote:
        "This closes the loop from a shipper filling out an origin/destination form to watching their freight cross the country in near real time, with automatic re-routing keeping the promise intact even when something along the way goes wrong.",
    },
  ],

  coreFlows: [
    {
      title: 'Shipment Creation and Carrier Assignment',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant S as Shipper
  participant SS as Shipment Service
  participant DB as Postgres
  participant RO as Route Optimization Service
  participant GE as Geospatial Routing Engine
  participant CL as Capacity Ledger

  S->>SS: POST /shipments (origin, dest, weight, window)
  SS->>DB: INSERT shipment CREATED
  SS->>RO: compute route
  RO->>GE: candidate hub travel times
  GE-->>RO: distance/time matrix
  RO->>CL: query vehicle capacity + schedules per lane
  CL-->>RO: candidate vehicles per leg
  RO->>RO: solve VRP (route + assignment jointly)
  RO->>DB: INSERT legs, UPDATE capacity ledger (txn)
  DB-->>RO: committed
  SS->>DB: UPDATE shipment status ROUTED
  SS-->>S: 201 shipmentId, legs`,
      },
      nonObviousFailure:
        "If the process crashes after inserting the shipment as CREATED but before the route/assignment transaction commits, the shipment sits in CREATED indefinitely with no committed capacity anywhere. A reconciler sweeps CREATED shipments older than a few minutes and either resumes route computation or marks the shipment ROUTING_FAILED for manual intervention - never leaves it silently stuck.",
    },
    {
      title: 'Real-Time GPS Tracking Update',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant V as Vehicle Telematics
  participant LI as Location Ingestion
  participant HG as Hub Geofence Check
  participant K as Kafka
  participant TS as Tracking Event Store
  participant ETA as ETA Service
  participant API as Tracking API
  participant SH as Shipper

  loop every 30s
    V->>LI: GPS ping (lat, lng, speed, ts)
  end
  LI->>HG: check against registered hub boundaries
  alt inside a hub geofence
    HG-->>LI: leg.arrived
    LI->>K: publish leg.arrived
  end
  LI->>K: publish raw ping
  K->>TS: consume, append event
  K->>ETA: consume, recompute remaining ETA
  ETA->>ETA: write updated ETA to cache
  SH->>API: GET /shipments/{id}/tracking
  API-->>SH: status, location, ETA`,
      },
      nonObviousFailure:
        "A vehicle loses connectivity in a dead zone for 20+ minutes - the tracking page must not silently freeze without explanation or, worse, imply the truck stopped moving. Location Ingestion tracks time-since-last-ping per vehicle and, past a threshold, the Tracking API returns the last known location with an explicit staleness flag rather than presenting it as current, and the Delay Detector treats a prolonged ping gap itself as a signal worth investigating, distinct from a leg that is simply running late.",
    },
  ],

  deepDives: [
    {
      title: 'Multi-Hop Route Optimization Across Hubs',
      problem:
        "Choosing which hubs a shipment routes through, and which vehicle carries each resulting leg, cannot be solved as two separate steps (pick hubs by shortest path, then find any truck with room) without producing routes that are cheap on paper but infeasible in practice.",
      simpleTerms:
        "It's not enough to find the shortest path on a map - you also need a truck with actual room on it, at the right time, at every step of that path. Solving the map problem and the truck problem separately produces routes that look great until you discover no truck can actually run them.",
      bad:
        'Compute the shortest-time hub sequence purely from the geospatial routing engine\'s distance matrix, ignoring capacity entirely, then separately try to find any vehicle with room for each leg afterward. This regularly produces a "cheapest" route through a hub pair with strong road connectivity but zero vehicles with spare capacity in that lane during the required window - forcing a costly re-route after the fact, or worse, an overbooked truck if the capacity check is skipped under time pressure.',
      good:
        'Check capacity greedily as part of route selection: for each candidate hub sequence in ranked shortest-time order, check whether a vehicle with sufficient capacity exists for every leg, and take the first sequence that fully clears. This avoids the outright infeasible-route problem, but greedy first-fit can still pick a globally worse assignment - e.g., it commits the single vehicle capable of serving a rare, hard-to-cover lane to an easy shipment, leaving nothing free when a harder shipment needs that same lane an hour later.',
      great:
        "Solve routing and assignment jointly as a single capacity- and time-window-constrained Vehicle Routing Problem (VRP), using the routing engine's distance matrix as an input rather than a final answer. The solver (Google OR-Tools) considers a batch of ready shipments and available vehicles together, so it can trade off a slightly longer route for one shipment against freeing up scarce capacity for a shipment that has fewer feasible alternatives. Because an exact VRP solve is NP-hard, in production this runs as a bounded-time heuristic (e.g., a few seconds of local search from a greedy initial solution) rather than searching for a provably optimal answer - a good-enough route computed in 3 seconds beats an optimal one computed in 3 hours. Full network-wide re-optimization runs nightly across all planned-but-not-yet-departed legs; a single delayed shipment triggers a narrowly-scoped re-solve of just its own remaining suffix rather than the whole network.",
      diagram: {
        mermaid: `flowchart TD
  shipments["Batch of ready shipments"]:::client
  vehicles["Available vehicles + capacity"]:::client
  matrix["Distance/time matrix"]:::compute
  vrp["VRP Solver<br/>joint route + assignment"]:::compute
  routes["Feasible routes,<br/>capacity committed"]:::database

  shipments --> vrp
  vehicles --> vrp
  matrix --> vrp
  vrp -->|"bounded-time heuristic search"| routes`,
      },
    },
    {
      title: 'Handling Mid-Route Delays and Re-routing',
      problem:
        "A shipment already assigned and moving can drift off schedule for reasons the original plan had no way to anticipate - a breakdown, a multi-hour traffic jam, a hub backed up at the dock - and the system needs to notice and react before the customer does.",
      simpleTerms:
        "It's not enough to plan a good route once and walk away - trucks break down, traffic happens, docks get backed up. The system has to keep watching the plan against reality and course-correct the moment they diverge too far.",
      bad:
        'No automated delay detection at all - a shipment is presumed on-time unless a customer calls to ask where it is, or a driver happens to mention a problem to a dispatcher. By the time anyone notices, the delivery window has often already passed, and any re-route decision is reactive rather than proactive.',
      good:
        'A fixed threshold check: if a leg\'s planned arrival time passes without a corresponding leg.arrived event, flag it as delayed and alert a human dispatcher to manually decide next steps. This catches delays automatically, which is a real improvement, but every delayed shipment still requires a person to look at it, decide whether re-routing is even possible, and manually rebook a vehicle - which does not scale past a small number of simultaneous delays (a regional storm disrupting dozens of routes at once would overwhelm any dispatch team).',
      great:
        "A live, continuously-recomputed ETA (not just a static planned-arrival check) crossing a threshold automatically triggers a bounded re-optimization of the shipment's remaining route suffix, attempting a fully automated fix first and escalating to a human dispatcher only when no feasible alternative exists (e.g., every vehicle in the lane is also committed, or the delivery window is now physically impossible to hit no matter the route). The re-solve only touches not-yet-departed legs - completed legs are immutable history - which keeps each re-optimization small and fast even during a network-wide disruption event, since only the subset of shipments actually affected gets re-solved rather than the whole network. Ping gaps (no GPS signal for an unusually long window) are treated as their own distinct delay signal, separate from 'running behind schedule,' since a silent vehicle could mean a breakdown rather than ordinary traffic and may warrant a different response (a call to the driver) before or alongside any re-route.",
      diagram: {
        mermaid: `flowchart TD
  eta["Live ETA drifts past threshold"]:::client
  auto["Automatic re-solve<br/>remaining suffix only"]:::compute
  found{"Feasible alternative found?"}:::compute
  commit["Commit new route + assignment"]:::database
  escalate["Escalate to human dispatcher"]:::client

  eta --> auto --> found
  found -->|"yes"| commit
  found -->|"no"| escalate`,
      },
    },
  ],

  selfAudit: [
    {
      question: 'Two shipments race to claim the last available capacity slot on the same vehicle - what stops both from succeeding?',
      answer:
        'The capacity decrement is a conditional UPDATE inside the same database transaction as the leg assignment (committed_kg + :kg <= capacity_kg), so the database\'s row-level locking - not application logic - guarantees only one of the two concurrent assignments actually commits; the loser retries against the next candidate vehicle.',
    },
    {
      question: 'Why is location tracking eventually consistent while shipment/capacity state is strongly consistent?',
      answer:
        'A stale GPS dot costs nothing but a slightly outdated map position; a stale capacity read could double-book a truck\'s physical space. Location flows through Kafka into an eventually-consistent tracking store precisely because it tolerates a few seconds of lag, while capacity and assignment stay in Postgres transactions that never do.',
    },
    {
      question: 'Why does full route optimization run as a batch job instead of recomputing on every GPS ping?',
      answer:
        "The VRP is NP-hard - solving it network-wide takes seconds to minutes. Running it on every ping (thousands per second) would either fall permanently behind or thrash assignments as the solver's near-equally-good outputs flicker. Instead, pings only feed a cheap incremental delay check; full re-optimization runs on a fixed cadence or a narrowly-scoped trigger.",
    },
    {
      question: 'A shipment is delayed mid-route - does re-optimization touch legs that already happened?',
      answer:
        'No. Re-optimization only ever re-solves the not-yet-departed suffix of the route; completed legs are immutable historical fact, both to keep each re-solve fast and to preserve an accurate audit trail for billing and disputes.',
    },
    {
      question: "A vehicle's GPS goes silent for 45 minutes - how does the system distinguish a dead zone from a breakdown?",
      answer:
        'Location Ingestion tracks time-since-last-ping per vehicle independently of the delay-vs-schedule check. Past a threshold, a ping gap is surfaced as its own distinct signal (possible connectivity loss or breakdown) rather than being silently folded into a generic "running late" status, since the appropriate response - a driver phone call versus a route re-solve - differs.',
    },
    {
      question: 'How does hub dock scheduling prevent trucks from just queuing in the yard?',
      answer:
        "The Dock Scheduling Service assigns each inbound leg a specific door and dwell window before the optimizer even finalizes the route, staggering arrivals so no more legs are scheduled to arrive in a given hour than the hub has doors to receive them - the hub-level analogue of the vehicle capacity ledger.",
    },
    {
      question: 'What happens to customer-facing tracking if the notification/fan-out service goes down?',
      answer:
        "Tracking degrades gracefully, not catastrophically: the Tracking API reads directly from the ETA/status cache independent of the notification path, so the tracking page keeps working even if push notifications stop - the fan-out service only ever consumes events, it never writes back to shipment or capacity state, so its outage cannot corrupt anything underneath it.",
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  shipper[Shipper Portal]:::client
  vehicle[Vehicle Telematics]:::client
  gw[API Gateway]:::edge

  subgraph "Shipment & Capacity"
    ss[Shipment Service]:::compute
    db[("Postgres<br/>shipments, legs, capacity ledger")]:::database
  end

  subgraph "Route Optimization"
    ro[Route Optimization Service<br/>VRP solver]:::compute
    ge[Geospatial Routing Engine]:::compute
    dock[Dock Scheduling Service]:::compute
  end

  subgraph "Tracking Pipeline"
    li[Location Ingestion]:::compute
    k[["Kafka: location + status events"]]:::async
    ts[("Tracking Event Store<br/>Cassandra")]:::database
    detector[Delay Detector]:::compute
  end

  subgraph "ETA & Notifications"
    eta[ETA Service]:::compute
    cache[("ETA + Status Cache<br/>Redis")]:::cache
    notify[Notification/Fan-out]:::compute
    api[Tracking API]:::edge
  end

  workflow[Exception Handling Workflow]:::compute

  shipper -->|"create shipment"| gw --> ss --> db
  ss -->|"compute route"| ro
  ro --> ge
  ro -->|"assign + decrement capacity (txn)"| db
  ro -->|"schedule dock door"| dock
  vehicle -->|"GPS ping every 30s"| li
  li -->|"geofence check"| li
  li --> k
  k --> ts
  k --> eta --> cache
  k --> detector -->|"leg.delayed"| workflow
  workflow -->|"re-solve remaining suffix"| ro
  k --> notify
  shipper -->|"GET tracking"| api --> cache
  notify -->|"webhook / push"| shipper`,
  },

  keyTechnologies: [
    { term: 'Vehicle Routing Problem (VRP)', definition: 'An NP-hard optimization problem: given vehicles with capacity constraints and stops with time windows, find the set of routes that services every stop at minimum cost. The core algorithm behind capacity-aware freight route assignment.' },
    { term: 'Geofencing', definition: 'A virtual boundary drawn around a physical location (a hub); a GPS ping falling inside it automatically triggers an arrival/departure event without any manual scan or check-in.' },
    { term: 'Cross-Docking', definition: 'Transferring freight directly from an inbound trailer to an outbound trailer at a hub with minimal storage time, consolidating shipments headed the same direction onto shared trunk legs.' },
    { term: 'GPS Ping', definition: "A periodic location report (latitude, longitude, speed, timestamp) sent from a vehicle's telematics unit, the raw input to both live tracking and delay detection." },
    { term: 'ETA Prediction Model', definition: 'A live-updating estimate of arrival time that blends road-network travel time, historical hub dwell times, and real observed milestones as they land, replacing modeled estimates with actuals incrementally.' },
    { term: 'Capacity Ledger', definition: "A running total of a vehicle's (or hub's) committed weight/volume/door-time, decremented atomically at assignment time inside a database transaction so it can never be oversold." },
  ],

  expectedDepth: {
    mid:
      'Recognizes that a shipment can span multiple hops through hubs rather than a single direct trip, and proposes checking vehicle capacity before assigning a leg. Understands that GPS location should stream in separately from the transactional shipment/order data rather than blocking it.',
    senior:
      'Designs multi-hop routing as an explicit sequence of legs with capacity checked as part of assignment (not after), and explains why route/assignment optimization is solved jointly (VRP) rather than as two independent steps. Separates the strongly-consistent shipment/capacity state from the eventually-consistent GPS tracking pipeline, and proposes geofencing for automatic hub-arrival detection and threshold-based delay detection.',
    staffPlus:
      "Reasons about why full VRP optimization runs as a bounded-time heuristic batch job rather than real-time recomputation, and why a delayed shipment re-solves only its remaining route suffix instead of the whole network. Addresses hub-level dock-door scheduling as its own capacity-ledger problem distinct from vehicle capacity, distinguishes a GPS ping gap (possible breakdown) from an ETA-threshold delay (running late) as separate signals requiring separate responses, and designs the notification/tracking layer so it can never corrupt shipment or capacity state even during a full outage.",
  },

  keyTakeaways: [
    "A multi-hop shipment is a sequence of Legs through Hubs, and routing/assignment must be solved jointly (a Vehicle Routing Problem) - picking the cheapest hub sequence first and checking capacity afterward produces routes no truck can actually run.",
    'Capacity is a ledger enforced by a database transaction, not an application-level check - a conditional UPDATE inside the same transaction as the assignment is what actually prevents overbooking a vehicle or a hub dock door.',
    'GPS tracking is a high-volume, eventually-consistent stream through Kafka into a time-series store, deliberately decoupled from the low-volume, strongly-consistent shipment/capacity state - a tracking outage should never risk double-booking a truck.',
    "Delay handling only ever re-optimizes the not-yet-departed suffix of a route, escalating to a human dispatcher only when no automated fix is feasible - this keeps re-optimization fast and keeps completed legs immutable for audit and billing.",
  ],

  relatedDesigns: ['ride-sharing', 'food-delivery', 'nearby-service'],
  relatedConcepts: [
    { name: 'Geospatial Indexing', description: 'Underpins both hub-network routing (distance matrices between candidate hubs) and geofence-based arrival detection.' },
    { name: 'Message Queues', description: 'Decouples high-volume GPS ping ingestion from the strongly-consistent shipment and capacity state via Kafka.' },
    { name: 'State Machines', description: 'Models the shipment/leg lifecycle explicitly so delay-triggered re-routes and out-of-order events cannot corrupt shipment status.' },
  ],
}

export default topic
