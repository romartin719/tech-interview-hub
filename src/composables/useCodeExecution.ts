import { strToU8, zipSync } from 'fflate'

export type PracticeLanguage = 'java' | 'python' | 'cpp' | 'javascript'

export interface ExecutionFile {
  name: string
  content: string
}

export interface ExecutionResult {
  output: string
  success: boolean
}

// Judge0 CE language ids (github.com/judge0/judge0 /languages) - stable single-file runtimes,
// plus 89 = "Multi-file program" used whenever we need to submit more than one source file.
const JUDGE0_LANGUAGE_ID: Record<PracticeLanguage, number> = {
  java: 62, // OpenJDK 13.0.1
  python: 71, // Python 3.8.1
  cpp: 54, // GCC 9.2.0
  javascript: 63, // Node.js 12.14.0
}
const JUDGE0_MULTI_FILE_LANGUAGE_ID = 89

const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true'
const RAPIDAPI_HOST = 'judge0-ce.p.rapidapi.com'

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(base64: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function javaEntryClassName(entryFile: ExecutionFile): string {
  const match = entryFile.content.match(/public\s+(?:final\s+)?class\s+(\w+)/)
  return match?.[1] ?? entryFile.name.replace(/\.java$/, '')
}

function buildMultiFileZipBase64(language: PracticeLanguage, files: ExecutionFile[], entryFile: ExecutionFile): string {
  const zipEntries: Record<string, Uint8Array> = {}

  for (const file of files) {
    zipEntries[file.name] = strToU8(file.content)
  }

  if (language === 'java') {
    zipEntries['compile'] = strToU8('javac *.java\n')
    zipEntries['run'] = strToU8(`java ${javaEntryClassName(entryFile)}\n`)
  } else if (language === 'cpp') {
    zipEntries['compile'] = strToU8('g++ -O2 -o app *.cpp\n')
    zipEntries['run'] = strToU8('./app\n')
  } else if (language === 'python') {
    zipEntries['run'] = strToU8(`python3 ${entryFile.name}\n`)
  } else {
    zipEntries['run'] = strToU8(`node ${entryFile.name}\n`)
  }

  return bytesToBase64(zipSync(zipEntries))
}

export function useCodeExecution() {
  async function runCode(
    language: PracticeLanguage,
    files: ExecutionFile[],
    entryIndex: number,
  ): Promise<ExecutionResult> {
    const entryFile = files[entryIndex]
    if (!entryFile) {
      return { output: 'No entry file selected.', success: false }
    }

    const apiKey = import.meta.env.VITE_RAPIDAPI_KEY
    if (!apiKey) {
      return {
        output: 'Code execution is not configured. Set VITE_RAPIDAPI_KEY (a Judge0 CE key from RapidAPI) in .env.local to enable Run.',
        success: false,
      }
    }

    const useMultiFile = language === 'java' || files.length > 1
    const body = useMultiFile
      ? {
          language_id: JUDGE0_MULTI_FILE_LANGUAGE_ID,
          additional_files: buildMultiFileZipBase64(language, files, entryFile),
        }
      : {
          language_id: JUDGE0_LANGUAGE_ID[language],
          source_code: toBase64(entryFile.content),
        }

    try {
      const response = await fetch(JUDGE0_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        return { output: `Execution service error: ${response.status} ${response.statusText}`, success: false }
      }

      const data = await response.json()
      const decode = (b64: string | null) => (b64 ? fromBase64(b64) : '')

      const compileOutput = decode(data.compile_output)
      if (compileOutput) {
        return { output: compileOutput, success: false }
      }

      const stdout = decode(data.stdout)
      const stderr = decode(data.stderr)
      const message = decode(data.message)
      const combined = [stdout, stderr, message].filter(Boolean).join('\n')

      return {
        output: combined || `(no output) - ${data.status?.description ?? 'unknown status'}`,
        success: data.status?.id === 3,
      }
    } catch (err) {
      return {
        output: `Failed to reach execution service: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      }
    }
  }

  return { runCode }
}
