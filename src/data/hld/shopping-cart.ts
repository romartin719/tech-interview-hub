import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'shopping-cart',
  title: 'Shopping Cart & Checkout (Amazon / Flipkart)',
  difficulty: 'Intermediate',
  icon: 'pi pi-shopping-cart',
  color: '#eab308',
  readTimeMinutes: 25,
  topics: ['Inventory Reservation', 'Saga Pattern', 'Optimistic Locking', 'Idempotency Keys'],
  companies: ['Amazon', 'Flipkart', 'Shopify'],
  prerequisites: ['Caching', 'Saga Pattern', 'Distributed Locking'],
  summary:
    'A shopping cart and checkout system that keeps carts in Redis for speed with async persistence to a durable store, reserves inventory with a TTL-bound soft hold only at checkout (not at add-to-cart), and coordinates cart, inventory, payment, and order services through a saga with an idempotency key guarding every retry.',

  understandingProblem:
    "Every e-commerce site needs a place to hold items a customer intends to buy before they actually buy them - but that simple idea hides some of the hardest problems in distributed systems. The cart itself has to survive a page refresh, a switched device, and a customer who browses anonymously for twenty minutes before ever logging in. Checkout has to move money and inventory across services that don't share a database, and it has to do that correctly even when two customers are fighting over the last unit of a doorbuster deal, a network blip makes a client retry a request that already succeeded, or a price changes while an item sits untouched in someone's cart for three days. Get any of this wrong and you either oversell a product you don't have, double-charge a customer, or lose an order that was actually paid for - all of which are the kind of bugs that show up as a headline, not a stack trace.",
  realExamples:
    "Amazon's 2007 Dynamo paper used the shopping cart as its motivating example for an always-writable, eventually-consistent store - carts had to accept writes even during network partitions, with conflicting versions merged later. Baymard Institute's industry research consistently finds the average online cart abandonment rate sits around 70%, which is why abandonment recovery emails are a standard production feature, not an afterthought. Adobe Analytics reported over $9.8B in US online sales on Black Friday 2023 alone, almost entirely funneled through cart-and-checkout flows that cannot fall over for even a few minutes.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  Customer["Customer"]:::client
  API["Checkout API"]:::compute
  DB[("Single SQL DB<br/>cart, stock, and orders")]:::database

  Customer -->|"1. Add to cart"| API
  API -->|"2. Write cart row"| DB
  Customer -->|"3. Place order"| API
  API -->|"4. Decrement stock and insert order"| DB`,
    },
    whyThisBreaks: [
      "Overselling - two customers both see 1 unit in stock, both add it to their cart, both click 'Place Order' within the same second. A naive UPDATE stock SET qty = qty - 1 WHERE id = ? with no guard lets both succeed, and now you owe a physical unit to two people for one item.",
      "Cart storage on the hot write path - every add-to-cart and quantity change hits the same relational table that also holds live inventory and order rows, so a flash sale that spikes cart writes 50x also chokes the checkout path for everyone else.",
      "Guest carts vanish - a customer browses anonymously, adds three items, then logs in on a different tab to check a past order. Their anonymous cart and their account cart are two unrelated rows; whichever the UI happens to read wins, and items silently disappear.",
      'No distributed transaction - the moment inventory, payment, and orders live in separate services (which they do at any real scale), a single SQL transaction can no longer guarantee that a charge and an order either both happen or neither does.',
      "Double-click double-order - the customer's network stalls for two seconds on 'Place Order,' they click again, and with no retry protection the naive API happily creates two orders and charges two payments for one purchase.",
    ],
    closingNote:
      'Every one of these is a version of the same root cause: treating "add to cart" and "commit to buying" as the same operation, on the same data, with the same consistency guarantees. The rest of this design separates them cleanly - a cheap, fast, forgiving cart, and a slow, careful, unforgiving checkout.',
  },

  priorArt: [
    {
      title: 'Amazon Dynamo (2007)',
      description:
        "The original always-writable key-value store was designed specifically so the shopping cart service could accept a write even during a network partition, using vector clocks to merge concurrent edits from the same customer on different devices. (Amazon 'Dynamo: Amazon's Highly Available Key-value Store' paper)",
      link: 'https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store',
    },
    {
      title: 'Shopify Flash Sale / Drop Protection',
      description:
        'Shopify engineering has repeatedly written about protecting a single merchant\'s checkout during extreme demand spikes (sneaker and cosmetics drops) using request throttling and queueing in front of checkout so inventory and payment systems never see more concurrent attempts than they can safely process. (Shopify Engineering blog)',
      link: 'https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i',
    },
    {
      title: 'AWS Prescriptive Guidance - Saga Pattern for Order Processing',
      description:
        'Documents the canonical e-commerce saga: reserve inventory, charge payment, create order, each with a compensating action, coordinated by an orchestrator when the business logic and audit requirements are complex enough to need explicit control. (AWS Prescriptive Guidance)',
      link: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga.html',
    },
    {
      title: 'Stripe Idempotency Keys',
      description:
        'Popularized the client-generated Idempotency-Key header as the standard defense against double-charging on retried payment requests - now the default expectation for any checkout API. (Stripe Engineering blog)',
      link: 'https://stripe.com/blog/idempotency',
    },
    {
      title: 'Walmart Omnichannel Inventory',
      description:
        'Walmart has spoken publicly about reserving inventory with short-lived holds across its online and in-store pools so a customer completing checkout online is never told "in stock" for a unit a store associate just handed to someone else. (Walmart Global Tech blog)',
    },
  ],

  coreEntities: [
    { name: 'Cart', description: 'ownerId (guestId or userId), items[], currency, version, updatedAt. Lives hot in Redis, flushed to a durable store.' },
    { name: 'CartItem', description: 'sku, quantity, priceSnapshot (price at time of add), addedAt.' },
    { name: 'Product / SKU', description: 'Catalog entry with a live price and an availableStock count guarded by a version column.' },
    {
      name: 'Reservation',
      description: 'A TTL-bound soft hold: sku, quantity, cartId, expiresAt, status (HELD/CONFIRMED/RELEASED). Created only at checkout, not at add-to-cart.',
    },
    { name: 'Order', description: 'id, cartId, items[], priceCharged, status (PENDING/PAID/FAILED/CANCELLED), paymentRef.' },
    { name: 'Payment', description: 'id, orderId, amount, status, idempotencyKey, gatewayTransactionId.' },
  ],

  requirements: {
    core: [
      'Users can add, update the quantity of, and remove items from a cart; guest carts persist across a session and merge cleanly into the account cart on login.',
      'Checkout reserves inventory for every item, charges payment, and creates an order in a way that a customer is never charged without an order, and no order is ever created without payment.',
      'Prices are shown from an add-to-cart snapshot but re-validated against the live price at checkout, with the customer explicitly notified before being charged more than the snapshot.',
      'The last unit of a hot item is never sold to two different customers, even under flash-sale traffic where thousands of carts contain it simultaneously.',
      'Checkout requests are safe to retry - a double-click or a client-side timeout retry never produces two orders or two charges.',
    ],
    belowTheLine: [
      'Coupon/promotion stacking rules and tax calculation logic (assume a pricing service supplies one final authoritative price per item)',
      'Splitting a single order across multiple warehouses or third-party sellers',
      'Returns, refunds, and exchanges after an order has been delivered',
      'Personalized recommendations and "customers also bought" surfaces',
      'Subscriptions and recurring/auto-refill carts',
      'Multi-currency pricing and cross-border tax/duty calculation',
    ],
    nonFunctionalTable: [
      { metric: 'Correctness (no oversell)', target: 'Reserved + sold quantity for a SKU must never exceed physical available stock, even under concurrent checkouts' },
      { metric: 'Consistency', target: 'Strong consistency on inventory reservation and payment state; eventual consistency is fine for cart read replicas and abandonment analytics' },
      { metric: 'Latency', target: 'Cart add/update/remove P99 under 100ms; checkout end-to-end P99 under 3 seconds' },
      { metric: 'Availability', target: '99.95%+ on add-to-cart and browsing - a shopper should almost never be blocked from adding an item, even if checkout is degraded' },
      { metric: 'Idempotency', target: 'Any checkout or payment request is safe to retry with zero additional side effects' },
      { metric: 'Durability', target: 'A paid order must never be lost, even if the cart service itself crashes moments later' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Hot Cart Store',
      purpose: 'Active carts (session-like), high-QPS reads and writes at sub-ms latency',
      primaryPick: 'Redis Cluster',
      alternatives: 'Memcached, Aerospike',
      whyPrimaryWins: "Every add/update/view-cart call is a single Redis hash round-trip - the same reasoning that makes it the authoritative fast path in this design's own cart storage build",
    },
    {
      tier: 'Durable Cart Store',
      purpose: 'Cart backup that survives a Redis failover, synced by the Cart Persistence Writer',
      primaryPick: 'DynamoDB',
      alternatives: 'Cassandra, ScyllaDB, MongoDB, Postgres',
      whyPrimaryWins: 'Write-behind persistence at 50M+ concurrent carts needs infinite horizontal scale without managing shards by hand - Redis stays the source of truth, this is just the recovery net',
    },
    {
      tier: 'Cart & Order Events',
      purpose: 'Abandonment triggers, order confirmations, and analytics fan-out',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pub/Sub, RabbitMQ',
      whyPrimaryWins: "Decouples the checkout hot path from notification and reporting consumers entirely, matching how this design already fans order events out to the Notification Service and the abandonment scanner",
    },
    {
      tier: 'Inventory / Reservation Store',
      purpose: 'Available stock plus TTL-bound reservations, guarded against oversell under concurrent checkouts',
      primaryPick: 'Postgres (optimistic locking via version column)',
      alternatives: 'DynamoDB conditional writes, CockroachDB',
      whyPrimaryWins: 'A single conditional UPDATE ... WHERE version = ? lets exactly one concurrent checkout win a scarce unit without holding a distributed lock - cheaper and simpler than row-level pessimistic locking at flash-sale concurrency',
    },
    {
      tier: 'Pricing Service Backing Store',
      purpose: 'Live price and promotion lookups, queried on both add-to-cart (display) and checkout (charge)',
      primaryPick: 'Redis cache in front of Postgres',
      alternatives: 'Dedicated pricing microservice, DynamoDB',
      whyPrimaryWins: 'Price reads happen on nearly every cart and checkout call, so a cache absorbs that volume while Postgres stays the authoritative source the checkout saga always re-queries',
    },
    {
      tier: 'Guest Session Store',
      purpose: "Maps a signed guestId cookie to its anonymous cart before login-triggered merge",
      primaryPick: 'Redis (with TTL matching session lifetime)',
      alternatives: 'Cookie-only storage',
      whyPrimaryWins: 'Guest carts are inherently short-lived and disposable pre-login, so a TTL-bound Redis entry needs no separate cleanup job and merges cleanly into the account cart on login',
    },
  ],
  technologyChoicesNote:
    "Why Redis plus DynamoDB instead of just Postgres for the cart itself? Cart traffic is high write rate, high read rate, with no complex joins and a flexible per-item schema - exactly the shape Redis is built for, while a single Postgres table's row locks would collapse well before the 50K+ cart-mutations/sec burst this design targets. Redis gives the sub-millisecond hot path; DynamoDB gives write-behind durability without anyone having to manage shards by hand.",

  scaleEstimation: [
    'Users: 300M+ active shoppers; tens of millions of carts touched per hour, spiking 10-15x during a flash sale or Black Friday',
    'Cart write QPS: ~5K cart mutations/sec sustained (add/update/remove), bursting to 50K+/sec during a hot product drop',
    'Checkout QPS: ~500 checkouts/sec sustained, spiking to 5-8K/sec during a Black Friday peak minute',
    'Storage: ~5KB per active cart x 50M concurrent carts is roughly 250GB of hot cart data; abandoned carts retained 90 days for recovery push into multi-TB territory',
    'Read:write ratio: "view cart" reads outnumber cart mutations roughly 8:1 - most cart traffic is just re-rendering, not changing, the cart',
    'Reservation lifetime: a 10-15 minute TTL hold per checkout attempt means at any instant only the fraction of shoppers actively mid-checkout for a SKU are holding real stock, not everyone who has it in a cart',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/cart/items',
      description: 'Add an item to the cart (or increment quantity if it already exists). Snapshots the current live price.',
      example: '// Request\n{ "sku": "sku_9981", "quantity": 1 }\n\n// Response 200\n{ "cartId": "cart_abc", "items": [{ "sku": "sku_9981", "quantity": 1, "priceSnapshot": 4999 }] }',
    },
    {
      method: 'PATCH',
      path: '/v1/cart/items/:sku',
      description: 'Update the quantity of an existing cart line item.',
      example: '// Request\n{ "quantity": 3 }\n\n// Response 200\n{ "sku": "sku_9981", "quantity": 3 }',
    },
    {
      method: 'DELETE',
      path: '/v1/cart/items/:sku',
      description: 'Remove a line item from the cart entirely.',
      example: '// Response 204\n(no body)',
    },
    {
      method: 'GET',
      path: '/v1/cart',
      description: 'Return the current cart, flagging any item whose live price has drifted from its snapshot.',
      example: '// Response 200\n{ "cartId": "cart_abc", "items": [{ "sku": "sku_9981", "quantity": 3, "priceSnapshot": 4999, "livePrice": 4999, "priceChanged": false }] }',
    },
    {
      method: 'POST',
      path: '/v1/checkout',
      description: 'Begin checkout: reserve inventory, charge payment, create the order. Requires an Idempotency-Key header.',
      example: '// Headers\nIdempotency-Key: <uuid>\n\n// Request\n{ "cartId": "cart_abc", "paymentMethodId": "pm_visa_1" }\n\n// Response 201\n{ "orderId": "order_555", "status": "PAID", "totalCharged": 14997 }',
    },
    {
      method: 'GET',
      path: '/v1/orders/:orderId',
      description: 'Return the current status of an order (useful for polling after a 202/409 during checkout).',
      example: '// Response 200\n{ "orderId": "order_555", "status": "PAID", "items": [] }',
    },
  ],
  apiSecurityNote:
    'guestId is a signed, HttpOnly cookie so it cannot be forged to read or hijack another shopper\'s anonymous cart. userId always comes from the authenticated session, never from a client-supplied body field. Every checkout call requires an Idempotency-Key header - requests without one are rejected with 400 before any inventory or payment side effect can occur.',

  highLevelDesignIntro:
    "Let's build this by following the customer's actual journey: get a fast, durable place to hold items in a cart, keep that cart honest as prices and stock shift underneath it, then checkout in a way that never overspends, overcharges, or oversells - even when a network retries the same click twice.",

  builds: [
    {
      title: '1) Fast, Durable Cart Storage',
      body:
        "A single relational row per cart-item works at low volume, but 'view cart' and 'update quantity' happen constantly, and a cart is a terrible thing to make a customer wait 200ms for on every keystroke of a quantity field. The fix is to make the cart's primary home an in-memory store, and treat the durable database as a safety net rather than the hot path.\n\nEach cart is stored as a single Redis hash keyed by cartId (guestId for anonymous shoppers, userId once logged in), holding the full item list and price snapshots as one object. Reads and writes are single Redis round-trips - no joins, no row-per-item overhead.",
      insightCallout:
        "Cart data has two different durability requirements depending on where the customer is in their journey. Pre-checkout, losing a cart on a Redis failover is annoying (the customer re-adds a few items) but not catastrophic - it is a UX convenience, not a financial record. The moment checkout begins, that changes completely: the cart's contents are about to become a payment and an order, so its durability requirement jumps from 'best effort' to 'must survive a crash.' We deliberately don't pay for that stronger guarantee before it's needed.",
      newComponents: [
        { name: 'Cart Service', description: 'Owns all cart reads and writes. Stateless, horizontally scaled behind the API gateway.' },
        { name: 'Redis Cart Store', description: 'Holds the live, hot cart as a single hash per cartId. The primary read/write path for every cart operation.' },
        {
          name: 'Cart Persistence Writer',
          description:
            'A background process that periodically flushes dirty carts from Redis into the durable Cart DB, and does an immediate, synchronous flush the moment a checkout attempt begins for that cart.',
        },
        { name: 'Cart DB (durable)', description: 'A durable store (Postgres or DynamoDB) holding a periodically-synced snapshot of every cart, used for recovery and for anything that must survive a Redis failure.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  Client["Shopper"]:::client
  GW["API Gateway"]:::edge
  CS["Cart Service"]:::compute
  REDIS[("Redis<br/>hot cart store")]:::cache
  WRITER["Cart Persistence Writer"]:::async
  CARTDB[("Cart DB<br/>durable")]:::database

  Client -->|"1. Add item to cart"| GW
  GW -->|"2. Forward to cart svc"| CS
  CS -->|"3. Write cart hash"| REDIS
  CS -->|"4. Return updated cart"| Client
  WRITER -->|"5. Periodic scan"| REDIS
  WRITER -->|"6. Persist snapshot"| CARTDB`,
      },
      closingNote:
        "With a fast, mostly-forgivable cart in place, the next wrinkle shows up immediately: what happens when the same shopper has a guest cart on one device and an account cart on another, and they log in mid-session?",
    },
    {
      title: '2) Guest Carts and the Merge-on-Login Problem',
      body:
        "Most shoppers add their first few items before ever logging in. That anonymous cart is keyed by a signed guestId cookie, not a userId - the Cart Service doesn't yet know who this person is, and it shouldn't have to; anonymous browsing has to work.\n\nThe moment that shopper logs in, we now have two carts that both need to become one: the guestId cart they were just building, and whatever account cart (possibly from a different device, days ago) already existed under their userId. The merge has to combine both item lists, sum quantities for SKUs that appear in both (capped so the merge itself can't create an oversell claim), and pick the freshest price snapshot when the two carts disagree on price.",
      newComponents: [
        {
          name: 'Cart Merge Logic',
          description:
            'Triggered by the auth service on login. Reads both carts from Redis, unions the item sets, sums overlapping quantities, keeps the more recent priceSnapshot per SKU, and writes the result back under the userId key.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  Guest["Guest Session<br/>cookie cartId"]:::client
  Login["Login Event"]:::edge
  CS["Cart Service"]:::compute
  MERGE["Cart Merge Logic"]:::compute
  REDIS[("Redis<br/>hot cart store")]:::cache

  Guest -->|"1. Browses and adds items"| CS
  Login -->|"2. User authenticates"| CS
  CS -->|"3. Trigger merge"| MERGE
  MERGE -->|"4. Read guest cart"| REDIS
  MERGE -->|"5. Read account cart"| REDIS
  MERGE -->|"6. Write merged cart"| REDIS`,
      },
      closingNote:
        "Now we have one durable, mergeable cart per shopper. The next question is uncomfortable but unavoidable: what price is actually written on the items sitting inside it?",
    },
    {
      title: '3) Price Snapshot at Add-to-Cart vs Live Price at Checkout',
      body:
        "When a shopper adds an item, we snapshot the current price into the cart line item so the cart always displays a stable, explainable number - not a price that flickers every time the catalog team runs a repricing job. But that snapshot cannot be the price we actually charge days later, or a catalog bug that mis-prices a $999 item at $9.99 becomes a binding contract the moment it sits in someone's cart.\n\nSo the snapshot is for display only. The Pricing Service is queried again, live, the instant checkout begins, and that live price - not the snapshot - is what determines what the customer is charged.",
      insightCallout:
        "The snapshot answers 'what did I add this for' honestly; the live price answers 'what am I actually being charged' authoritatively. Conflating the two is how retailers accidentally honor prices they never intended to offer.",
      newComponents: [
        { name: 'Pricing Service', description: 'The single authoritative source for a SKU\'s current price. Both the Cart Service (for display) and checkout (for charging) call it.' },
        { name: 'Product Catalog Service', description: 'Backs the Pricing Service with product and price data, including any active promotions.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  CS["Cart Service"]:::compute
  PRICING["Pricing Service"]:::compute
  CATALOGDB[("Product Catalog DB")]:::database
  REDIS[("Cart<br/>stores price snapshot")]:::cache

  CS -->|"1. Add item, fetch current price"| PRICING
  PRICING -->|"2. Lookup live price"| CATALOGDB
  PRICING -->|"3. Return price"| CS
  CS -->|"4. Store item plus snapshot"| REDIS`,
      },
      closingNote:
        "Pricing is settled. Now for the problem that actually breaks shopping carts in production: what stops two customers from both 'winning' the same last unit?",
    },
    {
      title: '4) Soft Inventory Reservation Instead of Decrementing at Checkout',
      body:
        "Here is the exact failure the naive design invites. A hot sneaker has 1 unit left. Customer A and Customer B both load the product page and both see 'In Stock.' Both add it to their cart - adding to a cart does not touch inventory at all, so this is perfectly fine and expected, thousands of carts can contain the same scarce item simultaneously. Both proceed to checkout within the same second. If checkout naively does UPDATE stock SET qty = qty - 1 WHERE sku = ? with no concurrency guard, both requests can read qty = 1, both pass the check, and both succeed - the store just oversold a unit it never had.\n\nThe fix is to separate 'this item exists in a cart' from 'this unit is reserved for a specific checkout attempt.' Reservation happens only when a customer actually clicks 'Place Order,' not when they add to cart, and it is bounded by a short TTL so an abandoned checkout doesn't hold real stock hostage.",
      insightCallout:
        "Reservation is not the same event as adding to cart, and that distinction is the entire fix. Eight shoppers can have '1 unit' sitting in eight different carts at once with zero risk, because none of them have reserved anything yet. Only the first shopper to actually enter checkout for that SKU acquires the reservation; everyone else who tries afterward is told the truth immediately, before they waste time on a payment form that was always going to fail.",
      newComponents: [
        { name: 'Inventory Service', description: 'Owns availableStock per SKU and the reservation lifecycle. The only service allowed to mutate stock counts.' },
        {
          name: 'Product Stock table',
          description: 'availableStock plus a version integer column. Every decrement is a conditional UPDATE guarded by both the version and a stock >= quantity check.',
        },
        { name: 'Reservations table', description: 'One row per checkout-in-progress: sku, quantity, cartId, expiresAt (typically 10-15 minutes), status.' },
        { name: 'Reservation Sweeper', description: 'A background job that finds expired, never-confirmed reservations and restores their quantity to availableStock.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  CO["Checkout Orchestrator"]:::compute
  INV["Inventory Service"]:::compute
  STOCK[("Product Stock<br/>available_stock, version")]:::database
  RES[("Reservations<br/>TTL 10 min")]:::database
  SWEEP["Reservation Sweeper"]:::async

  CO -->|"1. Begin checkout, reserve qty"| INV
  INV -->|"2. Conditional decrement with version check"| STOCK
  INV -->|"3. Write reservation row"| RES
  SWEEP -->|"4. Release expired reservations"| RES
  SWEEP -->|"5. Restore available_stock"| STOCK`,
      },
      closingNote:
        "Inventory is now safe from oversell on its own. But reserving stock, charging a card, and creating an order are three separate services with three separate databases - and none of them can share a single ACID transaction.",
    },
    {
      title: '5) Checkout as a Saga Across Cart, Inventory, Payment, and Order Services',
      body:
        "A single BEGIN...COMMIT can't span the Inventory Service's database, an external payment gateway we don't own, and the Order Service's database. Two-phase commit is off the table too - Stripe and Adyen are never going to hold open a distributed transaction lock waiting on our internal systems to agree.\n\nSo checkout is modeled as a saga: a sequence of local transactions, each in its own service, each paired with a compensating action to undo it if a later step fails. A Checkout Orchestrator drives the sequence explicitly and persists its own progress after every step, so a crash mid-checkout can be resumed - or rolled back - by another orchestrator instance instead of leaving a half-finished purchase stuck forever.",
      insightCallout:
        "Every saga step must be idempotent on its own, independent of the overall idempotency key. Retrying 'reserve inventory' for a saga that already reserved is a safe no-op, not a second reservation - because the orchestrator itself might crash and resume the exact same step twice.",
      newComponents: [
        { name: 'Checkout Orchestrator', description: 'Coordinates the saga: reserve inventory, charge payment, create order, clear cart - running each step and, on failure, walking backward through compensations in reverse order.' },
        { name: 'Order Service', description: 'Creates the authoritative order record once payment is confirmed. Never invoked before a successful charge.' },
        { name: 'Saga State Store', description: "Durable record of which step a given checkout attempt has completed, written before each network call so a crashed orchestrator can be resumed from where it left off." },
      ],
      diagram: {
        mermaid: `flowchart LR
  Client["Shopper"]:::client
  CO["Checkout Orchestrator"]:::compute
  INV["Inventory Service"]:::compute
  PAY["Payment Service"]:::compute
  ORD["Order Service"]:::compute
  PGW["Payment Gateway<br/>external"]:::edge
  SAGA[("Saga State Store")]:::database

  Client -->|"1. POST checkout"| CO
  CO -->|"2. Persist saga step: started"| SAGA
  CO -->|"3. Reserve inventory"| INV
  CO -->|"4. Persist saga step: reserved"| SAGA
  CO -->|"5. Charge payment"| PAY
  PAY -->|"6. Authorize and capture"| PGW
  CO -->|"7. Persist saga step: charged"| SAGA
  CO -->|"8. Create order"| ORD`,
      },
      closingNote:
        "The saga makes a single checkout attempt correct. But a real checkout button gets double-clicked and a real network occasionally times out - the same logical attempt can arrive at the orchestrator twice.",
    },
    {
      title: '6) Idempotency Keys for Safe Checkout Retries',
      body:
        "A shopper double-clicks 'Place Order' because the page felt slow, or their phone loses signal right as the request lands and their client automatically retries. From the server's point of view these look identical to a genuinely new checkout attempt unless something explicitly says otherwise.\n\nThe client generates one Idempotency-Key (a UUID) per checkout attempt, before the first request, and resends that exact key on any retry. The very first thing the Checkout Orchestrator does - before touching inventory, payment, or orders - is an atomic insert of that key with a unique constraint. A duplicate key fails the insert instantly and the orchestrator returns the cached result of the original attempt instead of starting a second saga.",
      newComponents: [
        {
          name: 'Idempotency Store',
          description: 'Holds Idempotency-Key to saga-result mappings with a uniqueness guarantee. Backed by Redis for speed with a unique-constraint backstop in the durable saga store.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  Client["Shopper<br/>retries request"]:::client
  CO["Checkout Orchestrator"]:::compute
  IDEM[("Idempotency Store<br/>unique key constraint")]:::cache

  Client -->|"1. POST checkout, Idempotency-Key"| CO
  CO -->|"2. INSERT key, status IN_PROGRESS"| IDEM
  IDEM -->|"3. Duplicate key rejected"| CO
  CO -->|"4. Return cached result"| Client`,
      },
      closingNote:
        "Checkout itself is now safe end to end. The remaining question is about the far larger set of customers who never click 'Place Order' at all.",
    },
    {
      title: '7) Cart Abandonment Detection and Recovery',
      body:
        "With an industry-average abandonment rate around 70%, most carts are never checked out at all - and because reservations only happen at checkout entry (build 4), an abandoned cart never held real inventory hostage in the first place. This is purely a revenue-recovery problem, not a correctness one.\n\nA background scanner periodically finds carts with items but no activity for a configurable window (commonly 1-2 hours for the first nudge, 24 hours for a follow-up), and publishes an event with a snapshot of the cart's contents and prices at the time of abandonment.",
      newComponents: [
        { name: 'Abandonment Scanner', description: 'A scheduled job that scans the durable Cart DB for idle carts past a threshold and emits an event per abandoned cart.' },
        { name: 'Notification Service', description: 'Consumes abandonment events and sends a reminder email or push notification, optionally with a live stock-urgency message pulled from the Inventory Service.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  SCAN["Abandonment Scanner"]:::async
  CARTDB[("Cart DB")]:::database
  K["Kafka"]:::async
  NOTIF["Notification Service"]:::compute
  PUSH["Email and Push"]:::edge

  SCAN -->|"1. Scan carts idle over threshold"| CARTDB
  SCAN -->|"2. Publish cart.abandoned"| K
  K -->|"3. Trigger reminder"| NOTIF
  NOTIF -->|"4. Send reminder"| PUSH`,
      },
      closingNote:
        "Everyday traffic is handled. The last gap is what happens to this exact design the one day a year traffic is 15x normal.",
    },
    {
      title: '8) Scaling Checkout for Flash Sales Without Oversell or Timeout Cascades',
      body:
        "During a flash sale on a scarce SKU, tens of thousands of shoppers can hit 'Place Order' for the same item within seconds. Even with correct reservation logic (build 4), letting all of them attempt a reservation concurrently means the Inventory Service's conditional-update row becomes a hot lock, and the vast majority of those attempts were always going to fail - they're just failing expensively, competing for the same database row and the same payment gateway capacity that the eventual winners need.\n\nThe fix is admission control scoped to the SKU, not the whole site: when concurrent checkout attempts for a given hot SKU exceed some multiple of its remaining stock, new attempts are queued rather than let straight through, and are drained into the Checkout Orchestrator only as fast as reservations can actually be granted.",
      newComponents: [
        {
          name: 'Flash Sale Admission Controller',
          description: 'Detects when a SKU is under contention and funnels excess checkout attempts into a queue instead of the Checkout Orchestrator directly, protecting inventory locks and payment gateway capacity.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  Shoppers["Thousands of Shoppers"]:::client
  ADM["Flash Sale Admission Controller"]:::edge
  Q[["Checkout Queue"]]:::async
  CO["Checkout Orchestrator"]:::compute
  INV["Inventory Service"]:::compute

  Shoppers -->|"1. Attempt checkout on hot SKU"| ADM
  ADM -->|"2. Admit only remaining stock plus buffer"| Q
  Q -->|"3. Dequeue in order"| CO
  CO -->|"4. Attempt reservation"| INV`,
      },
      closingNote:
        "With storage, pricing, reservation, saga orchestration, idempotency, abandonment recovery, and flash-sale admission control in place, the pieces are ready to be walked through end to end as full request flows.",
    },
  ],

  coreFlows: [
    {
      title: 'Add to Cart (End to End)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Shopper
  participant GW as API Gateway
  participant CS as Cart Service
  participant PR as Pricing Service
  participant R as Redis Cart Store
  participant W as Persistence Writer
  participant DB as Cart DB

  C->>GW: POST cart items sku qty
  GW->>CS: forward with guestId or userId
  CS->>PR: fetch live price for sku
  PR-->>CS: price snapshot
  CS->>R: HSET cart hash item plus price
  R-->>CS: OK
  CS-->>C: 200 updated cart
  W->>R: periodic scan of dirty carts
  W->>DB: upsert durable snapshot`,
      },
      nonObviousFailure:
        "If the Persistence Writer crashes right after a flush interval starts but before it commits to the Cart DB, the cart is still perfectly fine - Redis remains authoritative and the next flush cycle picks it up. The real risk window is a Redis failover happening between two flush cycles; a short flush interval (seconds, not minutes) plus Redis AOF persistence bounds how much a shopper could ever lose to a handful of recent edits.",
    },
    {
      title: 'Checkout Saga (Happy Path and Payment Decline)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Shopper
  participant CO as Checkout Orchestrator
  participant SAGA as Saga State Store
  participant INV as Inventory Service
  participant PAY as Payment Service
  participant PGW as Payment Gateway
  participant ORD as Order Service
  participant CART as Cart Service

  C->>CO: POST checkout Idempotency-Key
  CO->>SAGA: insert key status IN_PROGRESS
  CO->>INV: reserve qty for every sku
  INV-->>CO: reservation ids plus expiresAt
  CO->>SAGA: record step reserved
  CO->>PAY: charge amount idempotencyKey
  PAY->>PGW: authorize and capture
  alt payment approved
    PGW-->>PAY: approved transactionId
    PAY-->>CO: charged
    CO->>SAGA: record step charged
    CO->>ORD: create order from reservations
    ORD-->>CO: orderId
    CO->>CART: clear cart
    CO->>SAGA: mark COMPLETED
    CO-->>C: 200 order confirmed
  else payment declined
    PGW-->>PAY: declined
    PAY-->>CO: failed
    CO->>INV: release reservation compensating
    CO->>SAGA: mark FAILED
    CO-->>C: 402 payment declined, cart intact
  end`,
      },
      nonObviousFailure:
        "If the orchestrator crashes right after the payment gateway approves the charge but before the order is created, the saga state store shows step 'charged' with no matching order. On recovery, the correct action is to resume forward and create the order using the confirmed transactionId - never to issue a refund for a successful charge just because our own process crashed. Treating a confirmed payment as untrustworthy would turn our bug into a customer-hostile cancellation.",
    },
    {
      title: 'Guest Cart Merge on Login',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant U as User
  participant AUTH as Auth Service
  participant CS as Cart Service
  participant R as Redis Cart Store

  U->>AUTH: login credentials
  AUTH-->>U: session token
  AUTH->>CS: emit user logged in with guestId and userId
  CS->>R: read guest cart by guestId
  CS->>R: read account cart by userId
  CS->>CS: merge items, sum quantities, keep newest price
  CS->>R: write merged cart under userId
  CS->>R: mark guest cart merged
  CS-->>U: cart ready with merged items`,
      },
      nonObviousFailure:
        "If the login event fires twice (a flaky client retries the login call), the merge must be idempotent or quantities get summed twice, silently doubling what the shopper intended to buy. Marking the guest cart as 'merged' as the very last step, and short-circuiting the whole flow if it's already marked, makes a duplicate merge event a safe no-op.",
    },
  ],

  deepDives: [
    {
      title: 'Preventing Overselling the Last Unit During a Flash Sale',
      problem:
        'A hot SKU has exactly 1 unit left. Thousands of shoppers have it sitting in their carts, and dozens click "Place Order" within the same second when the sale starts. Exactly one of them must succeed; everyone else must be told "sold out" cleanly, not left in a stuck or double-charged state.',
      bad:
        'Decrement stock only when the order is finally placed, with UPDATE products SET stock = stock - 1 WHERE id = ? and no concurrency guard. Every concurrent request reads stock = 1, every one passes a naive application-level "stock > 0" check, every one proceeds - and stock goes negative while five customers get order confirmations for one physical unit.',
      good:
        "Move the decrement earlier, to add-to-cart time, with a conditional UPDATE ... WHERE stock >= qty. This does stop the multi-buyer oversell, but it creates a hoarding problem: a customer adds the last unit, gets distracted, and never checks out - that unit is now 'sold' and stuck in their cart for hours while every other genuinely ready buyer sees 'out of stock' for an item that, in reality, nobody has bought yet.",
      great:
        "Separate available stock from reserved stock, and resolve concurrent reservation attempts with optimistic locking. The products table carries availableStock plus a version integer. Reservation happens only at checkout entry (never at add-to-cart) via a single conditional update: UPDATE products SET availableStock = availableStock - qty, version = version + 1 WHERE id = ? AND version = ? AND availableStock >= qty. Whichever request's version matches wins and its rows-affected count is 1; every other concurrent request's version no longer matches, its update affects 0 rows, and it fails fast with a clean 'sold out' rather than corrupting the count.\n\nThe winning request also writes a Reservation row in the same transaction with an expiresAt roughly 10-15 minutes out. If payment never completes, the Reservation Sweeper finds the expired row and restores availableStock - the unit returns to the pool automatically, with no human intervention and no permanent loss of the sale. Only a successful payment converts the reservation into a permanent sale (the stock was already decremented; converting is just deleting the reservation row, not touching stock again). This gives correctness (never oversold), fairness (only shoppers who actually reached checkout hold stock, and only briefly), and self-healing recovery (abandoned holds return automatically).",
      diagram: {
        mermaid: `flowchart LR
  A["Customer A checkout"]:::client
  B["Customer B checkout"]:::client
  INV["Inventory Service"]:::compute
  STOCK[("available_stock = 1<br/>version = 7")]:::database

  A -->|"1. UPDATE WHERE version=7 AND stock>=1"| INV
  B -->|"2. UPDATE WHERE version=7 AND stock>=1"| INV
  INV -->|"3. First writer wins, version becomes 8"| STOCK
  INV -->|"4. Second writer affects 0 rows, told sold out"| STOCK`,
      },
    },
    {
      title: 'Cart Price vs Live Price: Who Actually Wins at Checkout',
      problem:
        "An item is added to the cart Monday at $49.99. By Friday's checkout, the price has moved - up to $54.99 from demand-based repricing, or down to $39.99 because a flash sale started. What price does the customer actually pay, and what happens when the answer feels unfair to them?",
      bad:
        "Lock in the add-to-cart price forever and always honor it. This breaks the instant a genuine pricing error happens - a $999 item mis-tagged at $9.99 in the catalog - because the system is now contractually obligated, by its own logic, to sell at a price no one intended. A 'locked' price that has to be honored no matter what isn't a feature, it's a liability.",
      good:
        "Always silently re-fetch and charge the live price at checkout, with no warning. This is legally defensible (most retail terms state the price at time of purchase is binding, not the price at time of cart-add) but it's a poor customer experience - a shopper who added an item at $49.99 gets charged $54.99 with no notice, which reliably produces chargebacks and support tickets, not just annoyance.",
      great:
        "Keep the cart's displayed price as an honest 'price as of when you added this,' but re-fetch the authoritative live price the moment checkout starts and explicitly diff it against the snapshot. If the live price is lower, apply it automatically and silently - it never hurts the customer, and it pre-empts 'why wasn't I charged the sale price' complaints. If the live price is higher, halt checkout and show an explicit 'price has changed' confirmation screen with both numbers, requiring the customer to accept before payment is attempted. This is what Amazon and Flipkart both do in practice, and it turns a silent-overcharge risk into an explicit, auditable customer decision. The resulting order record stores both the original snapshot and the live price actually charged, which is exactly what a support agent needs when a dispute comes in months later.",
    },
    {
      title: 'Checkout Across Four Services Without a Distributed ACID Transaction',
      problem:
        "Reserving inventory, charging a card, and creating an order live in three independently-owned services and databases (four counting the cart). A single BEGIN...COMMIT can't span them, and two-phase commit across a payment gateway you don't control is a non-starter - Stripe and Adyen won't hold an open distributed lock waiting on your internal systems.",
      bad:
        'Call all three steps sequentially with no rollback plan and hope nothing fails in between. If payment succeeds but the order-creation call then times out, the customer is charged with no order in existence anywhere, and support has to manually reconcile "you charged me but I have no order" tickets one at a time.',
      good:
        'Wrap each local step in its own transaction and log every attempt to an audit table, then run a nightly reconciliation job that a human reviews and fixes drift from. This eventually gets every transaction correct, but "correct after someone looks at a spreadsheet the next morning" is not an acceptable failure mode for a checkout button millions of people click every day.',
      great:
        "An orchestrated saga where a single Checkout Orchestrator issues each local transaction as an explicit step, pairs it with a compensating action, and persists its own progress to a durable saga state store after every step - so a crash mid-flow can be resumed or rolled back automatically instead of waiting on a human. Step 1: reserve inventory (compensate: release the reservation). Step 2: charge payment (compensate: refund). Step 3: create the order and clear the cart (compensate: cancel the order, restore the cart). Each step is itself idempotent, so retrying 'reserve inventory' for a saga that already reserved is a safe no-op rather than a duplicate hold.\n\nOn any step's failure, the orchestrator walks backward through the already-completed steps' compensations in reverse order. Because the orchestrator persists which step is currently in-flight before making the corresponding network call, a crashed orchestrator instance can be picked up by another instance and resumed exactly where it left off. This is the same architectural shape used for order-to-payment-to-fulfillment flows industry-wide, and it's the version of this design that actually survives a financial audit.",
    },
    {
      title: 'Making Checkout Idempotent Under Double-Clicks and Timeouts',
      problem:
        'A shopper double-clicks "Place Order" because the page felt slow, or their phone loses signal exactly as the request lands and their client automatically retries. In both cases, the server may receive what is logically the same checkout attempt twice.',
      bad:
        'No protection at all - every POST /checkout that arrives creates a new order and a new charge. At scale, a slow or dropped network isn\'t a rare edge case, it\'s constant background noise, so this guarantees double-charges sooner rather than later.',
      good:
        "Disable the 'Place Order' button after the first click on the client. This fixes the double-click case, but does nothing for the automatic-retry-after-timeout case - from the client's perspective that's a fresh request, because it genuinely believes the first one never got a response, so double-charges still happen.",
      great:
        'A server-enforced Idempotency-Key. The client generates one UUID per checkout attempt (not per click) before the very first request and resends the same key on every retry. As its first action, the Checkout Orchestrator tries to atomically insert (idempotencyKey, status=IN_PROGRESS) under a unique constraint; a duplicate insert fails immediately and the server returns the cached final result of the original attempt - or, if that attempt is still in flight, a 409 telling the client to poll rather than retry with a brand-new attempt. This single guard makes the entire saga safe to retry at every layer, because the saga simply can never start twice for the same key. The same key, or a value deterministically derived from it, is also passed down to the payment gateway\'s own idempotency parameter, so even a network blip between our servers and the gateway cannot produce two charges.',
    },
  ],

  selfAudit: [
    { question: 'Where does the cart live before checkout?', answer: 'Redis is authoritative; a background writer flushes to a durable DB, and a Redis failover pre-checkout is an acceptable, recoverable loss.' },
    { question: 'When is inventory actually reserved?', answer: 'Only at checkout entry, never at add-to-cart, via a TTL-bound hold that auto-releases if payment never completes.' },
    { question: 'What stops overselling the last unit?', answer: 'A conditional update guarded by a version column (optimistic locking) - only one concurrent request can win the decrement, everyone else fails fast.' },
    { question: 'What price does the customer actually pay?', answer: 'The live price at checkout, applied automatically if it dropped, requiring explicit confirmation if it rose. The add-to-cart snapshot is display-only.' },
    { question: 'How is checkout made safe to retry?', answer: 'A client-generated Idempotency-Key with a unique-constraint guard as the very first step of the saga.' },
    { question: 'What happens if payment succeeds but order creation crashes?', answer: 'Saga progress was durably persisted before the payment call; recovery resumes forward and creates the order - it never blindly refunds a confirmed charge.' },
    { question: 'Why a saga instead of a distributed transaction?', answer: 'Inventory, payment, and orders live in separate services and an external gateway - no ACID transaction can span them, so each step gets a compensating action instead.' },
    { question: 'How do abandoned carts differ from failed checkouts?', answer: 'An abandoned cart never held a reservation at all (reservations only start at checkout), so abandonment is purely a marketing/recovery signal, not a correctness concern.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  Shopper["Shopper Web and Mobile"]:::client
  GW["API Gateway"]:::edge
  CS["Cart Service"]:::compute
  REDIS[("Redis<br/>hot cart store")]:::cache
  CARTDB[("Cart DB<br/>durable")]:::database
  WRITER["Cart Persistence Writer"]:::async
  PRICING["Pricing and Catalog Service"]:::compute
  CATALOGDB[("Catalog DB")]:::database
  ADM["Flash Sale Admission Controller"]:::edge
  CO["Checkout Orchestrator"]:::compute
  SAGA[("Saga State Store")]:::database
  IDEM[("Idempotency Store")]:::cache
  INV["Inventory Service"]:::compute
  STOCK[("Product Stock<br/>version column")]:::database
  RES[("Reservations<br/>TTL")]:::database
  SWEEP["Reservation Sweeper"]:::async
  PAY["Payment Service"]:::compute
  PGW["Payment Gateway"]:::edge
  ORD["Order Service"]:::compute
  ORDDB[("Order DB")]:::database
  K["Kafka"]:::async
  SCAN["Abandonment Scanner"]:::async
  NOTIF["Notification Service"]:::compute

  Shopper -->|"Browse and manage cart"| GW
  GW -->|"Route cart ops"| CS
  CS -->|"Read and write hot cart"| REDIS
  WRITER -->|"Flush dirty carts"| REDIS
  WRITER -->|"Persist snapshot"| CARTDB
  CS -->|"Fetch live price"| PRICING
  PRICING -->|"Lookup catalog"| CATALOGDB

  Shopper -->|"Begin checkout"| ADM
  ADM -->|"Admit within stock limit"| GW
  GW -->|"Route checkout"| CO
  CO -->|"Check and set idempotency key"| IDEM
  CO -->|"Persist saga progress"| SAGA
  CO -->|"Reserve inventory"| INV
  INV -->|"Conditional decrement"| STOCK
  INV -->|"Write TTL reservation"| RES
  SWEEP -->|"Release expired holds"| RES
  SWEEP -->|"Restore stock"| STOCK
  CO -->|"Charge payment"| PAY
  PAY -->|"Authorize and capture"| PGW
  CO -->|"Create order"| ORD
  ORD -->|"Persist order"| ORDDB
  CO -->|"Clear cart on success"| CS
  ORD -->|"Publish order events"| K
  K -->|"Notify shopper"| NOTIF
  SCAN -->|"Scan idle carts"| CARTDB
  SCAN -->|"Publish abandoned event"| K`,
    bullets: [
      'Cart operations stay on the fast path - Cart Service reads and writes Redis directly; a background writer, not the request path, persists to the durable Cart DB.',
      'Prices are snapshotted for display but re-validated live at checkout via the Pricing Service.',
      'Flash-sale traffic on a hot SKU is throttled by the Admission Controller before it ever reaches the Checkout Orchestrator.',
      'Checkout is a saga - the Orchestrator reserves inventory, charges payment, and creates the order as explicit, individually-compensatable steps, guarded end to end by an idempotency key.',
      'Inventory reservation uses a version-column conditional update plus a TTL, so exactly one concurrent checkout wins a scarce unit and abandoned holds self-heal.',
      'Order events fan out through Kafka to notifications and the abandonment recovery pipeline without coupling them to the checkout hot path.',
    ],
  },

  keyTechnologies: [
    { term: 'Soft Reservation (TTL Hold)', definition: 'A time-bounded inventory hold created only at checkout entry, converted to a permanent sale on payment success or auto-released on expiry.' },
    { term: 'Optimistic Locking', definition: 'A version column on a row; a conditional update only succeeds if the version still matches, letting exactly one concurrent writer win without holding a lock.' },
    { term: 'Saga Pattern', definition: 'A sequence of local transactions across services, each paired with a compensating action, used when a single ACID transaction cannot span every participant.' },
    { term: 'Idempotency Key', definition: 'A client-generated identifier attached to a request so retries return the original result instead of repeating side effects like charges or order creation.' },
    { term: 'Price Snapshot', definition: 'The price recorded on a cart line item at the moment it was added, kept for honest display but never used as the amount actually charged.' },
    { term: 'Outbox Pattern', definition: 'Writing an event to a table in the same local transaction as the business change, then relaying it asynchronously, so the event is never lost or duplicated relative to the write.' },
    { term: 'Redis', definition: 'An in-memory store used here as the hot, low-latency home for live cart state, with a durable database as the async-persisted backstop.' },
  ],

  expectedDepth: {
    mid:
      'Design a basic cart-and-checkout flow with a database, and recognize the core problems: overselling under concurrency, and why decrementing stock at final checkout without a guard is a race condition. Propose a simple conditional update or transaction to fix the obvious double-buy race, and sketch a happy-path flow from add-to-cart through order creation.',
    senior:
      'Propose Redis-backed cart storage with async persistence, and a TTL-bound inventory reservation created only at checkout rather than at add-to-cart. Explain the saga pattern for coordinating inventory, payment, and order services without a shared transaction, and justify idempotency keys as a first-class checkout requirement rather than an afterthought. Articulate the price-snapshot-vs-live-price tradeoff and pick a defensible resolution.',
    staffPlus:
      "Address flash-sale admission control as a SKU-scoped concern, not a whole-site rate limit, and quantify why unthrottled contention on one hot item degrades checkout for everyone. Discuss orchestrated vs choreographed sagas and justify the choice given financial audit requirements. Cover recovery semantics explicitly - what the system does when a crash lands between payment success and order creation - and the cost/latency tradeoffs of stronger consistency (Redlock-style coordination) versus the version-column approach at real scale.",
  },

  keyTakeaways: [
    'Add-to-cart and checkout have fundamentally different consistency needs - keep the cart cheap and forgiving, keep checkout careful and unforgiving.',
    'Inventory is reserved at checkout entry with a TTL hold, never at add-to-cart - that single decision prevents both overselling and hoarding.',
    'Checkout across independently-owned services is a saga: local transactions plus compensating actions, not a distributed transaction.',
    'An idempotency key is not optional on a checkout API - it is the guard that makes every other retry-safety property in the design actually hold.',
    'Live price wins at checkout, not the cart snapshot - apply drops automatically, require explicit confirmation for increases.',
  ],

  relatedDesigns: ['ticket-booking', 'digital-wallet', 'job-scheduler', 'food-delivery'],
  relatedConcepts: [
    { name: 'Saga Pattern', description: 'Coordinates inventory reservation, payment, and order creation with compensating rollbacks on failure.' },
    { name: 'Optimistic Concurrency Control', description: 'A version column resolves the last-unit race without holding a distributed lock.' },
    { name: 'Idempotency', description: 'Guarantees a retried or double-clicked checkout request never produces a duplicate order or charge.' },
    { name: 'Event-Driven Architecture', description: 'Order and abandonment events fan out to notifications and analytics without coupling to the checkout hot path.' },
  ],

  simulator: {
    goalDescription: 'Keep cart edits fast and forgiving while checkout stays correct - no oversell, no double-charge - even under flash-sale bursts.',
    requirementChips: ['Cart op p99 < 100ms', '50K cart mutations/sec burst', 'Checkout retry-safe'],
    targetRps: 50000,
    readRatio: 0.85,
    cacheHitRatio: 0.8,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'gateway-edge', label: 'API gateway fronting cart and checkout traffic', kind: 'requires-node-type', nodeType: 'api-gateway' },
      { id: 'cart-cache', label: 'Redis as the hot cart/idempotency store', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'durable-db', label: 'Durable store for orders and inventory', kind: 'requires-node-type', nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb'] },
      { id: 'compute-tier', label: 'Compute tier for cart service and checkout orchestrator', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 15, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 10, position: { x: 880, y: 280 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Redis holds the hot, low-latency cart and idempotency-key state; Postgres is the durable system of record for orders and TTL-bound inventory reservations, guarded by a version column so exactly one concurrent checkout wins a scarce unit.',
    failureModeNarratives: {
      'api-gateway': 'A single gateway instance sits in front of every cart and checkout request; if it goes down, no traffic reaches the system at all, including in-flight checkout retries protected by idempotency keys.',
    },
    fullDesignLinkSlug: 'shopping-cart',
  },
}

export default topic
