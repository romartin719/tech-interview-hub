import type { Concept } from './types'

const concept: Concept = {
  slug: 'rate-limiting',
  title: 'Rate Limiting',
  number: 17,
  category: 'Caching & Performance',
  icon: 'pi pi-hourglass',
  summary: 'Token Bucket, Sliding Window - capping how much traffic a client can send in a time window.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Rate limiting caps how many requests a client - an IP, an API key, a user ID - can make in a given window, protecting a system from abusive traffic, runaway retries, and noisy-neighbor effects between tenants. The interview questions worth being precise on are: which algorithm, enforced at which layer, and how do multiple app servers agree on one shared count.',
    },
    {
      type: 'table',
      caption: 'Algorithms',
      headers: ['Algorithm', 'How it works', 'Trade-off'],
      rows: [
        ['Token Bucket', 'A bucket holds up to N tokens and refills at a steady rate; each request consumes one token and is rejected if the bucket is empty.', 'Allows short bursts up to the bucket size while enforcing a steady average rate - the most common choice in production.'],
        ['Leaky Bucket', 'Requests queue up and are processed (leak out) at a constant rate, regardless of how bursty the input is.', 'Smooths output to a strictly constant rate, but adds queueing latency and no bursts are allowed at all.'],
        ['Fixed Window Counter', 'Count requests in the current fixed window (e.g. 00:00-00:59) and reset the counter every window boundary.', 'Simplest to implement, but a client can send N requests right at the end of one window and another N right at the start of the next, getting 2x the intended rate in a short span.'],
        ['Sliding Window Log', 'Keep a timestamp for every request in the last window and count how many fall within it.', 'Perfectly accurate, but memory cost grows with request volume since every timestamp must be stored.'],
        ['Sliding Window Counter', 'Approximate the sliding window by weighting the previous and current fixed-window counts proportionally to overlap.', 'Much cheaper than a full log while avoiding the fixed-window boundary-burst problem - a good middle ground.'],
      ],
    },
    {
      type: 'heading',
      text: 'Token Bucket Walkthrough',
    },
    {
      type: 'paragraph',
      text: 'Say a client is limited to 10 requests/second with a bucket size of 20. The bucket starts full at 20 tokens and refills at 10 tokens/second. If the client sends 20 requests in the first 100ms, all 20 succeed (burst absorbed by the full bucket), but the 21st request within that same second is rejected since the bucket is now empty and has only had time to refill a fraction of a token. A client that sends a steady 10 requests/second indefinitely never gets rejected, because it consumes tokens exactly as fast as they refill.',
    },
    {
      type: 'list',
      items: [
        'Edge / CDN - coarse, IP-based limiting to blunt DDoS and scraping traffic before it reaches your infrastructure at all.',
        'API gateway - per-user or per-API-key quotas (e.g. "1000 requests/hour on the free tier"), enforced before the request reaches any backend service.',
        'Service level - domain-specific limits deep in the call graph (e.g. capping how many password-reset emails one account can trigger per hour), where the gateway has no visibility into the business rule.',
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Distributed Rate Limiter',
        mermaid: `flowchart LR
  client[Client]:::client
  lb["Load Balancer"]:::edge
  app1["App Server 1"]:::compute
  app2["App Server 2"]:::compute
  redis[("Shared Redis Counter")]:::cache
  client --> lb
  lb --> app1
  lb --> app2
  app1 -->|"INCR + EXPIRE (Lua, atomic)"| redis
  app2 -->|"INCR + EXPIRE (Lua, atomic)"| redis`,
      },
    },
    {
      type: 'paragraph',
      text: 'If rate limiting happens in-process on each app server, a client behind a round-robin load balancer can get N times the intended limit simply by spreading requests across N servers. A correct distributed rate limiter needs a shared store - almost always Redis - with an atomic check-and-decrement, typically implemented as a single Lua script (`EVAL`) that reads the current count, checks it against the limit, and increments it in one atomic round trip, so concurrent requests from different app servers can never race past the count-check step.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Always return rate-limit headers',
      text: 'A well-designed rate limiter tells clients where they stand rather than just failing silently: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and on a 429 response, `Retry-After` telling the client exactly how long to wait. Well-behaved clients (and SDKs) use these to back off proactively instead of hammering the endpoint and retrying blindly, which is what actually keeps a rate limiter from becoming the bottleneck itself under load.',
    },
  ],
  relatedConcepts: ['caching', 'load-balancing'],
}

export default concept
