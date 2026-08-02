<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { configureMonacoEnvironment } from '@/monacoSetup'

const props = defineProps<{
  modelValue: string
  language: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  configureMonacoEnvironment()
  if (!containerRef.value) return

  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
  })

  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() ?? ''
    if (value !== props.modelValue) {
      emit('update:modelValue', value)
    }
  })
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue)
    }
  },
)

watch(
  () => props.language,
  (newLanguage) => {
    const model = editor?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
    }
  },
)
</script>

<template>
  <div ref="containerRef" class="monaco-container"></div>
</template>

<style scoped>
.monaco-container {
  width: 100%;
  height: 100%;
  min-height: 300px;
}
</style>
