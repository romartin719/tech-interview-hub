import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { LLDProblem } from '@/data/lld'
import { useAuthStore } from '@/stores/authStore'
import { useCodeExecution, type PracticeLanguage } from '@/composables/useCodeExecution'

export interface PracticeFile {
  id: string
  name: string
  content: string
  isEntry: boolean
}

const LANGUAGES: PracticeLanguage[] = ['java', 'python', 'cpp', 'javascript']
const DEFAULT_TIMER_SECONDS = 90 * 60

const STUB_BY_LANGUAGE: Record<Exclude<PracticeLanguage, 'java'>, { name: string; content: string }> = {
  python: { name: 'main.py', content: '# Write your solution here\n\n\ndef main():\n    pass\n\n\nif __name__ == "__main__":\n    main()\n' },
  cpp: { name: 'main.cpp', content: '#include <iostream>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n' },
  javascript: { name: 'main.js', content: '// Write your solution here\n\nfunction main() {\n}\n\nmain()\n' },
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function storageKey(uid: string, slug: string, language: PracticeLanguage): string {
  return `lld-practice:${uid}:${slug}:${language}`
}

export const useLldPracticeStore = defineStore('lldPractice', () => {
  const { runCode } = useCodeExecution()

  const slug = ref('')
  const language = ref<PracticeLanguage>('java')
  const filesByLanguage = ref<Record<PracticeLanguage, PracticeFile[]>>({
    java: [],
    python: [],
    cpp: [],
    javascript: [],
  })
  const activeFileId = ref('')
  const output = ref('Run your code to see output here.')
  const isRunning = ref(false)
  const timerSeconds = ref(DEFAULT_TIMER_SECONDS)
  const timerRunning = ref(false)
  let timerHandle: ReturnType<typeof setInterval> | null = null

  const activeFiles = computed(() => filesByLanguage.value[language.value])
  const activeFile = computed(() => activeFiles.value.find((f) => f.id === activeFileId.value))

  function currentUid(): string {
    const authStore = useAuthStore()
    return authStore.user?.uid ?? 'guest'
  }

  function seedJavaFiles(problem: LLDProblem): PracticeFile[] {
    const files = problem.codeFiles.map((f) => ({
      id: generateId(),
      name: f.filename,
      content: f.code,
      isEntry: f.code.includes('public static void main'),
    }))
    const lastFile = files[files.length - 1]
    if (!files.some((f) => f.isEntry) && lastFile) {
      lastFile.isEntry = true
    }
    return files
  }

  function seedStubFile(lang: Exclude<PracticeLanguage, 'java'>): PracticeFile[] {
    const stub = STUB_BY_LANGUAGE[lang]
    return [{ id: generateId(), name: stub.name, content: stub.content, isEntry: true }]
  }

  function loadPersisted(lang: PracticeLanguage): PracticeFile[] | null {
    try {
      const raw = localStorage.getItem(storageKey(currentUid(), slug.value, lang))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      return null
    } catch {
      return null
    }
  }

  function initFor(problemSlug: string, problem: LLDProblem) {
    slug.value = problemSlug
    filesByLanguage.value = {
      java: loadPersisted('java') ?? seedJavaFiles(problem),
      python: loadPersisted('python') ?? seedStubFile('python'),
      cpp: loadPersisted('cpp') ?? seedStubFile('cpp'),
      javascript: loadPersisted('javascript') ?? seedStubFile('javascript'),
    }
    language.value = 'java'
    activeFileId.value = activeFiles.value[0]?.id ?? ''
    output.value = 'Run your code to see output here.'
    resetTimer()
    startTimer()
  }

  function switchLanguage(lang: PracticeLanguage) {
    language.value = lang
    activeFileId.value = activeFiles.value[0]?.id ?? ''
  }

  function selectFile(id: string) {
    activeFileId.value = id
  }

  function addFile(name: string) {
    const file: PracticeFile = { id: generateId(), name, content: '', isEntry: activeFiles.value.length === 0 }
    filesByLanguage.value[language.value] = [...activeFiles.value, file]
    activeFileId.value = file.id
  }

  function renameFile(id: string, newName: string) {
    const file = activeFiles.value.find((f) => f.id === id)
    if (file) file.name = newName
  }

  function deleteFile(id: string) {
    const remaining = activeFiles.value.filter((f) => f.id !== id)
    const deletedWasEntry = activeFiles.value.find((f) => f.id === id)?.isEntry
    const firstRemaining = remaining[0]
    if (deletedWasEntry && firstRemaining) {
      firstRemaining.isEntry = true
    }
    filesByLanguage.value[language.value] = remaining
    if (activeFileId.value === id) {
      activeFileId.value = remaining[0]?.id ?? ''
    }
  }

  function setEntry(id: string) {
    activeFiles.value.forEach((f) => {
      f.isEntry = f.id === id
    })
  }

  function updateContent(id: string, content: string) {
    const file = activeFiles.value.find((f) => f.id === id)
    if (file) file.content = content
  }

  async function run() {
    const files = activeFiles.value
    const entryIndex = files.findIndex((f) => f.isEntry)
    if (files.length === 0 || entryIndex === -1) {
      output.value = 'No entry file selected.'
      return
    }
    isRunning.value = true
    const result = await runCode(
      language.value,
      files.map((f) => ({ name: f.name, content: f.content })),
      entryIndex,
    )
    output.value = result.output
    isRunning.value = false
  }

  function save() {
    localStorage.setItem(
      storageKey(currentUid(), slug.value, language.value),
      JSON.stringify(activeFiles.value),
    )
  }

  function clearOutput() {
    output.value = 'Run your code to see output here.'
  }

  function startTimer() {
    if (timerHandle) return
    timerRunning.value = true
    timerHandle = setInterval(() => {
      if (timerSeconds.value > 0) {
        timerSeconds.value -= 1
      } else {
        pauseTimer()
      }
    }, 1000)
  }

  function pauseTimer() {
    timerRunning.value = false
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }

  function resetTimer() {
    pauseTimer()
    timerSeconds.value = DEFAULT_TIMER_SECONDS
  }

  function stopTimerInterval() {
    pauseTimer()
  }

  return {
    slug,
    language,
    filesByLanguage,
    activeFileId,
    activeFiles,
    activeFile,
    output,
    isRunning,
    timerSeconds,
    timerRunning,
    LANGUAGES,
    initFor,
    switchLanguage,
    selectFile,
    addFile,
    renameFile,
    deleteFile,
    setEntry,
    updateContent,
    run,
    save,
    clearOutput,
    startTimer,
    pauseTimer,
    resetTimer,
    stopTimerInterval,
  }
})
