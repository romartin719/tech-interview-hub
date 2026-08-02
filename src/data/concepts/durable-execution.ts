import type { Concept } from './types'

const concept: Concept = {
  slug: 'durable-execution',
  title: 'Durable Execution',
  number: 36,
  category: 'Patterns & Architecture',
  icon: 'pi pi-cog',
  summary: 'Temporal, Step Functions - long-running, multi-step workflows that survive a process crash mid-way through.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'usedIn',
      items: ['Temporal', 'AWS Step Functions', 'Uber Cadence', 'Order fulfillment pipelines'],
    },
    {
      type: 'paragraph',
      text:
        "A business workflow that spans minutes, hours, or days - reserve inventory, charge payment, ship order, send confirmation - and makes several external calls along the way, each of which can fail, is awkward to write as plain application code. A process crash or a routine deploy at any point in the middle loses all in-memory progress, and whatever restarts has no idea which steps already ran. \"Where were we?\" becomes a real, hard question.",
    },
    {
      type: 'heading',
      text: 'The Durable-Execution Approach',
    },
    {
      type: 'paragraph',
      text:
        "A durable execution engine persists the workflow's progress to durable storage after every step completes. If the worker process running the workflow crashes, a different worker can pick it up and resume exactly where it left off - re-running only the steps that hadn't completed, rather than restarting the whole workflow from step one.",
    },
    {
      type: 'code',
      language: 'text',
      caption: 'Workflow definition (pseudocode)',
      code:
        `workflow fulfillOrder(order):
  step1: reserveInventory(order)   // durably recorded once complete
  step2: chargePayment(order)      // durably recorded once complete
  step3: shipOrder(order)          // durably recorded once complete
  // a crash after step2 resumes at step3 on restart - step1 and step2 do not re-run`,
    },
    {
      type: 'table',
      caption: 'Durable Execution vs a Plain Retry Loop',
      headers: ['', 'Plain retry loop', 'Durable execution'],
      rows: [
        ['Survives a single call failing', 'Yes', 'Yes'],
        ['Survives the entire process crashing', 'No - in-memory state (which step you were on) is lost', 'Yes - progress is persisted after each step, so any worker can resume'],
        ['Guarantees each step runs exactly once across a crash', 'No - you may re-run a step that actually completed', 'Yes - completed steps are not re-executed on resume'],
      ],
    },
    {
      type: 'table',
      caption: 'When To Reach For It',
      headers: ['Use a durable execution engine', "Don't bother"],
      rows: [
        ['Multi-day or multi-hour workflows', 'Simple synchronous request/response operations'],
        ['Workflows with many external dependencies, each of which can be flaky', 'Anything that completes in milliseconds with no meaningful crash window'],
        ['Anything where "we don\'t know what step we were on" is an unacceptable answer', 'One-off scripts where the operational overhead of a workflow engine outweighs the benefit'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'It is the Saga Pattern, pre-built',
      text:
        "Durable execution engines are effectively an off-the-shelf implementation of the Saga Pattern's step-tracking and compensation machinery - persisting progress, resuming correctly, and giving each step exactly-once semantics across crashes. Once a durable execution engine like Temporal or Step Functions is available, you rarely need to hand-roll saga orchestration (compensating transactions, manual progress tables) yourself.",
    },
  ],
  relatedConcepts: ['retry-exponential-backoff', 'idempotency', 'message-queues'],
}

export default concept
