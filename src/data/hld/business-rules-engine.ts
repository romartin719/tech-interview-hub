import type { HLDTopic } from './types'

const topic: HLDTopic = {
  slug: 'business-rules-engine',
  title: 'Business Rules Engine',
  difficulty: 'Intermediate',
  icon: 'pi pi-cog',
  color: '#65a30d',
  readTimeMinutes: 20,
  topics: ['Rete Algorithm', 'Rule DSLs', 'Decision Tables', 'Rule Versioning'],
  companies: ['Stripe', 'Netflix', 'Amazon', 'Uber'],
  prerequisites: ['Caching'],
  summary:
    'A business rules engine lets non-engineers define decision logic (pricing, fraud checks, loan approval, feature eligibility) as versioned data instead of code, compiles active rules into an in-memory network that evaluates a bundle of facts in single-digit milliseconds, and publishes rule changes atomically while auditing every decision it makes.',

  understandingProblem:
    "Every company has decision logic that changes far more often than the code around it: \"deny loans under a 580 credit score,\" \"flag a transaction as fraud if the card country doesn't match the IP country,\" \"only show the new checkout flow to users in Canada.\" If that logic is hardcoded as if/else in application code, every tweak - even a one-line threshold change - requires an engineer, a PR review, a deploy, and a rollback plan. A business rules engine (BRE) decouples the decision from the code: rules are stored as data, business or risk teams author and publish them through a UI or API, and application code just calls evaluate(facts) and gets back a decision. This matters because decision logic changes on a completely different cadence than code (daily or hourly, driven by risk/product/compliance teams, not sprint cycles), needs to be auditable (regulators and support teams need to know exactly why a specific decision was made), and needs to be testable in isolation (you want to dry-run a new fraud rule against last week's traffic before it goes live, not find out in production).",
  realExamples:
    "Stripe Radar: merchants write fraud rules (block if card country != IP country) that evaluate on every charge. Uber: dynamic pricing and rider/driver eligibility rules that change by city and time without a mobile app release. FICO Blaze Advisor: banks encode loan underwriting policy as rules reviewed and approved by compliance. Netflix: device and account eligibility rules decide which UI, codec, or feature a session sees, versioned and rolled out centrally.",

  naiveFirstCut: {
    diagram: {
      mermaid: `flowchart LR
  client[Client]:::client
  app["Application Server<br/>if/else loan rules hardcoded"]:::compute
  db[("Applications DB")]:::database
  client -->|"1. Submit application"| app
  app -->|"2. Save application"| db`,
    },
    code: `function evaluateLoanApplication(applicant) {
  if (applicant.creditScore < 580) return "DENY";
  if (applicant.debtToIncome > 0.45) return "DENY";
  if (applicant.creditScore >= 750 && applicant.income > 100000) {
    if (applicant.loanAmount <= 50000) return "APPROVE";
  }
  if (applicant.employmentYears < 1 && applicant.loanAmount > 20000) return "DENY";
  // ...200 more lines added over 3 years by different engineers,
  // duplicated with slight drift in the fraud service and the pricing service
  return "MANUAL_REVIEW";
}`,
    whyThisBreaks: [
      'Every rule tweak - even raising a credit-score threshold for a promo - needs a code change, PR review, and a deploy; risk teams wait days for a one-line policy change.',
      'The same decision logic gets copy-pasted and drifts across services (loan service, fraud service, pricing service each have their own slightly different if/else).',
      'No audit trail - when compliance asks "why was this application denied six months ago," nobody can reconstruct which condition fired without archaeology through git blame.',
      "Can't dry-run a new rule against historical traffic before shipping it - there's no way to answer \"how many of last week's approvals would this change flip to denials?\" before it's live.",
      'A 200-line nested conditional has an exponential number of paths; test coverage only protects the branches someone thought to write a test for.',
    ],
    closingNote:
      'The fix is to stop encoding decisions as code and start encoding them as data - rules a business team can create, version, test, and publish without anyone touching a deploy pipeline.',
  },

  priorArt: [
    {
      title: 'Drools (Red Hat)',
      description:
        'Java rules engine built on the Rete algorithm; compiles rules into a discrimination network so adding a fact triggers only the rules whose conditions could plausibly change, not a full re-scan of every rule.',
      link: 'https://www.drools.org/',
    },
    {
      title: 'Stripe Radar',
      description:
        "Fraud detection product where merchants write and combine rules (e.g. block if card country != IP country) that evaluate against every charge in real time, with a rule editor and a test mode that shows the effect of a rule before it goes live.",
      link: 'https://stripe.com/radar/rules',
    },
    {
      title: 'Camunda DMN',
      description:
        'Decision Model and Notation standard, implemented by Camunda, for representing business logic as decision tables that non-engineers can edit, with a defined hit policy and versioning alongside BPMN process models.',
      link: 'https://camunda.com/dmn/',
    },
    {
      title: "Netflix's Rule-Based Device and Feature Targeting",
      description:
        'Netflix evaluates eligibility and rollout logic (which UI, codec, or feature a device or account should see) as centrally managed, versioned rule sets, so product and platform teams can target audiences without shipping a client release.',
      link: 'https://netflixtechblog.com/',
    },
  ],

  coreEntities: [
    { name: 'Rule', description: 'A single named unit of logic: a condition, an action to take if it matches, a priority, and an active/inactive flag.' },
    { name: 'Condition', description: 'A boolean expression (single comparison or an AND/OR tree of them) evaluated against the facts for one request.' },
    { name: 'Action', description: 'What happens when a rule matches: set a decision field, adjust a score, emit an event, or route to manual review.' },
    { name: 'RuleSet', description: 'A named, versioned collection of rules evaluated together for one decision type, e.g. "loan-approval" or "checkout-fraud".' },
    { name: 'Fact', description: 'A single piece of input data supplied at evaluation time, e.g. creditScore, transactionAmount, or accountCountry.' },
    {
      name: 'EvaluationContext',
      description: 'The bundle of facts, pinned ruleset version, and trace metadata that flows through one evaluation and comes back with a Decision.',
    },
  ],

  requirements: {
    core: [
      'Evaluate a set of facts against the active version of a ruleset and return a decision (approve/deny/score) plus which rules fired, within a tight latency budget.',
      'Let business and risk teams author, test, and publish rule changes through a UI or API without requiring an application code deploy.',
      'Version every rule change so publishing a new version is atomic and never corrupts an evaluation that is already in flight against the previous version.',
      'Record an immutable audit trail of every decision - which ruleset version, which facts, which rules fired, and what action was taken - for compliance and debugging.',
    ],
    belowTheLine: [
      'Machine-learning-driven rule induction or automatic threshold tuning',
      'Real-time collaborative multi-editor rule authoring (Google-Docs-style concurrent editing)',
      'Cross-region active-active rule authoring with automatic conflict resolution',
      'Natural-language-to-rule translation',
      'Automatic detection and resolution of contradictory rules beyond simple priority ordering',
    ],
    nonFunctionalTable: [
      { metric: 'p99 evaluation latency', target: '< 10ms, since evaluate() usually sits inline in a request path' },
      { metric: 'Rule publish to full rollout', target: '< 2s across all evaluator instances' },
      { metric: 'Evaluate endpoint availability', target: '99.99% - it is on the critical path of checkout/login/underwriting' },
    ],
  },

  technologyChoices: [
    {
      tier: 'Rule Storage',
      purpose: 'Durable store for rule definitions, versions, and ruleset metadata',
      primaryPick: 'PostgreSQL',
      alternatives: 'DynamoDB, MongoDB, etcd',
      whyPrimaryWins:
        'Rules, versions, and rulesets are highly relational (a ruleset has many rule versions, a rule belongs to one ruleset); Postgres gives a transactional publish (flip the active-version pointer atomically) plus easy admin queries.',
    },
    {
      tier: 'Evaluation Engine',
      purpose: 'Match facts against conditions and fire actions',
      primaryPick: 'Custom Rete-network interpreter',
      alternatives: 'Embedded Drools/Nools, naive sequential evaluator, Easy Rules',
      whyPrimaryWins:
        'A Rete network shares partial condition matches across rules and only re-evaluates the parts of the network touched by changed facts, avoiding O(rules x facts) re-checks at high QPS; a lightweight custom interpreter avoids pulling a heavyweight JVM rules engine into a polyglot stack.',
    },
    {
      tier: 'Compiled Rule Cache',
      purpose: 'Keep the active, compiled ruleset in memory on every evaluator instance',
      primaryPick: 'In-process memory cache, with Redis holding only the published-version pointer',
      alternatives: 'Redis-resident compiled rules, Memcached',
      whyPrimaryWins:
        'The evaluation hot path cannot afford a network round trip per request; each instance holds its own compiled Rete network and only asks Redis/pub-sub "has the version changed," never "what are the rules."',
    },
    {
      tier: 'Change Propagation',
      purpose: 'Tell every evaluator instance a new ruleset version was published',
      primaryPick: 'Redis Pub/Sub (or a Kafka topic)',
      alternatives: 'Polling the rules DB, ZooKeeper watches, etcd watch',
      whyPrimaryWins:
        'Push-based invalidation gets new rules live everywhere in under a couple seconds instead of waiting out a polling interval, without every instance hammering Postgres.',
    },
    {
      tier: 'Audit Log Store',
      purpose: 'Append-only record of every decision, for compliance and debugging',
      primaryPick: 'Kafka -> S3 / Elasticsearch',
      alternatives: 'Direct writes to Postgres, ClickHouse, DynamoDB with TTL',
      whyPrimaryWins:
        'Decision volume can be an order of magnitude higher than rule-change volume; a Kafka buffer absorbs write bursts and fans out to both a searchable audit index and cold storage without blocking the evaluation request.',
    },
    {
      tier: 'Authoring & Versioning UI',
      purpose: 'Let business teams create, diff, test, and publish rules',
      primaryPick: 'Git-style version table (rule_versions) with a diff/rollback API',
      alternatives: 'Full Drools Workbench, homegrown low-code rule builder',
      whyPrimaryWins:
        'A lightweight version table reuses the same publish/rollback mechanics the evaluation engine already needs and keeps authoring simple, without operating a full BRMS suite.',
    },
  ],
  technologyChoicesNote:
    "Why a Rete network instead of naive sequential evaluation? At 2,000 rules and 30 facts per request, looping through every rule and fully re-checking its condition tree on every evaluation means the same sub-conditions (e.g. \"country == 'US'\") get evaluated over and over, once per rule that happens to reference them. A Rete network compiles the ruleset once at publish time into a graph of alpha nodes (single-condition tests, evaluated once and shared) and beta nodes (joins across conditions, propagating only partial matches forward). Facts flow through the network a single time; only the rules whose conditions are actually satisfied by the current facts do any work. This turns evaluation from O(rules x facts) into work proportional to the facts that actually changed - the difference between a fraud check that takes 50ms at 2,000 rules and one that takes 2ms.",

  scaleEstimation: [
    'Rule evaluations: ~50,000/sec peak across all rulesets (fraud checks alone can run once per transaction)',
    'Active rulesets: a few hundred, each holding 20-2,000 rules (loan underwriting rulesets are large; feature-eligibility rulesets are small)',
    "Rule change frequency: tens to low hundreds of publishes/day across all rulesets, mostly clustered in business hours",
    'Latency budget: < 10ms p99 per evaluation, since it typically sits inline in a request path (checkout, login, loan application)',
    'Audit volume: ~50,000 evaluations/sec x ~5 rules fired on average = hundreds of millions of audit rows/day, needing a write-optimized append-only pipeline',
    'Fan-out: a single published version change must reach every evaluator instance (hundreds of pods) within a couple seconds',
  ],

  apiInterface: [
    {
      method: 'POST',
      path: '/v1/rulesets/{rulesetId}/evaluate',
      description: 'Evaluate a bundle of facts against the currently active version of a ruleset and return a decision plus the rules that fired.',
      example: '{"facts": {"creditScore": 710, "income": 92000, "loanAmount": 30000}} -> {"decision": "APPROVE", "firedRules": ["R2", "R5"]}',
    },
    {
      method: 'POST',
      path: '/v1/rulesets/{rulesetId}/rules',
      description: 'Create a new rule as a draft in the ruleset; has no effect on production traffic until published.',
    },
    {
      method: 'PUT',
      path: '/v1/rulesets/{rulesetId}/rules/{ruleId}',
      description: 'Edit a rule - creates a new immutable rule version rather than mutating the live one.',
    },
    {
      method: 'GET',
      path: '/v1/rulesets/{rulesetId}/rules',
      description: 'List all rules in a ruleset, optionally filtered by version.',
    },
    {
      method: 'POST',
      path: '/v1/rulesets/{rulesetId}/versions/{version}/publish',
      description: 'Compile the version and atomically flip the active-version pointer, then broadcast an invalidation event to all evaluator instances.',
    },
    {
      method: 'POST',
      path: '/v1/rulesets/{rulesetId}/versions/{version}/rollback',
      description: 'Re-point the active version back to a previous, already-compiled version - no recompilation needed.',
    },
    {
      method: 'POST',
      path: '/v1/rulesets/{rulesetId}/dry-run',
      description: 'Evaluate a draft/candidate version against supplied facts or replayed historical traffic, without recording it as a live decision.',
    },
    {
      method: 'GET',
      path: '/v1/audit/decisions/{decisionId}',
      description: 'Fetch the full audit record for a past decision - facts, ruleset version, and every rule that fired.',
    },
  ],
  apiSecurityNote:
    'Authoring endpoints (create/edit/publish/rollback) require elevated RBAC scoped per ruleset, and publish is typically gated behind a maker-checker approval (the author cannot publish their own change). The evaluate endpoint is service-to-service only, authenticated with short-lived tokens, since it sits on latency-sensitive request paths like checkout and login.',

  highLevelDesignIntro:
    "Let's build this up incrementally: start by literally moving the naive if/else into a database row instead of code, add a real expression language for conditions, make evaluation fast at scale with a Rete network, make publishing rule changes safe for in-flight requests, then make every decision explainable and every change testable before it ships.",

  builds: [
    {
      title: 'Rules as Data: A Config Table Instead of Code',
      body:
        'The naive if/else breaks because the logic lives in code. The fix: move each condition/action pair into a row in a database table instead - id, field, operator, value, action, priority. The application server reads the active rows for a ruleset (cached, refreshed periodically) and, for each request, walks them in priority order, evaluating each simple condition against the incoming facts, and applies the first match\'s action.\n\nWorked example (loan approval): row 1 = (field: creditScore, operator: <, value: 580, action: DENY, priority: 1); row 2 = (field: debtToIncome, operator: >, value: 0.45, action: DENY, priority: 2); row 3 = (field: creditScore, operator: >=, value: 750, action: FAST_TRACK, priority: 3). An application with creditScore=710, debtToIncome=0.30 skips row 1 (710 is not < 580), skips row 2 (0.30 is not > 0.45), skips row 3 (710 is not >= 750), and falls through to a default MANUAL_REVIEW.',
      newComponents: [
        { name: 'Rules DB (Postgres)', description: 'Stores each rule as a row: field, operator, value, action, priority, active flag.' },
        { name: 'Rule Loader', description: 'Component in the app server that queries the active rules for a ruleset and caches them briefly.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  client[Client]:::client
  app["Application Server<br/>loops over rule rows"]:::compute
  loader["Rule Loader<br/>cached read"]:::compute
  db[("Rules DB<br/>field, operator, value, action")]:::database
  client -->|"1. Submit application"| app
  app -->|"2. Get active rules"| loader
  loader -->|"3. Query rules"| db
  app -->|"4. Evaluate rows in order"| app`,
      },
      closingNote:
        "A risk analyst can now change the credit-score threshold with a SQL update instead of a deploy. But conditions are still limited to single \"field operator value\" triples - we need real boolean expressions like \"creditScore >= 750 AND income > 100000\".",
    },
    {
      title: 'A Condition DSL for Compound Logic',
      body:
        "Introduce a small domain-specific language for conditions, either as a readable expression string (\"creditScore >= 750 AND income > 100000\") or an equivalent JSON AST ({and: [{gte: [\"creditScore\", 750]}, {gt: [\"income\", 100000]}]}). A parser turns the stored expression into an abstract syntax tree once (at rule-save time), and an evaluator walks that tree against the fact map at request time, short-circuiting AND/OR branches. The DSL is intentionally limited to a whitelist of operators and functions - no arbitrary code execution, no loops - so a malicious or buggy rule can't run unbounded logic inline in the request path.\n\nWorked example: rule R5 = \"creditScore >= 750 AND income > 100000\". For facts {creditScore: 780, income: 120000}, the evaluator walks the AND node, evaluates the left gte clause (780 >= 750 -> true), evaluates the right gt clause (120000 > 100000 -> true), AND of two trues is true, so R5 matches and fires its FAST_TRACK action.",
      newComponents: [
        { name: 'DSL Parser/Compiler', description: "Turns a rule's condition string or JSON into a validated AST of whitelisted operators at save time." },
        { name: 'Expression Evaluator', description: 'Walks an AST against a fact map, short-circuiting AND/OR branches, and returns true/false.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  ruleText["Rule condition text<br/>creditScore >= 750 AND income > 100000"]:::storage
  parser["DSL Parser"]:::compute
  ast["Condition AST"]:::storage
  evaluator["Expression Evaluator"]:::compute
  facts["Facts<br/>creditScore, income"]:::client
  ruleText -->|"1. Parse once at save time"| parser
  parser -->|"2. Produce AST"| ast
  ast -->|"3. Walk tree"| evaluator
  facts -->|"4. Supply values"| evaluator`,
      },
      closingNote:
        'The DSL lets a single rule express real business policy. The next problem is speed: at 2,000 rules per ruleset, walking every AST against every request is wasted work if many rules share sub-conditions.',
    },
    {
      title: 'Compiling Rules into a Rete Network for Fast Repeated Evaluation',
      body:
        "Compile the whole ruleset's ASTs, once per published version, into a Rete discrimination network instead of storing them as independent trees. Alpha nodes test a single condition on a single fact type (e.g. \"country == 'US'\") and are evaluated exactly once per fact, regardless of how many rules reference that condition. Beta nodes join the outputs of alpha nodes (e.g. \"country == 'US' AND amount > 1000\") so partial matches propagate forward as tokens; a rule fires only when a token reaches its terminal node with every condition satisfied.\n\nWorked example: rules R2 (\"country == 'US' AND amount > 1000 -> REVIEW\") and R7 (\"country == 'US' AND amount > 5000 -> DENY\") both share the alpha node \"country == 'US'\". Rete evaluates that clause once per transaction and feeds the result into both beta nodes, instead of re-checking \"country == 'US'\" twice - once per rule - the way a naive per-rule AST walk would.",
      newComponents: [
        { name: 'Rete Compiler', description: "Builds the alpha/beta network from a ruleset version's rule ASTs at publish time, ahead of any request." },
        { name: 'Working Memory', description: 'Holds the facts for one evaluation as tokens flow through the network, and is discarded when evaluation completes.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  facts["Facts for one request"]:::client
  a1["Alpha: country == US"]:::compute
  a2["Alpha: amount > 1000"]:::compute
  a3["Alpha: amount > 5000"]:::compute
  b1["Beta: country US AND amount > 1000"]:::compute
  b2["Beta: country US AND amount > 5000"]:::compute
  r2["Rule R2: REVIEW"]:::database
  r7["Rule R7: DENY"]:::database
  facts -->|"1. Test country"| a1
  facts -->|"2. Test amount"| a2
  facts -->|"3. Test amount"| a3
  a1 -->|"4. Join"| b1
  a2 -->|"5. Join"| b1
  a1 -->|"6. Join"| b2
  a3 -->|"7. Join"| b2
  b1 -->|"8. Fire"| r2
  b2 -->|"9. Fire"| r7`,
      },
      closingNote:
        'Evaluation is now fast because shared conditions are checked once. But every evaluator process needs the freshest compiled network in memory, and swapping it in must never disturb an evaluation that is already mid-flight.',
    },
    {
      title: 'Immutable Rule Versions',
      body:
        'Instead of mutating rows in the live ruleset, every publish creates a brand-new immutable RuleVersion with its own compiled Rete network; the ruleset itself just holds an active_version_id pointer. An evaluation reads that pointer exactly once, at the start of the request, and pins the corresponding compiled network for the entire evaluation, no matter what gets published while it runs.\n\nWorked example: loan application #482 begins evaluating against ruleset version v12. Midway through, a risk analyst publishes v13 with a stricter debt-to-income threshold. Because #482 already pinned v12 at request start, it finishes entirely against v12 - never mixing an old alpha-node result with a new beta-node join. The very next request reads the pointer fresh and gets v13.',
      newComponents: [
        { name: 'RuleVersion', description: 'An immutable snapshot of a ruleset\'s rules plus a reference to its compiled Rete network. Never edited after creation.' },
        { name: 'Active Version Pointer', description: 'A single field per ruleset, flipped atomically on publish, that all new evaluations read at request start.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  ruleset["Ruleset: loan-approval"]:::database
  ptr["active_version_id"]:::database
  v12["RuleVersion v12<br/>compiled network"]:::storage
  v13["RuleVersion v13<br/>compiled network"]:::storage
  eval482["Evaluation #482<br/>pinned to v12"]:::compute
  ruleset -->|"1. Points to"| ptr
  ptr -.->|"2. Was pointing here"| v12
  ptr -->|"3. Now points here"| v13
  eval482 -->|"4. Reads v12 pinned<br/>at request start"| v12`,
      },
      closingNote:
        'Versioning makes publishing safe for the instance handling the publish. But with hundreds of evaluator instances, how does everyone else learn about v13 quickly?',
    },
    {
      title: 'Hot Reload via Pub/Sub Invalidation',
      body:
        'On publish, the API compiles the new version, stores it in Postgres, and flips the active_version_id pointer inside a transaction, then publishes an event ("ruleset loan-approval is now on version 13") to Redis Pub/Sub (or a Kafka topic). Every evaluator instance subscribes to that channel; on receiving the event, it asynchronously fetches the newly compiled network, builds or loads it into its local in-process cache, and swaps its local pointer - all without a restart and without every instance hammering Postgres per request.\n\nWorked example: 200 evaluator pods are running v12. The publish event for v13 reaches all of them over Pub/Sub within roughly 200ms; each pod independently fetches the compiled v13 network in the background and atomically swaps its local reference. Requests that arrive during the swap window simply pin whichever version their instance currently has - both are valid, published versions.',
      newComponents: [
        { name: 'Invalidation Publisher', description: 'Publishes a lightweight "ruleset X is now on version Y" event after a successful publish transaction.' },
        { name: 'Evaluator Cache Refresher', description: 'Subscribes to invalidation events, fetches the newly compiled network, and swaps the instance\'s local pointer.' },
      ],
      diagram: {
        mermaid: `flowchart LR
  api["Publish API"]:::edge
  db[("Postgres<br/>RuleVersions")]:::database
  bus["Redis Pub/Sub"]:::async
  e1["Evaluator instance 1"]:::compute
  e2["Evaluator instance 2"]:::compute
  e3["Evaluator instance N"]:::compute
  api -->|"1. Store v13 + flip pointer"| db
  api -->|"2. Publish invalidation event"| bus
  bus -->|"3. Notify"| e1
  bus -->|"4. Notify"| e2
  bus -->|"5. Notify"| e3
  e1 -->|"6. Fetch compiled v13"| db
  e2 -->|"7. Fetch compiled v13"| db
  e3 -->|"8. Fetch compiled v13"| db`,
      },
      closingNote:
        'Rules now propagate everywhere in about a second, safely. But nobody can yet answer "why was this specific decision made" without re-running the evaluator by hand.',
    },
    {
      title: 'Auditing Every Decision',
      body:
        "Every evaluate() call, in addition to returning a decision synchronously, asynchronously emits a decision-audit event onto a Kafka topic: the ruleset and pinned version, the full fact map, the list of rules that fired with their actions, the final decision, and a timestamp. A consumer persists these events into a queryable audit store (Elasticsearch for lookup, S3 for cold retention). This happens off the hot path - the caller never waits on the audit write.\n\nWorked example: six months later, compliance asks why loan application #482 was denied. A lookup by decision ID returns: ruleset version v12, facts {creditScore: 640, debtToIncome: 0.52, ...}, fired rules [\"R2: debtToIncome > 0.45 -> DENY\"], final decision DENY. No git archaeology required - the exact rule and exact input value that caused the denial are on record.",
      newComponents: [
        { name: 'Audit Event Publisher', description: 'Fire-and-forget publisher on the evaluation hot path that emits a decision record without blocking the response.' },
        { name: 'Audit Consumer/Indexer', description: 'Consumes decision events from Kafka and writes them into Elasticsearch (searchable) and S3 (cold, long-term retention).' },
      ],
      diagram: {
        mermaid: `flowchart LR
  evaluator["Evaluator"]:::compute
  kafka["Kafka: decisions topic"]:::async
  consumer["Audit Consumer"]:::compute
  es[("Elasticsearch<br/>searchable audit")]:::database
  s3[("S3<br/>cold retention")]:::storage
  evaluator -->|"1. Emit decision event (async)"| kafka
  kafka -->|"2. Consume"| consumer
  consumer -->|"3. Index"| es
  consumer -->|"4. Archive"| s3`,
      },
      closingNote:
        'Every past decision is now explainable. The last gap is letting business teams validate a change is safe before it ever becomes a live decision.',
    },
    {
      title: 'Rule Authoring Sandbox with Dry-Run Mode',
      body:
        "Draft rule versions can be evaluated in a sandbox against ad-hoc facts, or replayed against historical traffic sampled straight from the audit log, without ever becoming the active version and without writing to the audit log as a live decision. The replay service streams a sample of last week's real facts through both the currently active version and the draft version in parallel and reports a diff: how many decisions would change, and which ones.\n\nWorked example: an analyst drafts v13, tightening the debt-to-income threshold from 0.45 to 0.40. Before publishing, they run a dry-run against last week's 10,000 loan applications pulled from the audit log. The sandbox reports: \"340 applications that were APPROVED under v12 would be DENIED under v13.\" The analyst can now decide, with evidence, whether that's the intended blast radius before a single real applicant is affected.",
      newComponents: [
        { name: 'Sandbox Evaluator', description: 'Evaluates a draft, unpublished ruleset version in isolation - same engine, no effect on the active pointer or audit log.' },
        { name: 'Replay Service', description: "Streams historical facts sampled from the audit log through both the active and draft versions and diffs the outcomes." },
      ],
      diagram: {
        mermaid: `flowchart LR
  audit[("Audit Log<br/>historical facts")]:::database
  replay["Replay Service"]:::compute
  active["Active Version v12"]:::compute
  draft["Draft Version v13"]:::compute
  diff["Diff Report<br/>340 decisions would change"]:::client
  audit -->|"1. Sample last week's facts"| replay
  replay -->|"2. Evaluate"| active
  replay -->|"3. Evaluate"| draft
  active -->|"4. Compare"| diff
  draft -->|"5. Compare"| diff`,
      },
      closingNote:
        "This is what turns the engine from \"edit and pray\" into a self-service tool business teams actually trust: every change can be measured before it ships.",
    },
  ],

  coreFlows: [
    {
      title: 'Evaluating Rules for an Incoming Request',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant C as Caller Service
  participant EV as Evaluator Instance
  participant WM as Working Memory
  participant K as Kafka (audit)

  C->>EV: evaluate(rulesetId="loan-approval", facts)
  EV->>EV: pin locally cached active compiled version (e.g. v12)
  EV->>WM: load facts into working memory
  WM->>WM: run facts through Rete network (alpha then beta nodes)
  WM-->>EV: rules fired = [R2], decision = DENY
  EV->>K: emit decision-audit event (async, fire-and-forget)
  EV-->>C: {decision: "DENY", firedRules: ["R2"]}`,
      },
      nonObviousFailure:
        'If the evaluator has not yet received the latest invalidation event, it correctly evaluates against a slightly stale but still validly-published version - never a half-updated one.',
    },
    {
      title: 'Publishing a Rule Change',
      diagram: {
        mermaid: `sequenceDiagram
  autonumber
  participant A as Analyst
  participant API as Rules API
  participant PG as Postgres
  participant PS as Pub/Sub
  participant E1 as Evaluator 1
  participant E2 as Evaluator 2

  A->>API: POST /versions/13/publish
  API->>API: compile rule ASTs into Rete network for v13
  API->>PG: store RuleVersion v13 + flip active_version_id (txn)
  PG-->>API: committed
  API-->>A: 200 published
  API->>PS: publish "loan-approval now on v13"
  PS-->>E1: notify
  PS-->>E2: notify
  E1->>PG: fetch compiled v13
  E1->>E1: swap local pointer to v13
  E2->>PG: fetch compiled v13
  E2->>E2: swap local pointer to v13`,
      },
      nonObviousFailure:
        'Evaluations already pinned to v12 when the swap happens finish entirely against v12 - the pointer flip never reaches back into an in-progress evaluation.',
    },
  ],

  deepDives: [
    {
      title: 'Naive Sequential Rule Evaluation vs Rete Network (Avoiding O(rules x facts) Re-checks)',
      problem:
        "A ruleset with 2,000 rules and a request carrying 30 facts naively means checking every rule's full condition tree against the facts on every single evaluation - most of that work is redundant across rules and across repeated evaluations.",
      bad:
        'Loop through all 2,000 rules top to bottom for every evaluation, fully re-evaluating each rule\'s condition tree from scratch, even though many rules share the exact same sub-conditions (e.g. dozens of rules all test "country == \'US\'" independently).',
      good:
        'Index rules by the fields they reference (a hash map from "country" to the rules that test country) so an evaluation only visits rules relevant to the facts present. Better, but a clause like "creditScore >= 750" still gets evaluated once per rule that contains it, and a rule change still requires rebuilding the whole index.',
      great:
        "Build a Rete discrimination network at compile time: alpha nodes hold the result of a single-fact test and are evaluated exactly once per fact, shared by every rule whose condition tree references that clause; beta nodes join alpha outputs (e.g. \"country == 'US' AND amount > 1000\") so partial matches propagate forward as tokens without recomputation. Facts flow through the network once, and only the terminal (rule) nodes that receive a complete set of matching tokens fire. Adding a new fact only re-evaluates the alpha nodes relevant to it and the beta nodes downstream - not the whole network.",
      diagram: {
        mermaid: `flowchart TD
  subgraph badBox["Naive: O(rules x facts)"]
    r1["Rule 1: re-check all conditions"]:::compute
    r2["Rule 2: re-check all conditions"]:::compute
    r3["Rule 2000: re-check all conditions"]:::compute
  end
  subgraph greatBox["Rete: shared alpha/beta nodes"]
    alpha["Alpha node: country == US<br/>evaluated once"]:::cache
    beta1["Beta node: + amount > 1000"]:::compute
    beta2["Beta node: + amount > 5000"]:::compute
    alpha -->|"1. Shared result"| beta1
    alpha -->|"2. Shared result"| beta2
  end`,
      },
    },
    {
      title: 'Rule Versioning: Avoiding Mid-Flight Rule Changes Corrupting In-Progress Evaluations',
      problem:
        'If a ruleset is mutated in place while evaluations are running against it, a single evaluation could start matching against the old rules and finish matching against the new ones, producing a decision that never corresponds to any ruleset anyone actually published.',
      bad:
        'UPDATE the rules table directly and have every evaluator re-read the live rules on demand; a publish that changes five rows can be observed by an in-flight evaluation halfway through, so it partially applies the old ruleset and partially the new one.',
      good:
        'Lock the ruleset (or its rows) during publish so no evaluation can read a half-written state. Correct, but it serializes publishes against evaluations, and any publish taking more than a few milliseconds now adds latency - or outright blocks - every in-flight decision request.',
      great:
        'Never mutate a published version. Each publish creates a brand-new immutable RuleVersion with its own compiled Rete network; an evaluation reads the active-version pointer exactly once at request start and evaluates entirely against that snapshot, no matter how many new versions get published while it runs. Publishing then becomes just an atomic pointer flip, and rollback is equally instant since old versions are never deleted, only re-pointed to.',
      diagram: {
        mermaid: `flowchart LR
  ptr["active_version_id"]:::database
  v11["v11<br/>archived, never deleted"]:::storage
  v12["v12<br/>currently active"]:::storage
  v13["v13<br/>newly published"]:::storage
  evalOld["Evaluation pinned to v12<br/>started before publish"]:::compute
  evalNew["Evaluation pinned to v13<br/>started after publish"]:::compute
  ptr -.->|"rollback target"| v11
  ptr -->|"was pointing here"| v12
  ptr -->|"now points here"| v13
  evalOld -->|"reads snapshot"| v12
  evalNew -->|"reads snapshot"| v13`,
      },
    },
  ],

  selfAudit: [
    { question: 'How do rules get evaluated fast at scale?', answer: 'A Rete network compiled per ruleset version; alpha/beta nodes share partial matches instead of re-checking every rule against every fact.' },
    { question: 'How do rule changes go live without a deploy?', answer: 'Rules are stored as data in Postgres; publish flips an active-version pointer and broadcasts an invalidation event over pub/sub.' },
    { question: 'What stops a publish from corrupting an in-flight evaluation?', answer: 'Rule versions are immutable; each evaluation pins the version at request start and never sees a later publish mid-flight.' },
    { question: 'How is every decision made explainable later?', answer: "Every evaluation asynchronously emits an audit event (facts, version, fired rules, decision) to Kafka, indexed for lookup." },
    { question: 'How do business teams validate a change before it ships?', answer: 'Dry-run/sandbox mode replays historical facts from the audit log through the draft version and diffs the outcome against the active version.' },
    { question: "What happens if one evaluator's cached network goes stale?", answer: 'It keeps serving the last version it has until the invalidation event (or a periodic reconciliation poll) arrives - stale but never partially updated.' },
    { question: 'Why not just use Drools or Camunda off the shelf?', answer: 'You can - this design is what those tools implement internally. Building a lightweight version makes sense when it needs to be embedded in a polyglot, low-latency request path.' },
  ],

  finalArchitecture: {
    title: 'Final Architecture',
    mermaid: `flowchart LR
  analyst["Business/Risk Analyst"]:::client
  callers["Caller Services<br/>checkout, login, underwriting"]:::client
  authAPI["Authoring API<br/>create, edit, dry-run, publish"]:::edge
  pg[("Postgres<br/>Rules, RuleVersions, active pointer")]:::database
  compiler["Rete Compiler"]:::compute
  bus["Pub/Sub<br/>invalidation events"]:::async
  evalCluster["Evaluator Instances<br/>local compiled network cache"]:::compute
  redis[("Redis<br/>active-version pointer cache")]:::cache
  kafka["Kafka<br/>decision-audit events"]:::async
  auditStore[("Elasticsearch + S3<br/>searchable audit trail")]:::storage
  dashboard["Compliance / Debug Dashboard"]:::client

  analyst -->|"1. Author/edit/publish"| authAPI
  authAPI -->|"2. Compile version"| compiler
  compiler -->|"3. Store version"| pg
  authAPI -->|"4. Flip active pointer (txn)"| pg
  authAPI -->|"5. Broadcast new version"| bus
  bus -->|"6. Notify"| evalCluster
  evalCluster -->|"7. Fetch compiled version"| pg
  evalCluster -->|"8. Cache pointer"| redis
  callers -->|"9. evaluate(facts)"| evalCluster
  evalCluster -->|"10. Emit decision (async)"| kafka
  kafka -->|"11. Index"| auditStore
  dashboard -->|"12. Query past decisions"| auditStore`,
  },

  keyTechnologies: [
    { term: 'Rete Algorithm', definition: 'A pattern-matching algorithm that compiles rule conditions into a network of shared alpha/beta nodes so facts are tested once and partial matches are reused across rules, avoiding O(rules x facts) re-evaluation.' },
    { term: 'DSL (Domain-Specific Language)', definition: 'A small, restricted expression language for writing rule conditions (e.g. "amount > 1000 AND country == \'US\'") that is parsed into an AST and cannot execute arbitrary code.' },
    { term: 'Decision Table', definition: 'A spreadsheet-like representation of rules (rows = rule instances, columns = conditions/actions) that is easier for non-engineers to author and review than raw expressions.' },
    { term: 'Fact', definition: 'A single piece of input data supplied to an evaluation, e.g. creditScore or transactionAmount, that rule conditions are tested against.' },
    { term: 'Rule Versioning', definition: 'Treating every published set of rules as an immutable, numbered snapshot, so publishing is an atomic pointer flip and rollback never requires recomputation.' },
    { term: 'Working Memory', definition: "In Rete terminology, the set of facts and partial matches (tokens) flowing through the network during a single evaluation." },
  ],

  expectedDepth: {
    mid:
      'Explain moving decision logic from hardcoded if/else into a database table of rules, and why that removes the need for a deploy on every policy change. Propose a simple field/operator/value rule shape and understand why business teams need self-service rule editing.',
    senior:
      'Design a condition DSL compiled to an AST, and explain why a Rete network (shared alpha/beta nodes) beats naive sequential rule evaluation at scale. Propose immutable rule versions with an atomic active-version pointer, and pub/sub-based hot reload so evaluator instances pick up changes without a restart. Discuss the audit log as an async, non-blocking side effect of every evaluation.',
    staffPlus:
      "Address multi-tenant rulesets with per-tenant isolation and blast-radius limits on a bad publish. Discuss dry-run/sandbox evaluation against replayed historical traffic as a pre-publish safety gate, and how to detect conflicting or shadowed rules (a higher-priority rule that makes a lower-priority one unreachable) before they ship. Cover cross-region propagation of rule versions with bounded staleness, and how to keep the compiled-network build fast enough that publishing a 2,000-rule ruleset doesn't itself become the latency bottleneck.",
  },

  keyTakeaways: [
    'Represent decision logic as versioned data, not code, so business teams can change it without a deploy.',
    'A Rete network avoids O(rules x facts) re-evaluation by sharing partial matches across rules via alpha and beta nodes.',
    'Immutable rule versions plus an atomic pointer flip make publishing safe for evaluations that are already in flight.',
    'Every decision must be auditable after the fact - log facts, version, fired rules, and outcome asynchronously, off the hot path.',
  ],

  relatedDesigns: ['payment-system', 'notification-system', 'job-scheduler'],
  relatedConcepts: [
    { name: 'Caching', description: 'In-process compiled rule caches keep the evaluation hot path off the network entirely.' },
    { name: 'Pub/Sub Messaging', description: 'Push-based invalidation propagates a newly published rule version to every evaluator instance in under a second.' },
    { name: 'Event Sourcing', description: 'Immutable rule versions and an append-only decision audit log are the same pattern applied to decision logic and its outcomes.' },
  ],
}

export default topic
