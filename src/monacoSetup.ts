import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

let configured = false

export function configureMonacoEnvironment() {
  if (configured) return
  configured = true

  self.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'typescript' || label === 'javascript') {
        return new TsWorker()
      }
      return new EditorWorker()
    },
  }
}
