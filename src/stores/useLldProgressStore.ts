import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { lldProblems } from '@/data/lld'
import { useAuthStore } from '@/stores/authStore'

export interface LldProgressEntry {
  completed: boolean
  completedAt: number
  nextRevisionAt: number
  intervalIndex: number
}

const REVISION_INTERVALS_DAYS: number[] = [1, 3, 7, 14, 30, 60]
const FIRST_INTERVAL_DAYS = REVISION_INTERVALS_DAYS[0] as number
const DAY_MS = 24 * 60 * 60 * 1000

function storageKey(uid: string): string {
  return `lld-progress:${uid}`
}

function addDays(from: number, days: number): number {
  return from + days * DAY_MS
}

export const useLldProgressStore = defineStore('lldProgress', () => {
  const progress = ref<Record<string, LldProgressEntry>>({})

  function currentUid(): string {
    const authStore = useAuthStore()
    return authStore.user?.uid ?? 'guest'
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey(currentUid()))
      progress.value = raw ? JSON.parse(raw) : {}
    } catch {
      progress.value = {}
    }
  }

  function persist() {
    localStorage.setItem(storageKey(currentUid()), JSON.stringify(progress.value))
  }

  function isCompleted(slug: string): boolean {
    return progress.value[slug]?.completed ?? false
  }

  function isDue(slug: string): boolean {
    const entry = progress.value[slug]
    return Boolean(entry?.completed && entry.nextRevisionAt <= Date.now())
  }

  function daysUntilRevision(slug: string): number {
    const entry = progress.value[slug]
    if (!entry?.completed) return 0
    return Math.max(0, Math.ceil((entry.nextRevisionAt - Date.now()) / DAY_MS))
  }

  function daysOverdue(slug: string): number {
    const entry = progress.value[slug]
    if (!entry?.completed) return 0
    return Math.max(0, Math.floor((Date.now() - entry.nextRevisionAt) / DAY_MS))
  }

  function toggleCompleted(slug: string) {
    if (isCompleted(slug)) {
      delete progress.value[slug]
    } else {
      const now = Date.now()
      progress.value[slug] = {
        completed: true,
        completedAt: now,
        intervalIndex: 0,
        nextRevisionAt: addDays(now, FIRST_INTERVAL_DAYS),
      }
    }
    persist()
  }

  function markRevised(slug: string) {
    const entry = progress.value[slug]
    if (!entry?.completed) return
    const nextIndex = Math.min(entry.intervalIndex + 1, REVISION_INTERVALS_DAYS.length - 1)
    entry.intervalIndex = nextIndex
    entry.nextRevisionAt = addDays(Date.now(), REVISION_INTERVALS_DAYS[nextIndex] as number)
    persist()
  }

  const completedCount = computed(
    () => lldProblems.filter((p) => isCompleted(p.slug)).length,
  )

  const dueCount = computed(() => lldProblems.filter((p) => isDue(p.slug)).length)

  return {
    progress,
    load,
    isCompleted,
    isDue,
    daysUntilRevision,
    daysOverdue,
    toggleCompleted,
    markRevised,
    completedCount,
    dueCount,
  }
})
