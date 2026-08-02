import type { Concept } from './types'

const concept: Concept = {
  slug: 'api-design',
  title: 'API Design',
  number: 39,
  category: 'Architecture Decisions',
  icon: 'pi pi-code',
  summary: 'REST, GraphQL, gRPC - choosing how services and clients talk to each other.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Before picking a database or a load balancer, an interview design needs a clear API contract - what can a client ask for, and how. The three options that come up repeatedly are REST, GraphQL, and gRPC, and each fits a different shape of client-server relationship.',
    },
    {
      type: 'table',
      caption: 'REST HTTP Verbs',
      headers: ['Verb', 'Purpose', 'Idempotent?'],
      rows: [
        ['GET', 'Read a resource', 'Yes (and safe - no side effects)'],
        ['POST', 'Create a resource', 'No - calling it twice creates two resources'],
        ['PUT', 'Full replace of a resource', 'Yes - replacing with the same body twice has the same effect'],
        ['PATCH', 'Partial update of a resource', 'Not necessarily - depends on the update semantics'],
        ['DELETE', 'Remove a resource', 'Yes - deleting an already-deleted resource is still "deleted"'],
      ],
    },
    {
      type: 'list',
      items: [
        'Resource-oriented URLs - nouns, not verbs (/orders/123, not /getOrder?id=123).',
        'Statelessness - each request carries everything the server needs; no server-side session tied to a specific instance.',
        'Use HTTP status codes meaningfully - 2xx success, 4xx client error, 5xx server error, rather than always returning 200 with an error field buried in the body.',
      ],
    },
    {
      type: 'table',
      caption: 'REST vs GraphQL vs gRPC',
      headers: ['Style', 'Strengths', 'Weaknesses'],
      rows: [
        ['REST', 'Simple, ubiquitous, cacheable via standard HTTP caching', 'Can require multiple round trips or over-fetch/under-fetch data for complex nested UI needs'],
        ['GraphQL', 'Client specifies exactly the fields it needs in a single request - great for complex, nested data', 'Harder to cache at the HTTP layer; needs care (query complexity limits, dataloaders) to avoid expensive nested queries'],
        ['gRPC', 'Binary protocol (Protocol Buffers) over HTTP/2 - very fast, strongly typed, great for service-to-service calls', 'Not natively browser-friendly - needs a gateway/proxy (e.g. grpc-web) to reach client-side JavaScript'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Same Data, Three Protocols',
        mermaid: `flowchart LR
  browser["Browser Client"]:::client
  mobile["Mobile Client"]:::client
  gw["API Gateway"]:::edge
  rest["REST API"]:::compute
  gql["GraphQL API"]:::compute
  svcA["Order Service"]:::compute
  svcB["Inventory Service"]:::compute
  browser -->|"HTTP/JSON"| rest
  mobile -->|"single query"| gql
  rest --> gw
  gql --> gw
  gw -->|"gRPC"| svcA
  gw -->|"gRPC"| svcB`,
      },
    },
    {
      type: 'paragraph',
      text:
        'Rate limiting is a natural companion to any public-facing API - protecting the backend from abusive or runaway clients - but it is a large enough topic on its own that it is not re-explained here (see Rate Limiting for the algorithms and trade-offs).',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'How to choose in an interview',
      text:
        "Default to REST for simple public APIs where cacheability and familiarity matter. Reach for gRPC for internal service-to-service traffic in a service mesh, where speed and strong typing matter more than browser compatibility. Reach for GraphQL specifically when multiple client teams are fighting over-fetching/under-fetching problems against a REST API that serves many different UI shapes from the same underlying resources - it's a fix for a real, named pain point, not a default.",
    },
  ],
  relatedConcepts: ['rate-limiting', 'api-gateway', 'idempotency'],
}

export default concept
