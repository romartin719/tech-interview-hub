export interface LLDDiagram {
  title?: string
  mermaid: string
}

export interface CoreEntity {
  name: string
  description: string
}

export interface DesignPatternUsage {
  pattern: string
  where: string
  why: string
}

export interface DataStructureChoice {
  component: string
  structure: string
  why: string
}

export interface Walkthrough {
  title: string
  steps: string[]
}

export interface CodeFile {
  filename: string
  rationale: string
  code: string
  calloutTitle?: string
  callout?: string
}

export interface ExtensionIdea {
  extension: string
  implementation: string
}

export interface LLDProblem {
  slug: string
  title: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  icon: string
  color: string
  readTimeMinutes: number
  patterns: string[]
  companies: string[]
  summary: string

  functionalRequirements: string[]
  nonFunctionalRequirements: string[]

  coreEntities: CoreEntity[]

  classDiagram: LLDDiagram

  designPatterns: DesignPatternUsage[]
  dataStructures: DataStructureChoice[]

  walkthroughs: Walkthrough[]

  codeFiles: CodeFile[]

  stateDiagram?: LLDDiagram
  sequenceDiagram: LLDDiagram

  extensions: ExtensionIdea[]

  interviewerChecklist: string[]

  relatedDesigns: string[]
  keyTakeaways: string[]
}
