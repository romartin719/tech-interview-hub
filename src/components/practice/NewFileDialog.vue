<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  create: [name: string]
  cancel: []
}>()

const filename = ref('')

function submit() {
  const name = filename.value.trim()
  if (name) emit('create', name)
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('cancel')">
    <div class="sc-card dialog-box">
      <h3>New File</h3>
      <input
        v-model="filename"
        class="filename-input"
        type="text"
        placeholder="e.g. Helper.java"
        autofocus
        @keyup.enter="submit"
        @keyup.esc="emit('cancel')"
      />
      <div class="dialog-actions">
        <button class="sc-btn-secondary" @click="emit('cancel')">Cancel</button>
        <button class="sc-btn-primary" :disabled="!filename.trim()" @click="submit">Create</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dialog-box {
  padding: 1.5rem;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-box h3 {
  color: var(--sc-text);
  font-size: 1.05rem;
  font-weight: 700;
}

.filename-input {
  background: var(--sc-surface-solid);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-sm);
  padding: 0.6rem 0.75rem;
  color: var(--sc-text);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.9rem;
}

.filename-input:focus {
  outline: none;
  border-color: var(--sc-accent);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
</style>
