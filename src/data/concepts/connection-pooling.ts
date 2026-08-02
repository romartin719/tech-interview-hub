import type { Concept } from './types'

const concept: Concept = {
  slug: 'connection-pooling',
  title: 'Connection Pooling',
  number: 6,
  category: 'Core Infrastructure',
  icon: 'pi pi-link',
  summary: 'Reusing a fixed set of expensive-to-open database connections instead of opening one per request.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Opening a new database connection is not cheap: it means a fresh TCP handshake, often a TLS handshake on top of that, and then the database\'s own authentication and session setup - easily tens of milliseconds before a single query even runs. Databases also cap how many connections they can hold open at once (often just a few thousand, regardless of how much traffic the app tier can generate), because each open connection reserves memory and a backend process/thread on the database server. Opening and closing a connection per request wastes latency and can exhaust that cap under load.',
    },
    {
      type: 'paragraph',
      text:
        'A connection pool solves this by opening a fixed set of connections up front and handing them out to requests as needed. A request "borrows" a connection from the pool, uses it, and returns it when done - it is never actually closed between uses. Instead of N concurrent requests opening N new connections, they share and reuse a much smaller pool of M already-open ones.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Without vs With a Connection Pool',
        mermaid: `flowchart TD
  subgraph without["Without Pooling"]
    r1["Request 1"]:::client
    r2["Request 2"]:::client
    r3["Request 3"]:::client
    r1 -->|"opens + closes"| db1[("Database")]:::database
    r2 -->|"opens + closes"| db1
    r3 -->|"opens + closes"| db1
  end
  subgraph with["With Pooling"]
    q1["Request 1"]:::client
    q2["Request 2"]:::client
    q3["Request 3"]:::client
    pool["Connection Pool (M open connections)"]:::cache
    q1 -->|"borrow/return"| pool
    q2 -->|"borrow/return"| pool
    q3 -->|"borrow/return"| pool
    pool --> db2[("Database")]:::database
  end`,
      },
    },
    {
      type: 'table',
      caption: 'Key Pool Configuration Parameters',
      headers: ['Parameter', 'What it controls'],
      rows: [
        ['Min pool size', 'Number of connections kept open even when idle, so a burst of traffic doesn\'t have to pay handshake cost.'],
        ['Max pool size', 'Hard cap on concurrent connections this app instance can hold - the main lever to protect the database.'],
        ['Connection timeout', 'How long a request waits for a free connection before failing, when the pool is fully checked out.'],
        ['Idle timeout', 'How long an unused connection sits open before the pool closes it and shrinks back toward the minimum.'],
        ['Validation query', 'A cheap query (e.g. SELECT 1) run before handing out a connection, to catch ones the DB silently dropped.'],
      ],
    },
    {
      type: 'usedIn',
      items: ['HikariCP', 'PgBouncer', 'Django connection pooling', 'RDS Proxy'],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: '"Just make the pool bigger" is the wrong instinct',
      text:
        'It\'s tempting to think a bigger max pool size can only help throughput, but each open connection costs the database memory and scheduling overhead, and most databases perform worse - not better - once concurrent connections climb into the thousands, well before hitting the hard connection cap. A common fix at scale is an external pooler like PgBouncer sitting between many app instances and the database, multiplexing a large number of app-side logical connections onto a much smaller, tuned number of real database connections.',
    },
  ],
  relatedConcepts: ['load-balancing', 'caching', 'scalability'],
}

export default concept
