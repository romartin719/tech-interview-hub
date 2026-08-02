// Embeds the real Excalidraw library the same way systemcraft.in/draw does: React,
// ReactDOM, and the Excalidraw UMD bundle loaded straight from a CDN and mounted via
// the vanilla React.createElement/ReactDOM.render APIs, with no npm/bundler React
// dependency in this Vue project. This is Excalidraw's own documented "no bundler"
// integration path - see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration.

declare global {
  interface Window {
    React?: {
      createElement: (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown
    }
    ReactDOM?: {
      render: (element: unknown, container: Element) => void
      unmountComponentAtNode: (container: Element) => void
    }
    ExcalidrawLib?: {
      Excalidraw: unknown
    }
    EXCALIDRAW_ASSET_PATH?: string
  }
}

const REACT_URL = 'https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js'
const REACT_DOM_URL = 'https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js'
const EXCALIDRAW_VERSION = '0.17.6'
const EXCALIDRAW_DIST_PATH = `https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@${EXCALIDRAW_VERSION}/dist/`
const EXCALIDRAW_URL = `${EXCALIDRAW_DIST_PATH}excalidraw.production.min.js`

const STORAGE_PREFIX = 'tih-excalidraw-v1'
const SAVE_DEBOUNCE_MS = 300

function storageKey(slug?: string): string {
  return slug ? `${STORAGE_PREFIX}:${slug}` : STORAGE_PREFIX
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true'
        resolve()
      },
      { once: true },
    )
    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

let loadPromise: Promise<void> | null = null

function ensureExcalidrawLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([loadScript(REACT_URL), loadScript(REACT_DOM_URL)])
      .then(() => {
        // Must be set before the Excalidraw script executes so its internal
        // font/locale fetches resolve against the same CDN version.
        window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_DIST_PATH
        return loadScript(EXCALIDRAW_URL)
      })
      .catch((err) => {
        loadPromise = null
        throw err
      })
  }
  return loadPromise
}

function loadInitialData(slug?: string): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

export function useExcalidrawEmbed() {
  let mountedContainer: Element | null = null
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function persist(key: string, elements: unknown, appState: Record<string, unknown>) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            elements,
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
          }),
        )
      } catch {
        /* storage unavailable/full - drawing still works, just won't survive reload */
      }
    }, SAVE_DEBOUNCE_MS)
  }

  // Passing a slug scopes the sketch to its own save slot (e.g. deep-linked from a
  // specific HLD problem's "Draw" chip) instead of sharing the one generic whiteboard.
  async function mount(container: Element, slug?: string) {
    await ensureExcalidrawLoaded()
    const { React, ReactDOM, ExcalidrawLib } = window
    if (!React || !ReactDOM || !ExcalidrawLib) return

    const key = storageKey(slug)
    mountedContainer = container
    ReactDOM.render(
      React.createElement(ExcalidrawLib.Excalidraw, {
        theme: 'dark',
        initialData: loadInitialData(slug),
        onChange: (elements: unknown, appState: Record<string, unknown>) => persist(key, elements, appState),
      }),
      container,
    )
  }

  function unmount() {
    clearTimeout(saveTimer)
    if (mountedContainer) {
      window.ReactDOM?.unmountComponentAtNode(mountedContainer)
      mountedContainer = null
    }
  }

  return { mount, unmount }
}
