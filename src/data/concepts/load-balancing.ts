import type { Concept } from './types'

const concept: Concept = {
  slug: 'load-balancing',
  title: 'Load Balancing',
  number: 2,
  category: 'Core Infrastructure',
  icon: 'pi pi-sitemap',
  summary: 'Round Robin, L4 vs L7 - spreading requests across a fleet so no single server melts.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A load balancer sits between clients and a fleet of backend servers, deciding which server handles each incoming request. The goals are to spread work evenly, avoid sending traffic to a server that is down or overloaded, and let you add or remove servers without clients ever noticing. Almost every non-trivial system-design answer starts with "put a load balancer in front of the app servers" - the interesting part is picking the right algorithm and layer for the workload.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Basic Load Balancing Topology',
        mermaid: `flowchart LR
  client[Client]:::client
  lb["Load Balancer"]:::edge
  s1["App Server 1"]:::compute
  s2["App Server 2"]:::compute
  s3["App Server 3"]:::compute
  client -->|"Request"| lb
  lb -->|"Route"| s1
  lb -->|"Route"| s2
  lb -->|"Route"| s3`,
      },
    },
    {
      type: 'table',
      caption: 'Load Balancing Algorithms',
      headers: ['Algorithm', 'How it works', 'Best for'],
      rows: [
        ['Round Robin', 'Requests are handed to each server in turn, cycling back to the start.', 'Homogeneous servers with roughly equal capacity and uniform request cost.'],
        ['Weighted Round Robin', 'Same as Round Robin, but each server gets a weight (e.g. by CPU/RAM) so bigger servers receive proportionally more requests.', 'Mixed-capacity fleets, e.g. a rolling upgrade where old and new instance types coexist.'],
        ['Least Connections', 'New requests go to the server currently handling the fewest active connections.', 'Requests with highly variable duration, where round robin could pile long-lived connections onto one server.'],
        ['IP Hash', 'The client\'s IP address is hashed to consistently pick the same backend server.', 'Cases needing session affinity without a shared session store (though sticky sessions have real downsides - see below).'],
        ['Random', 'A server is picked uniformly at random for each request.', 'Simple, stateless distribution at scale; in aggregate behaves similarly to round robin with less bookkeeping.'],
      ],
    },
    {
      type: 'heading',
      text: 'Layer 4 vs Layer 7',
    },
    {
      type: 'table',
      caption: 'L4 vs L7 Load Balancing',
      headers: ['', 'Layer 4 (Transport)', 'Layer 7 (Application)'],
      rows: [
        ['Operates on', 'TCP/UDP packets - IP address and port only', 'HTTP/HTTPS requests - URL path, headers, cookies, body'],
        ['Content awareness', 'None; forwards packets without inspecting payload', 'Can route by path (/api vs /static), header, or cookie'],
        ['TLS termination', 'Typically passes encrypted traffic through untouched', 'Can terminate TLS at the LB, decrypt, inspect, and re-encrypt (or not) to backends'],
        ['Performance', 'Very fast - minimal processing per packet', 'Slower per-request due to parsing, but enables smarter routing'],
        ['Examples', 'AWS NLB, IPVS, plain TCP proxies', 'AWS ALB, nginx, Envoy, HAProxy (HTTP mode)'],
      ],
    },
    {
      type: 'paragraph',
      text:
        'In practice, most web-facing systems use an L7 load balancer because the ability to route by URL path or hostname (e.g. sending /api/* to one service and /static/* to another) and to terminate TLS in one place is worth the extra CPU cost. L4 is reserved for cases where raw throughput matters more than content-aware routing, such as balancing generic TCP traffic or acting as the outer layer in front of an L7 tier.',
    },
    {
      type: 'heading',
      text: 'Health Checks',
    },
    {
      type: 'list',
      items: [
        'The load balancer periodically pings each backend (a lightweight /health endpoint) on an interval, e.g. every 5-10 seconds.',
        'A server that fails N consecutive checks is marked unhealthy and removed from rotation until it starts passing again.',
        'This lets the fleet tolerate individual server crashes, slow restarts, or deploys without any client-visible errors - the load balancer simply stops sending traffic to the bad instance.',
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Sticky sessions fight horizontal scaling',
      text:
        'Pinning a client to one specific server (via IP hash or a session cookie) so that in-memory session state "just works" is a common shortcut - and a common interview red flag. It breaks even load distribution (that one server\'s load never rebalances), makes deploys harder (you cannot drain a server without kicking its pinned clients), and reintroduces a single point of failure per user. The scalable fix is to keep servers stateless and externalize session state to a shared store like Redis, so any server can handle any request.',
    },
  ],
  relatedConcepts: ['proxy', 'api-gateway', 'scalability'],
}

export default concept
