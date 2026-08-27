<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../../data/assetPath'
import { PRICE_PRODUCTS, PRODUCT_CATEGORIES, PRODUCT_UNITS } from '../../data/priceProducts'
import { PRICE_SIDES, premiumAgainstAgent, priceStats, sortByTradedAt, statsBySide } from '../../game/priceStats'
import { fetchPriceLogs } from '../../data/priceLogSource'
import PriceChart from './PriceChart.vue'

const emit = defineEmits(['back'])
const { t } = useI18n()
const { characters } = inject('characterData')

const logsByProduct = ref({})
// Entries the sheet had but this version can't place — currently expedition small boxes and
// single figures, which need product entries of their own before they can be shown.
const skippedCounts = ref({})
const isLoading = ref(true)
const loadError = ref('')

async function loadLogs() {
  isLoading.value = true
  loadError.value = ''
  try {
    const { byProduct, skipped } = await fetchPriceLogs()
    logsByProduct.value = byProduct
    skippedCounts.value = skipped
  } catch (e) {
    loadError.value = e.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadLogs)

const skippedTotal = computed(() =>
  Object.values(skippedCounts.value).reduce((sum, n) => sum + n, 0)
)

const selectedProductId = ref(null)
const selectedLog = ref(null)

// Chart/table filters. A bundled row's price is an even split of a lot total, which is an
// estimate rather than a quoted price — on by default because excluding bundles would discard
// real market data, but switchable for anyone who only wants prices that were actually quoted
// for a single item.
const includeBundleAvg = ref(true)
// Which entry kinds count. Trades and asking prices are both what a buyer would actually pay,
// so both are on; wanted-ads are a buyer's own offer and sit systematically lower, which would
// drag the median down, so they're off until asked for.
const activeSides = ref({
  [PRICE_SIDES.deal]: true,
  [PRICE_SIDES.sell]: true,
  [PRICE_SIDES.buy]: false,
  // Preorders are a real way to buy the item, so they're on — but they sit in their own block
  // rather than being pooled with resale prices.
  [PRICE_SIDES.preorder]: true
})

function toggleSide(side) {
  const next = { ...activeSides.value, [side]: !activeSides.value[side] }
  // Never let every kind be switched off — an empty chart isn't a useful state to be in.
  if (Object.values(next).some(Boolean)) activeSides.value = next
}

function applyFilters(logs) {
  return logs.filter(l => {
    if (!includeBundleAvg.value && l.isBundle) return false
    return activeSides.value[l.side]
  })
}

// The master data names Pokémon in Japanese (it's also the figure photo's filename), while
// `characters` is already localized — so match on the image path, which keeps the Japanese
// name regardless of the display language.
function localizedPokemon(japaneseName) {
  const encoded = encodeURIComponent(japaneseName)
  const hit = characters.value.find(c => c.imageUrl.includes(encoded) || c.imageUrl.includes(japaneseName))
  return hit ? hit.name : japaneseName
}

function productTitle(p) {
  if (p.category === PRODUCT_CATEGORIES.starter) {
    return t('priceLog.title.starter', { no: p.seriesNo, name: localizedPokemon(p.pokemon[0]) })
  }
  // Inner box and small box are separate products with prices an order of magnitude apart, so
  // the unit has to be part of the name — "探險盒組 01" alone would be ambiguous.
  const key = p.unit === PRODUCT_UNITS.smallBox ? 'expeditionSmall' : 'expedition'
  return t(`priceLog.title.${key}`, { no: p.seriesNo })
}

// Official packaging shots downloaded by scripts/fetch-product-images.mjs — a price listing
// should show the box being traded, not the figure inside it.
function productImage(p) {
  return asset(`image/PRODUCT/${p.id}.jpg`)
}

// The list uses the same filters as the detail view — otherwise a product's median would
// change when you tapped into it, which reads as a bug.
//
// The headline figure is the trade median where trades exist, since that's what the item
// actually changes hands for; with none, it falls back to asking prices and says so. Showing a
// single number pooled from both would let one wishful listing set the tone for the product.
const rows = computed(() => PRICE_PRODUCTS.map(p => {
  const logs = applyFilters(logsByProduct.value[p.id] || [])
  const bySide = statsBySide(logs)
  // Trades first — that's what the item actually goes for. Then preorders (a firm shop price),
  // then asking prices, then wanted ads.
  const headlineSide = [PRICE_SIDES.deal, PRICE_SIDES.preorder, PRICE_SIDES.sell, PRICE_SIDES.buy]
    .find(side => bySide[side].count > 0) || PRICE_SIDES.deal
  return {
    product: p,
    logs,
    stats: bySide[headlineSide],
    headlineSide,
    totalCount: logs.length,
    title: productTitle(p)
  }
}))

// Title lookup by id, for naming the other items in a bundle.
function rowTitle(productId) {
  const p = PRICE_PRODUCTS.find(x => x.id === productId)
  return p ? productTitle(p) : productId
}

const selected = computed(() => rows.value.find(r => r.product.id === selectedProductId.value) || null)

// The detail view works off the filtered set, so the headline figures, the chart and the
// history always describe the same data — a filter that only moved the chart would make the
// median above it quietly wrong.
const filteredLogs = computed(() => (selected.value ? applyFilters(selected.value.logs) : []))
const filteredStats = computed(() => priceStats(filteredLogs.value))
// Per-kind breakdown: trades and asking prices are read separately, since an unrealistic
// listing says nothing about what the thing actually changes hands for.
const sideStats = computed(() => statsBySide(filteredLogs.value))
// Only kinds that are both switched on and actually have entries get a block.
const SIDE_ORDER = [PRICE_SIDES.deal, PRICE_SIDES.sell, PRICE_SIDES.preorder, PRICE_SIDES.buy]

const shownSides = computed(() =>
  SIDE_ORDER
    .filter(side => activeSides.value[side] && sideStats.value[side].count > 0)
)
const detailLogs = computed(() => sortByTradedAt(filteredLogs.value).reverse())
const hasAnyLogs = computed(() => !!selected.value && selected.value.logs.length > 0)

function openProduct(id) {
  selectedProductId.value = id
  selectedLog.value = null
}

function backToList() {
  selectedProductId.value = null
  selectedLog.value = null
}

// Where the floating panel sits, in px from the top of the chart+history container. Both the
// chart and the rows live in that one container, so a click on either can be converted to the
// same coordinate space and the panel always lands next to what was clicked.
const detailBodyRef = ref(null)
const chartWrapRef = ref(null)
const historyRef = ref(null)
const panelTop = ref('0px')
const panelLeft = ref('50%')
const PANEL_HEIGHT_GUESS = 150
const PANEL_WIDTH_REM = 18

// offsetTop is measured against the nearest positioned ancestor, which isn't necessarily the
// container we're anchoring to — walk up and accumulate until we reach it.
function offsetTopWithin(el, container) {
  let top = 0
  let node = el
  while (node && node !== container) {
    top += node.offsetTop
    node = node.offsetParent
  }
  return top
}

function offsetLeftWithin(el, container) {
  let left = 0
  let node = el
  while (node && node !== container) {
    left += node.offsetLeft
    node = node.offsetParent
  }
  return left
}

function remToPx(rem) {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return rem * root
}

// Positions the panel at a point inside the container, nudged clear of the edges: below the
// point when there's room and above it when there isn't, and horizontally clamped so a point
// near either edge doesn't push the panel off-screen.
function placePanelAt(x, y, gap = 12) {
  const container = detailBodyRef.value
  if (!container) return
  const halfWidth = remToPx(PANEL_WIDTH_REM) / 2
  const maxX = Math.max(halfWidth, container.offsetWidth - halfWidth)
  panelLeft.value = `${Math.min(Math.max(x, halfWidth), maxX)}px`

  const below = y + gap
  const overflows = below + PANEL_HEIGHT_GUESS > container.offsetHeight
  panelTop.value = `${overflows ? Math.max(0, y - PANEL_HEIGHT_GUESS - gap) : below}px`
}

// Places the panel just below `anchorEl`, centred on it.
function placePanelNear(anchorEl) {
  const container = detailBodyRef.value
  if (!anchorEl || !container) return
  placePanelAt(
    offsetLeftWithin(anchorEl, container) + anchorEl.offsetWidth / 2,
    offsetTopWithin(anchorEl, container) + anchorEl.offsetHeight,
    4
  )
}

function pickLog(log, event) {
  if (selectedLog.value && selectedLog.value.id === log.id) {
    selectedLog.value = null
    return
  }
  selectedLog.value = log
  placePanelNear(event && event.currentTarget)
}

// Clicking a point on the chart floats the panel beside that point. PriceChart converts the
// SVG's internal coordinates into pixels relative to its own element; adding that element's
// offset within the container puts it in the same space as the history rows.
function toggleLog(log, pos) {
  if (selectedLog.value && selectedLog.value.id === log.id) {
    selectedLog.value = null
    return
  }
  selectedLog.value = log
  const container = detailBodyRef.value
  if (!pos || !pos.el || !container) {
    placePanelNear(chartWrapRef.value)
    return
  }
  placePanelAt(
    offsetLeftWithin(pos.el, container) + pos.x,
    offsetTopWithin(pos.el, container) + pos.y
  )
}

function money(n) {
  return Number.isFinite(n) ? `NT$${n.toLocaleString()}` : '—'
}

function premiumLabel(amount, agentPrice) {
  const pct = premiumAgainstAgent(amount, agentPrice)
  if (pct === null) return ''
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function premiumColor(amount, agentPrice) {
  const pct = premiumAgainstAgent(amount, agentPrice)
  if (pct === null || Math.abs(pct) < 1) return 'var(--sub)'
  return pct > 0 ? '#E8302A' : '#2A6FE8'
}

const SIDE_COLOR = {
  [PRICE_SIDES.deal]: '#4E9E6C',
  [PRICE_SIDES.sell]: '#E8302A',
  [PRICE_SIDES.buy]: '#2A6FE8',
  [PRICE_SIDES.preorder]: '#E07020'
}

// Names the entry kinds a figure covers, so "median NT$1500" says which prices went into it.
function sidesLabel(sides) {
  return SIDE_ORDER.filter(s => sides.includes(s)).map(s => t('priceLog.side.' + s)).join('・')
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <!-- list -->
  <div v-if="!selected" class="board select-board" style="overflow-y:auto; align-items:center;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem;">{{ t('priceLog.title.page') }}</div>
    <div class="center-hint" style="padding-bottom:0.5rem;">{{ t('priceLog.hint') }}</div>

    <div v-if="isLoading" style="font-size:0.8125rem; color:var(--sub); font-weight:700; padding:1.5rem;">{{ t('app.loading') }}</div>
    <div v-else-if="loadError" style="display:flex; flex-direction:column; align-items:center; gap:0.625rem; padding:1.5rem;">
      <div style="font-size:0.75rem; color:var(--sub); font-weight:700;">{{ loadError }}</div>
      <button class="btn secondary" @click="loadLogs">{{ t('app.retry') }}</button>
    </div>

    <div v-else-if="skippedTotal > 0" style="font-size:0.5625rem; color:var(--sub); font-weight:700; padding:0 0.625rem 0.5rem; text-align:center;">
      {{ t('priceLog.skippedNote', { n: skippedTotal }) }}
    </div>

    <div v-if="!isLoading && !loadError" style="width:100%; max-width:40rem; padding:0 0.625rem; display:grid; grid-template-columns:1fr 1fr; gap:0.625rem;">
      <div
        v-for="row in rows"
        :key="row.product.id"
        class="select-card"
        style="cursor:pointer; padding:0.5rem; gap:0.375rem; align-items:stretch;"
        @click="openProduct(row.product.id)"
      >
        <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
          <div style="width:2.75rem; height:2.75rem; border-radius:0.5rem; overflow:hidden; background:#fff; flex-shrink:0;">
            <img :src="productImage(row.product)" class="img-icon" :alt="row.title">
          </div>
          <div style="min-width:0; flex:1;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--ink); line-height:1.3;">{{ row.title }}</div>
            <div style="font-size:0.625rem; color:var(--sub); font-weight:700;">
              {{ t('priceLog.agentPrice') }} {{ money(row.product.agentPrice) }}<span v-if="row.product.agentPriceDerived">{{ t('priceLog.agentPriceDerived') }}</span>
            </div>
          </div>
        </div>

        <!-- Each figure is labelled: on its own "NT$200  +33%  3" says nothing about what it
             is, what it's a percentage of, or 3 of what. -->
        <div style="border-top:1px solid var(--line); padding-top:0.375rem;">
          <template v-if="row.stats.count > 0">
            <div style="display:flex; align-items:baseline; gap:0.25rem;">
              <span :style="{ fontSize:'0.5625rem', fontWeight:800, color:SIDE_COLOR[row.headlineSide] }">{{ t('priceLog.side.' + row.headlineSide) }}</span>
              <span style="font-size:0.5625rem; color:var(--sub); font-weight:800;">{{ t('priceLog.listMid') }}</span>
              <span style="font-size:1rem; font-weight:900; color:var(--ink);">{{ money(row.stats.mid) }}</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:0.25rem; flex-wrap:wrap;">
              <span style="font-size:0.5625rem; color:var(--sub); font-weight:700;">{{ t('priceLog.vsAgent') }}</span>
              <span :style="{ fontSize:'0.6875rem', fontWeight:800, color:premiumColor(row.stats.mid, row.product.agentPrice) }">
                {{ premiumLabel(row.stats.mid, row.product.agentPrice) }}
              </span>
              <span style="font-size:0.5625rem; color:var(--sub); font-weight:700;">・</span>
              <span style="font-size:0.5625rem; color:var(--sub); font-weight:700;">
                {{ t('priceLog.samples', { n: row.totalCount }) }}
              </span>
            </div>
          </template>
          <span v-else style="font-size:0.6875rem; color:var(--sub); font-weight:700;">{{ t('priceLog.noData') }}</span>
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:center; padding:0.875rem 0 0.25rem;">
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>

  <!-- detail -->
  <div v-else class="board select-board" style="overflow-y:auto; align-items:center;">
    <div style="width:100%; max-width:40rem; padding:0.5rem 0.625rem 0; display:flex; align-items:center; gap:0.5rem;">
      <div style="width:2.5rem; height:2.5rem; border-radius:0.5rem; overflow:hidden; background:#fff; flex-shrink:0;">
        <img :src="productImage(selected.product)" class="img-icon" :alt="selected.title">
      </div>
      <div style="min-width:0; flex:1;">
        <div style="font-size:0.875rem; font-weight:800; color:var(--ink);">{{ selected.title }}</div>
        <div style="font-size:0.625rem; color:var(--sub); font-weight:700;">
          {{ t('priceLog.agentPrice') }} {{ money(selected.product.agentPrice) }}<span v-if="selected.product.agentPriceDerived">{{ t('priceLog.agentPriceDerived') }}</span>
          <span v-if="selected.product.unit === PRODUCT_UNITS.innerBox"> ・ {{ t('priceLog.innerBoxNote', { n: selected.product.smallBoxesPerInnerBox }) }}</span>
        </div>
      </div>
    </div>

    <!-- low / mid / high -->
    <div style="width:100%; max-width:40rem; padding:0.625rem;">
      <!-- filters -->
      <div v-if="hasAnyLogs" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; padding-bottom:0.5rem;">
        <span style="font-size:0.625rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('priceLog.filter.label') }}</span>
        <label style="display:flex; align-items:center; gap:0.1875rem; font-size:0.625rem; font-weight:800; color:var(--sub); cursor:pointer;">
          <input type="checkbox" v-model="includeBundleAvg" style="width:0.75rem; height:0.75rem; margin:0;">
          {{ t('priceLog.filter.bundleAvg') }}
        </label>
        <span
          v-for="side in SIDE_ORDER"
          :key="side"
          @click="toggleSide(side)"
          :style="{
            display:'flex', alignItems:'center', gap:'0.1875rem', cursor:'pointer',
            fontSize:'0.625rem', fontWeight:800, padding:'0.0625rem 0.375rem', borderRadius:'0.625rem',
            background: activeSides[side] ? SIDE_COLOR[side] : '#F6F5F0',
            color: activeSides[side] ? '#fff' : 'var(--sub)'
          }"
        >{{ t('priceLog.side.' + side) }}</span>
      </div>

      <div v-if="!hasAnyLogs" style="text-align:center; font-size:0.75rem; color:var(--sub); padding:1.5rem 0; font-weight:700;">
        {{ t('priceLog.noData') }}
      </div>
      <div v-else-if="filteredStats.count === 0" style="text-align:center; font-size:0.75rem; color:var(--sub); padding:1.5rem 0; font-weight:700;">
        {{ t('priceLog.noMatch') }}
      </div>
      <template v-else>
        <!-- Chart and history share one positioning context so the floating panel can be
             anchored to whichever of them was clicked, using a single coordinate space. -->
        <div ref="detailBodyRef" style="position:relative;">
        <!-- chart on the left, the headline figures alongside it rather than stacked above -->
        <div ref="chartWrapRef" style="display:flex; gap:0.625rem; align-items:flex-start; padding:0.25rem 0;">
          <div style="flex:1; min-width:0;">
            <PriceChart
              :logs="filteredLogs"
              :stats="filteredStats"
              :agent-price="selected.product.agentPrice"
              :selected-id="selectedLog ? selectedLog.id : null"
              :y-unit="t('priceLog.axisPrice')"
              :x-unit="t('priceLog.axisDate')"
              @pick="toggleLog"
            />
          </div>
          <div style="width:9.5rem; flex-shrink:0; display:flex; flex-direction:column; gap:0.5rem;">
            <div v-for="side in shownSides" :key="side">
              <div style="display:flex; align-items:baseline; gap:0.25rem;">
                <span :style="{ fontSize:'0.625rem', fontWeight:900, color:SIDE_COLOR[side] }">{{ t('priceLog.side.' + side) }}</span>
                <span style="font-size:0.5rem; color:var(--sub); font-weight:700;">{{ sideStats[side].count }}</span>
              </div>
              <div style="display:flex; align-items:baseline; gap:0.375rem;">
                <span style="font-size:0.5rem; color:var(--sub); font-weight:800;">{{ t('priceLog.mid') }}</span>
                <span style="font-size:1rem; font-weight:900; color:var(--ink);">{{ money(sideStats[side].mid) }}</span>
              </div>
              <div style="display:flex; align-items:baseline; gap:0.375rem;">
                <span style="font-size:0.5rem; color:var(--sub); font-weight:800;">{{ t('priceLog.avg') }}</span>
                <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ money(sideStats[side].avg) }}</span>
              </div>
              <div style="font-size:0.5rem; color:var(--sub); font-weight:700;">
                {{ money(sideStats[side].low) }} – {{ money(sideStats[side].high) }}
              </div>
              <div :style="{ fontSize:'0.5rem', fontWeight:800, color:premiumColor(sideStats[side].mid, selected.product.agentPrice) }">
                {{ t('priceLog.vsAgent') }} {{ premiumLabel(sideStats[side].mid, selected.product.agentPrice) }}
              </div>
            </div>
          </div>
        </div>

        <!-- history. Rows are anchors for the floating panel rather than accordions, so the
             list keeps its shape while a record is open. -->
        <div ref="historyRef" style="border-top:0.125rem solid var(--line);">
          <div
            v-for="log in detailLogs"
            :key="log.id"
            :style="{
              borderBottom:'1px solid var(--line)', cursor:'pointer',
              background: selectedLog && selectedLog.id === log.id ? 'rgba(174,255,62,.18)' : 'transparent'
            }"
            @click="pickLog(log, $event)"
          >
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.375rem 0.125rem;">
              <span :style="{ fontSize:'0.625rem', fontWeight:700, flexShrink:0, width:'4.5rem', color: log.isOngoing ? SIDE_COLOR[log.side] : 'var(--sub)' }">
                {{ log.isOngoing ? t('priceLog.ongoing') : formatDate(log.tradedAt) }}
              </span>
              <span :style="{ fontSize:'0.625rem', fontWeight:800, color:SIDE_COLOR[log.side], flexShrink:0, width:'2.5rem' }">{{ t('priceLog.side.' + log.side) }}</span>
              <span style="font-size:0.8125rem; font-weight:900; color:var(--ink); flex:1;">{{ money(log.amount) }}</span>
              <span :style="{ fontSize:'0.5625rem', fontWeight:800, color:premiumColor(log.amount, selected.product.agentPrice), flexShrink:0 }">
                {{ premiumLabel(log.amount, selected.product.agentPrice) }}
              </span>
              <span v-if="log.isBundle" style="font-size:0.5rem; font-weight:800; color:#fff; background:var(--sub); border-radius:0.25rem; padding:0.0625rem 0.25rem; flex-shrink:0;">{{ t('priceLog.bundleTag') }}</span>
              <span style="font-size:0.5625rem; color:var(--sub); font-weight:700; flex-shrink:0;">{{ log.source }}</span>
            </div>
          </div>

        </div>

          <!-- floating detail: absolutely positioned within the chart+history container so it
               tracks whatever was clicked even while the page scrolls (a fixed-position panel
               would drift, and #stage is rotated 90 degrees in portrait so viewport coordinates
               don't mean what they look like) -->
          <div
            v-if="selectedLog"
            :style="{
              position:'absolute', left: panelLeft, transform:'translateX(-50%)',
              top: panelTop, width: PANEL_WIDTH_REM + 'rem', maxWidth:'92%', zIndex:20,
              background:'var(--bg)', borderRadius:'0.75rem', boxShadow:'0 6px 22px rgba(0,0,0,.28)',
              border:'0.125rem solid var(--line)', padding:'0.625rem 0.75rem'
            }"
            @click.stop
          >
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem;">
              <div>
                <div :style="{ fontSize:'1.125rem', fontWeight:900, color:'var(--ink)', lineHeight:1.1 }">{{ money(selectedLog.amount) }}</div>
                <div style="display:flex; align-items:center; gap:0.375rem; padding-top:0.125rem;">
                  <span :style="{ fontSize:'0.625rem', fontWeight:800, color:SIDE_COLOR[selectedLog.side] }">{{ t('priceLog.side.' + selectedLog.side) }}</span>
                  <span style="font-size:0.625rem; color:var(--sub); font-weight:700;">
                    {{ selectedLog.isOngoing ? t('priceLog.ongoing') : formatDate(selectedLog.tradedAt) }}
                  </span>
                  <span :style="{ fontSize:'0.625rem', fontWeight:800, color:premiumColor(selectedLog.amount, selected.product.agentPrice) }">
                    {{ premiumLabel(selectedLog.amount, selected.product.agentPrice) }}
                  </span>
                </div>
              </div>
              <button
                @click="selectedLog = null"
                style="width:1.375rem; height:1.375rem; border:none; border-radius:50%; background:rgba(0,0,0,.08); color:var(--ink); font-size:0.75rem; font-weight:800; line-height:1; cursor:pointer; flex-shrink:0;"
              >✕</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.25rem; padding-top:0.5rem; border-top:1px solid var(--line); margin-top:0.5rem;">
              <div style="font-size:0.625rem; color:var(--sub); font-weight:700;">
                {{ t('priceLog.sourceLabel') }}：{{ selectedLog.source || '—' }}
              </div>
              <div v-if="selectedLog.isBundle" style="font-size:0.625rem; color:var(--sub); font-weight:700; line-height:1.5;">
                {{ t('priceLog.bundleDetail', {
                  total: money(selectedLog.bundleTotal),
                  n: selectedLog.bundleSize,
                  names: selectedLog.bundleWith.map(id => rowTitle(id)).join('、')
                }) }}
              </div>
              <div v-if="selectedLog.isOngoing" style="font-size:0.5625rem; color:var(--sub); font-weight:700;">{{ t('priceLog.ongoingNote') }}</div>
              <div v-if="selectedLog.note" style="font-size:0.625rem; color:var(--sub); line-height:1.5;">{{ selectedLog.note }}</div>
              <a
                v-if="selectedLog.sourceUrl"
                :href="selectedLog.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                style="font-size:0.625rem; color:#2A6FE8; font-weight:800; word-break:break-all;"
              >{{ t('priceLog.openSource') }} ↗</a>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div style="display:flex; gap:0.625rem; justify-content:center; padding:0.5rem 0 0.25rem;">
      <button class="btn secondary" @click="backToList">{{ t('common.back') }}</button>
    </div>
  </div>
</template>
