<script setup lang="ts">
import type { Phase, ProblemStatus } from '@/types/problems'
import { useProblemStore } from '@/stores/problemStore'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import ProblemItem from './ProblemItem.vue'

defineProps<{
  phases: Phase[]
}>()

const store = useProblemStore()

function getPhaseProgress(phase: Phase) {
  const stats = store.getPhaseStats(phase)
  return stats
}

function getProgressPercent(phase: Phase) {
  const stats = getPhaseProgress(phase)
  if (stats.total === 0) return 0
  return Math.round((stats.solved / stats.total) * 100)
}

function onUpdateStatus(problemId: string, status: ProblemStatus) {
  store.updateStatus(problemId, status)
}
</script>

<template>
  <Accordion multiple>
    <AccordionPanel v-for="phase in phases" :key="phase.name" :value="phase.name">
      <AccordionHeader>
        <div class="phase-header">
          <span class="phase-name">{{ phase.name }}</span>
          <div class="phase-stats">
            <span class="phase-count">{{ getPhaseProgress(phase).solved }}/{{ getPhaseProgress(phase).total }}</span>
            <div class="mini-progress">
              <div class="mini-progress-fill" :style="{ width: getProgressPercent(phase) + '%' }"></div>
            </div>
          </div>
        </div>
      </AccordionHeader>
      <AccordionContent>
        <p v-if="phase.description" class="phase-description">{{ phase.description }}</p>
        <div class="problems-list">
          <ProblemItem
            v-for="problem in phase.problems"
            :key="problem.id"
            :problem="problem"
            :status="store.getStatus(problem.id)"
            @updateStatus="onUpdateStatus"
          />
        </div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<style scoped>
.phase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
  padding-right: 0.5rem;
}

.phase-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.phase-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.phase-count {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.mini-progress {
  width: 60px;
  height: 6px;
  background: var(--p-surface-200);
  border-radius: 3px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #22c55e;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.phase-description {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.problems-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
