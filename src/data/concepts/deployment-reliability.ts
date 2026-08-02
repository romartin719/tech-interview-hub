import type { Concept } from './types'

const concept: Concept = {
  slug: 'deployment-reliability',
  title: 'Deployment & Reliability',
  number: 44,
  category: 'Performance & Operations',
  icon: 'pi pi-cloud-upload',
  summary: 'Canary, RPO/RTO, Migrations - shipping changes without breaking production.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Every deployment is a controlled risk: you are replacing something that works with something you believe works. The strategies below differ mainly in how much of production is exposed to that belief being wrong, and for how long.',
    },
    {
      type: 'table',
      caption: 'Deployment Strategies',
      headers: ['Strategy', 'How it works', 'Trade-off'],
      rows: [
        ['Blue-Green', 'Run two full environments; switch all traffic from one to the other at once.', 'Instant rollback by switching back, but doubles infrastructure cost during the switch.'],
        ['Canary', 'Route a small % of traffic to the new version, watch error rates/latency, gradually increase if healthy.', 'Catches bad deploys with limited blast radius, at the cost of a slower, more gradual rollout.'],
        ['Rolling', 'Replace old instances with new ones a few at a time.', 'No extra infrastructure needed, but a bad deploy is live for part of your fleet during the rollout.'],
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Canary Rollout',
        mermaid: `flowchart LR
  lb["Load Balancer"]:::edge
  old["v1 (95% traffic)"]:::compute
  new["v2 canary (5% traffic)"]:::compute
  metrics["Error rate / p99 latency"]:::async
  lb -->|"95%"| old
  lb -->|"5%"| new
  new -->|"watch"| metrics
  metrics -->|"healthy -> increase %\\nunhealthy -> rollback"| lb`,
      },
    },
    {
      type: 'heading',
      text: 'RPO vs RTO',
    },
    {
      type: 'table',
      headers: ['Term', 'Definition', 'Example'],
      rows: [
        ['RPO (Recovery Point Objective)', 'How much data you can afford to lose, measured in time since the last good backup/replication point.', 'RPO of 1 hour means backups/replication must run at least hourly.'],
        ['RTO (Recovery Time Objective)', 'How long you can afford to be down before service is restored.', 'RTO of 15 minutes means your failover process, automated or not, must complete within 15 minutes.'],
      ],
    },
    {
      type: 'heading',
      text: 'Expand and Contract: Safe Schema Migrations',
    },
    {
      type: 'list',
      ordered: true,
      items: [
        'Add the new column/table without removing the old one.',
        'Deploy code that writes to both the old and new structure.',
        'Backfill old data into the new structure.',
        'Deploy code that reads only from the new structure.',
        'Only then, drop the old column/table.',
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'Never ship schema and code changes in one deploy',
      text:
        'A single deploy that both changes the schema and the code depending on it removes your ability to roll back safely - rolling back the code without rolling back the schema (or vice versa) breaks things. Canary deployments and "expand and contract" migrations are the same underlying idea applied to two different axes - code and data. Always give yourself a way to detect a problem on a small blast radius before it is everywhere.',
    },
  ],
  relatedConcepts: ['observability', 'heartbeat-health-checks', 'database-replication'],
}

export default concept
