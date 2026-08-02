import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'chat-system',
  title: 'Chat System (WhatsApp / iMessage)',
  difficulty: 'Intermediate',
  icon: 'pi pi-send',
  color: '#10b981',
  readTimeMinutes: 18,
  topics: [],
  companies: [],
  prerequisites: ['Message Queues', 'Caching', 'WebSockets'],
  summary:
    'A chat system delivers messages in real-time using WebSockets for online users and stores-then-forwards for offline users.',

  understandingProblem:
    'A real-time messaging platform that lets users send text, images, and files to individuals or groups. Messages must be delivered reliably (even if the recipient is offline), ordered correctly, and displayed in real-time. Think WhatsApp, Telegram, Facebook Messenger, or Slack. The hard parts: guaranteed delivery across flaky mobile networks, real-time push without polling, group fan-out at scale, and end-to-end encryption.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  SENDER["Sender"]:::client
  API["Chat API"]:::compute
  DB[("Messages DB<br/>one table")]:::database
  RECEIVER["Receiver<br/>polls every 5s"]:::client

  SENDER --> API
  API --> DB
  RECEIVER --> API`,
    },
    whyThisBreaks: [
      'Polling is wasteful - 500M users polling every 5s = 100M QPS of mostly-empty responses. Massive cost, terrible latency.',
      '5-second delay feels laggy - real-time chat needs sub-second delivery.',
      'Single DB for all messages - billions of messages/day, one table collapses.',
      'No offline handling - if receiver is offline when message arrives, when do they get it?',
      'No ordering guarantee - if two messages arrive out of order at the DB, display is wrong.',
      'Group messages multiply the problem - 256-member group = 256 deliveries per message.',
    ],
    closingNote:
      'Sender POSTs message to an API, stored in a DB. Receiver polls the API every 5 seconds for new messages.',
  },

  priorArt: [
    {
      title: 'WhatsApp Architecture (InfoQ)',
      description:
        'Erlang-based, 2M connections per server, XMPP-derived protocol, store-and-forward for offline delivery.',
      link: 'https://www.infoq.com/presentations/whatsapp-scalability/',
    },
    {
      title: 'Facebook Messenger Iris',
      description:
        'Ordered log storage (like Kafka) per conversation. Messages appended to a per-user ordered log. Clients sync via sequence numbers.',
      link: 'https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/',
    },
    {
      title: 'Discord How Messages Are Stored',
      description: 'Migrated from MongoDB to Cassandra to ScyllaDB. Partition per channel + bucket.',
      link: 'https://discord.com/blog/how-discord-stores-trillions-of-messages',
    },
    {
      title: 'Signal Protocol',
      description:
        'End-to-end encryption with double-ratchet. Pre-keys for offline delivery. The gold standard for E2E chat encryption.',
      link: 'https://signal.org/docs/specifications/doubleratchet/',
    },
    {
      title: 'Slack Real-Time Messaging',
      description:
        'WebSocket connections for real-time, application-level edge cache (Flannel) for fast channel hydration.',
      link: 'https://slack.engineering/flannel-an-application-level-edge-cache-to-make-slack-scale/',
    },
  ],

  coreEntities: [
    { name: 'User', description: 'Identified by phone number or userId. Has online/offline status.' },
    { name: 'Conversation', description: 'A 1:1 or group thread. Has a unique conversationId and list of participants.' },
    {
      name: 'Message',
      description:
        'Text content with messageId, senderId, conversationId, timestamp, status (sent/delivered/read).',
    },
    { name: 'Connection', description: 'A live WebSocket session mapping userId -> serverId:connectionId.' },
  ],

  requirements: {
    core: [
      'Users can send messages (text) to another user in real-time (1:1 chat).',
      'Users can create groups and send messages to all group members.',
      'Messages are delivered reliably even if the recipient is offline (store-and-forward).',
    ],
    belowTheLine: [
      'Read receipts, typing indicators',
      'Media messages (images, video, voice)',
      'End-to-end encryption',
      'Message search, reactions, threads',
      'Voice/video calling',
      'Sub-100ms delivery latency',
      'Exactly-once delivery (at-least-once + client-side dedupe is acceptable)',
      'Multi-device sync (web + mobile + desktop)',
    ],
    nonFunctionalTable: [
      { metric: 'Real-time delivery', target: 'P99 < 500ms for online-to-online message delivery.' },
      {
        metric: 'Reliability',
        target: 'Zero message loss. Once the server acks, the message WILL be delivered eventually.',
      },
      { metric: 'Ordering', target: 'Messages within a conversation appear in send order.' },
      { metric: 'Scale', target: '500M DAU, 100B messages/day (WhatsApp scale).' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Real-time transport',
      purpose: 'Push messages to online clients',
      primaryPick: 'WebSocket (long-lived)',
      alternatives: 'SSE, MQTT (IoT/mobile-optimized), gRPC streaming',
      whyPrimaryWins: 'Persistent bidirectional connection lets the server push the instant a message arrives - zero wasted polling requests across 50M concurrent connections',
    },
    {
      tier: 'Connection management',
      purpose: "Track who's online on which server",
      primaryPick: 'Redis Pub/Sub + connection registry',
      alternatives: 'Kafka, custom session store',
      whyPrimaryWins: 'O(1) lookup for "which WebSocket server holds this user" - the single hop every message-routing decision depends on',
    },
    {
      tier: 'Message storage',
      purpose: 'Durable, ordered message log',
      primaryPick: 'Cassandra (partition per conversation)',
      alternatives: 'ScyllaDB, DynamoDB, TiDB',
      whyPrimaryWins: "Partitioning by conversationId turns \"load chat history\" into a single-partition read, and its write-optimized LSM-tree absorbs 100K msgs/sec without contention",
    },
    {
      tier: 'Message queue',
      purpose: 'Decouple sender from group fan-out',
      primaryPick: 'Kafka (per-user topic or partition)',
      alternatives: 'SQS, RabbitMQ, Pulsar',
      whyPrimaryWins: 'Guarantees at-least-once delivery to every group member and retries automatically if a fan-out worker crashes mid-delivery',
    },
    {
      tier: 'Offline delivery',
      purpose: 'Store messages until the recipient reconnects',
      primaryPick: 'Redis sorted set per user',
      alternatives: 'SQS per user, Cassandra unread table',
      whyPrimaryWins: 'Scored by sequence number so a reconnecting client drains pending messages in exact order, with an O(log N) insert cost',
    },
    {
      tier: 'Push notifications',
      purpose: 'Wake up an offline user\'s phone',
      primaryPick: 'FCM + APNs',
      alternatives: 'OneSignal, SNS',
      whyPrimaryWins: "The only vendor-approved gateway to a locked phone - your server can't push directly to a device without going through these",
    },
  ],
  technologyChoicesNote:
    "Why WebSocket over HTTP polling? At 500M DAU, polling every few seconds means hundreds of millions of mostly-empty requests per second; a persistent WebSocket lets the server push the moment a message arrives, at a fraction of the request volume. Cassandra and Kafka round out the write-heavy paths - partition-per-conversation storage and retry-safe fan-out - while Redis anchors both the low-latency connection registry and the offline queue that guarantees delivery even while a user's device is asleep.",

  scaleEstimation: [
    'Users: 500M DAU, 50M concurrent connections at peak',
    'Write QPS: 100K messages/sec sustained, 10B messages/day',
    'Read QPS: 200K message fetches/sec (history sync + offline drain)',
    'Storage: ~5TB message storage/year (compressed, Cassandra)',
    'Bandwidth: ~500 Gbps aggregate WebSocket traffic at peak',
  ],

  apiInterface: [
    {
      method: 'WS',
      path: 'wss://chat.example.com/ws',
      description:
        'Client authenticates on connect (JWT). Bidirectional: send messages, receive messages, typing, presence.',
      example:
        '{"type": "message", "to": "conv_123", "text": "hello", "clientMsgId": "uuid"}\n{"type": "ack", "messageId": "msg_456", "status": "delivered"}\n{"type": "typing", "conversationId": "conv_123", "userId": "u_789"}',
    },
    {
      method: 'POST',
      path: '/v1/messages',
      description: 'Send a message (fallback if WS is down).',
    },
    {
      method: 'GET',
      path: '/v1/conversations/:id/messages?after=<seqNo>',
      description: 'Sync history.',
    },
    {
      method: 'POST',
      path: '/v1/media/upload',
      description: 'Upload image/file, get a mediaUrl.',
    },
    {
      method: 'POST',
      path: '/v1/groups',
      description: 'Create group.',
    },
  ],
  apiSecurityNote:
    'WebSocket authenticated via JWT on handshake. clientMsgId is for client-side dedupe (idempotency). Server generates the authoritative messageId and timestamp.',

  highLevelDesignIntro: "Let's build this incrementally, one requirement at a time.",

  builds: [
    {
      title: '1) User sends a 1:1 message (both online)',
      body:
        'WebSocket = a persistent connection that stays open so the server can push messages instantly without the client asking. Unlike HTTP (ask -> answer -> done), WebSocket keeps the line open.\n\nChat Service is the brain - receives messages, persists them, and figures out where the recipient is connected.\n\nMessage Store (Cassandra) is permanent storage for all messages. Partitioned by conversation so "load chat history" is a single partition read. Cassandra is a distributed wide-column database designed for heavy writes - partitioning by conversation_id means loading a chat history is a single-partition read, O(1) regardless of total messages in the system.\n\nConnection Registry (Redis) is a fast lookup table mapping userId -> which WebSocket server they\'re on. When a message arrives for Bob, we check Redis to find which server is holding Bob\'s connection.',
      newComponents: [
        {
          name: 'WebSocket Servers',
          description: 'Maintain persistent two-way connections with every online user.',
        },
        {
          name: 'Chat Service',
          description: 'Receives messages, persists them, and figures out where the recipient is connected.',
        },
        {
          name: 'Message Store (Cassandra)',
          description:
            'Permanent storage for all messages. Partitioned by conversation so loading chat history is a single-partition read.',
        },
        {
          name: 'Connection Registry (Redis)',
          description: "Fast lookup table mapping userId -> which WebSocket server they're on.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  SENDER["Sender"]:::client
  WS1["WebSocket Server A"]:::compute
  CHAT["Chat Service"]:::compute
  STORE[("Message Store<br/>Cassandra")]:::database
  ROUTE[("Connection Registry<br/>Redis")]:::cache
  WS2["WebSocket Server B"]:::compute
  RECEIVER["Receiver"]:::client

  SENDER -->|"1. Open WebSocket"| WS1
  WS1 -->|"2. Forward message"| CHAT
  CHAT -->|"3. Persist message"| STORE
  CHAT -->|"4. Lookup receiver server"| ROUTE
  ROUTE -->|"5. Route to Server B"| WS2
  WS2 -->|"6. Deliver to recipient"| RECEIVER`,
      },
      steps: [
        'Sender types "Hey, are you free tonight?" and hits send -> message travels over their open WebSocket connection to Server A',
        'Server A forwards the message to the Chat Service',
        "Chat Service persists the message to Cassandra (partition key = conversationId, so all messages in a chat live together) - now it's durable, even if everything crashes",
        'Chat Service asks Redis: "Which server is the receiver connected to?" -> answer: Server B',
        'Chat Service pushes the message to Server B (via internal gRPC or pub/sub)',
        "Server B pushes the message down the receiver's WebSocket -> message appears on their screen instantly",
        "Receiver's app sends back a delivered acknowledgment -> this receipt flows back to the sender so they see the double-check checkmarks",
      ],
      closingNote:
        'Why WebSocket instead of HTTP polling? With polling, each user would hit our servers every 2 seconds asking "any new messages?" - for 500M users, that\'s 250M requests/second of mostly-empty responses. WebSocket keeps a persistent connection open so the server pushes messages the instant they arrive - zero wasted requests, sub-second delivery.',
    },
    {
      title: '2) Receiver is offline - store and forward',
      body:
        'Offline Queue (Redis sorted set) - when the receiver isn\'t connected, we park message IDs here. Scored by sequence number so when they reconnect, we drain messages in perfect order.\n\nPush Service sends push notifications to wake up the user\'s phone - think of it as the "tap on the shoulder" that tells the user to open the app.\n\nFCM / APNs are Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS) - external services that deliver notifications to locked phones. FCM doesn\'t "know" a message arrived - YOUR server tells FCM to send the push. When Bob installs the app, FCM gives his device a unique token. Your server stores this token. When Bob is offline and a message arrives, your server calls FCM\'s API with Bob\'s token + notification content. FCM maintains its own persistent connection to every Android device in the world and routes the push through that always-on channel. APNs works the same way for iOS.\n\nHow does the notification show the actual message text (with E2E encryption)? For E2E encrypted apps like WhatsApp/Signal, FCM does NOT carry the message content (the server can\'t read it). Instead: (1) Server sends a silent data message via FCM - just a "wake up, you have a new message" signal with sender ID and message reference; (2) FCM wakes up the app\'s background process on the device; (3) The app connects to the server, pulls the encrypted message, and decrypts it locally on the device; (4) The app constructs the notification itself ("Alice: Hey, are you free?") and hands it to the OS for display. For non-E2E apps, the server CAN send the message text directly in the FCM payload (notification message type) - simpler but less secure.',
      newComponents: [
        {
          name: 'Offline Queue (Redis sorted set)',
          description:
            "When the receiver isn't connected, park message IDs here, scored by sequence number so they drain in perfect order on reconnect.",
        },
        { name: 'Push Service', description: "Sends push notifications to wake up the user's phone." },
        {
          name: 'FCM / APNs',
          description:
            'Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS). External services that deliver notifications to locked phones.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  SENDER["Sender"]:::client
  CHAT["Chat Service"]:::compute
  STORE[("Message Store")]:::database
  OFFLINE[("Offline Queue<br/>Redis sorted set")]:::cache
  PUSH["Push Service"]:::compute
  FCM["FCM and APNs"]:::edge

  SENDER -->|"1. Send message"| CHAT
  CHAT -->|"2. Persist message"| STORE
  CHAT -->|"3. Queue for offline user"| OFFLINE
  CHAT -->|"4. Trigger push alert"| PUSH
  PUSH -->|"5. Deliver via FCM APNs"| FCM`,
      },
      steps: [
        'Chat Service checks the Connection Registry -> receiver is NOT online (no WebSocket entry found)',
        'Message is still persisted to Cassandra (same as before - always store first, deliver second)',
        "Message ID is added to the receiver's offline queue in Redis (sorted by sequence number for ordering)",
        'Push Service sends a notification via FCM/APNs: "New message from Alice" -> phone buzzes',
        'Later, receiver opens the app and reconnects via WebSocket -> server drains the offline queue, sending all pending messages in order',
        "Receiver's app acknowledges each message -> server removes them from the offline queue",
      ],
      closingNote:
        'Why store-and-forward instead of just "retry later"? Mobile networks are unreliable. A user might be offline for hours (on a flight, in a tunnel, phone dead). Store-and-forward guarantees zero message loss - once the server acknowledges receipt from the sender, that message WILL reach the recipient eventually, no matter how long it takes.',
    },
    {
      title: '3) Group message fan-out',
      body:
        'Kafka is an event bus for group message fan-out. We use Kafka here because group messages need to be delivered to N members reliably. If a fan-out worker crashes mid-delivery, Kafka retries automatically - no message gets lost.\n\nFan-out Workers consume group message events and deliver to each member individually (online -> push via WebSocket, offline -> queue + push notification).',
      newComponents: [
        {
          name: 'Kafka',
          description:
            'Event bus for group message fan-out. If a fan-out worker crashes mid-delivery, Kafka retries automatically.',
        },
        {
          name: 'Fan-out Workers',
          description:
            'Consume group message events and deliver to each member individually (online -> WebSocket push, offline -> queue + push notification).',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  SENDER["Sender"]:::client
  CHAT["Chat Service"]:::compute
  STORE[("Message Store")]:::database
  K["Kafka<br/>fan-out topic"]:::async
  FAN["Fan-out Workers"]:::compute
  WS["WebSocket Servers"]:::compute
  MEMBERS["Group Members"]:::client

  SENDER -->|"1. Send group message"| CHAT
  CHAT -->|"2. Store single copy"| STORE
  CHAT -->|"3. Publish fan-out event"| K
  K -->|"4. Process group delivery"| FAN
  FAN -->|"5. Push to online members"| WS
  WS -->|"6. Deliver to each member"| MEMBERS`,
      },
      steps: [
        'Sender sends a message to group conv_123 (256 members) -> hits Chat Service',
        'Chat Service stores ONE copy of the message (partition key = conv_123) - not 256 copies!',
        'Publishes a fan-out event to Kafka: "deliver message M to these 256 members"',
        "Fan-out workers consume the event and look up each member's connection - online members get real-time WebSocket delivery, offline members get the offline queue + push notification treatment",
        'If a fan-out worker crashes, Kafka retries - at-least-once delivery is guaranteed',
      ],
      closingNote:
        'Why store once, fan-out on delivery? Writing 256 copies of the same message would waste massive storage. Instead, we store one copy and fan out references (message IDs) to each member\'s timeline. This also makes edits and deletes trivial - change one row, and everyone sees the update.',
    },
  ],

  coreFlows: [],

  deepDives: [
    {
      title: 'How to handle 2M WebSocket connections per server',
      problem:
        "A chat system with 50M concurrent users needs to maintain 50M persistent WebSocket connections. If each server handles 500K connections, that's 100 servers just for connection holding. The challenge: each connection is stateful (long-lived TCP), consumes memory, and requires efficient event handling.",
      bad:
        'One thread per connection (Java BIO / traditional blocking I/O). Classic Java ServerSocket.accept() -> spawn a thread per client. At 10K threads you hit OS limits, context-switching overhead makes the CPU thrash, and each thread stack takes ~512KB. 2M threads x 512KB = 1TB RAM. Impossible.',
      good:
        'NIO event loop model (Netty, Node.js, Go goroutines). Instead of one thread per connection, use a small pool of threads (event loops) that multiplex thousands of connections using OS-level I/O selectors (epoll on Linux, kqueue on macOS). Netty is an asynchronous, event-driven network framework for Java implementing the Reactor pattern - a single thread monitors many sockets, and only wakes up when there\'s data to read/write. No blocking, no idle threads. Real numbers: each idle WebSocket = ~10KB RAM (file descriptor + small read/write buffers); 2M connections x 10KB = 20GB RAM (fits in a 64GB server); Netty can handle 1-2M connections per JVM instance on modern hardware; Go\'s goroutines achieve similar density (goroutine = ~4KB stack vs Java thread = 512KB). Used in production: WhatsApp (Erlang/OTP, famously ran 2M connections per server), Discord (Elixir/Erlang gateway, Rust hot paths), Slack (Java + Netty, project "Flannel"), Signal (Java + Netty), WeChat (C++ custom framework).',
      great:
        'Tiered architecture separating connection from logic. At extreme scale (100M+ connections), even Netty hits limits on a single machine. The problem: the server holding connections ALSO processes messages (routing, persistence, fan-out) - under load, message processing slows down AND connection handling suffers, since they compete for the same CPU/memory. The solution: split into two independent layers, each doing one job. Edge Tier (connection holding, the "receptionist"): ONLY manages TCP/WebSocket connections, TLS handshake, and heartbeat pings; does NO business logic; extremely lightweight at ~10KB per connection; can hold 2M+ connections per node; built with Envoy proxy, HAProxy, custom Go/Rust services, or Netty with minimal handlers. Logic Tier (message processing, the "brain"): receives raw messages from edge tier via internal gRPC; handles all business logic (routing, persistence to Cassandra, fan-out to group members, push notifications); stateless, scales horizontally based on message throughput; holds no WebSocket connections. Flow: Alice\'s phone is connected to Edge Server #3; she sends "Hey Bob"; Edge Server #3 forwards to Logic Tier via internal gRPC; Logic Tier stores in Cassandra, then checks Connection Registry ("Bob is on Edge Server #7"); Logic Tier sends to Edge Server #7 to deliver to Bob\'s WebSocket; Edge Server #7 pushes the message down Bob\'s WebSocket; if Bob is offline, Logic Tier calls Push Service instead. The Connection Registry (Redis) ties both tiers together (e.g. alice -> edge-server-3:conn-8842). Why this is better: adding more connections just means adding cheap, lightweight edge nodes; a slow DB write in Logic Tier doesn\'t block Edge Tier from handling new connections/pings; if an edge node crashes, clients reconnect to another edge node and no messages are lost (Logic Tier handles durability separately); during idle hours, Edge handles the load efficiently while Logic Tier is mostly idle. Real-world implementations: WhatsApp (Erlang nodes at edge, backend services for routing/storage), Discord ("Gateway" servers in Elixir hold connections, "Guild" servers handle message logic), Slack ("Flannel" is their edge/cache layer, backend services do the real work).',
      diagram: {
        mermaid: `flowchart LR
  alice[Alice]:::client
  edge3["Edge Server #3<br/>connection holding"]:::edge
  logic["Logic Tier<br/>stateless message processing"]:::compute
  reg[("Connection Registry<br/>Redis")]:::cache
  edge7["Edge Server #7<br/>connection holding"]:::edge
  bob[Bob]:::client
  cass[("Cassandra")]:::database
  push["Push Service"]:::compute

  alice --> edge3
  edge3 -->|"gRPC: raw message"| logic
  logic -->|"persist"| cass
  logic -->|"lookup Bob"| reg
  logic -->|"deliver to Bob"| edge7
  edge7 --> bob
  logic -->|"Bob offline"| push`,
      },
    },
    {
      title: 'Message ordering in distributed systems',
      problem:
        'Alice sends "Hello" then "How are you?" in quick succession. These hit different server instances (load balanced). Or one arrives via WebSocket, another via a retry. Bob must see them in the correct order. Out-of-order messages make conversations nonsensical. Why this is hard: in a distributed system, there\'s no global clock. Server A\'s timestamp might be 50ms ahead of Server B. Network latency varies. Messages can be retried out of order.',
      bad:
        "Rely on server timestamps. Each server stamps the message with System.currentTimeMillis() on arrival and sorts by timestamp on display. Fails because: clock skew between servers (NTP syncs every few seconds, drift is 10-50ms); Alice's \"Hello\" hits Server A at T=1000, \"How are you?\" hits Server B whose clock reads T=999, so Bob sees them reversed; even on one server, if two messages arrive in the same millisecond, order is random.",
      good:
        'Per-conversation monotonic sequence number. Assign a strictly increasing seqNo per conversation - every message in a conversation gets the next number in sequence. Implementation: Redis INCR on key conv_seq:{conversationId}. Example: Alice sends "Hello" -> INCR conv_seq:alice_bob -> gets 42; Alice sends "How are you?" -> INCR conv_seq:alice_bob -> gets 43. Bob\'s client sorts by seqNo regardless of arrival order - even if msg 43 arrives before 42 (network jitter), the UI holds 43 and renders after 42 arrives. Why Redis INCR? Atomic, single-threaded, sub-ms. Even at 100K messages/sec across all conversations, one Redis cluster handles it because each conversation is an independent key (no contention across conversations). What about gaps? If Bob receives seqNo 42 then 44 (missed 43), client knows there\'s a gap and requests "give me message 43 for this conversation" - server fetches from the message store.',
      great:
        'Sequence numbers + client vector clock + multi-device sync. For apps with multiple devices (phone + web + desktop), ordering gets harder - user sends from phone (seqNo 42), then from desktop (seqNo 43); both devices need to converge. The approach (used by WhatsApp, Slack, Facebook Messenger): (1) Server is the source of truth for sequence numbers - server assigns seqNo on receipt, not the client; (2) Each device maintains a cursor, lastSyncedSeqNo - on reconnect, device says "give me everything after seqNo 38" and server sends the delta; (3) Client embeds lastSeenSeqNo in outgoing messages so the server can detect if the client missed something and proactively push missing messages; (4) Conflict resolution for near-simultaneous sends from multiple devices - both get seqNos from the same atomic counter, so they\'re naturally ordered by who hit the server first, no conflict possible at the ordering level. Tech used in production: WhatsApp (server-assigned message IDs + per-chat ordering, each message has a globally unique ID + per-conversation sequence); Slack (uses a ts timestamp as the unique message ID within a channel, server-generated, monotonically increasing per channel, format 1234567890.123456); Discord (Snowflake IDs, time-based and globally unique, messages sorted by Snowflake ID which is inherently time-ordered since timestamp is the most significant bits).',
    },
    {
      title: 'Reliable delivery with at-least-once + client dedupe',
      problem: 'Network is unreliable. Message might be delivered twice if the ack is lost.',
      simpleTerms:
        "The internet is flaky. A message might arrive twice if the 'got it' confirmation gets lost. We need to make sure Bob sees each message exactly once, even if the system retries delivery.",
      bad:
        'Flow: Sender -> Server: message (clientMsgId: "abc"). Server -> Sender: ack (messageId: "msg_1", clientMsgId: "abc"). Server -> Receiver: message (messageId: "msg_1"). Receiver -> Server: delivered ack (messageId: "msg_1"). If nothing is done about lost acks or retried sends, duplicates or lost confirmations occur silently.',
      good:
        "What if receiver's ack is lost? Server retries delivery. Receiver sees msg_1 twice. Client dedupes by messageId - if already in local DB, ignore.",
      great:
        'What if sender\'s send is retried? Server checks clientMsgId: "abc" against a short-lived dedupe cache. If seen, returns the same messageId without re-storing. Result: at-least-once from server side, exactly-once from user\'s perspective (client dedupe).',
    },
    {
      title: 'How to sync message history across devices',
      problem: 'User has phone + web + desktop. All three must show the same messages.',
      simpleTerms:
        'You send a message from your phone. When you open WhatsApp on your laptop 5 minutes later, that same message should be there. All your devices need to stay in sync.',
      bad:
        'Without a sync protocol, each device only knows about messages it directly received while connected, so devices drift out of sync whenever one of them was offline or freshly installed.',
      good:
        'Pull-based sync with sequence numbers: each conversation has a maxSeqNo, each device tracks lastSyncedSeqNo per conversation, and on app open the device sends GET /conversations/:id/messages?after=lastSyncedSeqNo to fetch the delta.',
      great:
        'Server returns the delta and the device applies it locally; real-time messages arrive via WebSocket and the device increments its local seqNo on receipt. This is the "ordered log" model (Facebook Iris) - the server is the source of truth, and clients are materialized views with a cursor.',
    },
    {
      title: 'Group fan-out: write amplification vs read amplification',
      problem:
        'When you send a message to a 500-person group, should we write 500 copies (one per member) or write one copy and let each member fetch it? Each approach has trade-offs.',
      simpleTerms:
        'When you send a message to a 500-person group, should we write 500 copies (one per member) or write one copy and let each member fetch it? Each approach has trade-offs.',
      bad:
        'Write amplification (push model): on group message, write a copy to each member\'s inbox. A 256-member group x 1000 messages/day = 256K writes/day for one group. Pro: reads are fast (each user reads their own inbox). Con: massive write cost at scale - celebrity groups with 100K members are catastrophic.',
      good:
        'Read amplification (pull model): store one copy per conversation. On read, the user\'s client fetches from the conversation\'s log. Pro: one write per message regardless of group size. Con: each read must merge multiple conversations\' logs.',
      great:
        'Hybrid (what WhatsApp/Discord do): small groups (<=256 members) use the push model, since fan-out is bounded and fast; large channels (1000+ members) use the pull model, storing in the channel log with clients fetching on demand. The threshold is configurable per platform.',
    },
  ],

  selfAudit: [],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  CLIENTS["Mobile and Web Clients"]:::client
  LB["Load Balancer<br/>sticky by userId"]:::edge
  WS["WebSocket Servers<br/>Netty edge tier"]:::compute
  CHAT["Chat Service"]:::compute
  REG[("Connection Registry<br/>Redis")]:::cache
  STORE[("Message Store<br/>Cassandra")]:::database
  OFFLINE[("Offline Queue<br/>Redis sorted set")]:::cache
  K["Kafka<br/>fan-out and events"]:::async
  FAN["Fan-out Workers"]:::compute
  PUSH["Push Service"]:::compute
  MEDIA[("S3 and CDN<br/>media")]:::storage
  FCM["FCM and APNs"]:::edge

  CLIENTS -->|"Open WebSocket"| LB
  CLIENTS -->|"Presigned upload"| MEDIA
  LB -->|"Sticky route by user"| WS
  WS -->|"Forward to chat logic"| CHAT
  CHAT -->|"Lookup receiver server"| REG
  CHAT -->|"Persist message"| STORE
  CHAT -->|"Queue for offline user"| OFFLINE
  CHAT -->|"Publish group fan-out"| K
  K -->|"Process group delivery"| FAN
  FAN -->|"Push to online members"| WS
  CHAT -->|"Trigger push alert"| PUSH
  PUSH -->|"Deliver via FCM APNs"| FCM`,
    bullets: [
      'Client opens WebSocket - connects through Load Balancer (sticky by userId) to a WebSocket Server',
      'Sender sends message - WebSocket Server forwards to Chat Service',
      'Chat Service persists message - writes to Cassandra (Message Store) with a per-conversation sequence number',
      'Connection Registry checked - Redis lookup finds which WebSocket Server holds the recipient',
      'Kafka fan-out for groups - message event published to Kafka, Fan-out Workers push to each member\'s WebSocket Server',
      'Recipient online - message delivered in real-time through their WebSocket connection',
      'Recipient offline - message queued in Redis sorted set (Offline Queue) and push notification sent via FCM/APNs',
      'Recipient reconnects - drains Offline Queue in order, syncs from last seen sequence number',
    ],
  },

  keyTechnologies: [
    {
      term: 'WebSocket',
      definition:
        'A persistent two-way connection between client and server. Unlike HTTP (request -> response -> done), WebSocket stays open so the server can push messages to the client anytime.',
    },
    {
      term: 'Cassandra',
      definition:
        'A distributed NoSQL database optimized for fast writes. Stores data across many machines. Perfect for append-only message logs.',
    },
    {
      term: 'Kafka',
      definition:
        'A distributed event streaming platform. Producers write events, consumers read them. Used here to decouple message sending from delivery fan-out.',
    },
    {
      term: 'Redis',
      definition:
        'In-memory key-value store (< 1ms reads). Used here for connection registry (which user is on which server) and offline message queues.',
    },
    {
      term: 'FCM / APNs',
      definition:
        'Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS). How you send push notifications to phones when the app is closed.',
    },
    {
      term: 'Sequence Number',
      definition:
        'A monotonically increasing integer per conversation. Guarantees message ordering regardless of clock differences between servers.',
    },
    {
      term: 'Store-and-Forward',
      definition:
        'Pattern where the server stores a message durably first, then delivers it when the recipient is available. Ensures zero message loss.',
    },
    {
      term: 'Fan-out',
      definition:
        'Delivering one message to multiple recipients (group chat). "Fan-out on write" = copy to each inbox. "Fan-out on read" = store once, each client fetches.',
    },
  ],

  expectedDepth: {
    mid: "Design basic 1:1 messaging with a server relaying messages. Propose WebSocket for real-time delivery. Understand offline message storage and why polling is wasteful. With prompting, discuss how to handle group messages by fanning out to multiple recipients.",
    senior:
      'Propose Cassandra for message storage (partition by conversation). Explain connection-level routing - how does a message find the right WebSocket server? Discuss read receipts, message ordering guarantees (per-conversation sequence numbers), and offline delivery queues. Articulate why eventual consistency is acceptable for message delivery.',
    staffPlus:
      'Address end-to-end encryption key exchange (Signal protocol double-ratchet), multi-device sync with ordered-log cursors, and message fan-out for large groups (1000+ members) using the hybrid push/pull model. Discuss graceful degradation when the chat service is overloaded (backpressure on WebSocket connections). Cover message retention policies and GDPR right-to-deletion across replicated stores.',
  },

  keyTakeaways: [
    'WebSocket for real-time delivery - persistent connection, server pushes',
    'Cassandra for message storage - partitioned by conversation for fast reads',
    'Store-and-forward for offline users - deliver when they reconnect',
    'Connection registry in Redis routes messages to the right WebSocket server',
  ],

  relatedDesigns: ['notification-system', 'social-feed', 'stock-broker'],
  relatedConcepts: [
    {
      name: 'WebSockets vs SSE',
      description: 'Persistent connections deliver messages in real time both ways.',
    },
    {
      name: 'Message Queues',
      description: 'Buffers and routes messages between senders and recipients.',
    },
    {
      name: 'Fan-Out Patterns',
      description: 'Delivers a single group message to every member of the conversation.',
    },
    {
      name: 'Consistent Hashing',
      description: 'Maps each user to a connection server so messages find the right socket.',
    },
  ],

  simulator: {
    goalDescription:
      'Deliver messages in real time between online users, and reliably store-and-forward for offline users, fanning out group messages to every member.',
    requirementChips: ['Online delivery P99 < 500ms', '100K writes/sec, 200K reads/sec', 'Zero message loss'],
    targetRps: 300000,
    readRatio: 0.67,
    cacheHitRatio: 0.4,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'lb-sticky', label: 'Load balancer with sticky routing by userId', kind: 'requires-node-type', nodeType: 'load-balancer' },
      {
        id: 'connection-tier',
        label: 'Stateful WebSocket / chat-logic compute tier',
        kind: 'requires-node-type',
        nodeType: ['app-server', 'microservice', 'worker'],
      },
      {
        id: 'message-store',
        label: 'Durable per-conversation message store',
        kind: 'requires-node-type',
        nodeType: ['cassandra', 'mongodb', 'dynamodb'],
      },
      { id: 'connection-registry', label: 'Connection registry / offline queue (Redis)', kind: 'requires-node-type', nodeType: 'redis' },
      {
        id: 'fan-out-bus',
        label: 'Event bus for group message fan-out',
        kind: 'requires-node-type',
        nodeType: ['kafka', 'rabbitmq', 'sqs'],
      },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'ws-1', type: 'app-server', instanceCount: 20, position: { x: 600, y: 200 } },
        { id: 'chat-1', type: 'microservice', instanceCount: 12, position: { x: 880, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 1160, y: 120 } },
        { id: 'cassandra-1', type: 'cassandra', instanceCount: 30, position: { x: 1160, y: 280 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 3, position: { x: 1440, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 6, position: { x: 1720, y: 200 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-ws', source: 'lb-1', target: 'ws-1' },
        { id: 'e-ws-chat', source: 'ws-1', target: 'chat-1' },
        { id: 'e-chat-redis', source: 'chat-1', target: 'redis-1' },
        { id: 'e-chat-cass', source: 'chat-1', target: 'cassandra-1' },
        { id: 'e-chat-kafka', source: 'chat-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker-ws', source: 'worker-1', target: 'ws-1' },
      ],
    },
    referenceArchitectureExplanation:
      "WebSocket edge servers hold connections while a stateless Chat Service tier persists every message to Cassandra (partitioned by conversation) and looks up the recipient's connection in Redis; Kafka fans out group messages to workers that push back to whichever edge server holds each member's socket.",
    failureModeNarratives: {
      redis:
        'The connection registry is the single source of truth for "who is on which WebSocket server" - if it goes down, the Chat Service cannot route a single message to an online recipient even though the sockets themselves stay open.',
    },
    fullDesignLinkSlug: 'chat-system',
  },
}

export default topic
