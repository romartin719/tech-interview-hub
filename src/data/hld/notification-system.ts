import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'notification-system',
  title: 'Notification System',
  difficulty: 'Intermediate',
  icon: 'pi pi-bell',
  color: '#f59e0b',
  readTimeMinutes: 42,
  topics: [],
  companies: [],
  prerequisites: ['Message Queues', 'Fan-Out', 'Caching'],
  summary:
    'A multi-channel notification platform that delivers push, SMS, email, and in-app messages. Backend services emit events ("order confirmed") to Kafka; the notification service consumes these, renders a template, picks the channel based on user preferences, and dispatches. Delivery tracking, retries, and send-time optimization ensure messages reach users when they\'re most likely to engage.',

  understandingProblem:
    "A notification system lets product surfaces across a company send messages to users across multiple channels - push (mobile), email, SMS, in-app - without every team re-implementing delivery, preferences, retries, and rate limiting. The system must handle billions of events per day, respect user preferences, dedupe noisy senders, and prove delivery.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  app[Product Service]:::client
  ns[Notification Sender]:::compute
  db[("Users DB")]:::database
  apns["APNs / FCM / SES / Twilio"]:::edge
  app --> ns
  ns --> db
  ns --> apns`,
    },
    whyThisBreaks: [
      'One synchronous hop - if APNs is slow, the product service blocks. A single downstream hiccup freezes every checkout / signup / message-send.',
      'No retries - APNs drops a packet, the user never hears back. No receipt, no replay.',
      "No user preferences - customer unsubscribed from marketing but still gets marketing. Legal problem (GDPR, CAN-SPAM), trust problem.",
      'No rate limiting - batch job fires a million sends in a minute, exceeds APNs quota, APNs throttles us for everyone.',
      "No deduplication - two product teams both decide to welcome the user; they get two welcomes.",
      'No quiet hours - user in Sydney gets a 3am push.',
      "No observability - something failed for 10% of users today. Which 10%? We don't know.",
    ],
    closingNote:
      'The rest of the doc evolves this into a queue-based, multi-channel, preference-aware notification platform.',
  },

  priorArt: [
    {
      title: 'Uber Consumer Communication Gateway (CCG)',
      description:
        "Central intelligence layer that manages quality, ranking, timing, and frequency of push notifications at the per-user level. Introduced after Uber hit 15+ hours a week of manual coordination trying to keep internal teams from stepping on each other. (Uber Engineering blog)",
      link: 'https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/',
    },
    {
      title: 'Airbnb Notification Platform',
      description:
        'Channel abstraction + per-user preference service, feeding multiple providers. Treats the sender API as a single pipe regardless of channel.',
      link: 'https://medium.com/airbnb-engineering/airbnbs-promotions-and-communications-platform-6266f1ffe2bd',
    },
    {
      title: 'LinkedIn Air Traffic Control',
      description:
        'Deduping + frequency capping layer that rides on top of all outbound member communications to prevent over-notification.',
      link: 'https://www.linkedin.com/blog/engineering/messaging-notifications/air-traffic-controller-member-first-notifications-at-linkedin',
    },
    {
      title: 'Stripe Webhooks',
      description:
        'The canonical "reliable delivery via outbox + retry" pattern that applies directly to transactional notifications: persist before send, deliver asynchronously, expose attempt history.',
      link: 'https://docs.stripe.com/webhooks',
    },
    {
      title: 'Courier, Braze, OneSignal, SendGrid',
      description:
        'Commercial templates for how this kind of platform is exposed to product teams: a single send(user, template, data) API on top of a multi-channel router.',
    },
  ],

  coreEntities: [
    { name: 'Notification', description: 'One logical message intended for a user, with a template ID, variables, channels, and priority.' },
    { name: 'User', description: 'The recipient. Has channel identifiers (device tokens, email, phone), preferences, locale, time zone.' },
    { name: 'Template', description: 'A channel-specific content template with variable interpolation.' },
    { name: 'Preference', description: 'Per-user, per-category, per-channel opt-in/out. Quiet hours.' },
    { name: 'Delivery Attempt', description: 'One try to hand off a notification to a channel provider. Status: SENT / DELIVERED / FAILED / THROTTLED.' },
    { name: 'Campaign', description: '(Optional) A batch of notifications sharing a template, targeting a segment.' },
    { name: 'Channel Provider', description: 'APNs, FCM, SES, Twilio, etc. Adapter per provider.' },
  ],

  requirements: {
    core: [
      'Send a notification to a user through one or more channels (push, email, SMS, in-app) given a template ID and template variables.',
      'Respect user preferences - channel opt-ins, category opt-ins (marketing vs transactional), quiet hours, locale.',
      'Guaranteed at-least-once delivery with retries for transient failures, and exposed per-attempt status for debugging.',
    ],
    belowTheLine: [
      'Rich content creation (images, carousels, deeplink generation).',
      'Campaign management UI / marketer console.',
      "ML-driven send-time optimization (Uber CCG's specialty - we'll mention it but not build it).",
      'Reply handling (SMS 2-way conversations).',
      'Delivery receipts beyond what the provider returns.',
      'Cost optimization (provider routing for cheapest path).',
      'Per-tenant isolation (if multi-tenant SaaS).',
      'Compliance reports (TCPA/GDPR opt-in audit trails).',
    ],
    nonFunctionalTable: [
      { metric: 'Scale', target: '1B notifications/day peak, ~50k/sec sustained, bursts to 500k/sec (campaign).' },
      { metric: 'Latency', target: 'Transactional (OTP, security): P95 end-to-end < 5s. Marketing: P95 < 5 min.' },
      { metric: 'Reliability', target: 'At-least-once delivery, no silent loss. Acceptable duplicate rate < 0.1%.' },
      { metric: 'Multi-region', target: 'Failover; user in EU hits EU stack.' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Notification / Outbox Store',
      purpose: 'Notification intent, template ID, state, dedupKey',
      primaryPick: 'Postgres (day-partitioned, outbox pattern)',
      alternatives: 'MySQL, CockroachDB, Aurora',
      whyPrimaryWins: 'ACID within a single send plus an outbox row Debezium can tail - the API returns in ~5ms even during a 500K/sec campaign burst',
    },
    {
      tier: 'Delivery Attempts',
      purpose: 'Per-provider send/receipt history for debugging "did they get it?"',
      primaryPick: 'Postgres (monthly-partitioned)',
      alternatives: 'Cassandra at very high rates, DynamoDB with TTL',
      whyPrimaryWins: 'Indexed by notification_id for O(1) support lookups; partitioning keeps the hot table small as attempt volume grows',
    },
    {
      tier: 'Preference Store',
      purpose: 'Channel/category opt-ins, quiet hours, locale',
      primaryPick: 'Postgres + Redis cache',
      alternatives: 'DynamoDB + DAX',
      whyPrimaryWins: 'Every one of 50K sends/sec triggers a preference lookup - Redis drops that from milliseconds to microseconds and keeps the load off Postgres',
    },
    {
      tier: 'Event Backbone',
      purpose: 'Notification lifecycle events (requested, routed, sent)',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Google Pub/Sub, Pulsar',
      whyPrimaryWins: 'Absorbs burst traffic so a slow provider never becomes product-service slowness; per-channel consumer groups scale independently and events are replayable',
    },
    {
      tier: 'Delayed / Scheduled Queue',
      purpose: 'Quiet-hours deferral and scheduled sends',
      primaryPick: 'Redis sorted set (ZADD / ZRANGEBYSCORE poller)',
      alternatives: 'SQS, RabbitMQ, Kafka timer-topic wheel',
      whyPrimaryWins: 'O(log N) insert and O(log N + k) poll scales to hundreds of millions of scheduled notifications with a simple one-second scheduler tick',
    },
    {
      tier: 'Template Store',
      purpose: 'Versioned, localized message templates',
      primaryPick: 'Object storage (S3) + Postgres metadata',
      alternatives: 'Git-backed templates',
      whyPrimaryWins: "Immutable versions never go stale in cache (24h TTL is safe), and marketers publish new copy without an engineering deploy",
    },
  ],
  technologyChoicesNote:
    "Why Postgres over Cassandra for the notification and preference stores? At current scale (~100K notifications/sec, 50K preference lookups/sec), Postgres gives ACID guarantees, indexed point lookups, and relational queries an admin console can use - Cassandra only starts winning past roughly 10B sends/day, where append-only writes beat Postgres's write-ahead log. Kafka anchors the event backbone because per-partition ordering and full replay mean a buggy Push Worker deploy gets fixed by reprocessing yesterday's topic instead of losing data.",

  scaleEstimation: [
    'Users: 500M DAU, generating events across all product surfaces',
    'Write QPS: 100K notifications/sec peak (5B notifications/day across 3 channels)',
    'Read QPS: 50K preference lookups/sec, 10K status queries/sec',
    'Storage: ~2TB notification metadata/year (attempts + audit trail)',
    'Bandwidth: ~10 Gbps outbound to providers at peak campaign burst',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/notifications',
      description:
        'Send a notification to a user through one or more channels. Requires an Idempotency-Key header and a service JWT.',
      example:
        '// Request\n{\n  "userId": "u_1293847",\n  "templateId": "order_shipped_v3",\n  "variables": { "orderId": "A-88273", "trackingUrl": "https://tr.ck/X7Y8Z", "carrier": "BlueDart" },\n  "channels": ["PUSH", "EMAIL"],\n  "category": "TRANSACTIONAL",\n  "priority": "HIGH",\n  "dedupKey": "order-A-88273-shipped",\n  "deeplink": "myapp://orders/A-88273",\n  "overrides": { "sendAt": null, "expireAt": "2026-05-05T10:00:00Z" }\n}\n\n// Response 202 Accepted\n{ "notificationId": "n_7a3f2e91", "state": "ACCEPTED", "createdAt": "2026-05-04T12:01:33.412Z" }',
    },
    {
      method: 'GET',
      path: '/v1/notifications/:id',
      description: 'Get status and delivery attempts for a notification (support / debugging).',
      example:
        '// Response 200\n{\n  "id": "n_7a3f2e91",\n  "userId": "u_1293847",\n  "templateId": "order_shipped_v3",\n  "state": "DELIVERED",\n  "category": "TRANSACTIONAL",\n  "attempts": [\n    { "channel": "PUSH", "provider": "APNs", "status": "SENT", "at": "2026-05-04T12:01:33.900Z", "providerResp": "200 APNs accepted" },\n    { "channel": "PUSH", "provider": "APNs", "status": "DELIVERED", "at": "2026-05-04T12:01:34.102Z", "receipt": "apns-receipt-abc" },\n    { "channel": "EMAIL", "provider": "SES", "status": "SENT", "at": "2026-05-04T12:01:34.200Z", "providerResp": "250 OK" },\n    { "channel": "EMAIL", "provider": "SES", "status": "OPENED", "at": "2026-05-04T12:04:11.512Z", "userAgent": "Mail.app iOS 17" }\n  ]\n}',
    },
    {
      method: 'GET',
      path: '/v1/users/:id/preferences',
      description: "Fetch a user's channel/category opt-ins, quiet hours, and frequency caps.",
      example:
        '// Response 200\n{\n  "userId": "u_1293847",\n  "channels": { "PUSH": true, "EMAIL": true, "SMS": false, "IN_APP": true },\n  "categories": {\n    "TRANSACTIONAL": { "enabled": true, "channels": ["PUSH","EMAIL","SMS"] },\n    "SECURITY": { "enabled": true, "channels": ["PUSH","EMAIL","SMS"] },\n    "MARKETING": { "enabled": false, "channels": ["EMAIL"] }\n  },\n  "quietHours": { "start": "22:00", "end": "07:00", "timezone": "Asia/Kolkata" },\n  "frequencyCaps": { "MARKETING": 5, "SOCIAL": 20 },\n  "locale": "en-IN"\n}',
    },
    {
      method: 'PUT',
      path: '/v1/users/:id/preferences',
      description: "Update a user's notification preferences (channel opt-ins, quiet hours, frequency caps, locale).",
      example: '// Request body: same Preference shape as the GET response',
    },
    {
      method: 'POST',
      path: '/v1/users/:id/devices',
      description: 'Register a push device token for a user.',
      example: '// Request\n{ "deviceToken": "apns-token-base64=", "platform": "IOS", "appVersion": "12.3.0", "timezone": "Asia/Kolkata" }',
    },
    {
      method: 'DELETE',
      path: '/v1/users/:id/devices/:token',
      description: 'Revoke a device token (app uninstall, logout, or a permanent provider rejection).',
    },
    {
      method: 'POST',
      path: '/v1/campaigns',
      description: 'Create a marketing campaign targeting a segment, with rate limits and optional send-time optimization.',
      example:
        '// Request\n{\n  "name": "diwali_offers_2026",\n  "templateId": "promo_diwali_v1",\n  "segment": { "query": "country=IN AND active_last_7d=true AND age BETWEEN 18 AND 34" },\n  "scheduledAt": "2026-10-28T09:00:00+05:30",\n  "rateLimit": { "perSec": 20000, "perMin": 600000 },\n  "useSendTimeOptimization": true\n}',
    },
    {
      method: 'WSS',
      path: '/v1/users/:id/stream',
      description: 'Real-time subscription for in-app notifications. Server pushes JSON frames as notifications fire.',
      example: '// Server push frame\n{ "type": "notification", "id": "n_7a3f2e91", "title": "Your order shipped", "body": "...", "at": "2026-05-04T12:01:33.412Z" }',
    },
  ],
  apiSecurityNote:
    "All HTTP APIs require service JWT; product services pass the end-user's ID as data, not identity. The /stream WebSocket uses the end-user's JWT - authenticates the subscriber against the userId in the path. Templates are pre-approved and versioned; raw text body isn't accepted from callers to prevent content injection and compliance bypass. Device tokens stored encrypted at rest; tokens rotate when app reinstalls. Idempotency key is scoped per (service, key) and kept 24h in Redis.",

  highLevelDesignIntro: "We'll grow the architecture in three passes - one per core functional requirement.",

  builds: [
    {
      title: 'FR1: Send a Notification Through Multiple Channels',
      body:
        'Start with the minimum viable pipeline: accept, enqueue, fan out per channel, dispatch to the provider.',
      insightCallout:
        'Kafka here acts as a buffer - if push notifications are slow today, the queue absorbs the backlog instead of slowing down the checkout flow that triggered the notification.',
      newComponents: [
        {
          name: 'Notification API',
          description:
            'The single entry point for all product services. Receives "send a notification to user X" requests, validates them, and enqueues for processing.',
        },
        {
          name: 'Message Broker (Kafka)',
          description: 'Decouples notification intake from delivery.',
        },
        {
          name: 'Router',
          description:
            'Reads each notification event, decides which channels to use (push? email? SMS?), and fans out one message per channel to channel-specific topics.',
        },
        {
          name: 'Channel Workers (Push, Email, SMS)',
          description:
            "Each specialized worker renders the template and calls the external provider. Isolated so a Twilio outage doesn't affect push delivery.",
        },
        {
          name: 'External Providers (APNs, SES, Twilio)',
          description:
            "The actual delivery services. We don't send emails ourselves - we hand them to SES/Mailgun, which handles the SMTP complexity. FCM (Firebase Cloud Messaging) and APNs (Apple Push Notification Service) are the only way to send push notifications to Android and iOS devices respectively - your server can't push directly to phones, it must go through these gateways.",
        },
      ],
      diagram: {
        mermaid: `flowchart TD
  app[Product Service]:::client
  api[Notification API]:::edge
  q["Message broker<br/>Kafka"]:::async
  route[Router]:::compute
  push[Push Worker]:::compute
  email[Email Worker]:::compute
  sms[SMS Worker]:::compute
  apns["APNs / FCM"]:::edge
  ses["SES / Mailgun"]:::edge
  twil[Twilio]:::edge

  app -->|"1. POST notification request"| api
  api -->|"2. Enqueue for routing"| q
  q -->|"3. Route by channel"| route
  route -->|"4. Deliver via push"| push
  route -->|"5. Deliver via email"| email
  route -->|"6. Deliver via SMS"| sms
  push -->|"7. Send via APNs FCM"| apns
  email -->|"8. Render template"| ses
  sms -->|"9. Render template"| twil`,
      },
      steps: [
        'Order Service calls POST /v1/notifications -> "Hey, order A-88273 shipped, tell the user via push + email"',
        "Notification API validates the payload, looks up the user's preferences and locale, and persists the intent to a notifications table (audit + dedup)",
        'API publishes an event to Kafka and returns 202 Accepted in ~20ms - the product service is free to move on',
        'Router consumes the event, checks template rules + user preferences, and fans out: one message to push topic, one to email topic',
        'Push Worker picks up its message, renders the template in the user\'s locale ("Your order has shipped! 📦"), and POSTs to APNs/FCM',
        'Provider response (accepted/rejected) is recorded as a delivery attempt for debugging ("why didn\'t my user get their notification?")',
      ],
      closingNote:
        "Why async? The product service call path has a strict latency budget (checkout is running). Hitting APNs synchronously is a timebomb - provider slowness becomes product slowness. Enqueueing gives us 10-50ms end-to-end on the hot path; the actual send happens on the worker's clock.\n\nWhy persist before publish? Safety net. If the broker is down, we still have the row. A reconciler sweeps notifications stuck in PENDING_PUBLISH and re-publishes.",
    },
    {
      title: 'FR2: Respect User Preferences',
      body:
        'Preferences live in a dedicated service. Both the Notification API (at intake) and the Router (before fan-out) consult it.\n\nWhat preferences capture: channel opt-ins (SMS: off, Email: on, Push: on); category opt-ins (Marketing: off, Transactional: always on - legally required in many jurisdictions, Security: always on); quiet hours (per-user time window in local time - non-urgent notifications during quiet hours get deferred to a delayed queue, urgent ones like security/fraud/OTP bypass); locale + time zone (for template localization and quiet-hour computation); and a frequency cap (max N marketing notifications per day).',
      newComponents: [
        {
          name: 'Preference Service',
          description:
            'Owns all user notification settings: which channels are on/off, which categories they\'ve opted out of, quiet hours, locale, and frequency caps. This is the "do not disturb" brain - it prevents us from waking someone at 3am with a marketing push.',
        },
        {
          name: 'Preference Cache (Redis)',
          description:
            'Since every single notification triggers a preference lookup (50K/sec!), we cache preferences in Redis for microsecond reads instead of hammering Postgres.',
        },
        {
          name: 'Preference DB (Postgres)',
          description: 'The durable source of truth for preferences. Updated when users change settings.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  api[Notification API]:::edge
  route[Router]:::compute
  prefs[Preference Service]:::compute
  prefdb[("Postgres<br/>user_preferences")]:::database
  prefcache[("Redis<br/>pref cache")]:::cache

  api -->|"1. Load user preferences"| prefs
  route -->|"2. Check user preferences"| prefs
  prefs -->|"3. Lookup cached prefs"| prefcache
  prefcache -. miss .-> prefdb`,
      },
      steps: [
        'Router receives the event: "send MARKETING notification to user U via PUSH and EMAIL"',
        "Router asks Preference Service: \"What are U's notification preferences?\"",
        'Preference Service checks Redis cache (hit 99% of the time) -> returns preferences',
        "Router filters: user has Marketing=on, Push=on, Email=on - both channels stay. If they'd opted out of Marketing, the notification would be silently dropped here",
        "Router checks quiet hours: user's timezone says it's 2:30am -> enqueue to a delayed queue that will fire at 7am when quiet hours end. (Security and transactional notifications bypass quiet hours - your OTP still arrives at 3am)",
        'Router checks frequency cap: "user got 4/5 marketing notifications today" - still under the limit, proceed',
        'Fans out to the push and email channel topics',
      ],
      closingNote:
        'Why cache preferences in Redis? Every notification triggers a preference lookup. 50k/sec sustained = 50k/sec reads minimum. Postgres can do it, but Redis drops the latency from millis to microseconds and takes load off the DB for campaigns.\n\nWrite path: user updates prefs -> API writes Postgres -> invalidates Redis entry (write-through not worth the complexity; read-through handles the miss).',
    },
    {
      title: 'FR3: Guaranteed At-Least-Once Delivery with Retries',
      body:
        'Channel workers own the retry logic. The key mechanism is the outbox pattern between provider state and our own DB.',
      insightCallout:
        'Exponential backoff means: wait 2s, then 10s, then 60s, then 5min before each retry. This prevents hammering a struggling provider.',
      newComponents: [
        {
          name: 'Retry Queue (delayed Kafka topic)',
          description:
            'When a provider returns a transient error (timeout, 5xx, rate-limit 429), the failed message goes here with exponential backoff timing.',
        },
        {
          name: 'Dead Letter Queue (DLQ)',
          description:
            'Where permanently-failed messages go after exhausting all retries. These get reviewed by a human or an automated reconciler.',
        },
        {
          name: 'Delivery Attempts table (Postgres)',
          description:
            'Records every single attempt to deliver a notification, including the provider\'s response. Essential for debugging "why didn\'t user X get their OTP?"',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  push[Push Worker]:::compute
  apns[APNs]:::edge
  attempt[("Postgres<br/>delivery_attempts")]:::database
  retry["Retry Queue<br/>delayed topic"]:::async
  dlq[Dead Letter Queue]:::async

  push -->|"1. Send via APNs FCM"| apns
  push -->|"2. Record delivery attempt"| attempt
  push -.timeout or 5xx.-> retry
  retry -->|"3. Retry delivery"| push
  push -.permanent failure.-> dlq`,
      },
      steps: [
        'Read from channel topic.',
        'Render template with user variables + locale.',
        'POST to provider (APNs / SES / Twilio) with a timeout (2s for push, 5s for email/SMS).',
        'Write a delivery_attempts row: status (SENT / FAILED / THROTTLED), provider response code, timestamp.',
        'Classify the outcome: Success -> commit Kafka offset, move on. Transient failure (5xx, timeout, 429 throttle) -> publish to a delayed retry topic with exponential backoff (2s -> 10s -> 60s -> 5min -> 30min; max 5 retries). Permanent failure (400 bad token, invalid phone) -> revoke the token in our user device table, send to DLQ.',
      ],
      closingNote:
        "Why not just retry forever? Permanent failures (invalid device token, phone number doesn't exist) will never succeed no matter how many times we retry. Sending to DLQ and revoking the bad token prevents infinite loops and keeps the queue healthy. Transient failures (provider overloaded) usually resolve within minutes, so retries with backoff are the right call.\n\nWhy at-least-once, not exactly-once? Distributed systems can't do exactly-once delivery across a network boundary - only at-least-once + idempotency on the receiving side. The Idempotency-Key header upstream and the dedupKey on the notification row let us detect dups on retry. Providers also dedupe on apns-collapse-id / FCM collapse_key - we pass our notification ID as collapse key so a retry doesn't produce two banners on the device.\n\nWhy persist every attempt? Debugging (\"why didn't my user get the OTP?\") requires per-attempt receipts. When someone files a ticket, ops need to see the exact provider response.\n\nDLQ ownership: a sweeper runs every 5 minutes, reviews DLQ messages, and either retries with longer backoff, or surfaces to a human dashboard after N tries.",
    },
  ],

  coreFlows: [
    {
      title: 'Flow 1: Transactional Send (OTP)',
      diagram: {
        mermaid: `sequenceDiagram
    actor User
    participant AuthSvc as Auth Service
    participant NotifAPI as Notification API
    participant DB as Postgres
    participant Kafka
    participant Router
    participant Prefs as Preference Svc
    participant Worker as SMS Worker
    participant Twilio
    participant Attempts as attempts table

    AuthSvc->>NotifAPI: POST /notifications (OTP, category=SECURITY)
    NotifAPI->>DB: INSERT notification + outbox
    DB-->>NotifAPI: id
    NotifAPI-->>AuthSvc: 202 accepted (id)
    DB-->>Kafka: CDC -> notification.requested
    Kafka->>Router: consume
    Router->>Prefs: get prefs(userId)
    Prefs-->>Router: prefs (security always-on, ignore quiet hours)
    Router->>Kafka: publish sms.transactional (renderedPayload)
    Kafka->>Worker: consume
    Worker->>Twilio: POST /Messages
    alt success
        Twilio-->>Worker: 201
        Worker->>Attempts: INSERT status=SENT
    else transient 5xx
        Twilio-->>Worker: 503
        Worker->>Attempts: INSERT status=FAILED
        Worker->>Kafka: publish retry with backoff
    end`,
        bullets: [
          'Auth service calls the Notification API with the OTP template and category=SECURITY.',
          'API writes the notification and its outbox entry in one transaction.',
          'It returns 202 in under 20ms - the user sees "code sent" immediately.',
          'CDC picks up the commit and publishes to Kafka.',
          'Router consults Preference Service. Security overrides quiet hours and marketing opt-out.',
          'Router fans out to sms.transactional (high-priority topic).',
          'SMS worker renders and hits Twilio with a 5s timeout.',
          'On success, we record the attempt; on 5xx, we retry with exponential backoff; on 4xx we mark permanent failure and alert.',
        ],
      },
      nonObviousFailure:
        "Twilio webhooks tell us 15s later the SMS was actually undelivered (number disconnected). The reconciler joins the webhook to our delivery_attempts, flips the status to UNDELIVERED, and notifies Auth Service via its own outbound webhook so it can offer the user an alternate channel.",
    },
    {
      title: 'Flow 2: Marketing Campaign Send (10M Users)',
      diagram: {
        mermaid: `sequenceDiagram
    participant Marketer
    participant CampaignAPI
    participant SegBuilder as Segment Builder
    participant DB as Postgres
    participant Kafka
    participant Router
    participant ATC as Policy (ATC)
    participant Prefs
    participant DelayQ as Redis ZSET
    participant Worker as Push Worker
    participant APNs

    Marketer->>CampaignAPI: POST /campaigns (segment, templateId)
    CampaignAPI->>SegBuilder: resolve segment -> user IDs
    SegBuilder-->>CampaignAPI: 10M user IDs (stream)
    CampaignAPI->>DB: bulk COPY notifications + outbox
    DB-->>Kafka: CDC (batched)
    loop per user
        Kafka->>Router: consume
        Router->>Prefs: get prefs
        Prefs-->>Router: marketing=on, quiet=22-07 in Sydney
        alt in quiet hours
            Router->>DelayQ: ZADD readyAt=7am-Sydney
        else not in quiet hours
            Router->>ATC: check dedup + freq cap
            ATC-->>Router: allowed
            Router->>Kafka: push.marketing
            Kafka->>Worker: consume
            Worker->>APNs: POST /push (rate-limited bucket)
            APNs-->>Worker: 200
        end
    end
    Note over DelayQ,Router: scheduler polls every 1s<br/>ZRANGEBYSCORE 0 now`,
        bullets: [
          'Marketer calls CampaignAPI with a segment definition (e.g., "Indian users, 18-34, active in last 7 days").',
          'Segment Builder streams the user IDs out of the user data warehouse.',
          'CampaignAPI bulk-writes notifications using COPY - seconds, not minutes.',
          'CDC streams events to Kafka in order.',
          'Router consults prefs + ATC for each. Users in quiet hours get deferred via Redis ZSET.',
          'Rate-limited workers drain the topic, respecting APNs throughput caps.',
          'Failures -> retry topic with backoff.',
        ],
      },
      nonObviousFailure:
        'Campaign writes succeed, CDC is behind by 10 minutes. We don\'t block. Marketer sees "campaign queued" because the row is committed; the delay is at most CDC lag, which alerting monitors. Acceptable for marketing.',
    },
    {
      title: 'Flow 3: User Updates Preferences',
      diagram: {
        mermaid: `sequenceDiagram
    actor User
    participant App as Mobile App
    participant PrefAPI as Preference API
    participant DB as Postgres
    participant Cache as Redis
    participant Kafka

    User->>App: toggle marketing off
    App->>PrefAPI: PUT /users/:id/preferences
    PrefAPI->>DB: UPDATE preferences
    PrefAPI->>Cache: DEL user:prefs:{id}
    PrefAPI->>Kafka: publish preference.changed
    PrefAPI-->>App: 200
    Note over Kafka: downstream ATC listens<br/>to reset per-user counters`,
        bullets: [
          'App calls PUT.',
          'Preference API updates Postgres.',
          'Invalidates Redis cache (next read rebuilds).',
          "Publishes a preference.changed event - downstream consumers (ATC, counters) can react.",
          'Returns 200.',
          'Within milliseconds of the update, the next notification fan-out sees the new preference on cache miss -> DB hit -> re-cache.',
        ],
      },
    },
    {
      title: "Notification Lifecycle (State Machine)",
      diagram: {
        mermaid: `stateDiagram-v2
    [*] --> ACCEPTED
    ACCEPTED --> QUEUED: published to Kafka
    QUEUED --> DEFERRED: in quiet hours
    DEFERRED --> QUEUED: wake up
    QUEUED --> SUPPRESSED: policy drop
    QUEUED --> DISPATCHING: worker picks up
    DISPATCHING --> SENT: provider 200
    DISPATCHING --> RETRYING: transient failure
    RETRYING --> DISPATCHING: backoff elapsed
    RETRYING --> FAILED: retries exhausted
    SENT --> DELIVERED: provider receipt
    SENT --> UNDELIVERED: provider receipt (failure)
    FAILED --> [*]
    SUPPRESSED --> [*]
    DELIVERED --> [*]
    UNDELIVERED --> [*]`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Hot Write Path: Notification Intake at Scale',
      problem:
        'Product teams send 500K notification requests per second during peak (flash sales, morning digests). The system that receives these must not become the bottleneck.',
      simpleTerms:
        'Imagine 500K "send this notification" requests arriving every second. If each one requires a database write before responding, the database melts. We need a way to accept requests instantly and process them asynchronously.',
      bad: 'Product service inserts directly into notifications + publishes to Kafka + writes an audit log. Three writes on the critical path. At 500k/sec burst, the DB is the bottleneck.',
      good:
        'Notification API does one insert with INSERT ... RETURNING id, then publishes. Two writes, still DB-bound. Campaigns that fire 10M sends in a minute still melt Postgres.',
      great:
        'Outbox + CDC: Notification API writes one row in Postgres in a transaction that includes the event payload in an outbox table. Debezium / logical replication tails the WAL and emits to Kafka - exactly once from WAL to Kafka. The product-facing API returns immediately after the DB commit (~5ms). Campaign batch writer uses COPY FROM to bulk-insert millions of rows in seconds.',
      diagram: {
        mermaid: `flowchart LR
  api[Notification API]:::edge
  db[("Postgres<br/>notifications + outbox")]:::database
  cdc[Debezium]:::async
  kafka[Kafka]:::async
  route[Router]:::compute

  api -->|"1. Persist notification"| db
  db -->|"2. CDC stream"| cdc
  cdc -->|"3. Stream changes"| kafka
  kafka -->|"4. Route by channel"| route`,
      },
    },
    {
      title: 'Fan-Out Amplification: One Event to N Devices',
      problem:
        "A single logical notification can fan out to many devices per user (phone, tablet, desktop, kiosk), and campaigns multiply that across tens of millions of users - naive per-device handling either wastes work inline or floods the same user with redundant deliveries.",
      bad:
        'Router looks up a user\'s device tokens inline. User has 4 devices (phone, tablet, desktop, kiosk). Push worker fans out 4x. Fine for one user - not for a campaign that hits 50M users = 200M push sends.',
      good:
        "Router fans out once per device into the push topic. Each device is an independent delivery attempt. Works until we need to dedupe across devices for the same notification (e.g., user opens on phone, don't ring the tablet 30s later).",
      great:
        'Logical notification + per-device attempts + device-collapse: one notification row, N delivery_attempts rows. apns-collapse-id = notification_id: if the same notification retries, APNs replaces rather than stacking. A "read receipt" from the client marks the notification read and any still-pending retries are cancelled. For campaigns: partitioned bulk insert, each partition processes in parallel by a pool of Router workers.',
    },
    {
      title: 'Provider Throttling and Backpressure',
      problem:
        "A single unthrottled sender can exhaust a provider's rate limit for everyone - blasting APNs at max rate gets the whole tenant rate-limited, so legitimate transactional sends get 429'd alongside bulk marketing traffic.",
      bad: "Blast sends at APNs' max rate. APNs rate-limits the whole tenant, legitimate transactional sends also get 429'd.",
      good: 'Token bucket per provider, per channel. Workers pull from the channel topic only when a token is available.',
      great:
        "Weighted bucket + priority lanes: two topics per channel - push.transactional (high priority) and push.marketing (bulk). Transactional workers have higher bucket capacity and refill rate. Marketing workers share a smaller bucket, self-throttle. When provider returns 429, workers exponential-backoff the bucket refill rate for that provider - system-wide TTL'd override in Redis. Noisy-neighbor isolation: per-tenant token buckets on top of the per-provider limit, so one product team can't starve others.",
      diagram: {
        mermaid: `flowchart LR
  kafka1["push.transactional<br/>(high priority)"]:::async
  kafka2["push.marketing<br/>(bulk)"]:::async
  bucket1["Bucket: 10k/s"]:::compute
  bucket2["Bucket: 2k/s"]:::compute
  workers1[Txn Workers]:::compute
  workers2[Mkt Workers]:::compute
  apns[APNs]:::edge

  kafka1 -->|"1. Deliver"| bucket1
  bucket1 -->|"2. Read file"| workers1
  kafka2 -->|"3. Deliver"| bucket2
  bucket2 -->|"4. Read file"| workers2
  workers1 -->|"5. Deliver via APNs"| apns
  workers2 -->|"6. Deliver via APNs"| apns`,
      },
    },
    {
      title: 'Deduplication and Frequency Capping',
      problem:
        "Multiple product teams can independently trigger notifications for the same logical event, and marketing can over-notify a user without something tracking how many messages that user has already received.",
      bad: 'Two product teams both emit welcome_user for a new signup. User gets 2 welcomes.',
      good:
        "dedupKey on the notifications table with a unique constraint. Second insert fails -> second team's send is dropped. Works for exact dups.",
      great:
        'Air Traffic Control layer (from LinkedIn\'s playbook): a "policy check" step between Router and channel workers. Input: user ID, category, timestamp, content hash. Policies: Dedup - exact dedupKey match within last 24h -> drop. Frequency cap - <=5 marketing per day per user, counter in Redis (INCR notif:mkt:{userId}:2026-05-04 + EXPIRE). Category quota - no more than 3 "new review" notifications per hour. Global mute - user churned to quiet mode for N days -> all marketing dropped. Tokens live in Redis, sharded by user_id. Per-user consistency holds; cross-user global quotas use a separate counter. This is the layer Uber calls the CCG. It\'s where the ML logic for send-time optimization would eventually slot in.',
    },
    {
      title: 'Quiet Hours and Scheduled Delivery',
      problem:
        "Notifications need to be deferred until a user's quiet hours end (or until a specific scheduled time), and doing that with a blocking sleep or an ad hoc timer doesn't scale to millions of pending sends.",
      bad: 'Check quiet hours synchronously, if in-quiet-hours, Thread.sleep(untilSomeTime). Worker threads pile up.',
      good:
        'If in quiet hours, compute readyAt = end_of_quiet_hours_in_user_tz and insert into a delayed queue. A scheduler wakes up and re-injects when ready.',
      great:
        "Redis ZSET with a dequeue poller: ZADD delayed:notifications <readyAtEpoch> <notificationId>. A scheduler service polls every second: ZRANGEBYSCORE delayed:notifications 0 <now> LIMIT 0 1000. For each returned ID, re-publish to the channel topic and ZREM. O(log N) inserts, O(log N + k) poll where k = batch size. Scales to hundreds of millions of scheduled notifications. Alternatives: Kafka timer-topic tumbling wheel, DynamoDB TTL streams, SQS visibility timeout tricks - pick Redis for simplicity and latency, others if volumes push past a single Redis cluster. Edge case: user changes time zone mid-wait. Most teams let the scheduled time fire as originally computed (simplicity wins) rather than re-enqueue on preference change with the new tz (more accurate, more complex).",
    },
    {
      title: 'Observability and Delivery Proof',
      problem:
        'When a notification fails to reach a user, support and on-call need a fast, authoritative way to answer "did they get it, and why not" instead of grepping logs across a fleet of hosts.',
      bad: '"Did user X get their OTP?" - grep logs across 50 hosts. Hope someone logged what we need.',
      good: 'Structured logs in ELK. Search by notification_id.',
      great:
        "First-class attempt history + delivery webhooks + dashboards: the delivery_attempts table holds per-try status, indexed by notification_id for O(1) support lookups. Provider delivery callbacks (APNs feedback, SES SNS, Twilio webhook) write to an inbound_receipts table; a reconciler joins attempts to receipts to compute true delivery rate. Real-time dashboard: delivery rate per channel, per provider, per category, per locale, alerting on sudden drops. Backstop for lost webhooks: periodic /status poll for providers that support it (APNs Feedback Service); if we have a SENT attempt with no receipt after 30 min, we poll.",
    },
    {
      title: 'In-App Notifications in Real Time',
      problem:
        'In-app notifications need to reach the user immediately while they have the app open, without hammering the backend with per-client polling.',
      bad:
        'In-app notifications rely on polling. The mobile app hits GET /notifications?since=... every 30 seconds. Users see a 30-second lag; 1M DAUs = 33k req/sec of wasted polling.',
      good:
        'Server-sent events (SSE) over HTTP/2. The server keeps a unidirectional stream open; when a notification arrives for this user, the server writes a frame. SSE is one-way, text-only, and works through most proxies without configuration.',
      great:
        'WebSocket gateway with a presence layer + a fallback poll. How it works: (1) client opens a WebSocket to /v1/users/:id/stream - the load balancer uses consistent hashing on userId to pin the connection to a specific WS gateway node (sticky sessions), so a given user is always on the same node; (2) on connect, the WS gateway writes userId -> nodeId to Redis (TTL 30s, refreshed by heartbeat every 10s); (3) when the In-App Fan-out worker consumes a notification, it looks up the target user\'s nodeId in Redis - if present, it publishes to a Kafka topic keyed by node, and each WS gateway node consumes its own keyed partition and delivers to the live socket; (4) if nodeId is missing (user offline), the worker writes the notification to an "inbox" - a Redis list inbox:{userId} capped at 100 items plus a Postgres backup - and the app drains it on next connect; (5) a fallback poll every 60s to GET /notifications?since=<lastSeenId> acts as a safety net that catches anything lost to a transient WS hiccup. Why WS over SSE: bidirectional frames give us acknowledgments (client says "got it, showed badge"), and modern load balancers + browsers handle WebSocket fine; we can also multiplex multiple event types over one WS (notifications, typing indicators, presence). Scale numbers: a single modern WS gateway node handles 50k-100k open sockets - for 10M concurrent users, that\'s 100-200 gateway nodes behind a consistent-hash LB. Trade-off: sticky sessions complicate rolling deploys; mitigated with graceful drain, where a new deploy tells existing sockets to reconnect and they get routed to the new node via the LB.',
      diagram: {
        mermaid: `flowchart LR
  app[Mobile or Web]:::client
  lb[L4 Load Balancer]:::edge
  ws["WebSocket Gateway<br/>(sticky sessions)"]:::compute
  presence[("Redis<br/>presence: userId -> nodeId")]:::cache
  kafka["Kafka<br/>in-app topic"]:::async
  fanout[In-App Fan-out]:::compute

  app -->|"1. Connect WebSocket"| lb
  lb -->|"2. Route"| ws
  ws -->|"3. Register presence"| presence
  fanout -->|"4. Read from Kafka"| kafka
  kafka -->|"5. Push to WS gateway"| ws
  ws -->|"6. Push to client"| app`,
      },
    },
    {
      title: 'Template Service: Versioning, Localization, Rendering',
      problem:
        "Marketing copy changes constantly, needs localization per market, and shouldn't require an engineering deploy - or introduce injection risk when rendered against arbitrary user data.",
      bad: "Templates as hardcoded strings in worker code. Every copy change requires a deploy. Marketing can't iterate. Translators need a developer.",
      good: 'Templates in a database, fetched by ID at render time. Versioned. Marketing uses a console.',
      great:
        "Immutable template versions + pre-compiled renderer + per-locale cache. Model: a template has an ID, a version, a channel (PUSH / EMAIL / SMS / IN_APP), and a locale (en, hi-IN, ja-JP, etc). Each version is immutable - you don't edit v3, you publish v4. The templateId on a send request resolves to the current active version per locale; old versions remain queryable for rendering historical notifications correctly in the support UI. Publishing flow: (1) marketer drafts a template in the console; (2) console uploads the template file (Mustache/Handlebars/MJML for email) to object storage at templates/order_shipped_v4/en.mustache; (3) pre-flight validation checks that variables referenced in the template all exist in a registered variableSchema, catching typos before a real send fails; (4) a compliance reviewer approves (required for MARKETING category); (5) activation is atomic - a Postgres row updates the active_version pointer for (templateId, locale). Render flow (from a channel worker): look up (templateId, userLocale) via Template Service; fetch the compiled template from Redis, falling back to S3 -> compile (parse Mustache to AST) -> cache on a miss; render with the user's variables and run output sanitization (HTML escape for email, length-cap for SMS, JSON-safe for push payload); return the rendered content to the worker. Caching: compiled template objects stay in Redis with a long TTL (24h) because versions are immutable, so there's no staleness risk - on activation the service bumps a global version number that workers check cheaply to detect new active versions. Locale fallback: hi-IN not found -> try hi -> try the template's declared default locale -> fail send; this all falls through Template Service so workers don't reinvent fallback logic. Why pre-compile: a template is parsed once per node per version, so subsequent renders are ~10-20 microseconds instead of parsing the template string each time - at 500k/sec we can't afford the parser on every send. Integration with channels: push renders to title + body + data payload capped at 4KB (APNs) / 4KB (FCM); email renders MJML into responsive HTML with a separate plain-text fallback; SMS renders to plain text, segmented if over 160 GSM characters; in-app renders to a structured JSON the client knows how to display.",
      diagram: {
        mermaid: `flowchart LR
  console[Marketing Console]:::client
  tmpl[Template Service]:::compute
  s3[("Object Storage<br/>template artifacts")]:::storage
  db[("Postgres<br/>template metadata")]:::database
  cache[("Redis<br/>compiled templates")]:::cache
  worker[Channel Worker]:::compute

  console -->|"1. Create campaign"| tmpl
  tmpl -->|"2. Load template from DB"| db
  tmpl -->|"3. Store rendered template"| s3
  worker -->|"4. Render notification"| tmpl
  tmpl -->|"5. Lookup cached template"| cache
  cache -. miss .-> s3`,
      },
    },
    {
      title: 'Send-Time Optimization (Uber CCG-Style)',
      problem:
        'Firing all marketing notifications immediately when a campaign is scheduled ignores when each individual user is actually likely to engage, so blanket sends waste attention and hurt open rates.',
      bad: 'All marketing fires immediately when the campaign is scheduled. Users get a 9am blast, half ignore it. Open rates tank.',
      good:
        'Default quiet hours + frequency cap. Better, but still one-size-fits-all. Your "marketing hits at 9am local" misses the user who opens the app at 7pm every day.',
      great:
        'Per-user send-time prediction + constrained ranking, in three layers. (1) Feature store: per-user features - open-rate-by-hour histogram, click-rate-by-hour, last-active-hour, timezone, days since last notification - updated in near real time from the engagement Kafka topic. (2) Send-time model: an offline-trained (weekly) gradient-boosted model that predicts P(open | user, hour-of-day, category); lightweight, ~KBs per user, serves in <1ms - for each incoming notification with useSendTimeOptimization=true, inference returns the best hour in the next 24h. (3) Ranker: multiple notifications compete for attention, so a per-user ranker runs a linear program (Uber\'s actual approach) that picks at most N notifications per day subject to category priority (transactional > security > social > marketing), frequency caps, minimum spacing between notifications (15 min), and predicted open probability; the output is a scheduled list of (notificationId, sendAt) pairs, each enqueued in the delayed Redis ZSET. Why linear programming rather than greedy: the "max 5 marketing per day + min 15 min spacing + top-N by predicted open" problem has conflicting constraints - greedy picks the highest-scoring notification first and loses optimal coverage, while LP gets the globally best schedule in milliseconds for per-user problems of this size (dozens of candidates per user per day). Only marketing and social categories go through this layer; transactional and security bypass and fire immediately. Cost control: inference serving is the hot spot - at 100M users x 10 marketing candidates per day = 1B inferences/day, a small Redis-cached "best hour per user per category" result valid for 24h absorbs 95% of those. Trade-off: adds latency to marketing sends, which is fine since they\'re not time-sensitive - "this product just restocked" would still fire with a shorter urgency window.',
      diagram: {
        mermaid: `flowchart LR
  events["User Engagement Events<br/>Kafka"]:::async
  feature[Feature Store]:::database
  model["Send-Time Model<br/>(trained offline)"]:::compute
  serving["Model Serving<br/>online inference"]:::compute
  atc["Policy ATC"]:::compute
  ranker[Ranker]:::compute
  delayq[("Redis ZSET<br/>per-user delayed queue")]:::cache

  events -->|"1. Publish user event"| feature
  feature -->|"2. Compute features"| model
  model -->|"3. Return prediction"| serving
  atc -->|"4. Score urgency"| serving
  serving -->|"5. Return prediction"| ranker
  ranker -->|"6. Return prediction"| delayq`,
      },
    },
    {
      title: 'Engagement Tracking (Opens, Clicks)',
      problem:
        'Once a notification is handed to a provider, the system has no reliable signal on whether the user actually saw or acted on it - and different channels report engagement through different, inconsistent, sometimes duplicated signals.',
      bad: '"Did the user see it?" - no clue. Only the provider knows they accepted it.',
      good:
        'Client-side reporting. App SDK pings POST /v1/notifications/:id/opened when user taps. Email has a tracking pixel. But: no reliable way to know for push without a client SDK, and clients can lie or double-report.',
      great:
        'Multi-source engagement ingestion + deduped event store. Event types tracked: SENT (worker handed off to provider), DELIVERED (provider confirmed or SDK ack\'d receipt), OPENED (user tapped push / opened email), CLICKED (user tapped a tracked link), DISMISSED (user swiped away without opening), UNSUBSCRIBED (user hit unsubscribe link), BOUNCED (email bounce, hard/soft), COMPLAINED (spam report). Pipeline: (1) sources normalize to a common envelope {notificationId, userId, event, at, source}; (2) the Collector publishes to the engagement Kafka topic, partitioned by notificationId; (3) a Deduper drops duplicates per (notificationId, event) within a 7-day window using a Bloom filter in Redis, fixing double-reports from SDK + provider webhook for the same open; (4) events land in ClickHouse for real-time dashboards (campaign open rate, per-locale performance), with a daily roll-up to S3 Parquet for long-term analysis and ML training; (5) events also feed back into the feature store within minutes. Why ClickHouse: a column-store gives fast aggregation for dashboards like "SELECT category, hour, COUNT(*) FROM events WHERE date=today GROUP BY ..." - Postgres would be too slow at the event volume (10B events/day). Why a Bloom filter for dedup: exact dedup would require storing 10B IDs per week; a Bloom filter accepts ~0.1% false positives (occasionally dropping a real second open) but uses ~100x less memory. Engagement data flows back into the send-time optimization model (better predictions), the ATC layer (a noisy unsubscribe suppresses future marketing), and product dashboards (which templates work, which don\'t).',
      diagram: {
        mermaid: `flowchart LR
  app[Mobile SDK]:::client
  email["Email Pixel<br/>& tracking links"]:::client
  provider["Provider Webhooks<br/>APNs Feedback / SES SNS"]:::edge
  collect[Engagement Collector]:::compute
  kafka["Kafka<br/>engagement topic"]:::async
  dedup[Deduper]:::compute
  dwh[("Analytics Store<br/>events - 90d hot")]:::database
  cold[("Parquet on S3<br/>cold - 2y")]:::storage

  app -->|"1. Receive notification"| collect
  email -->|"2. Notify"| collect
  provider -->|"3. Delivery receipt"| collect
  collect -->|"4. Publish engagement event"| kafka
  kafka -->|"5. Dedup events"| dedup
  dedup -->|"6. Write to warehouse"| dwh
  dwh -->|"7. Sink data"| cold`,
      },
    },
    {
      title: 'Broadcast to Large Segments (Optional)',
      problem:
        'Sending one notification to an entire large segment (up to hundreds of millions of users) needs to complete in a bounded amount of time without one giant serial loop or violating provider rate limits.',
      bad: '"Send this to all 500M users" - the Router iterates the user list one-by-one. Takes hours.',
      good:
        'Parallelize the iteration. Shard the user list into batches of 10k, each processed by a worker pool. Still bounded by provider rate limits.',
      great:
        'Pre-computed segment materialized view + push-time content personalization. For any large segment (country = IN, engaged_users, power_users_top_10pct), the Segment Service materializes the user list nightly into an S3 object or a dedicated table. A Broadcast Worker reads the segment in parallel partitions (e.g., 1000 partitions for 500M users), each processed by a separate consumer group. Content is static across the segment (same template ID, same variables) but rendered per-user-locale at worker time. The provider rate limit is the ceiling: even fully parallelized, APNs caps total throughput at ~1M/sec, so 500M users takes ~8 minutes wall-clock minimum. For truly instant large-audience cases (emergency civic alerts, security advisories), broadcast via channels that support topic-based fan-out natively: APNs Topic / FCM Topics, where subscribers receive by topic subscription and fan-out is kicked to the provider; or SMS carrier broadcast features for regional alerts (governmental use only). For normal business broadcast, the segmented-queue approach is what you want.',
    },
  ],

  selfAudit: [
    {
      question: 'Text search?',
      answer:
        'Yes, if the support team needs to search notifications by content. Push content through a search index (Elasticsearch) with a 14-day retention. Not core but worth mentioning.',
    },
    {
      question: 'Stale prefs after write?',
      answer:
        "User opts out, gets one more marketing send because the cache hasn't invalidated. Fix: 1-second TTL on the cache entry plus event-driven invalidation; acceptable window.",
    },
    {
      question: 'Single-region failure?',
      answer:
        "Primary Postgres region goes down. Active-passive: async replica in DR region; on failover, promote and re-route traffic. In-flight notifications in Kafka -> consumer group repositions to the DR cluster that's mirrored via MirrorMaker.",
    },
    {
      question: 'DLQ reconciliation?',
      answer: 'Ops dashboard lists DLQ entries by reason. Auto-retry once after 1h, then require human decision.',
    },
    {
      question: 'Cost at scale?',
      answer:
        'Egress to providers is free-ish for APNs/FCM, paid per send for SES/Twilio. Cost dashboard per category so Marketing knows their send cost.',
    },
    {
      question: 'Hot user / broadcast?',
      answer:
        "Celebrity's account triggers 100k notifications to followers. Covered by the Broadcast to Large Segments deep dive.",
    },
    {
      question: 'In-app real-time delivery?',
      answer:
        'User opens the app and expects to see the unread badge instantly. Covered by the In-App Notifications in Real Time deep dive via WebSocket gateway + presence + inbox.',
    },
    {
      question: 'Template staleness and localization?',
      answer: "Marketing can't edit strings without a deploy. Covered by the Template Service deep dive.",
    },
    {
      question: 'Over-notification and smart scheduling?',
      answer:
        'Users ignore poorly-timed marketing. Covered by the Send-Time Optimization deep dive with Uber CCG-style scheduling.',
    },
    {
      question: 'Engagement blindness?',
      answer: 'We send and hope. Covered by the Engagement Tracking deep dive with a unified engagement pipeline.',
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  client[Product Services]:::client
  user["End Users<br/>mobile and web"]:::client

  subgraph Ingress
    api[Notification API]:::edge
    campaign[Campaign API]:::edge
    wsgw["WebSocket Gateway<br/>sticky per user"]:::edge
  end

  subgraph Core
    db[("Postgres<br/>notifications + outbox")]:::database
    cdc[Debezium]:::async
    kafka["Kafka<br/>per-channel topics"]:::async
    route[Router]:::compute
    atc["Policy / ATC"]:::compute
    ranker["Ranker + Send-Time<br/>marketing only"]:::compute
    prefs["Preference Svc"]:::compute
    prefdb[("Postgres<br/>user_preferences")]:::database
    prefcache[("Redis<br/>pref cache")]:::cache
    delayq[("Redis<br/>delayed ZSET")]:::cache
    presence[("Redis<br/>user presence")]:::cache
    tmpl["Template Svc"]:::compute
    tmpldb[("Postgres + S3<br/>templates")]:::storage
  end

  subgraph Workers
    push[Push Worker]:::compute
    email[Email Worker]:::compute
    sms[SMS Worker]:::compute
    inapp["In-App Fan-out"]:::compute
    attempts[("Postgres<br/>delivery_attempts")]:::database
    dlq[DLQ]:::async
  end

  subgraph Engagement
    collect["Engagement Collector"]:::compute
    events["Kafka<br/>engagement"]:::async
    ch[("Analytics Store<br/>90d hot")]:::database
    fs["Feature Store"]:::database
  end

  subgraph External
    apns["APNs / FCM"]:::edge
    ses["SES / Mailgun"]:::edge
    twil[Twilio]:::edge
  end

  client -->|"POST notification"| api
  client -->|"Create campaign"| campaign
  user -->|"Connect WebSocket"| wsgw
  wsgw -->|"Read cache"| presence
  api -->|"Persist notification"| db
  campaign -->|"Persist campaign"| db
  db -->|"CDC stream"| cdc
  cdc -->|"Stream changes"| kafka
  kafka -->|"Route by channel"| route
  route -->|"Check prefs"| prefs
  prefs -->|"Cache user prefs"| prefcache
  prefcache -. miss .-> prefdb
  route -->|"Score send time"| atc
  route -->|"Get prediction"| ranker
  ranker -->|"Return prediction"| delayq
  delayq -->|"Publish change"| kafka
  kafka -->|"Deliver via push"| push
  kafka -->|"Deliver via email"| email
  kafka -->|"Deliver via SMS"| sms
  kafka -->|"Deliver in-app"| inapp
  push -->|"Render template"| tmpl
  email -->|"Render template"| tmpl
  sms -->|"Render template"| tmpl
  inapp -->|"Render template"| tmpl
  tmpl -->|"Load from template DB"| tmpldb
  inapp -->|"Push via WebSocket"| wsgw
  push -->|"Send via APNs FCM"| apns
  email -->|"Send via SES"| ses
  sms -->|"Send via Twilio"| twil
  push -->|"Record delivery attempt"| attempts
  email -->|"Record delivery attempt"| attempts
  sms -->|"Record delivery attempt"| attempts
  push -.permanent fail.-> dlq
  email -.permanent fail.-> dlq
  sms -.permanent fail.-> dlq
  user -.opens / clicks.-> collect
  apns -.webhooks.-> collect
  ses -.webhooks.-> collect
  collect -->|"Publish engagement event"| events
  events -->|"Sink data"| ch
  events -->|"Sink data"| fs
  fs -->|"Feed model training"| ranker`,
    bullets: [
      'Product Service sends notification - calls the Notification API with event type, user IDs, and payload',
      'Outbox pattern captures event - written to Postgres; Debezium CDC streams the change to Kafka',
      'Router consumes and evaluates - checks user preferences (Redis pref cache), applies frequency caps (ATC/Policy)',
      'Channel-specific topics populated - Router publishes to per-channel Kafka topics (push, email, SMS, in-app)',
      'Workers render and deliver - Push/Email/SMS Workers call Template Service for localized content, then send via APNs/FCM, SES, or Twilio',
      'In-App fan-out via WebSocket - In-App worker pushes through the WebSocket Gateway to connected users',
      'Failures retry with backoff - exponential backoff on transient errors; permanent failures go to DLQ',
      'Engagement tracked - opens, clicks, and provider webhooks flow to the Engagement Collector, feeding the analytics store and ML feature store for send-time optimization',
    ],
  },

  keyTechnologies: [
    {
      term: 'Kafka',
      definition:
        'Distributed event log decoupling notification intake from delivery - absorbs burst traffic so product services never block on slow providers.',
    },
    {
      term: 'APNs (Apple Push)',
      definition: 'Apple Push Notification Service - the only gateway for delivering push notifications to iOS devices.',
    },
    {
      term: 'FCM (Firebase Cloud Messaging)',
      definition:
        "Google's push notification gateway for Android (and web) - your server can't push directly to phones without going through FCM.",
    },
    {
      term: 'SES / Twilio',
      definition: 'Amazon SES for email delivery, Twilio for SMS - external provider adapters wrapped behind channel workers.',
    },
    {
      term: 'Template Engine',
      definition: 'Renders per-channel, per-locale message content from pre-approved templates with variable interpolation.',
    },
    {
      term: 'Dead Letter Queue',
      definition:
        'Parking spot for permanently-failed messages after max retries - reviewed by ops or an automated reconciler.',
    },
    {
      term: 'Exponential Backoff',
      definition:
        'Retry strategy that waits progressively longer between attempts (2s -> 10s -> 60s -> 5min) to avoid hammering a struggling provider.',
    },
    {
      term: 'Rate Limiting',
      definition:
        'Token bucket per provider and per tenant preventing any single sender from exhausting push/email/SMS quotas for everyone.',
    },
  ],

  expectedDepth: {
    mid: "Design a basic system that receives events and sends notifications via push/email. Propose a queue between event generation and delivery. Understand why async processing matters - synchronous dispatch blocks the product service and can't handle provider slowdowns gracefully.",
    senior:
      'Propose Kafka for event ingestion with consumer groups per channel. Discuss template service for message rendering, user preference management (opt-in/out per channel), and rate limiting per user. Explain retry strategies with exponential backoff and DLQ for permanently failed deliveries. Articulate the outbox pattern for guaranteed event capture.',
    staffPlus:
      "Address notification deduplication across channels (Air Traffic Control pattern from LinkedIn), priority queuing (critical alerts skip the queue), and A/B testing delivery times for engagement optimization. Discuss cost analysis across channels (SMS costs $0.01/msg vs push at $0) and provider routing for cost optimization. Cover regulatory compliance (CAN-SPAM, GDPR consent) and the operational cost of maintaining per-user frequency caps at scale.",
  },

  keyTakeaways: [
    'Multi-channel (push + email + SMS) with per-user preference routing',
    'Kafka decouples event producers from notification delivery',
    'Template engine separates content from channel logic',
    'At-least-once delivery with dedup on the client side',
  ],

  relatedDesigns: ['chat-system', 'job-scheduler', 'social-feed'],
  relatedConcepts: [
    { name: 'Message Queues', description: 'Decouple event producers from the per-channel senders.' },
    { name: 'Fan-Out Patterns', description: 'Deliver one event across many users and channels (push, email, SMS).' },
    { name: 'Idempotency', description: "Dedupe so a user isn't notified twice for the same event." },
    { name: 'Dead Letter Queue', description: 'Parks notifications that permanently fail delivery for inspection.' },
    { name: 'Retry & Backoff', description: 'Retries transient provider failures without hammering them.' },
  ],

  simulator: {
    goalDescription:
      "Fan a single backend event out to push, email, SMS, and in-app channels while respecting each user's preferences, with retries and no silent message loss.",
    requirementChips: ['100K sends/sec peak', 'Transactional P95 < 5s', 'At-least-once delivery, no silent loss'],
    targetRps: 160000,
    readRatio: 0.375,
    cacheHitRatio: 0.95,
    latencyBudgetMsP99: 5000,
    rubric: [
      { id: 'notification-api', label: 'Notification API at the edge', kind: 'requires-node-type', nodeType: 'api-gateway' },
      {
        id: 'event-bus',
        label: 'Event bus decoupling intake from delivery',
        kind: 'requires-node-type',
        nodeType: ['kafka', 'rabbitmq', 'sqs'],
      },
      { id: 'pref-cache', label: 'Preference cache (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'durable-store',
        label: 'Durable store for notifications + preferences',
        kind: 'requires-node-type',
        nodeType: ['postgresql', 'mysql', 'dynamodb'],
      },
      { id: 'channel-workers', label: 'Per-channel delivery workers', kind: 'requires-node-type', nodeType: 'worker' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 600, y: 120 } },
        { id: 'app-1', type: 'microservice', instanceCount: 10, position: { x: 600, y: 280 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 200 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 8, position: { x: 1160, y: 120 } },
        { id: 'worker-1', type: 'worker', instanceCount: 16, position: { x: 1160, y: 280 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-kafka', source: 'gw-1', target: 'kafka-1' },
        { id: 'e-kafka-app', source: 'kafka-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-redis-pg', source: 'redis-1', target: 'pg-1' },
        { id: 'e-app-worker', source: 'app-1', target: 'worker-1' },
        { id: 'e-worker-pg', source: 'worker-1', target: 'pg-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Kafka decouples the product services’ request path from delivery; the Router consults a Redis-cached preference lookup (99% hit rate) before fanning out to channel-specific workers, which call external providers and record every delivery attempt in Postgres.',
    failureModeNarratives: {
      kafka:
        'The event bus is the only path from intake to every channel worker; if it backs up or goes down, no push/email/SMS goes out even though the API keeps accepting and persisting new notifications.',
    },
    fullDesignLinkSlug: 'notification-system',
  },
}

export default topic
