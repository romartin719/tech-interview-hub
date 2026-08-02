import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { hldTopics, type SimGraph, type RubricCriterion, type SimulatorConfig } from '@/data/hld'
import { NODE_CATALOG, getNodeType } from '@/data/simulatorCatalog'

export type HealthTier = 'healthy' | 'warning' | 'bottleneck'

export interface SimNodeData {
  instanceCount: number
  currentRps: number | null
  health: HealthTier
  utilization: number | null
}

export interface SimEdgeData {
  currentRps: number | null
}

// Structurally compatible with @vue-flow/core's Node<SimNodeData>/Edge<SimEdgeData> —
// kept as plain local interfaces because the library's generic union types blow up
// TS's instantiation depth once combined with our own data shape.
export interface SimNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: SimNodeData
}

export interface SimEdge {
  id: string
  source: string
  target: string
  data: SimEdgeData
}

export interface LastRun {
  throughputRps: number
  p50Ms: number
  p99Ms: number
  errorRatePct: number
  cacheHitPct: number | null
  timestamp: number
}

export interface Issue {
  id: string
  severity: 'critical' | 'warning'
  title: string
  nodeId?: string
  description: string
  fix: string
}

export interface RubricResult {
  criterion: RubricCriterion
  passed: boolean
  note?: string
}

export interface EvaluateResult {
  scorePct: number
  verdict: string
  passedCount: number
  totalCount: number
  rubricResults: RubricResult[]
  issues: Issue[]
}

interface HistorySnapshot {
  nodes: SimNode[]
  edges: SimEdge[]
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function cloneSnapshot(nodes: SimNode[], edges: SimEdge[]): HistorySnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } }) as SimNode),
    edges: edges.map((e) => ({ ...e, data: { ...e.data } }) as SimEdge),
  }
}

function seedGraph(): { nodes: SimNode[]; edges: SimEdge[] } {
  const client: SimNode = {
    id: 'client-1',
    type: 'client',
    position: { x: 50, y: 200 },
    data: { instanceCount: 1, currentRps: null, health: 'healthy', utilization: null },
  }
  return { nodes: [client], edges: [] }
}

function graphToSnapshot(graph: SimGraph): { nodes: SimNode[]; edges: SimEdge[] } {
  const nodes: SimNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { ...n.position },
    data: { instanceCount: n.instanceCount, currentRps: null, health: 'healthy', utilization: null },
  }))
  const edges: SimEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: { currentRps: null },
  }))
  return { nodes, edges }
}

interface HealthInfo {
  health: HealthTier
  utilization: number
}

interface PropagationResult {
  incomingByNode: Map<string, number>
  outgoingByEdge: Map<string, number>
  cacheHitByNode: Map<string, number>
  cycleDetected: boolean
}

// Distributes target RPS from client node(s) through the graph in topological order
// (Kahn's algorithm), so fan-in nodes always see contributions from every processed
// predecessor before their own outgoing split is computed. Nodes left over once the
// queue drains are part of a cycle and get 0 RPS (flagged separately as an issue).
function computeRpsPropagation(
  nodes: SimNode[],
  edges: SimEdge[],
  config: SimulatorConfig,
): PropagationResult {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const outgoingBySource = new Map<string, SimEdge[]>()
  const inDegree = new Map<string, number>()
  for (const n of nodes) inDegree.set(n.id, 0)
  for (const e of edges) {
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue
    outgoingBySource.set(e.source, [...(outgoingBySource.get(e.source) ?? []), e])
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const incomingByNode = new Map<string, number>()
  const outgoingByEdge = new Map<string, number>()
  const cacheHitByNode = new Map<string, number>()

  const clientNodes = nodes.filter((n) => getNodeType(n.type)?.category === 'client')
  const perClientRps = clientNodes.length > 0 ? config.targetRps / clientNodes.length : 0

  const queue: string[] = []
  const remainingInDegree = new Map(inDegree)
  for (const n of nodes) {
    if ((remainingInDegree.get(n.id) ?? 0) === 0) queue.push(n.id)
  }

  const visited = new Set<string>()
  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (nodeId === undefined || visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = nodeById.get(nodeId)
    if (!node) continue
    const catalogEntry = getNodeType(node.type)
    const isClient = catalogEntry?.category === 'client'
    const incoming = isClient ? perClientRps : (incomingByNode.get(nodeId) ?? 0)
    incomingByNode.set(nodeId, incoming)

    const outEdges = outgoingBySource.get(nodeId) ?? []

    function distribute(edgesToUse: SimEdge[], rps: number) {
      if (edgesToUse.length === 0) return
      const share = rps / edgesToUse.length
      for (const e of edgesToUse) {
        outgoingByEdge.set(e.id, (outgoingByEdge.get(e.id) ?? 0) + share)
        incomingByNode.set(e.target, (incomingByNode.get(e.target) ?? 0) + share)
      }
    }

    if (catalogEntry?.isCacheNode) {
      const hitRps = incoming * config.cacheHitRatio
      const missRps = incoming - hitRps
      cacheHitByNode.set(nodeId, hitRps)
      distribute(outEdges, missRps)
    } else if (catalogEntry?.category === 'compute') {
      const cacheEdges = outEdges.filter((e) => getNodeType(nodeById.get(e.target)?.type ?? '')?.isCacheNode)
      const otherEdges = outEdges.filter((e) => !getNodeType(nodeById.get(e.target)?.type ?? '')?.isCacheNode)
      if (cacheEdges.length > 0 && otherEdges.length > 0) {
        distribute(cacheEdges, incoming * config.readRatio)
        distribute(otherEdges, incoming * (1 - config.readRatio))
      } else {
        distribute(outEdges, incoming)
      }
    } else {
      distribute(outEdges, incoming)
    }

    for (const e of outEdges) {
      const remaining = (remainingInDegree.get(e.target) ?? 0) - 1
      remainingInDegree.set(e.target, remaining)
      if (remaining === 0) queue.push(e.target)
    }
  }

  return { incomingByNode, outgoingByEdge, cacheHitByNode, cycleDetected: visited.size < nodes.length }
}

function computeHealth(nodes: SimNode[], incomingByNode: Map<string, number>): Map<string, HealthInfo> {
  const result = new Map<string, HealthInfo>()
  for (const n of nodes) {
    const catalogEntry = getNodeType(n.type)
    const incoming = incomingByNode.get(n.id) ?? 0
    if (!catalogEntry || !Number.isFinite(catalogEntry.perInstanceCapacityRps)) {
      result.set(n.id, { health: 'healthy', utilization: 0 })
      continue
    }
    const capacity = catalogEntry.perInstanceCapacityRps * n.data.instanceCount
    const utilization = capacity > 0 ? incoming / capacity : Number.POSITIVE_INFINITY
    let health: HealthTier = 'healthy'
    if (utilization > 1.0) health = 'bottleneck'
    else if (utilization > 0.8) health = 'warning'
    result.set(n.id, { health, utilization })
  }
  return result
}

function computeReachableFromClient(nodes: SimNode[], edges: SimEdge[]): Set<string> {
  const clientIds = nodes.filter((n) => getNodeType(n.type)?.category === 'client').map((n) => n.id)
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target])
  }
  const visited = new Set<string>()
  const queue = [...clientIds]
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined || visited.has(id)) continue
    visited.add(id)
    for (const next of adjacency.get(id) ?? []) queue.push(next)
  }
  return visited
}

// Walks every simple path from a client node to a leaf (no unvisited outgoing edges),
// tracking cumulative p50/p99 latency, and reports the worst (highest-p99) path — the
// one a latency budget check should actually care about.
function computeCriticalPathLatency(
  nodes: SimNode[],
  edges: SimEdge[],
  healthByNode: Map<string, HealthInfo>,
): { p50Ms: number; p99Ms: number } {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const outgoingBySource = new Map<string, SimEdge[]>()
  for (const e of edges) {
    outgoingBySource.set(e.source, [...(outgoingBySource.get(e.source) ?? []), e])
  }
  const clientIds = nodes.filter((n) => getNodeType(n.type)?.category === 'client').map((n) => n.id)

  let maxP50 = 0
  let maxP99 = 0
  let pathCount = 0
  const MAX_PATHS = 2000
  const MAX_DEPTH = 60

  function dfs(nodeId: string, visitedInPath: Set<string>, p50Sum: number, p99Sum: number, depth: number) {
    if (pathCount >= MAX_PATHS || depth > MAX_DEPTH) return
    const node = nodeById.get(nodeId)
    if (!node) return
    const catalogEntry = getNodeType(node.type)
    const health = healthByNode.get(nodeId)?.health ?? 'healthy'
    const base = catalogEntry?.baseLatencyMs ?? 0
    const p99Mult = catalogEntry?.p99Multiplier ?? 1
    const newP50 = p50Sum + base
    const bottleneckPenalty = health === 'bottleneck' ? base * 5 : 0
    const newP99 = p99Sum + base * p99Mult + bottleneckPenalty

    const outEdges = (outgoingBySource.get(nodeId) ?? []).filter((e) => !visitedInPath.has(e.target))
    if (outEdges.length === 0) {
      pathCount += 1
      if (newP99 > maxP99 || (newP99 === maxP99 && newP50 > maxP50)) {
        maxP99 = newP99
        maxP50 = newP50
      }
      return
    }
    for (const e of outEdges) {
      visitedInPath.add(e.target)
      dfs(e.target, visitedInPath, newP50, newP99, depth + 1)
      visitedInPath.delete(e.target)
    }
  }

  for (const clientId of clientIds) {
    dfs(clientId, new Set([clientId]), 0, 0, 0)
  }

  return { p50Ms: Math.round(maxP50), p99Ms: Math.round(maxP99) }
}

function computeIssues(
  nodes: SimNode[],
  config: SimulatorConfig,
  healthByNode: Map<string, HealthInfo>,
  incomingByNode: Map<string, number>,
  reachable: Set<string>,
  cycleDetected: boolean,
): Issue[] {
  const result: Issue[] = []

  for (const n of nodes) {
    const catalogEntry = getNodeType(n.type)
    if (!catalogEntry || !catalogEntry.criticalIfSingle) continue
    if (n.data.instanceCount === 1 && reachable.has(n.id)) {
      const narrative = config.failureModeNarratives[catalogEntry.id]
      result.push({
        id: `spof-${n.id}`,
        severity: 'critical',
        nodeId: n.id,
        title: `Single Point of Failure · ${catalogEntry.label}`,
        description:
          narrative ??
          `Only one ${catalogEntry.label.toLowerCase()} instance on the critical path. If it dies, the whole system goes down.`,
        fix: 'Raise its instance count to 2+ (the −/+ control) or add a second instance for redundancy.',
      })
    }
  }

  for (const n of nodes) {
    const catalogEntry = getNodeType(n.type)
    const h = healthByNode.get(n.id)
    if (!catalogEntry || !h || h.health !== 'bottleneck') continue
    const incoming = incomingByNode.get(n.id) ?? 0
    const capacity = catalogEntry.perInstanceCapacityRps * n.data.instanceCount
    result.push({
      id: `bottleneck-${n.id}`,
      severity: h.utilization > 1.5 ? 'critical' : 'warning',
      nodeId: n.id,
      title: `Capacity Bottleneck · ${catalogEntry.label}`,
      description: `Incoming ${Math.round(incoming).toLocaleString()} RPS exceeds capacity of ${Math.round(capacity).toLocaleString()} RPS (${n.data.instanceCount} instance(s) × ${catalogEntry.perInstanceCapacityRps.toLocaleString()} RPS each).`,
      fix: 'Add more instances, or introduce a cache/queue in front of it.',
    })
  }

  if (cycleDetected) {
    result.push({
      id: 'cycle-detected',
      severity: 'warning',
      title: 'Cycle Detected',
      description: 'Part of your design has a circular connection, so traffic results may be inaccurate there.',
      fix: 'Remove the circular connection so traffic flows one way from Client to your data stores.',
    })
  }

  return result.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === 'critical' ? -1 : 1
  })
}

function evaluateRubricCriterion(
  criterion: RubricCriterion,
  nodes: SimNode[],
  edges: SimEdge[],
  config: SimulatorConfig,
  lastRunValue: LastRun | null,
  issuesValue: Issue[],
): RubricResult {
  switch (criterion.kind) {
    case 'requires-node-type': {
      const types = Array.isArray(criterion.nodeType) ? criterion.nodeType : [criterion.nodeType]
      return { criterion, passed: nodes.some((n) => types.includes(n.type)) }
    }
    case 'requires-connected-pair': {
      const passed = edges.some((e) => {
        const source = nodes.find((n) => n.id === e.source)
        const target = nodes.find((n) => n.id === e.target)
        return source?.type === criterion.fromType && target?.type === criterion.toType
      })
      return { criterion, passed }
    }
    case 'requires-cache-before': {
      const cacheNodeIds = nodes.filter((n) => n.type === criterion.cacheType).map((n) => n.id)
      const sinkNodeIds = new Set(nodes.filter((n) => n.type === criterion.sinkType).map((n) => n.id))
      if (cacheNodeIds.length === 0 || sinkNodeIds.size === 0) return { criterion, passed: false }
      const adjacency = new Map<string, string[]>()
      for (const e of edges) adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target])
      const passed = cacheNodeIds.some((startId) => {
        const visited = new Set<string>()
        const queue = [startId]
        while (queue.length > 0) {
          const id = queue.shift()
          if (id === undefined || visited.has(id)) continue
          visited.add(id)
          if (sinkNodeIds.has(id) && id !== startId) return true
          for (const next of adjacency.get(id) ?? []) queue.push(next)
        }
        return false
      })
      return { criterion, passed }
    }
    case 'no-bottleneck': {
      if (!lastRunValue) return { criterion, passed: false, note: 'Run traffic first' }
      return { criterion, passed: !issuesValue.some((i) => i.title.startsWith('Capacity Bottleneck')) }
    }
    case 'no-spof': {
      return { criterion, passed: !issuesValue.some((i) => i.title.startsWith('Single Point of Failure')) }
    }
    case 'meets-latency-budget': {
      if (!lastRunValue) return { criterion, passed: false, note: 'Run traffic first' }
      return { criterion, passed: lastRunValue.p99Ms <= config.latencyBudgetMsP99 }
    }
  }
}

export const useSimulatorStore = defineStore('simulator', () => {
  const activeSlug = ref<string | null>(null)
  const nodes = ref<SimNode[]>([])
  const edges = ref<SimEdge[]>([])
  const lastRun = ref<LastRun | null>(null)
  const issues = ref<Issue[]>([])

  const historyStack = ref<HistorySnapshot[]>([])
  const historyIndex = ref(-1)
  const HISTORY_LIMIT = 50

  // Bumped whenever the whole node/edge set is replaced wholesale (load example, reset,
  // import, undo/redo) — the view watches this to know when to re-fit the canvas viewport,
  // as opposed to incremental edits (add one node, tweak an instance count) where an
  // auto-refit would just be a jarring zoom jump.
  const layoutVersion = ref(0)

  const activeTopic = computed(() => hldTopics.find((t) => t.slug === activeSlug.value) ?? null)
  const activeConfig = computed(() => activeTopic.value?.simulator ?? null)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

  function pushHistory() {
    const snapshot = cloneSnapshot(nodes.value, edges.value)
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
    historyStack.value.push(snapshot)
    if (historyStack.value.length > HISTORY_LIMIT) {
      historyStack.value.shift()
    }
    historyIndex.value = historyStack.value.length - 1
  }

  function restoreSnapshot(snapshot: HistorySnapshot) {
    const cloned = cloneSnapshot(snapshot.nodes, snapshot.edges)
    nodes.value = cloned.nodes
    edges.value = cloned.edges
    lastRun.value = null
    issues.value = []
    layoutVersion.value += 1
  }

  function loadTopic(slug: string) {
    activeSlug.value = slug
    const seed = seedGraph()
    nodes.value = seed.nodes
    edges.value = seed.edges
    lastRun.value = null
    issues.value = []
    historyStack.value = []
    historyIndex.value = -1
    pushHistory()
    layoutVersion.value += 1
  }

  function addNode(type: string, position: { x: number; y: number }) {
    const catalogEntry = getNodeType(type)
    if (!catalogEntry) return
    const node: SimNode = {
      id: makeId(type),
      type,
      position,
      data: {
        instanceCount: catalogEntry.defaultInstanceCount,
        currentRps: null,
        health: 'healthy',
        utilization: null,
      },
    }
    nodes.value = [...nodes.value, node]
    pushHistory()
  }

  function removeNode(id: string) {
    nodes.value = nodes.value.filter((n) => n.id !== id)
    edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
    pushHistory()
  }

  function setInstanceCount(id: string, count: number) {
    const clamped = Math.max(1, Math.min(50, count))
    nodes.value = nodes.value.map((n) =>
      n.id === id ? ({ ...n, data: { ...n.data, instanceCount: clamped } } as SimNode) : n,
    )
    pushHistory()
  }

  function connect(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    const exists = edges.value.some((e) => e.source === sourceId && e.target === targetId)
    if (exists) return
    const edge: SimEdge = {
      id: makeId('edge'),
      source: sourceId,
      target: targetId,
      data: { currentRps: null },
    }
    edges.value = [...edges.value, edge]
    pushHistory()
  }

  function disconnect(edgeId: string) {
    edges.value = edges.value.filter((e) => e.id !== edgeId)
    pushHistory()
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value -= 1
    const snapshot = historyStack.value[historyIndex.value]
    if (snapshot) restoreSnapshot(snapshot)
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value += 1
    const snapshot = historyStack.value[historyIndex.value]
    if (snapshot) restoreSnapshot(snapshot)
  }

  function reset() {
    const seed = seedGraph()
    nodes.value = seed.nodes
    edges.value = seed.edges
    lastRun.value = null
    issues.value = []
    pushHistory()
    layoutVersion.value += 1
  }

  function loadExample() {
    const config = activeConfig.value
    if (!config) return
    const snapshot = graphToSnapshot(config.referenceArchitecture)
    nodes.value = snapshot.nodes
    edges.value = snapshot.edges
    lastRun.value = null
    issues.value = []
    pushHistory()
    layoutVersion.value += 1
  }

  function exportJson(): string {
    return JSON.stringify(
      {
        nodes: nodes.value.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          instanceCount: n.data.instanceCount,
        })),
        edges: edges.value.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      },
      null,
      2,
    )
  }

  function importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges)) return false
      const validTypes = new Set(NODE_CATALOG.map((n) => n.id))
      for (const n of parsed.nodes) {
        if (!n || typeof n.id !== 'string' || !validTypes.has(n.type)) return false
      }
      const newNodes: SimNode[] = parsed.nodes.map((n: { id: string; type: string; position?: { x: number; y: number }; instanceCount?: number }) => ({
        id: n.id,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data: {
          instanceCount: typeof n.instanceCount === 'number' ? n.instanceCount : 1,
          currentRps: null,
          health: 'healthy' as HealthTier,
          utilization: null,
        },
      }))
      const nodeIds = new Set(newNodes.map((n) => n.id))
      const newEdges: SimEdge[] = parsed.edges
        .filter((e: { id?: string; source?: string; target?: string }) => e && nodeIds.has(e.source ?? '') && nodeIds.has(e.target ?? ''))
        .map((e: { id?: string; source: string; target: string }) => ({
          id: e.id ?? makeId('edge'),
          source: e.source,
          target: e.target,
          data: { currentRps: null },
        }))
      nodes.value = newNodes
      edges.value = newEdges
      lastRun.value = null
      issues.value = []
      pushHistory()
      layoutVersion.value += 1
      return true
    } catch {
      return false
    }
  }

  function runTraffic() {
    const config = activeConfig.value
    if (!config) return

    const currentNodes = nodes.value
    const currentEdges = edges.value

    const hasClient = currentNodes.some((n) => getNodeType(n.type)?.category === 'client')
    if (!hasClient) {
      lastRun.value = null
      issues.value = [
        {
          id: 'no-client',
          severity: 'critical',
          title: 'No Client Node',
          description: 'Add a Client node as the traffic source before running traffic.',
          fix: 'Drag a Client node onto the canvas and connect it to the rest of your design.',
        },
      ]
      return
    }

    const propagation = computeRpsPropagation(currentNodes, currentEdges, config)
    const healthByNode = computeHealth(currentNodes, propagation.incomingByNode)
    const reachable = computeReachableFromClient(currentNodes, currentEdges)

    nodes.value = currentNodes.map((n) => {
      const incoming = propagation.incomingByNode.get(n.id) ?? 0
      const h = healthByNode.get(n.id)
      return {
        ...n,
        data: {
          ...n.data,
          currentRps: Math.round(incoming),
          health: h?.health ?? 'healthy',
          utilization: h?.utilization ?? null,
        },
      } as SimNode
    })
    edges.value = currentEdges.map((e) => ({
      ...e,
      data: { currentRps: Math.round(propagation.outgoingByEdge.get(e.id) ?? 0) },
    }))

    let errorWeightedSum = 0
    for (const n of currentNodes) {
      const catalogEntry = getNodeType(n.type)
      const h = healthByNode.get(n.id)
      const incoming = propagation.incomingByNode.get(n.id) ?? 0
      if (catalogEntry && h?.health === 'bottleneck') {
        errorWeightedSum += incoming * catalogEntry.errorRateAtCapacity
      }
    }
    const blendedErrorRate = config.targetRps > 0 ? errorWeightedSum / config.targetRps : 0
    const throughputRps = config.targetRps * (1 - blendedErrorRate)

    let totalCacheHit = 0
    let totalCacheIncoming = 0
    for (const n of currentNodes) {
      const catalogEntry = getNodeType(n.type)
      if (catalogEntry?.isCacheNode) {
        totalCacheHit += propagation.cacheHitByNode.get(n.id) ?? 0
        totalCacheIncoming += propagation.incomingByNode.get(n.id) ?? 0
      }
    }
    const cacheHitPct = totalCacheIncoming > 0 ? (totalCacheHit / totalCacheIncoming) * 100 : null

    const { p50Ms, p99Ms } = computeCriticalPathLatency(currentNodes, currentEdges, healthByNode)

    lastRun.value = {
      throughputRps,
      p50Ms,
      p99Ms,
      errorRatePct: blendedErrorRate * 100,
      cacheHitPct,
      timestamp: Date.now(),
    }

    const computedIssues = computeIssues(
      currentNodes,
      config,
      healthByNode,
      propagation.incomingByNode,
      reachable,
      propagation.cycleDetected,
    )
    if (p99Ms > config.latencyBudgetMsP99) {
      computedIssues.push({
        id: 'latency-budget-breach',
        severity: 'warning',
        title: 'Latency Budget Exceeded',
        description: `P99 latency is ${p99Ms}ms, above the ${config.latencyBudgetMsP99}ms budget for this design.`,
        fix: 'Add capacity or caching on the slowest path to bring P99 down.',
      })
    }
    issues.value = computedIssues
  }

  function evaluate(): EvaluateResult | null {
    const config = activeConfig.value
    if (!config) return null
    const rubricResults = config.rubric.map((c) =>
      evaluateRubricCriterion(c, nodes.value, edges.value, config, lastRun.value, issues.value),
    )
    const passedCount = rubricResults.filter((r) => r.passed).length
    const totalCount = rubricResults.length
    const scorePct = totalCount > 0 ? Math.round((100 * passedCount) / totalCount) : 0

    let verdict = 'No Hire'
    if (scorePct === 100) verdict = 'Strong Hire'
    else if (scorePct >= 80) verdict = 'Hire'
    else if (scorePct >= 60) verdict = 'Lean Hire'
    else if (scorePct >= 40) verdict = 'Lean No Hire'

    return { scorePct, verdict, passedCount, totalCount, rubricResults, issues: issues.value }
  }

  return {
    activeSlug,
    activeTopic,
    activeConfig,
    nodes,
    edges,
    lastRun,
    issues,
    canUndo,
    canRedo,
    layoutVersion,
    loadTopic,
    addNode,
    removeNode,
    setInstanceCount,
    connect,
    disconnect,
    undo,
    redo,
    reset,
    loadExample,
    exportJson,
    importJson,
    runTraffic,
    evaluate,
  }
})
