import type { Concept } from './types'

const concept: Concept = {
  slug: 'proxy',
  title: 'Proxy: Forward vs Reverse',
  number: 4,
  category: 'Core Infrastructure',
  icon: 'pi pi-shield',
  summary: 'Forward proxies act on behalf of clients; reverse proxies act on behalf of servers.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A proxy is an intermediary that sits between two parties and relays traffic on behalf of one of them. The direction it faces determines what it is called and what problems it solves: a forward proxy represents clients to the outside world, while a reverse proxy represents servers to the outside world. Both hide topology and add a control point, but for opposite sides of the connection - and mixing the two up is a common way to lose points in an interview.',
    },
    {
      type: 'table',
      caption: 'Forward Proxy vs Reverse Proxy',
      headers: ['', 'Forward Proxy', 'Reverse Proxy'],
      rows: [
        ['Sits in front of', 'Clients (inside a network, e.g. a corporate LAN)', 'Servers (a backend fleet)'],
        ['Hides identity of', 'The client, from the servers it talks to', 'The servers, from the clients that talk to it'],
        ['Typical uses', 'Corporate content filtering/monitoring, caching outbound requests, bypassing geo-restrictions, anonymizing client IPs', 'Load balancing, TLS termination, caching inbound responses, shielding internal topology'],
        ['Who configures it', 'The client\'s organization (it knows the proxy exists)', 'The server\'s organization (the client usually has no idea it exists)'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Reverse Proxy in a Typical HLD',
        mermaid: `flowchart LR
  client[Client]:::client
  rp["Reverse Proxy / LB"]:::edge
  s1["App Server 1"]:::compute
  s2["App Server 2"]:::compute
  client -->|"Request"| rp
  rp -->|"Terminate TLS, route"| s1
  rp -->|"Terminate TLS, route"| s2`,
      },
    },
    {
      type: 'paragraph',
      text:
        'A reverse proxy is the piece almost every backend system diagram starts with: clients only ever talk to it, never directly to an app server. It can terminate TLS once instead of on every backend instance, cache common responses, compress payloads, and load-balance across a fleet - all without the client knowing (or needing to know) how many servers exist behind it or how they are arranged.',
    },
    {
      type: 'usedIn',
      items: ['nginx', 'HAProxy', 'Envoy', 'Squid'],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Reverse proxy vs API Gateway',
      text:
        'A plain reverse proxy (nginx, HAProxy) routes and load-balances traffic at the HTTP layer but generally stops there. An API Gateway does everything a reverse proxy does and layers business-aware concerns on top: authentication/authorization, per-client rate limiting, request/response transformation, and routing decisions based on application logic rather than just the URL path. In an interview, calling out this distinction signals you understand where infrastructure concerns end and application-aware routing begins.',
    },
  ],
  relatedConcepts: ['load-balancing', 'api-gateway', 'cdn'],
}

export default concept
