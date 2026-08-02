import type { Concept } from './types'

const concept: Concept = {
  slug: 'heartbeat-health-checks',
  title: 'Heartbeat & Health Checks',
  number: 46,
  category: 'Other Essentials',
  icon: 'pi pi-heart',
  summary: "Liveness, Readiness - how a system notices a dead or struggling instance before users do.",
  readTimeMinutes: 5,
  blocks: [
    {
      type: 'paragraph',
      text:
        'A heartbeat is a small, periodic "I\'m alive" signal a node sends to a monitor, registry, or peer. If heartbeats stop arriving for longer than a configured timeout, the node is presumed dead and is removed from rotation, failed over, or restarted. It is the simplest mechanism a distributed system has for noticing that something has gone wrong.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Heartbeats and Failure Detection',
        mermaid: `flowchart LR
  node["Service Instance"]:::compute
  monitor["Health Monitor /\\nService Registry"]:::async
  lb["Load Balancer"]:::edge
  node -->|"heartbeat every N sec"| monitor
  monitor -->|"timeout exceeded ->\\nmark unhealthy"| lb
  lb -->|"route around\\ndead instance"| node`,
      },
    },
    {
      type: 'table',
      caption: 'Liveness vs Readiness',
      headers: ['Probe', 'Question it answers', 'On failure'],
      rows: [
        ['Liveness', 'Is this process alive at all?', 'Orchestrator restarts the container/process - something is fundamentally stuck.'],
        ['Readiness', 'Is this instance ready to receive traffic right now?', 'Instance is removed from the load balancer\'s rotation WITHOUT being restarted - useful when it is alive but overloaded or still warming up/connecting to dependencies.'],
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'Conflating liveness and readiness',
      text:
        'Using only a liveness check means an instance that is alive but cannot reach its database still receives traffic and fails every request - a readiness check would have quietly pulled it out of rotation instead, avoiding user-visible errors entirely.',
    },
    {
      type: 'paragraph',
      text:
        'There is a timing trade-off in every failure-detection design: a short heartbeat interval/timeout detects failures fast but risks false positives from a brief GC pause or network blip, triggering unnecessary failovers or restarts. A long interval is more tolerant of blips but leaves a dead node serving - or blocking - traffic for longer.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Heartbeats underpin bigger patterns',
      text:
        'Heartbeats are not just a health-check detail - Service Discovery and Leader Election both depend entirely on them to know when to remove an instance from the registry or trigger a new election. If you are asked to design either of those in an interview, heartbeats and their timeout trade-offs are exactly where the interesting failure-mode discussion lives.',
    },
  ],
  relatedConcepts: ['observability', 'deployment-reliability'],
}

export default concept
