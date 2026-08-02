import type { Concept } from './types'

const concept: Concept = {
  slug: 'saga-pattern',
  title: 'Saga Pattern',
  number: 31,
  category: 'Patterns & Architecture',
  icon: 'pi pi-list',
  summary: 'Choreography vs Orchestration - a multi-step transaction across services that cannot use one database transaction.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'usedIn',
      items: ['Uber trip booking', 'E-commerce checkout flows', 'Travel booking (flight + hotel + car)'],
    },
    {
      type: 'paragraph',
      text:
        'A single business operation sometimes needs to touch several services, each with its own database. Booking a trip might need to reserve a flight, a hotel, and a rental car - three services, three databases, no shared transaction log between them. A single ACID transaction that spans all three is not an option once you have crossed a service boundary, so you need a different way to guarantee the operation either fully succeeds or is fully undone.',
    },
    {
      type: 'heading',
      text: 'The Saga Solution',
    },
    {
      type: 'paragraph',
      text:
        'A saga breaks the operation into a sequence of local transactions, each owned and committed by a single service. If a later step fails, the saga runs compensating transactions that semantically undo the earlier steps, in reverse order. This is not a literal rollback - the earlier steps already committed and other parts of the system may have already observed them - so "undo" means issuing a new, opposite operation (cancel the reservation, refund the charge) rather than erasing history.',
    },
    {
      type: 'table',
      caption: 'Orchestration vs Choreography',
      headers: ['Approach', 'How it works', 'Trade-off'],
      rows: [
        ['Orchestration', 'A central saga coordinator explicitly calls each service in sequence and tells it what to do next, invoking compensations itself if a step fails.', 'Easier to understand, debug, and monitor since the whole flow lives in one place, but the coordinator becomes a new central component and a potential bottleneck/single point of coordination.'],
        ['Choreography', 'Each service reacts to an event from the previous step and emits its own event when it finishes, with no central coordinator at all.', 'More decoupled - no single service knows the whole flow - but the overall process becomes implicit, spread across many services\' event handlers, which makes it much harder to trace and reason about end to end.'],
      ],
    },
    {
      type: 'heading',
      text: 'Walkthrough: Trip Booking Saga',
    },
    {
      type: 'list',
      items: [
        'Reserve flight - flight service commits a local transaction, seat is held.',
        'Reserve hotel - hotel service commits a local transaction, room is held.',
        'Reserve car - car service attempts to reserve, but the fleet is sold out and the step fails.',
        'Compensate: cancel hotel - release the room that was held in step 2.',
        'Compensate: cancel flight - release the seat that was held in step 1.',
        'The user is told the booking failed, and no partial trip is left dangling in any of the three services.',
      ],
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Saga Failure and Compensation',
        mermaid: `flowchart LR
  start["Start Booking"]:::client
  flight["Reserve Flight"]:::compute
  hotel["Reserve Hotel"]:::compute
  car["Reserve Car"]:::compute
  fail["Car Reservation Fails"]:::edge
  compHotel["Compensate: Cancel Hotel"]:::async
  compFlight["Compensate: Cancel Flight"]:::async
  start --> flight --> hotel --> car --> fail
  fail --> compHotel --> compFlight`,
      },
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'Compensations are not automatic',
      text:
        'There is no framework that magically "undoes" a committed remote transaction - every compensating action has to be written by hand for every step, in advance, before you ever need it. Compensating transactions must also be idempotent, because retries and duplicate delivery are normal in distributed systems: canceling an already-canceled hotel reservation must be a safe no-op, not an error. This design-and-write-it-yourself cost is the real price of choosing a saga over a single database transaction, and it is exactly what an interviewer is listening for when they ask "what happens if step 3 fails?"',
    },
  ],
  relatedConcepts: ['outbox-pattern', 'event-sourcing-cqrs', 'message-queues'],
}

export default concept
