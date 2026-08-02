<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { VueFlowStore } from '@vue-flow/core'
import { hldTopics } from '@/data/hld'
import { NODE_CATALOG } from '@/data/simulatorCatalog'
import { useSimulatorStore } from '@/stores/useSimulatorStore'
import { useSimulatorDnd } from '@/composables/useSimulatorDnd'
import CanvasNode from '@/components/simulator/CanvasNode.vue'
import NodePalette from '@/components/simulator/NodePalette.vue'
import Toolbar from '@/components/simulator/Toolbar.vue'
import TargetLoadPanel from '@/components/simulator/TargetLoadPanel.vue'
import MetricsBar from '@/components/simulator/MetricsBar.vue'
import IssuesPanel from '@/components/simulator/IssuesPanel.vue'
import EvaluateModal from '@/components/simulator/EvaluateModal.vue'
import WelcomeTour from '@/components/simulator/WelcomeTour.vue'

const TOUR_SEEN_KEY = 'sim-tour-seen'

const route = useRoute()
const store = useSimulatorStore()

const topic = computed(() => hldTopics.find((t) => t.slug === route.params.slug))

const nodeTypes = Object.fromEntries(NODE_CATALOG.map((n) => [n.id, markRaw(CanvasNode)]))

const vueFlowRef = ref<InstanceType<typeof VueFlow> | null>(null)
const showEvaluateModal = ref(false)
const showWelcomeTour = ref(false)

const dnd = useSimulatorDnd((position) => {
  const instance = vueFlowRef.value as unknown as VueFlowStore | null
  return instance?.screenToFlowCoordinate(position) ?? position
})

function onConnect(connection: { source: string; target: string }) {
  store.connect(connection.source, connection.target)
}

function onHelp() {
  showWelcomeTour.value = true
}

function onRunTraffic() {
  store.runTraffic()
}

function onEvaluate() {
  showEvaluateModal.value = true
}

function fitView() {
  const instance = vueFlowRef.value as unknown as VueFlowStore | null
  instance?.fitView({ padding: 0.2 })
}

watch(
  () => store.layoutVersion,
  () => {
    // vue-flow measures new node dimensions via ResizeObserver after paint, so nextTick
    // alone (end of Vue's render cycle) can still fire before that measurement lands —
    // a short delay lets fitView compute correct bounds instead of fitting a zero-size box.
    nextTick(() => setTimeout(fitView, 50))
  },
)

onMounted(() => {
  if (topic.value) {
    store.loadTopic(topic.value.slug)
  }
  if (!localStorage.getItem(TOUR_SEEN_KEY)) {
    showWelcomeTour.value = true
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  }
})
</script>

<template>
  <div v-if="topic && topic.simulator" class="hld-simulator">
    <RouterLink :to="`/hld/${topic.slug}`" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to design
    </RouterLink>

    <header class="sim-header">
      <h1>{{ topic.title }}</h1>
      <p class="sim-goal">{{ topic.simulator.goalDescription }}</p>
      <div class="requirement-chips">
        <span v-for="c in topic.simulator.requirementChips" :key="c" class="sc-tag">{{ c }}</span>
      </div>
    </header>

    <Toolbar @help="onHelp" @run-traffic="onRunTraffic" @evaluate="onEvaluate" />

    <div class="sim-body">
      <aside class="sim-sidebar-left sc-card">
        <NodePalette @dragstart="dnd.onDragStart" />
      </aside>

      <div
        class="sim-canvas"
        :class="{ 'is-drag-over': dnd.isDragOver.value }"
        @dragover="dnd.onDragOver"
        @dragleave="dnd.onDragLeave"
        @drop="dnd.onDrop"
      >
        <VueFlow
          ref="vueFlowRef"
          :nodes="store.nodes"
          :edges="store.edges"
          :node-types="nodeTypes"
          :min-zoom="0.4"
          :max-zoom="2"
          fit-view-on-init
          @connect="onConnect"
        >
          <Background :gap="20" pattern-color="rgba(255,255,255,0.06)" />
        </VueFlow>
      </div>

      <aside class="sim-sidebar-right">
        <TargetLoadPanel />
        <IssuesPanel />
      </aside>
    </div>

    <MetricsBar />

    <EvaluateModal v-if="showEvaluateModal" @close="showEvaluateModal = false" />
    <WelcomeTour v-if="showWelcomeTour" @close="showWelcomeTour = false" />
  </div>

  <div v-else class="not-found">
    <p>This design doesn't have a simulator yet.</p>
    <RouterLink v-if="topic" :to="`/hld/${topic.slug}`" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to design
    </RouterLink>
    <RouterLink v-else to="/hld" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to High Level Design
    </RouterLink>
  </div>
</template>

<style scoped>
.hld-simulator {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: calc(100vh - 140px);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  width: fit-content;
}

.back-link:hover {
  color: var(--sc-text);
}

.sim-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--sc-border);
}

.sim-header h1 {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--sc-text);
}

.sim-goal {
  color: var(--sc-text-muted);
  font-size: 0.92rem;
}

.requirement-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sim-body {
  display: grid;
  grid-template-columns: 220px 1fr 260px;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.sim-sidebar-left {
  overflow-y: auto;
}

.sim-sidebar-right {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
}

.sim-canvas {
  position: relative;
  border-radius: var(--sc-radius-md);
  border: 1px solid var(--sc-border);
  background: var(--sc-bg);
  overflow: hidden;
}

.sim-canvas.is-drag-over {
  border-color: var(--sc-accent);
}

.sim-canvas :deep(.vue-flow) {
  background: transparent;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: var(--sc-text-muted);
}
</style>
