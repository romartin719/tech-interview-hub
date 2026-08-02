<script setup lang="ts">
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/useSimulatorStore'

const store = useSimulatorStore()
const config = computed(() => store.activeConfig)

function formatRps(rps: number): string {
  return rps >= 1000 ? `${Math.round(rps / 1000)}K RPS` : `${Math.round(rps)} RPS`
}
</script>

<template>
  <div class="target-load-panel">
    <div v-if="config" class="sc-card panel-card">
      <div class="panel-label">TARGET LOAD</div>
      <div class="panel-value">{{ formatRps(config.targetRps) }}</div>
      <div class="panel-sub">
        {{ Math.round(config.readRatio * 100) }}% reads · {{ Math.round(config.cacheHitRatio * 100) }}% cache hit
      </div>
    </div>

    <div class="sc-card panel-card">
      <div class="panel-label">LAST RUN</div>
      <div v-if="store.lastRun" class="last-run-row">
        <div class="last-run-stat">
          <div class="panel-value small">{{ store.lastRun.p50Ms }}ms</div>
          <div class="panel-sub">P50</div>
        </div>
        <div class="last-run-stat">
          <div class="panel-value small">{{ store.lastRun.p99Ms }}ms</div>
          <div class="panel-sub">P99</div>
        </div>
      </div>
      <div v-else class="panel-sub">Run traffic to see results</div>
    </div>
  </div>
</template>

<style scoped>
.target-load-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-card {
  padding: 1rem 1.1rem;
}

.panel-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--sc-text-muted);
  margin-bottom: 0.4rem;
}

.panel-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--sc-accent-2);
}

.panel-value.small {
  font-size: 1.15rem;
}

.panel-sub {
  color: var(--sc-text-muted);
  font-size: 0.78rem;
  margin-top: 0.25rem;
}

.last-run-row {
  display: flex;
  gap: 1.5rem;
}
</style>
