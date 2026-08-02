import type { Concept } from './types'

const concept: Concept = {
  slug: 'service-discovery',
  title: 'Service Discovery',
  number: 40,
  category: 'Architecture Decisions',
  icon: 'pi pi-search',
  summary:
    'DNS, Consul, K8s - how one service finds the current network address of another when instances come and go constantly.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'In a dynamic environment, service instances are constantly being added, removed, or rescheduled to new IP addresses by auto-scaling and orchestration systems. Hardcoding an IP address in configuration breaks almost immediately - service discovery is the general problem of letting one service find the current, healthy address of another without a human updating config by hand.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Registry-Based Discovery',
        mermaid: `sequenceDiagram
  participant B as Service B (instance)
  participant R as Registry (Consul / etcd)
  participant A as Service A (client)
  B->>R: Register on startup (address, health check)
  A->>R: Where is Service B?
  R->>A: Current healthy instances
  A->>B: Direct request
  B->>R: Deregister on shutdown`,
      },
    },
    {
      type: 'table',
      caption: 'Service Discovery Approaches',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['DNS-based', 'A DNS name resolves to the current set of healthy instances.', 'Simple, uses existing infrastructure, but subject to client-side DNS caching delays that can point clients at stale/dead instances.'],
        ['Registry-based', 'Services register themselves with a central registry (Consul, etcd, ZooKeeper) on startup and deregister on shutdown; clients query the registry directly.', 'Fast, accurate view of current instances, but adds an extra system that itself needs to be highly available.'],
        ['Sidecar / Service Mesh', 'A sidecar proxy (Envoy, under Istio/Linkerd) sits next to each instance and handles discovery and routing transparently.', 'Application code needs no discovery client at all, but adds an extra hop and operational complexity of running a mesh.'],
        ['Load-Balancer-based', 'Clients always talk to one stable load balancer address; the LB itself tracks healthy backends.', 'Simplest option and common in smaller systems, but the LB becomes a bottleneck/single point that itself needs scaling and HA.'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Kubernetes hides this problem by default',
      text:
        'Kubernetes bundles DNS-based discovery (every Service object gets a stable DNS name) with its own internal registry (the Endpoints/EndpointSlice objects tracking healthy pods). This is why most teams running on K8s never think about service discovery explicitly - the platform handles registration, health tracking, and DNS resolution for them. Knowing this is often enough in an interview: you can say "the orchestrator handles discovery" and move on to the parts of the design that are actually novel.',
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Discovery without health-checking is dangerous',
      text:
        'Whichever approach you pick, health-checking is inseparable from discovery. A registry or DNS entry that keeps pointing at an instance after it becomes unhealthy is worse than having no discovery mechanism at all - clients will confidently route requests to a dead endpoint. This is why every discovery mechanism above is paired with active or passive health checks (see Heartbeat & Health Checks) that continuously prune bad instances from the pool.',
    },
  ],
  relatedConcepts: ['load-balancing', 'api-gateway', 'proxy'],
}

export default concept
