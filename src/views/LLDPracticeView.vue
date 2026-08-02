<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { lldProblems } from '@/data/lld'
import { useLldPracticeStore } from '@/stores/useLldPracticeStore'
import type { PracticeLanguage } from '@/composables/useCodeExecution'
import PracticeHeader from '@/components/practice/PracticeHeader.vue'
import FileExplorer from '@/components/practice/FileExplorer.vue'
import MonacoEditor from '@/components/practice/MonacoEditor.vue'
import OutputConsole from '@/components/practice/OutputConsole.vue'

const route = useRoute()
const store = useLldPracticeStore()

const problem = computed(() => lldProblems.find((p) => p.slug === route.params.slug))

onMounted(() => {
  if (problem.value) {
    store.initFor(problem.value.slug, problem.value)
  }
})

onBeforeUnmount(() => {
  store.stopTimerInterval()
})

function handleContentChange(value: string) {
  if (store.activeFile) {
    store.updateContent(store.activeFile.id, value)
  }
}
</script>

<template>
  <div v-if="problem" class="practice-view">
    <RouterLink :to="`/lld/${problem.slug}`" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to {{ problem.title }}
    </RouterLink>

    <PracticeHeader
      :language="store.language"
      :languages="store.LANGUAGES as PracticeLanguage[]"
      :is-running="store.isRunning"
      :timer-seconds="store.timerSeconds"
      @change-language="(lang) => store.switchLanguage(lang)"
      @run="store.run"
      @save="store.save"
    />

    <div class="practice-body">
      <FileExplorer
        :files="store.activeFiles"
        :active-file-id="store.activeFileId"
        @select="store.selectFile"
        @add="store.addFile"
        @rename="store.renameFile"
        @delete="store.deleteFile"
        @set-entry="store.setEntry"
      />

      <div class="editor-column">
        <div class="editor-pane sc-card">
          <MonacoEditor
            v-if="store.activeFile"
            :key="store.activeFile.id"
            :model-value="store.activeFile.content"
            :language="store.language"
            @update:model-value="handleContentChange"
          />
          <div v-else class="empty-editor">No file selected.</div>
        </div>
        <OutputConsole :output="store.output" :is-running="store.isRunning" @clear="store.clearOutput" />
      </div>
    </div>
  </div>
  <div v-else class="not-found">
    <p>Problem not found.</p>
    <RouterLink to="/lld">Back to Low Level Design</RouterLink>
  </div>
</template>

<style scoped>
.practice-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: calc(100vh - 120px);
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

.practice-body {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.editor-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.editor-pane {
  flex: 1;
  overflow: hidden;
  min-height: 300px;
}

.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--sc-text-muted);
}

.not-found {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  padding: 4rem 0;
}
</style>
