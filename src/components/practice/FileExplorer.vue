<script setup lang="ts">
import { ref } from 'vue'
import type { PracticeFile } from '@/stores/useLldPracticeStore'
import NewFileDialog from './NewFileDialog.vue'

const props = defineProps<{
  files: PracticeFile[]
  activeFileId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  add: [name: string]
  rename: [id: string, name: string]
  delete: [id: string]
  'set-entry': [id: string]
}>()

const showNewFileDialog = ref(false)
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startRename(file: PracticeFile) {
  renamingId.value = file.id
  renameValue.value = file.name
}

function commitRename() {
  if (renamingId.value && renameValue.value.trim()) {
    emit('rename', renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function confirmDelete(file: PracticeFile) {
  if (window.confirm(`Delete ${file.name}?`)) {
    emit('delete', file.id)
  }
}

function createFile(name: string) {
  emit('add', name)
  showNewFileDialog.value = false
}
</script>

<template>
  <div class="file-explorer sc-card">
    <div class="explorer-header">
      <span>Explorer</span>
      <button class="sc-btn-secondary new-file-btn" @click="showNewFileDialog = true">+ New</button>
    </div>
    <ul class="file-list">
      <li
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :class="{ active: file.id === activeFileId }"
        @click="emit('select', file.id)"
      >
        <template v-if="renamingId === file.id">
          <input
            v-model="renameValue"
            class="rename-input"
            autofocus
            @keyup.enter="commitRename"
            @keyup.esc="renamingId = null"
            @blur="commitRename"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="file-name">
            <i class="pi pi-file"></i>
            {{ file.name }}
            <span v-if="file.isEntry" class="entry-badge" title="Entry point">▶</span>
          </span>
          <span class="file-actions">
            <i class="pi pi-star" title="Set as entry point" @click.stop="emit('set-entry', file.id)"></i>
            <i class="pi pi-pencil" title="Rename" @click.stop="startRename(file)"></i>
            <i class="pi pi-trash" title="Delete" @click.stop="confirmDelete(file)"></i>
          </span>
        </template>
      </li>
    </ul>

    <NewFileDialog v-if="showNewFileDialog" @create="createFile" @cancel="showNewFileDialog = false" />
  </div>
</template>

<style scoped>
.file-explorer {
  display: flex;
  flex-direction: column;
  width: 220px;
  min-width: 200px;
  overflow: hidden;
}

.explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  color: var(--sc-text-muted);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid var(--sc-border);
}

.new-file-btn {
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
}

.file-list {
  list-style: none;
  margin: 0;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--sc-radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--sc-text-muted);
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.file-item.active {
  background: var(--sc-accent-tag-bg);
  color: var(--sc-accent-tag-text);
}

.file-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-badge {
  color: var(--sc-status-healthy);
  font-size: 0.7rem;
}

.file-actions {
  display: none;
  gap: 0.4rem;
}

.file-item:hover .file-actions {
  display: flex;
}

.file-actions i {
  font-size: 0.75rem;
}

.file-actions i:hover {
  color: var(--sc-text);
}

.rename-input {
  width: 100%;
  background: var(--sc-surface-solid);
  border: 1px solid var(--sc-accent);
  border-radius: var(--sc-radius-sm);
  padding: 0.2rem 0.4rem;
  color: var(--sc-text);
  font-size: 0.85rem;
}
</style>
