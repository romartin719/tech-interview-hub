import type { Concept } from './types'

const concept: Concept = {
  slug: 'outbox-pattern',
  title: 'Outbox Pattern',
  number: 32,
  category: 'Patterns & Architecture',
  icon: 'pi pi-inbox',
  summary: 'Reliable Event Publishing - never let a DB write succeed while its corresponding event silently fails to publish.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'usedIn',
      items: ['Debezium (CDC)', 'Order-processing pipelines', 'Any service publishing events after a DB write'],
    },
    {
      type: 'paragraph',
      text:
        'A service often needs to do two things when something happens: update its own database, and publish an event telling the rest of the system about it. Doing these as two separate operations - write to the database, then call the message broker - creates a gap. If the process crashes after the database write but before the publish call succeeds, the database was updated but nobody else was ever told. This is the "dual write problem," and it is a quiet, hard-to-reproduce source of data inconsistency in distributed systems.',
    },
    {
      type: 'heading',
      text: 'The Solution: Write the Event Inside the Same Transaction',
    },
    {
      type: 'paragraph',
      text:
        'Instead of writing to the database and then separately calling the broker, write the business row and an "outbox" row describing the event in the exact same local database transaction. Since both inserts are part of one ACID transaction, they succeed or fail together - there is no window where one happened and the other did not. A separate relay process (or a CDC connector) then reads new outbox rows, publishes them to the real message broker, and marks them as sent once the broker confirms.',
    },
    {
      type: 'code',
      language: 'sql',
      caption: 'Business write and event write in one transaction',
      code:
        `BEGIN;

INSERT INTO orders (id, customer_id, status, total)
VALUES ('ord_123', 'cust_9', 'CREATED', 4999);

INSERT INTO outbox (event_type, payload, published)
VALUES ('OrderCreated', '{"orderId":"ord_123","total":4999}', false);

COMMIT;
-- Both rows exist, or neither does. There is no gap between them.`,
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Outbox Relay',
        mermaid: `flowchart LR
  service["Order Service"]:::compute
  db[("DB: orders + outbox\n(single transaction)")]:::database
  relay["Relay / CDC Connector"]:::async
  broker[("Message Broker")]:::async
  consumer["Downstream Consumer"]:::compute
  service -->|"1. Write order + outbox row"| db
  relay -->|"2. Read new outbox rows"| db
  relay -->|"3. Publish"| broker
  broker -->|"4. Deliver"| consumer
  relay -->|"5. Mark row published"| db`,
      },
    },
    {
      type: 'paragraph',
      text:
        'The relay step only needs to guarantee "at least once" delivery, which is much easier to build reliably than "exactly once." If the relay crashes after publishing to the broker but before marking the outbox row as sent, it will simply republish the same event on restart. No event is ever silently lost - the worst case is a duplicate, which is why downstream consumers of an outbox-fed stream need to be idempotent.',
    },
    {
      type: 'paragraph',
      text:
        'The most common production implementation skips a polling relay entirely and uses Change Data Capture (CDC) tools like Debezium, which tail the database\'s own write-ahead log (WAL) to detect new outbox rows the moment they commit, then forward them to Kafka or another broker. This avoids adding polling load to the database and typically delivers events with lower latency than a poll-based relay.',
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Outbox is the plumbing under Choreography sagas',
      text:
        'The Saga Pattern\'s choreography style depends on every service reliably emitting an event whenever it finishes a step - and that reliability guarantee is exactly what the Outbox Pattern provides. In an interview, connecting the two shows depth: Outbox is not a competing idea to Sagas, it is usually the mechanism that makes a choreographed saga\'s event flow trustworthy in the first place.',
    },
  ],
  relatedConcepts: ['saga-pattern', 'event-sourcing-cqrs', 'message-queues'],
}

export default concept
