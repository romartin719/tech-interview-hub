<script setup lang="ts">
import { computed, ref } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-javascript'

const props = defineProps<{
  code: string
  filename?: string
  language?: string
}>()

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  java: 'java',
  py: 'python',
  cpp: 'cpp',
  hpp: 'cpp',
  h: 'c',
  c: 'c',
  js: 'javascript',
}

const language = computed(() => {
  if (props.language) return props.language
  const ext = props.filename?.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_BY_EXTENSION[ext] ?? ''
})

const highlighted = computed(() => {
  const grammar = language.value ? Prism.languages[language.value] : undefined
  if (!grammar) return escapeHtml(props.code)
  return Prism.highlight(props.code, grammar, language.value)
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard unavailable — no-op */
  }
}
</script>

<template>
  <div class="code-block">
    <button class="copy-btn" :class="{ copied }" @click="copyCode">
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
    <span v-if="language" class="code-lang-badge">{{ language }}</span>
    <pre><code v-html="highlighted"></code></pre>
  </div>
</template>

<style scoped>
.code-block {
  position: relative;
  background: var(--sc-bg-subtle, var(--sc-surface-2));
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-sm);
  overflow: hidden;
}

.code-block pre {
  margin: 0;
  padding: 0.85rem 1rem;
  overflow-x: auto;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.82rem;
  line-height: 1.65;
  color: var(--sc-text);
  white-space: pre;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 0.25rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--sc-text-muted);
  background: var(--sc-surface-2);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-xs);
  cursor: pointer;
  z-index: 1;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.copy-btn:hover {
  color: var(--sc-accent);
  border-color: var(--sc-accent-tag-border);
}

.copy-btn.copied {
  color: var(--sc-success);
  border-color: var(--sc-success);
}

.code-lang-badge {
  position: absolute;
  top: 10px;
  left: 12px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--sc-text-dim);
}

.code-block pre {
  padding-top: 1.9rem;
}

:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.cdata) {
  color: #8b90a0;
}

:deep(.token.keyword),
:deep(.token.class-name) {
  color: #c4b5fd;
}

:deep(.token.string),
:deep(.token.char) {
  color: #86efac;
}

:deep(.token.function) {
  color: #93c5fd;
}

:deep(.token.number),
:deep(.token.boolean) {
  color: #fcd34d;
}

:deep(.token.operator),
:deep(.token.punctuation) {
  color: #b0b4c0;
}

:deep(.token.annotation) {
  color: #a78bfa;
}
</style>
