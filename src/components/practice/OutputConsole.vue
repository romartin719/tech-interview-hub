<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  output: string
  isRunning: boolean
}>()

const emit = defineEmits<{
  clear: []
}>()

const collapsed = ref(false)
</script>

<template>
  <div class="output-console sc-card">
    <div class="output-header" @click="collapsed = !collapsed">
      <span><i class="pi" :class="collapsed ? 'pi-chevron-right' : 'pi-chevron-down'"></i> Output</span>
      <button class="sc-btn-secondary clear-btn" @click.stop="emit('clear')">Clear</button>
    </div>
    <pre v-if="!collapsed" class="output-body">{{ isRunning ? 'Running…' : output }}</pre>
  </div>
</template>

<style scoped>
.output-console {
  display: flex;
  flex-direction: column;
  max-height: 220px;
  overflow: hidden;
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid var(--sc-border);
}

.clear-btn {
  padding: 0.3rem 0.7rem;
  font-size: 0.78rem;
}

.output-body {
  margin: 0;
  padding: 0.75rem 0.85rem;
  overflow-y: auto;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.85rem;
  color: var(--sc-text);
  white-space: pre-wrap;
}
</style>
