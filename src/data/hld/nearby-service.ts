import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'nearby-service',
  title: 'Nearby Service (Yelp / Google Maps)',
  difficulty: 'Intermediate',
  icon: 'pi pi-map-marker',
  color: '#22c55e',
  readTimeMinutes: 24,
  topics: ['Geohashing', 'Quadtrees', 'Uber H3 Hexagonal Grid', 'Redis GEO Commands'],
  companies: ['Google Maps', 'Yelp', 'Uber', 'DoorDash'],
  prerequisites: ['Caching', 'Key-Value Stores'],
  summary:
    'A nearby service answers "what is close to this latitude/longitude" by indexing entities into a geospatial grid (geohash, quadtree, or H3 hex cells) so a radius search only has to scan a handful of nearby cells instead of every row in the database, then ranks the candidates by a blend of distance, rating, and availability.',

  understandingProblem:
    'Open Yelp and search "coffee near me" or open Uber and watch driver icons crawl around your location - both are the same underlying problem: given a point on Earth and a radius, find every relevant entity inside that circle, fast, out of millions or billions of candidates. It sounds like a simple WHERE clause until you remember that latitude/longitude are just two independent numbers with no relationship to physical distance - a point 0.001 degrees away in longitude can be 111 meters away at the equator or 40 meters away near the poles, and there is no way to build a normal B-tree index on "distance from this arbitrary point" because that point is different on every single query. You need this system for ride-hailing (match a rider to the 5 closest available drivers), food delivery (find restaurants within delivery range, then find a courier near the restaurant), local search (Yelp/Maps "near me" queries), dating apps, and real estate listings - anywhere the product spatially anchors results to "here."',
  realExamples:
    'Uber processes location pings from millions of active drivers every few seconds and must resolve a rider match in under a second - their H3 grid system (open-sourced in 2018) is now used internally for surge pricing, ETA calculation, and driver-rider matching across 10,000+ cities. Yelp indexes tens of millions of businesses worldwide and serves "near me" search using Elasticsearch geo-queries. Google Maps nearby search spans well over 200 million real-world places globally. DoorDash re-computes "restaurants near you, sorted by ETA" for every home-screen load, blending distance with live courier availability.',

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  api["API Server"]:::compute
  db[("SQL DB<br/>businesses table<br/>lat, lng columns")]:::database
  client -->|"1. lat=40.71, lng=-74.00, radius=2km"| api
  api -->|"2. SELECT * FROM businesses<br/>WHERE haversine(lat,lng,q_lat,q_lng) < radius"| db`,
    },
    whyThisBreaks: [
      'Full table scan every query - with 10 million businesses, computing the Haversine distance formula (trig functions per row) for every single row on every search takes seconds, not milliseconds.',
      'No usable index - a B-tree on lat or lng alone still leaves you scanning a huge latitude band, then filtering longitude in memory; a composite index does not help because "distance from an arbitrary point" is not a range that maps cleanly to sorted columns.',
      'Degrades with popularity, not just data size - a search during lunch rush in Manhattan (50,000 businesses in a 2km radius) does the same expensive full scan as a search in rural Montana (12 businesses in a 50km radius).',
      'Moving entities make it worse - if this table also holds live driver locations updated every 4 seconds by 100,000 drivers, you are now doing 25,000 writes/sec against the exact same table you are trying to full-scan for reads.',
    ],
    closingNote:
      'The fix is not a smarter query - it is a different data structure. We need to pre-organize the world into buckets such that "things near this point" is a cheap lookup of a handful of buckets, not a scan of everything. That is exactly what a geospatial index gives us.',
  },

  priorArt: [
    {
      title: "Uber's H3 Hexagonal Hierarchical Index",
      description:
        'Open-sourced in 2018. Divides the globe into hexagonal cells at 16 resolutions, from ~4.25M km^2 per cell down to under a square meter. Uber uses it for driver-rider matching, surge pricing zones, and ETA computation because hexagons have uniform adjacency (all 6 neighbors are equidistant) unlike squares. (Uber Engineering blog)',
      link: 'https://www.uber.com/us/en/blog/h3/',
    },
    {
      title: "Google's S2 Geometry Library",
      description:
        'Projects the sphere onto a cube and recursively subdivides each face into a quadtree, encoding cells as 64-bit integers. Google Maps and MongoDB\'s geospatial indexes use variants of this for hierarchical, index-friendly geo lookups. (Google S2 documentation)',
      link: 'https://s2geometry.io/',
    },
    {
      title: 'Redis GEO Commands',
      description:
        'GEOADD/GEOSEARCH store locations internally as 52-bit interleaved geohashes inside a sorted set, giving O(log n + m) radius queries in-memory. Widely used for ride-hailing MVPs and driver-tracking prototypes because it needs zero extra infrastructure beyond Redis. (Redis documentation)',
      link: 'https://redis.io/docs/latest/develop/data-types/geospatial/',
    },
    {
      title: 'Yelp Search Infrastructure',
      description:
        'Uses Elasticsearch with geo_point fields and geo_distance queries, combined with custom relevance scoring that blends text match, distance, rating, and review recency - because for local search, "closest" alone is a bad ranking signal. (Yelp Engineering blog)',
      link: 'https://engineeringblog.yelp.com/2017/06/moving-yelps-core-business-search-to-elasticsearch.html',
    },
    {
      title: 'PostGIS (PostgreSQL extension)',
      description:
        'Adds native geometry/geography types and GiST-indexed spatial queries (ST_DWithin, KNN operators) directly in Postgres - the default choice when a team wants strong consistency and transactional writes alongside geo queries rather than a separate search cluster.',
      link: 'https://postgis.net/',
    },
  ],

  coreEntities: [
    { name: 'Entity', description: 'The thing being searched for: a static POI (restaurant, store) or a moving actor (driver, courier).' },
    { name: 'GeoCell', description: 'One cell of the spatial grid (a geohash string, quadtree node, or H3 cell ID) that entities are bucketed into.' },
    { name: 'LocationUpdate', description: 'A timestamped lat/lng ping from a moving entity, used to re-bucket it into a new cell as it travels.' },
    { name: 'SearchQuery', description: 'A query point, radius (or "top K"), and optional filters (category, open-now, min rating).' },
    { name: 'RankedResult', description: 'An entity plus its computed distance, blended relevance score, and rank position in the response.' },
  ],

  requirements: {
    core: [
      'Radius / nearby search - given a lat/lng and radius (or "find the 20 closest"), return matching entities ranked by relevance',
      'Location ingestion - accept frequent location updates from moving entities (drivers, couriers) and keep the index fresh within a few seconds',
      'POI management - add, update, and remove largely-static points of interest (restaurants, stores, listings)',
      'Filtering - narrow results by category, open-now status, minimum rating, or entity availability',
      'Ranking - order results by a blend of distance, rating, and current availability, not distance alone',
    ],
    belowTheLine: [
      'Turn-by-turn routing / driving directions (a separate routing/ETA engine)',
      'Full-text search relevance tuning (treated as a downstream concern, not the geo layer)',
      'Real-time traffic-aware ETA (belongs to a routing service that consumes our geo results)',
      'Geofencing / entering-a-zone push notifications',
      'Historical heatmaps and demand forecasting',
    ],
    nonFunctionalTable: [
      { metric: 'Search latency', target: 'p99 < 100ms for a nearby query' },
      { metric: 'Location update latency', target: 'Driver position reflected in search results within 3-5 seconds' },
      { metric: 'Read/write ratio', target: '~20:1 (many more searches than location or POI writes for static POI data; closer to 1:1 for live driver traffic)' },
      { metric: 'Availability', target: '99.9% - a stale nearby result is tolerable, a hard failure is not' },
      { metric: 'Consistency', target: 'Eventual consistency for driver locations is fine; POI edits can be eventually consistent too' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Static POI Index',
      purpose: 'Index restaurants/businesses, queried by geohash prefix + radius filter',
      primaryPick: 'Elasticsearch (geo_point)',
      alternatives: 'PostGIS, DynamoDB with a geohash sort key',
      whyPrimaryWins: 'Combines geo_distance filtering with text relevance and custom scoring - "closest" alone is a bad ranking signal for POI search',
    },
    {
      tier: 'Live Entity Index',
      purpose: 'Real-time driver/courier positions updated every few seconds',
      primaryPick: 'Redis GEO',
      alternatives: 'Custom quadtree service',
      whyPrimaryWins: 'In-memory sorted-set radius queries stay sub-millisecond even under hundreds of thousands of writes/sec',
    },
    {
      tier: 'POI Metadata',
      purpose: 'Full place details - name, reviews, photos, hours',
      primaryPick: 'Postgres',
      alternatives: 'DynamoDB, MongoDB',
      whyPrimaryWins: 'Point lookup by place_id with strong consistency for edits like hours changed or business closed',
    },
    {
      tier: 'Query Result Cache',
      purpose: 'Cache ranked nearby results per grid cell + filter combination',
      primaryPick: 'Redis',
      alternatives: 'Memcached, CDN edge cache',
      whyPrimaryWins: 'Absorbs bursts of near-identical queries from users standing in the same H3 cell during an event',
    },
    {
      tier: 'Location Ingest Stream',
      purpose: 'Buffer high-throughput GPS pings from the driver fleet',
      primaryPick: 'Kafka',
      alternatives: 'Kinesis, Redis Streams',
      whyPrimaryWins: 'Durable, ordered ingestion decouples ping-volume spikes from downstream index writes',
    },
  ],
  technologyChoicesNote:
    'Why Redis GEO for the live index? Moving entities update every 3-5 seconds - Redis GEO gives O(log N) inserts and O(N + log M) radius queries entirely in memory, so 1-2M active drivers fit in a couple GB of RAM and a single shard can absorb hundreds of thousands of updates/sec. PostGIS would buckle under that write rate, which is exactly why static, rarely-changing POIs live in a separate durable index instead.',

  scaleEstimation: [
    'Static POIs: ~50M businesses/listings worldwide - written rarely (opened/closed/edited maybe once a day per entity), read constantly.',
    'Moving entities: ~1M concurrently active drivers/couriers globally, each pinging location every 4 seconds -> ~250,000 location writes/sec at peak.',
    'Search QPS: ~50,000 nearby-search requests/sec at peak across a large ride-hailing or delivery platform.',
    'Index size: at H3 resolution 9 (~0.1 km^2 cells) covering dense urban areas, a metro area of 1,000 km^2 needs roughly 10,000 cells - trivially small to keep hot in memory or Redis.',
    'Bandwidth: each location ping is ~100 bytes (driver id, lat, lng, timestamp, heading) -> 250,000/sec x 100 bytes = ~25MB/sec of ingest traffic just for driver pings.',
    'Fan-out on write: a single driver moving between cells only needs to update 1-2 grid entries (remove from old cell, add to new cell), keeping writes cheap even at this volume.',
  ],

  apiInterface: [
    {
      method: 'GET',
      path: '/v1/search/nearby',
      description: 'Find entities within a radius (or top-K closest) of a point, with optional filters.',
      example:
        '// Request\nGET /v1/search/nearby?lat=40.7128&lng=-74.0060&radiusKm=2&category=coffee&limit=20\n\n// Response 200\n{\n  "results": [\n    { "id": "biz_882a", "name": "Blue Bottle Coffee", "distanceMeters": 340, "rating": 4.6, "openNow": true }\n  ]\n}',
    },
    {
      method: 'POST',
      path: '/v1/locations/{entityId}',
      description: 'Ingest a fresh location ping for a moving entity (driver, courier).',
      example: '// Request\n{ "lat": 40.7135, "lng": -74.0059, "heading": 92, "timestamp": 1750000000 }\n\n// Response 202\n{ "accepted": true }',
    },
    {
      method: 'POST',
      path: '/v1/poi',
      description: 'Register a new static point of interest.',
      example: '// Request\n{ "name": "Blue Bottle Coffee", "lat": 40.7131, "lng": -74.006, "category": "coffee" }\n\n// Response 201\n{ "id": "biz_882a" }',
    },
    {
      method: 'PATCH',
      path: '/v1/poi/{id}',
      description: 'Update a POI\'s metadata or location (e.g. business relocated, hours changed).',
    },
    {
      method: 'GET',
      path: '/v1/poi/{id}',
      description: 'Fetch full details for a single point of interest.',
    },
    {
      method: 'DELETE',
      path: '/v1/locations/{entityId}',
      description: 'Remove a moving entity from the live index (driver went offline).',
    },
  ],
  apiSecurityNote:
    'Location writes must be authenticated per-driver (a driver can only update their own position) and rate-limited per device to stop spoofed or spammy pings from polluting the index.',

  highLevelDesignIntro:
    "Let's build this up incrementally: replace the full-table-scan with a real geospatial grid, fix the two failure modes every naive grid hits (missing neighbors at cell boundaries, and hotspots overloading dense cells), then split the design for static POIs versus fast-moving entities, and finally layer in ranking.",

  builds: [
    {
      title: 'Carving the World into a Grid: Geohashing',
      body:
        "The core idea behind every geospatial index: convert a 2D (lat, lng) point into a 1D string or integer that encodes location AND proximity, so nearby points share a common prefix. Geohash does this by recursively bisecting the world into a grid - each additional character of the geohash string narrows the bounding box by half in each dimension.\n\nExample: 40.7128, -74.0060 (Manhattan) encodes to \"dr5reg...\" - the 4-character prefix \"dr5r\" covers roughly a 20km x 20km box, and the 7-character prefix covers roughly 150m x 150m. Two points sharing a longer common prefix are (usually) closer together.\n\nWith this, a radius search becomes: compute the geohash prefix length matching your radius, then query the database for all rows whose geohash starts with that prefix - a simple indexed range scan (WHERE geohash LIKE 'dr5r%') instead of scanning every row and computing Haversine distance.",
      newComponents: [
        { name: 'Geohash Index', description: 'A column storing each entity\'s geohash string, with a normal B-tree/prefix index on it - turns "nearby" into a cheap prefix range scan.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api["API Server"]:::compute
  idx[("Geohash Index<br/>prefix: dr5r*")]:::database
  client -->|"1. lat, lng, radius"| api
  api -->|"2. Compute geohash prefix"| api
  api -->|"3. WHERE geohash LIKE 'dr5r%'"| idx`,
      },
      insightCallout:
        'A geohash prefix range scan turns "find things near this point" into a query a normal database index can already answer - that single trick is why geohashing became the default entry point into geospatial systems.',
      closingNote:
        'This is dramatically faster than a full scan, but geohash grids have two well-known problems every interviewer expects you to name: the boundary problem and uneven cell density. Let us hit the boundary problem first.',
    },
    {
      title: 'The Boundary Problem',
      body:
        "Geohash cells are rectangular grid squares. A query point sitting near the edge of its cell can have a genuinely closer result sitting just across the border in the ADJACENT cell - and a naive query that only looks at the query point's own cell will miss it entirely.\n\nConcrete example: query point is in cell \"dr5r\", 20 meters from its eastern edge. A restaurant sits 25 meters away but 5 meters across the border, in cell \"dr5x\". A search that only scans \"dr5r\" returns nothing, even though that restaurant is objectively the closest match.\n\nThe fix: always query the query point's own cell PLUS its 8 (or however many) neighboring cells, then filter the combined candidate set by actual Haversine distance and cut it down to the true radius. This is sometimes called the \"3x3 grid\" or \"9-cell\" search pattern.",
      diagram: {
        mermaid: `flowchart TD
  q["Query point<br/>20m from cell edge"]:::client
  own["Own cell: dr5r"]:::compute
  n1["Neighbor: dr5x"]:::compute
  miss["Restaurant 25m away<br/>sits in dr5x, not dr5r"]:::database
  q -->|"1. Query own cell only"| own
  own -->|"2. Misses it!"| miss
  q -->|"3. Query own + 8 neighbors"| n1
  n1 -->|"4. Found, then distance-filter"| miss`,
      },
      closingNote:
        "Querying the 9-cell neighborhood fixes correctness, but it exposes a second problem: geohash's rectangular cells have inconsistent neighbor relationships (a cell's \"diagonal neighbor\" is a different distance away than its \"side neighbor\"), and cell boundaries do not align cleanly at the poles or the antimeridian. A different grid shape sidesteps this entirely.",
    },
    {
      title: 'Quadtrees: Adapting to Uneven Density',
      body:
        "Geohash gives every cell the same fixed size regardless of how many entities live in it - which means a rural cell with 3 businesses and a Manhattan cell with 50,000 businesses are indexed identically. A quadtree fixes this by subdividing recursively: start with one giant cell covering the whole map, and whenever a cell holds more than some threshold of entities (say, 200), split it into 4 equal quadrants, and repeat inside each quadrant that is still over threshold.\n\nResult: dense areas (Manhattan, a stadium during a game) end up with many small, deep cells; sparse areas (rural Montana) stay as one big, shallow cell. A radius search walks down the tree from the root, only descending into quadrants that intersect the query circle, and stops descending once a quadrant is entirely outside the radius or small enough to just scan directly.",
      newComponents: [
        { name: 'Quadtree Index', description: 'A tree where each node is a spatial region; nodes split into 4 children once entity count crosses a threshold, giving fine resolution in dense areas and coarse resolution in sparse ones.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  root["Root: whole map"]:::compute
  manhattan["Manhattan quadrant<br/>50,000 entities -> split"]:::database
  m1["NE sub-quadrant"]:::compute
  m2["NW sub-quadrant"]:::compute
  m3["SE sub-quadrant"]:::compute
  m4["SW sub-quadrant"]:::compute
  montana["Montana quadrant<br/>12 entities -> stays whole"]:::database
  root --> manhattan
  root --> montana
  manhattan --> m1
  manhattan --> m2
  manhattan --> m3
  manhattan --> m4`,
      },
      closingNote:
        "Quadtrees solve density unevenness, but they still inherit geohash's core geometric flaw: square cells do not have uniform neighbors (a diagonal neighbor is roughly 1.41x farther than a side neighbor), and squares distort badly near the poles because lines of longitude converge. This is exactly the gap Uber's H3 was built to close.",
    },
    {
      title: "Uber's H3: Hexagonal Hierarchical Index",
      body:
        'H3 tiles the globe with hexagons instead of squares or rectangles, organized into 16 resolution levels (0 = huge, ~4.25 million km^2 per cell, down to 15 = under a square meter). Every cell gets a single 64-bit integer ID, so storage and lookups are cheap integer operations, not string prefix matching.\n\nWhy hexagons specifically: every hexagon has exactly 6 neighbors, and ALL 6 are (nearly) equidistant from the center - unlike a square, which has 4 side-neighbors at distance 1 and 4 diagonal-neighbors at distance 1.41. This means "give me the ring of neighbors around this cell" is a simple, geometrically consistent operation (h3.gridDisk in the H3 API) with no diagonal-distance quirks to reason about. Hexagons also tile a sphere with far less area distortion near the poles than a square grid, which matters at global scale.\n\nUber uses H3 for driver-rider matching (bucket both drivers and open ride requests into the same resolution-9 hex cells and match within a cell first), surge pricing (each hex cell gets its own price multiplier based on local supply/demand), and ETA estimation.',
      newComponents: [
        { name: 'H3 Grid System', description: 'Hexagonal cells at 16 resolutions, each with a single 64-bit cell ID; supports fast "ring of neighbors" and parent/child cell lookups.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  point["lat=40.71, lng=-74.00"]:::client
  h3fn["H3 latLngToCell<br/>resolution 9"]:::compute
  cell["Cell ID: 8a2a1072b59ffff"]:::database
  ring["gridDisk(cell, k=1)<br/>-> 6 neighbors, all equidistant"]:::compute
  point --> h3fn --> cell --> ring`,
      },
      insightCallout:
        'The single fact worth memorizing for interviews: hexagons have uniform distance to all 6 neighbors, which is why H3 became the modern default for ride-hailing and delivery geo-indexing - the "boundary problem" fix (query all neighbors) becomes trivially correct because every neighbor really is equally near.',
      closingNote:
        'We now have a grid shape that solves both the boundary problem and the density problem cleanly. The remaining question is infrastructure: where do these grid cells actually live so millions of reads and writes per second can hit them?',
    },
    {
      title: 'Storing the Index: Redis GEO, Elasticsearch, or PostGIS',
      body:
        'Three production-proven options, and the right one depends on your consistency and query needs.\n\nRedis GEO commands (GEOADD, GEOSEARCH) store entities in a sorted set keyed by an internal 52-bit geohash, giving in-memory O(log n + m) radius queries. Best for the hottest, most latency-sensitive path - live driver locations that change every few seconds and need sub-10ms reads.\n\nElasticsearch with geo_point fields and geo_distance queries is built for combining geo filtering with text search and custom relevance scoring - this is what Yelp uses, since "near me" is really "near me AND matches my search term AND is highly rated."\n\nPostGIS (a PostgreSQL extension) adds native geometry/geography types with GiST-indexed ST_DWithin queries - the right choice when you want geo queries inside the same transactional database as the rest of your POI data, trading some raw query speed for strong consistency and simpler operations.',
      newComponents: [
        { name: 'Redis GEO Cluster', description: 'In-memory sorted-set-backed geo index for the hottest, most frequently-updated entities (live driver/courier locations).' },
        { name: 'Elasticsearch Geo Cluster', description: 'Combines geo_point radius filtering with text relevance and custom scoring for POI search.' },
      ],
      diagram: {
        mermaid: `flowchart TD
  driver["Live driver locations<br/>updates every 4s"]:::async
  redis[("Redis GEO<br/>GEOADD / GEOSEARCH")]:::cache
  poi["Static POIs<br/>rarely updated"]:::async
  es[("Elasticsearch<br/>geo_point + text relevance")]:::database
  pg[("PostGIS<br/>transactional writes")]:::database
  driver --> redis
  poi --> es
  poi --> pg`,
      },
      closingNote:
        'Notice the split forming in that diagram: driver pings and restaurant listings have completely different write patterns. That difference is important enough to design around explicitly, not just paper over with "one big geo index."',
    },
    {
      title: 'Splitting Moving Entities from Static POIs',
      body:
        'A restaurant is written once and read millions of times - its location almost never changes, so it can sit in a durable, disk-backed store (Elasticsearch/PostGIS) that is optimized for read throughput and can afford a slightly heavier write path.\n\nA driver is written every 3-5 seconds by every active driver and needs to be immediately reflected in search results - that is a completely different load profile (write-heavy, low-latency, short-lived data that is meaningless a minute later). Forcing both into the same storage tier means either your POI store buckles under driver-ping write volume, or your driver-location store pays unnecessary durability overhead for data that expires in seconds anyway.\n\nThe fix: two separate geo-indexes behind one search API. A nearby-restaurants query only touches the POI index (Elasticsearch/PostGIS). A nearby-drivers query only touches the live Redis GEO index. A "restaurants with an available courier within 2km" query fans out to both and joins the results in the application layer.',
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  api["Search API"]:::compute
  poiIdx[("POI Index<br/>Elasticsearch/PostGIS<br/>static, durable")]:::database
  liveIdx[("Live Index<br/>Redis GEO<br/>volatile, fast writes")]:::cache
  client -->|"1. nearby restaurants"| api
  api -->|"2. query"| poiIdx
  client -->|"3. nearby drivers"| api
  api -->|"4. query"| liveIdx`,
      },
      closingNote:
        'With the two workloads cleanly separated, the next failure mode to design for is what happens when one geographic area - a stadium, a downtown core during a parade - gets far denser than any other cell in the grid.',
    },
    {
      title: 'The Hotspot Problem',
      body:
        "Even with H3's uniform hexagons, a fixed resolution level creates hotspots: a resolution-9 cell (~0.1 km^2) covering a stadium during a game might hold 40,000 people requesting rides simultaneously, while the identical-sized cell one mile away holds 12. If your sharding scheme maps one cell (or a small range of cells) to one shard, that shard gets 3,000x the load of its neighbors and falls over - a classic hot-partition problem.\n\nTwo complementary fixes. First, variable resolution: instead of a single fixed H3 resolution everywhere, use a coarser resolution (bigger cells) in sparse regions and switch to a finer resolution (smaller cells) in dense regions, re-evaluated periodically based on observed entity density - this is exactly what H3's parent/child cell hierarchy is designed for, since any resolution-9 cell has a known set of 7 resolution-10 children to split into. Second, shard key design: never shard purely by \"which cell,\" always shard by a hash of (cell ID + entity ID) or spread a single overloaded cell's entities across multiple shards with cross-shard fan-in on read - trading a slightly more expensive read for an evenly loaded write path.",
      diagram: {
        mermaid: `flowchart TD
  stadium["Stadium cell<br/>40,000 requests"]:::client
  overloaded["Single shard<br/>3000x normal load"]:::database
  split["Split into 7 child cells<br/>at finer resolution"]:::compute
  balanced["Load spread across<br/>7 shards evenly"]:::cache
  stadium -->|"1. Naive: one shard"| overloaded
  stadium -->|"2. Fix: finer resolution"| split
  split -->|"3. Even distribution"| balanced`,
      },
      insightCallout:
        'Interviewers love this follow-up: "what happens at a stadium during a game?" The answer is not "add more servers" - it is "use a finer grid resolution locally and shard so no single cell maps to a single hot partition."',
      closingNote:
        'The grid and sharding are now robust to both sparse and dense regions. The last piece is turning a list of "nearby candidates" into a ranked list users actually want to see first.',
    },
    {
      title: 'Ranking: Distance Is Not Enough',
      body:
        'Once the geo-index returns a candidate set (say, the 200 closest restaurants or the 30 closest drivers), raw distance alone is a bad final ranking. A 4.9-star restaurant 900 meters away is usually a better result than a 2.1-star restaurant 300 meters away; a driver 2 minutes away who just went offline should not outrank one 3 minutes away who is actually available.\n\nProduction systems compute a blended score, roughly: score = w1 x normalize(1 / distance) + w2 x normalize(rating) + w3 x availability_boolean_or_freshness, with weights tuned per product (a "closest driver" ETA match weights distance/availability far more heavily than a "restaurants near me" browse view, which weights rating more heavily). Availability/open-hours acts as a hard filter first (closed restaurants and offline drivers are dropped before scoring, not penalized within it), then the remaining candidates are scored and sorted.',
      diagram: {
        mermaid: `flowchart LR
  candidates["200 geo-candidates"]:::database
  filter["Hard filter:<br/>open now? available?"]:::compute
  score["Blend score:<br/>distance + rating + availability"]:::compute
  ranked["Ranked results<br/>top 20 returned"]:::client
  candidates --> filter --> score --> ranked`,
      },
      closingNote:
        'With ranking layered on top of a correct, hotspot-resistant geo-index, the last operational question is protecting the search path itself from repeated identical queries during traffic spikes.',
    },
    {
      title: 'Caching Hot Search Queries',
      body:
        "During a big event, thousands of nearby users issue nearly identical queries (same rounded lat/lng grid cell, same category filter) within the same few seconds. Rather than re-running the geo-index lookup and ranking pass for every single request, snap the query point to its containing H3 cell (or a rounded geohash prefix) and cache the ranked result set for that cell + filter combination for a short TTL (5-15 seconds for live driver searches, several minutes for largely-static POI searches).\n\nThis is a classic cache-key-by-bucket trick: two users standing 50 meters apart, both inside the same H3 cell, get served the identical cached response instead of two independent expensive queries - and because H3 cells at a sane resolution are small enough that \"same cell\" really does mean \"same neighborhood,\" result quality does not meaningfully suffer.",
      newComponents: [
        { name: 'Query Result Cache', description: 'Caches ranked search results keyed by (grid cell, filter combination) with a short TTL, absorbing bursts of near-identical queries from users in the same area.' },
      ],
      closingNote:
        'That completes the incremental build: a hex-grid geo-index, split by write pattern, protected from hotspots, ranked beyond raw distance, and cached for bursty demand.',
    },
  ],

  coreFlows: [
    {
      title: 'Nearby Restaurant Search',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Client
  participant API as Search API
  participant Cache as Query Cache
  participant ES as Elasticsearch (POI Index)

  C->>API: GET /v1/search/nearby lat lng radius category=coffee
  API->>API: snap point to H3 cell resolution 9
  API->>Cache: GET cached results for cell+category
  Cache-->>API: MISS
  API->>ES: geo_distance query + neighbor cells + category filter
  ES-->>API: 45 candidate POIs
  API->>API: filter open-now, blend score by distance+rating
  API->>Cache: SET ranked results TTL 120s
  API-->>C: 200 top 20 ranked results`,
      },
    },
    {
      title: 'Driver Location Update',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant D as Driver App
  participant API as Location API
  participant Redis as Redis GEO Index

  D->>API: POST /v1/locations lat lng heading timestamp
  API->>API: compute current H3 cell for driver
  API->>Redis: GEOADD live-drivers lng lat driverId
  API->>Redis: remove driver from previous cell bucket if changed
  Redis-->>API: OK
  API-->>D: 202 accepted`,
      },
    },
    {
      title: 'Ring Search: Expanding Until Enough Results',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant API as Search API
  participant Redis as Redis GEO Index

  API->>Redis: query own cell + ring k=1 (6 neighbors)
  Redis-->>API: 3 drivers found, need at least 5
  API->>Redis: expand to ring k=2 (12 more cells)
  Redis-->>API: 9 drivers found total
  API->>API: distance-filter and rank, return closest 5`,
      },
    },
  ],

  deepDives: [
    {
      title: 'Choosing a Grid Shape',
      problem:
        'You need to bucket entities into a spatial grid, but the grid shape itself determines how correct and how uniform your neighbor queries are.',
      diagram: {
        mermaid: `flowchart LR
  square["Square/geohash grid<br/>diagonal neighbor 1.41x farther"]:::database
  quad["Quadtree<br/>adapts to density<br/>still square cells"]:::compute
  hex["H3 hexagons<br/>6 neighbors, all equidistant"]:::cache
  square -->|"improves density handling"| quad
  quad -->|"fixes shape distortion"| hex`,
      },
      bad:
        'Fixed-size geohash grid everywhere. Simple to implement (string prefix matching) but every cell is the same size regardless of local density, and square cells have inconsistent neighbor distances (side neighbors at distance 1, diagonal neighbors at distance ~1.41), so "query the 8 neighbors" over- or under-includes depending on direction.',
      good:
        'A quadtree that splits dense regions into smaller cells fixes the density-adaptivity problem - Manhattan gets fine-grained cells, rural areas stay coarse. But it still uses square/rectangular cells, so the diagonal-neighbor distortion and polar distortion from geohash remain unsolved.',
      great:
        "H3's hexagonal hierarchy fixes both at once: hexagons have exactly 6 equidistant neighbors (no diagonal distortion), and the 16-resolution hierarchy with parent/child relationships gives you variable density for free - split any cell into its 7 children when it gets crowded. This is why Uber, and most ride-hailing/delivery systems built after 2018, standardized on H3 over geohash or raw quadtrees.",
    },
    {
      title: 'The Boundary / Neighbor Problem',
      problem:
        'A genuinely nearby entity sits just across a grid-cell border from the query point and gets missed if the query only checks the query point\'s own cell.',
      bad:
        'Query only the exact cell containing the search point. Fast and simple, but silently drops correct results whenever the nearest entity happens to sit in an adjacent cell - which, for a point near any edge (a meaningful fraction of all query points, given cells are typically 100m-1km wide), is common enough to be a real correctness bug, not an edge case.',
      good:
        'Always query the cell plus its immediate ring of neighbors (9-cell for squares, 7-cell for hexagons at k=1), then distance-filter the combined candidates against the true radius. This fixes the vast majority of boundary misses cheaply, at the cost of a few extra cell lookups per query.',
      great:
        'Expanding ring search: start at ring k=0 (own cell), and if the result count is below the requested minimum (or the closest found candidate is farther than the current ring radius guarantees completeness), expand to k=1, then k=2, and so on, stopping as soon as you have enough results AND the search radius covered so far provably contains all points closer than your current farthest kept result. This is what lets a search in dense Manhattan stop after k=1 while a search in rural Montana might expand to k=5 - correct in both cases, and never overqueries a dense area unnecessarily.',
      diagram: {
        mermaid: `flowchart TD
  k0["Ring k=0: own cell<br/>2 results, need 5"]:::compute
  k1["Ring k=1: +6 neighbor cells<br/>7 results total"]:::compute
  done["Enough results AND<br/>radius guarantee satisfied<br/>-> stop, rank, return"]:::client
  k0 -->|"1. Not enough"| k1
  k1 -->|"2. Enough + guarantee met"| done`,
      },
    },
    {
      title: 'The Hotspot / Dense-Area Problem',
      problem:
        'A stadium, festival, or downtown core packs orders of magnitude more entities into one grid cell than its neighbors, overloading whatever shard owns that cell.',
      bad:
        'A single fixed grid resolution and a shard-per-cell-range mapping everywhere. Works fine on average load, but a 40,000-person stadium cell hitting the same shard as its 12-person neighbor means that one shard sees thousands of times the traffic of the rest of the cluster - it falls over first and takes down search for that entire region during exactly the moment demand is highest.',
      good:
        'Detect hot cells via write/query-rate monitoring and manually (or via a scheduled job) split them into finer sub-cells ahead of known events (a stadium schedule, a holiday). This works but is reactive and operationally heavy - someone has to know the event is coming and pre-split the right cells.',
      great:
        "Dynamic, density-aware resolution: continuously track entity counts per cell and automatically switch a cell's effective search resolution up (finer) as density crosses a threshold, using H3's parent/child hierarchy so a resolution-9 cell can transparently expand into its 7 resolution-10 children without changing the API contract. Combine with shard-key hashing that spreads any single cell's entities across multiple physical shards, so even an unanticipated flash-crowd (a viral event, an accident causing everyone to reroute through one area) degrades gracefully instead of taking a single shard offline.",
    },
    {
      title: 'Keeping Driver Locations Fresh at Scale',
      problem:
        'A million drivers pinging their location every few seconds is a sustained, massive write load that must stay in sync with a low-latency read path used for matching.',
      bad:
        'Write every location ping straight into the same durable database used for POIs and business data, with a synchronous index update on every write. Works at small scale, but at 250,000 writes/sec this either saturates the database or forces expensive index rebuild overhead on every single ping, and read latency for matching queries suffers because reads and writes are contending for the same storage engine.',
      good:
        'Move live locations into a separate in-memory store (Redis GEO) so writes are cheap and reads stay fast, but still update the store synchronously and treat every single ping as equally important - including redundant pings from a driver sitting still at a red light for 30 seconds.',
      great:
        'In-memory store plus write-side filtering: only actually update the index when a driver has moved more than some minimum distance (e.g. 10 meters) or a minimum time has elapsed, dropping redundant pings before they ever reach the index. Batch nearby updates where possible, and treat the live index as intentionally ephemeral - a stale-by-a-few-seconds driver position is an acceptable tradeoff for the write throughput this buys, since the matching algorithm re-queries fresh data every match cycle anyway.',
    },
  ],

  selfAudit: [
    { question: 'Why not just a SQL WHERE clause with Haversine distance?', answer: 'Full table scan per query - no index can range-scan "distance from an arbitrary point."' },
    { question: 'What grid should I use?', answer: 'H3 hexagons in a modern system - uniform 6-neighbor distance, variable resolution via parent/child cells.' },
    { question: 'How do you avoid missing a nearby result at a cell boundary?', answer: 'Always query the cell plus its ring of neighbors, then distance-filter; expand the ring if not enough results.' },
    { question: 'How do you handle a stadium crowd overloading one cell?', answer: 'Dynamic finer-resolution splitting for dense cells, plus shard-key hashing so one cell never maps to one shard.' },
    { question: 'Where do driver locations live vs restaurant listings?', answer: 'Separate indexes - Redis GEO for volatile live locations, Elasticsearch/PostGIS for durable, rarely-changing POIs.' },
    { question: 'Is closest always best?', answer: 'No - blend distance with rating and live availability; hard-filter out closed/offline entities first.' },
    { question: 'How fresh do driver locations need to be?', answer: 'A few seconds is fine - filter out redundant pings below a minimum movement/time threshold to control write volume.' },
    { question: 'How do you protect against traffic spikes at events?', answer: 'Cache ranked results keyed by grid cell + filter combo with a short TTL, so nearby users share cached results.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  riderApp["Rider / User App"]:::client
  driverApp["Driver / Courier App"]:::client
  api["Search API"]:::compute
  cache[("Query Result Cache<br/>keyed by H3 cell + filter")]:::cache
  liveIdx[("Redis GEO<br/>live driver/courier locations")]:::cache
  poiIdx[("Elasticsearch / PostGIS<br/>static POIs")]:::database
  ranker["Ranking Service<br/>distance + rating + availability"]:::compute
  ingest["Location Ingest Service"]:::async

  riderApp -->|"1. nearby search"| api
  api -->|"2. check cache"| cache
  api -->|"3. cell + ring query"| liveIdx
  api -->|"4. cell + ring query"| poiIdx
  api -->|"5. candidates"| ranker
  ranker -->|"6. ranked results"| api
  api -->|"7. cache result"| cache
  driverApp -->|"8. location ping"| ingest
  ingest -->|"9. update cell bucket"| liveIdx`,
  },

  keyTechnologies: [
    { term: 'Geohash', definition: 'Encodes a lat/lng point as a base-32 string where a longer shared prefix between two points usually means they are closer together.' },
    { term: 'Quadtree', definition: 'A tree that recursively splits a spatial region into 4 quadrants whenever entity density crosses a threshold, giving fine resolution in dense areas.' },
    { term: 'H3', definition: "Uber's open-source hexagonal hierarchical geospatial index with 16 resolutions; hexagons give every cell exactly 6 equidistant neighbors." },
    { term: 'S2 Geometry', definition: "Google's spherical geometry library that projects the globe onto a cube and subdivides each face into a quadtree, encoded as 64-bit cell IDs." },
    { term: 'Redis GEO', definition: 'Redis commands (GEOADD, GEOSEARCH) that store locations in a sorted set keyed by an internal geohash, enabling fast in-memory radius queries.' },
    { term: 'geo_point / geo_distance', definition: "Elasticsearch's field type and query for storing coordinates and filtering/sorting documents by distance from a point." },
    { term: 'PostGIS', definition: 'A PostgreSQL extension adding geometry/geography types and spatial indexes (GiST) for transactional geo queries like ST_DWithin.' },
    { term: 'Haversine formula', definition: 'The trigonometric formula for computing great-circle distance between two lat/lng points on a sphere - used to filter/rank final candidates, not to search the whole dataset.' },
  ],

  expectedDepth: {
    mid:
      'Recognize why a plain SQL query with a distance formula does not scale, and propose geohashing as a way to bucket nearby points into a range-scannable index. Understand the basic idea of querying a grid cell and its neighbors rather than just the exact cell.',
    senior:
      'Compare geohash vs quadtree vs H3 and articulate why hexagonal grids avoid the diagonal-neighbor distortion of square grids. Design the split between a durable POI index (Elasticsearch/PostGIS) and a volatile live-location index (Redis GEO), and explain the expanding-ring search pattern for guaranteeing correctness without over-querying.',
    staffPlus:
      'Address the hotspot problem with dynamic, density-aware grid resolution and shard-key design that prevents any single cell from mapping to a single overloaded shard. Discuss write-amplification control for high-frequency location pings (movement/time thresholds before re-indexing), multi-region geo-index replication for a global product, and how ranking weights should differ by product surface (ETA-matching vs local-search browsing) while sharing the same underlying grid infrastructure.',
  },

  keyTakeaways: [
    'Lat/lng cannot be indexed directly for "nearby" queries - you need a grid (geohash, quadtree, or H3) that maps proximity to a shared prefix or shared cell ID.',
    'Always query the neighbor cells too, not just the exact cell - the boundary problem is a correctness bug, not a nice-to-have.',
    "H3's hexagonal cells give uniform 6-neighbor distances and a clean parent/child hierarchy, which is why it replaced geohash/quadtrees as the modern default for ride-hailing and delivery.",
    'Split static POIs (durable, read-heavy, Elasticsearch/PostGIS) from moving entities (volatile, write-heavy, Redis GEO) - they have fundamentally different load profiles.',
    'Dense areas need finer grid resolution and shard-key hashing, or a single hot cell takes down a single shard during exactly the traffic spike you cared about.',
    'Distance is an input to ranking, not the ranking itself - blend it with rating and live availability, and hard-filter closed/offline entities first.',
  ],

  relatedDesigns: ['ride-sharing', 'food-delivery', 'key-value-store'],
  relatedConcepts: [
    { name: 'Geospatial Indexing', description: 'The grid structures (geohash, quadtree, H3) this whole design is built on.' },
    { name: 'Sharding', description: 'Distributing grid cells across shards without letting a single dense cell overload one shard.' },
    { name: 'Caching', description: 'Absorbing bursts of near-identical nearby-search queries keyed by grid cell.' },
    { name: 'Consistent Hashing', description: 'One way to spread a single hot cell\'s entities evenly across multiple physical shards.' },
  ],

  simulator: {
    goalDescription: 'Answer "what is near this point" for millions of moving drivers and static POIs, fresh within a few seconds.',
    requirementChips: ['Search p99 < 100ms', '50K search RPS', 'Driver location fresh within 3-5s'],
    targetRps: 300000,
    readRatio: 0.17,
    cacheHitRatio: 0.5,
    latencyBudgetMsP99: 100,
    rubric: [
      { id: 'lb-at-edge', label: 'Load balancer at the edge', kind: 'requires-node-type', nodeType: 'load-balancer' },
      { id: 'live-geo-index', label: 'Live geo index for moving entities (Redis GEO)', kind: 'requires-node-type', nodeType: 'redis' },
      { id: 'poi-index', label: 'Durable search index for static POIs (Elasticsearch)', kind: 'requires-node-type', nodeType: 'elasticsearch' },
      { id: 'compute-tier', label: 'Compute tier for the search/ingest API', kind: 'requires-node-type', nodeType: ['app-server', 'microservice', 'worker'] },
      { id: 'handles-load', label: 'Handles the target load with no red bottleneck', kind: 'no-bottleneck' },
    ],
    referenceArchitecture: {
      nodes: [
        { id: 'client-1', type: 'client', instanceCount: 1, position: { x: 40, y: 200 } },
        { id: 'lb-1', type: 'load-balancer', instanceCount: 1, position: { x: 320, y: 200 } },
        { id: 'app-1', type: 'app-server', instanceCount: 15, position: { x: 600, y: 200 } },
        { id: 'redis-1', type: 'redis', instanceCount: 3, position: { x: 880, y: 120 } },
        { id: 'es-1', type: 'elasticsearch', instanceCount: 8, position: { x: 880, y: 280 } },
      ],
      edges: [
        { id: 'e-client-lb', source: 'client-1', target: 'lb-1' },
        { id: 'e-lb-app', source: 'lb-1', target: 'app-1' },
        { id: 'e-app-redis', source: 'app-1', target: 'redis-1' },
        { id: 'e-app-es', source: 'app-1', target: 'es-1' },
      ],
    },
    referenceArchitectureExplanation:
      'Redis GEO serves the volatile, write-heavy live driver/courier index while Elasticsearch serves the durable, read-heavy POI index; the app tier queries both in parallel (own cell + ring of neighbors) and merges results before ranking.',
    failureModeNarratives: {
      'load-balancer': 'Only one load balancer instance sits in front of every search and location-ingest request. If it dies, both moving-entity writes and nearby-search reads go down together.',
    },
    fullDesignLinkSlug: 'nearby-service',
  },
}

export default topic
