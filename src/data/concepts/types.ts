export type ConceptCategory =
  | 'Start Here'
  | 'Core Infrastructure'
  | 'Data & Storage'
  | 'Caching & Performance'
  | 'Communication & Messaging'
  | 'Distributed Systems'
  | 'Patterns & Architecture'
  | 'Architecture Decisions'
  | 'Security & Auth'
  | 'Performance & Operations'
  | 'Other Essentials'
  | 'Reference'

export interface ConceptDiagram {
  title?: string
  mermaid: string
}

export type ConceptBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'code'; language?: string; caption?: string; code: string }
  | { type: 'diagram'; diagram: ConceptDiagram }
  | { type: 'callout'; kind: 'tip' | 'warning' | 'mistake'; title?: string; text: string }
  | { type: 'usedIn'; items: string[] }

export interface Concept {
  slug: string
  title: string
  number: number
  category: ConceptCategory
  icon: string
  summary: string
  readTimeMinutes: number
  blocks: ConceptBlock[]
  relatedConcepts?: string[]
}
