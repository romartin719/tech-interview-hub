import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ProblemStatus, Topic } from '@/types/problems'
import { allTopics } from '@/data'

const STORAGE_KEY = 'dsa-problem-tracker'

function loadFromStorage(): Record<string, ProblemStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const useProblemStore = defineStore('problems', () => {
  const statuses = ref<Record<string, ProblemStatus>>(loadFromStorage())

  watch(statuses, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function getStatus(problemId: string): ProblemStatus {
    return statuses.value[problemId] || 'not_started'
  }

  function updateStatus(problemId: string, status: ProblemStatus) {
    if (status === 'not_started') {
      delete statuses.value[problemId]
    } else {
      statuses.value[problemId] = status
    }
  }

  function getTopicStats(topic: Topic) {
    let total = 0
    let solved = 0
    let attempted = 0
    let needsReview = 0

    const phases = [...topic.interviewPhases, ...topic.cpPhases]
    for (const phase of phases) {
      for (const problem of phase.problems) {
        total++
        const s = getStatus(problem.id)
        if (s === 'solved') solved++
        else if (s === 'attempted') attempted++
        else if (s === 'needs_review') needsReview++
      }
    }

    return { total, solved, attempted, needsReview, notStarted: total - solved - attempted - needsReview }
  }

  function getPhaseStats(phase: { problems: { id: string }[] }) {
    let total = 0
    let solved = 0
    let attempted = 0
    let needsReview = 0

    for (const problem of phase.problems) {
      total++
      const s = getStatus(problem.id)
      if (s === 'solved') solved++
      else if (s === 'attempted') attempted++
      else if (s === 'needs_review') needsReview++
    }

    return { total, solved, attempted, needsReview, notStarted: total - solved - attempted - needsReview }
  }

  function resetTopic(topic: Topic) {
    const phases = [...topic.interviewPhases, ...topic.cpPhases]
    for (const phase of phases) {
      for (const problem of phase.problems) {
        delete statuses.value[problem.id]
      }
    }
  }

  function getOverallStats() {
    let total = 0
    let solved = 0
    let attempted = 0
    let needsReview = 0

    for (const topic of allTopics) {
      const stats = getTopicStats(topic)
      total += stats.total
      solved += stats.solved
      attempted += stats.attempted
      needsReview += stats.needsReview
    }

    return { total, solved, attempted, needsReview, notStarted: total - solved - attempted - needsReview }
  }

  return { statuses, getStatus, updateStatus, getTopicStats, getPhaseStats, resetTopic, getOverallStats }
})
