<script setup lang="ts">
import type { Topic } from '@/types/problems'
import { useProblemStore } from '@/stores/problemStore'
import Card from 'primevue/card'

const props = defineProps<{
  topic: Topic
}>()

const emit = defineEmits<{
  selectTopic: [topicId: string]
}>()

const store = useProblemStore()

function getStats() {
  return store.getTopicStats(props.topic)
}

function getPercent() {
  const stats = getStats()
  if (stats.total === 0) return 0
  return Math.round((stats.solved / stats.total) * 100)
}
</script>

<template>
  <Card class="dashboard-card" @click="emit('selectTopic', topic.id)">
    <template #content>
      <div class="card-body">
        <div class="card-top">
          <i :class="'pi ' + topic.icon" class="topic-icon"></i>
          <span v-if="topic.placeholder" class="coming-soon">Coming Soon</span>
        </div>
        <h3 class="topic-name">{{ topic.name }}</h3>
        <p class="topic-desc">{{ topic.description }}</p>

        <div v-if="!topic.placeholder" class="stats-section">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: getPercent() + '%' }"></div>
          </div>
          <div class="stats-row">
            <span class="stat solved">{{ getStats().solved }} solved</span>
            <span class="stat attempted">{{ getStats().attempted }} attempted</span>
            <span class="stat review">{{ getStats().needsReview }} review</span>
          </div>
          <div class="total-line">
            {{ getStats().solved }}/{{ getStats().total }} problems ({{ getPercent() }}%)
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.dashboard-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.dashboard-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topic-icon {
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

.coming-soon {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #92400e;
  background: #fef3c7;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.topic-name {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.topic-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin: 0;
  line-height: 1.4;
}

.stats-section {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--p-surface-200);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.stats-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.stat.solved {
  background: #dcfce7;
  color: #166534;
}

.stat.attempted {
  background: #fef3c7;
  color: #92400e;
}

.stat.review {
  background: #dbeafe;
  color: #1e40af;
}

.total-line {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
}
</style>
