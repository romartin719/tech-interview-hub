import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'message-queue',
  title: 'Distributed Message Queue (Kafka)',
  difficulty: 'Advanced',
  icon: 'pi pi-sitemap',
  color: '#7c3aed',
  readTimeMinutes: 30,
  topics: ['Partitioning & Replication', 'Consumer Groups & Offsets', 'Exactly-Once Semantics', 'Log-Structured Storage'],
  companies: ['Apache Kafka', 'RabbitMQ', 'AWS SQS', 'Confluent'],
  prerequisites: ['Key-Value Store', 'Rate Limiter'],
  summary:
    'A distributed message queue like Kafka is a durable, ordered, append-only log split into partitions spread across a broker cluster, where each partition is replicated to a leader and followers so producers can write and consumer groups can read in parallel without losing data when a broker dies.',

  understandingProblem:
    "Most services eventually hit the same wall: Service A needs to tell Service B (and C, and D) that something happened, but A shouldn't have to know who's listening, block until they all confirm, or lose the message if B is down for five minutes. A synchronous HTTP call couples A's uptime to B's uptime and doesn't survive a network blip. A simple queue like SQS solves point-to-point delivery, but the message disappears once one consumer reads it, so you can't have five different teams independently replaying the same event stream. What you actually want is a durable, ordered log that many independent consumer groups can read from at their own pace, replay from history when they need to backfill, and that keeps working when any single machine in the cluster falls over. That's the problem Kafka was built to solve: it's less \"a queue\" and more \"a distributed, replicated commit log that happens to support pub/sub semantics on top.\"",
  realExamples:
    "LinkedIn (Kafka's birthplace) processes over 7 trillion messages a day across thousands of topics for activity tracking, metrics, and log aggregation. Uber runs Kafka clusters handling trillions of messages/day for trip events, pricing, and ETA computation. Netflix uses Kafka for real-time event pipelines feeding hundreds of downstream consumers (recommendations, billing, fraud detection) off the same event stream without those consumers ever calling each other directly.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  producer[Producer]:::client
  server["Single Queue Server<br/>in-memory list"]:::compute
  consumer[Consumer]:::client
  producer -->|"1. push(message)"| server
  server -->|"2. pop(message)"| consumer`,
    },
    whyThisBreaks: [
      'Single process, single machine - one server holding an in-memory list of messages. It crashes (OOM, deploy, hardware fault) and every unconsumed message is gone forever.',
      'One consumer at a time - if the list hands out a message and deletes it on read, only one team can ever process each event. A second team that also cares about "order placed" can\'t get its own copy.',
      'No replay - once popped, the message is gone. If your fraud-detection consumer was down for maintenance and comes back an hour later, it missed everything - no way to rewind.',
      'No ordering guarantee under load - if you naively shard messages across multiple queue servers to scale writes, two events for the same user (e.g. "add to cart" then "checkout") can land on different servers and be processed out of order.',
      'No backpressure signal - producers keep pushing at 50K msgs/sec into an in-memory list with no disk backing; the list grows unbounded until the process OOMs, taking every message with it.',
    ],
    closingNote:
      "We need messages durably written to disk before they're acknowledged, split across multiple machines for throughput, and readable by multiple independent consumers without deleting them on read - that's the shift from \"queue\" to \"replicated, partitioned log,\" and it's the core idea behind Kafka.",
  },

  priorArt: [
    {
      title: 'Apache Kafka (LinkedIn/Confluent)',
      description:
        'Originated at LinkedIn in 2010 to unify activity-stream and operational metrics pipelines. Introduced the partitioned, replicated commit-log model this whole design is based on, and became the de facto standard for high-throughput event streaming. (LinkedIn Engineering blog, Kafka: a Distributed Messaging System for Log Processing, 2011)',
      link: 'https://kafka.apache.org/community/books_and_papers/',
    },
    {
      title: 'RabbitMQ',
      description:
        'A broker built around the AMQP model of exchanges, queues, and routing keys rather than a partitioned log. Optimized for complex routing and per-message acknowledgment rather than raw throughput or long-term replay - messages are typically deleted once acknowledged. (RabbitMQ docs)',
      link: 'https://www.rabbitmq.com/tutorials/amqp-concepts',
    },
    {
      title: 'AWS SQS + SNS',
      description:
        'Fully managed queue (SQS, point-to-point, at-least-once) and topic (SNS, fan-out) primitives. Trades Kafka\'s replay-from-any-offset flexibility for near-zero operational overhead - there is no persistent log you can rewind, just a queue that deletes messages after they are acked or expire. (AWS documentation)',
      link: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html',
    },
    {
      title: 'Amazon Kinesis / Google Pub/Sub',
      description:
        'Managed, partitioned-log-style streaming services that mirror Kafka\'s shard/partition model but as a hosted service - Kinesis shards map almost directly onto Kafka partitions, trading some flexibility (fixed retention windows, provisioned shard throughput) for not having to run brokers yourself. (AWS/Google Cloud docs)',
      link: 'https://docs.aws.amazon.com/streams/latest/dev/introduction.html',
    },
    {
      title: 'Apache Pulsar',
      description:
        'Separates compute (brokers) from storage (a dedicated log layer, BookKeeper), which lets brokers scale and fail independently of where data lives - a direct architectural response to Kafka coupling storage to the broker that owns a partition. (Apache Pulsar docs)',
      link: 'https://pulsar.apache.org/docs/next/concepts-architecture-overview/',
    },
  ],

  coreEntities: [
    { name: 'Topic', description: 'A named, logical stream of events (e.g. "orders.created"). Split into partitions for parallelism.' },
    { name: 'Partition', description: 'An ordered, append-only, immutable log. The unit of parallelism, ordering, and replication.' },
    { name: 'Broker', description: 'A server in the cluster that stores partitions on disk and serves reads/writes for the partitions it hosts.' },
    { name: 'Replica (Leader/Follower)', description: 'A copy of a partition\'s log on a broker. One replica per partition is the leader; the rest are followers.' },
    { name: 'Consumer Group', description: 'A set of consumers that cooperatively divide up a topic\'s partitions to read in parallel, each partition owned by exactly one consumer in the group at a time.' },
    { name: 'Offset', description: 'A monotonically increasing position of a message within a partition - the unit consumers use to track "how far have I read."' },
  ],

  requirements: {
    core: [
      'Durable, ordered publish - producers append messages to a topic partition and get an ack once the write is durably persisted per the configured acknowledgment level',
      'Independent consumer groups - many different consumer groups can read the same topic at their own pace without affecting each other or deleting data for others',
      'Horizontal scalability - both throughput and storage scale by adding brokers and partitions, not by buying a bigger single machine',
      'Configurable replay - consumers can rewind to an earlier offset (or to the start of retention) and reprocess history',
      'Survive broker failure - losing any single broker must not lose committed data or make the cluster unavailable for more than a few seconds',
    ],
    belowTheLine: [
      'Cross-datacenter / geo-replication (MirrorMaker-style active-active or active-passive replication)',
      'Schema enforcement and compatibility checking (Schema Registry)',
      'Tiered storage to cheap object storage for infinite retention',
      'Fine-grained per-message ACLs and multi-tenant quota enforcement',
      'Exactly-once delivery to external, non-Kafka sinks (only exactly-once within Kafka-to-Kafka pipelines is in scope)',
    ],
    nonFunctionalTable: [
      { metric: 'Throughput', target: '1M+ messages/sec sustained per cluster (multi-GB/sec aggregate)' },
      { metric: 'Write latency', target: 'p99 under 10ms for acks=1, under 20-30ms for acks=all with 3 replicas' },
      { metric: 'Durability', target: 'Zero data loss (RPO=0) for acknowledged writes with acks=all and min.insync.replicas=2' },
      { metric: 'Availability', target: 'Cluster stays writable and readable through the loss of any single broker' },
      { metric: 'Retention', target: 'Configurable per topic, commonly 7 days by default, up to unbounded for compacted topics' },
      { metric: 'Consumer scalability', target: 'Support up to (partition count) parallel consumers per group without central bottleneck' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Broker Storage Engine',
      purpose: 'Persist each partition\'s log durably on the broker that owns it',
      primaryPick: 'On-disk sequential log segments (ext4/XFS)',
      alternatives: 'Embedded LSM store (RocksDB), tiered storage to S3 for cold segments',
      whyPrimaryWins: 'Sequential appends run near disk bandwidth limits - hundreds of MB/sec even on commodity hardware - versus the random-access I/O a row-oriented store would need for the same write pattern.',
    },
    {
      tier: 'Metadata & Coordination',
      purpose: 'Track live brokers, partition leadership, and ISR membership cluster-wide',
      primaryPick: 'KRaft (Raft-based controller quorum)',
      alternatives: 'ZooKeeper (legacy), etcd',
      whyPrimaryWins: "KRaft replicates cluster metadata the same way brokers replicate any other partition, scaling past ZooKeeper's roughly 200K-partition ceiling with one fewer distributed system to operate.",
    },
    {
      tier: 'Replication Protocol',
      purpose: 'Survive a broker failure without losing an acknowledged write',
      primaryPick: 'Leader/follower replication with an in-sync replica (ISR) set',
      alternatives: 'Raft consensus per partition',
      whyPrimaryWins: 'Followers replicate through the same pull-based fetch path a consumer uses, and only replicas caught up within the lag window are eligible for promotion, so a stale follower can never become leader and silently drop data.',
    },
    {
      tier: 'Consumer Offset Store',
      purpose: 'Track how far each consumer group has read, per partition',
      primaryPick: 'Internal compacted topic (__consumer_offsets)',
      alternatives: 'External store (Redis, Postgres)',
      whyPrimaryWins: 'Log compaction keeps exactly one live offset per (group, topic, partition), so the checkpoint lives in the cluster itself and survives any single consumer instance restarting or crashing.',
    },
    {
      tier: 'Schema Management',
      purpose: 'Keep producer and consumer schemas compatible as topics evolve',
      primaryPick: 'Confluent Schema Registry',
      alternatives: 'Apicurio, AWS Glue Schema Registry',
      whyPrimaryWins: 'Centralizing compatibility rules at write time stops a producer upgrade from silently breaking a consumer that is still reading the topic under an older schema assumption.',
    },
  ],
  technologyChoicesNote:
    'Why an on-disk append-only log instead of a database? Sequential disk writes run nearly as fast as memory - hundreds of MB/sec even on commodity SSDs - and never overwriting in place is exactly what lets a single partition sustain 10-20K+ messages/sec on ordinary hardware. The OS page cache transparently serves recent reads straight from memory, so hot consumers rarely touch disk at all.',

  scaleEstimation: [
    'Ingestion: 1M events/sec cluster-wide, average message size 1KB -> roughly 1GB/sec of raw producer throughput to absorb',
    'Storage before replication: 1GB/sec x 86,400 sec/day x 7-day retention -> ~605 TB of log data resident at any time',
    'Storage with replication factor 3: ~605 TB x 3 -> ~1.8 PB of disk across the cluster (this is why retention windows and log compaction matter - you cannot keep everything forever)',
    'Partition count: a single partition tops out around 10-20K msgs/sec of write throughput on typical broker hardware, so 1M msgs/sec needs at least ~100 partitions spread across brokers, usually provisioned higher (300-1000+) to leave headroom for consumer parallelism and hot keys',
    'Broker count: with each broker comfortably handling a few hundred partition replicas and ~100-200 MB/sec of disk I/O, a 1M msgs/sec cluster typically lands in the range of 20-50+ brokers',
    'Metadata: a cluster with 1,000 partitions x replication factor 3 = 3,000 replicas the controller must track - this is the exact scaling pressure that pushed Kafka off ZooKeeper (which struggles past roughly 200K partitions cluster-wide) toward the KRaft Raft-based metadata quorum',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/topics/{topic}/produce',
      description: 'Append one or more messages to a topic. The broker hashes the partition key to pick a partition unless one is specified explicitly.',
      example:
        '// Request\n{ "key": "user-42", "value": "{\\"event\\":\\"order_created\\",\\"orderId\\":9931}", "partition": null }\n\n// Response 200\n{ "topic": "orders.created", "partition": 7, "offset": 184320 }',
    },
    {
      method: 'GET',
      path: '/topics/{topic}/partitions/{partitionId}/fetch',
      description: 'Long-poll fetch for messages starting at a given offset. Returns as soon as data is available or a max-wait timeout elapses.',
      example: '// Request\nGET /topics/orders.created/partitions/7/fetch?offset=184310&maxWaitMs=500\n\n// Response 200\n{ "records": [ { "offset": 184310, "key": "user-12", "value": "..." }, ... ], "highWatermark": 184321 }',
    },
    {
      method: 'POST',
      path: '/consumer-groups/{groupId}/offsets/commit',
      description: 'Commit the latest processed offset per partition for a consumer group so the group can resume from there after a restart or rebalance.',
      example: '// Request\n{ "topic": "orders.created", "partition": 7, "offset": 184321 }\n\n// Response 204 No Content',
    },
    {
      method: 'POST',
      path: '/admin/topics',
      description: 'Create a topic with a given partition count, replication factor, and retention policy.',
      example: '// Request\n{ "name": "orders.created", "partitions": 24, "replicationFactor": 3, "retentionMs": 604800000 }\n\n// Response 201\n{ "name": "orders.created", "partitions": 24, "replicationFactor": 3 }',
    },
    {
      method: 'GET',
      path: '/consumer-groups/{groupId}/lag',
      description: 'Return per-partition consumer lag (log end offset minus committed offset) for monitoring and alerting.',
      example: '// Response 200\n{ "groupId": "fraud-detector", "partitions": [ { "partition": 7, "logEndOffset": 184400, "committedOffset": 184321, "lag": 79 } ] }',
    },
  ],
  apiSecurityNote:
    'Producers and consumers authenticate via mTLS or SASL (e.g. SASL/SCRAM or Kerberos) at the connection level, and ACLs scope which principals can produce to or consume from which topics and consumer groups.',

  highLevelDesignIntro:
    "Let's build this up incrementally: turn the single in-memory queue into a partitioned log for throughput, replicate each partition for durability, layer in consumer groups for parallel independent readers, and then work through the mechanics - offsets, delivery semantics, storage, coordination, and backpressure - that make the whole thing actually production-grade.",

  builds: [
    {
      title: 'Topics Split Into Partitions',
      body:
        'A topic (e.g. "orders.created") is never a single log - it\'s split into N partitions, and each partition is its own independent, ordered, append-only log. Producers write messages that get routed to exactly one partition; the routing decision is a hash of the message\'s partition key modulo the partition count (default_partitioner: hash(key) % numPartitions).\n\nThis is the single most important design decision in the whole system: ordering is only guaranteed WITHIN a partition, never across partitions of the same topic. If you key by user ID, every event for user-42 always lands on the same partition and is processed in the order it was produced. But user-42\'s events and user-99\'s events, on different partitions, can be processed in any relative order - and that\'s fine, because nothing required them to be ordered relative to each other in the first place.\n\nExample: topic "orders.created" with 12 partitions. hash("user-42") % 12 = 7, so every order from user-42 always goes to partition 7. hash("user-99") % 12 = 3, so user-99\'s orders always go to partition 3. A consumer reading partition 7 sees user-42\'s orders in the exact sequence they were created; it has no idea what\'s happening on partition 3 and doesn\'t need to.',
      newComponents: [
        { name: 'Topic', description: 'The logical name producers and consumers agree on, e.g. "orders.created".' },
        { name: 'Partitions', description: 'N independent, ordered logs that together make up a topic. The unit of parallelism.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  producer["Producer<br/>key=user-42"]:::client
  hash["hash(key) % 12"]:::compute
  p0["Partition 0"]:::storage
  p3["Partition 3"]:::storage
  p7["Partition 7"]:::storage
  p11["Partition 11"]:::storage
  producer -->|"1. produce(key, value)"| hash
  hash -->|"2. routes to"| p7`,
      },
      closingNote:
        'Partitioning gives us horizontal throughput and per-key ordering, but right now each partition still lives on one machine - lose that machine, lose the partition. Replication is next.',
    },
    {
      title: 'Spreading Partitions Across a Broker Cluster',
      body:
        "A single broker (server) can only push so many MB/sec through its network card and disks. To scale beyond one machine, partitions for a topic get spread across many brokers - partition 0 might live on broker A, partition 1 on broker B, partition 2 on broker C, and so on, round-robin. Producers and consumers don't talk to one central dispatcher; they ask any broker for the current cluster metadata (which broker leads which partition) and then talk directly to the right broker for each partition.\n\nThis is what makes throughput scale roughly linearly with broker count: a 24-partition topic spread across 8 brokers means each broker only handles 3 partitions worth of write and read traffic, not the whole topic.",
      newComponents: [
        { name: 'Broker Cluster', description: 'A pool of servers, each holding a subset of the partitions across all topics.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  producer[Producer]:::client
  b1["Broker 1<br/>partitions 0,3,6,9"]:::compute
  b2["Broker 2<br/>partitions 1,4,7,10"]:::compute
  b3["Broker 3<br/>partitions 2,5,8,11"]:::compute
  producer -->|"1. write partition 7"| b2
  producer -->|"2. write partition 2"| b3
  producer -->|"3. write partition 3"| b1`,
      },
      closingNote:
        "Spreading partitions across brokers fixes the throughput ceiling, but each partition still has exactly one copy - broker 2 dies and every message ever written to partitions 1, 4, 7, and 10 is gone. Replication solves durability.",
    },
    {
      title: 'Leader/Follower Replication Per Partition',
      body:
        "Every partition gets replicated to R brokers (replication factor, commonly 3). One of those replicas is elected the leader; the rest are followers. All producer writes and consumer reads for that partition go through the leader - followers exist purely to replicate the leader's log and stand ready to take over.\n\nFollowers continuously fetch from the leader the exact same way a consumer would (pull-based, not push), appending whatever new records the leader has to their own local log. This keeps the mechanism simple: there's only one code path (\"fetch records starting at offset X\") for both follower replication and normal consumer reads.\n\nWhat happens when a leader dies: the cluster controller detects the failure (missed heartbeats) and promotes one of the in-sync followers to be the new leader - typically within a few seconds. Any writes that were in-flight to the old leader but hadn't yet been acknowledged might be lost or need to be retried by the producer; writes that WERE acknowledged (per the acks setting, covered next) are guaranteed to exist on at least one of the surviving replicas, so no acknowledged data is lost.",
      newComponents: [
        { name: 'Leader Replica', description: 'The single replica of a partition that all producers and consumers read/write through.' },
        { name: 'Follower Replica', description: 'A replica that continuously pulls new records from the leader, ready to be promoted if the leader dies.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  producer[Producer]:::client
  leader["Broker 1<br/>Leader for partition 7"]:::compute
  f1["Broker 2<br/>Follower"]:::compute
  f2["Broker 3<br/>Follower"]:::compute
  consumer[Consumer]:::client
  producer -->|"1. write"| leader
  leader -->|"2. ack"| producer
  f1 -->|"3. fetch new records"| leader
  f2 -->|"4. fetch new records"| leader
  consumer -->|"5. read"| leader`,
      },
      closingNote:
        "Replication protects data even when a broker dies, but 'replicated to a follower' and 'replicated to a follower that's actually caught up' are two very different guarantees. That distinction is the in-sync replica set.",
    },
    {
      title: 'The In-Sync Replica (ISR) Set',
      body:
        "Not every follower is a safe fallback at every moment - one might be lagging behind the leader by network hiccups, disk slowness, or a recent restart still catching up. Kafka tracks, per partition, which replicas are 'in-sync': caught up to within a configurable time window (replica.lag.time.max.ms, default 30 seconds) of the leader's log end. This set is the ISR.\n\nOnly replicas in the ISR are eligible to be promoted to leader on failover - promoting a replica that's 50,000 messages behind would silently lose data. If a follower falls out of sync (network partition, disk saturation), it's dropped from the ISR until it catches back up; the leader keeps accepting writes and acking them based on who's actually still in the ISR, not the full replica set.\n\nThis is also where min.insync.replicas comes in: it's the minimum ISR size required for the leader to accept a write at all when acks=all. With replication factor 3 and min.insync.replicas=2, the leader plus at least one follower must confirm the write - if the ISR shrinks to just the leader (both followers down), writes are rejected outright rather than silently accepted with zero redundancy.",
      insightCallout:
        "ISR is the mechanism, min.insync.replicas is the policy. ISR tracks who's actually caught up right now; min.insync.replicas decides how many caught-up replicas you require before you'll even accept a write.",
      diagram: {
        mermaid: `flowchart TD
  leader["Leader<br/>offset=1000"]:::compute
  f1["Follower A<br/>offset=999<br/>IN ISR"]:::compute
  f2["Follower B<br/>offset=400<br/>lagging 40s - OUT of ISR"]:::compute
  isr["ISR = {Leader, Follower A}"]:::database
  leader -->|"1. tracks lag"| isr
  f1 -->|"2. caught up"| isr
  f2 -.->|"3. dropped - too far behind"| isr`,
      },
      closingNote:
        "With ISR defining who's safe to promote, the next decision is how many of them the producer waits to hear back from before considering a write 'done' - that's the acks setting, and it's the single biggest durability-vs-latency knob in the whole system.",
    },
    {
      title: 'Producer Acknowledgment Levels (acks=0/1/all)',
      body:
        "acks controls how many replicas must confirm a write before the producer gets its ack back, and it's a direct trade of latency for durability.\n\nacks=0 (fire-and-forget): the producer doesn't wait for any broker response at all. Fastest possible, but if the leader hasn't even received the message yet when it crashes, that message is silently gone and the producer never finds out. Used for things like metrics or logs where an occasional dropped sample is a non-issue.\n\nacks=1 (leader-only): the producer waits for the leader to write the message to its own local log, then gets an ack - before any follower has replicated it. If the leader crashes in the split second between acking the producer and a follower fetching that record, the message is lost even though the producer believes it succeeded. This is the default balance most teams pick for general-purpose event streams.\n\nacks=all (a.k.a. acks=-1): the producer waits until every replica currently in the ISR has confirmed the write. Combined with min.insync.replicas=2 on a replication-factor-3 topic, this guarantees the message survives the loss of any single broker, at the cost of an extra network round-trip (leader to followers to leader to producer) - typically adding low-single-digit milliseconds of latency per write.\n\nExample: payment-processing topic uses acks=all + min.insync.replicas=2 - correctness matters more than a few extra milliseconds. A clickstream-analytics topic uses acks=1 - losing an occasional click event to a leader crash is an acceptable trade for lower latency at massive volume.",
      diagram: {
        mermaid: `flowchart LR
  p0["acks=0<br/>no wait<br/>fastest, riskiest"]:::client
  p1["acks=1<br/>wait for leader<br/>balanced default"]:::compute
  pAll["acks=all<br/>wait for full ISR<br/>slowest, safest"]:::database
  p0 -->|"latency"| p1
  p1 -->|"latency"| pAll`,
      },
      closingNote:
        'With durability settled, the read side needs its own scaling story - one consumer reading a 24-partition topic sequentially would be the new bottleneck. Consumer groups fix that.',
    },
    {
      title: 'Consumer Groups Divide Partitions for Parallelism',
      body:
        "A consumer group is a named set of consumer processes that cooperatively split up a topic's partitions - each partition is owned by exactly one consumer within a group at any given time, but a topic can have many independent consumer groups all reading it in parallel, each at its own pace, without affecting the others.\n\nExample: topic \"orders.created\" has 12 partitions. The \"fraud-detection\" consumer group runs 4 consumer processes - the group coordinator assigns 3 partitions to each. The \"analytics-pipeline\" group runs 12 consumers, one partition each, for maximum parallelism. Both groups read the exact same messages independently; neither deletes anything or affects the other's progress.\n\nThe rule that falls out of this: you can't usefully have more consumers in a group than partitions - the 13th consumer in a 12-partition group sits completely idle, since a partition can only be actively read by one consumer in its group at a time (this is also why partition count sets your hard ceiling on consumer-side parallelism, and it's why over-provisioning partitions up front is common practice).",
      newComponents: [
        { name: 'Consumer Group Coordinator', description: 'A broker responsible for assigning partitions to the live members of a specific consumer group.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  subgraph topic["Topic: orders.created (12 partitions)"]
    parts["p0..p11"]:::storage
  end
  subgraph fraud["Consumer Group: fraud-detection"]
    c1["Consumer 1<br/>p0-p2"]:::client
    c2["Consumer 2<br/>p3-p5"]:::client
    c3["Consumer 3<br/>p6-p8"]:::client
    c4["Consumer 4<br/>p9-p11"]:::client
  end
  subgraph analytics["Consumer Group: analytics-pipeline"]
    a1["12 consumers<br/>1 partition each"]:::client
  end
  parts -->|"1. independently read by"| fraud
  parts -->|"2. independently read by"| analytics`,
      },
      closingNote:
        'Static partition assignment works fine until group membership changes - a consumer crashes, a new one joins to scale up, a deploy rolls through. That triggers a rebalance, and rebalances have real, sometimes painful, operational consequences.',
    },
    {
      title: 'Rebalancing on Membership Change',
      body:
        "When a consumer joins or leaves a group (crash, scale-up, deploy, missed heartbeat past session.timeout.ms), the group coordinator has to redistribute partitions among whoever's left. This redistribution is a rebalance, and the naive (original, 'eager') protocol is stop-the-world: every consumer in the group gives up ALL of its partitions, the coordinator recomputes a fresh assignment from scratch, and every consumer picks up its new set - even consumers whose assignment didn't actually change.\n\nDuring an eager rebalance, no partition in the group is being actively consumed for the duration of the rebalance - for a group with dozens of consumers and thousands of partitions, that pause can run into several seconds to (in bad cases) minutes, during which consumer lag spikes across the entire group.\n\nThe fix is the cooperative sticky assignor (Kafka's default since 2.4+): consumers only give up the specific partitions that actually need to move to a different consumer, and keep processing everything else uninterrupted. A rebalance from 4 consumers to 5 now only pauses the ~20% of partitions that are actually being reassigned, not all of them.",
      insightCallout:
        "Interview tip: when asked 'why did our consumer group briefly stop processing during a deploy?' - the answer is almost always a rebalance, and the fix is usually static group membership (group.instance.id) so a rolling restart doesn't look like a member leaving and rejoining, combined with the cooperative sticky assignor.",
      diagram: {
        mermaid: `flowchart TD
  before["4 consumers, 12 partitions<br/>3 each, all actively processing"]:::compute
  event["Consumer 4 crashes"]:::client
  eager["Eager rebalance:<br/>ALL 12 partitions revoked,<br/>whole group pauses"]:::client
  cooperative["Cooperative rebalance:<br/>only the 3 orphaned partitions move,<br/>other 9 keep processing"]:::compute
  before -->|"1. membership change"| event
  event -->|"2. old protocol"| eager
  event -->|"3. modern protocol"| cooperative`,
      },
      closingNote:
        "Rebalances explain WHO processes which partition at any moment, but they don't explain how a consumer remembers what it already processed after a restart. That's offset tracking.",
    },
    {
      title: 'Offset Tracking and Delivery Semantics',
      body:
        "Each consumer group tracks, per partition, the offset of the last message it has committed as processed. This isn't kept in the consumer's memory - it's stored back in Kafka itself, in an internal, compacted topic called __consumer_offsets, keyed by (group, topic, partition). That means any consumer in the group can pick up exactly where another left off after a crash or rebalance, because the checkpoint lives in the cluster, not on any one machine.\n\nThe order of 'process the message' vs 'commit the offset' determines your delivery semantics:\n\nAt-most-once: commit the offset BEFORE processing. If the consumer crashes mid-processing, the offset is already advanced, so that message is skipped on restart - simple, but you can silently drop messages.\n\nAt-least-once (the common default): process the message, THEN commit the offset. If the consumer crashes after processing but before committing, it will reprocess that message on restart - safe against data loss, but your downstream logic must be idempotent (e.g. keyed upserts, not blind increments) or you'll double-count.\n\nExactly-once: requires more than offset ordering - it requires the write of your processed result and the commit of your offset to be atomic together, which is what Kafka's transactional producer API provides for Kafka-to-Kafka pipelines (detailed in the deep dive below).",
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Consumer
  participant B as Broker (leader)
  participant O as __consumer_offsets

  C->>B: fetch(partition=7, offset=184310)
  B-->>C: records up to offset 184320
  C->>C: process records
  C->>O: commit offset=184321
  O-->>C: ack`,
      },
      closingNote:
        "Offsets tell a consumer WHERE it is; they say nothing about how the underlying bytes actually get onto disk fast enough to sustain a million writes a second. That's log-structured storage.",
    },
    {
      title: 'Log-Structured Storage on Disk',
      body:
        "Each partition's log is stored as a sequence of segment files on disk (default 1GB each, log.segment.bytes) rather than in a traditional database table. New messages are always appended to the end of the active (newest) segment - pure sequential writes, which even spinning disks handle at hundreds of MB/sec, versus the random-access I/O a traditional row-oriented database would need for the same write pattern.\n\nReads are equally cheap: a consumer asking for 'everything from offset X' is answered by locating the right segment (via a sparse in-memory offset index) and streaming bytes off disk using zero-copy (sendfile syscall) straight to the network socket, without copying data through user-space buffers at all.\n\nOld segments get deleted once they age out of the retention window (time-based, log.retention.hours, default 7 days) or the partition exceeds a size cap (log.retention.bytes) - whichever limit is configured. Because deletion happens at the granularity of whole segment files, not individual messages, cleanup is just closing a file handle and unlinking it - no per-message bookkeeping.",
      newComponents: [
        { name: 'Segment Files', description: 'Fixed-size chunks (e.g. 1GB) of a partition\'s log on disk. New writes append to the active segment; old segments are dropped wholesale once they age out.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  partition["Partition 7 log"]:::storage
  seg1["segment-0000.log<br/>(sealed, 9 days old)"]:::storage
  seg2["segment-1000.log<br/>(sealed, 3 days old)"]:::storage
  seg3["segment-2000.log<br/>(active, appending)"]:::storage
  partition --> seg1
  partition --> seg2
  partition --> seg3
  seg1 -.->|"1. past 7-day retention - deleted"| gone["deleted"]:::client`,
      },
      closingNote:
        'Sequential disk writes get us raw throughput, but the cluster still needs a source of truth for which broker leads which partition, and who is even a member of the cluster right now - that\'s metadata and coordination.',
    },
    {
      title: 'Metadata and Coordination: ZooKeeper to KRaft',
      body:
        "Someone has to track cluster-wide facts: which brokers are alive, which broker leads each partition, what the current ISR is for every partition, and who runs the controller (the broker responsible for making leadership decisions). Historically Kafka delegated all of this to Apache ZooKeeper - a separate coordination service using ephemeral znodes and watches to detect broker liveness and drive leader election.\n\nZooKeeper worked, but it became Kafka's own scalability ceiling: every partition and its metadata is a znode, and clusters pushing past roughly 200,000 partitions started hitting ZooKeeper write throughput and watch-fanout limits well before Kafka's own brokers were maxed out - plus it meant operating two entirely different distributed systems (Kafka and ZooKeeper) with different failure modes to keep one cluster running.\n\nKRaft (KIP-500, GA in Kafka 3.3, ZooKeeper support fully removed in Kafka 4.0) replaces ZooKeeper with a small quorum of Kafka's own controller nodes running the Raft consensus protocol, storing cluster metadata as an event log (__cluster_metadata) that brokers replicate the same way they'd replicate any other partition. Net effect: one system to operate instead of two, and a metadata log that scales with the same replication mechanics as everything else in the design, comfortably handling millions of partitions.",
      insightCallout:
        "This is a great staff-level interview beat: Kafka literally dogfooded its own architecture to solve its own metadata bottleneck - the controller quorum in KRaft is 'Kafka replicating a partition' applied to the cluster's own metadata.",
      diagram: {
        mermaid: `flowchart LR
  subgraph old["Before: ZooKeeper"]
    zk[("ZooKeeper<br/>ensemble")]:::database
    b1["Broker"]:::compute
    b1 -->|"watch/register"| zk
  end
  subgraph new["After: KRaft"]
    kraft[("Controller quorum<br/>Raft over __cluster_metadata")]:::database
    b2["Broker"]:::compute
    b2 -->|"replicate metadata log"| kraft
  end`,
      },
      closingNote:
        "With coordination solved, the last operational piece is knowing when a consumer group is actually falling behind - and what to do about producers that are outrunning it.",
    },
    {
      title: 'Consumer Lag and Backpressure',
      body:
        "Consumer lag - the gap between a partition's log-end offset (the newest message written) and a consumer group's committed offset (the newest message it has finished processing) - is the single most important health metric in any Kafka deployment. Rising lag means the consumer can't keep up with the producer, and if left unchecked it either delays downstream systems (a fraud-detection consumer running 20 minutes behind means fraud gets caught 20 minutes late) or, if the lag grows past the retention window, causes permanent data loss as old segments age out before that consumer ever reads them.\n\nUnlike a traditional queue, Kafka itself applies no automatic backpressure to producers - the log will happily keep growing (up to disk capacity) even if every consumer group is badly behind. Backpressure has to be handled at the edges: producers can watch broker-reported quotas and slow down, and operators scale consumer groups horizontally (add more consumer instances, up to the partition count) or vertically (speed up per-message processing) in response to lag alerts, typically wired up through metrics tools like Burrow or Kafka's own consumer-group lag exporters feeding into Prometheus/Grafana dashboards with alerting thresholds.",
      diagram: {
        mermaid: `flowchart LR
  producer["Producer<br/>writing at 50K/sec"]:::client
  partition["Partition<br/>log-end offset = 900,000"]:::storage
  consumer["Consumer<br/>committed offset = 850,000"]:::compute
  lag["Lag = 50,000 messages"]:::client
  monitor["Lag monitor / alerting"]:::async
  producer -->|"1. append"| partition
  consumer -->|"2. read+commit"| partition
  partition -->|"3. computes gap"| lag
  lag -->|"4. triggers"| monitor
  monitor -->|"5. scale consumers"| consumer`,
      },
      closingNote:
        'That covers the full lifecycle - partitioning, replication, acks, consumer groups, offsets, storage, coordination, and lag. The remaining nuances (exactly-once, rebalance pauses in more depth, and log compaction) are worth a closer bad/good/great look.',
    },
  ],

  coreFlows: [
    {
      title: 'Producer Publishes a Message',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant P as Producer
  participant META as Cluster Metadata
  participant L as Leader Broker (partition 7)
  participant F1 as Follower Broker A
  participant F2 as Follower Broker B

  P->>META: which broker leads partition 7?
  META-->>P: broker 2
  P->>L: produce(key=user-42, value, acks=all)
  L->>L: append to local log, offset=184320
  F1->>L: fetch (replication pull)
  L-->>F1: records up to 184320
  F2->>L: fetch (replication pull)
  L-->>F2: records up to 184320
  L->>L: ISR = {L, F1, F2} all caught up
  L-->>P: ack (offset=184320)`,
      },
    },
    {
      title: 'Consumer Group Reads and Commits',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Consumer (group=fraud-detection)
  participant COORD as Group Coordinator
  participant L as Leader Broker (partition 7)
  participant O as __consumer_offsets

  C->>COORD: join group, request assignment
  COORD-->>C: assigned partitions [6,7,8]
  C->>L: fetch(partition=7, offset=184310)
  L-->>C: records 184310-184320
  C->>C: process 10 records (idempotent writes)
  C->>O: commit offset=184321
  O-->>C: ack`,
      },
    },
    {
      title: 'Leader Failure and Failover',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant P as Producer
  participant CTRL as Controller (KRaft quorum)
  participant L as Old Leader (broker 2)
  participant F as Follower (broker 3, in ISR)

  P->>L: produce(partition 7)
  L--xL: broker 2 crashes
  CTRL->>CTRL: detect missed heartbeats
  CTRL->>F: promote to leader (was in ISR, fully caught up)
  CTRL->>CTRL: update __cluster_metadata log
  P->>CTRL: refresh metadata - who leads partition 7 now?
  CTRL-->>P: broker 3
  P->>F: retry produce(partition 7)
  F-->>P: ack (offset continues from last durable write)`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Exactly-Once Semantics',
      problem:
        'A consumer processes a batch, writes results downstream, then crashes before committing its offset. On restart it reprocesses the same batch - if "processing" means "increment a counter" or "charge a card," that duplicate is a real bug, not a harmless no-op.',
      bad:
        'Rely purely on at-least-once delivery and hope downstream logic happens to be naturally idempotent. Works by accident for keyed upserts, breaks immediately for anything additive - a payment consumer that reprocesses a batch after a crash double-charges every customer in it.',
      good:
        "Kafka's idempotent producer (enable.idempotence=true, effectively default since Kafka 3.0) tags each message with a producer ID and sequence number, so the broker itself can detect and drop duplicate retries caused by network blips - this eliminates producer-side duplicates from retries, but says nothing about a consumer crashing between processing a message and committing its offset, which is a separate failure entirely.",
      great:
        "Kafka's transactional API wraps a full read-process-write cycle (consume from topic A, produce results to topic B, commit the consumer's offset back to __consumer_offsets) into one atomic transaction, using a transactional.id and a two-phase commit coordinated by a transaction coordinator broker. Either all three things happen (new records visible in B, offset advanced in A) or none do - so a crash mid-cycle results in a full retry of the whole cycle, never a partial, duplicated one. This gives true exactly-once, but only end-to-end within Kafka - the moment you write to a non-transactional external system (a database, an HTTP call), you're back to at-least-once at that boundary unless that system has its own idempotency key.",
      diagram: {
        mermaid: `flowchart TD
  consume["Consume from Topic A<br/>offset=1000"]:::client
  process["Process + produce to Topic B"]:::compute
  commit["Commit offset=1001"]:::storage
  txn["Kafka Transaction:<br/>all three atomic together"]:::database
  consume --> txn
  process --> txn
  commit --> txn
  txn -->|"all succeed or all rollback"| result["No partial duplicates"]:::compute`,
      },
    },
    {
      title: 'Rebalancing Pauses',
      problem:
        'A consumer group with 40 consumers and 400 partitions does a rolling deploy. Each pod restart looks like a member leaving then rejoining, and under the original eager rebalance protocol every single restart triggers a full stop-the-world rebalance across all 400 partitions.',
      bad:
        'Eager rebalancing (the original protocol): on any membership change, every consumer revokes ALL of its partitions and the coordinator recomputes a brand-new assignment from scratch. During a 40-consumer rolling deploy, this can mean 40 separate full-group pauses back to back, each lasting seconds - lag spikes visibly on every dashboard during every deploy.',
      good:
        "Increase session.timeout.ms and use a longer max.poll.interval.ms so transient blips (a slow GC pause, a brief network hiccup) don't get misread as a member leaving at all - this cuts down on unnecessary rebalances, but a real deploy still IS a membership change, so deploys still trigger full eager rebalances; you've just reduced false positives, not fixed the real case.",
      great:
        "Combine static group membership (group.instance.id set per pod, so a restart within session.timeout.ms is recognized as the SAME member returning, not a leave+join) with the cooperative sticky assignor, which only revokes the specific partitions that need to move to a different consumer rather than everyone's partitions. A rolling deploy under this combination barely registers on lag graphs - most partitions never stop being actively consumed at all.",
    },
    {
      title: 'Retention vs Log Compaction',
      problem:
        "A topic tracking 'current account balance per user' is written to on every transaction. Standard time-based retention (delete everything older than 7 days) would eventually delete a user's most recent balance update if they haven't transacted in over a week - exactly the data you can least afford to lose.",
      bad:
        'Standard delete-based retention with a long time window (e.g. keep 5 years of every single balance-update event) so nothing important ages out. Technically preserves the latest value, but storage grows unbounded and, worse, reconstructing "current balance" requires replaying potentially millions of historical events per key instead of a single lookup.',
      good:
        "A periodic batch job that snapshots the latest state per key into a separate, smaller topic or database table, refreshed hourly or daily. Bounds the replay problem, but introduces staleness (up to a full snapshot interval) and a whole separate pipeline that has to be built, monitored, and kept in sync with the source topic.",
      great:
        "Log compaction (cleanup.policy=compact): a background thread continuously rewrites a partition's segments, keeping only the MOST RECENT message for each key and discarding older ones - a user's balance-update topic ends up holding exactly one live record per user, no matter how many updates that user has ever produced. A null value acts as a tombstone, marking a key for eventual removal entirely. This is exactly how Kafka's own __consumer_offsets topic stays small despite constant commits, and it's the standard pattern for changelog topics backing Kafka Streams' KTables.",
    },
  ],

  selfAudit: [
    { question: 'What guarantees ordering?', answer: 'Only within a partition - keyed writes to the same partition stay in order; across partitions there is no ordering guarantee.' },
    { question: 'How does replication survive a leader dying?', answer: 'One of the in-sync followers (ISR) is promoted to leader; acknowledged writes (per the acks setting) are never lost.' },
    { question: 'What is the durability/latency knob?', answer: 'acks: 0 = no wait (fastest, riskiest), 1 = leader only, all = full ISR (slowest, safest) - paired with min.insync.replicas.' },
    { question: 'How do multiple teams read the same topic independently?', answer: 'Consumer groups - each group tracks its own offsets; reading never deletes data for other groups.' },
    { question: 'Why does a consumer group briefly stall during a deploy?', answer: 'A rebalance - fixed by static membership (group.instance.id) plus the cooperative sticky assignor.' },
    { question: 'How do you get exactly-once?', answer: 'Idempotent producer removes duplicate retries; transactions atomically tie consume+produce+offset-commit together for true exactly-once within Kafka.' },
    { question: 'Why is storage just append-only files instead of a database?', answer: 'Sequential disk writes plus zero-copy reads sustain far higher throughput than random-access row storage would.' },
    { question: 'What replaced ZooKeeper and why?', answer: 'KRaft - a Raft-based controller quorum storing metadata as a replicated log, removing an entire second distributed system and scaling past ZooKeeper\'s partition-count ceiling.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  producers[Producers]:::client
  meta[("Controller Quorum<br/>KRaft metadata log")]:::database
  b1["Broker 1<br/>leader p0,p3<br/>follower p1,p4"]:::compute
  b2["Broker 2<br/>leader p1,p4<br/>follower p2,p5"]:::compute
  b3["Broker 3<br/>leader p2,p5<br/>follower p0,p3"]:::compute
  seg1[("Segment files<br/>disk")]:::storage
  seg2[("Segment files<br/>disk")]:::storage
  seg3[("Segment files<br/>disk")]:::storage
  offsets[("__consumer_offsets<br/>compacted topic")]:::storage
  groupA["Consumer Group:<br/>fraud-detection"]:::client
  groupB["Consumer Group:<br/>analytics-pipeline"]:::client
  lagmon["Lag monitoring<br/>+ alerting"]:::async

  producers -->|"1. produce(key, value)"| b1
  producers -->|"2. produce(key, value)"| b2
  b1 -->|"3. replicate"| b3
  b2 -->|"4. replicate"| b3
  b1 --> seg1
  b2 --> seg2
  b3 --> seg3
  b1 -->|"5. metadata"| meta
  b2 -->|"6. metadata"| meta
  b3 -->|"7. metadata"| meta
  groupA -->|"8. fetch + commit"| b1
  groupB -->|"9. fetch + commit"| b2
  groupA --> offsets
  groupB --> offsets
  offsets -->|"10. tracked"| lagmon`,
  },

  keyTechnologies: [
    { term: 'Partition', definition: 'An ordered, append-only, immutable log. The unit of parallelism, ordering, and replication within a topic.' },
    { term: 'ISR (In-Sync Replicas)', definition: 'The subset of a partition\'s replicas that are caught up to the leader within a lag threshold - the only replicas eligible for leader promotion.' },
    { term: 'acks', definition: 'Producer setting controlling how many replicas must confirm a write before it is considered done: 0 (none), 1 (leader only), all (full ISR).' },
    { term: 'Consumer Group', definition: 'A set of consumers that split a topic\'s partitions among themselves; each partition is owned by one consumer in the group at a time.' },
    { term: 'Offset', definition: 'A monotonically increasing position within a partition, used by consumers to track processing progress; committed to the __consumer_offsets topic.' },
    { term: 'Rebalance', definition: 'The process of reassigning partitions among consumers when group membership changes; can briefly pause processing depending on the assignor protocol.' },
    { term: 'Log Compaction', definition: 'A retention strategy that keeps only the latest message per key instead of deleting by age, used for changelog-style topics.' },
    { term: 'KRaft', definition: 'Kafka\'s Raft-based metadata quorum that replaced ZooKeeper for tracking cluster metadata and controller election.' },
  ],

  expectedDepth: {
    mid:
      'Explain that a topic is split into partitions for parallelism, that ordering only holds within a partition, and that replication (leader + followers) is what survives a broker dying. Know that consumer groups split partitions among consumers and that offsets track read progress.',
    senior:
      'Articulate the acks=0/1/all tradeoff paired with min.insync.replicas, explain the ISR mechanism and what happens during leader failover, and reason about at-most-once vs at-least-once vs exactly-once in terms of the ordering of processing and offset commits. Should know what triggers a rebalance and why it can briefly pause processing.',
    staffPlus:
      "Discuss capacity planning (partition count vs per-partition throughput ceiling, broker count, replication factor's storage multiplier), the KRaft migration and why ZooKeeper became a bottleneck at scale, log compaction for changelog/state-store use cases, consumer lag as an operational SLO with concrete alerting thresholds, and the boundary of exactly-once guarantees when a pipeline crosses out of Kafka into external systems.",
  },

  keyTakeaways: [
    'Ordering is per-partition only - never assume ordering across partitions of the same topic',
    'acks + min.insync.replicas is the core durability/latency dial: acks=all with min.insync.replicas=2 survives any single broker loss',
    'Consumer groups let many independent readers replay the same topic without deleting data or affecting each other',
    'At-least-once with idempotent downstream writes is the pragmatic default; true exactly-once needs Kafka transactions and only holds end-to-end within Kafka',
    'Sequential append-only disk writes plus zero-copy reads are why Kafka out-throughputs a database-backed queue by orders of magnitude',
    'Consumer lag is the health metric that matters most - it turns "keeping up" from a vague feeling into a number you can alert on',
  ],

  relatedDesigns: ['notification-system', 'delayed-trigger-service', 'social-feed', 'job-scheduler'],
  relatedConcepts: [
    { name: 'Replication', description: 'Leader/follower replication and the ISR set are the durability backbone of every partition.' },
    { name: 'Consistent Hashing', description: 'Partition-key hashing is a simpler cousin of consistent hashing used to route messages deterministically.' },
    { name: 'Consensus', description: 'KRaft\'s controller quorum uses Raft consensus to keep cluster metadata consistent across controller nodes.' },
    { name: 'Idempotency', description: 'At-least-once delivery only becomes safe once downstream consumers are written to be idempotent.' },
  ],

  simulator: {
    goalDescription: 'Sustain durable, ordered writes into a partitioned, replicated broker cluster that many independent consumer groups can read from in parallel.',
    requirementChips: ['1M+ msgs/sec', 'p99 write < 20ms (acks=all)', 'Survive any single broker loss'],
    targetRps: 1000000,
    readRatio: 0.7,
    cacheHitRatio: 0,
    latencyBudgetMsP99: 20,
    rubric: [
      { id: 'broker-cluster', label: 'Durable, replicated broker cluster (Kafka)', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'consumer-tier', label: 'Consumer group(s) processing the log', kind: 'requires-node-type', nodeType: ['worker', 'app-server', 'microservice'] },
      { id: 'producer-to-broker', label: 'Producers write directly into the broker cluster', kind: 'requires-connected-pair', fromType: 'client', toType: 'kafka' },
      { id: 'broker-to-consumer', label: 'Consumers read from the broker cluster', kind: 'requires-connected-pair', fromType: 'kafka', toType: 'worker' },
      { id: 'handles-load', label: 'Handles the target throughput with no red bottleneck', kind: 'no-bottleneck' },
      { id: 'no-single-broker', label: 'No single point of failure in the broker tier', kind: 'no-spof' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 30, position: { x: 360, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 4, position: { x: 680, y: 120 } },
        { id: 'worker-2', type: 'worker', instanceCount: 12, position: { x: 680, y: 280 } },
      ],
      edges: [
        { id: 'e-client-kafka', source: 'client-1', target: 'kafka-1' },
        { id: 'e-kafka-worker1', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-kafka-worker2', source: 'kafka-1', target: 'worker-2' },
      ],
    },
    referenceArchitectureExplanation:
      'Producers write directly to partition leaders in the broker cluster, and each partition is replicated across brokers for durability. Independent consumer groups (e.g. fraud-detection, analytics-pipeline) each maintain their own offsets and read the same log without affecting each other.',
    failureModeNarratives: {
      kafka:
        'If the broker cluster is under-provisioned, partition leaders concentrate on fewer machines, so losing a single broker takes leadership for many partitions offline at once until followers are promoted.',
    },
    fullDesignLinkSlug: 'message-queue',
  },
}

export default topic
