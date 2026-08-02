import type { Concept } from './types'

const concept: Concept = {
  slug: 'api-gateway',
  title: 'API Gateway',
  number: 5,
  category: 'Core Infrastructure',
  icon: 'pi pi-server',
  summary: 'Routing, Auth, Rate Limiting - the single front door to a microservices backend.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Once a system is broken into more than a handful of microservices, clients can no longer be expected to know which of a dozen internal services to call, or to reimplement auth and rate limiting in every client. An API Gateway is the single entry point that sits in front of the whole microservices fleet, routes each incoming request to the right internal service, and handles the concerns that are common to all of them in one place.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'API Gateway Fanning Out to Services',
        mermaid: `flowchart LR
  client[Client]:::client
  gw["API Gateway"]:::edge
  a["Service A"]:::compute
  b["Service B"]:::compute
  c["Service C"]:::compute
  client -->|"Request"| gw
  gw -->|"Route"| a
  gw -->|"Route"| b
  gw -->|"Route"| c`,
      },
    },
    {
      type: 'heading',
      text: 'What an API Gateway Does',
    },
    {
      type: 'list',
      items: [
        'Request routing - sends each request to the correct backend microservice based on path, host, or version.',
        'Authentication and authorization - validates tokens/API keys once, at the edge, instead of in every service.',
        'Rate limiting and quotas - enforces per-client or per-API-key limits centrally.',
        'Request/response transformation - reshapes payloads, e.g. adapting a legacy service\'s response to a newer client contract.',
        'TLS termination - decrypts HTTPS once at the gateway.',
        'Response aggregation - combines multiple backend calls into a single response for the client, avoiding chatty client-to-service round trips.',
      ],
    },
    {
      type: 'paragraph',
      text:
        'The core motivation is separation of concerns: clients shouldn\'t need to know the internal service topology (which changes as the backend evolves), and cross-cutting concerns like authentication shouldn\'t be duplicated - and inevitably implemented slightly differently - inside every individual microservice. Centralizing them in the gateway means a security fix or a new rate-limit policy ships in one place.',
    },
    {
      type: 'usedIn',
      items: ['Kong', 'AWS API Gateway', 'Envoy', 'Apigee'],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'The gateway can become the bottleneck',
      text:
        'Because every single request flows through it, the API Gateway is a natural single point of failure and a natural throughput ceiling if it isn\'t scaled as carefully as the services behind it. Run it as a horizontally scaled, stateless fleet behind its own load balancer, keep per-request work (auth checks, transformations) cheap, and push heavier logic (business rules, aggregation beyond simple fan-out) back into services rather than piling it all into the gateway layer.',
    },
  ],
  relatedConcepts: ['proxy', 'load-balancing', 'rate-limiting'],
}

export default concept
