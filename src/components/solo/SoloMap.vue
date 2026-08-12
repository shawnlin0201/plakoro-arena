<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import dagre from 'dagre'

const solo = inject('solo')
const { t } = useI18n()
const state = solo.state

const TYPE_ICON = { monster: '⚔️', event: '❓', campfire: '🔥', boss: '👑' }

const NODE_SIZE = 96
const NODE_SEP = 42
const RANK_SEP = 78
const MARGIN = 20

// Real layered-graph layout (same family of algorithm d3-dag's sugiyama layout and
// graphviz's `dot` use): dagre assigns each node a non-overlapping x/y and routes each
// edge as a point path that reserves lanes between nodes, so lines never cross through
// another node's icon even though layer widths vary node-to-node. Node count per layer is
// random (2-5), so the map can end up taller or wider than the screen — rather than shrink
// things to force a fit, the viewport just scrolls in both directions.
const layout = computed(() => {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP, marginx: MARGIN, marginy: MARGIN })
  g.setDefaultEdgeLabel(() => ({}))
  const allNodes = Object.values(state.map.nodes)
  allNodes.forEach(n => g.setNode(n.id, { width: NODE_SIZE, height: NODE_SIZE }))
  allNodes.forEach(n => n.edges.forEach(targetId => g.setEdge(n.id, targetId)))
  dagre.layout(g)
  return g
})

const layoutW = computed(() => layout.value.graph().width)
const layoutH = computed(() => layout.value.graph().height)

function topLeftOf(nodeId) {
  const gn = layout.value.node(nodeId)
  return { left: (gn.x - NODE_SIZE / 2) + 'px', top: (gn.y - NODE_SIZE / 2) + 'px' }
}

const edgePaths = computed(() => {
  const g = layout.value
  return g.edges().map(e => {
    const points = g.edge(e).points
    const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ')
    return { key: e.v + '->' + e.w, d, active: e.v === state.currentNodeId }
  })
})

function nodeStatus(node) {
  if (node.id === state.currentNodeId) return 'current'
  if (state.reachableNodeIds.includes(node.id)) return 'reachable'
  return 'locked'
}

function pick(node) {
  if (nodeStatus(node) !== 'reachable') return
  solo.enterNode(node.id)
}
</script>

<template>
  <div class="board" style="display:flex; flex-direction:column; min-height:0;">
    <div style="flex-shrink:0;">
      <div class="modal-title" style="margin:8px 0 4px;">{{ t('solo.map.title', { act: state.act }) }}</div>
      <div class="center-hint" style="padding-bottom:6px;">{{ t('solo.map.hint') }}</div>
    </div>
    <div style="flex:1; min-height:0; overflow:auto;">
      <div style="position:relative;" :style="{ width: layoutW + 'px', height: layoutH + 'px' }">
        <svg :width="layoutW" :height="layoutH" style="position:absolute; left:0; top:0; pointer-events:none;">
          <path
            v-for="line in edgePaths"
            :key="line.key"
            :d="line.d"
            fill="none"
            :stroke="line.active ? '#8FCDA9' : '#DEDACD'"
            :stroke-width="line.active ? 6 : 4"
          />
        </svg>
        <div
          v-for="node in Object.values(state.map.nodes)"
          :key="node.id"
          class="select-card"
          :style="{
            position: 'absolute',
            ...topLeftOf(node.id),
            width: NODE_SIZE + 'px',
            height: NODE_SIZE + 'px',
            padding: '2px',
            gap: '2px',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--card)',
            cursor: nodeStatus(node) === 'reachable' ? 'pointer' : 'default',
            opacity: nodeStatus(node) === 'locked' ? 0.35 : 1,
            border: nodeStatus(node) === 'current' ? '3px solid #AEFF3E' : (nodeStatus(node) === 'reachable' ? '3px solid #8FCDA9' : '3px solid transparent')
          }"
          @click="pick(node)"
        >
          <div style="font-size:35px; line-height:1;">{{ TYPE_ICON[node.type] }}</div>
          <div style="font-size:13px; line-height:1.1; font-weight:800; text-align:center; white-space:nowrap;">{{ t('solo.node.' + node.type) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
