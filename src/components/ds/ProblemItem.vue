<script setup lang="ts">
import type { Problem, ProblemStatus } from '@/types/problems'
import Select from 'primevue/select'

const props = defineProps<{
  problem: Problem
  status: ProblemStatus
}>()

const emit = defineEmits<{
  updateStatus: [problemId: string, status: ProblemStatus]
}>()

const statusOptions = [
  { label: 'Not Started', value: 'not_started' as ProblemStatus, severity: 'secondary' },
  { label: 'Attempted', value: 'attempted' as ProblemStatus, severity: 'warn' },
  { label: 'Solved', value: 'solved' as ProblemStatus, severity: 'success' },
  { label: 'Needs Review', value: 'needs_review' as ProblemStatus, severity: 'info' },
]

function onStatusChange(event: { value: ProblemStatus }) {
  emit('updateStatus', props.problem.id, event.value)
}
</script>

<template>
  <div class="problem-item" :class="status">
    <a v-if="problem.url" :href="problem.url" target="_blank" rel="noopener" class="problem-name problem-link">{{ problem.name }}</a>
    <span v-else class="problem-name">{{ problem.name }}</span>
    <Select
      :modelValue="status"
      :options="statusOptions"
      optionLabel="label"
      optionValue="value"
      @change="onStatusChange"
      class="status-select"
      size="small"
    />
  </div>
</template>

<style scoped>
.problem-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: background 0.15s;
  gap: 0.75rem;
}

.problem-item:hover {
  background: var(--p-surface-100);
}

.problem-item.solved {
  background: #f0fdf4;
}

.problem-item.needs_review {
  background: #eff6ff;
}

.problem-item.attempted {
  background: #fffbeb;
}

.problem-name {
  font-size: 0.9rem;
  flex: 1;
  min-width: 0;
}

.problem-link {
  color: var(--p-primary-color);
  text-decoration: none;
}

.problem-link:hover {
  text-decoration: underline;
}

.problem-item.solved .problem-name {
  text-decoration: line-through;
  color: var(--p-text-muted-color);
}

.status-select {
  width: 150px;
  flex-shrink: 0;
}
</style>
