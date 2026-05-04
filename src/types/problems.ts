export type ProblemStatus = 'not_started' | 'attempted' | 'solved' | 'needs_review'

export interface Problem {
  id: string
  name: string
  url?: string
}

export interface Phase {
  name: string
  description: string
  problems: Problem[]
}

export interface Resource {
  name: string
  description: string
  type: 'video' | 'book' | 'written' | 'platform'
  category: 'interview' | 'cp' | 'both'
  url?: string
}

export interface TimelineEntry {
  title: string
  description: string
}

export interface Topic {
  id: string
  name: string
  icon: string
  description: string
  interviewPhases: Phase[]
  cpPhases: Phase[]
  resources: Resource[]
  interviewTimeline: TimelineEntry[]
  cpTimeline: TimelineEntry[]
  studyApproach: { interview: string; cp: string }
  patternsSummary?: string[]
  tips?: string[]
  placeholder?: boolean
}
