// Slay-the-Spire-style branching map generator for one Act of the solo tower-climb mode.
// 10 regular layers ending in a single boss node every node in the last regular layer
// connects into. Each layer's width is picked independently between MIN_LAYER_SIZE and
// MAX_LAYER_SIZE nodes. Edges are sparse (not fully connected) so the player has to commit
// to a path rather than being able to reach every node. Exact node pixel positions and
// non-overlapping edge routing are left to a proper layered-graph layout engine (dagre) at
// render time — this module only decides the graph's topology.

export const REGULAR_LAYER_COUNT = 10
export const MIN_LAYER_SIZE = 2
export const MAX_LAYER_SIZE = 5

const TYPE_WEIGHTS = [
  ["monster", 0.6],
  ["event", 0.25],
  ["campfire", 0.15]
]

function pickWeighted(weights) {
  const r = Math.random()
  let acc = 0
  for (const [value, w] of weights) {
    acc += w
    if (r <= acc) return value
  }
  return weights[weights.length - 1][0]
}

function pickNodeType(layerIndex) {
  // No campfire on the very first layer — nothing to rest off of yet.
  if (layerIndex === 0) {
    const t = pickWeighted(TYPE_WEIGHTS)
    return t === "campfire" ? "monster" : t
  }
  return pickWeighted(TYPE_WEIGHTS)
}

function randomLayerSize() {
  return MIN_LAYER_SIZE + Math.floor(Math.random() * (MAX_LAYER_SIZE - MIN_LAYER_SIZE + 1))
}

// Connects a layer of m nodes to the next layer of n nodes: each node gets a "primary"
// target spread proportionally across the next layer, plus a 45% chance of a second target
// one column over, then a pass to guarantee every next-layer node has >=1 incoming edge.
function connectLayers(nodes, fromIds, toIds) {
  const m = fromIds.length
  const n = toIds.length
  const incoming = new Set()

  fromIds.forEach((fromId, i) => {
    const primary = Math.round(i * (n - 1) / Math.max(m - 1, 1))
    const targets = new Set([primary])
    if (Math.random() < 0.45) {
      const alt = primary + (Math.random() < 0.5 ? -1 : 1)
      if (alt >= 0 && alt < n) targets.add(alt)
    }
    targets.forEach(col => {
      nodes[fromId].edges.push(toIds[col])
      incoming.add(toIds[col])
    })
  })

  toIds.forEach(toId => {
    if (!incoming.has(toId)) {
      const fromId = fromIds[Math.floor(Math.random() * fromIds.length)]
      nodes[fromId].edges.push(toId)
    }
  })
}

export function generateActMap() {
  const nodes = {}
  const layers = []

  for (let l = 0; l < REGULAR_LAYER_COUNT; l++) {
    const size = randomLayerSize()
    const ids = []
    for (let i = 0; i < size; i++) {
      const id = `L${l}N${i}`
      nodes[id] = { id, layer: l, type: pickNodeType(l), edges: [] }
      ids.push(id)
    }
    layers.push(ids)
  }

  const bossId = "BOSS"
  nodes[bossId] = { id: bossId, layer: REGULAR_LAYER_COUNT, type: "boss", edges: [] }
  layers.push([bossId])

  for (let l = 0; l < REGULAR_LAYER_COUNT; l++) {
    const fromIds = layers[l]
    const toIds = layers[l + 1]
    if (toIds.length === 1) {
      fromIds.forEach(fromId => nodes[fromId].edges.push(toIds[0]))
    } else {
      connectLayers(nodes, fromIds, toIds)
    }
  }

  return { nodes, layers, startNodeIds: layers[0].slice() }
}

export function reachableNodeIds(map, currentNodeId) {
  if (!currentNodeId) return map.startNodeIds
  const node = map.nodes[currentNodeId]
  return node ? node.edges : []
}
