import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { hldTopics } from '@/data/hld'
import { useAuthStore } from '@/stores/authStore'

export interface HldProgressEntry {
  completed: boolean
  completedAt: number
}

function storageKey(uid: string): string {
  return `hld-progress:${uid}`
}

export const useHldProgressStore = defineStore('hldProgress', () => {
  const progress = ref<Record<string, HldProgressEntry>>({})

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

  function toggleCompleted(slug: string) {
    if (isCompleted(slug)) {
      delete progress.value[slug]
    } else {
      progress.value[slug] = { completed: true, completedAt: Date.now() }
    }
    persist()
  }

  const completedCount = computed(() => hldTopics.filter((t) => isCompleted(t.slug)).length)

  return {
    progress,
    load,
    isCompleted,
    toggleCompleted,
    completedCount,
  }
})
