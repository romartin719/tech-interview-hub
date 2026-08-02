export interface SimGraphNode {
  id: string
  type: string
  instanceCount: number
  position: { x: number; y: number }
}

export interface SimGraphEdge {
  id: string
  source: string
  target: string
}

export interface SimGraph {
  nodes: SimGraphNode[]
  edges: SimGraphEdge[]
}

export type RubricCriterion =
  | { id: string; label: string; kind: 'requires-node-type'; nodeType: string | string[] }
  | { id: string; label: string; kind: 'requires-connected-pair'; fromType: string; toType: string }
  | { id: string; label: string; kind: 'requires-cache-before'; cacheType: string; sinkType: string }
  | { id: string; label: string; kind: 'no-bottleneck' }
  | { id: string; label: string; kind: 'no-spof' }
  | { id: string; label: string; kind: 'meets-latency-budget' }

export interface SimulatorConfig {
  goalDescription: string
  requirementChips: string[]
  targetRps: number
  readRatio: number
  cacheHitRatio: number
  latencyBudgetMsP99: number
  rubric: RubricCriterion[]
  referenceArchitecture: SimGraph
  referenceArchitectureExplanation: string
  failureModeNarratives: Record<string, string>
  fullDesignLinkSlug: string
}

export interface HLDDiagram {
  title?: string
  mermaid: string
  bullets?: string[]
}

export interface ApiEndpoint {
  method: string
  path: string
  description: string
  example?: string
}

export interface GlossaryEntry {
  term: string
  definition: string
}

export interface SelfAuditEntry {
  question: string
  answer: string
}

export interface NfrRow {
  metric: string
  target: string
}

export interface PriorArtEntry {
  title: string
  description: string
  link?: string
}

export interface CoreEntity {
  name: string
  description: string
}

export interface TechChoiceRow {
  tier: string
  purpose: string
  primaryPick: string
  alternatives: string
  whyPrimaryWins: string
}

export interface NewComponent {
  name: string
  description: string
}

/** One incremental step in the "High-Level Design" build-up, usually scoped to a single functional requirement. */
export interface DesignBuild {
  title: string
  body: string
  insightCallout?: string
  newComponents?: NewComponent[]
  diagram?: HLDDiagram
  steps?: string[]
  closingNote?: string
}

export interface CoreFlow {
  title: string
  diagram: HLDDiagram
  nonObviousFailure?: string
}

/** A deep dive uses systemcraft's Bad -> Good -> Great progressive reveal instead of a flat write-up. */
export interface DeepDive {
  title: string
  problem: string
  simpleTerms?: string
  bad: string
  good: string
  great: string
  diagram?: HLDDiagram
}

export interface RelatedConcept {
  name: string
  description: string
}

export interface NaiveFirstCut {
  diagram: HLDDiagram
  code?: string
  whyThisBreaks: string[]
  closingNote: string
}

export interface HLDTopic {
  slug: string
  title: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  icon: string
  color: string
  readTimeMinutes: number
  topics: string[]
  companies: string[]
  prerequisites?: string[]
  summary: string

  understandingProblem: string
  realExamples?: string

  naiveFirstCut: NaiveFirstCut

  priorArt: PriorArtEntry[]

  coreEntities: CoreEntity[]

  requirements: { core: string[]; belowTheLine: string[]; nonFunctionalTable: NfrRow[] }

  technologyChoices: TechChoiceRow[]
  technologyChoicesNote: string

  scaleEstimation: string[]

  apiInterface: ApiEndpoint[]
  apiSecurityNote?: string

  highLevelDesignIntro: string
  builds: DesignBuild[]

  coreFlows: CoreFlow[]

  deepDives: DeepDive[]

  selfAudit: SelfAuditEntry[]

  finalArchitecture: HLDDiagram

  keyTechnologies: GlossaryEntry[]

  expectedDepth: { mid: string; senior: string; staffPlus: string }

  keyTakeaways: string[]

  relatedDesigns: string[]
  relatedConcepts: RelatedConcept[]

  simulator?: SimulatorConfig
}
