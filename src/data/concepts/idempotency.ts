import type { Concept } from './types'

const concept: Concept = {
  slug: 'idempotency',
  title: 'Idempotency',
  number: 34,
  category: 'Patterns & Architecture',
  icon: 'pi pi-refresh',
  summary: 'Keys, Duplicate Prevention - making it safe for a client to retry the exact same request.',
  readTimeMinutes: 6,
  blocks: [
    {
      type: 'paragraph',
      text:
        'An operation is idempotent if executing it once produces the same result, and the same side effects, as executing it five times with the same input. Calling it repeatedly leaves the system in exactly the state it would be in after a single successful call. This property is what makes retries safe.',
    },
    {
      type: 'paragraph',
      text:
        "Idempotency matters in distributed systems specifically because a client that times out waiting for a response has no reliable way to know whether the request actually succeeded on the server before the connection dropped. Retrying is the only reasonable option, but if the original request was \"charge this card $50\" and it actually did succeed server-side, blindly retrying charges the customer twice. The network gives you at-least-once delivery whether you want it or not; idempotency is what turns that into effectively-once behavior.",
    },
    {
      type: 'heading',
      text: 'The Idempotency-Key Mechanism',
    },
    {
      type: 'list',
      items: [
        'The client generates a unique key (typically a UUID) for each logical operation attempt, before making the first try.',
        'The client sends that same key on every retry of that same logical operation, usually as a header like `Idempotency-Key`.',
        'The server records which keys it has already processed, along with the result of that processing.',
        'On seeing a repeat key, the server skips re-executing the operation and returns the ORIGINAL stored result instead.',
      ],
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Server-side idempotency check (pseudocode)',
      code:
        `function handleRequest(key, request):
  if seenKeys.has(key):
    return seenKeys.get(key)   // return the original result, don't redo the work

  result = process(request)   // e.g. charge the card, create the order
  seenKeys.put(key, result)
  return result`,
    },
    {
      type: 'table',
      caption: 'Idempotent vs Non-Idempotent HTTP Verbs',
      headers: ['Verb', 'Idempotent by spec?', 'Why'],
      rows: [
        ['GET', 'Yes', "Reading data doesn't change server state, so repeating it changes nothing."],
        ['PUT', 'Yes', 'Replaces a resource with a given representation - doing that twice leaves the same final representation.'],
        ['DELETE', 'Yes', 'Deleting an already-deleted resource still results in it being gone.'],
        ['POST', 'No', "Conventionally used to create a new resource or trigger an action - calling it twice creates two resources or triggers the action twice, which is exactly why idempotency keys are attached to POST requests like \"create a payment\" or \"place an order\"."],
      ],
    },
    {
      type: 'callout',
      kind: 'warning',
      title: 'The idempotency-key store has its own consistency problem',
      text:
        "The store that tracks seen keys needs a TTL (you can't remember every key forever), and the check-then-record step needs to be atomic. If two near-simultaneous retries of the same key both check \"have I seen this?\" at the same instant, both can see \"no\" and both proceed to execute the operation - the exact same race condition covered elsewhere on this site under Distributed Locking. A correct implementation needs an atomic check-and-set (e.g. a unique constraint in the DB, or `SETNX` in Redis), not a plain read followed by a write.",
    },
  ],
  relatedConcepts: ['retry-exponential-backoff', 'distributed-locking', 'circuit-breaker'],
}

export default concept
