<script setup lang="ts">
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/useSimulatorStore'

const store = useSimulatorStore()
const run = computed(() => store.lastRun)

function formatRps(rps: number): string {
  return rps >= 1000 ? `${(rps / 1000).toFixed(1)}K RPS` : `${Math.round(rps)} RPS`
}
</script>

<template>
  <div class="metrics-bar">
    <div class="sc-card metric-tile">
      <div class="metric-value">{{ run ? formatRps(run.throughputRps) : '—' }}</div>
      <div class="metric-label">THROUGHPUT</div>
    </div>
    <div class="sc-card metric-tile">
      <div class="metric-value">{{ run ? `${run.p99Ms} ms` : '—' }}</div>
      <div class="metric-label">P99 LATENCY</div>
    </div>
    <div class="sc-card metric-tile">
      <div class="metric-value">{{ run ? `${run.errorRatePct.toFixed(1)} %` : '—' }}</div>
      <div class="metric-label">ERROR RATE</div>
    </div>
    <div class="sc-card metric-tile">
      <div class="metric-value">{{ run && run.cacheHitPct !== null ? `${run.cacheHitPct.toFixed(0)} %` : '—' }}</div>
      <div class="metric-label">CACHE HIT</div>
    </div>
  </div>
</template>

<style scoped>
.metrics-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.metric-tile {
  padding: 0.9rem 1rem;
  text-align: center;
}

.metric-value {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--sc-text);
}

.metric-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--sc-text-muted);
  margin-top: 0.3rem;
}
</style>
