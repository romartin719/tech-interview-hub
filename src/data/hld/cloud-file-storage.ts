import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'cloud-file-storage',
  title: 'Cloud File Storage (Dropbox / Google Drive)',
  difficulty: 'Advanced',
  icon: 'pi pi-cloud',
  color: '#2563eb',
  readTimeMinutes: 26,
  topics: ['Content-Addressable Storage', 'Block-Level Sync', 'Deduplication', 'Conflict Resolution', 'Long-Poll Notifications'],
  companies: ['Dropbox', 'Google Drive', 'Box'],
  prerequisites: ['Caching', 'Message Queues', 'Key-Value Store'],
  summary:
    'A file sync service that lets a user drop a file into a local folder and see it appear on every other device within seconds - built by chunking files into content-addressed blocks, deduplicating identical blocks across the entire user base, re-syncing only the blocks that changed on edit, and pushing change notifications over a long-lived connection instead of polling.',

  understandingProblem:
    "Dropbox and Google Drive look deceptively simple from the outside - a folder that magically stays in sync across your laptop, phone, and the web. But the actual engineering problem is brutal: files can be gigabytes in size, users edit them constantly (sometimes on two devices at once, sometimes offline for days), the same file gets shared and re-shared across millions of accounts, and every byte has to survive drive failures and datacenter outages without ever silently corrupting or losing a user's data. The naive approach - re-upload the whole file every time it changes - falls apart immediately: a 2GB video file with one metadata edit shouldn't cost you 2GB of upload traffic. The entire design hinges on one idea borrowed from version control systems like Git: break every file into small, content-addressed chunks, and only move the chunks that actually changed.",
  realExamples:
    "Dropbox stores over 550 billion files for 700+ million registered users, and built its own custom exabyte-scale storage system (nicknamed 'Magic Pocket') after outgrowing S3 around 2016. Dropbox's sync engine splits files into blocks of up to 4MB and hashes each one with SHA-256 for content-addressing and dedup. Google Drive similarly chunks large uploads (its resumable upload API works in 256KB-aligned chunks) and dedups at the byte level within Google's internal Colossus storage layer. Box reports that block-level diffing on average cuts re-upload bandwidth for edited files by over 90% compared to whole-file re-upload.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Desktop Client]:::client
  api["API Server"]:::compute
  blob[("Object Storage - whole files")]:::storage
  client -->|"Upload entire file"| api
  api -->|"PUT whole file"| blob`,
    },
    whyThisBreaks: [
      'Whole-file re-upload - user changes one line in a 500MB PowerPoint file, client re-uploads all 500MB. On a 10 Mbps home connection that is 7+ minutes for a one-word edit.',
      'No deduplication - 10,000 employees at a company all get emailed the same 50MB PDF and each save it to their Drive. Naive storage keeps 10,000 separate 50MB copies (500GB) instead of one shared copy.',
      'No conflict handling - two laptops edit the same file offline, both reconnect, second write silently overwrites the first. The user loses an afternoon of work with zero warning.',
      'Polling for updates - every client polls "did anything change?" every 30 seconds. With 700M users that is hundreds of millions of wasted requests per minute, and changes still take up to 30s to appear on other devices.',
      'Single flat object store - metadata (filenames, folder structure, sharing permissions, version history) has no natural home; bolting it onto the blob store makes renames, folder listings, and permission checks require scanning raw file content.',
    ],
    closingNote:
      "The fix threads through the rest of this design: stop treating a file as one atomic blob. Split it into small, hashable, independently-storable blocks, and build metadata and sync entirely around those blocks instead of whole files.",
  },

  priorArt: [
    {
      title: 'Dropbox Block Sync Engine',
      description:
        "Chunks files into up to 4MB blocks, hashes each with SHA-256, and only uploads blocks the server has never seen. Content-addressing means identical blocks across different users' files are stored once. (Dropbox Tech Blog, 'Streaming File Synchronization')",
      link: 'https://dropbox.tech/infrastructure/streaming-file-synchronization',
    },
    {
      title: 'Dropbox Magic Pocket',
      description:
        'Dropbox migrated ~90% of its data off S3 onto a custom-built exabyte-scale block storage system to cut cost and control durability directly, using erasure coding instead of simple replication. (Dropbox Tech Blog, 2016)',
      link: 'https://dropbox.tech/infrastructure/inside-the-magic-pocket',
    },
    {
      title: 'rsync / rdiff algorithm',
      description:
        'The original rolling-checksum delta-transfer algorithm (1996) that inspired block-level diffing - computes weak+strong checksums over a sliding window so a receiver can identify unchanged regions without seeing the whole new file.',
      link: 'https://www.samba.org/rsync/tech_report/',
    },
    {
      title: 'Git object model',
      description:
        'Content-addressable storage predates cloud file sync - Git stores every blob under its SHA-1 hash, so identical content anywhere in history is automatically deduplicated. Cloud storage systems apply the same idea to file chunks.',
      link: 'https://git-scm.com/book/en/v2/Git-Internals-Git-Objects',
    },
    {
      title: 'Google Drive / Colossus',
      description:
        "Google's internal successor to GFS backs Drive with chunked, replicated storage and resumable, chunk-aligned uploads so a dropped connection only re-sends the missing chunk, not the whole file. (Google Research publications on Colossus)",
      link: 'https://cloud.google.com/blog/products/storage-data-transfer/a-peek-behind-colossus-googles-file-system',
    },
  ],

  coreEntities: [
    { name: 'File', description: 'A named entity in a folder tree - has metadata (name, size, owner, timestamps) and points to an ordered list of blocks.' },
    { name: 'Block', description: 'A fixed-size (up to 4MB) chunk of file content, identified by the SHA-256 hash of its bytes. The unit of storage, transfer, and deduplication.' },
    { name: 'File Version', description: 'An immutable snapshot of a file - a specific ordered list of block hashes at a point in time, enabling history and rollback.' },
    { name: 'Namespace / Folder', description: 'A directory node in the file tree; owns child files and folders and carries sharing/ACL settings that cascade down.' },
    { name: 'Device / Client Session', description: "A registered client (desktop, mobile, web) with a sync cursor tracking the last change it has applied." },
    { name: 'Share / ACL Entry', description: 'Grants a user or group a permission level (viewer, editor, owner) on a file or folder.' },
  ],

  requirements: {
    core: [
      'Upload a file - client splits it into blocks and uploads only new blocks, then commits a version pointing at the block list',
      'Download / sync a file - any device can fetch the current version by resolving block hashes to content',
      'Detect and sync changes automatically - editing a file on one device propagates to all other devices within seconds',
      'Version history - list and restore prior versions of a file',
      'Share files and folders with specific permission levels (view/edit) with other users',
    ],
    belowTheLine: [
      'Real-time simultaneous co-editing inside a document (that is Google Docs / collaborative editing, a different design)',
      'Full-text search inside file contents',
      'Client-side end-to-end encryption with zero-knowledge key management',
      'Malware/virus scanning pipeline',
      'Billing, quota enforcement UI, and admin console',
      'Third-party app integrations (Slack previews, Office Online editing)',
    ],
    nonFunctionalTable: [
      { metric: 'Durability', target: '11 nines (99.999999999%) - a block, once acknowledged, must never be lost' },
      { metric: 'Sync latency', target: 'Change visible on other online devices within 2-5 seconds' },
      { metric: 'Bandwidth efficiency', target: 'Re-uploading an edited file transfers only changed blocks, not the whole file' },
      { metric: 'Availability', target: '99.9%+ for metadata and sync APIs; reads should degrade gracefully, never silently corrupt' },
      { metric: 'Storage efficiency', target: 'Identical content across users stored once (single-instance storage)' },
      { metric: 'Consistency', target: 'A device coming back online must reconcile changes without silent data loss (no invisible overwrite)' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Block / Object Store',
      purpose: 'Raw block bytes (up to 4MB chunks), immutable and content-addressed by SHA-256',
      primaryPick: 'S3 / GCS / Azure Blob',
      alternatives: 'MinIO, Ceph, custom block storage (Dropbox Magic Pocket) at extreme scale',
      whyPrimaryWins: "Content-addressed PUT/GET by hash is exactly the object-store access pattern - S3-class storage delivers the 11-nines durability this design's own NFRs require without building custom infrastructure first",
    },
    {
      tier: 'Metadata DB',
      purpose: 'File tree, filenames, folder hierarchy, sharing ACLs, and per-version block-hash manifests',
      primaryPick: 'Postgres (sharded by namespace/folder ID)',
      alternatives: 'CockroachDB, TiDB, Spanner',
      whyPrimaryWins: 'Folders containing files, files owning ordered chunk lists, and permissions cascading down a tree are relational, referential-integrity problems - strong consistency here is what makes a rename a safe pointer update instead of a re-upload',
    },
    {
      tier: 'Change Notification Queue',
      purpose: 'Per-namespace change feed that the Notification Service tails to wake up watching devices',
      primaryPick: 'Kafka',
      alternatives: 'Redis Streams, RabbitMQ, SNS+SQS',
      whyPrimaryWins: "An append-only log gives every watcher device its own replayable cursor, which is exactly how this design's Change Log and long-poll Notification Service already work together",
    },
    {
      tier: 'ACL / Metadata Cache',
      purpose: 'Hot permission lookups so every block read does not walk the folder tree from scratch',
      primaryPick: 'Redis',
      alternatives: 'Memcached',
      whyPrimaryWins: 'Permission checks happen on every file resolution but the underlying ACL tree changes rarely, so a cache in front of the metadata layer - never the Block Store itself - is the right place to absorb that read volume',
    },
    {
      tier: 'CDN',
      purpose: 'Accelerates downloads of popular shared files close to the requesting region',
      primaryPick: 'CloudFront / Cloudflare',
      alternatives: 'Fastly, Akamai',
      whyPrimaryWins: 'A file shared across a large team or the public gets read far more than it is written, so caching hot blocks at the edge saves a redundant trip to origin object storage for every reader',
    },
    {
      tier: 'Block Diff Engine',
      purpose: 'Rescans an edited file and identifies which blocks actually changed before upload',
      primaryPick: 'Custom rsync-style service',
      alternatives: 'librsync',
      whyPrimaryWins: "This is CPU-bound, stateless rolling-hash work that has to run client-side anyway - a custom engine mirroring rsync's rolling checksum is what turns a 1-word edit into a single re-uploaded block instead of the whole file",
    },
  ],
  technologyChoicesNote:
    'Why a relational database for metadata instead of a NoSQL store? A file system has strong hierarchy and referential constraints - folders contain files, files have ordered chunk lists, and sharing permissions are tied to specific users - so relational integrity and ACID transactions are what prevent orphaned chunks and inconsistent states across renames, moves, and permission changes. At real scale the metadata database is sharded by namespace/folder ID rather than replaced with a weaker consistency model.',

  scaleEstimation: [
    'Users: 700M registered users, ~100M+ monthly active with a synced client running',
    'Files: 500B+ files stored; average file ~200KB, with a long tail of multi-GB files',
    'Total storage: exabyte scale (1,000+ petabytes) before dedup; dedup can cut effective storage 20-30% for common file types',
    'Upload write QPS: millions of block-commit operations/day; metadata writes (renames, moves, permission changes) far outnumber raw byte uploads',
    'Block churn: a typical edit to a 100MB file touches only 1-5 of its ~25 4MB blocks, so re-sync bandwidth is a small fraction of file size',
    'Notification fan-out: a shared folder edited by 1 user must notify every other member with access (up to thousands of devices) within seconds',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/blocks/batch-check',
      description: 'Given a list of block hashes the client is about to upload, returns which ones the server already has, so the client skips re-sending them.',
      example: '// Request\n{ "hashes": ["a1b2...", "c3d4...", "e5f6..."] }\n\n// Response 200\n{ "missing": ["c3d4..."] }',
    },
    {
      method: 'PUT',
      path: '/v1/blocks/{hash}',
      description: 'Uploads the raw bytes of a single block. The server verifies the SHA-256 of the body matches {hash} before accepting.',
      example: '// Request\nContent-Type: application/octet-stream\n<raw block bytes, up to 4MB>\n\n// Response 201\n{ "hash": "c3d4...", "size": 4194304 }',
    },
    {
      method: 'POST',
      path: '/v1/files/{fileId}/commit',
      description: 'Commits a new file version once all referenced blocks exist server-side. Creates a new immutable version pointing at the ordered block list.',
      example: '// Request\n{ "blockHashes": ["a1b2...", "c3d4...", "e5f6..."], "clientMtime": "2026-08-02T10:00:00Z" }\n\n// Response 201\n{ "versionId": "v_9f8e", "size": 12582912, "revision": 14 }',
    },
    {
      method: 'GET',
      path: '/v1/files/{fileId}',
      description: 'Fetches current metadata and the ordered block-hash manifest for a file so the client can download only blocks it lacks locally.',
      example: '// Response 200\n{ "fileId": "f_123", "name": "report.pdf", "revision": 14, "blockHashes": ["a1b2...", "c3d4...", "e5f6..."] }',
    },
    {
      method: 'GET',
      path: '/v1/delta?cursor={cursor}',
      description: "Long-poll endpoint. Returns immediately if changes exist since cursor, otherwise holds the connection open (up to ~60s) and returns when a change arrives.",
      example: '// Response 200\n{ "changes": [{ "fileId": "f_123", "revision": 14, "type": "modified" }], "cursor": "ck_abc124" }',
    },
    {
      method: 'POST',
      path: '/v1/shares',
      description: 'Grants a permission level on a file or folder to another user or group.',
      example: '// Request\n{ "targetId": "folder_9", "granteeEmail": "alex@co.com", "role": "editor" }\n\n// Response 201\n{ "shareId": "sh_55", "role": "editor" }',
    },
  ],
  apiSecurityNote:
    'Block upload endpoints must verify hash integrity server-side (never trust client-supplied hashes) to prevent hash-collision cache poisoning across users. All metadata and delta endpoints must enforce per-file ACL checks, since block-level dedup means the underlying bytes are shared across unrelated accounts even though metadata is not.',

  highLevelDesignIntro:
    "Let's build this up incrementally: start by fixing the naive whole-file-upload problem with chunking, then layer in dedup, real-time notification, conflict handling, and sharing on top of that block foundation.",

  builds: [
    {
      title: 'Chunk Files Into Content-Addressed Blocks',
      body:
        'The first and most important decision: never treat a file as one opaque blob. On the client, split every file into fixed-size blocks (Dropbox uses up to 4MB) and compute a SHA-256 hash of each block\'s bytes. The block\'s hash becomes its permanent address - this is "content-addressable storage."\n\nOnce content is addressed by hash rather than by filename or path, two extremely useful properties fall out for free: identical bytes anywhere in the system produce the identical hash (dedup becomes trivial), and a block\'s address never changes even if the file is renamed or moved (metadata operations become pure pointer updates).',
      insightCallout:
        'Content-addressing turns "does this content already exist?" into a single hash lookup instead of a byte-for-byte comparison. This one property is the foundation dedup, delta-sync, and cheap renames all build on.',
      newComponents: [
        {
          name: 'Chunker (client-side)',
          description: 'Splits a file into up to 4MB blocks and computes a SHA-256 hash per block before any network call happens.',
        },
        {
          name: 'Block Store',
          description: 'A key-value object store (S3-like) keyed by block hash, holding raw block bytes. Immutable - a block is never overwritten, only referenced or garbage-collected.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Desktop Client]:::client
  chunker["Chunker<br/>splits + hashes"]:::compute
  api[Upload API]:::compute
  blocks[("Block Store<br/>keyed by hash")]:::storage

  client -->|"1. Read file"| chunker
  chunker -->|"2. Blocks + hashes"| api
  api -->|"3. PUT block by hash"| blocks`,
      },
      steps: [
        'Client reads the file and splits it into ordered 4MB blocks',
        'Client computes SHA-256 for each block',
        'Client uploads each block to the API, keyed by its hash',
        'API stores raw bytes in the Block Store under that hash',
      ],
      closingNote:
        'Now every file is really just an ordered list of block hashes. But we are still uploading every block on every save - the next problem is skipping blocks the server already has.',
    },
    {
      title: 'Deduplicate Blocks Across the Entire System',
      body:
        "Because blocks are addressed by content hash, the server can check 'do I already have this block?' before the client even sends the bytes. This is single-instance storage: if two different users both save the exact same 50MB PDF, the underlying blocks live exactly once in the Block Store, referenced by two completely unrelated files.\n\nThe client batches this check: before uploading anything, it sends the list of hashes it is about to upload, and the server responds with only the ones it is missing. For an edited file, this collapses to almost nothing - most blocks already exist server-side, either from this user's own prior version or from any other user's file that happens to share content.",
      insightCallout:
        "Dedup is a side effect of content-addressing, not a separate feature you have to build. Because the address IS the hash of the content, 'have I seen this before' is literally the same operation as 'where do I store this.'",
      newComponents: [
        {
          name: 'Block Existence Index',
          description: 'A fast key existence check (hash -> exists boolean) backed by the Block Store\'s key index, consulted before any upload.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Desktop Client]:::client
  api[Upload API]:::compute
  index[("Block Existence Index")]:::database
  blocks[("Block Store")]:::storage

  client -->|"1. batch-check hashes"| api
  api -->|"2. Lookup"| index
  api -->|"3. Missing hash list"| client
  client -->|"4. Upload only missing blocks"| api
  api -->|"5. Store new blocks"| blocks`,
      },
      closingNote:
        'We have now solved storage-side dedup and upload efficiency. But dedup and chunking only pay off on edits if we can identify WHICH blocks changed without re-hashing an entire multi-gigabyte file from scratch every time - that is the sync problem.',
    },
    {
      title: 'Separate Metadata Service From Block Storage',
      body:
        'File names, folder hierarchy, sharing permissions, and version history are small, highly structured, and read constantly (every folder listing, every rename, every permission check). Block content is huge, opaque, and read/written in bulk. Mixing them in one system - as the naive design does - forces every metadata operation to pay the cost of a bulk-storage system.\n\nThe fix: a dedicated Metadata Service backed by a strongly-consistent database holding the file tree, and a separate Block Store for bytes. A file row never contains file content - only an ordered list of block hashes and standard metadata fields.',
      insightCallout:
        "Renaming a 10GB file should be a millisecond metadata update, not a re-upload. That is only possible because the file's identity (its metadata row) is decoupled from its content's identity (the block hashes)."
      ,
      newComponents: [
        {
          name: 'Metadata Service',
          description: 'Owns the file/folder tree, filenames, timestamps, and the block-hash manifest per file version. Backed by a horizontally sharded relational or document store (sharded by namespace/folder ID).',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  meta[Metadata Service]:::compute
  metadb[("Metadata DB<br/>sharded by folder")]:::database
  blocks[("Block Store")]:::storage

  client -->|"1. Rename / move / list"| meta
  meta -->|"2. Read/write file tree"| metadb
  client -->|"3. Fetch block manifest"| meta
  client -->|"4. Download blocks directly"| blocks`,
      },
      closingNote:
        'With metadata and blocks cleanly split, we can now build the actual sync loop: how does a device figure out that something changed and pull down exactly the new blocks.',
    },
    {
      title: 'Block-Level Diff Sync on Edit',
      body:
        "When a user edits a file, the client does NOT re-chunk and re-hash the entire file naively from byte 0 - for a multi-GB file that alone would be slow. Instead, the sync engine keeps a local index of the previous version's block boundaries and hashes. It rescans the file, and for regions that have not shifted (most edits are localized - appending text, changing a few cells), the old block boundaries still line up and produce the same hash, so those blocks are recognized as unchanged instantly.\n\nOnly the blocks whose content actually differs get re-hashed as new blocks and uploaded (after the dedup check from build 2). The client then commits a new version: an ordered block list that reuses old hashes for unchanged regions and points at new hashes for changed ones.",
      insightCallout:
        "This is the single biggest reason Dropbox felt faster than 'zip the folder and upload it' competitors circa 2010: a 1-word edit in a 500MB file re-uploads one ~4MB block (under 1 second on broadband) instead of 500MB (minutes).",
      diagram: {
        mermaid: `flowchart LR
  client[Client - edited file]:::client
  diff["Diff against<br/>previous block manifest"]:::compute
  api[Upload API]:::compute
  blocks[("Block Store")]:::storage
  meta[Metadata Service]:::compute

  client -->|"1. Rescan + rehash"| diff
  diff -->|"2. Only changed block hashes"| api
  api -->|"3. Store new blocks only"| blocks
  api -->|"4. Commit new version manifest"| meta`,
      },
      steps: [
        'Client rescans the edited file and recomputes block hashes using the previous version\'s block boundaries as a starting point',
        'Blocks whose hash is unchanged are reused by reference - zero bytes transferred',
        'Blocks whose hash changed are batch-checked against the server (build 2) and only truly-new bytes are uploaded',
        'Client commits a new file version whose block list mixes reused and newly-uploaded hashes',
      ],
      closingNote:
        'We can now sync edits cheaply on a single device. The next problem is telling every OTHER device that something changed, without making 700M clients poll every few seconds.',
    },
    {
      title: 'Real-Time Change Notification via Long-Poll',
      body:
        'Polling "did anything change?" every 30 seconds from every client does not scale and adds up to 30 seconds of lag. Instead, each client holds open a long-poll (or persistent HTTP/2 / WebSocket) connection to a Notification Service. The server holds the connection open with no response until a relevant change occurs, then immediately replies with a lightweight signal - not the actual diff, just "something changed, go fetch the delta."\n\nThe client then calls the metadata delta API with its last-known cursor, receives the small list of changed file IDs and their new block manifests, and pulls only the blocks it is missing from the Block Store.',
      insightCallout:
        "The notification payload is intentionally tiny - just a signal to re-sync, not the changed data itself. This keeps the fan-out cheap even when a shared folder has thousands of watching devices, because the expensive part (block transfer) only happens between the two devices that actually need those bytes.",
      newComponents: [
        {
          name: 'Notification Service',
          description: 'Holds long-lived connections per active device and pushes a lightweight "changed" signal keyed by cursor when a watched namespace mutates.',
        },
        {
          name: 'Change Log / Cursor Stream',
          description: "An append-only per-namespace change feed (think Kafka-like log) that the Metadata Service writes to on every commit, which the Notification Service tails to know who to wake up.",
        },
      ],
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Device A
  participant B as Device B
  participant Meta as Metadata Service
  participant Notify as Notification Service
  A->>Meta: Commit new version
  Meta->>Notify: Publish change event
  Notify-->>B: Wake long-poll: "changed"
  B->>Meta: GET /delta?cursor=...
  Meta-->>B: New block manifest
  B->>B: Fetch missing blocks from Block Store`,
      },
      closingNote:
        "Devices now hear about changes within a couple seconds instead of up to 30. But two devices can each make a change offline and reconnect at the same time - we still need to decide who wins, and 'whoever synced last wins' silently loses data."
    },
    {
      title: 'Conflict Detection and Resolution',
      body:
        "A laptop goes offline on a flight, a phone edits the same file from a cafe, both reconnect an hour later. Both clients believe they hold the latest version. Naive last-write-wins would let one edit silently vanish - unacceptable for a system whose entire value proposition is 'your files are safe.'\n\nThe fix: every commit carries the base version it was built from (the parent revision). When a client commits, the server checks whether that parent revision still matches the file's current head. If it does, the commit is a clean fast-forward. If the head has moved (someone else committed first), the server rejects the naive commit and the client instead creates a conflicted copy - saving its version as a sibling file (e.g. 'report (conflicted copy, Alex's laptop, 2026-08-02).pdf') rather than overwriting anything. Nothing is ever silently dropped; the human resolves it by looking at both files.",
      insightCallout:
        "The core guarantee is: a write can lose the 'race' to become the canonical version, but it must never lose the DATA. Renaming to a conflicted copy trades a little user annoyance for zero silent data loss - the right trade for a storage system.",
      diagram: {
        mermaid: `flowchart TD
  a["Device A commits<br/>parent=v14"]:::client
  b["Device B commits<br/>parent=v14"]:::client
  meta[Metadata Service]:::compute
  ok["v15 accepted<br/>(A won the race)"]:::database
  conflict["B's commit rejected<br/>-> saved as 'conflicted copy'"]:::database

  a --> meta
  b --> meta
  meta -->|"parent matches head"| ok
  meta -->|"parent stale"| conflict`,
      },
      closingNote:
        "Conflicts are handled correctly for a single file, but real folders are shared across many users with different permission levels, and access needs to be enforceable at every layer of the tree."
    },
    {
      title: 'Sharing and Permission Model',
      body:
        "Files and folders need an ACL: an owner, and a set of grantees (users or groups) each with a role - viewer, editor, or owner. Permissions on a folder cascade to everything inside it unless explicitly overridden, so the check for 'can this user read block X' really means 'walk up the file tree to the nearest ACL entry and evaluate it,' cached aggressively since the tree rarely changes compared to how often it's read.\n\nCritically, because blocks are deduplicated and content-addressed, the ACL lives entirely at the metadata layer - the Block Store has no concept of ownership at all. A block being 'shared' just means multiple file records across multiple users' metadata point at the same hash; access is enforced when metadata resolves a file to its manifest, before any block bytes are ever served.",
      insightCallout:
        "Because dedup means the same bytes back multiple unrelated users' files, permission checks MUST happen at the metadata layer, never at the Block Store. The Block Store should be treated as a dumb, unauthenticated-by-design cache of bytes reachable only through a metadata check that already knows who is allowed to see them.",
      newComponents: [
        {
          name: 'ACL Service',
          description: 'Stores per-file/folder grants (grantee, role) and resolves effective permission for a (user, file) pair by walking up the folder tree, with a cache in front for hot lookups.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  user[User]:::client
  meta[Metadata Service]:::compute
  acl[ACL Service]:::compute
  aclcache[("ACL Cache")]:::cache
  blocks[("Block Store")]:::storage

  user -->|"1. Request file"| meta
  meta -->|"2. Check permission"| acl
  acl -->|"3. Cached lookup"| aclcache
  meta -->|"4. Return manifest if allowed"| user
  user -->|"5. Fetch blocks directly"| blocks`,
      },
      closingNote:
        'Sharing works, but we have said nothing yet about durability and cost at exabyte scale, or about what a client does while it has no network connection at all - both of which matter enormously in production.'
    },
    {
      title: 'Storage Tiering and the Offline Sync Queue',
      body:
        "Not all blocks are accessed equally: a photo uploaded five years ago that nobody has opened since is far cheaper to store on cold/archival storage (slower retrieval, much lower $/GB) than on the hot tier serving actively-edited files. A background tiering job tracks last-access time per block and migrates cold blocks to archival storage, rehydrating them transparently (with added latency) on the rare access.\n\nOn the client side, when a device is offline, all pending block uploads and metadata commits queue locally in a durable, ordered sync queue instead of failing outright. When connectivity returns, the queue drains in order, running each queued commit through the same conflict-detection check from build 6 - so a week of offline edits reconciles exactly the same way a few seconds of network blip would, just with more potential conflicts to resolve.",
      insightCallout:
        "Treating 'offline' as a first-class state - not an error - is what makes the sync engine feel reliable. The client always has a local, fully-usable copy of the file tree; the network is an optimization for keeping it current, not a requirement for the app to function.",
      newComponents: [
        {
          name: 'Tiering Job',
          description: 'Background process moving cold blocks (no access in N months) from hot object storage to cheaper archival storage, tracked via a last-accessed timestamp per block.',
        },
        {
          name: 'Local Sync Queue',
          description: 'A durable, ordered, on-disk queue on the client that buffers pending block uploads and commits while offline and replays them on reconnect.',
        },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client - offline]:::client
  queue[("Local Sync Queue")]:::storage
  api[Upload API]:::compute
  hot[("Hot Block Store")]:::storage
  cold[("Archival / Cold Storage")]:::storage
  tiering[Tiering Job]:::async

  client -->|"1. Queue commits while offline"| queue
  queue -->|"2. Drain on reconnect"| api
  api -->|"3. Write new blocks"| hot
  tiering -->|"4. Migrate cold blocks"| cold`,
      },
      closingNote:
        'Every core mechanism is now in place - chunking, dedup, delta sync, notification, conflict handling, sharing, and tiering. The final architecture ties all of these services together into one coherent system.'
    },
  ],

  coreFlows: [
    {
      title: 'Edit an Existing File and Sync to Other Devices',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Device A (editor)
  participant Diff as Local Diff Engine
  participant API as Upload API
  participant Blocks as Block Store
  participant Meta as Metadata Service
  participant Notify as Notification Service
  participant B as Device B (watcher)

  A->>Diff: File saved locally
  Diff->>Diff: Rehash, find changed blocks only
  Diff->>API: batch-check changed hashes
  API-->>Diff: missing hash list
  Diff->>Blocks: Upload only missing blocks
  Diff->>Meta: Commit new version (parent=v14)
  Meta-->>Diff: v15 accepted
  Meta->>Notify: Publish change event
  Notify-->>B: Wake long-poll
  B->>Meta: GET /delta?cursor=...
  Meta-->>B: New manifest (v15)
  B->>Blocks: Fetch only new blocks
  B->>B: Reconstruct file locally`,
      },
      nonObviousFailure:
        'What if Device B is offline for six hours and 40 intermediate versions get committed by other devices in the meantime? The delta API must return a manifest for the CURRENT version, not a chain of 40 diffs - the client always resolves to a full block list and downloads whatever subset of blocks it does not already have locally, regardless of how many versions it skipped.',
    },
    {
      title: 'Two Devices Edit the Same File Offline',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Laptop (offline edit)
  participant B as Phone (offline edit)
  participant Meta as Metadata Service
  A->>A: Edit file locally, queue commit (parent=v14)
  B->>B: Edit file locally, queue commit (parent=v14)
  A->>Meta: Reconnects first, commits parent=v14
  Meta-->>A: v15 accepted (fast-forward)
  B->>Meta: Reconnects, commits parent=v14
  Meta-->>B: Rejected - head is now v15, not v14
  B->>B: Save local edit as "report (conflicted copy).pdf"
  B->>Meta: Commit conflicted copy as new file
  Meta-->>B: New file created, both versions preserved`,
      },
      nonObviousFailure:
        "What if the user never notices the conflicted copy and keeps editing the original, now-stale file? Some clients surface a persistent, non-dismissable banner rather than a one-time toast specifically because silent, easily-missed conflict notifications are how users lose real work.",
    },
  ],

  deepDives: [
    {
      title: 'Choosing a Block/Chunk Size',
      problem:
        'Blocks need to be small enough that an edit only invalidates a few of them, but large enough that per-block overhead (a hash, a DB row reference, a network round trip) does not dominate for millions of tiny files.',
      simpleTerms:
        'Too small a block size means a 1KB text file needs dozens of tiny chunks and the bookkeeping costs more than the data. Too large a block size means changing one byte in a 100MB file re-uploads the whole 100MB anyway. 4MB is the sweet spot Dropbox settled on.',
      bad: "Fixed 1-file-1-block (no chunking at all) - this is the naive design; any edit re-uploads the entire file regardless of size.",
      good: "Very small fixed blocks (e.g. 64KB) - great delta granularity, but a 1GB file now has ~16,000 blocks, each needing a hash computation, an existence check, and a manifest entry. Metadata size and request overhead balloon.",
      great:
        "Fixed blocks up to 4MB, which is what Dropbox uses. Large enough that per-block overhead stays a rounding error, small enough that a typical localized edit (a paragraph, a spreadsheet cell, an appended log line) only invalidates 1-2 blocks out of potentially thousands. Some systems (rsync-style, and content-defined chunking used by dedup-heavy backup systems) use variable-size blocks based on content boundaries so an insertion in the middle of a file does not shift every subsequent fixed-size block boundary and break dedup - a real refinement worth mentioning at staff level but unnecessary for most files where edits do not shift byte offsets (spreadsheets, PDFs, most documents rewrite rather than insert-shift).",
    },
    {
      title: 'Detecting Which Blocks Changed Without Re-Reading the Whole File',
      problem:
        "For a multi-gigabyte file, even just reading every byte to rehash it on every save is expensive. How does the client know what to rehash without a full scan being the bottleneck?",
      simpleTerms:
        "The client keeps a cheap local record of the file's previous block boundaries and hashes. On save, most filesystems and editors only touch specific regions, so the client can often skip straight to comparing just those regions instead of rehashing gigabytes.",
      bad: "Full re-chunk and re-hash from byte zero on every save, with no memory of the previous state. Correct, but for a 2GB file this means reading 2GB off disk and hashing it on every keystroke-triggered autosave - unacceptably slow and battery/CPU-hungry on laptops and phones.",
      good: "Rely on filesystem change notifications (inotify/FSEvents) to know a file changed, then re-chunk and hash only that file - better than polling every file on disk, but still does a full re-read of that one file even if only its last 10 bytes changed.",
      great:
        "Keep a local manifest cache (previous block hashes and byte offsets) per file. On save, compare file size and mtime first as a cheap short-circuit; if changed, rehash starting from the region where the file's structure suggests writes typically land (end-of-file for logs, or use OS-level dirty-page/extent hints where available), and stop early once trailing blocks hash-match the cached manifest. This is the same principle rsync uses across a network, applied locally: cheap fingerprint comparison first, expensive full read only for the parts proven to differ.",
    },
    {
      title: 'Preventing Silent Data Loss on Concurrent Edits',
      problem:
        'Two devices editing the same file while disconnected from each other is not a rare edge case at this scale - it happens constantly (laptop + phone, two people sharing a family folder, a background sync agent racing a manual save). The system must never resolve this by quietly discarding one side.',
      simpleTerms:
        "Think of it like two people trying to save the same document at once: whoever clicks save first wins the filename, but the second person's edits still get saved somewhere - just under a different name - instead of vanishing.",
      bad: "Last-write-wins on the metadata row - the second commit simply overwrites the pointer to the block manifest. The first device's changes are still technically in the Block Store (blocks are never deleted eagerly) but nothing in the file tree points to them anymore - functionally lost to the user.",
      good: "Optimistic concurrency check via version/parent number (reject if parent is stale) with the client simply retrying the whole edit from the new head. This avoids overwriting data, but if the two edits genuinely conflict (both changed the same paragraph), a naive retry has nothing sensible to merge and either loses one edit's intent anyway or requires the app to understand the file's internal format, which a generic file-sync engine cannot do for arbitrary binary formats.",
      great:
        "Reject the stale commit and materialize it as a conflicted copy - a full, separate file the user can inspect. For structured, mergeable formats (some office-suite integrations), the sync layer can hand off to an application-aware merge; but the generic, format-agnostic guarantee that scales to any file type is: never delete or silently overwrite unreconciled data, always give the human an explicit artifact to resolve. Google Drive and Dropbox both converge on variants of this - Drive shows a 'conflicting copy created' notice with both versions retained under the same name history.",
    },
  ],

  selfAudit: [
    { question: 'Why chunk files instead of storing them whole?', answer: 'So an edit only re-uploads the changed blocks, and identical blocks across users/files can be deduplicated - both impossible if a file is one opaque blob.' },
    { question: 'How does dedup work without leaking data between users?', answer: 'Blocks are content-addressed and access-agnostic; the metadata layer, not the Block Store, enforces who can resolve a file to its block manifest.' },
    { question: 'How do devices learn about changes quickly?', answer: 'Long-poll (or persistent connection) to a Notification Service that pushes a lightweight "re-sync" signal, avoiding both polling overhead and large push payloads.' },
    { question: 'What happens on a sync conflict?', answer: 'The commit with the stale parent version is rejected and saved as a conflicted copy - never silently overwritten or dropped.' },
    { question: 'Why separate metadata from block storage?', answer: 'Metadata (names, folders, ACLs) is small and read constantly; block content is huge and bulk-transferred. Coupling them forces every rename to pay bulk-storage costs.' },
    { question: 'How is storage cost controlled at exabyte scale?', answer: 'Dedup shrinks the effective footprint, and a tiering job migrates cold, rarely-accessed blocks to cheaper archival storage.' },
    { question: 'What happens while a device is offline?', answer: 'Edits queue in a durable local sync queue and replay through the normal commit + conflict-check path once connectivity returns.' },
    { question: 'What is the single point of failure risk in this design?', answer: 'The Metadata Service is the source of truth for the file tree and versioning - it must be replicated and strongly consistent, since losing it (even briefly) breaks every client\'s ability to resolve files to blocks.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart TD
  client[Desktop/Mobile Client]:::client
  chunker["Chunker + Diff Engine"]:::compute
  queue[("Local Sync Queue")]:::storage
  api[Sync API]:::compute
  meta[Metadata Service]:::compute
  metadb[("Metadata DB<br/>sharded by folder")]:::database
  acl[ACL Service]:::compute
  aclcache[("ACL Cache")]:::cache
  notify[Notification Service]:::async
  changelog[("Change Log")]:::async
  hot[("Hot Block Store")]:::storage
  cold[("Archival Storage")]:::storage
  tiering[Tiering Job]:::async

  client -->|"Read/write files"| chunker
  chunker -->|"Queue while offline"| queue
  queue -->|"Drain on reconnect"| api
  chunker -->|"1. batch-check + upload blocks"| api
  api -->|"2. Store new blocks"| hot
  api -->|"3. Commit version"| meta
  meta -->|"4. Write file tree"| metadb
  meta -->|"5. Permission check"| acl
  acl -->|"6. Cached lookup"| aclcache
  meta -->|"7. Publish change"| changelog
  changelog -->|"8. Notify watchers"| notify
  notify -->|"9. Wake long-poll"| client
  tiering -->|"10. Migrate cold blocks"| cold
  hot -.->|"cold rehydration"| cold`,
  },

  keyTechnologies: [
    { term: 'Content-Addressable Storage', definition: 'Storing data keyed by the hash of its own bytes, so identical content anywhere in the system maps to the same address automatically.' },
    { term: 'Block/Chunk', definition: 'A fixed-size (e.g. 4MB) slice of a file, the atomic unit of storage, transfer, and deduplication.' },
    { term: 'Single-Instance Storage (Dedup)', definition: 'Storing one physical copy of a block even when many files/users reference identical content.' },
    { term: 'Delta Sync', definition: 'Transferring only the changed portion of a file instead of the whole file, based on comparing block hashes against a previous manifest.' },
    { term: 'Long-Poll', definition: "A client holds an HTTP connection open; the server responds only when new data exists, giving near-real-time updates without constant polling." },
    { term: 'Optimistic Concurrency Control', definition: 'Committing a change only if the base version it was built on still matches the current head; otherwise rejecting and reconciling explicitly.' },
    { term: 'Storage Tiering', definition: 'Moving rarely-accessed data to cheaper, higher-latency storage (cold/archival) while keeping hot data on fast storage.' },
    { term: 'Erasure Coding', definition: 'A durability technique (used by systems like Dropbox Magic Pocket) that splits data into fragments with parity so it survives disk/node loss more cheaply than full replication.' },
  ],

  expectedDepth: {
    mid:
      'Propose splitting files into fixed-size blocks and storing them in an object store, with a separate metadata database for the file tree. Understand why re-uploading a whole file on every edit is wasteful, and that content hashing enables basic deduplication. Should be able to sketch upload and download flows.',
    senior:
      'Design the full block-diff sync flow (hash comparison against a previous manifest to find only changed blocks), justify long-poll over polling for change notification, and design optimistic-concurrency conflict detection with conflicted-copy resolution instead of last-write-wins. Should explain why permission checks must live at the metadata layer, not the block layer, given dedup.',
    staffPlus:
      'Address exabyte-scale durability trade-offs (erasure coding vs replication, and why Dropbox built custom storage instead of staying on S3), storage cost optimization via tiering and dedup ratios, multi-region replication of metadata for low-latency global access, notification fan-out cost for folders shared with thousands of watchers, and the operational complexity of safely garbage-collecting blocks that are still referenced by old, unpruned version history.',
  },

  keyTakeaways: [
    'Chunk files into fixed-size, content-addressed blocks - this single decision enables delta sync, dedup, and cheap renames simultaneously',
    'Separate metadata (file tree, names, ACLs) from block storage (raw bytes) - they have completely different access patterns and cost profiles',
    'Push change notifications via long-poll instead of client polling; keep the payload a lightweight signal, not the actual diff',
    'Never resolve concurrent edits with last-write-wins - use optimistic concurrency and materialize conflicts as explicit conflicted copies so no data is silently lost',
    'Permission checks belong at the metadata layer, never at the block layer, because deduplicated blocks are shared across unrelated users\' files',
    'Treat offline as a normal state, not an error - a durable local queue lets clients keep working and reconcile cleanly on reconnect',
  ],

  relatedDesigns: ['collaborative-editing', 'photo-sharing', 'notification-system', 'key-value-store'],
  relatedConcepts: [
    { name: 'Content-Addressable Storage', description: 'The hashing scheme that makes blocks dedupable and delta-syncable.' },
    { name: 'Object Storage', description: 'The underlying blob store holding raw block bytes at scale.' },
    { name: 'Long-Poll / Push Notification', description: 'How devices learn about remote changes without constant polling.' },
    { name: 'Optimistic Concurrency Control', description: 'The versioning check that detects conflicting concurrent writes.' },
    { name: 'Sharding', description: 'How the metadata database scales horizontally as the file tree grows.' },
  ],

  simulator: {
    goalDescription: 'Sync file changes across devices within seconds by moving only changed blocks, while metadata and permission checks stay fast.',
    requirementChips: ['Metadata/API p99 < 200ms', 'Change visible in 2-5s', 'Only changed blocks re-synced'],
    targetRps: 50000,
    readRatio: 0.8,
    cacheHitRatio: 0.9,
    latencyBudgetMsP99: 200,
    rubric: [
      { id: 'metadata-db', label: 'Durable metadata DB for the file tree and ACLs', kind: 'requires-node-type', nodeType: ['postgresql', 'mysql', 'mongodb', 'dynamodb', 'cassandra'] },
      { id: 'block-store', label: 'Content-addressed object store for file blocks', kind: 'requires-node-type', nodeType: 'object-store' },
      { id: 'compute-tier', label: 'Compute tier for the sync/metadata API', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'acl-cache', label: 'Cache for hot ACL/permission lookups', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-metadata-spof', label: 'No single point of failure on the metadata path', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 12, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 2, position: { x: 880, y: 120 } },
        { id: 'pg-1', type: 'postgresql', instanceCount: 12, position: { x: 880, y: 280 } },
        { id: 'obj-1', type: 'object-store', instanceCount: 6, position: { x: 1160, y: 200 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-app', source: 'gw-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-pg', source: 'app-1', target: 'pg-1' },
        { id: 'e-app-obj', source: 'app-1', target: 'obj-1' },
      ],
    },
    referenceArchitectureExplanation:
      'The Metadata Service is the source of truth for the file tree and resolves a file to its block manifest only after an ACL check (cached in Redis for hot lookups); block bytes live in a separate, deduplicated object store reached only through that metadata resolution.',
    failureModeNarratives: {
      'app-server': "The Metadata Service ties file identity to block content for every operation. If its compute tier goes down, clients can neither resolve files to blocks nor commit new versions, even though the Block Store itself may still be healthy.",
    },
    fullDesignLinkSlug: 'cloud-file-storage',
  },
}

export default topic
