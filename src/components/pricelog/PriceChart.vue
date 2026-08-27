<script setup>
import { computed, ref } from 'vue'
import { scaleLinear, scaleTime } from 'd3-scale'
import { area, line } from 'd3-shape'
import { extent } from 'd3-array'
import { PRICE_SIDES, groupBySide, sortByTradedAt } from '../../game/priceStats'

// d3 does the maths (scales, path generation); Vue renders the SVG and handles clicks. Pulling
// in d3-selection to let d3 own the DOM too would add ~130kB and put two libraries in charge of
// the same nodes — the classic source of stale-render bugs in Vue + d3 components.
const props = defineProps({
  logs: { type: Array, required: true },
  stats: { type: Object, required: true },
  agentPrice: { type: Number, required: true },
  selectedId: { type: [String, Number], default: null },
  yUnit: { type: String, default: '' },
  xUnit: { type: String, default: '' }
})
const emit = defineEmits(['pick'])

// Measurements are taken from this wrapper, not the <svg> itself: SVGElement inherits from
// Element, not HTMLElement, so it has no offsetWidth/offsetHeight/offsetTop at all — reading
// them yields undefined and every derived coordinate becomes NaN.
const wrapRef = ref(null)

// Reports where a point sits in page pixels relative to the wrapper, so the caller can float a
// panel beside it.
//
// getBoundingClientRect would be the obvious tool, but #stage is rotated 90° in portrait, so
// rect values come back in the rotated frame (width and height swapped) and can't be compared
// with an unrotated layout. The viewBox ratio times the wrapper's own offset size is
// transform-independent and correct in both orientations.
function pointerPosition(p) {
  const el = wrapRef.value
  if (!el) return { x: 0, y: 0, el: null }
  return {
    x: (p.cx + M.left) / W * el.offsetWidth,
    y: (p.cy + M.top) / H * el.offsetHeight,
    el
  }
}

function onPickPoint(p) {
  emit('pick', p.log, pointerPosition(p))
}

// Viewport units, not rem: an SVG viewBox is a coordinate space of its own, and the element is
// sized in rem by its parent, so the drawing scales with the stage automatically.
const W = 320
const H = 150
// Left margin fits a thousands-separated price; bottom fits one row of dates. No separate
// unit labels to leave room for — the units live in the tick text itself.
const M = { top: 12, right: 10, bottom: 20, left: 42 }
const innerW = W - M.left - M.right
const innerH = H - M.top - M.bottom

const sorted = computed(() => sortByTradedAt(props.logs))
const bySide = computed(() => groupBySide(sorted.value))
const deals = computed(() => bySide.value[PRICE_SIDES.deal])

const timeOf = log => new Date(log.tradedAt)

const x = computed(() => {
  const [lo, hi] = extent(sorted.value, timeOf)
  if (!lo) return scaleTime().domain([new Date(), new Date()]).range([0, innerW])
  // A single data point (or several on one day) has no span to spread across — pad it out to a
  // day either side so the point lands mid-axis instead of collapsing onto the edge.
  const sameInstant = +lo === +hi
  const padMs = 24 * 60 * 60 * 1000
  return scaleTime()
    .domain(sameInstant ? [new Date(+lo - padMs), new Date(+hi + padMs)] : [lo, hi])
    .range([0, innerW])
})

const y = computed(() => {
  const amounts = sorted.value.map(l => l.amount).filter(Number.isFinite)
  // The baseline is always in view, so a product trading well above the suggested price still
  // shows how far above it is.
  const values = [...amounts, props.agentPrice]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo) * 0.15 || Math.max(hi * 0.1, 10)
  return scaleLinear().domain([lo - pad, hi + pad]).nice().range([innerH, 0])
})

// Completed trades get a line: they're a sequence of real market prices. Listings don't —
// connecting open offers would imply a trend that never actually happened.
const dealPath = computed(() => {
  if (deals.value.length < 2) return null
  return line()
    .x(d => x.value(timeOf(d)))
    .y(d => y.value(d.amount))(deals.value)
})

// Interquartile band — where the middle half of trades sat.
const iqrPath = computed(() => {
  const { q1, q3 } = props.stats
  if (!Number.isFinite(q1) || !Number.isFinite(q3) || deals.value.length < 4) return null
  return area()
    .x(d => x.value(timeOf(d)))
    .y0(y.value(q1))
    .y1(y.value(q3))(deals.value)
})

const agentY = computed(() => y.value(props.agentPrice))

const points = computed(() => sorted.value.map(log => ({
  log,
  cx: x.value(timeOf(log)),
  cy: y.value(log.amount),
  side: log.side,
  // Still-listed rows carry today's date because they haven't ended, so they all pile up on the
  // right edge. Drawing them as squares keeps them from reading as a cluster of same-day events.
  ongoing: !!log.isOngoing
})))

// The topmost tick carries the currency so the unit is stated once, in place, instead of
// floating in a corner label.
const yTicks = computed(() => {
  const ticks = y.value.ticks(4)
  return ticks.map((v, i) => ({
    v,
    ty: y.value(v),
    label: (i === ticks.length - 1 ? 'NT$' : '') + v.toLocaleString()
  }))
})

// More ticks than before, each with a vertical gridline: without them a point's date can only
// be found by tapping it. d3 picks sensible intervals for the span, and the count is capped so
// a wide date range doesn't crowd the labels into each other.
const xTicks = computed(() => {
  const span = x.value.domain()
  const days = Math.abs(span[1] - span[0]) / 86400000
  const wanted = days <= 10 ? 5 : days <= 45 ? 6 : 5
  return x.value.ticks(wanted).map(d => ({
    key: +d,
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    tx: x.value(d)
  }))
})

const SIDE_COLOR = {
  [PRICE_SIDES.deal]: '#4E9E6C',
  [PRICE_SIDES.sell]: '#E8302A',
  [PRICE_SIDES.buy]: '#2A6FE8',
  [PRICE_SIDES.preorder]: '#E07020'
}
</script>

<template>
  <div ref="wrapRef" style="width:100%; line-height:0;">
  <svg :viewBox="`0 0 ${W} ${H}`" style="width:100%; height:auto; display:block; overflow:visible;">
    <g :transform="`translate(${M.left},${M.top})`">
      <!-- vertical gridlines, so a point can be read off against a date without tapping it -->
      <line
        v-for="t in xTicks"
        :key="'gx' + t.key"
        :x1="t.tx"
        :x2="t.tx"
        :y1="0"
        :y2="innerH"
        stroke="var(--line)"
        stroke-width="0.5"
      />

      <!-- horizontal gridlines + price axis -->
      <g v-for="t in yTicks" :key="t.v">
        <line :x1="0" :x2="innerW" :y1="t.ty" :y2="t.ty" stroke="var(--line)" stroke-width="0.5" />
        <line :x1="-3" :x2="0" :y1="t.ty" :y2="t.ty" stroke="var(--sub)" stroke-width="0.6" opacity="0.5" />
        <text :x="-5.5" :y="t.ty + 2.5" text-anchor="end" font-size="6.5" fill="var(--sub)" font-weight="700">{{ t.label }}</text>
      </g>

      <!-- axis frame: both axes drawn, so the plot reads as a chart rather than points floating
           on a grid. Same weight as each other and heavier than the gridlines behind them. -->
      <line :x1="0" :x2="0" :y1="0" :y2="innerH" stroke="var(--sub)" stroke-width="0.6" opacity="0.5" />
      <line :x1="0" :x2="innerW" :y1="innerH" :y2="innerH" stroke="var(--sub)" stroke-width="0.6" opacity="0.5" />

      <!-- date axis -->
      <g v-for="t in xTicks" :key="'tx' + t.key">
        <line :x1="t.tx" :x2="t.tx" :y1="innerH" :y2="innerH + 3" stroke="var(--sub)" stroke-width="0.6" opacity="0.5" />
        <text :x="t.tx" :y="innerH + 11" text-anchor="middle" font-size="6.5" fill="var(--sub)" font-weight="700">{{ t.label }}</text>
      </g>

      <!-- interquartile band: the middle half of completed trades -->
      <path v-if="iqrPath" :d="iqrPath" fill="#4E9E6C" opacity="0.12" />

      <!-- distributor's suggested price, so any premium is visible at a glance -->
      <line :x1="0" :x2="innerW" :y1="agentY" :y2="agentY" stroke="var(--sub)" stroke-width="1" stroke-dasharray="3 2" />
      <text :x="innerW" :y="agentY - 3" text-anchor="end" font-size="6.5" fill="var(--sub)" font-weight="800">
        {{ agentPrice }}
      </text>

      <!-- trades only -->
      <path v-if="dealPath" :d="dealPath" fill="none" :stroke="SIDE_COLOR.deal" stroke-width="1.5" />

      <g
        v-for="(p, i) in points"
        :key="i"
        style="cursor:pointer;"
        @click="onPickPoint(p)"
      >
        <!-- generous invisible hit area: the visible marks are far too small to tap on a phone -->
        <circle :cx="p.cx" :cy="p.cy" r="7" fill="transparent" />
        <rect
          v-if="p.ongoing"
          :x="p.cx - (selectedId === p.log.id ? 4 : 2.8)"
          :y="p.cy - (selectedId === p.log.id ? 4 : 2.8)"
          :width="(selectedId === p.log.id ? 8 : 5.6)"
          :height="(selectedId === p.log.id ? 8 : 5.6)"
          fill="#fff"
          :stroke="SIDE_COLOR[p.side]"
          :stroke-width="selectedId === p.log.id ? 2 : 1.25"
        />
        <circle
          v-else
          :cx="p.cx"
          :cy="p.cy"
          :r="selectedId === p.log.id ? 4.5 : 3"
          :fill="p.side === PRICE_SIDES.deal ? SIDE_COLOR[p.side] : '#fff'"
          :stroke="SIDE_COLOR[p.side]"
          :stroke-width="selectedId === p.log.id ? 2 : 1.25"
        />
      </g>
    </g>
  </svg>
  </div>
</template>
