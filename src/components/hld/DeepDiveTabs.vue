<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ bad: string; good: string; great: string }>()

const active = ref<'bad' | 'good' | 'great'>('bad')
</script>

<template>
  <div class="dd-tabs">
    <div class="dd-tab-row">
      <button
        class="dd-tab"
        :class="{ active: active === 'bad', bad: active === 'bad' }"
        @click="active = 'bad'"
      >
        Bad
      </button>
      <button
        class="dd-tab"
        :class="{ active: active === 'good', good: active === 'good' }"
        @click="active = 'good'"
      >
        Good
      </button>
      <button
        class="dd-tab"
        :class="{ active: active === 'great', great: active === 'great' }"
        @click="active = 'great'"
      >
        Great
      </button>
    </div>
    <p class="dd-body">{{ active === 'bad' ? bad : active === 'good' ? good : great }}</p>
  </div>
</template>

<style scoped>
.dd-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dd-tab-row {
  display: flex;
  gap: 0.5rem;
}

.dd-tab {
  font-family: var(--sc-font);
  font-weight: 600;
  font-size: 0.82rem;
  padding: 0.4rem 1rem;
  border-radius: var(--sc-radius-sm);
  border: 1px solid var(--sc-border);
  background: transparent;
  color: var(--sc-text-muted);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}

.dd-tab:hover {
  border-color: var(--sc-accent-tag-border);
  color: var(--sc-text);
}

.dd-tab.active.bad {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
  color: #fca5a5;
}

.dd-tab.active.good {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
  color: #fcd34d;
}

.dd-tab.active.great {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
  color: #6ee7b7;
}

.dd-body {
  color: var(--sc-text-muted);
  line-height: 1.7;
  font-size: 0.95rem;
}
</style>
