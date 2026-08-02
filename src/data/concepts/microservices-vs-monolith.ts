import type { Concept } from './types'

const concept: Concept = {
  slug: 'microservices-vs-monolith',
  title: 'Microservices vs Monolith',
  number: 37,
  category: 'Architecture Decisions',
  icon: 'pi pi-th-large',
  summary: 'One deployable vs many - a team/organizational decision disguised as a technical one.',
  readTimeMinutes: 8,
  blocks: [
    {
      type: 'paragraph',
      text:
        "Every system design interview eventually asks: should this be one service or several? The technical trade-offs (scaling, fault isolation, tech-stack flexibility) matter, but the decision that actually drives most real-world choices is organizational - how many teams need to ship independently without blocking each other. Getting this framing right in an interview signals more maturity than reciting the pros/cons list.",
    },
    {
      type: 'table',
      caption: 'Monolith vs Microservices',
      headers: ['Aspect', 'Monolith', 'Microservices'],
      rows: [
        ['Codebase & deployment', 'Single codebase, single deployment unit', 'Independently deployable services, often owned by separate teams'],
        ['Development experience', 'Simple to develop, test, and run locally', 'Each service is simple alone, but the full system is harder to run/test end-to-end'],
        ['Transactions', 'Easy to keep consistent - one database, real ACID transactions', 'Distributed transactions across services - needs patterns like the Saga Pattern'],
        ['Scaling', 'The whole app scales and deploys together, even if only one piece is hot', 'Each service scales independently based on its own load'],
        ['Fault isolation', 'A bug or crash in one area can take down the entire app', 'A failure in one service can be contained, though it can also cascade if not handled'],
        ['Tech stack', 'One language/runtime for the whole app', 'Each service can pick the best-fit language and datastore for its job'],
        ['Operational cost', 'Low - one thing to deploy, monitor, and debug', 'High - service discovery, distributed tracing, more infrastructure, more moving parts'],
        ['Calls between components', 'In-process function calls - fast, reliable', 'Network calls - added latency, and now every call can fail independently'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'The real driver is organizational',
      text:
        "Microservices exist primarily to let many teams ship independently without coordinating a shared release. A well-built monolith can scale to enormous traffic on its own - Shopify, early Stack Overflow, and Basecamp all ran (and some still run) successful monoliths at massive scale. If you reach for microservices in an interview, be ready to say why: is it a specific scaling bottleneck a monolith genuinely can't solve, or is it that three separate teams need to deploy on three separate schedules? Those are different problems with different justifications.",
    },
    {
      type: 'heading',
      text: 'The Modular Monolith',
    },
    {
      type: 'paragraph',
      text:
        'A middle ground worth naming explicitly: keep a single deployment unit, but enforce strict internal module boundaries (separate packages, no reaching into another module\'s internals, clear interfaces between them). This gets you much of the organizational clarity of microservices - teams own distinct modules with defined contracts - without paying for network calls, distributed transactions, or extra infrastructure. It is often the right default to propose in an interview before jumping straight to a full microservices split, and it is also a natural stepping stone if you later do need to peel a module out into its own service.',
    },
    {
      type: 'diagram',
      diagram: {
        title: 'Modular Monolith vs Microservices',
        mermaid: `flowchart TD
  subgraph Monolith["Modular Monolith (one deployment)"]
    m1["Orders Module"]:::compute
    m2["Users Module"]:::compute
    m3["Payments Module"]:::compute
  end
  db1[("Shared Database")]:::database
  Monolith --> db1

  subgraph Micro["Microservices (many deployments)"]
    s1["Orders Service"]:::compute
    s2["Users Service"]:::compute
    s3["Payments Service"]:::compute
  end
  db2[("Orders DB")]:::database
  db3[("Users DB")]:::database
  db4[("Payments DB")]:::database
  s1 --> db2
  s2 --> db3
  s3 --> db4
  s1 -.->|"network call"| s3`,
      },
    },
    {
      type: 'list',
      items: [
        'Start with a monolith (modular if the team is already bigger than one squad) unless you have a concrete reason not to.',
        'Split out a service when a specific part of the system has genuinely different scaling, reliability, or team-ownership needs than the rest.',
        'Expect to justify distributed transactions, service discovery, and observability as soon as you say "microservices" - interviewers will ask.',
      ],
    },
    {
      type: 'callout',
      kind: 'mistake',
      title: 'Saying "microservices" without a reason',
      text:
        'Announcing a microservices architecture as the default answer, without tying it to a specific scaling bottleneck a monolith could not solve or a specific team-ownership need, is a common interview red flag. It signals cargo-culting rather than a design decision. Always be ready to name the constraint that pushed you away from the simpler option.',
    },
  ],
  relatedConcepts: ['saga-pattern', 'scalability', 'api-gateway'],
}

export default concept
