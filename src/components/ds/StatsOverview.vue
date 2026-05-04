<script setup lang="ts">
import { useProblemStore } from '@/stores/problemStore'

const store = useProblemStore()

function getOverall() {
  return store.getOverallStats()
}

function getPercent() {
  const stats = getOverall()
  if (stats.total === 0) return 0
  return Math.round((stats.solved / stats.total) * 100)
}
</script>

<template>
  <div class="stats-overview">
    <div class="stats-grid">
      <div class="stat-card total">
        <span class="stat-number">{{ getOverall().total }}</span>
        <span class="stat-label">Total Problems</span>
      </div>
      <div class="stat-card solved">
        <span class="stat-number">{{ getOverall().solved }}</span>
        <span class="stat-label">Solved</span>
      </div>
      <div class="stat-card attempted">
        <span class="stat-number">{{ getOverall().attempted }}</span>
        <span class="stat-label">Attempted</span>
      </div>
      <div class="stat-card review">
        <span class="stat-number">{{ getOverall().needsReview }}</span>
        <span class="stat-label">Needs Review</span>
      </div>
    </div>
    <div class="overall-progress">
      <div class="progress-header">
        <span>Overall Progress</span>
        <span class="progress-percent">{{ getPercent() }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: getPercent() + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-overview {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.stat-card {
  padding: 1rem 1.25rem;
  border-radius: 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-card.total {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.stat-card.solved {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.stat-card.attempted {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.stat-card.review {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.stat-number {
  font-size: 1.75rem;
  font-weight: 800;
}

.stat-card.total .stat-number { color: #334155; }
.stat-card.solved .stat-number { color: #166534; }
.stat-card.attempted .stat-number { color: #92400e; }
.stat-card.review .stat-number { color: #1e40af; }

.stat-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  font-weight: 500;
}

.overall-progress {
  background: white;
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.progress-percent {
  color: var(--p-primary-color);
  font-size: 1rem;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: var(--p-surface-200);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 6px;
  transition: width 0.5s ease;
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
