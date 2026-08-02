<script setup lang="ts">
import { ref } from 'vue'
import { useSimulatorStore } from '@/stores/useSimulatorStore'

const emit = defineEmits<{ help: []; runTraffic: []; evaluate: [] }>()

const store = useSimulatorStore()
const fileInput = ref<HTMLInputElement | null>(null)

function onExport() {
  const json = store.exportJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.activeSlug ?? 'simulator'}-design.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImportClick() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text()
  store.importJson(text)
  input.value = ''
}
</script>

<template>
  <div class="sim-toolbar">
    <button class="sc-btn-secondary" @click="emit('help')">
      <i class="pi pi-question-circle"></i> Help
    </button>
    <button class="sc-btn-secondary" @click="store.loadExample()">Load example</button>
    <button class="sc-btn-secondary icon-btn" title="Undo" :disabled="!store.canUndo" @click="store.undo()">
      <i class="pi pi-undo"></i>
    </button>
    <button class="sc-btn-secondary icon-btn" title="Redo" :disabled="!store.canRedo" @click="store.redo()">
      <i class="pi pi-refresh"></i>
    </button>
    <button class="sc-btn-secondary" @click="onExport">Export</button>
    <button class="sc-btn-secondary" @click="onImportClick">Import</button>
    <input ref="fileInput" type="file" accept="application/json" class="hidden-file-input" @change="onFileChange" />
    <button class="sc-btn-secondary" @click="store.reset()">Reset</button>
    <div class="toolbar-spacer"></div>
    <button class="sc-btn-secondary run-traffic-btn" @click="emit('runTraffic')">
      <i class="pi pi-bolt"></i> Run Traffic
    </button>
    <button class="sc-btn-primary" @click="emit('evaluate')">Evaluate</button>
  </div>
</template>

<style scoped>
.sim-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.icon-btn {
  padding: 0.55rem 0.75rem;
}

.run-traffic-btn {
  border-color: var(--sc-accent-tag-border);
  color: var(--sc-accent-2);
}

.hidden-file-input {
  display: none;
}
</style>
