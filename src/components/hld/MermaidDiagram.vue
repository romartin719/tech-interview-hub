<script lang="ts">
let mermaidInstanceCounter = 0
</script>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{ title?: string; definition: string }>()

const containerId = `mermaid-diagram-${++mermaidInstanceCounter}`

const svg = ref('')
const error = ref('')
const bodyEl = ref<HTMLElement | null>(null)
let bindFunctions: ((el: Element) => void) | undefined

// Category classes mirror the node colors already used in the simulator catalog
// (src/data/simulatorCatalog.ts) so static diagrams and the interactive canvas
// read as the same visual system. Async gets a dashed stroke to distinguish it
// from edge nodes, which otherwise share the same indigo.
const CATEGORY_CLASS_DEFS = `
classDef client fill:#22c55e26,stroke:#22c55e,color:#e8edf3,stroke-width:1.5px;
classDef edge fill:#6366f126,stroke:#6366f1,color:#e8edf3,stroke-width:1.5px;
classDef compute fill:#f59e0b26,stroke:#f59e0b,color:#e8edf3,stroke-width:1.5px;
classDef database fill:#10b98126,stroke:#10b981,color:#e8edf3,stroke-width:1.5px;
classDef cache fill:#05966926,stroke:#059669,color:#e8edf3,stroke-width:1.5px;
classDef async fill:#6366f126,stroke:#6366f1,color:#e8edf3,stroke-width:1.5px,stroke-dasharray:4 2;
classDef storage fill:#64748b26,stroke:#64748b,color:#e8edf3,stroke-width:1.5px;
`.trim()

let initialized = false
function ensureInitialized() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: '#191923',
      primaryColor: '#22222e',
      primaryTextColor: '#e8edf3',
      primaryBorderColor: 'rgba(255,255,255,0.16)',
      lineColor: '#9ba3b0',
      secondaryColor: '#22222e',
      tertiaryColor: '#22222e',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      fontSize: '14px',
      actorBkg: '#22222e',
      actorBorder: 'rgba(255,255,255,0.16)',
      actorTextColor: '#e8edf3',
      actorLineColor: 'rgba(255,255,255,0.16)',
      signalColor: '#9ba3b0',
      signalTextColor: '#e8edf3',
      labelBoxBkgColor: '#22222e',
      labelBoxBorderColor: 'rgba(255,255,255,0.16)',
      labelTextColor: '#e8edf3',
      loopTextColor: '#9ba3b0',
      noteBkgColor: '#2f2a45',
      noteTextColor: '#e8edf3',
      noteBorderColor: '#a78bfa',
      sequenceNumberColor: '#111118',
    },
  })
  initialized = true
}

async function render() {
  ensureInitialized()
  error.value = ''
  svg.value = ''
  try {
    const isFlowchart = /^\s*(flowchart|graph)\b/.test(props.definition)
    const definition = isFlowchart
      ? `${props.definition}\n${CATEGORY_CLASS_DEFS}`
      : props.definition
    const result = await mermaid.render(containerId, definition)
    svg.value = result.svg
    bindFunctions = result.bindFunctions
    await nextTick()
    if (bindFunctions && bodyEl.value) bindFunctions(bodyEl.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to render diagram'
  }
}

onMounted(render)
watch(() => props.definition, render)
</script>

<template>
  <div class="sc-diagram-card">
    <div v-if="title" class="diagram-title">{{ title }}</div>
    <div v-if="error" class="diagram-error">Diagram failed to render: {{ error }}</div>
    <div v-else ref="bodyEl" class="diagram-body" v-html="svg"></div>
  </div>
</template>

<style scoped>
.sc-diagram-card {
  background: var(--sc-surface-solid);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  padding: 1rem 1.25rem 1.25rem;
}

.diagram-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sc-accent-2);
  margin-bottom: 0.75rem;
}

.diagram-body {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.diagram-body :deep(svg) {
  max-width: none;
}

.diagram-error {
  color: var(--sc-status-bottleneck);
  font-size: 0.85rem;
  font-family: 'SFMono-Regular', Consolas, monospace;
  white-space: pre-wrap;
}
</style>
