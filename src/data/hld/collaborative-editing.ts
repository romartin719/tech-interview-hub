import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'collaborative-editing',
  title: 'Collaborative Editing (Google Docs / Notion)',
  difficulty: 'Advanced',
  icon: 'pi pi-file-edit',
  color: '#8b5cf6',
  readTimeMinutes: 29,
  topics: [
    'Operational Transformation vs CRDTs',
    'WebSocket Real-Time Sync',
    'Version Vectors & Causality Tracking',
    'Presence & Cursor Broadcasting',
    'Offline Edit Reconciliation',
  ],
  companies: ['Google (Docs)', 'Notion', 'Figma', 'Microsoft (Word/Loop)'],
  prerequisites: ['WebSockets', 'Consistent Hashing', 'Caching'],
  summary:
    'A multi-user document editor where concurrent edits from many clients converge to the same consistent document state in real time, with live cursors and offline support.',

  understandingProblem:
    "Google Docs, Notion, Figma, and Microsoft Loop all let dozens of people type into the same document within the same second. The hard problem is what happens when two users insert different text at the same cursor position while briefly out of sync with each other and then reconcile - a naive approach where each client PUTs its full document body and the server does last-write-wins silently destroys one user's edits every time two people type concurrently, which is unacceptable for a product whose entire value proposition is simultaneous editing. Waiting for a server round-trip before showing a keystroke locally would also make every edit feel laggy, so edits must apply instantly and optimistically on-device, which means conflict resolution has to happen after the fact, not before. The system also has to survive real network partitions and offline periods gracefully - a flight-mode editing session that reconnects hours later must merge cleanly rather than corrupting the document or silently dropping changes.",

  realExamples:
    'Google Docs uses Operational Transformation mediated by a central server (a lineage that traces back to Google Wave). Notion and Figma lean on CRDT-style sequence merging (the same family as the open-source Yjs/Automerge libraries) to get more offline-friendly, peer-to-peer-capable convergence. Microsoft Loop (built on the Fluid Framework) is a more recent entrant using a distributed data structure model closer to OT with a lightweight sequencing service.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  clientA["Client A"]:::client
  clientB["Client B"]:::client
  api["Document API"]:::compute
  db[("Document Store")]:::database

  clientA -->|"PUT /documents/id (full body)"| api
  clientB -->|"PUT /documents/id (full body)"| api
  api -->|"overwrite - last write wins"| db`,
    },
    whyThisBreaks: [
      "Last-write-wins overwrite silently destroys one user's edits the moment two people type in the same document within the same window - completely incompatible with the product's core promise of simultaneous editing.",
      'Sending the entire document body on every save means megabyte-scale PUTs for a one-character edit once a document grows past a page or two, and diffing two full bodies to figure out what actually changed is expensive and lossy.',
      'There is no real-time propagation - another editor only sees your change the next time they happen to reload or re-fetch, which could be seconds or minutes later.',
      'No concept of individual operations means no way to distinguish "inserted a word" from "deleted a paragraph" - the server can only accept or reject an entire snapshot, never merge two.',
      "Offline edits have nowhere to go but a full overwrite - reconnecting after being offline either destroys your own unsynced work or destroys everyone else's.",
      'No cursor/presence signal at all, and no operation log to build version history from - once overwritten, the previous state is simply gone.',
    ],
    closingNote:
      'Every practical collaborative editor throws this model out entirely: clients apply their own edits optimistically and instantly, and stream small structured operations - not full-document diffs - to a sync layer that merges them with OT or CRDT logic so every replica converges to the same final state no matter what order operations arrive in.',
  },

  priorArt: [
    {
      title: 'Operational Transformation (Google Wave / Google Docs lineage)',
      description:
        'OT, the algorithm family originally built for Google Wave and carried into Google Docs, transforms each incoming operation against concurrent operations it did not see before applying it - the transform-based merge strategy contrasted with CRDTs in this design.',
      link: 'https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html',
    },
    {
      title: 'CRDTs - Yjs and Automerge',
      description:
        'These widely-used open-source CRDT libraries implement sequence-CRDT algorithms (giving every inserted element a globally unique, orderable ID) that let replicas merge independently with no central authority - the basis for the CRDT-based alternative to OT.',
      link: 'https://crdt.tech/implementations',
    },
    {
      title: "Figma's Multiplayer Technology Blog Post",
      description:
        "Figma's published account of their multiplayer sync engine - a central server holding authoritative in-memory state per document and broadcasting transformed operations to connected clients - closely mirrors this design's Document Sync service architecture.",
      link: 'https://www.figma.com/blog/how-figmas-multiplayer-technology-works/',
    },
    {
      title: "Martin Kleppmann's CRDT Research",
      description:
        "Kleppmann's papers and talks on strong eventual consistency and collaborative data structures (and his co-authorship of Automerge) formalize the convergence guarantee - replicas that have applied the same operation set always compute identical state - that this design leans on as its core correctness property.",
      link: 'https://martin.kleppmann.com/papers/crdt-isabelle-oopsla17.pdf',
    },
  ],

  coreEntities: [
    {
      name: 'Document',
      description:
        'The persisted content plus metadata (title, owner, createdAt). Decoupled from the hot real-time sync path so listing and permission checks never compete with live editing traffic.',
    },
    {
      name: 'Operation',
      description:
        'A structured edit (insert, delete, format-range) carrying a totally-orderable ID. The unit streamed between clients and the sync service - never a full-document diff.',
    },
    {
      name: 'Document Replica',
      description:
        "A client's or the sync service's local mutable copy of a document, converging toward identical state across all replicas as they apply the same set of operations.",
    },
    {
      name: 'Operation Log',
      description:
        "Durable, ordered append-only record of every operation ever applied to a document. This - not any single node's in-memory state - is the actual source of truth.",
    },
    {
      name: 'Snapshot',
      description:
        'A compacted, materialized document state as of a point in the operation log, avoiding full-history replay on every load.',
    },
    {
      name: 'Presence Session',
      description:
        "Ephemeral, non-durable state tracking a connected user's live cursor/selection and viewing status. Never written to the operation log.",
    },
    {
      name: 'Logical Clock / Op ID',
      description:
        'A sequence-number-plus-client-id identifier giving every operation a deterministic total order across replicas, independent of wall-clock arrival time.',
    },
    {
      name: 'Permission',
      description:
        'A per-document, per-user (or group) role - view / comment / edit - enforced both at WebSocket handshake and per incoming operation.',
    },
  ],

  requirements: {
    core: [
      "Multiple users can simultaneously edit the same document, with each user's changes visible to others within a second or two.",
      'Users see live cursors/selections of collaborators currently viewing or editing the document.',
      'Edits made while offline must be reconciled and merged correctly once connectivity is restored.',
      'The system maintains a full version history, allowing users to view and restore previous document states.',
      'Documents support rich structure (text formatting, embedded objects, comments) beyond plain text.',
      'Access control (view/comment/edit permissions) is enforced per document and per user or group.',
    ],
    belowTheLine: [
      'Real-time voice/video huddle integrated directly into the document',
      'AI-assisted co-editing suggestions',
      'Granular field-level locks (e.g. reserving a specific range/cell for one editor)',
      'Live cross-document linking/transclusion that updates as the source changes',
      'Cross-document, workspace-wide full-text search',
    ],
    nonFunctionalTable: [
      { metric: 'Edit propagation latency', target: 'Well under 1 second between collaborators on a healthy connection.' },
      {
        metric: 'Convergence guarantee',
        target: 'Strong eventual consistency - all replicas converge to identical document state regardless of operation arrival order.',
      },
      {
        metric: 'Partition tolerance',
        target: 'Network partitions and client disconnects never corrupt document state; edits reconcile cleanly on reconnect.',
      },
      {
        metric: 'History scalability',
        target: 'Years of accumulated edit history stored without degrading document load time (via snapshot compaction).',
      },
      {
        metric: 'Concurrent editor scale',
        target: 'Tens to low hundreds of simultaneous active editors per document with no linear latency penalty per additional editor.',
      },
    ],
  },

  technologyChoices: [
    {
      tier: 'Document / Snapshot Store',
      purpose: 'Persistent document content and compacted snapshots, read/write by docId',
      primaryPick: 'Postgres',
      alternatives: 'Spanner, CockroachDB, TiDB',
      whyPrimaryWins: 'Decoupled from the hot real-time path - documents load from a snapshot, not a full history replay, so relational storage is enough',
    },
    {
      tier: 'Operation Log',
      purpose: 'Durable, ordered per-document log of every operation - the actual source of truth',
      primaryPick: 'Kafka',
      alternatives: 'Cassandra, DynamoDB, ScyllaDB, FoundationDB',
      whyPrimaryWins: "Append-only and partitioned by documentId - ordered replay from any resume cursor is exactly what a partitioned log gives Sync Service shards for free",
    },
    {
      tier: 'Real-Time Relay',
      purpose: 'Fan out transformed operations and presence deltas to connected editors',
      primaryPick: 'WebSocket Gateway + Redis Pub/Sub',
      alternatives: 'SSE, gRPC streaming',
      whyPrimaryWins: 'Persistent connections push ops and presence instantly instead of clients polling for changes',
    },
    {
      tier: 'Presence Cache',
      purpose: 'Ephemeral per-connection cursor/selection state',
      primaryPick: 'Redis Cluster',
      alternatives: 'Memcached',
      whyPrimaryWins: 'In-memory session state with TTL expiry matches presence exactly - ephemeral by design, never written to the Operation Log',
    },
    {
      tier: 'Search Index',
      purpose: 'Full-text search across document titles and content',
      primaryPick: 'Elasticsearch',
      alternatives: 'Typesense, Meilisearch',
      whyPrimaryWins: 'Relevance-scored cross-document search, decoupled from the real-time editing path',
    },
    {
      tier: 'Permissions Store',
      purpose: 'Durable per-document, per-user role assignments checked at handshake and per operation',
      primaryPick: 'Postgres',
      alternatives: 'DynamoDB, MongoDB',
      whyPrimaryWins: 'Low-write, relational role data that is cheap to look up on every incoming operation',
    },
  ],
  technologyChoicesNote:
    'Why server-mediated OT over pure CRDTs here? Pure CRDTs (Yjs, Automerge) shine in peer-to-peer and offline-first scenarios, but a canonical, permission-controlled, versioned product benefits from a single serialization point - it simplifies snapshotting, permissions, and undo/redo, at the cost of putting the server on the critical path for every operation, which per-document sharding absorbs. Why Kafka for the Operation Log instead of a database table? Operations are append-only and partitioned by documentId, needing fast sequential replay and high write throughput - exactly what a partitioned, ordered log gives for free, without ever updating or deleting an individual operation.',

  scaleEstimation: [
    'Users: 50M MAU, ~5M editing documents concurrently during peak business-hours windows.',
    'Ops: up to 10M ops/sec at extreme instantaneous peak (bursty keystroke fan-in); sustained platform-wide load is closer to 1-2M ops/sec since most connected users are reading or briefly paused.',
    'Payload: each op is small (insert/delete with position + content, ~50-200 bytes including metadata) - ops are batched/coalesced client-side before sending rather than transmitted per keystroke.',
    'Document storage: a typical document body is tens of KB to a few MB, but full edit history multiplies this - a heavily-edited document accumulating years of operations can reach hundreds of MB of raw history without compaction.',
    'Concurrency per document: tens to low hundreds of simultaneous editors on a hot document; this is the ceiling one owning shard needs to sustain without linear latency growth per additional editor.',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/documents',
      description: 'Create a new document and its permissions record.',
      example: '// Request\n{ "title": "Q3 Roadmap", "ownerId": "u_331" }\n\n// Response 201\n{ "documentId": "d_9021", "createdAt": "2026-07-16T10:00:00Z" }',
    },
    {
      method: 'WS',
      path: '/v1/documents/:docId/sync',
      description: 'Persistent stream for exchanging insert/delete/format-range operations and presence updates in real time.',
      example:
        '// Client send\n{ "type": "op", "op": "insert", "pos": 128, "text": "hello", "opId": [1721, "clientA"] }\n\n// Server broadcast\n{ "type": "op", "op": "insert", "pos": 129, "text": "hello", "opId": [1721, "clientA"] }\n\n// Presence (ephemeral, not logged)\n{ "type": "presence", "userId": "u_442", "cursorPos": 129, "color": "#8b5cf6" }',
    },
    {
      method: 'GET',
      path: '/v1/documents/:docId/snapshot',
      description: 'Fetch the latest compacted snapshot plus any operations since it, for fast document load.',
      example: '// Response 200\n{ "snapshotAt": 5000, "content": "...", "opsSince": [ { "op": "insert", "pos": 40, "text": "!" } ] }',
    },
    {
      method: 'GET',
      path: '/v1/documents/:docId/history?at={timestamp}',
      description: 'Reconstruct and return the document state as of a given point in time for version history/restore.',
      example: '// Response 200\n{ "documentId": "d_9021", "at": "2026-07-10T09:00:00Z", "content": "..." }',
    },
    {
      method: 'PUT',
      path: '/v1/documents/:docId/permissions',
      description: 'Set view/comment/edit access for a user or group on a document.',
      example: '// Request\n{ "userId": "u_442", "role": "edit" }\n\n// Response 200\n{ "documentId": "d_9021", "userId": "u_442", "role": "edit" }',
    },
  ],
  apiSecurityNote:
    "The WebSocket handshake authenticates via JWT and immediately checks the caller's role against the Permissions Store before admitting them to the document's op stream - a viewer's connection is accepted read-only, and any op frame it sends is dropped server-side rather than trusted client-side. opId embeds the client's own ID for ordering, but the server, not the client, is the authority that assigns the durable sequence number - a client cannot forge a lower sequence number to jump ahead of concurrent edits.",

  highLevelDesignIntro:
    "Let's build this incrementally, one functional requirement at a time - starting from a single editor and ending with offline-tolerant, permissioned, multi-user convergence.",

  builds: [
    {
      title: '1) A single user opens a document and edits it in real time',
      body:
        'WebSocket Gateway holds the persistent connection so the client can stream small operations instead of re-PUTting the whole document. Document Sync Service is the brain for one document - it receives operations, assigns them a durable position, persists them, and echoes them back so the same client (and, once we add more editors, every other connected client) sees the authoritative version. Document Store holds the actual content plus metadata (title, owner) separate from the hot real-time path, so listing documents or checking who owns what never competes with live editing traffic.',
      newComponents: [
        {
          name: 'WebSocket Gateway',
          description: "Terminates the client's persistent connection and forwards structured operations to the owning Document Sync Service.",
        },
        {
          name: 'Document Sync Service',
          description: 'Receives operations for a document, assigns each a durable position, persists it, and broadcasts the authoritative result back.',
        },
        {
          name: 'Document Store',
          description: 'Durable storage for document content and metadata, decoupled from the real-time editing path.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client["Client"]:::client
  wsgw["WebSocket Gateway"]:::edge
  sync["Document Sync Service"]:::compute
  store[("Document Store")]:::database

  client -->|"1. insert/delete op"| wsgw
  wsgw -->|"2. forward op"| sync
  sync -->|"3. persist"| store
  sync -.->|"4. broadcast authoritative op"| wsgw
  wsgw -.->|"5. echo back"| client`,
      },
      steps: [
        'Client types a character - it renders instantly in the local replica before any network round-trip, then the operation (not a diff of the whole doc) is sent over the open WebSocket.',
        'WebSocket Gateway forwards the raw operation to the Document Sync Service that owns this document.',
        'Sync Service persists the operation and, for now with one editor, simply echoes back an authoritative version of it.',
        'Client reconciles its optimistic local state against the authoritative echo (a no-op when there is only one editor and nothing concurrent to transform against).',
      ],
      closingNote:
        'This works fine with exactly one active editor - there is nothing to merge yet. The real design problem starts the moment a second person opens the same document.',
    },
    {
      title: '2) Two editors type concurrently - operations must converge, not collide',
      body:
        'This is the core of the whole system. The Document Sync Service is sharded so that a given document is always owned by exactly one node - operation ordering for a single document needs one consistent point of coordination, so we route by documentId (consistent hashing) to guarantee that. That owning node runs a Merge Engine implementing either Operational Transformation or a CRDT-based algorithm: OT transforms an incoming operation against any concurrent operations it did not know about before applying it, while CRDT designs give every insertion a globally unique, orderable identifier so operations merge commutatively with no transform step at all. Either way, every operation is appended to a durable Operation Log per document - this, not the owning node\'s in-memory state, is the actual source of truth.',
      insightCallout:
        'The invariant being engineered for has a name: strong eventual consistency. Every client that has seen the same set of operations converges to an identical document state, regardless of the order those operations arrived in.',
      newComponents: [
        {
          name: 'Document Owner Shard',
          description: 'Consistent-hash-routed node that holds authoritative in-memory state and ordering for a specific document - exactly one owner per document.',
        },
        {
          name: 'Merge Engine (OT or CRDT)',
          description: 'Transforms or merges concurrent operations so every replica converges to the same final document regardless of arrival order.',
        },
        {
          name: 'Operation Log',
          description: 'Durable, append-only, per-document log of every operation ever applied - backs crash recovery and version history.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  clientA["Client A"]:::client
  clientB["Client B"]:::client
  wsgw["WebSocket Gateway"]:::edge
  sync["Document Sync Service<br/>owning shard"]:::compute
  merge["Merge Engine<br/>OT or CRDT"]:::compute
  oplog[["Operation Log"]]:::async

  clientA -->|"1. insert X at pos 5"| wsgw
  clientB -->|"2. insert Y at pos 5"| wsgw
  wsgw -->|"3. route to owning shard"| sync
  sync -->|"4. transform/merge"| merge
  merge -->|"5. append durable op"| oplog
  sync -.->|"6. broadcast transformed ops"| wsgw
  wsgw -.->|"7. deliver to both"| clientA
  wsgw -.->|"7. deliver to both"| clientB`,
      },
      steps: [
        'Client A inserts "X" at position 5; Client B, unaware of A\'s edit, inserts "Y" at the same position 5 - both fire off nearly simultaneously.',
        'Both operations arrive at the WebSocket Gateway, which routes them to the single node that owns this document.',
        "The Merge Engine assigns each operation a totally-orderable ID (logical clock + client-id tiebreak) and either transforms B's operation against A's (OT) or lets their unique IDs settle the order (CRDT).",
        'Both operations are appended to the Operation Log in the agreed order.',
        'The Sync Service broadcasts the transformed operations back to both clients - A sees "X" then "Y" get inserted, B sees the same, and both converge on identical text.',
      ],
      closingNote:
        'Why must one node own the document? Ordering and transform correctness require one consistent point of coordination - if two different nodes could independently assign sequence numbers to the same document, they could disagree about order and never converge. Sharding by documentId keeps hot documents isolated from each other and lets the fleet scale by adding shards, not by adding coordination.',
    },
    {
      title: '3) Collaborators see each other live - presence and cursors',
      body:
        "Live cursor positions and \"who is viewing this document\" need to update multiple times per second per active user to feel alive, but they carry no lasting meaning once a user leaves. A Presence Session is held only in the Sync Service's in-memory session state - never written to the Operation Log - and broadcast over the same WebSocket fan-out used for real content ops, just tagged as a different, lower-durability message type.",
      newComponents: [
        {
          name: 'Presence Sessions (in-memory)',
          description: "Per-connection, per-document ephemeral state - cursor position, selection range, viewing status - held in the owning shard's memory and dropped on disconnect.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  clientA["Client A"]:::client
  clientB["Client B"]:::client
  wsgw["WebSocket Gateway"]:::edge
  sync["Document Sync Service"]:::compute
  pres[("Presence Sessions<br/>in-memory")]:::cache

  clientA -->|"1. cursor moved to pos 129"| wsgw
  wsgw -->|"2. forward presence update"| sync
  sync -->|"3. update in-memory session"| pres
  sync -.->|"4. broadcast presence, no durable write"| wsgw
  wsgw -.->|"5. render live cursor"| clientB`,
      },
      steps: [
        'Client A moves its cursor - the client debounces rapid movements and sends at most a few presence updates per second, not one per pixel.',
        'Sync Service updates the in-memory Presence Session for that connection - no Operation Log write, no durable persistence at all.',
        "Sync Service broadcasts the presence delta to every other client currently viewing the document - client B renders A's cursor and name tag moving.",
        "If A's connection drops (closed socket or missed heartbeat), its Presence Session is simply removed and other clients stop seeing its cursor - no cleanup job, no reconciliation needed.",
      ],
      closingNote:
        "Treating presence with the same durability guarantees as document content would be a significant unnecessary cost - the entire value of presence data is its immediacy, not its persistence. A lost cursor update has no lasting consequence, unlike a lost text edit.",
    },
    {
      title: '4) A client edits while offline and reconciles cleanly on reconnect',
      body:
        "Mobile networks and laptops in flight mode mean a client can go offline for minutes, hours, or days while its user keeps typing. The client keeps a local Op Outbox of everything it produced while disconnected, tagged with the last operation it had actually seen from the server (lastSeenOpId). On reconnect, it doesn't overwrite anything - it replays its queued ops against the server, which fetches everything that happened on the document since that lastSeenOpId, transforms/merges the client's whole backlog against that missed history in true causal order, and rebroadcasts the reconciled result to everyone.",
      insightCallout:
        "This is exactly the same convergence mechanism as two people typing at the same moment - the only practical difference offline reconciliation introduces is the volume of operations to reconcile, not a different mechanism.",
      newComponents: [
        {
          name: 'Client Op Outbox',
          description: "Local, durable queue of operations produced while disconnected, tagged with the client's lastSeenOpId for reconciliation on reconnect.",
        },
        {
          name: 'Reconciliation Path',
          description: "Server-side step that fetches every operation committed since a reconnecting client's lastSeenOpId and merges the client's queued backlog against them in causal order before rebroadcasting.",
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client["Client<br/>reconnecting after hours offline"]:::client
  outbox[("Local Op Outbox")]:::storage
  wsgw["WebSocket Gateway"]:::edge
  sync["Document Sync Service"]:::compute
  oplog[["Operation Log"]]:::async

  client -->|"1. flush queued ops + lastSeenOpId"| outbox
  outbox -->|"2. send on reconnect"| wsgw
  wsgw -->|"3. forward backlog"| sync
  sync -->|"4. fetch ops since lastSeenOpId"| oplog
  sync -->|"5. transform backlog against missed ops"| sync
  sync -.->|"6. rebroadcast reconciled ops"| wsgw
  wsgw -.->|"7. deliver to all collaborators"| client`,
      },
      steps: [
        'Client goes offline mid-edit; every keystroke still applies instantly to the local replica and is queued in the Op Outbox instead of being sent.',
        'Network returns - client reconnects to the WebSocket Gateway and sends its entire queued backlog, tagged with the lastSeenOpId it had before disconnecting.',
        "Sync Service asks the Operation Log for everything committed on this document since that lastSeenOpId - potentially many operations from other collaborators who kept editing.",
        "Merge Engine transforms the client's queued backlog against that missed history, in the true order it happened, not just against the final resulting state.",
        'Reconciled operations are appended to the log and broadcast to every connected client, including the reconnecting one, which discards its optimistic local state in favor of the authoritative merged result.',
      ],
      closingNote:
        "Why replay against each missed operation in order, not just the final state? If the client's backlog is transformed only against where the document ended up - skipping the intermediate steps - positions can end up double-shifted or misapplied. Replaying the true causal sequence of missed operations, one at a time, is what keeps a multi-day offline session from corrupting the document instead of just being slow to resolve.",
    },
    {
      title: "5) Loading a document doesn't require replaying its entire history",
      body:
        "A document edited daily for three years accumulates an operation log far larger than the document itself - reconstructing it by replaying every keystroke since creation would make \"open this document\" unbearably slow. A background Snapshot Compactor periodically folds a prefix of the Operation Log into a materialized Snapshot, so loading a document means fetching the latest snapshot plus only the operations since it.",
      newComponents: [
        {
          name: 'Snapshot Compactor',
          description: 'Background process that periodically materializes the current document state as of a point in the operation log into a durable snapshot.',
        },
        {
          name: 'Snapshot Store',
          description: 'Holds compacted snapshots at decreasing granularity (frequent recent, sparser older) so both fast load and meaningful version history remain possible.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  oplog[["Operation Log<br/>all ops since creation"]]:::async
  compactor["Snapshot Compactor"]:::compute
  snapstore[("Snapshot Store")]:::database
  client["Client - Document Load"]:::client

  oplog -->|"1. periodic compaction"| compactor
  compactor -->|"2. materialize state"| snapstore
  client -->|"3. GET snapshot + opsSince"| snapstore
  snapstore -->|"4. latest snapshot"| client
  oplog -->|"5. ops since snapshot"| client`,
      },
      steps: [
        'Snapshot Compactor runs on a schedule (or after N accumulated operations) and replays the log prefix once to materialize a snapshot.',
        'That snapshot is written to the Snapshot Store, tagged with the operation sequence number it represents.',
        'On document open, the client requests the latest snapshot plus only the operations committed since it - not the full history.',
        "Client applies those few remaining operations on top of the snapshot locally, arriving at current state in milliseconds regardless of the document's total lifetime edit count.",
      ],
      closingNote:
        'Version history and undo still want fine-grained access to intermediate states, so compaction never discards operations outright - only the reconstruction path gets faster. Older snapshots are retained at decreasing granularity, trading exact historical granularity for bounded storage growth, similar in spirit to how time-series systems downsample old data.',
    },
    {
      title: '6) Access control - view/comment/edit permissions per document',
      body:
        'Everything so far assumed every connected client is allowed to edit. In reality, documents have owners, editors, commenters, and viewers, and permission has to be enforced both when a connection opens and on every individual operation - a viewer should never be able to sneak an insert op through even if their client is compromised or buggy.',
      newComponents: [
        {
          name: 'Permission Service',
          description: 'Resolves a (userId, documentId) pair to a role - view / comment / edit - consulted at WebSocket handshake and by the Sync Service on every incoming op.',
        },
        {
          name: 'Permissions Store',
          description: 'Durable per-document, per-user (or group) role assignments, decoupled from the real-time editing path.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client["Client"]:::client
  wsgw["WebSocket Gateway"]:::edge
  permsvc["Permission Service"]:::compute
  permstore[("Permissions Store")]:::database
  sync["Document Sync Service"]:::compute

  client -->|"1. open WebSocket with JWT"| wsgw
  wsgw -->|"2. check role"| permsvc
  permsvc -->|"3. lookup role"| permstore
  permsvc -.->|"4. viewer: read-only<br/>editor: full access"| wsgw
  wsgw -->|"5. admitted ops only"| sync`,
      },
      steps: [
        "Client opens the sync WebSocket with a JWT; the Gateway asks the Permission Service what role this user has on this document before admitting the connection.",
        'A viewer connection is accepted read-only - it receives the live broadcast stream but any op frame it tries to send is dropped server-side, never forwarded to the Sync Service.',
        'A commenter can submit comment-anchor operations but not text insert/delete operations - the Sync Service checks operation type against role on every single incoming op, not just at connect time.',
        'An editor gets full read/write access and participates in OT/CRDT merge exactly as described in builds 1-5.',
      ],
      closingNote:
        "Why re-check on every operation, not just at handshake? A user's role can change mid-session (an owner can downgrade someone from editor to viewer while they're actively connected) - checking only once at connect time would let a since-revoked editor keep editing until they happen to reconnect.",
    },
  ],

  coreFlows: [
    {
      title: 'Concurrent edit convergence',
      diagram: {
        mermaid: `sequenceDiagram
    participant A as Client A
    participant B as Client B
    participant WS as WebSocket Gateway
    participant S as Document Sync Service (owning shard)
    participant L as Operation Log

    Note over A,B: Both editing near-simultaneously at the same position
    A->>WS: insert("X", pos=5, opId=(t1,A))
    B->>WS: insert("Y", pos=5, opId=(t1,B))
    WS->>S: forward both ops
    S->>S: order by (t1,A) < (t1,B) via client-id tiebreak
    S->>L: append both ops in agreed order
    S-->>WS: broadcast insert("Y", pos=6) to A
    S-->>WS: broadcast insert("X", pos=5) to B
    Note over A,B: Both converge to identical text containing X then Y`,
        bullets: [
          "Both clients apply their own insert optimistically and instantly - neither waits for the other before rendering locally.",
          'Both operations land on the single node that owns this document, which is the one consistent point of coordination for ordering.',
          "The transform doesn't just decide who's first - it adjusts the second operation's position to account for the first one already being applied.",
          'Both ops are durably appended to the Operation Log in the agreed order before being broadcast, so a crash right after this point loses nothing.',
          'Every replica ends up with identical final text, even though A and B briefly displayed slightly different intermediate states.',
        ],
      },
      nonObviousFailure:
        "If the transform only reorders which operation is \"first\" without adjusting the second operation's position to account for the first one already being applied, the two clients converge on the same choice of order but disagree on where the second character landed - a bug that is invisible until two users literally compare screens, because each client's own edit always looks correct locally.",
    },
    {
      title: 'Client reconnects after hours offline',
      diagram: {
        mermaid: `sequenceDiagram
    actor U as User
    participant C as Client
    participant O as Local Op Outbox
    participant WS as WebSocket Gateway
    participant S as Document Sync Service
    participant L as Operation Log

    Note over U,C: Client offline for 6 hours, still typing locally
    U->>C: keystrokes apply optimistically
    C->>O: queue ops + record lastSeenOpId=4200
    Note over C,WS: connectivity restored
    C->>WS: reconnect + flush outbox (ops since 4200)
    WS->>S: forward backlog
    S->>L: fetch ops committed since opId 4200
    L-->>S: 380 operations from other collaborators
    S->>S: transform backlog against the 380 missed ops, in causal order
    S->>L: append reconciled operations
    S-->>WS: rebroadcast reconciled ops to all collaborators
    WS-->>C: authoritative merged state`,
        bullets: [
          "The client never blocks on the network - every keystroke while offline still applies to the local replica instantly.",
          "The outbox tags the backlog with lastSeenOpId, the last operation the client actually observed before going dark.",
          "The server, not the client, fetches everything committed since that point - the client has no way to know what it missed.",
          'The backlog is transformed against the missed operations in their true order, one at a time, not just against the final resulting document.',
          'Everyone, including the reconnecting client, ends up on the same reconciled state - the reconnecting client discards its own stale optimistic view in favor of it.',
        ],
      },
      nonObviousFailure:
        "If reconciliation transforms the client's queued backlog only against the final current document state instead of replaying the 380 missed operations in their true causal order, positions computed mid-transform can be based on a document shape that never actually existed at any point in time - silently misplacing an insert or delete by an amount that has nothing to do with any single real edit.",
    },
    {
      title: 'Document load with snapshot + recent ops',
      diagram: {
        mermaid: `sequenceDiagram
    participant C as Client
    participant API as Snapshot API
    participant SS as Snapshot Store
    participant WS as WebSocket Gateway
    participant S as Document Sync Service

    C->>API: GET /documents/id/snapshot
    API->>SS: fetch latest snapshot
    SS-->>API: snapshot @ opId 5000 + opsSince
    API-->>C: snapshot + opsSince
    C->>C: apply snapshot, then apply opsSince locally
    C->>WS: open live sync, resume from opId (5000 + len(opsSince))
    WS->>S: subscribe from exact resume cursor
    S-->>WS: any ops after that cursor, live`,
        bullets: [
          'Client fetches the latest compacted snapshot instead of replaying the full operation history since document creation.',
          "It applies the handful of operations committed since that snapshot to reach the document's true current state.",
          'It opens the live WebSocket subscription passing the exact operation cursor it just finished loading - not a vague "start now".',
          'Any operation committed after that cursor streams in live with no gap and no duplicate application.',
        ],
      },
      nonObviousFailure:
        "Between fetching the snapshot+opsSince response and establishing the live WebSocket subscription, a new operation can be committed by someone else. If the client just connects and starts listening from \"now\" instead of passing the exact sequence number it loaded through as an explicit resume cursor, that window silently drops an operation - the client's view falls one edit behind with no error and no way to detect it later.",
    },
  ],

  deepDives: [
    {
      title: 'Concurrent edit conflict resolution: OT vs CRDTs',
      problem:
        'Two users insert different text at the same cursor position while briefly out of sync with each other, then their edits arrive at the server in some order. The system must guarantee both edits survive and every client ends up displaying identical final text in an identical order, with no coordination between the two users required to agree on whose edit "goes first."',
      simpleTerms:
        "Two people type at almost the same spot in the same document at almost the same moment. Nobody should lose their edit, and everyone's screen has to end up looking exactly the same afterward - automatically, without anyone hitting 'merge'.",
      bad:
        'Last-write-wins full-document overwrite. Each client PUTs its entire document body; the server simply keeps whichever request arrived last and discards the other entirely. Trivially simple, but it silently destroys one user\'s edits every time two people type concurrently - completely unusable for the product\'s actual value proposition, and it gives zero real-time propagation of individual edits.',
      good:
        "Operational Transformation mediated by a central server. Every operation is transformed against any concurrent operation it did not see, using carefully proven transform functions per operation type (an insert transformed against a concurrent insert shifts position differently than an insert transformed against a concurrent delete). A single server owns canonical ordering for the document and mediates every transform, which makes correctness easier to reason about - there is exactly one authority resolving conflicts - and makes permission enforcement straightforward, since that same authority checks every operation before applying it. The cost: a client cannot fully resolve conflicts without talking to that server, so this model degrades to \"can't collaborate\" the moment the owning shard is unreachable, and it scales a single hot document only as far as one node can push transforms.",
      great:
        "CRDT-based merge, routed through a lightweight server for auth and durability rather than for correctness. A sequence CRDT (the RGA family, as used by Yjs and Automerge) gives every inserted element a globally unique, orderable identifier so any two replicas can merge their operation sets independently and deterministically - no transform function needs to be proven correct per operation type, and no central authority is required for the merge itself to be correct. This is genuinely offline-first and can even go peer-to-peer between clients directly. In practice, production systems (Notion, Figma-adjacent tooling) still route CRDT operations through a server - not because the merge needs it, but because permission enforcement, durable storage, and presence still want one throat to choke. The real cost of CRDTs is metadata: every inserted character carries a permanent unique ID, and every deletion leaves a tombstone rather than actually removing anything, so a long-lived, heavily-edited document accumulates far more overhead than an OT-based operation log unless that metadata is periodically garbage-collected during snapshot compaction.",
      diagram: {
        mermaid: `flowchart LR
  clientA["Client A"]:::client
  clientB["Client B"]:::client
  sync["Document Sync Service"]:::compute
  merge["Merge Engine<br/>OT transform or CRDT merge"]:::compute
  oplog[["Operation Log"]]:::async

  clientA -->|"insert/delete ops"| sync
  clientB -->|"insert/delete ops"| sync
  sync -->|"resolve conflicts"| merge
  merge -->|"append agreed order"| oplog
  sync -.->|"broadcast transformed ops"| clientA
  sync -.->|"broadcast transformed ops"| clientB`,
      },
    },
    {
      title: 'Deterministic ordering without a global clock',
      problem:
        "Alice's insert hits the owning shard a few milliseconds before Bob's, but there is no global clock to trust - server timestamps drift, network latency varies, and a naive retry can deliver an operation out of send order. Every replica still has to agree on exactly one order for the same set of concurrent operations.",
      bad:
        "Stamp each operation with the receiving server's wall-clock time and sort by timestamp. Clock skew between nodes (NTP drift of 10-50ms even with regular sync) means two operations that arrived a millisecond apart in real time can be stamped in reverse order, and two operations landing in the exact same millisecond on one node sort randomly.",
      good:
        "A single monotonic sequence number per document, assigned atomically by the owning shard (an in-memory counter or an atomic increment) the instant an operation is durably accepted. Every operation gets the next integer in line, so ordering is trivial to compute and trivial to compare - but it only works because exactly one node owns the counter for that document.",
      great:
        "Logical clock (sequence number) plus client-id tiebreak, threaded through as the operation's totally-orderable ID everywhere - the Operation Log, the transform function, and client-side reconciliation all compare operations the same way. For multi-device users (the same person editing from phone and laptop), the server remains the single source of truth for the sequence number - never the client - and each device tracks its own lastSeenOpId as a resume cursor, so reconnecting after any gap (a dropped WebSocket, an app restart, a multi-day offline stretch) is the same mechanism, just replayed over a longer backlog. Because comparing any two operation IDs is a total order independent of when either replica actually learned about them, two replicas that have seen the same set of operations always compute the identical final document, even if they learned about those operations in a different sequence.",
    },
    {
      title: 'Document sharding and connection scale',
      problem:
        'A single Sync Service instance cannot hold canonical, low-latency ordering state for every actively-edited document platform-wide, and a single WebSocket-holding process cannot also do all the transform/merge/persistence work for millions of concurrent connections without the two competing for the same CPU and memory.',
      bad:
        'One process handles every document\'s ordering and every WebSocket connection. Fine at small scale; at real scale, a burst of edits on one hot document contends for the same CPU that is trying to keep thousands of unrelated connections\' heartbeats alive, and a single-node failure takes down ordering for every document it was holding at once.',
      good:
        "Shard the ordering responsibility by documentId using consistent hashing across many Sync Service nodes, so each document has exactly one owner and that owner only ever has to reason about documents it was assigned. This bounds the blast radius of one hot document to one shard, and lets the fleet scale horizontally by adding shards.",
      great:
        "Split connection-holding from document logic into two tiers, the same pattern real-time chat systems use at scale: a lightweight Edge Tier does nothing but hold the WebSocket, do the TLS handshake, and forward raw frames - it has no idea what OT or CRDT even is; a Logic Tier of sharded Sync Service nodes does the actual ordering, transform/merge, and persistence, addressed by the Edge Tier via the document's shard key. A hot, viral document with hundreds of concurrent editors gets its shard's Logic Tier node scaled or migrated independently of connection volume; a slow snapshot write on one shard never blocks the Edge Tier from accepting new connections or forwarding heartbeats for unrelated documents. Resharding (rebalancing a document to a new owning node, e.g. during a rolling deploy) has to hand off in-flight operations without dropping any - the outgoing owner stops accepting new ops, drains its Operation Log write, and the new owner resumes from the last durably appended sequence number, so clients simply reconnect through the Edge Tier to whichever node now owns the shard.",
      diagram: {
        mermaid: `flowchart LR
  clientA["Client A"]:::client
  clientB["Client B"]:::client
  edge["Edge Tier<br/>connection holding only"]:::edge
  logic1["Logic Tier<br/>shard owns docs 1-1000"]:::compute
  logic2["Logic Tier<br/>shard owns docs 1001-2000"]:::compute
  oplog[["Operation Log"]]:::async

  clientA --> edge
  clientB --> edge
  edge -->|"route by document shard key"| logic1
  edge -->|"route by document shard key"| logic2
  logic1 -->|"append"| oplog
  logic2 -->|"append"| oplog`,
      },
    },
    {
      title: "Presence and cursor broadcasting without melting the fan-out",
      problem:
        'Cursor and selection positions need to update multiple times per second per active user to feel alive, and a document with 200 simultaneous editors turns every single cursor twitch into 200 broadcast messages - a naive implementation can produce more presence traffic than actual content edits.',
      bad:
        'Broadcast every raw cursor-move event to every other connected client the instant it happens. With 200 editors each moving their mouse or cursor 10+ times a second, that is potentially 400,000 fan-out messages per second for one single document, competing directly with real content operations on the same connection.',
      good:
        'Debounce and throttle on the client before sending (cap to a few updates per second per user) and only fan out to clients actually viewing that specific document, not broadcast globally. This alone cuts the volume by an order of magnitude, but it is still one message per cursor movement per viewer.',
      great:
        "Batch presence into periodic ticks on a dedicated low-priority channel that can never queue behind real content ops. The owning shard maintains one in-memory Presence Session per connection and, on a fixed tick (e.g. every 100ms), broadcasts a single coalesced \"who is where right now\" snapshot covering every viewer's latest known cursor - not every intermediate position they passed through. Presence messages are tagged as a distinct, lower-priority WebSocket frame type so a burst of cursor updates can never delay delivery of an actual insert/delete operation. Sessions expire on missed heartbeat (rather than on explicit disconnect alone) so a client that dies without a clean close still gets its ghost cursor removed within one heartbeat interval, and none of this - not the session, not the tick, not the expiry - ever touches the Operation Log.",
    },
    {
      title: 'Offline editing and reconciliation on reconnect',
      problem:
        "A client can be offline for minutes or days while its user keeps editing locally. On reconnect, the system has to merge a potentially large backlog of local operations with everything that happened on the server in the meantime, without losing either side's work or corrupting the document.",
      bad:
        "On reconnect, just re-send the current full local document state and let the server overwrite with it. This is the naive full-overwrite failure mode again, just deferred - it destroys every edit anyone else made to the document during the disconnection window.",
      good:
        'Queue local operations in a durable Client Op Outbox while offline, tagged with the lastSeenOpId the client had before going dark. On reconnect, flush the outbox and let the server fetch and transform against whatever it missed - this is correct for short disconnections with a small backlog.',
      great:
        "The same mechanism, engineered to hold up at the multi-day, large-backlog end: the server treats the reconnecting client's outbox as just another batch of concurrent operations to merge, but merges them against the missed history one operation at a time, in the true order those missed operations actually happened - not just against wherever the document ended up. For very long offline sessions where the document has been heavily restructured (blocks moved, sections reordered) by other collaborators, this can require a background \"rebase\"-style reconciliation pass, conceptually similar to a git rebase, before the client's backlog can be cleanly replayed. Client identity and the outbox itself survive app restarts (persisted to local storage, not just memory), so a user who force-quits mid-flight-mode doesn't lose unsynced edits just because the app process died.",
      diagram: {
        mermaid: `flowchart LR
  client["Client<br/>offline for days"]:::client
  outbox[("Durable Local Outbox")]:::storage
  sync["Document Sync Service"]:::compute
  oplog[["Operation Log"]]:::async
  merge["Merge Engine"]:::compute

  client -->|"queue ops locally"| outbox
  outbox -->|"flush on reconnect"| sync
  sync -->|"fetch missed ops"| oplog
  sync -->|"transform backlog vs missed ops, in order"| merge
  merge -->|"append reconciled ops"| oplog
  sync -.->|"rebroadcast merged state"| client`,
      },
    },
    {
      title: 'History and versioning without replaying every operation',
      problem:
        "A document edited daily for years accumulates an operation log far larger than the document itself. Loading it by replaying every operation since creation would make opening an old document prohibitively slow, but version history and undo/redo still want fine-grained access to intermediate states.",
      bad:
        'Keep the full operation log forever and replay it from the very first operation every time the document is opened. Correct, but load time grows linearly with a document\'s entire lifetime edit count - a three-year-old, actively-used document becomes slower to open every single day.',
      good:
        'Periodically fold a prefix of the log into a snapshot - a materialized document state as of a point in time - so loading means fetching the latest snapshot plus only the operations since it. This bounds load time to "recent activity since the last snapshot," regardless of total lifetime history.',
      great:
        "Tiered snapshot retention plus tombstone garbage collection. Snapshots are kept at decreasing granularity - frequent recent ones, sparser older ones - so version history and restore points remain meaningful at multiple time horizons without storing every intermediate state forever, similar in spirit to how time-series systems downsample old data. For CRDT-based documents specifically, tombstones for deletions older than any client's pending unsynced operations can be safely garbage-collected during compaction - once every replica has provably converged past that point, no future merge will ever need to reference that tombstone again, which is what keeps CRDT metadata bloat bounded over a document's full lifetime instead of growing forever.",
      diagram: {
        mermaid: `flowchart LR
  oplog[["Operation Log<br/>all ops since creation"]]:::async
  snap1[("Snapshot @ 1,000 ops")]:::database
  snap2[("Snapshot @ 5,000 ops")]:::database
  recent[["Ops since last snapshot"]]:::async
  load["Document Load"]:::compute

  oplog -.->|"periodic compaction"| snap1
  oplog -.->|"periodic compaction"| snap2
  snap2 --> load
  recent --> load`,
      },
    },
  ],

  selfAudit: [
    {
      question: 'What happens if two users insert text at the exact same cursor position simultaneously?',
      answer:
        'Both operations carry a totally-orderable identifier (a logical clock plus a tie-breaking client id), so every replica applies a deterministic, identical ordering between the two inserts and all clients converge to the same final text containing both edits.',
    },
    {
      question: 'How do you handle a client reconnecting after being offline for days with many local edits?',
      answer:
        "The client's queued local operations are replayed against the server in their local order and merged using the same OT/CRDT convergence logic as any concurrent edit - the only practical difference from a brief disconnect is the volume of operations to reconcile, not the mechanism.",
    },
    {
      question: 'What if the Document Sync Service shard owning a hot document crashes?',
      answer:
        'The Operation Log is the durable source of truth, not the in-memory session state, so a new shard owner is assigned for that document and reconstructs current state from the latest snapshot plus operations since it, while connected clients reconnect and resume streaming.',
    },
    {
      question: 'How do you keep presence/cursor broadcasts from overwhelming the WebSocket fan-out with 200 simultaneous editors?',
      answer:
        'Presence updates are debounced/throttled client-side and broadcast only to clients currently viewing that document (never persisted or logged), and are batched into periodic coalesced ticks of "who is where" rather than one message per micro-movement.',
    },
    {
      question: "How do you prevent CRDT tombstone/metadata bloat from making an old document unbounded in size?",
      answer:
        "Tombstones for deletions older than any client's pending unsynced operations can be safely garbage-collected during snapshot compaction, since no future merge will ever need to reference them once every replica has converged past that point.",
    },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  CLIENTS["Client Apps<br/>optimistic local apply"]:::client
  WSGW["WebSocket Gateway<br/>edge tier"]:::edge
  PERMSVC["Permission Service"]:::compute
  PERMSTORE[("Permissions Store")]:::database
  SYNC["Document Sync Service<br/>sharded by document"]:::compute
  MERGE["Merge Engine<br/>OT or CRDT"]:::compute
  PRES[("Presence Sessions<br/>in-memory")]:::cache
  OPLOG[["Operation Log"]]:::async
  COMPACT["Snapshot Compactor"]:::compute
  DOCSTORE[("Document + Snapshot Store")]:::database

  CLIENTS -->|"1. Open WebSocket + JWT"| WSGW
  WSGW -->|"2. Check role"| PERMSVC
  PERMSVC -->|"3. Lookup role"| PERMSTORE
  WSGW -->|"4. Route ops by document shard"| SYNC
  SYNC -->|"5. Transform / merge"| MERGE
  MERGE -->|"6. Append durable op"| OPLOG
  OPLOG -->|"7. Periodic compaction"| COMPACT
  COMPACT -->|"8. Persist snapshot"| DOCSTORE
  SYNC -->|"9. Update in-memory session"| PRES
  SYNC -.->|"10. Broadcast transformed ops + presence"| WSGW
  WSGW -.->|"11. Deliver to collaborators"| CLIENTS`,
    bullets: [
      'Client opens a WebSocket - authenticated via JWT through the edge-tier Gateway, which checks role with the Permission Service before admitting the connection.',
      'Operations route to the owning shard - the Gateway forwards ops by document shard key so exactly one Document Sync Service node owns ordering for a given document.',
      'Merge Engine resolves concurrency - OT transform or CRDT merge assigns a deterministic order to concurrent operations from different editors.',
      'Every operation is durably appended - the Operation Log, not any node\'s memory, is the actual source of truth and backs crash recovery.',
      'Snapshot Compactor bounds load time - periodically materializes document state so loading never requires replaying full history.',
      'Presence stays ephemeral - cursor and viewing-status updates live only in in-memory session state, broadcast but never durably logged.',
      'Reconnecting or offline clients reconcile through the same path - a queued local backlog is transformed against missed operations in causal order, just like any concurrent edit.',
      'Permission is checked per operation, not just at connect - a downgraded editor loses write access mid-session, not just on their next reconnect.',
    ],
  },

  keyTechnologies: [
    {
      term: 'Operational Transformation (OT)',
      definition: 'A conflict-resolution technique that transforms an incoming operation against concurrent operations it did not see, typically mediated by a central server.',
    },
    {
      term: 'CRDT',
      definition: 'Conflict-free Replicated Data Type - a data structure whose operations can be merged commutatively across replicas with no central coordination.',
    },
    {
      term: 'RGA (Replicated Growable Array)',
      definition: 'A sequence CRDT that assigns each inserted element a unique, globally orderable identifier, enabling deterministic merge of concurrent text insertions.',
    },
    {
      term: 'Logical Clock / Version Vector',
      definition: 'A causality-tracking mechanism (sequence number plus client id, or per-replica counters) used to totally order or compare operations across replicas independent of wall-clock arrival time.',
    },
    {
      term: 'Tombstone',
      definition: 'A marker left in place of a deleted element in a CRDT so concurrent operations referencing that position can still be resolved correctly.',
    },
    {
      term: 'Strong Eventual Consistency',
      definition: 'The guarantee that any two replicas which have seen the same set of operations converge to an identical state, regardless of the order those operations were received in.',
    },
    {
      term: 'WebSocket',
      definition: 'A persistent two-way connection that lets clients stream small operations and receive broadcasts instantly, instead of polling or re-fetching the whole document.',
    },
    {
      term: 'Consistent Hashing',
      definition: "Routes each document to exactly one owning shard by documentId, so ordering and transform state for that document lives in one consistent place.",
    },
  ],

  expectedDepth: {
    mid: 'Explain why last-write-wins overwrite is unacceptable for simultaneous editors. Propose sending individual edits (not full documents) over a WebSocket so changes propagate in near real time. Understand at a basic level that edits need some way to be ordered consistently across users.',
    senior:
      "Compare Operational Transformation and CRDTs at a mechanism level - how each achieves convergence and what each costs (central authority vs. metadata bloat). Explain why edits apply optimistically on the client before server confirmation, and how presence/cursor data is treated differently (ephemeral, non-durable) from actual document content. Discuss snapshot compaction for history scalability.",
    staffPlus:
      "Design the full sync architecture: document sharding to one owning node per document, the durable operation log as the actual source of truth versus in-memory session state, and how a totally-orderable operation ID achieves strong eventual consistency independent of arrival order. Address offline reconciliation at scale (a client reconnecting after days with a large queued op backlog), tombstone garbage collection during compaction, and the tradeoff between centralized OT-style permission enforcement and fully peer-to-peer CRDT merging.",
  },

  keyTakeaways: [
    'Optimistic local apply is what makes an editor feel responsive - conflicts get resolved after the fact, not before.',
    'OT needs a central authority to mediate; CRDTs trade that away for peer-to-peer/offline-first merging, at the cost of tombstone metadata bloat.',
    'Strong eventual consistency means replicas that saw the same ops always converge, regardless of arrival order - the operation ID, not wall-clock time, is what makes that possible.',
    "Presence/cursor data is deliberately never durable - its entire value is immediacy, not persistence.",
  ],

  relatedDesigns: ['chat-system', 'real-time-leaderboard', 'notification-system'],
  relatedConcepts: [
    {
      name: 'Vector Clocks / Logical Clocks',
      description: 'Order concurrent operations deterministically without relying on wall-clock time.',
    },
    {
      name: 'Consistent Hashing',
      description: 'Shards documents across sync nodes so each document has exactly one canonical owner.',
    },
    {
      name: 'WebSockets',
      description: 'Persistent bidirectional channel for streaming operations and presence with sub-second latency.',
    },
    {
      name: 'Conflict-Free Replicated Data Types (CRDTs)',
      description: 'Data structures that merge concurrent updates deterministically with no central coordinator.',
    },
  ],

  simulator: {
    goalDescription: 'Let dozens of collaborators edit the same document simultaneously, converging to identical state in real time with live cursors and clean offline reconciliation.',
    requirementChips: ['< 1s edit propagation', '1-2M ops/sec sustained platform-wide', 'Strong eventual consistency on reconnect'],
    targetRps: 1000000,
    readRatio: 0.8,
    cacheHitRatio: 0.4,
    latencyBudgetMsP99: 500,
    rubric: [
      { id: 'op-log', label: 'Durable ordered operation log', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'presence-cache', label: 'In-memory presence/session store', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'doc-store', label: 'Durable document/snapshot store', kind: 'requires-node-type', nodeType: 'postgresql' },
      { id: 'compute-tier', label: 'Sharded document sync/merge compute tier', kind: 'requires-node-type', nodeType: ['app-server', 'microservice'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-point', label: 'No single point of failure owning all documents', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'wsgw-1', type: 'api-gateway', instanceCount: 3, position: { x: 320, y: 200 } },
        { id: 'sync-1', type: 'microservice', instanceCount: 10, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 6, position: { x: 880, y: 280 } },
        { id: 'store-1', type: 'postgresql', instanceCount: 4, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-wsgw', source: 'client-1', target: 'wsgw-1' },
        { id: 'e-wsgw-sync', source: 'wsgw-1', target: 'sync-1' },
        { id: 'e-sync-redis', source: 'sync-1', target: 'redis-1' },
        { id: 'e-sync-kafka', source: 'sync-1', target: 'kafka-1' },
        { id: 'e-kafka-store', source: 'kafka-1', target: 'store-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Each document is routed by consistent hashing to exactly one owning Sync Service shard, which runs the OT/CRDT merge, appends every operation to a durable Kafka-backed log, and keeps ephemeral cursor/presence state in Redis; a background compactor folds the log into snapshots so document load never requires replaying full history.',
    failureModeNarratives: {
      'microservice': 'Each document is owned by exactly one Sync Service shard for correct ordering; if that shard crashes before an operation is durably logged, every client editing that specific document loses its live session until a new owner is assigned and reconstructs state from the log.',
    },
    fullDesignLinkSlug: 'collaborative-editing',
  },
}

export default topic
