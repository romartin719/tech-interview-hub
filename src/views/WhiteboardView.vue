<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { hldTopics } from '@/data/hld'
import { useExcalidrawEmbed } from '@/composables/useExcalidrawEmbed'

const route = useRoute()
const containerRef = ref<HTMLDivElement | null>(null)
const loadError = ref<string | null>(null)
const { mount, unmount } = useExcalidrawEmbed()

const slug = computed(() => {
  const d = route.query.d
  return typeof d === 'string' ? d : undefined
})
const linkedTopic = computed(() => (slug.value ? hldTopics.find((t) => t.slug === slug.value) : undefined))

onMounted(() => {
  if (containerRef.value) {
    mount(containerRef.value, slug.value).catch((err: unknown) => {
      loadError.value = err instanceof Error ? err.message : 'Failed to load the whiteboard.'
      console.error('Failed to mount Excalidraw', err)
    })
  }
})

onBeforeUnmount(() => {
  unmount()
})
</script>

<template>
  <div class="wb-page">
    <div class="wb-header">
      <h1><i class="pi pi-pencil"></i> Whiteboard<template v-if="linkedTopic"> — {{ linkedTopic.title }}</template></h1>
      <p v-if="linkedTopic">
        A scratchpad just for this design.
        <RouterLink :to="`/hld/${linkedTopic.slug}`" class="wb-back-link">Back to {{ linkedTopic.title }}</RouterLink>
      </p>
      <p v-else>Sketch a system design from memory - freeform shapes, arrows, and text. Saved automatically on this device.</p>
    </div>

    <p v-if="loadError" class="wb-error">
      <i class="pi pi-exclamation-triangle"></i> {{ loadError }} - check your network connection and reload.
    </p>
    <div ref="containerRef" class="wb-canvas-wrap"></div>
  </div>
</template>

<style scoped>
.wb-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wb-header h1 {
  font-size: 1.6rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--sc-text);
}

.wb-header p {
  color: var(--sc-text-muted);
  margin-top: 0.3rem;
}

.wb-back-link {
  color: var(--sc-accent-2);
  text-decoration: none;
  margin-left: 0.35rem;
}

.wb-back-link:hover {
  text-decoration: underline;
}

.wb-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sc-status-bottleneck, #f87171);
  font-size: 0.9rem;
}

.wb-canvas-wrap {
  position: relative;
  /* A definite height (not a flex-grow/min-height combo) so Excalidraw's own
     internally height:100% root div has something concrete to resolve against -
     under flex:1 alone this can end up visually zero-height in some layouts. */
  height: 75vh;
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  overflow: hidden;
}
</style>
