<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dagre from 'dagre'

const solo = inject('solo')
const { t } = useI18n()
const state = solo.state
const stageSize = inject('stageSize')

const TYPE_ICON = { monster: '⚔️', event: '❓', campfire: '🔥', boss: '👑' }

const BASE_NODE_SIZE = 96
const BASE_NODE_SEP = 42
const RANK_SEP = 78
const MARGIN = 20
// .board's own CSS (padding: 2px top / 6px bottom, plus a 4px flex gap before the node area).
const BOARD_CHROME = 2 + 6 + 4

// Node count per layer is random (2-5). Only the vertical extent has to fit on screen — the
// map can be as wide as it needs since the viewport scrolls horizontally — so node size and
// vertical spacing shrink (together, so nodes stay circular) only as much as needed for the
// tallest layer in THIS map to fit the available height, and never shrink below what height
// actually requires. Sized off the actual game canvas (stageSize, provided by App.vue from
// useStageLayout) rather than a DOM ancestor's resolved flex height, so other UI on screen
// can't throw the calculation off.
const headerEl = ref(null)
const viewportEl = ref(null)
const headerHeight = ref(0)
let headerObserver = null

onMounted(() => {
  headerObserver = new ResizeObserver(entries => {
    headerHeight.value = entries[0].contentRect.height
  })
  headerObserver.observe(headerEl.value)
})
onUnmounted(() => {
  if (headerObserver) headerObserver.disconnect()
})

const viewportHeight = computed(() => Math.max(0, stageSize.height - headerHeight.value - BOARD_CHROME))

const maxLayerCount = computed(() => Math.max(...state.map.layers.map(l => l.length)))

const sizeFactor = computed(() => {
  const desiredTotal = maxLayerCount.value * BASE_NODE_SIZE + (maxLayerCount.value - 1) * BASE_NODE_SEP + MARGIN * 2
  if (!viewportHeight.value) return 1
  return Math.min(1, viewportHeight.value / desiredTotal)
})
const nodeSize = computed(() => BASE_NODE_SIZE * sizeFactor.value)
const nodeSep = computed(() => BASE_NODE_SEP * sizeFactor.value)

// Real layered-graph layout (same family of algorithm d3-dag's sugiyama layout and
// graphviz's `dot` use): dagre assigns each node a non-overlapping x/y and routes each
// edge as a point path that reserves lanes between nodes, so lines never cross through
// another node's icon even though layer widths vary node-to-node.
const layout = computed(() => {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: nodeSep.value, ranksep: RANK_SEP, marginx: MARGIN, marginy: MARGIN * sizeFactor.value })
  g.setDefaultEdgeLabel(() => ({}))
  const allNodes = Object.values(state.map.nodes)
  allNodes.forEach(n => g.setNode(n.id, { width: nodeSize.value, height: nodeSize.value }))
  allNodes.forEach(n => n.edges.forEach(targetId => g.setEdge(n.id, targetId)))
  dagre.layout(g)
  return g
})

const layoutW = computed(() => layout.value.graph().width)
const layoutH = computed(() => layout.value.graph().height)

function topLeftOf(nodeId) {
  const gn = layout.value.node(nodeId)
  return { left: (gn.x - nodeSize.value / 2) + 'px', top: (gn.y - nodeSize.value / 2) + 'px' }
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
    <div ref="headerEl" style="flex-shrink:0;">
      <div class="modal-title" style="margin:8px 0 4px;">{{ t('solo.map.title', { act: state.act }) }}</div>
      <div class="center-hint" style="padding-bottom:6px;">{{ t('solo.map.hint') }}</div>
    </div>
    <div ref="viewportEl" style="flex:1; min-height:0; overflow-x:auto; overflow-y:hidden;">
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
            width: nodeSize + 'px',
            height: nodeSize + 'px',
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
          <div :style="{ fontSize: (nodeSize * 0.37) + 'px', lineHeight: 1 }">{{ TYPE_ICON[node.type] }}</div>
          <div :style="{ fontSize: (nodeSize * 0.135) + 'px', lineHeight: 1.1, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }">{{ t('solo.node.' + node.type) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
