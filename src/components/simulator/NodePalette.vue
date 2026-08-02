<script setup lang="ts">
import { NODE_CATALOG, NODE_CATEGORIES } from '@/data/simulatorCatalog'

const emit = defineEmits<{ dragstart: [event: DragEvent, nodeTypeId: string] }>()

function nodesFor(categoryId: string) {
  return NODE_CATALOG.filter((n) => n.category === categoryId)
}

function onDragStart(event: DragEvent, nodeTypeId: string) {
  emit('dragstart', event, nodeTypeId)
}
</script>

<template>
  <div class="node-palette">
    <div v-for="category in NODE_CATEGORIES" :key="category.id" class="palette-category">
      <div class="category-label">{{ category.label }}</div>
      <div
        v-for="node in nodesFor(category.id)"
        :key="node.id"
        class="palette-item"
        draggable="true"
        @dragstart="(e) => onDragStart(e, node.id)"
      >
        <div class="palette-icon-chip" :style="{ background: node.color }">
          <i :class="node.icon"></i>
        </div>
        <span>{{ node.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-palette {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem;
  overflow-y: auto;
}

.palette-category {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.category-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--sc-text-muted);
  margin-bottom: 0.15rem;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--sc-radius-sm);
  border: 1px solid var(--sc-border);
  background: var(--sc-surface);
  color: var(--sc-text);
  font-size: 0.85rem;
  cursor: grab;
  user-select: none;
}

.palette-item:hover {
  border-color: var(--sc-accent-tag-border);
}

.palette-item:active {
  cursor: grabbing;
}

.palette-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  min-width: 1.5rem;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.75rem;
}
</style>
