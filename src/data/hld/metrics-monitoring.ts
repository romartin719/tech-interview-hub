import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'metrics-monitoring',
  title: 'Metrics Monitoring (Datadog / Prometheus)',
  difficulty: 'Advanced',
  icon: 'pi pi-chart-bar',
  color: '#84cc16',
  readTimeMinutes: 28,
  topics: ['Time-Series Databases', 'Gorilla Compression', 'Cardinality Management', 'PromQL Aggregation'],
  companies: ['Datadog', 'Prometheus', 'Grafana', 'New Relic'],
  prerequisites: ['Key-Value Store', 'Message Queues'],
  summary:
    'A metrics monitoring platform ingests millions of timestamped numeric data points per second from a fleet of hosts, packs them into a purpose-built time-series database using delta and XOR compression, and lets engineers query, aggregate, and alert on that stream in near real time.',

  understandingProblem:
    "Every server, container, and service in a modern fleet is constantly emitting numbers - CPU usage, request latency, queue depth, error counts - and someone needs to know the instant those numbers go sideways. A metrics monitoring system like Datadog or Prometheus exists to answer three questions continuously, at massive scale: what is happening right now across thousands of machines, what did it look like an hour or a month ago, and should a human get paged about it. The hard part isn't storing a number with a timestamp - it's doing that for tens of millions of numbers every second, keeping years of history queryable without going bankrupt on storage, and evaluating alert rules against a stream that never stops moving. This is fundamentally a write-optimized, time-ordered, multi-dimensional data problem, and it needs its own kind of database to solve it.",
  realExamples:
    "Datadog ingests well over 100 trillion data points a day across its customer base and bills 'custom metrics' by unique tag combination, which is precisely the cardinality problem this design has to manage. Prometheus, the CNCF-standard for Kubernetes monitoring, is commonly configured to scrape each target every 10-30 seconds and defaults to 15 days of local retention. New Relic and Grafana Cloud both run multi-tenant versions of the same architecture at petabyte scale.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  host1["Host 1 agent"]:::client
  host2["Host 2 agent"]:::client
  api["API Server"]:::compute
  db[("Postgres<br/>metric_name, timestamp, value, host")]:::database
  host1 -->|"INSERT row"| api
  host2 -->|"INSERT row"| api
  api --> db`,
    },
    whyThisBreaks: [
      "Write volume - one host emitting 200 metrics every 15 seconds is ~1.15M row-inserts/day just from that host. A 10,000-host fleet is 11.5 billion INSERTs/day, which no relational database's B-tree indexes can sustain without falling over.",
      'Index bloat - a B-tree index on (metric_name, timestamp) has to be rebalanced on every insert. Under constant high-throughput writes the index becomes the bottleneck, and autovacuum can never keep up with the dead tuple churn from updates and deletes.',
      "Storage cost - storing a timestamp (8 bytes) and a value (8 bytes) as a plain row with per-row overhead (MVCC headers, indexes) costs 40-60 bytes per data point instead of the 1-2 bytes a real time-series engine achieves. At 1M points/sec that is the difference between roughly 100GB/day and several terabytes/day.",
      "Query pattern mismatch - a dashboard asking for 'p99 latency for service X over the last hour, aggregated by region' has to scan and aggregate millions of individual rows on the fly. A relational engine has no concept of 'this data is already sorted by time and mostly append-only,' so it can't exploit that shape.",
      "Tag explosion - the moment you want to filter or group by an arbitrary combination of dimensions (host, region, endpoint, status code), you either need a wide table with dozens of nullable columns or a key-value tags table that requires a join on every single query, both of which get slower as the fleet grows.",
    ],
    closingNote:
      "A relational database treats every metric as an independent row; it has no idea that the same series - the same metric name plus the same set of tags - was written a second ago and will be written again a second from now. We need storage that is built around that time-ordered, append-mostly shape from the ground up. That is exactly what a time-series database (TSDB) is.",
  },

  priorArt: [
    {
      title: 'Prometheus',
      description:
        'Pulls (scrapes) metrics from targets it discovers via Kubernetes/Consul/EC2 service discovery, stores them in a local embedded TSDB with a write-ahead log and immutable on-disk blocks, and exposes PromQL for aggregation. The de facto standard for cloud-native monitoring. (Prometheus documentation)',
      link: 'https://prometheus.io/docs/',
    },
    {
      title: 'Facebook Gorilla',
      description:
        'The 2015 VLDB paper that popularized delta-of-delta timestamp encoding and XOR-based float compression for in-memory time series, achieving an average of 1.37 bytes per compressed data point versus 16 bytes raw. Nearly every modern TSDB (Prometheus, InfluxDB, VictoriaMetrics) borrows this scheme. (Pelkonen et al., Facebook Engineering, VLDB 2015)',
      link: 'https://www.vldb.org/pvldb/vol8/p1816-teller.pdf',
    },
    {
      title: 'Datadog Agent / StatsD',
      description:
        "Runs a lightweight agent on every host that pushes metrics over UDP using the StatsD line protocol, aggregating client-side before sending upstream. Push-based, so it works fine through NAT and for short-lived containers that would never survive to be scraped. (Datadog Engineering blog)",
      link: 'https://www.datadoghq.com/blog/engineering/performance-improvements-in-the-datadog-agent-metrics-pipeline/',
    },
    {
      title: 'InfluxDB (TSM Engine)',
      description:
        'Time-Structured Merge tree - an LSM-style engine specialized for time series, with per-series compression and a dedicated index for tag-based lookups, showing the same memtable-plus-immutable-file pattern used by general key-value stores adapted for timestamped data. (InfluxData engineering blog)',
      link: 'https://www.influxdata.com/blog/new-storage-engine-time-structured-merge-tree/',
    },
    {
      title: 'Amazon CloudWatch / Timestream',
      description:
        'Demonstrates automatic tiered retention out of the box - recent data at full resolution, older data automatically rolled up - so customers never have to manually manage downsampling jobs. (AWS documentation)',
      link: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html',
    },
  ],

  coreEntities: [
    { name: 'Metric', description: 'A named measurement, e.g. http.request.duration or system.cpu.usage.' },
    { name: 'Tag / Label', description: 'A key-value dimension attached to a data point, e.g. host=web-42, region=us-east.' },
    { name: 'Series', description: 'One unique combination of metric name + tag set. Each series is its own independent, time-ordered stream of points.' },
    { name: 'Data Point', description: 'A single (timestamp, value) pair belonging to a series.' },
    { name: 'Rollup', description: 'A downsampled aggregate (e.g. 5-minute average) of a raw series, used for long-term storage.' },
    { name: 'Alert Rule', description: 'A continuously evaluated expression over one or more series that fires a notification when a condition holds.' },
  ],

  requirements: {
    core: [
      'Ingest data points at high throughput from thousands of hosts and services, tagged with arbitrary key-value dimensions',
      'Store time-series data durably and compactly enough to keep months of history affordable',
      'Query and aggregate across time ranges and tag dimensions - rate(), sum by(), percentiles - fast enough for interactive dashboards',
      'Continuously evaluate alerting rules against the live stream and notify humans within seconds of a threshold breach',
      'Automatically downsample old data so storage cost stays roughly flat as retention grows',
    ],
    belowTheLine: [
      'Distributed tracing and log correlation (separate systems that link to metrics by trace ID)',
      'ML-based anomaly detection (forecasting, seasonality-aware baselines)',
      'Multi-year audit-grade raw retention',
      'The dashboarding UI itself',
      'Log aggregation and full-text search',
      'Per-tenant billing and quota enforcement',
    ],
    nonFunctionalTable: [
      { metric: 'Ingestion throughput', target: 'Tens of millions of data points/sec across the fleet, no data loss under normal operation' },
      { metric: 'Write-to-query lag', target: 'New points queryable within a few seconds of ingestion' },
      { metric: 'Query latency', target: 'P99 under 1-2 seconds for a dashboard panel spanning a day of data' },
      { metric: 'Storage efficiency', target: 'Roughly 1-2 bytes per compressed data point, not the 16 bytes raw' },
      { metric: 'Alert latency', target: 'Threshold breaches detected and notified within 30-60 seconds' },
      { metric: 'Cardinality ceiling', target: 'Bound the number of active series per tenant to protect shared memory' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Ingestion Buffer',
      purpose: 'Absorbs bursty write traffic between the ingestion gateway and storage writers',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Pulsar, Redis Streams',
      whyPrimaryWins: 'A durable, ordered log lets storage writers consume at whatever pace the TSDB can sustain, so a deploy-triggered burst of agent retries gets buffered instead of dropped or blocking the caller',
    },
    {
      tier: 'Time-Series Storage Engine',
      purpose: 'Durable, compressed storage of the head block plus historical on-disk blocks',
      primaryPick: 'Prometheus-style embedded TSDB / VictoriaMetrics',
      alternatives: 'InfluxDB, TimescaleDB, M3DB',
      whyPrimaryWins: 'Gorilla-style delta-of-delta timestamp and XOR value encoding gets a point down to ~1.37 bytes from 16 bytes raw - no general-purpose database exploits the append-only, time-ordered shape of this data anywhere close to that well',
    },
    {
      tier: 'Downsampling / Rollup Job',
      purpose: 'Continuously ages raw blocks into 5-minute and 1-hour aggregates so retention stays affordable',
      primaryPick: 'Flink / Kafka Streams',
      alternatives: 'Spark Structured Streaming, a custom cron-based rollup worker',
      whyPrimaryWins: 'Streaming aggregation keeps rollups continuously current rather than running as a batch job that lags behind query needs, and it reads directly off the same ingestion pipeline already in place',
    },
    {
      tier: 'Query Engine',
      purpose: 'Resolves label selectors, applies rate()/sum by()/percentile functions, and picks raw vs rollup blocks per time range',
      primaryPick: 'PromQL-compatible query engine',
      alternatives: 'InfluxQL, custom SQL over the TSDB',
      whyPrimaryWins: "PromQL's label-selector and range-vector model is the de facto standard this design already assumes in its own API interface (query_range, rate(), sum by())",
    },
    {
      tier: 'Alert Rule Evaluator',
      purpose: 'Continuously re-checks active alert rules against the live ingestion stream, not cold storage',
      primaryPick: 'Custom stateful rule evaluator + Alertmanager',
      alternatives: 'Prometheus Alertmanager alone, a scheduled batch query job',
      whyPrimaryWins: 'Reading the head block directly on a 15-30s cadence, independent of dashboard query load, is what keeps alert latency in the 30-60s target instead of being at the mercy of whatever else is querying the system',
    },
    {
      tier: 'Series / Cardinality Metadata Store',
      purpose: 'Tracks metric names, tag indexes, and active series counts for cardinality enforcement',
      primaryPick: 'Postgres / Elasticsearch',
      alternatives: 'Cassandra',
      whyPrimaryWins: "Cardinality explosion is the single most common cause of monitoring outages by this design's own analysis, so tracking active series count and tag-value allow-lists needs its own durable, queryable index separate from the hot ingestion path",
    },
  ],
  technologyChoicesNote:
    'Why a purpose-built TSDB over Postgres? Time-series workloads are append-only writes that never update old data, are almost always queried by time range, and compress dramatically under delta encoding - a purpose-built engine exploits that shape for roughly 10-50x better write throughput and 5-10x better compression than a row-based relational database. TimescaleDB (a Postgres extension with TSDB optimizations) is the middle ground worth knowing if operational simplicity matters more than squeezing out the last bit of compression.',

  scaleEstimation: [
    'Fleet: 20,000 hosts x ~200 metrics/host (system + application), scraped/pushed every 15s -> ~267,000 points/sec from infrastructure metrics alone',
    'Custom application metrics with richer tagging typically add another 5-10x on top -> 1-2M points/sec sustained at a mid-size company',
    'Raw storage without compression: 16 bytes/point (8-byte timestamp + 8-byte float) x 1M points/sec = 16MB/sec = ~1.3TB/day',
    'With Gorilla-style compression averaging ~1.37 bytes/point (a ~12x reduction), the same stream costs roughly 110-120GB/day',
    'Retention tiering: 15 days of raw high-resolution data, 13 months of 5-minute rollups, multi-year 1-hour rollups - keeps total storage roughly flat instead of growing linearly forever',
    'Active series (cardinality): a healthy fleet might sit at 5-20M active series; an incautious high-cardinality tag can push that into the hundreds of millions overnight',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/series',
      description: 'Push a batch of data points (Datadog-agent style ingestion).',
      example:
        '// Request\n{ "series": [ { "metric": "app.request.duration", "points": [[1750000000, 42.3]], "tags": ["host:web-12", "region:us-east"] } ] }\n\n// Response 202\n{ "status": "accepted" }',
    },
    {
      method: 'GET',
      path: '/metrics',
      description: 'Pull-style scrape endpoint exposed by an instrumented service, in Prometheus text exposition format.',
      example: '// Response 200 (text/plain)\nhttp_requests_total{method="GET",status="200"} 8431\nhttp_requests_total{method="POST",status="500"} 12',
    },
    {
      method: 'GET',
      path: '/api/v1/query_range',
      description: 'PromQL-style range query with aggregation.',
      example:
        '// Request\nGET /api/v1/query_range?query=rate(http_requests_total[5m])&start=1750000000&end=1750003600&step=60\n\n// Response 200\n{ "result": [ { "metric": {"method":"GET"}, "values": [[1750000000, "12.4"], [1750000060, "13.1"]] } ] }',
    },
    {
      method: 'POST',
      path: '/api/v1/rules',
      description: 'Create or update an alerting rule.',
      example:
        '// Request\n{ "expr": "rate(http_requests_total{status=\\"500\\"}[5m]) > 10", "for": "2m", "notify": ["#oncall-slack"] }\n\n// Response 201\n{ "ruleId": "rule_88f2" }',
    },
    {
      method: 'GET',
      path: '/api/v1/rules/{id}/alerts',
      description: 'Fetch currently firing or pending alerts for a rule.',
      example: '// Response 200\n{ "alerts": [ { "state": "firing", "since": 1750001000, "labels": {"service":"checkout"} } ] }',
    },
  ],
  apiSecurityNote:
    'Ingestion uses per-team API keys scoped to write-only; query and rule endpoints require RBAC since dashboards routinely expose sensitive infrastructure and business data across a shared, multi-tenant backend.',

  highLevelDesignIntro:
    "Let's build this incrementally: get data points flowing in reliably, give them a storage engine that actually fits their shape, compress them aggressively, defend against the single failure mode that has taken down more monitoring systems than any other, then layer on querying, retention, and alerting.",

  builds: [
    {
      title: 'Decoupling Ingestion from Storage',
      body:
        "Thousands of hosts pushing metrics at once means bursty, spiky write traffic - a deploy, a mass restart, or a network blip can cause every agent to retry simultaneously. Writing straight into the storage engine on the ingestion path means a storage hiccup becomes an ingestion outage, and a traffic spike can overwhel the database mid-write.\n\nThe fix: put a message queue between the ingestion gateway and the storage writers. Agents push to a stateless, horizontally-scaled gateway that does light validation (auth, basic schema checks) and immediately appends to Kafka. A separate pool of storage-writer workers consumes from Kafka at whatever pace the TSDB can sustain, so a burst gets buffered instead of dropped or blocking the caller.",
      newComponents: [
        { name: 'Ingestion Gateway', description: 'Stateless fleet that authenticates and validates incoming points, then appends them to a buffer.' },
        { name: 'Kafka (metrics buffer)', description: 'Durable, ordered buffer that absorbs bursty write traffic and lets storage writers consume at a sustainable pace.' },
        { name: 'Storage Writer Pool', description: 'Consumes batches from Kafka and appends them into the time-series storage engine.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  agents["Host Agents"]:::client
  gw["Ingestion Gateway"]:::edge
  kafka[("Kafka<br/>metrics topic")]:::async
  writers["Storage Writer Pool"]:::compute
  tsdb[("TSDB")]:::database
  agents -->|"1. POST /v1/series"| gw
  gw -->|"2. append"| kafka
  kafka -->|"3. consume batch"| writers
  writers -->|"4. write"| tsdb`,
      },
      closingNote:
        'With ingestion decoupled from storage, the next question is how data actually gets from the source to the gateway in the first place - and there are two fundamentally different models for that.',
    },
    {
      title: 'Push vs Pull: Two Ingestion Models',
      body:
        "Datadog's agent pushes; Prometheus pulls. Both are production-proven at massive scale, and the choice shapes almost everything downstream.\n\nPush (StatsD/Datadog Agent): an agent runs alongside the app and sends data points to a central collector, typically over UDP or a lightweight HTTP call. It works through NAT and firewalls since only the agent needs outbound connectivity, and it naturally supports short-lived jobs (a serverless function or batch job that lives for 3 seconds can still emit a metric before it dies). The cost: there is no free 'target is down' signal - silence looks identical to 'everything is fine' - so you need a separate staleness/heartbeat mechanism, and the central collector must defend itself against thousands of agents pushing simultaneously with its own backpressure and rate limiting.\n\nPull (Prometheus): the monitoring server discovers targets via service discovery (Kubernetes API, Consul, EC2 tags) and scrapes each one's /metrics endpoint on a fixed interval. This gives you a free health signal for free - a failed scrape IS the down signal - and the server controls its own load, since it decides the scrape rate rather than being at the mercy of however fast clients want to push. The cost: it needs network reachability to every target (awkward through NAT, cross-region, or serverless), and truly ephemeral jobs that don't live long enough to be scraped need a workaround (Prometheus's own Pushgateway exists specifically to plug this gap).",
      insightCallout:
        "Most production setups end up hybrid: pull for long-lived infrastructure (pods, VMs, containers) where service discovery and free health-checking are valuable, push for ephemeral or edge workloads (serverless functions, mobile/IoT clients, anything behind a firewall) where reachability from a central scraper is impossible.",
      diagram: {
        mermaid: `flowchart LR
  subgraph pushModel["Push"]
    agent["App + Agent"]:::client
    collector["Central Collector"]:::edge
    agent -->|"1. push over UDP/HTTP"| collector
  end
  subgraph pullModel["Pull"]
    sd["Service Discovery"]:::async
    scraper["Prometheus Server"]:::edge
    target["/metrics endpoint"]:::client
    sd -->|"2. discover targets"| scraper
    scraper -->|"3. GET /metrics"| target
  end`,
      },
      closingNote:
        "Whichever model gets the bytes in the door, the same question follows: what does the data look like once it lands, and why can't we just store it like any other table?",
    },
    {
      title: 'The Time-Series Data Model',
      body:
        "A data point is a metric name, a set of tags (key-value dimensions), a timestamp, and a numeric value - for example http_requests_total with tags method=GET, status=200, endpoint=/api/users, at time T, value 8431. The critical shift in thinking: every unique combination of metric name plus tag set is its own series, and each series is an independent, strictly time-ordered, append-only stream.\n\nThis is fundamentally different from a relational table. A relational table's rows are logically unordered and any row can be updated at any time. A time series is the opposite on both counts: points arrive roughly in timestamp order and are essentially immutable once written (you don't go back and edit yesterday's CPU usage). That immutability and ordering is exactly what a specialized storage engine can exploit - it's why a TSDB can get away with compressing entire runs of points instead of storing each one independently.",
      newComponents: [
        { name: 'Series Index', description: 'Maps a metric name + tag set to the on-disk/in-memory location of that series\' data.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  metric["http_requests_total"]:::client
  s1["Series A: method=GET, status=200"]:::database
  s2["Series B: method=POST, status=500"]:::database
  s3["Series C: method=GET, status=404"]:::database
  metric --> s1
  metric --> s2
  metric --> s3
  s1 --> p1["(t1, 8420) (t2, 8431) (t3, 8447) ..."]:::cache
  s2 --> p2["(t1, 11) (t2, 12) (t3, 12) ..."]:::cache`,
      },
      closingNote:
        "Once you accept that a series is an independent, ordered, mostly-immutable stream, the storage engine design almost falls out of the shape of the problem.",
    },
    {
      title: 'A Storage Engine Built for Time',
      body:
        "The engine mirrors the same memtable-plus-immutable-block pattern used by write-optimized key-value stores, adapted for time-ordered data. New points for every active series land first in an in-memory head block, backed by a write-ahead log (WAL) so a crash doesn't lose unflushed data. Every couple of hours, the head block is sealed and flushed to disk as an immutable block - a chunk of fully compressed, read-only data covering that time window. A background process periodically compacts adjacent blocks together to reduce the number of files and improve query locality, exactly the compaction step in an LSM tree.\n\nThis is essentially how Prometheus's own local TSDB works: a 2-hour head block plus WAL in memory, and a sequence of immutable on-disk blocks that get compacted over time. Reads for recent data hit the head block; reads for historical data hit the sealed blocks, using the series index to jump straight to the relevant chunks instead of scanning everything.",
      newComponents: [
        { name: 'Head Block (in-memory)', description: 'Holds the most recent 1-2 hours of points per series, backed by a WAL for crash recovery.' },
        { name: 'Immutable On-Disk Blocks', description: 'Sealed, compressed chunks of historical data, periodically merged by a background compaction process.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  writer["Storage Writer"]:::compute
  wal[("WAL")]:::async
  head[["Head Block<br/>in-memory, last 2h"]]:::cache
  block1[("Block: 00:00-02:00")]:::database
  block2[("Block: 02:00-04:00")]:::database
  compacted[("Compacted Block: 00:00-04:00")]:::database
  writer --> wal
  writer --> head
  head -->|"flush at 2h boundary"| block1
  block1 -->|"compaction"| compacted
  block2 -->|"compaction"| compacted`,
      },
      closingNote:
        'A storage engine shaped for time gets you fast, ordered writes. But it still stores a raw 8-byte timestamp and 8-byte value per point - 16 bytes each. At millions of points/sec that is terabytes a day. Compression is where the real savings live.',
    },
    {
      title: 'Compression: Delta-of-Delta and Gorilla',
      body:
        "Timestamps within a series almost always arrive at a fixed interval - every 15 seconds, say. Instead of storing each 8-byte timestamp in full, store the delta between consecutive timestamps, then the delta of THOSE deltas (delta-of-delta). If the interval never wavers, every delta-of-delta after the first point is exactly zero, and Facebook's Gorilla paper encodes that zero case in a single bit.\n\nValues compress differently: consecutive readings from the same series (CPU usage, request latency) tend to be close to each other. Gorilla XORs each value with the previous one and encodes only the meaningful bits - if the XOR result has a lot of leading and trailing zero bits (which it usually does for slowly-changing metrics), you only need to store the handful of bits that actually changed plus a short header describing where they are.\n\nCombined, the Gorilla paper reports an average of 1.37 bytes per compressed data point versus 16 bytes raw - better than a 12x reduction - and this scheme (or a close variant) is now standard in Prometheus, InfluxDB, and VictoriaMetrics.",
      insightCallout:
        "Delta-of-delta timestamp encoding plus XOR value encoding is why a single point costs roughly 1-2 bytes instead of 16 - this is the single most important storage-efficiency fact to know cold in an interview for this topic.",
      diagram: {
        mermaid: `flowchart TD
  raw["Raw point: (timestamp, value)<br/>16 bytes"]:::client
  dod["Delta-of-delta timestamp<br/>often 0 -> 1 bit"]:::compute
  xor["XOR value vs previous<br/>mostly zero bits -> few bits"]:::compute
  compressed["Compressed point<br/>~1.37 bytes average"]:::cache
  raw --> dod
  raw --> xor
  dod --> compressed
  xor --> compressed`,
      },
      closingNote:
        "Compression solves the cost of storing each point, but there's a much bigger threat to a TSDB's memory and stability that has nothing to do with per-point size: the number of distinct series itself.",
    },
    {
      title: 'The Cardinality Explosion Problem',
      body:
        "Every unique combination of metric name and tag values creates a brand new series, and each series needs its own slice of memory in the head block, its own entry in the series index, and its own compressed chunk on disk. A metric with tags method (5 values) x status (10 values) x endpoint (20 values) is a very manageable 1,000 series. Add one incautious tag - say user_id, with 5 million distinct users, or request_id, which is unique per request by definition - and that same metric becomes 5 million to effectively unbounded series overnight.\n\nConcretely: http_requests_total{method,status,endpoint} sitting at 1,000 series consumes a few megabytes of head-block memory. Tag it with user_id and it explodes to 5,000,000 series; at roughly 2-4KB of overhead per active series in the head block (series metadata, index entries, chunk headers), that is 10-20GB of memory for ONE metric, enough to OOM-kill the TSDB process outright. This is not a hypothetical - it is one of the most common real-world causes of monitoring outages, and Prometheus's own documentation explicitly warns against using labels with unbounded or high-cardinality values for exactly this reason. Datadog sidesteps the memory-crash version of this problem by billing custom metrics per unique tag combination instead - which turns the same mistake into a five-figure invoice rather than an outage.",
      insightCallout:
        "The fix is almost never architectural - it's operational: enforce tag-value allow-lists or cardinality quotas at the ingestion gateway, reject or drop tags that look unbounded (raw IDs, full URLs with query strings, timestamps-as-tags), and alert on total active series count as its own critical system metric.",
      diagram: {
        mermaid: `flowchart LR
  base["http_requests_total{method,status,endpoint}<br/>~1,000 series"]:::database
  bad["+ user_id tag<br/>5,000,000 series"]:::client
  memory["Head block memory<br/>10-20GB for one metric"]:::compute
  crash["TSDB OOM"]:::client
  base -->|"add unbounded tag"| bad
  bad -->|"2-4KB overhead per series"| memory
  memory -->|"exceeds available RAM"| crash`,
      },
      closingNote:
        "With cardinality under control and points compressed and durable, the system can finally answer the reason it exists: let someone ask a question about the data and get an aggregated answer back fast.",
    },
    {
      title: 'The Query and Aggregation Engine',
      body:
        "Dashboards don't want raw points, they want questions answered: 'what's the error rate for checkout, per region, over the last hour?' A PromQL-style query engine walks the series index to find every series matching a label selector (service=checkout), pulls their raw or downsampled chunks for the requested time range, and applies aggregation functions.\n\nrate(http_requests_total[5m]) computes the per-second increase of a monotonically increasing counter over a trailing 5-minute window at each evaluation point - this is what turns a raw ever-growing counter into a meaningful requests-per-second graph. sum by(region)(...) groups matching series by a tag and adds their values together. Percentile functions (histogram_quantile in PromQL) reconstruct an approximate p99 from pre-aggregated histogram buckets, since storing every individual latency value would itself be a cardinality and storage nightmare.\n\nThe engine has to decide, per query, whether to read raw high-resolution blocks (for recent, short time ranges) or downsampled rollups (for long time ranges spanning months) - reading raw 15-second data for a 6-month graph would mean scanning and aggregating over a million points per series just to render a graph with a few hundred pixels of width.",
      diagram: {
        mermaid: `flowchart LR
  query["rate(http_requests_total{service=checkout}[5m])"]:::client
  index[("Series Index")]:::database
  raw[("Raw blocks<br/>last 15 days")]:::database
  rollup[("5-min rollups<br/>last 13 months")]:::database
  engine["Query Engine"]:::compute
  result["Time-series result set"]:::cache
  query --> engine
  engine -->|"resolve matching series"| index
  engine -->|"short range"| raw
  engine -->|"long range"| rollup
  raw --> result
  rollup --> result
  engine --> result`,
      },
      closingNote:
        "Querying old data efficiently depends entirely on those rollups already existing - which means downsampling has to happen continuously, not on demand.",
    },
    {
      title: 'Retention Tiering and Downsampling',
      body:
        "Keeping every raw 15-second point forever is both wasteful and pointless - nobody needs second-by-second resolution from 8 months ago, and the storage cost would grow without bound. The fix is a background rollup pipeline: as raw blocks age past a threshold (say 15 days), a job reads them and writes downsampled aggregates - a 5-minute rollup storing count, sum, min, max, and a couple of percentile estimates per bucket - into a longer-retention tier. Those 5-minute rollups themselves eventually age into 1-hour rollups for multi-year retention.\n\nThis keeps total storage roughly flat over time instead of growing linearly with retention: raw data at full resolution for 15 days, 5-minute resolution for 13 months, 1-hour resolution indefinitely. A query spanning the last hour reads raw blocks; a query spanning the last year reads 1-hour rollups and never touches the (long since deleted) raw data.",
      diagram: {
        mermaid: `flowchart LR
  raw[("Raw - 15s resolution<br/>15 days")]:::database
  five[("5-min rollup<br/>13 months")]:::database
  hour[("1-hour rollup<br/>multi-year")]:::database
  raw -->|"age out, downsample"| five
  five -->|"age out, downsample"| hour`,
      },
      closingNote:
        "Storage and querying are solved. The last piece is turning this stream into pages that wake up an on-call engineer - and that has to happen against the live stream, not just against what's already been written to disk.",
    },
    {
      title: 'Alerting on a Live Stream',
      body:
        "The naive approach - a cron job that runs a query against stored data every few minutes - has an obvious problem: it introduces exactly as much detection lag as its polling interval, and a query hitting the same storage engine that ingestion is hammering adds load at the worst possible time. The better approach: a rule evaluator subscribes to the same ingestion pipeline (reading recently written blocks or, for the freshest data, the head block directly) and re-evaluates active rules on a short fixed cadence, independent of dashboard query load.\n\nA rule like rate(http_requests_total{status='500'}[5m]) > 10 gets evaluated every 15-30 seconds. When it crosses the threshold, the rule enters a pending state; if it's still breaching after the rule's for: duration (e.g. 2 minutes), it transitions to firing and a notification goes out. That for: window exists specifically to avoid paging on a single noisy blip - trading a small amount of detection latency for a large reduction in false pages.\n\nThe real risk here is missed or duplicate alerts. Missed: if the evaluator itself falls behind or crashes for 90 seconds, a real breach during that gap can be silently skipped unless the evaluator re-checks a short lookback window on recovery. Duplicate: if two evaluator replicas both think they own a rule during a leader failover, the same breach can page the same on-call engineer twice. Production alerting engines (Prometheus's Alertmanager is the canonical example) solve the second problem with deduplication and grouping keyed on the alert's label set, and mitigate the first by making rule evaluation itself horizontally sharded but singly-owned per rule, with fast failover and a bounded re-evaluation window on takeover.",
      insightCallout:
        "The critical design point: alerting rules evaluate against the live ingestion stream on their own cadence, not against ad-hoc dashboard queries hitting cold storage - otherwise alert latency is at the mercy of whatever else is querying the system.",
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant W as Storage Writer
  participant E as Rule Evaluator
  participant AM as Alertmanager
  participant OC as On-Call
  W->>E: new points land in head block
  loop every 15-30s
    E->>E: evaluate rate(500s[5m]) > 10
  end
  E->>E: breach detected, enter pending
  Note over E: still breaching after for: 2m
  E->>AM: fire alert (dedup key = label set)
  AM->>OC: notify (Slack / PagerDuty)`,
      },
      closingNote:
        "That completes the pipeline end to end: ingest through a decoupled gateway, store in a time-shaped engine with aggressive compression, guard against cardinality blowups, query with tiered resolution, and alert off the live stream rather than the cold store.",
    },
  ],

  coreFlows: [
    {
      title: 'Metric Ingestion (Push via Agent)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant App as Instrumented App
  participant Agent as Datadog-style Agent
  participant GW as Ingestion Gateway
  participant K as Kafka
  participant SW as Storage Writer
  participant TS as TSDB

  App->>Agent: increment counter (StatsD line protocol)
  Agent->>Agent: batch + aggregate locally for 10s
  Agent->>GW: POST /v1/series (batched points)
  GW->>GW: auth + tag-cardinality check
  GW->>K: append to metrics topic
  K->>SW: consume batch
  SW->>TS: write to head block + WAL
  TS-->>SW: ack`,
      },
      nonObviousFailure:
        'If the agent buffers locally for 10 seconds before sending and the host crashes mid-window, that buffered data is lost permanently - the agent never had it acknowledged upstream. This is an accepted trade-off (Datadog and StatsD both do this) because the alternative, synchronous per-point sends, would multiply network overhead by orders of magnitude.',
    },
    {
      title: 'Metric Scrape (Pull via Prometheus)',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant SD as Service Discovery
  participant P as Prometheus Server
  participant T as Target /metrics

  SD->>P: target list (pod IPs, ports)
  loop every scrape_interval
    P->>T: GET /metrics
    T-->>P: text exposition format
    P->>P: parse + append to head block
  end
  Note over P: scrape failure = target marked down`,
      },
      nonObviousFailure:
        "A target that is slow but not dead (say it takes 8 seconds to respond to a 10-second-interval scrape) doesn't fail outright, but it silently starves the next scrape cycle and can create gaps or duplicate near-adjacent timestamps in that series - this looks like a data quality bug rather than an availability one, and it's easy to miss without alerting on scrape duration itself.",
    },
    {
      title: 'Dashboard Range Query',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant D as Dashboard
  participant Q as Query Engine
  participant I as Series Index
  participant R as Raw Blocks
  participant RU as Rollup Blocks

  D->>Q: query_range rate(errors[5m]) last 6 months
  Q->>I: resolve matching series
  I-->>Q: series IDs
  Q->>Q: range spans 6 months, use rollups
  Q->>RU: fetch 1-hour rollup chunks
  RU-->>Q: aggregated buckets
  Q->>Q: apply rate() over buckets
  Q-->>D: time-series result for rendering`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Cardinality Explosion',
      problem:
        'A single incautious tag on a hot metric can turn a few hundred series into tens of millions, exhausting the TSDB\'s memory in minutes.',
      simpleTerms:
        "Every distinct combination of tag values is its own tiny database inside the database. Tags with a small, fixed set of values (HTTP method, status code) are safe. Tags whose values are effectively unique per event (a user ID, a request ID, a raw URL with query parameters) multiply the number of series by however many distinct values exist - which, for an ID field, is usually 'as many as your entire user base.'",
      bad: "No cardinality controls at all: any tag key/value a client sends gets stored as-is. A well-meaning engineer adds a user_id tag to a request-duration metric to debug one customer's issue, and the metric silently goes from 1,000 series to 5,000,000 overnight, consuming 10-20GB of head-block memory it never had before.",
      good: "Cardinality limits enforced after the fact - a background job scans for metrics whose series count exceeds a threshold and pages someone to fix the offending code. This catches the problem, but only after the memory spike has already happened; by the time the alert fires, the TSDB may already be degraded or OOM-killed.",
      great:
        "Enforce cardinality at the ingestion gateway, before a single point reaches storage: reject or drop tag values that look unbounded (looks like a UUID, an incrementing integer, or a full URL with query string), cap the number of distinct values per tag key per metric, and track total active series as a first-class system metric with its own alert. Datadog additionally turns this into an economic signal by billing custom metrics per unique tag combination, which gives engineering teams a direct cost incentive to keep tags bounded, on top of the operational safeguard.",
      diagram: {
        mermaid: `flowchart TD
  metric["1 metric, 3 bounded tags"]:::database
  ok["~1,000 series - fine"]:::compute
  addbad["+ 1 unbounded tag (user_id)"]:::client
  explode["5,000,000 series"]:::client
  gate["Ingestion gateway rejects unbounded tag"]:::edge
  metric --> ok
  ok --> addbad
  addbad -->|"without a gate"| explode
  addbad -->|"with a gate"| gate`,
      },
    },
    {
      title: 'Point Compression: Raw to Gorilla',
      problem:
        'Storing a raw 8-byte timestamp and 8-byte value per data point is the single largest cost driver in a TSDB at scale - at millions of points/sec, that is terabytes a day.',
      simpleTerms:
        "Most consecutive timestamps in a series are exactly the same distance apart (your scrape interval), and most consecutive values barely change from one reading to the next. Instead of storing each point from scratch, store only how it differs from the last one - and for timestamps and values that barely change, that difference is nearly free to encode.",
      bad: "Store each point as a full 8-byte timestamp plus 8-byte float, 16 bytes total, with no exploitation of the fact that consecutive points in the same series are highly predictable from each other.",
      good: "Delta encoding of timestamps only: store the first timestamp in full, then the difference to the next one. If the scrape interval is constant this shrinks timestamps a lot, but values are still stored as full 8-byte floats, so total savings are modest - maybe 40-50% overall.",
      great:
        "Facebook's Gorilla scheme, used in some form by Prometheus, InfluxDB, and VictoriaMetrics: delta-of-delta encode timestamps (the delta of consecutive deltas is usually exactly zero and costs a single bit to represent), and XOR each value against the previous one, storing only the meaningful bits where the XOR result is nonzero plus a short control header. Gorilla's paper reports an average of 1.37 bytes per compressed point across real production time series - better than a 12x reduction versus 16 bytes raw.",
      diagram: {
        mermaid: `flowchart LR
  t1["t=0, v=42.10"]:::client
  t2["t=15, v=42.30"]:::client
  t3["t=30, v=42.28"]:::client
  dod["delta-of-delta(t) = 0 -> 1 bit"]:::compute
  xor["XOR(v2,v1), XOR(v3,v2) -> few bits each"]:::compute
  out["~1.37 bytes/point average"]:::cache
  t1 --> dod
  t2 --> dod
  t3 --> dod
  t1 --> xor
  t2 --> xor
  t3 --> xor
  dod --> out
  xor --> out`,
      },
    },
    {
      title: 'Detecting Threshold Breaches Without Missing or Duplicating Alerts',
      problem:
        "An alert rule needs to be evaluated continuously against a stream that never stops, without ever silently skipping a real breach (missed alert) or paging the same incident twice (duplicate alert).",
      simpleTerms:
        "Think of it like a lifeguard who has to keep glancing at the pool every few seconds rather than reviewing yesterday's security footage once a day. If the lifeguard blinks for too long, something can be missed; if two lifeguards both think they're on duty at once, they can both blow the whistle for the same swimmer.",
      bad: "A cron job queries stored, already-written data every 5 minutes and checks if a threshold was crossed. Detection lag is bounded by the polling interval at best (up to 5 minutes late), and a brief spike that resolves between two poll cycles is never seen at all.",
      good: "Shrink the polling interval to 15-30 seconds and query the raw store directly instead of a cron batch job. This reduces lag, but now the alerting system is issuing frequent queries against the same storage engine that ingestion and dashboards are also hitting, competing for the same resources right when the system may already be under stress.",
      great:
        "A dedicated rule evaluator reads from the ingestion pipeline itself (the head block, not a cold query path), re-checks active rules on a short fixed cadence, and uses a for: duration before transitioning a rule from pending to firing to filter out single noisy blips. Rules are sharded across evaluator replicas with single ownership per rule and fast failover; on takeover, the new owner re-evaluates a bounded lookback window so a brief handoff gap doesn't silently swallow a real breach. Firing alerts are deduplicated by their label set (Prometheus's Alertmanager model) so a flapping condition or a failover blip doesn't page the same on-call engineer multiple times for the same underlying issue.",
    },
    {
      title: 'Push vs Pull Ingestion at Scale',
      problem:
        "Choosing push or pull isn't just a protocol detail - it determines how the system detects dead targets, survives network topology (NAT, firewalls, ephemeral compute), and protects itself from being overwhelmed.",
      simpleTerms:
        "Pull is like a teacher walking around and checking on each student on a schedule - you always know exactly who didn't answer. Push is like students raising their hands whenever they have something to report - works even if the teacher can't walk over to every desk, but a silent student could mean 'nothing to report' or 'fell asleep,' and you can't tell which just from silence.",
      bad: "Pure push with no target-health mechanism at all: agents send data whenever they have it, and the absence of data for a given series is treated as 'nothing happened' rather than investigated. A crashed host and a healthy-but-idle host look identical, so real outages can go undetected for a long time.",
      good: "Pure pull with synchronous scraping and no service discovery: the monitoring server holds a static list of targets to scrape. Failed scrapes are correctly detected as down, but every new host, pod, or container has to be manually added to the target list, which doesn't scale in a dynamic, autoscaling environment.",
      great:
        "Pull with dynamic service discovery (Kubernetes API, Consul, cloud provider tags) for anything long-lived, giving a free and accurate down signal with zero manual target management, combined with push (via an agent or a dedicated pushgateway) specifically for workloads that can't be reached by a scraper - serverless functions, batch jobs, anything behind a firewall the monitoring server can't reach. This hybrid is what most real production setups converge on: Prometheus's own Pushgateway exists precisely to bridge this gap without abandoning the pull model everywhere else.",
    },
  ],

  selfAudit: [
    { question: 'Why not just use Postgres?', answer: 'Row overhead and B-tree indexes cannot sustain millions of appends/sec or compress time-ordered data the way a purpose-built TSDB can.' },
    { question: 'What is a series?', answer: 'One unique combination of metric name + tag set - each is its own independent, time-ordered stream.' },
    { question: 'How is storage kept small?', answer: 'Delta-of-delta timestamp encoding + XOR value encoding (Gorilla) - roughly 1.37 bytes/point vs 16 bytes raw.' },
    { question: 'Biggest operational risk?', answer: 'Cardinality explosion - one unbounded tag (user ID, request ID) can multiply series count by millions and OOM the TSDB.' },
    { question: 'Push or pull?', answer: 'Pull gives a free down-signal and easy service discovery; push works through NAT and for ephemeral jobs. Most real systems use both.' },
    { question: 'How does old data stay cheap?', answer: 'Retention tiering - raw high-res for ~15 days, 5-min rollups for ~13 months, 1-hour rollups long-term.' },
    { question: 'How does alerting avoid lag?', answer: 'A dedicated rule evaluator reads the live ingestion stream on its own cadence, not cold storage queries.' },
    { question: 'How to avoid duplicate pages?', answer: 'Deduplicate firing alerts by label set and give each rule single ownership with a bounded re-check window on failover.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  agents["Push: Agents / StatsD"]:::client
  targets["Pull: Scrape Targets"]:::client
  sd[("Service Discovery")]:::async
  gw["Ingestion Gateway<br/>auth + cardinality gate"]:::edge
  kafka[("Kafka<br/>metrics buffer")]:::async
  writers["Storage Writers"]:::compute
  head[["Head Block<br/>in-memory + WAL"]]:::cache
  blocks[("Compressed On-Disk Blocks<br/>Gorilla encoding")]:::database
  rollupjob["Downsampling Job"]:::compute
  rollups[("Rollup Blocks<br/>5min / 1hr")]:::database
  query["Query Engine<br/>PromQL-style"]:::compute
  evaluator["Rule Evaluator"]:::compute
  alertmgr["Alertmanager<br/>dedup + routing"]:::edge
  dashboards["Dashboards"]:::client
  oncall["On-Call Notification"]:::client

  agents -->|"push"| gw
  sd -->|"discover"| targets
  targets -->|"scraped by"| gw
  gw --> kafka
  kafka --> writers
  writers --> head
  head -->|"flush + compress"| blocks
  blocks --> rollupjob
  rollupjob --> rollups
  head --> query
  blocks --> query
  rollups --> query
  query --> dashboards
  head --> evaluator
  evaluator --> alertmgr
  alertmgr --> oncall`,
  },

  keyTechnologies: [
    { term: 'Time-Series Database (TSDB)', definition: 'Storage engine specialized for timestamped, mostly-append-only data - Prometheus TSDB, InfluxDB, VictoriaMetrics.' },
    { term: 'Gorilla Compression', definition: "Facebook's delta-of-delta timestamp + XOR value encoding scheme, averaging ~1.37 bytes per compressed data point." },
    { term: 'Cardinality', definition: 'The number of distinct series a metric produces - the product of the number of distinct values across all its tags.' },
    { term: 'PromQL', definition: "Prometheus's query language for selecting, aggregating, and computing rates/percentiles over time series." },
    { term: 'Write-Ahead Log (WAL)', definition: 'Append-only log written before an in-memory update, so a crash does not lose unflushed points from the head block.' },
    { term: 'Downsampling / Rollup', definition: 'Pre-aggregating raw points into coarser-resolution buckets (e.g. 5-minute averages) for cheap long-term retention.' },
    { term: 'Pushgateway', definition: "Prometheus component that lets short-lived, un-scrapeable jobs push a final metric snapshot for the server to pull later." },
    { term: 'Alertmanager', definition: 'Component that deduplicates, groups, and routes firing alerts to notification channels (Slack, PagerDuty, email).' },
  ],

  expectedDepth: {
    mid:
      'Explain the metric-name-plus-tags data model and why a series is an independent time-ordered stream. Propose a basic ingestion path (agent or scrape) writing into some kind of specialized storage. Understand at a high level why a relational database struggles with this write pattern.',
    senior:
      'Justify a purpose-built storage engine (memtable/head-block plus immutable on-disk blocks) over a general-purpose database. Explain compression concretely - delta-of-delta timestamps and XOR value encoding - with real numbers (1.37 bytes/point). Discuss retention tiering and downsampling, and the cardinality explosion problem with a concrete example. Compare push vs pull ingestion tradeoffs.',
    staffPlus:
      'Address alerting correctness under failure - missed alerts from evaluator lag, duplicate alerts from failover, dedup by label set. Discuss multi-tenant cardinality isolation so one noisy tenant cannot exhaust shared memory. Cover the cost model of custom metrics at scale (Datadog-style per-tag-combination billing) and how that shapes tagging conventions org-wide. Consider cross-region ingestion and query federation for a globally distributed fleet.',
  },

  keyTakeaways: [
    'A series is a unique combination of metric name plus tags, and each series is its own independent, time-ordered, append-mostly stream',
    'Delta-of-delta timestamp encoding plus XOR value encoding (Gorilla) gets a data point down to ~1.37 bytes from 16 bytes raw',
    'Cardinality explosion - an unbounded tag like a raw user ID or request ID - is the most common real-world cause of monitoring outages',
    'Retention tiering (raw short-term, rollups long-term) keeps storage roughly flat as retention grows instead of scaling linearly',
    'Push (agents, works through NAT) and pull (scraping, free health signal) are complementary, not competing - most production systems use both',
    'Alerting must evaluate against the live ingestion stream on its own cadence, not against ad-hoc queries on cold storage, to keep detection latency low',
  ],

  relatedDesigns: ['key-value-store', 'rate-limiter', 'notification-system', 'real-time-leaderboard'],
  relatedConcepts: [
    { name: 'Time-Series Databases', description: 'The storage model - series, blocks, compaction - that this entire design is built around.' },
    { name: 'Data Compression', description: 'Delta and XOR encoding techniques that make storing billions of points per day affordable.' },
    { name: 'Cardinality Management', description: 'Operational discipline around tag design that prevents a single metric from exhausting shared memory.' },
    { name: 'Stream Processing', description: 'The rule-evaluation pipeline reads and reacts to the ingestion stream continuously rather than polling storage.' },
    { name: 'Message Queues', description: 'Kafka decouples bursty ingestion traffic from the pace the storage engine can sustainably write at.' },
  ],

  simulator: {
    goalDescription: 'Ingest millions of timestamped data points per second and keep them queryable within seconds, without an ingestion burst taking down storage.',
    requirementChips: ['1-2M points/sec ingest', 'Query p99 < 1-2s', 'Alert detection within 30-60s'],
    targetRps: 1000000,
    readRatio: 0.05,
    cacheHitRatio: 0.6,
    latencyBudgetMsP99: 1500,
    rubric: [
      { id: 'ingest-buffer', label: 'Durable buffer absorbing bursty ingestion traffic', kind: 'requires-node-type', nodeType: 'kafka' },
      { id: 'write-tier', label: 'Storage writer tier consuming from the buffer', kind: 'requires-node-type', nodeType: ['worker', 'app-server', 'microservice'] },
      { id: 'hot-store', label: 'In-memory head block for the freshest data', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'durable-store', label: 'Durable, compressed store for historical time-series blocks', kind: 'requires-node-type', nodeType: ['cassandra', 'dynamodb', 'postgresql', 'mongodb'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'gw-1', type: 'api-gateway', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'kafka-1', type: 'kafka', instanceCount: 6, position: { x: 600, y: 200 } },
        { id: 'worker-1', type: 'worker', instanceCount: 15, position: { x: 880, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 1160, y: 120 } },
        { id: 'cass-1', type: 'cassandra', instanceCount: 20, position: { x: 1160, y: 280 } },
      ],
      edges: [
        { id: 'e-client-gw', source: 'client-1', target: 'gw-1' },
        { id: 'e-gw-kafka', source: 'gw-1', target: 'kafka-1' },
        { id: 'e-kafka-worker', source: 'kafka-1', target: 'worker-1' },
        { id: 'e-worker-redis', source: 'worker-1', target: 'redis-1' },
        { id: 'e-worker-cass', source: 'worker-1', target: 'cass-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Kafka decouples bursty agent/scrape ingestion from the pace storage writers can sustain; writers fan out into an in-memory head block for the freshest hours of data and a durable, Gorilla-compressed store for history, both read by the query and alert-evaluation path.',
    failureModeNarratives: {
      kafka: 'All ingestion flows through a single buffering tier. If it is undersized or goes down, agents cannot durably hand off data and a traffic burst (a mass deploy, a network blip) gets dropped instead of absorbed.',
    },
    fullDesignLinkSlug: 'metrics-monitoring',
  },
}

export default topic
