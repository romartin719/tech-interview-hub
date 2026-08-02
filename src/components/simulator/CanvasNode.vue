<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { getNodeType } from '@/data/simulatorCatalog'
import { useSimulatorStore, type SimNodeData } from '@/stores/useSimulatorStore'

const props = defineProps<NodeProps<SimNodeData>>()

const store = useSimulatorStore()

const catalogEntry = computed(() => getNodeType(props.type))

const rpsLabel = computed(() => {
  if (props.data.currentRps === null) return null
  if (props.data.currentRps >= 1000) return `${(props.data.currentRps / 1000).toFixed(0)}K RPS`
  return `${props.data.currentRps} RPS`
})

function decrement() {
  store.setInstanceCount(props.id, props.data.instanceCount - 1)
}

function increment() {
  store.setInstanceCount(props.id, props.data.instanceCount + 1)
}

function remove() {
  store.removeNode(props.id)
}
</script>

<template>
  <div class="sim-node" :class="`health-${data.health}`">
    <Handle type="target" :position="Position.Left" class="sim-handle" />

    <button v-if="type !== 'client'" class="node-delete" title="Delete node" @click.stop="remove">×</button>

    <div class="node-icon-chip" :style="{ background: catalogEntry?.color }">
      <i :class="catalogEntry?.icon"></i>
    </div>
    <div class="node-label">{{ catalogEntry?.label ?? type }}</div>

    <div v-if="type !== 'client'" class="node-stepper" @mousedown.stop @click.stop>
      <button class="stepper-btn" :disabled="data.instanceCount <= 1" @click="decrement">−</button>
      <span class="stepper-count">×{{ data.instanceCount }}</span>
      <button class="stepper-btn" @click="increment">+</button>
    </div>

    <div v-if="rpsLabel" class="node-rps">{{ rpsLabel }}</div>

    <Handle type="source" :position="Position.Right" class="sim-handle" />
  </div>
</template>

<style scoped>
.sim-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  min-width: 130px;
  background: var(--sc-surface-solid);
  border: 1.5px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.sim-node.health-healthy {
  border-color: var(--sc-border);
}

.sim-node.health-warning {
  border-color: var(--sc-status-warning);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.25);
}

.sim-node.health-bottleneck {
  border-color: var(--sc-status-bottleneck);
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.3);
}

.node-delete {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sc-surface-solid);
  border: 1px solid var(--sc-border);
  color: var(--sc-text-muted);
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-delete:hover {
  color: var(--sc-status-bottleneck);
  border-color: var(--sc-status-bottleneck);
}

.node-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--sc-radius-sm);
  color: #ffffff;
  font-size: 0.9rem;
}

.node-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--sc-text);
  text-align: center;
}

.node-stepper {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stepper-btn {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--sc-border);
  color: var(--sc-text);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.stepper-count {
  font-size: 0.78rem;
  color: var(--sc-text-muted);
  min-width: 1.6rem;
  text-align: center;
}

.node-rps {
  font-size: 0.72rem;
  color: var(--sc-accent-2);
  font-weight: 600;
}

.sim-handle {
  width: 10px;
  height: 10px;
  background: var(--sc-accent);
  border: 2px solid var(--sc-surface-solid);
}
</style>
