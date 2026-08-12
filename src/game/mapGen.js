// Slay-the-Spire-style branching map generator for one Act of the solo tower-climb mode.
// 10 regular layers of 3 nodes each, then a single boss node every node in the last
// regular layer connects into. Edges are sparse (not fully connected) so the player has
// to commit to a path rather than being able to reach every node.

export const REGULAR_LAYER_COUNT = 10
export const NODES_PER_LAYER = 3

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

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateActMap() {
  const nodes = {}
  const layers = []

  for (let l = 0; l < REGULAR_LAYER_COUNT; l++) {
    const ids = []
    for (let i = 0; i < NODES_PER_LAYER; i++) {
      const id = `L${l}N${i}`
      nodes[id] = { id, layer: l, type: pickNodeType(l), edges: [] }
      ids.push(id)
    }
    layers.push(ids)
  }

  const bossId = "BOSS"
  nodes[bossId] = { id: bossId, layer: REGULAR_LAYER_COUNT, type: "boss", edges: [] }
  layers.push([bossId])

  // Edges layer L -> L+1 (or -> boss for the last regular layer).
  for (let l = 0; l < REGULAR_LAYER_COUNT; l++) {
    const fromIds = layers[l]
    const toIds = layers[l + 1]
    const incoming = new Set()

    fromIds.forEach(fromId => {
      const targets = toIds.length === 1
        ? [toIds[0]]
        : shuffle(toIds).slice(0, Math.random() < 0.5 ? 1 : 2)
      targets.forEach(t => {
        nodes[fromId].edges.push(t)
        incoming.add(t)
      })
    })

    // Make sure nothing in the next layer is unreachable.
    toIds.forEach(toId => {
      if (!incoming.has(toId)) {
        const fromId = fromIds[Math.floor(Math.random() * fromIds.length)]
        nodes[fromId].edges.push(toId)
      }
    })
  }

  return { nodes, layers, startNodeIds: layers[0].slice() }
}

export function reachableNodeIds(map, currentNodeId) {
  if (!currentNodeId) return map.startNodeIds
  const node = map.nodes[currentNodeId]
  return node ? node.edges : []
}
