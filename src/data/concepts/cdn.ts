import type { Concept } from './types'

const concept: Concept = {
  slug: 'cdn',
  title: 'CDN',
  number: 3,
  category: 'Core Infrastructure',
  icon: 'pi pi-globe',
  summary: 'Pull vs Push, Cache Invalidation - serving static (and some dynamic) content from edge locations close to users.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A Content Delivery Network (CDN) is a globally distributed set of edge servers (Points of Presence, or PoPs) that cache content physically close to end users. Instead of every request crossing continents to hit a single origin server, a user in Tokyo is served from a Tokyo PoP and a user in London from a London PoP. This cuts latency dramatically for static content and offloads huge amounts of traffic that would otherwise hit the origin directly.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Edge Caching Flow',
        mermaid: `flowchart LR
  user[User]:::client
  edge["Nearest Edge PoP"]:::edge
  origin["Origin Server"]:::compute
  user -->|"1. Request"| edge
  edge -->|"2. Cache hit? Serve directly"| user
  edge -->|"3. Cache miss"| origin
  origin -->|"4. Response, cached at edge"| edge`,
      },
    },
    {
      type: 'table',
      caption: 'Pull CDN vs Push CDN',
      headers: ['', 'Pull CDN', 'Push CDN'],
      rows: [
        ['How content arrives', 'Edge fetches from origin lazily on the first request (cache miss), then caches it.', 'You proactively upload content to the CDN ahead of time.'],
        ['Setup effort', 'Low - just point the CDN at your origin and set TTLs.', 'Higher - you manage what gets uploaded and when.'],
        ['First-request latency', 'The very first request to a given edge node is slow (origin round trip).', 'No cold miss - content is already at the edge before anyone asks.'],
        ['Best for', 'Content that changes often or is large in volume (most web/API traffic).', 'Large, infrequently-changing assets you fully control the release of (e.g. a game client build, a video library).'],
      ],
    },
    {
      type: 'heading',
      text: 'What to Cache',
    },
    {
      type: 'table',
      headers: ['Cache at the edge', 'Do not cache'],
      rows: [
        ['Static assets: JS/CSS bundles, images, fonts, videos', 'Personalized responses (a user\'s account page, cart, feed)'],
        ['Public API responses with a short, explicit TTL', 'Sensitive data (auth tokens, payment details, PII)'],
        ['Whole-page HTML for content that\'s the same for every visitor', 'Anything requiring strong consistency immediately after a write'],
      ],
    },
    {
      type: 'heading',
      text: 'Cache Invalidation',
    },
    {
      type: 'list',
      items: [
        'TTL expiry - set a max-age and let the edge naturally re-fetch after it elapses; simplest, but content can be stale for the whole TTL window.',
        'Versioned / content-hashed filenames - name each build app.a1b2c3.js instead of app.js, so a new deploy is a new URL and old cached copies simply become unreferenced rather than needing to be purged.',
        'Explicit purge API - call the CDN\'s invalidation endpoint to evict specific paths immediately; powerful but rate-limited and slower to propagate across every PoP worldwide.',
      ],
    },
    {
      type: 'usedIn',
      items: ['CloudFront', 'Cloudflare', 'Fastly', 'Akamai'],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Prefer cache-busting filenames over purge APIs',
      text:
        'At scale, explicitly purging a CDN is slow (propagation across hundreds of global PoPs takes time) and easy to forget for one path. The more robust pattern used by most large frontends is to fingerprint filenames with a content hash on every build, set an effectively infinite TTL on those hashed assets, and only ever invalidate the small, uncacheable entry-point HTML file that references them. This sidesteps invalidation entirely for the bulk of your traffic.',
    },
  ],
  relatedConcepts: ['caching', 'load-balancing', 'proxy'],
}

export default concept
