<script setup lang="ts">
import { useSimulatorStore } from '@/stores/useSimulatorStore'

const store = useSimulatorStore()
</script>

<template>
  <div v-if="store.issues.length" class="sc-card issues-panel">
    <div class="issues-heading">{{ store.issues.length }} issue{{ store.issues.length > 1 ? 's' : '' }} found</div>
    <div v-for="issue in store.issues" :key="issue.id" class="issue-item" :class="`severity-${issue.severity}`">
      <div class="issue-title">{{ issue.title }}</div>
      <div class="issue-desc">{{ issue.description }}</div>
      <div class="issue-fix">Fix: {{ issue.fix }}</div>
    </div>
  </div>
</template>

<style scoped>
.issues-panel {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.issues-heading {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--sc-text);
}

.issue-item {
  padding: 0.6rem 0.75rem;
  border-left: 3px solid var(--sc-status-warning);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.issue-item.severity-critical {
  border-left-color: var(--sc-status-bottleneck);
}

.issue-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--sc-status-bottleneck);
  margin-bottom: 0.2rem;
}

.issue-item.severity-warning .issue-title {
  color: var(--sc-status-warning);
}

.issue-desc {
  font-size: 0.8rem;
  color: var(--sc-text);
  line-height: 1.5;
}

.issue-fix {
  font-size: 0.78rem;
  color: var(--sc-text-muted);
  font-style: italic;
  margin-top: 0.25rem;
}
</style>
