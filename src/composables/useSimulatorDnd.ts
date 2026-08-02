import { ref } from 'vue'
import { useSimulatorStore } from '@/stores/useSimulatorStore'

const DND_MIME = 'application/x-simulator-node'

export type ScreenToFlowCoordinate = (position: { x: number; y: number }) => { x: number; y: number }

/**
 * Wraps vue-flow's own drag-and-drop-from-an-external-palette pattern: native HTML5 DnD
 * events carry the catalog node type id, and the drop position is converted from screen
 * to flow coordinates so it lands under the cursor regardless of pan/zoom.
 *
 * `screenToFlowCoordinate` is passed in (rather than obtained via useVueFlow()) because the
 * palette lives in a sibling component to <VueFlow>, and useVueFlow()'s injection only works
 * for descendants of the <VueFlow> instance — the caller gets it from a template ref instead.
 */
export function useSimulatorDnd(screenToFlowCoordinate: ScreenToFlowCoordinate) {
  const store = useSimulatorStore()
  const isDragOver = ref(false)

  function onDragStart(event: DragEvent, nodeTypeId: string) {
    if (!event.dataTransfer) return
    event.dataTransfer.setData(DND_MIME, nodeTypeId)
    event.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    isDragOver.value = true
  }

  function onDragLeave() {
    isDragOver.value = false
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    isDragOver.value = false
    const nodeTypeId = event.dataTransfer?.getData(DND_MIME)
    if (!nodeTypeId) return
    const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
    store.addNode(nodeTypeId, position)
  }

  return { isDragOver, onDragStart, onDragOver, onDragLeave, onDrop }
}
