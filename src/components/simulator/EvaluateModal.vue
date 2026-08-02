<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useSimulatorStore, type EvaluateResult } from '@/stores/useSimulatorStore'
import { getNodeType } from '@/data/simulatorCatalog'

const emit = defineEmits<{ close: [] }>()

const store = useSimulatorStore()
const result = ref<EvaluateResult | null>(null)

onMounted(() => {
  result.value = store.evaluate()
})

const config = computed(() => store.activeConfig)
const topic = computed(() => store.activeTopic)

const referenceChips = computed(() => {
  if (!config.value) return []
  const seen = new Set<string>()
  const chips: string[] = []
  for (const n of config.value.referenceArchitecture.nodes) {
    if (seen.has(n.type)) continue
    seen.add(n.type)
    chips.push(getNodeType(n.type)?.label ?? n.type)
  }
  return chips
})

function close() {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="close">
    <div v-if="result" class="modal-panel sc-card">
      <button class="modal-close" @click="close">×</button>

      <div class="score-block">
        <div class="score-pct">{{ result.scorePct }}%</div>
        <div class="verdict">{{ result.verdict }}</div>
        <div class="criteria-summary">{{ result.passedCount }} / {{ result.totalCount }} criteria met</div>
      </div>

      <div v-if="store.lastRun && config" class="run-summary">
        Traffic {{ Math.round(config.targetRps / 1000) }}K RPS → P50 {{ store.lastRun.p50Ms }}ms · P99
        {{ store.lastRun.p99Ms }}ms · err {{ store.lastRun.errorRatePct.toFixed(1) }}%
      </div>

      <div class="modal-section">
        <h3>Interview Rubric</h3>
        <div
          v-for="r in result.rubricResults"
          :key="r.criterion.id"
          class="rubric-item"
          :class="{ passed: r.passed }"
        >
          <i :class="r.passed ? 'pi pi-check' : 'pi pi-times'"></i>
          <span>{{ r.criterion.label }}</span>
        </div>
      </div>

      <div v-if="store.issues.length" class="modal-section">
        <h3>Failure Modes</h3>
        <div v-for="issue in store.issues" :key="issue.id" class="failure-item">
          <div class="failure-title">{{ issue.title }}</div>
          <div class="failure-desc">{{ issue.description }}</div>
        </div>
      </div>

      <div v-if="config" class="modal-section">
        <h3>Reference Architecture</h3>
        <div class="reference-chips">
          <span v-for="c in referenceChips" :key="c" class="sc-tag">{{ c }}</span>
        </div>
        <p class="reference-explanation">{{ config.referenceArchitectureExplanation }}</p>
        <RouterLink v-if="topic" :to="`/hld/${topic.slug}`" class="reference-link">
          Read the full {{ topic.title }} design →
        </RouterLink>
      </div>

      <button class="sc-btn-primary keep-improving-btn" @click="close">Keep improving</button>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 2rem;
}

.modal-panel {
  position: relative;
  max-width: 520px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: var(--sc-text-muted);
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: var(--sc-text);
}

.score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.score-pct {
  font-size: 2.5rem;
  font-weight: 800;
  background: var(--sc-gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.verdict {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--sc-accent-2);
}

.criteria-summary {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
}

.run-summary {
  text-align: center;
  font-size: 0.8rem;
  color: var(--sc-text-muted);
  padding: 0.6rem;
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-sm);
}

.modal-section h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.6rem;
}

.rubric-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.06);
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.rubric-item i {
  color: var(--sc-status-bottleneck);
}

.rubric-item.passed {
  background: rgba(52, 211, 153, 0.06);
  color: var(--sc-text);
}

.rubric-item.passed i {
  color: var(--sc-status-healthy);
}

.failure-item {
  padding: 0.6rem 0.75rem;
  border-left: 3px solid var(--sc-status-bottleneck);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.failure-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--sc-status-bottleneck);
  margin-bottom: 0.2rem;
}

.failure-desc {
  font-size: 0.8rem;
  color: var(--sc-text);
  line-height: 1.5;
}

.reference-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.reference-explanation {
  font-size: 0.85rem;
  color: var(--sc-text-muted);
  line-height: 1.6;
  margin-bottom: 0.6rem;
}

.reference-link {
  font-size: 0.85rem;
  color: var(--sc-accent-2);
  text-decoration: none;
  font-weight: 600;
}

.reference-link:hover {
  text-decoration: underline;
}

.keep-improving-btn {
  width: 100%;
}
</style>
