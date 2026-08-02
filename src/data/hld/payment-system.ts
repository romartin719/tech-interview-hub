import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'payment-system',
  title: 'Payment System (Stripe / Razorpay)',
  difficulty: 'Advanced',
  icon: 'pi pi-credit-card',
  color: '#16a34a',
  readTimeMinutes: 30,
  topics: ['Idempotency Keys', 'Payment State Machine', 'Double-Entry Ledger', 'PCI Tokenization'],
  companies: ['Stripe', 'Razorpay', 'PayPal', 'Square'],
  prerequisites: ['Idempotency', 'Distributed Transactions', 'Message Queues'],
  summary:
    'A payment system charges an external card or bank account through a processor and acquiring bank, tracking every authorization, capture, and settlement as a durable state machine backed by a double-entry ledger, so that idempotency keys prevent double-charges, webhooks (backstopped by reconciliation) carry asynchronous bank truth back into the system, and merchants get paid out on a predictable schedule net of fees.',

  understandingProblem:
    "A payment system is what sits between \"customer taps pay\" and \"merchant actually has the money.\" It is easy to confuse this with a wallet, but the two solve different problems: a wallet (see the Digital Wallet design) moves money between accounts that already live inside your own ledger, while a payment system reaches OUTSIDE your system entirely - to a card network, an issuing bank, or an ACH rail you do not control - to pull money from a customer's external card or bank account, and later push a net amount to a merchant's external bank account. Every step in between is owned by someone else's infrastructure and responds on someone else's clock: a card authorization might come back in 200ms, but the actual settlement of funds from the card network to your bank can take 1-3 business days. You need a system that can say \"yes, this charge succeeded\" within a second for a good checkout experience, while still being able to prove, days later, that the money you promised the merchant is actually sitting in your bank account.",
  realExamples:
    'Stripe processes hundreds of billions of dollars a year for millions of businesses and famously popularized the client-supplied Idempotency-Key header as a first-class API primitive. Razorpay is the dominant processor for India\'s UPI and card rails, settling into merchant bank accounts on T+2 by default. PayPal/Braintree popularized hosted card fields so merchants never touch a raw card number. Square runs the same authorize/capture/settle pipeline for both in-person terminals and online checkout.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Checkout Page]:::client
  api["App Server<br/>stores card number<br/>calls bank directly"]:::compute
  db[("orders table<br/>status column")]:::database
  bank["Card Network"]:::edge
  client --> api
  api --> db
  api --> bank`,
    },
    whyThisBreaks: [
      'Storing the raw card number (PAN) in your own database is a PCI-DSS violation the moment you go live - one breach and you are liable for every card on file, not to mention the audit that follows.',
      'No idempotency key - the customer\'s phone loses signal after the charge succeeds but before the 200 response arrives. The checkout page retries "just to be safe" and the customer is charged twice for the same order.',
      'A single "status" column on the order can only hold one value at a time - if the process crashes between "card authorized" and "order marked paid," you have real money held on a customer\'s card with zero record of why.',
      'Treating the bank call as synchronous - a card network authorization can legitimately take 5-10 seconds under load, and a bank transfer confirmation can take hours. Blocking a web request thread for that long exhausts your connection pool during a traffic spike.',
      'No ledger, just a balance-like "amount_charged" field - when finance asks "why does our bank statement show $40 less than our records for last Tuesday," there is no journal to audit, only a single number with no history.',
    ],
    closingNote:
      "Everything from here is about turning \"call the bank and hope\" into a system where every dollar in flight has a durable state, a paper trail, and a plan for what happens when the bank's answer arrives late, twice, or not at all.",
  },

  priorArt: [
    {
      title: 'Stripe Idempotency Keys',
      description:
        'Popularized the Idempotency-Key request header as an API-level guarantee: the same key replays the exact original response instead of re-executing the charge, and reusing a key with different parameters is rejected outright. (Stripe API docs / Stripe Engineering blog)',
      link: 'https://docs.stripe.com/api/idempotent_requests',
    },
    {
      title: 'Stripe Webhook Signing',
      description:
        'Every webhook event is signed with an HMAC-SHA256 over "timestamp.payload" in a Stripe-Signature header, with a tolerance window to reject stale/replayed events - the reference implementation for "never trust an unsigned callback." (Stripe API docs)',
      link: 'https://docs.stripe.com/webhooks/signature',
    },
    {
      title: 'Razorpay Payment Reconciliation',
      description:
        'Runs scheduled reconciliation jobs that diff internal payment records against bank/UPI settlement files at scale, since India\'s UPI rail can report success asynchronously well after the customer-facing authorization. (Razorpay Engineering blog)',
      link: 'https://razorpay.com/blog/single-view-recon/',
    },
    {
      title: 'PCI DSS Tokenization (SAQ A vs SAQ D)',
      description:
        'The card industry\'s own compliance framework rewards merchants who never let a raw card number touch their servers (hosted fields -> SAQ A, the lightest audit) versus those who do (SAQ D, a full annual assessment) - the industry-standard argument for tokenizing at the edge. (PCI Security Standards Council)',
      link: 'https://www.pcisecuritystandards.org/documents/Tokenization_Guidelines_Info_Supplement.pdf',
    },
    {
      title: 'TigerBeetle / Modern Treasury Ledger Design',
      description:
        'Purpose-built financial datastores and ledger-as-a-service platforms enforce the debit-equals-credit invariant at the storage layer itself, which is the same principle a payment ledger borrows to make "where did this money go" always answerable. (tigerbeetle.com, Modern Treasury Journal)',
      link: 'https://tigerbeetle.com/',
    },
  ],

  coreEntities: [
    { name: 'Merchant', description: 'The business receiving payment. Has a linked payout bank account, a fee schedule, and a risk profile.' },
    { name: 'Customer', description: 'The person paying. Identified by a customer ID; their raw card details never touch our database.' },
    {
      name: 'Payment Method',
      description: 'A tokenized reference to a card or bank account, issued by a vault or the processor itself - never the raw PAN.',
    },
    {
      name: 'Payment Intent (Charge)',
      description: 'The durable record of one attempt to move money: amount, currency, state, and links to every state transition it went through.',
    },
    {
      name: 'Ledger Entry',
      description: 'One debit or credit line in the double-entry ledger. Always created in a balanced pair; append-only.',
    },
    { name: 'Payout', description: "A batched transfer of a merchant's net earnings (charges minus fees minus refunds) to their bank account on a schedule." },
    { name: 'Dispute (Chargeback)', description: 'A cardholder-initiated reversal raised through the issuing bank and card network, with its own evidence and resolution workflow.' },
  ],

  requirements: {
    core: [
      "Charge a customer's card or bank account for a specific amount and currency, on behalf of a merchant.",
      'Support the authorize-now, capture-later lifecycle (e.g. an e-commerce order authorizes at checkout but only captures funds when the item ships).',
      'Guarantee idempotent retries - a client that times out and retries the exact same logical charge is never charged twice.',
      "Settle and pay out merchants' net earnings to their linked bank account on a predictable schedule, net of platform fees.",
      'Support full and partial refunds, and record disputes/chargebacks against a charge.',
    ],
    belowTheLine: [
      'Peer-to-peer wallet transfers between end users (a separate system - see the Digital Wallet design)',
      'Recurring/subscription billing engine (built on top of this, not part of it)',
      'Multi-currency FX conversion beyond simple currency-of-record charging',
      'In-person POS hardware/terminal protocols (EMV, NFC)',
      'Full merchant underwriting, KYC, and risk-scoring for onboarding new merchants',
      'Buy-now-pay-later financing and installment plans',
    ],
    nonFunctionalTable: [
      { metric: 'Correctness', target: 'Money is never created, lost, or duplicated - every ledger entry balances and every state transition is durable' },
      { metric: 'Availability', target: '99.99% on the charge path - a checkout outage is a lost sale, not just a bad UX metric' },
      { metric: 'Latency', target: 'P99 under 2s for authorization; capture/refund can tolerate seconds; settlement is asynchronous by nature' },
      { metric: 'Idempotency', target: 'Any charge, capture, or refund request is safe to retry for at least 24 hours with the same key' },
      { metric: 'PCI compliance scope', target: 'Raw card numbers never touch our servers - tokenization pushes us into the lightest compliance tier (SAQ A)' },
      { metric: 'Auditability', target: "Every cent a merchant is owed or has been paid must be traceable to specific ledger entries and processor events" },
    ],
  },

  technologyChoices: [
    {
      tier: 'Payment State Store',
      purpose: 'Payment intent lifecycle and every state transition',
      primaryPick: 'Postgres',
      alternatives: 'CockroachDB, Spanner, MySQL',
      whyPrimaryWins: 'ACID transactions across the state-transition write and the payment_events insert are non-negotiable - a stuck row between the two leaves real money in limbo with no record of why.',
    },
    {
      tier: 'Ledger',
      purpose: 'Double-entry accounting for money movement',
      primaryPick: 'Postgres (append-only ledger tables)',
      alternatives: 'TigerBeetle, custom ledger datastore',
      whyPrimaryWins: 'Append-only rows plus a balanced-debits-and-credits check enforce the ledger invariant at the query layer; a purpose-built ledger DB like TigerBeetle is faster but is one more system to operate at a volume Postgres already handles comfortably.',
    },
    {
      tier: 'Idempotency Store',
      purpose: 'Dedup retried charge, capture, and refund requests',
      primaryPick: 'Redis (lock) + Postgres (durable response cache)',
      alternatives: 'DynamoDB',
      whyPrimaryWins: 'Redis SET NX PX gives the short-lived processing lock in one round trip; Postgres persists the 24-hour cached response durably, since losing an idempotency record is the same as losing the guarantee entirely.',
    },
    {
      tier: 'Async Fan-out',
      purpose: 'Coordinate ledger writes with order, notification, and analytics side effects',
      primaryPick: 'Kafka, fed by Debezium CDC off the outbox table',
      alternatives: 'SQS, RabbitMQ, EventBridge',
      whyPrimaryWins: 'CDC off the outbox guarantees the event exists if and only if the ledger write committed, without wrapping a bank webhook and three service calls in one fragile synchronous transaction.',
    },
    {
      tier: 'Tokenization Vault',
      purpose: 'Hold the raw card PAN outside our own compliance boundary',
      primaryPick: 'Processor-hosted vault (Stripe/Braintree) or a dedicated vault (Basis Theory, VGS)',
      alternatives: 'HashiCorp Vault, a custom AWS KMS-backed vault',
      whyPrimaryWins: 'Never letting the PAN touch our servers keeps us in the lightest PCI compliance tier (SAQ A) instead of a full, audited SAQ D assessment.',
    },
    {
      tier: 'Audit Trail',
      purpose: 'Immutable record of every state transition for support and reconciliation',
      primaryPick: 'Postgres payment_events table, streamed to Kafka',
      alternatives: 'EventBridge',
      whyPrimaryWins: "A support agent or auditor needs to replay exactly what happened to a payment intent, not just where it ended up - an event log answers that; a status column never can.",
    },
  ],
  technologyChoicesNote:
    'Why Postgres over a NoSQL store for payments? ACID transactions are non-negotiable - a crashed payment with no matching ledger entry is real money nobody can account for. Postgres gives serializable isolation, and since the payment DB shards cleanly by merchant_id, horizontal write scale is rarely the bottleneck it would be for a more general-purpose OLTP workload.',

  scaleEstimation: [
    'Merchants: 50K active merchants processing through the platform',
    'Charges: 5M charges/day -> ~60/sec average, ~600/sec at peak (holiday sales spikes are 10x average)',
    'Ledger writes: each charge produces 2-4 balanced journal entries across its lifecycle (authorize, capture, settle, possible refund) -> ~1,500-2,000 ledger writes/sec at peak',
    'Webhook volume: each charge generates 1-3 inbound processor webhooks (auth confirmed, captured, settled) -> similar order of magnitude to charge volume',
    'Storage: ledger entries are small (~200 bytes) but append-only and never deleted - roughly 300GB/year at this volume, dominated by audit/compliance retention rather than raw byte size',
    'Payouts: nightly batch job aggregates ~50K merchants x avg 100 charges/day into a single netted payout transfer per merchant per payout cycle',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/payment_intents',
      description: 'Create a payment intent for a given amount/currency. Requires an Idempotency-Key header.',
      example:
        '// Headers\nIdempotency-Key: <client-generated uuid>\n\n// Body\n{ "amount": 4999, "currency": "usd", "merchant_id": "m_123", "payment_method": "pm_tok_abc" }\n\n// Response 201\n{ "id": "pi_1", "status": "requires_confirmation", "amount": 4999 }',
    },
    {
      method: 'POST',
      path: '/v1/payment_intents/:id/confirm',
      description: 'Confirm and authorize the payment intent against the card network / bank rail.',
      example: '// Response 200\n{ "id": "pi_1", "status": "requires_capture" }',
    },
    {
      method: 'POST',
      path: '/v1/payment_intents/:id/capture',
      description: 'Capture some or all of a previously authorized amount.',
      example: '// Body\n{ "amount_to_capture": 4999 }\n\n// Response 200\n{ "id": "pi_1", "status": "succeeded" }',
    },
    {
      method: 'POST',
      path: '/v1/refunds',
      description: 'Refund all or part of a captured charge.',
      example: '// Body\n{ "payment_intent": "pi_1", "amount": 1000 }\n\n// Response 201\n{ "id": "re_1", "status": "pending" }',
    },
    {
      method: 'GET',
      path: '/v1/payment_intents/:id',
      description: 'Fetch the current state and full transition history of a payment intent.',
      example: '// Response 200\nPaymentIntent',
    },
    {
      method: 'POST',
      path: '/v1/webhooks/processor',
      description: 'Inbound endpoint the payment processor calls with signed async events (authorized, captured, settled, disputed).',
      example: '// Headers\nStripe-Signature: t=1712345678,v1=<hmac>\n\n// Body\n{ "type": "charge.succeeded", "data": { "id": "ch_1" } }',
    },
    {
      method: 'GET',
      path: '/v1/merchants/:id/payouts',
      description: "Return a merchant's payout history and the schedule for the next payout.",
      example: '// Response 200\nPayout[]',
    },
  ],
  apiSecurityNote:
    'merchant_id and payment_method always resolve from an authenticated merchant/customer session, never a raw client-supplied balance. Raw card numbers never reach this API at all - the client tokenizes via a hosted field or SDK first, and payment_method is already an opaque token. Every write endpoint requires an Idempotency-Key. The inbound webhook endpoint trusts nothing without a verified signature, and replayed/stale events outside a 5-minute tolerance window are rejected.',

  highLevelDesignIntro:
    "Let's build this incrementally, in the order a real charge actually flows: get the card into the system without ever touching it ourselves, make every request retry-safe, split authorization from capture, make every lifecycle transition durable, record the money movement in a ledger, then handle the fact that the bank's real answer arrives on its own schedule.",

  builds: [
    {
      title: '1) Tokenize the Card Before It Ever Reaches Us',
      body:
        "The single most important architectural decision in a payment system happens before our backend sees a single byte of card data. The checkout page embeds a hosted iframe (Stripe Elements, Braintree Hosted Fields) or calls an SDK that talks DIRECTLY to the processor or a PCI-compliant vault. The raw card number (PAN) goes from the customer's browser straight to that vault - it never transits our servers at all.\n\nThe vault returns an opaque token (e.g. pm_tok_abc) that represents the card without exposing it. Our backend only ever stores and passes around this token. Even card networks have their own version of this: Visa Token Service and Mastercard's Digital Enablement Service issue \"network tokens\" that replace the PAN even at the network level, so a compromised token is useless outside the specific device/merchant pairing it was issued for.\n\nWhy this matters beyond security: it changes our PCI compliance tier. A merchant who never touches raw card data self-assesses under SAQ A, the lightest PCI questionnaire. A merchant who does handle raw PANs needs a full SAQ D assessment - audited infrastructure, network segmentation, the works. Tokenizing at the edge is not just safer, it is dramatically cheaper to operate.",
      insightCallout:
        "The token is scoped and single-purpose - pm_tok_abc might only be usable by our specific merchant account, for a limited time, or for a single charge, depending on how it was created. This is why you cannot \"steal\" a payment token the way you could steal a card number and use it anywhere.",
      newComponents: [
        {
          name: 'Hosted Card Fields (Client SDK)',
          description: 'An iframe or SDK embedded in the checkout page that captures card details and sends them directly to the vault - never through our servers.',
        },
        {
          name: 'PCI-Compliant Tokenization Vault',
          description: 'Either the processor itself or a dedicated vault (Basis Theory, VGS) that stores the raw PAN and hands back an opaque, scoped token.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  customer["Customer Browser"]:::client
  fields["Hosted Card Fields"]:::client
  vault["Tokenization Vault"]:::edge
  api["Payment API"]:::compute
  db[("Payments DB<br/>stores token only")]:::database
  customer -->|"1. Enters card"| fields
  fields -->|"2. Raw PAN direct"| vault
  vault -->|"3. Returns token"| fields
  fields -->|"4. Submits token"| api
  api -->|"5. Persist token reference"| db`,
      },
      closingNote:
        'Once the card is safely reduced to a token, the next problem shows up immediately: what happens if the request to charge that token times out and the client retries?',
    },
    {
      title: '2) Idempotent Payment Intent Creation',
      body:
        "A checkout page that retries a failed request is not a bug, it is expected client behavior - mobile networks drop, load balancers time out connections, users double-tap \"Pay\" out of anxiety. Without protection, every one of those retries is a second charge for the same order.\n\nStripe's real design is the reference here: every state-changing POST requires an Idempotency-Key header, a client-generated UUID scoped to one logical operation. The server stores a mapping of (merchant API key, idempotency key) -> the full response it returned the first time, for 24 hours. A retry with the same key does not re-execute the charge - it replays the exact original response, including the original HTTP status code.\n\nCritically, Stripe also rejects a key reused with DIFFERENT parameters (e.g. same key, different amount) with a 400 error, because silently ignoring the new amount would be worse than failing loudly - it prevents a subtle bug in a client's retry logic from becoming a silent wrong-amount charge.\n\nConcurrency matters too: if two requests with the same key arrive within milliseconds of each other (a real scenario - double-tap), the second request must not race ahead and create a second Payment Intent before the first one has finished. We take out a short-lived lock (SET NX PX 30000 in Redis) on the idempotency key for the duration of processing; a concurrent request with the same key blocks or returns 409 rather than proceeding independently.",
      insightCallout:
        "The idempotency guarantee is a request-level cache with a lock, not just a database unique constraint. A unique constraint alone stops a permanent duplicate row, but two concurrent requests can both get past a check-then-insert race before either commits - you need the lock AND the constraint.",
      newComponents: [
        {
          name: 'Idempotency Store (Redis + Postgres)',
          description: 'Redis holds the short-lived processing lock; Postgres holds the durable (merchant, idempotency_key) -> response mapping for 24 hours.',
        },
        {
          name: 'Payment Service',
          description: 'Owns the Payment Intent lifecycle. Checks idempotency before doing any work with side effects, including before calling the processor.',
        },
      ],
      diagram: {
        mermaid: `flowchart TD
  req["POST payment_intents<br/>Idempotency-Key: k1"]:::client
  lock{"Acquire lock on k1?"}:::compute
  cached{"Response already cached for k1?"}:::compute
  replay["Replay cached response"]:::cache
  create["Create Payment Intent<br/>proceed with charge"]:::compute
  reject["409 request in progress"]:::client
  req --> lock
  lock -->|"1. Yes new key"| cached
  cached -->|"2. No first time"| create
  cached -->|"3. Yes"| replay
  lock -->|"4. No already locked"| reject`,
      },
      closingNote:
        'With retries safe, we can finally talk to the bank. The next question is whether we should take the money right now, or just PROMISE to take it and settle the details later.',
    },
    {
      title: '3) Authorize Now, Capture Later',
      body:
        "A charge is not one action, it is two: authorization (the bank puts a HOLD on the customer's funds and confirms they exist) and capture (we actually claim that held amount). Splitting them matters because a lot of real business logic depends on the gap between them.\n\nAn e-commerce order authorizes the card at checkout (proving the customer can pay and reserving the funds) but only captures when the item actually ships - sometimes days later. If the item is out of stock, we simply let the authorization expire (typically 7 days for most card networks) instead of capturing and then refunding, which avoids refund fees and keeps the customer's statement clean.\n\nUnder the hood, our Processor Adapter translates our internal \"authorize this token for $49.99\" into whatever format the specific rail expects. The processor forwards this to the card network (Visa/Mastercard/etc.), which routes it to the customer's issuing bank. The issuing bank checks funds/credit limit and either approves or declines, and that decision flows back through the network and processor to us - typically within a second or two, even though under the hood it crossed three or four separate companies' infrastructure.\n\nCapture is a separate call, days later, referencing the same authorization. It tells the processor \"actually take the money now\" - this is what starts the clock on the funds actually moving toward settlement.",
      newComponents: [
        {
          name: 'Processor Adapter',
          description: 'Translates our internal authorize/capture calls into the specific API format each payment processor (Stripe, Razorpay, a bank\'s direct API) expects.',
        },
        {
          name: 'Card Network / Issuing Bank',
          description: "External infrastructure we never operate ourselves - the card network routes the authorization request to the customer's own bank, which actually approves or declines it.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  api["Payment Service"]:::compute
  adapter["Processor Adapter"]:::compute
  proc["Payment Processor"]:::edge
  network["Card Network"]:::edge
  issuer["Issuing Bank"]:::edge
  api -->|"1. Authorize token for 49.99"| adapter
  adapter -->|"2. Forward auth request"| proc
  proc -->|"3. Route to network"| network
  network -->|"4. Route to issuer"| issuer
  issuer -->|"5. Approve or decline"| network
  network -->|"6. Propagate result"| proc
  proc -->|"7. Propagate result"| adapter
  adapter -->|"8. Authorized, funds held"| api`,
      },
      closingNote:
        "Authorize and capture are two of at least five states a real payment intent moves through. If we track that with a single status column, we lose the ability to answer \"what actually happened, and when\" - we need a real state machine.",
    },
    {
      title: '4) The Payment State Machine Makes Every Transition Durable',
      body:
        'Every payment intent moves through a small, well-defined set of states, and every transition between them must be a durable, individually-recorded event - not just an overwrite of a status column. This mirrors how Stripe models its own PaymentIntent object.\n\ncreated -> requires_confirmation (customer attached a payment method, not yet sent to the bank) -> requires_action (a 3D Secure challenge is required - the customer needs to approve in their banking app) -> authorized / requires_capture (bank held the funds) -> captured/succeeded (we claimed the funds) -> settled (funds actually landed in our bank account, sometimes 1-3 days later) -> refunded or disputed (money moves back out) or failed/canceled (declined, expired, or abandoned).\n\nEach transition is written as its own row in a payment_events table (payment_intent_id, from_state, to_state, caused_by, occurred_at) in addition to updating the current-state column on the payment_intents row - both writes happen in one DB transaction. Why bother with the event log if we already have current state? Because "authorized -> captured" and "authorized -> canceled -> re-authorized -> captured" tell very different stories about the same order, and a support agent, an auditor, or a reconciliation job needs to replay exactly what happened, not just where it ended up.\n\nEvery transition also enforces a legal-transitions table - trying to capture an already-refunded intent is rejected, not silently ignored, because the calling code needs to know its assumption about the object\'s state was wrong.',
      newComponents: [
        {
          name: 'Payment State Machine',
          description: "Enforces legal transitions between states and writes each transition as its own durable event, not just an in-place status update.",
        },
      ],
      diagram: {
        mermaid: `stateDiagram-v2
  [*] --> created
  created --> requires_confirmation: payment method attached
  requires_confirmation --> requires_action: 3D Secure needed
  requires_confirmation --> authorized: bank approves directly
  requires_action --> authorized: customer completes challenge
  authorized --> captured: capture requested
  captured --> settled: funds land in our bank
  requires_confirmation --> failed: bank declines
  authorized --> canceled: hold expires unclaimed
  settled --> refunded: refund issued
  settled --> disputed: chargeback raised
  failed --> [*]
  canceled --> [*]
  refunded --> [*]`,
      },
      closingNote:
        'With every transition durable, we can finally ask the deeper question a wallet never has to: how do we record the actual movement of money in a way that survives an audit, when half of that money briefly belongs to a bank we do not control?',
    },
    {
      title: "5) Double-Entry Ledger for Money That Isn't Ours Yet",
      body:
        "A wallet's ledger tracks money moving between accounts inside your own system. A payment system's ledger has to track something trickier: money that is PROMISED by a bank but not yet actually in our account, and money we owe a merchant that we have not paid out yet. A single balance field cannot represent any of this correctly.\n\nWe borrow the same double-entry discipline: every money movement is a journal entry containing two or more balanced lines (debits = credits), posted against a chart of accounts. For a payment system the accounts look like: acquirer_receivable (an asset - money the processor has confirmed but not yet wired to us), merchant_payable (a liability - what we owe a specific merchant), platform_fees_revenue (our cut), refunds_payable, and chargeback_reserve (funds held back against future disputes).\n\nA $49.99 charge that just got captured posts: DEBIT acquirer_receivable $49.99, CREDIT merchant_payable $47.55, CREDIT platform_fees_revenue $2.44 (our take rate). Nothing has actually moved between real bank accounts yet - this entry just declares what we now owe whom. When the processor's settlement webhook confirms funds actually landed in our bank days later, a second entry posts: DEBIT cash_in_bank $49.99, CREDIT acquirer_receivable $49.99 - clearing the receivable now that the promise became real cash.\n\nThis two-step recording is exactly why \"just credit the merchant immediately\" is wrong: merchant_payable already reflects what we owe them from the moment of capture, completely independent of whether the underlying cash has actually cleared - which is precisely the separation that lets us pay merchants on a fast, predictable schedule while the slower bank settlement catches up behind the scenes.",
      insightCallout:
        "acquirer_receivable is the single most important account in this whole design. It is the ledger's honest admission that \"the processor said yes\" and \"the money is actually in our bank\" are two different facts, separated by real time - and conflating them is how naive systems end up overpaying merchants for charges that later bounce.",
      newComponents: [
        {
          name: 'Ledger Service',
          description: 'Posts balanced journal entries for every state transition that moves money. Refuses to commit an entry whose debits and credits do not sum to zero.',
        },
        { name: 'Postgres (ledger primary)', description: 'ACID store for journal_entries and ledger_lines. Append-only - entries are never updated or deleted, only ever added.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  capture["Capture: 49.99"]:::compute
  je1["Journal Entry 1<br/>debit acquirer_receivable 49.99<br/>credit merchant_payable 47.55<br/>credit platform_fees_revenue 2.44"]:::database
  settle["Settlement webhook confirms cash"]:::async
  je2["Journal Entry 2<br/>debit cash_in_bank 49.99<br/>credit acquirer_receivable 49.99"]:::database
  capture -->|"1. Post promise"| je1
  settle -->|"2. Post cash clearing"| je2
  je1 -->|"3. Same account cleared"| je2`,
      },
      closingNote:
        "The ledger above assumed the settlement webhook eventually arrives and tells the truth. In reality, webhooks get lost, arrive twice, or arrive in the wrong order - and that gap is where real payment systems earn their reputation.",
    },
    {
      title: '6) Async Settlement and the Webhook Problem',
      body:
        "Authorization happens in about a second. Settlement - the processor actually wiring net funds to our bank - happens hours to days later, on the processor's own batch schedule. We learn about it the same way we learn about a bank's decision on any async event: a webhook.\n\nThe processor POSTs a signed event to our public webhook endpoint when something changes state on their end (charge.succeeded, charge.captured, charge.dispute.created). We verify the signature (HMAC-SHA256 over \"timestamp.payload\", matching Stripe's Stripe-Signature header format) and reject anything outside a 5-minute tolerance window, which defeats replay attacks using an intercepted old payload.\n\nBut a webhook is a best-effort delivery, not a guarantee. The processor's servers can fail mid-delivery, our endpoint can be down during a deploy, or a load balancer can drop the connection after the processor already considers the event delivered. If we only ever react to webhooks, a lost one means we never learn a charge settled - and merchant_payable stays stuck as an unpaid liability forever.\n\nThe backstop is a Reconciler: a scheduled job that polls the processor's own settlement/reporting API for anything we have not heard about, and diffs it against our ledger. Razorpay's own engineering describes exactly this pattern at scale for India's UPI rail, where success can be confirmed well after the customer-facing response. The reconciler is also how we catch out-of-order webhooks - a captured event that somehow arrives after a disputed event for the same charge needs to be evaluated against the CURRENT state, not blindly applied.",
      insightCallout:
        'Rail truth always wins over our own assumption. If our internal state says "authorized" but the processor\'s settlement report says the charge never actually cleared, the reconciler\'s job is to trust the report and correct our ledger - not the other way around.',
      newComponents: [
        {
          name: 'Webhook Handler',
          description: "Verifies signatures and timestamps on inbound processor events before publishing them internally. The only thing standing between us and a forged \"charge succeeded\" event.",
        },
        {
          name: 'Reconciler',
          description: "A scheduled job that polls the processor's settlement reports for anything we have not received a webhook for, and corrects our ledger to match the processor's ground truth.",
        },
      ],
      diagram: {
        mermaid: `flowchart TD
  proc["Payment Processor"]:::edge
  wh["Webhook Handler"]:::compute
  verify{"Signature and timestamp valid?"}:::compute
  bus["Event Bus"]:::async
  rec["Reconciler<br/>polls settlement reports"]:::compute
  ledger["Ledger Service"]:::compute
  proc -->|"1. POST signed webhook"| wh
  wh --> verify
  verify -->|"2. Valid"| bus
  verify -->|"3. Invalid - discard"| drop["Rejected"]:::client
  rec -->|"4. Poll for missed events"| proc
  rec -->|"5. Publish reconciled event"| bus
  bus -->|"6. Post journal entry"| ledger`,
      },
      closingNote:
        'Once the ledger reflects reality, we still have to tell three other systems about it - order fulfillment, merchant notifications, and analytics - without wrapping a bank webhook and three service calls in one fragile distributed transaction.',
    },
    {
      title: '7) Outbox + Saga: Coordinating Payment, Ledger, and Notifications',
      body:
        "A single charge succeeding needs to trigger several side effects across service boundaries: the order service should mark the order as paid, the notification service should email a receipt, and analytics should log the event. None of these live in the same database as the ledger, so we cannot wrap them all in one ACID transaction.\n\nThe outbox pattern solves the \"did the ledger write actually happen\" half of the problem: in the SAME database transaction that posts the journal entry, we insert a row into an outbox table describing the event (payment.captured, payment_intent_id, amount). A change-data-capture process (Debezium reading the Postgres WAL) drains that outbox table into Kafka. Either the ledger entry and the outbox row both commit, or neither does - there is no window where the ledger says \"captured\" but no event was ever queued.\n\nThe saga pattern solves the \"what if a downstream step fails\" half: each consumer (order service, notification service) processes the event independently and, if a step can legitimately fail (e.g. the order service refuses to mark an order paid because it was already canceled), it publishes a compensating event (payment.capture_unconfirmed) that triggers a refund saga rather than leaving the charge and order in permanently inconsistent states.\n\nWhy not just call the other services synchronously from inside the payment request? Because a slow or down notification service would then be capable of failing a customer's checkout - the one thing that must never happen is a downstream side effect blocking the core money-movement path.",
      newComponents: [
        {
          name: 'Outbox Table',
          description: 'Written in the same transaction as the ledger entry, guaranteeing the event is captured if and only if the ledger write committed.',
        },
        {
          name: 'Debezium (CDC) + Kafka',
          description: 'Streams committed outbox rows to downstream consumers without the payment path ever calling them directly.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  ledger["Ledger Service"]:::compute
  db[("Postgres<br/>journal entry + outbox row<br/>one transaction")]:::database
  cdc["Debezium CDC"]:::async
  kafka["Kafka"]:::async
  orders["Order Service"]:::compute
  notif["Notification Service"]:::compute
  analytics["Analytics"]:::async
  ledger -->|"1. Commit entry and outbox row"| db
  db -->|"2. Stream WAL"| cdc
  cdc -->|"3. Publish event"| kafka
  kafka -->|"4. Mark order paid"| orders
  kafka -->|"5. Send receipt"| notif
  kafka -->|"6. Log event"| analytics`,
      },
      closingNote:
        'With the money movement correctly recorded and fanned out, one deceptively simple bug remains - what data type we use to store "$49.99" in the first place.',
    },
    {
      title: '8) Money as Integers: Currency and Rounding Correctness',
      body:
        'Never store money as a floating-point number. 0.1 + 0.2 does not equal 0.3 in IEEE 754 floating point, and a payment system that accumulates rounding error across millions of transactions will eventually fail an audit over pennies that provably do not exist.\n\nThe fix: store every amount as an integer in the currency\'s smallest unit - cents for USD (4999 means $49.99), paise for INR, but critically NOT every currency uses two decimal places. JPY has zero minor units (¥500 is stored as 500, not 50000), and a handful of currencies (Bahraini Dinar, Kuwaiti Dinar) use three. We keep a small ISO 4217 lookup table of currency -> minor-unit-exponent and apply it consistently everywhere money is displayed, stored, or compared - never inferred ad hoc at each call site.\n\nRounding shows up again the instant we split a captured amount between merchant_payable and platform_fees_revenue - a 2.9% fee on $49.99 (4999 cents) is 144.971 cents, which is not a whole number of cents. We define a single, consistent rounding rule (round-half-up, applied at the platform_fees_revenue side) and apply it in exactly one place, because a fee calculation that rounds differently depending on which code path computed it is indistinguishable from a bug that\'s slowly stealing or leaking fractions of a cent at scale.',
      closingNote:
        'Every mechanism so far assumes the charge itself was legitimate. The last build handles the case where it might not be - before we ever call the bank.',
    },
    {
      title: '9) Fraud and Risk Scoring on the Request Path',
      body:
        'Every payment intent creation is also, silently, a fraud-risk decision. Before we forward a charge to the processor, a risk service scores the request using signals available in milliseconds: device fingerprint, IP-to-billing-address mismatch, velocity (how many charges has this card/device attempted in the last hour), BIN lookup (does this card range have unusually high dispute rates), and whether this exact card has been declined recently elsewhere on the platform.\n\nA low-risk score proceeds straight to authorization. A medium-risk score triggers a step-up challenge - 3D Secure, which redirects the customer to their bank\'s own authentication flow (a passcode, biometric, or banking-app approval) before the authorization is allowed to proceed; this is also a regulatory requirement (PSD2/SCA) for many EU transactions regardless of risk score. A high-risk score is declined before it ever reaches the processor, saving both the processor fee and the future chargeback risk.\n\nThis check must run cheaply and synchronously in the request path - typically a call to a pre-computed risk model (a service like Stripe Radar) that returns a score in tens of milliseconds, not a batch job. Getting this wrong in either direction is expensive: too strict and you decline good customers (lost revenue, worse than a chargeback); too lax and disputed charges eventually get reversed anyway, at a real dollar chargeback fee on top of the lost goods.',
      insightCallout:
        'Fraud scoring changes the shape of the state machine: requires_action is not just for 3D Secure by the bank\'s choice - our OWN risk service can force a step-up even when the bank would have approved without one.',
      closingNote:
        "That's the full build-up: tokenize at the edge, make every request idempotent, split authorize from capture, track every transition durably, ledger the money as it's promised and then as it clears, coordinate side effects through an outbox instead of a fragile cross-service transaction, keep money as integers, and screen for fraud before the bank ever sees the request.",
    },
  ],

  coreFlows: [
    {
      title: 'Successful Charge: Authorize, Capture, Settle',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Customer
  participant API as Payment Service
  participant IDE as Idempotency Store
  participant RISK as Risk Service
  participant PROC as Payment Processor
  participant DB as Ledger (Postgres)
  participant WH as Webhook Handler

  C->>API: POST payment_intents Idempotency-Key
  API->>IDE: acquire lock and check cache
  IDE-->>API: first attempt, proceed
  API->>RISK: score this request
  RISK-->>API: low risk, proceed
  API->>PROC: authorize token for amount
  PROC-->>API: authorized, funds held
  API->>DB: write state transition to authorized
  API->>PROC: capture amount
  PROC-->>API: captured
  API->>DB: post journal entry, debit acquirer_receivable
  API-->>C: 200 succeeded
  Note over PROC,WH: hours later, processor settles funds
  PROC->>WH: webhook charge.settled signed
  WH->>DB: post journal entry, clear acquirer_receivable`,
      },
      nonObviousFailure:
        'If the risk service times out, the safe default is NOT to fail open (skip the check) - a slow fraud check should degrade to a stricter fallback (require 3D Secure) rather than silently letting every request through during the outage.',
    },
    {
      title: 'Payment Declined at Authorization',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Customer
  participant API as Payment Service
  participant PROC as Payment Processor
  participant NET as Card Network
  participant ISS as Issuing Bank
  participant DB as Ledger

  C->>API: POST payment_intents confirm
  API->>PROC: authorize token for amount
  PROC->>NET: route authorization
  NET->>ISS: forward to issuer
  ISS-->>NET: insufficient funds decline
  NET-->>PROC: declined with reason code
  PROC-->>API: declined
  API->>DB: write state transition to failed
  API-->>C: 402 declined with reason`,
      },
      nonObviousFailure:
        'A decline is still a durable state transition with a reason code, not a silent no-op - customers retry with a different card and merchants need decline analytics, so "failed" carries the same audit weight as "succeeded."',
    },
    {
      title: 'Delayed Webhook: Reconciliation Catches a Missed Settlement',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant PROC as Payment Processor
  participant WH as Webhook Handler
  participant REC as Reconciler
  participant DB as Ledger

  PROC--xWH: webhook charge.settled lost in transit
  Note over DB: acquirer_receivable stays open, merchant_payable unpaid
  loop every few hours
    REC->>PROC: pull settlement report
  end
  PROC-->>REC: charge ch_1 settled at 09:14 UTC
  REC->>DB: charge ch_1 has no matching settlement event
  REC->>DB: post journal entry, clear acquirer_receivable
  REC->>DB: mark reconciled, no ticket needed`,
      },
      nonObviousFailure:
        "The reconciler must be idempotent against the webhook handler too - if the lost webhook eventually arrives late AFTER the reconciler already fixed the ledger, applying it again must be a safe no-op, not a second clearing entry that overstates settled cash.",
    },
  ],

  deepDives: [
    {
      title: 'Idempotency Keys: Making Retries Truly Safe',
      problem:
        "A checkout button that gets double-tapped, or a mobile client that times out and retries after the charge already succeeded on our end, is not an edge case - it happens on every single busy checkout page. Getting this wrong means real customers get charged twice for one order.",
      bad:
        'No idempotency mechanism at all - every POST to /charge is executed as a brand-new charge. A dropped response after a successful charge guarantees a duplicate on the client\'s inevitable retry. This is the single most common way early-stage payment integrations accidentally double-charge customers.',
      good:
        'Client-side dedup only - the checkout page disables the pay button after one click and keeps a local flag. This helps the common case but is not a real guarantee: a page refresh, a second device, or a buggy retry in a completely different part of the client code bypasses it entirely. The server has no memory of the request at all.',
      simpleTerms:
        'The client sends a unique key with every payment request. If the exact same key shows up again (a retry), the server returns the SAME result it returned the first time instead of charging again. Different key = genuinely new charge.',
      great:
        "Server-side idempotency, exactly as Stripe implements it: the client generates a UUID once per logical operation and sends it as an Idempotency-Key header. The server takes a short-lived lock on (merchant, key), checks a durable store for a cached response, and if found, replays it byte-for-byte including the original status code - no new charge is attempted. If the same key arrives with DIFFERENT request parameters (a different amount, say), the server rejects it with an error rather than guessing which one was \"right\" - silently picking one would be more dangerous than failing loudly. The cached response expires after 24 hours, long enough to cover any realistic retry window, short enough not to accumulate unbounded storage. Concurrent requests with the same key while the first is still in flight are blocked (or return 409) rather than racing ahead independently.",
    },
    {
      title: "Double-Entry Ledger: Why a Balance Column Isn't Enough",
      problem:
        "Finance asks: \"why does our bank statement show $12,400 less than what we think we owe merchants this month?\" With a single running-balance column, there is no way to answer this - you have a number, not a history.",
      bad:
        "A single amount_owed column per merchant, incremented on capture and decremented on payout. Fast to read, but a race between two concurrent captures can corrupt it, there is no record of WHICH charges contributed to the current total, and refunds/disputes/fees all have to be jammed into the same one field with ad-hoc sign conventions.",
      good:
        "A flat transactions table logging {merchant_id, amount, type, timestamp} for every capture, refund, and fee. Balance is computed as SUM(amount) grouped by merchant and type. This is auditable at the merchant level, but still does not model where the money is in its OWN lifecycle - it cannot distinguish 'money the processor promised us' from 'money that actually cleared into our bank,' which is exactly the gap that causes payment systems to overpay merchants for charges that later bounce.",
      simpleTerms:
        'Every money movement writes two balanced lines - a debit on one account, a credit on another - never just one number changing. Because debits must always equal credits, it is mathematically impossible to create or lose money by accident, and every balance is just the sum of its history, not a stored fact.',
      great:
        "A full chart of accounts with balanced journal entries, extended specifically for the fact that money here is often only a bank's PROMISE, not cash yet: acquirer_receivable (asset - processor confirmed, not yet wired to us), cash_in_bank (asset - actually settled), merchant_payable (liability - owed to a specific merchant), platform_fees_revenue, refunds_payable, and chargeback_reserve. A capture posts DEBIT acquirer_receivable / CREDIT merchant_payable + platform_fees_revenue. A later settlement webhook posts DEBIT cash_in_bank / CREDIT acquirer_receivable - clearing the promise into real cash. A dispute posts DEBIT merchant_payable / CREDIT chargeback_reserve, pulling the disputed amount out of what we're willing to pay the merchant until it resolves. Every one of finance's questions becomes a query against this ledger instead of a mystery: 'how much do we owe merchant X right now' is SUM(merchant_payable lines for X), 'how much cash is still in flight from the processor' is the acquirer_receivable balance, and a $12,400 discrepancy is traceable to the exact journal entries that produced it.",
    },
    {
      title: "Webhooks You Can't Fully Trust: Signature Verification and Reconciliation",
      problem:
        "Our webhook endpoint is a public URL on the internet. Anyone who discovers it can POST a fake \"charge.succeeded\" event and, if we trust it blindly, get free goods shipped against a charge that never actually happened.",
      bad:
        "Trust any POST to the webhook endpoint that looks like valid JSON with the right shape. Trivially forgeable - an attacker who finds the endpoint URL (often guessable, e.g. /webhooks/stripe) sends a fabricated success event and we act on it as if the bank actually approved a real charge.",
      good:
        "Require a shared secret in a custom header, checked with a simple string comparison. Better than nothing, but a non-constant-time string comparison leaks timing information an attacker can exploit to guess the secret byte-by-byte, and a static shared secret cannot prove the payload itself was not tampered with in transit - only that SOME request had the header.",
      simpleTerms:
        'The processor signs every webhook with a secret only it and we know, by hashing the timestamp and the exact payload together. We recompute that same hash on our side and check it matches AND that the timestamp is recent, so a copied-and-replayed old event is also rejected.',
      great:
        "HMAC-SHA256 signature verification over the raw, unparsed request body - matching Stripe's real Stripe-Signature header design of t=<timestamp>,v1=<hmac>. We recompute HMAC-SHA256(webhook_secret, \"{timestamp}.{raw_body}\") and compare it to v1 using a constant-time comparison, and separately reject anything where the timestamp is more than 5 minutes old, which defeats replay of a captured old payload. Using the RAW body bytes (not a re-serialized JSON object) matters because re-serialization can reorder keys or change whitespace, changing the byte string and breaking the signature even for a genuine event - a subtle bug that shows up as \"random\" webhook failures.\n\nSignature verification alone is not sufficient, though - it proves the event is genuinely from the processor, not that we RECEIVED every event the processor sent. That is what the Reconciler is for: a scheduled job that polls the processor's own settlement/reporting API and diffs it against our internal ledger, catching events lost to a downtime window, a deploy, or a network partition, and correcting our ledger to match the processor's ground truth rather than leaving a permanently stuck acquirer_receivable balance.",
    },
    {
      title: 'Fraud Scoring and the Chargeback Lifecycle',
      problem:
        "A stolen card gets used to buy $2,000 of goods. Weeks later the real cardholder disputes the charge with their bank, and the merchant loses both the goods AND the $2,000, plus a chargeback fee - unless the risk scoring caught it before authorization, or the dispute evidence process wins the case after the fact.",
      bad:
        'No fraud checks and no dispute process at all - authorize every request that has a valid-looking token, and when a chargeback notice arrives, simply eat the loss with no evidence submission. Guaranteed to attract fraud rings once discovered, since the platform becomes the easiest target on the internet to launder stolen cards through.',
      good:
        "Static rule-based fraud checks (block if billing country != IP country, block if more than 3 attempts on one card in an hour) plus a manual chargeback response process where someone on the team gathers evidence by hand when a dispute notice arrives. Catches the obvious cases and satisfies a baseline dispute-response obligation, but static rules are trivially probed and worked around by anyone testing the boundaries, and manual dispute handling does not scale past a handful of cases a week.",
      simpleTerms:
        "A risk model scores every charge attempt in milliseconds using signals like device fingerprint and how many times this card has been tried recently. Risky charges get an extra bank-side identity check (3D Secure) or are blocked outright. If a customer’s bank later disputes a charge anyway, we have a fixed window to submit evidence (delivery proof, IP logs) proving the charge was legitimate.",
      great:
        "A real-time ML risk score (the same category of system as Stripe Radar) evaluated synchronously on the request path in tens of milliseconds, using device fingerprinting, IP/billing mismatch, card velocity, and BIN-level dispute-rate history, feeding a three-way decision: allow, step-up to 3D Secure (also a PSD2/SCA regulatory requirement in the EU regardless of score), or decline outright before the processor is even called.\n\nOn the other end of the lifecycle, a dispute is its own durable state machine, not just a support ticket: disputed (issuer notifies us via the card network, funds provisionally reversed into chargeback_reserve) -> evidence_submitted (merchant/platform uploads proof - shipping confirmation, signed receipt, IP/device match - within a strict 7-21 day window set by the card network) -> won (funds released back to merchant_payable) or lost (the reversal becomes permanent and a chargeback fee posts as its own ledger entry). Because every one of these is a ledger-affecting event, a merchant’s payable balance always reflects current reality - money temporarily pulled into chargeback_reserve during an active dispute, then released or permanently written off once the card network rules.",
    },
  ],

  selfAudit: [
    { question: 'How do you prevent double-charging on retry?', answer: "Client-supplied Idempotency-Key, server caches the full response for 24h and rejects key reuse with different params." },
    { question: 'Why split authorize and capture?', answer: 'Funds get held immediately but only claimed when the business event (e.g. shipping) actually happens, avoiding needless refunds.' },
    { question: 'Where does the raw card number live?', answer: "Nowhere on our servers - a hosted field/SDK tokenizes it directly with a PCI-compliant vault, we only ever see the token." },
    { question: 'How do you know money actually moved?', answer: 'A double-entry ledger separates acquirer_receivable (promised) from cash_in_bank (settled) - two distinct journal entries, not one.' },
    { question: 'What if a settlement webhook is lost?', answer: 'A reconciler polls the processor\'s settlement reports on a schedule and corrects the ledger to match rail truth.' },
    { question: 'How do you trust an inbound webhook?', answer: 'HMAC-SHA256 signature over timestamp + raw body, rejecting anything outside a 5-minute tolerance window.' },
    { question: 'Why not store amounts as floats?', answer: 'Floating point rounding error compounds at scale; store integer minor units (cents) with a per-currency exponent table instead.' },
    { question: 'How do you coordinate order/notification updates?', answer: 'Outbox row written in the same DB transaction as the ledger entry, drained via CDC to Kafka - no synchronous cross-service call.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  CHECKOUT["Checkout Page"]:::client
  FIELDS["Hosted Card Fields"]:::client
  VAULT["Tokenization Vault"]:::edge

  GW["API Gateway"]:::edge
  API["Payment Service"]:::compute
  IDE[("Redis + Postgres<br/>idempotency store")]:::cache
  RISK["Risk Service"]:::compute
  ADAPT["Processor Adapter"]:::compute
  LEDGER["Ledger Service"]:::compute

  PROC["Payment Processor"]:::edge
  NETWORK["Card Network / Issuing Bank"]:::edge

  DB[("Postgres<br/>ledger + payment_events")]:::database
  OUTBOX[("Outbox table")]:::database
  CDC["Debezium CDC"]:::async
  KAFKA["Kafka"]:::async

  WH["Webhook Handler"]:::compute
  REC["Reconciler"]:::compute

  ORDERS["Order Service"]:::compute
  NOTIF["Notification Service"]:::compute
  ANALYTICS["Analytics"]:::async
  PAYOUT["Payout Batch Job"]:::compute
  MERCHBANK["Merchant Bank Account"]:::edge

  CHECKOUT -->|"Enters card"| FIELDS
  FIELDS -->|"Raw PAN direct"| VAULT
  VAULT -->|"Returns token"| FIELDS
  FIELDS -->|"Submits token + Idempotency-Key"| GW
  GW -->|"Forward to payment svc"| API

  API -->|"Check and lock idempotency key"| IDE
  API -->|"Score request"| RISK
  API -->|"Authorize / capture token"| ADAPT
  ADAPT -->|"Forward to processor"| PROC
  PROC -->|"Route to network / issuer"| NETWORK

  API -->|"Write state transition"| DB
  API -->|"Post journal entry"| LEDGER
  LEDGER -->|"Write entry + outbox row"| OUTBOX
  DB -->|"Stream WAL"| CDC
  CDC -->|"Publish events"| KAFKA
  KAFKA -->|"Mark order paid"| ORDERS
  KAFKA -->|"Send receipt"| NOTIF
  KAFKA -->|"Log event"| ANALYTICS

  PROC -->|"Signed async webhook"| WH
  WH -->|"Verify signature"| LEDGER
  REC -->|"Poll settlement reports"| PROC
  REC -->|"Correct ledger"| DB

  PAYOUT -->|"Aggregate merchant_payable"| DB
  PAYOUT -->|"Net transfer"| MERCHBANK`,
  },

  keyTechnologies: [
    {
      term: 'Idempotency Key',
      definition: 'A client-generated UUID attached to a payment request so retries replay the original response instead of executing the operation again.',
    },
    {
      term: 'PCI DSS Tokenization',
      definition: 'Replacing a raw card number with an opaque token at the edge, keeping raw card data off our servers entirely and reducing compliance scope to SAQ A.',
    },
    {
      term: 'Payment State Machine',
      definition: 'The durable set of states (created, authorized, captured, settled, refunded, failed) a payment intent moves through, with every transition recorded as its own event.',
    },
    {
      term: 'Double-Entry Ledger',
      definition: 'Accounting model where every money movement posts a balanced debit + credit pair, making every balance a computed, auditable sum rather than a stored fact.',
    },
    {
      term: 'Webhook Signature (HMAC)',
      definition: "A hash computed over a timestamp and the raw payload using a shared secret, letting the receiver verify a callback genuinely came from the processor and was not replayed.",
    },
    {
      term: 'Reconciliation Job',
      definition: "A scheduled process that diffs internal records against an external system's report to catch lost, duplicated, or out-of-order events.",
    },
    {
      term: 'Outbox Pattern',
      definition: 'Writing an event row in the same DB transaction as the state change it describes, then draining it via CDC - guarantees the event is never lost or double-published relative to the write.',
    },
    {
      term: '3D Secure (SCA)',
      definition: "A bank-side authentication step (passcode, biometric, app approval) inserted into checkout for risky transactions, and a regulatory requirement (PSD2) in the EU.",
    },
  ],

  expectedDepth: {
    mid:
      'Design a basic charge flow: accept a card, call a payment processor, store the result. Understand why raw card numbers should never be stored, and propose an idempotency key to avoid double-charging on client retries. Recognize that authorization and settlement are not the same instant.',
    senior:
      'Propose the authorize/capture split and a durable state machine instead of a single status column. Design a double-entry ledger distinguishing money the processor has promised from money that has actually settled into the bank. Explain webhook signature verification and why a reconciliation job is required even with reliable-seeming webhooks. Use the outbox pattern to coordinate order/notification updates without a cross-service transaction.',
    staffPlus:
      'Address multi-processor routing and failover (if Stripe is degraded, route new charges to a backup processor without breaking idempotency guarantees tied to the first one). Discuss real-time fraud scoring economics (false declines cost more than most fraud losses) and the regulatory dimension of 3D Secure/SCA. Cover payout batching and netting at scale, chargeback reserve modeling, and how ledger correctness is verified continuously (not just via nightly reconciliation) as transaction volume scales into the millions per day.',
  },

  keyTakeaways: [
    'Tokenize the card at the edge - raw PANs should never reach our own servers, which also shrinks our PCI compliance burden.',
    'Idempotency keys make retries safe: same key replays the exact original response; same key with different params is rejected.',
    'Authorize and capture are separate steps, and every lifecycle transition is a durable, individually-recorded event, not a status overwrite.',
    'A double-entry ledger distinguishes money a processor has promised (receivable) from money that has actually settled (cash) - a single balance column cannot.',
    'Webhooks are best-effort, not guaranteed - always pair them with a reconciliation job that polls the processor\'s own settlement truth.',
    'Store money as integer minor units with a per-currency exponent table; floating point and ad hoc rounding rules both eventually cause real, auditable discrepancies.',
  ],

  relatedDesigns: ['digital-wallet', 'stock-broker', 'ride-sharing', 'food-delivery'],
  relatedConcepts: [
    { name: 'Idempotency', description: 'The core guarantee that makes retried payment requests safe to send more than once.' },
    { name: 'Event Sourcing & CQRS', description: "The payment state machine's event log is the source of truth; current state is a derived projection." },
    { name: 'Saga Pattern', description: 'Coordinates side effects (orders, notifications) across services without a shared cross-service transaction.' },
    { name: 'Distributed Locking', description: 'Guards concurrent requests carrying the same idempotency key from racing each other.' },
    { name: 'Webhooks & Async Integration', description: "How external processors report outcomes on their own schedule instead of within our request/response cycle." },
  ],

  simulator: {
    goalDescription: 'Charge a card idempotently, record the money movement in a durable ledger, and fan out side effects without blocking the checkout response.',
    requirementChips: ['P99 < 2s authorization', 'Idempotent retries', '~2K ledger writes/sec peak'],
    targetRps: 2000,
    readRatio: 0.3,
    cacheHitRatio: 0.1,
    latencyBudgetMsP99: 2000,
    rubric: [
      { id: 'payment-compute-tier', label: 'Compute tier for the payment service', kind: 'requires-node-type', nodeType: ['app-server', 'microservice'] },
      { id: 'idempotency-cache', label: 'Redis-backed idempotency store for safe retries', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'ledger-db', label: 'Durable ACID store for the double-entry ledger', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'outbox-bus', label: 'Event bus for outbox/CDC fan-out to downstream consumers', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'no-ledger-spof', label: 'No single point of failure on the ledger write path', kind: 'no-spof' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 15, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 10, position: { x: 880, y: 280 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 6, position: { x: 1160, y: 280 } },
        { id: 'worker-1', type: 'worker', instanceCount: 8, position: { x: 1440, y: 280 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-pg-kafka', source: 'pg-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The idempotency store (Redis) makes retried charge requests safe to replay, while the Postgres ledger is the durable, double-entry source of truth. Committed ledger writes stream out via CDC into Kafka so order/notification/reconciliation consumers never sit on the synchronous charge path.',
    failureModeNarratives: {
      postgresql:
        'The ledger is modeled as a single Postgres primary on the write path for every charge, capture, and refund. If it becomes unavailable, no money movement can be durably recorded and the outbox stops emitting events entirely, stalling every downstream consumer even though they themselves are healthy.',
    },
    fullDesignLinkSlug: 'payment-system',
  },
}

export default topic
