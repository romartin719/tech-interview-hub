<script setup lang="ts">
import { computed } from 'vue'
import type { PracticeLanguage } from '@/composables/useCodeExecution'

const props = defineProps<{
  language: PracticeLanguage
  languages: PracticeLanguage[]
  isRunning: boolean
  timerSeconds: number
}>()

const emit = defineEmits<{
  'change-language': [language: PracticeLanguage]
  run: []
  save: []
}>()

const LANGUAGE_LABEL: Record<PracticeLanguage, string> = {
  java: 'Java',
  python: 'Python',
  cpp: 'C++',
  javascript: 'JavaScript',
}

const timerDisplay = computed(() => {
  const minutes = Math.floor(props.timerSeconds / 60)
  const seconds = props.timerSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})
</script>

<template>
  <div class="practice-header">
    <div class="language-tabs">
      <button
        v-for="lang in languages"
        :key="lang"
        class="language-tab"
        :class="{ active: lang === language }"
        @click="emit('change-language', lang)"
      >
        {{ LANGUAGE_LABEL[lang] }}
      </button>
    </div>
    <div class="header-actions">
      <span class="timer-display"><i class="pi pi-clock"></i> {{ timerDisplay }}</span>
      <button class="sc-btn-secondary" :disabled="isRunning" @click="emit('save')">
        <i class="pi pi-save"></i> Save
      </button>
      <button class="sc-btn-primary" :disabled="isRunning" @click="emit('run')">
        <i class="pi pi-play"></i> {{ isRunning ? 'Running…' : 'Run' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.practice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
}

.language-tabs {
  display: flex;
  gap: 0.35rem;
}

.language-tab {
  background: transparent;
  border: 1px solid var(--sc-border);
  color: var(--sc-text-muted);
  border-radius: var(--sc-radius-sm);
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.language-tab.active {
  background: var(--sc-accent-tag-bg);
  border-color: var(--sc-accent-tag-border);
  color: var(--sc-accent-tag-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.timer-display {
  color: var(--sc-text-muted);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
</style>
