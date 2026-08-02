import type { Concept } from './types'

const concept: Concept = {
  slug: 'event-sourcing-cqrs',
  title: 'Event Sourcing & CQRS',
  number: 30,
  category: 'Patterns & Architecture',
  icon: 'pi pi-history',
  summary: 'Storing the sequence of changes instead of just current state, and splitting reads from writes.',
  readTimeMinutes: 9,
  blocks: [
    {
      type: 'usedIn',
      items: ['Event Store', 'Kafka-based architectures', 'Banking ledgers', 'Git (conceptually)'],
    },
    {
      type: 'paragraph',
      text:
        'Most systems store current state directly: a row says "balance = $500" and every update overwrites that row in place. Event Sourcing takes a different approach - instead of storing the current state, you store every event that led to it. The balance is never written directly; it is derived by replaying "deposited $200," "withdrew $50," and every other event that ever happened to that account, in order.',
    },
    {
      type: 'heading',
      text: 'Event Sourcing: State as a Fold Over Events',
    },
    {
      type: 'paragraph',
      text:
        'Current state becomes a pure function of history: state = fold(events, initialState). Nothing is ever deleted or overwritten - new facts are only ever appended. Below is the core idea in a few lines of pseudocode.',
    },
    {
      type: 'code',
      language: 'javascript',
      caption: 'Deriving current state by replaying events',
      code:
        `const events = [
  { type: 'AccountOpened', amount: 0 },
  { type: 'Deposited', amount: 200 },
  { type: 'Withdrew', amount: 50 },
  { type: 'Deposited', amount: 350 },
]

function applyEvent(balance, event) {
  switch (event.type) {
    case 'AccountOpened': return balance
    case 'Deposited':     return balance + event.amount
    case 'Withdrew':      return balance - event.amount
    default:              return balance
  }
}

// Current state is just a reduce over the full event log.
const currentBalance = events.reduce(applyEvent, 0) // 500`,
    },
    {
      type: 'list',
      items: [
        'Complete audit trail for free - every historical change is a first-class, permanent record, not something bolted on with a separate "audit_log" table that can drift out of sync.',
        'Time travel - you can reconstruct the exact state as of any point in time by replaying events only up to that point, which is invaluable for debugging "how did we get into this state" incidents.',
        'New read models later, without data loss - if you realize six months in that you need a new view of the data (e.g. "spending by category"), you can build it by replaying history you already have, instead of discovering the detail was never captured.',
      ],
    },
    {
      type: 'heading',
      text: 'CQRS: Separate Models for Writes and Reads',
    },
    {
      type: 'paragraph',
      text:
        'CQRS (Command Query Responsibility Segregation) is a complementary but independent idea: use a different model for writing data than for reading it. Writes go through a "command" model optimized for validating business rules and recording changes correctly. Reads go through a separate "query" model - often a denormalized, precomputed view shaped exactly like the UI or API that consumes it - optimized for fast, simple lookups. The two models can even live in entirely different databases (e.g. Postgres for commands, Elasticsearch or a read-optimized NoSQL store for queries), kept in sync asynchronously.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Event Sourcing + CQRS Together',
        mermaid: `flowchart LR
  client[Client]:::client
  cmd["Command Handler"]:::compute
  store[("Event Store")]:::database
  projector["Async Projector"]:::async
  view[("Read-Optimized View")]:::cache
  query["Query Handler"]:::compute
  client -->|"1. Write command"| cmd
  cmd -->|"2. Append event"| store
  store -->|"3. Stream new events"| projector
  projector -->|"4. Update projection"| view
  client -->|"5. Read query"| query
  query -->|"6. Fast lookup"| view`,
      },
    },
    {
      type: 'table',
      caption: 'When to Reach for Event Sourcing / CQRS',
      headers: ['Use it when', 'Skip it when'],
      rows: [
        ['The domain has real audit/compliance requirements (finance, healthcare, anything regulated).', 'It is a simple CRUD app - a single shared model for reads and writes is simpler and good enough.'],
        ['Read patterns are so different from write patterns that one shared schema serves neither well.', 'The team cannot yet operate eventual consistency between the write side and the read side in production.'],
        ['You need to reconstruct historical state or debug "what happened" incidents after the fact.', 'Strong read-after-write consistency is a hard requirement everywhere in the app.'],
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'CQRS does not require Event Sourcing',
      text:
        'These two patterns are frequently mentioned in the same breath, but they are independent decisions. You can absolutely split reads and writes into separate models (CQRS) while both models are plain state-based tables with no event log at all. Event Sourcing is one way to feed a CQRS read side, not a prerequisite for it. In an interview, calling this out shows you understand the patterns individually rather than as a single bundled buzzword.',
    },
  ],
  relatedConcepts: ['saga-pattern', 'outbox-pattern', 'database-replication'],
}

export default concept
