<script setup>
// The per-entry facts that don't fit on a history row: where it came from, what the lot total
// was, how much stock moved, and a link back to the listing.
//
// Shared by the two places a record can be opened — the floating panel beside a chart point, and
// the inline expansion under a history row. One component rather than two copies of the markup,
// since they show the same facts and only differ in where they sit.
import { useI18n } from 'vue-i18n'
import { money, stockLabel } from '../../game/priceFormat'

defineProps({
  log: { type: Object, required: true },
  // Product titles for the rest of a bundle, resolved by the parent — it owns the localized
  // product-name lookup and this component has no business duplicating it.
  bundleNames: { type: Array, default: () => [] }
})
const { t } = useI18n()

// Sold-out is the one state worth colouring: it marks the entry as a price someone actually
// paid, rather than one still being asked for.
const SOLD_OUT_COLOR = '#4E9E6C'
</script>

<template>
  <div style="display:flex; flex-direction:column; gap:0.25rem;">
    <div style="font-size:0.625rem; color:var(--sub); font-weight:700;">
      {{ t('priceLog.sourceLabel') }}：{{ log.source || '—' }}
    </div>
    <div v-if="log.isBundle" style="font-size:0.625rem; color:var(--sub); font-weight:700; line-height:1.5;">
      {{ t('priceLog.bundleDetail', {
        total: money(log.bundleTotal),
        n: log.bundleSize,
        names: bundleNames.join('、')
      }) }}
    </div>
    <div
      v-if="stockLabel(log, t)"
      :style="{ fontSize:'0.625rem', fontWeight:800, color: log.isSoldOut ? SOLD_OUT_COLOR : 'var(--sub)' }"
    >
      {{ stockLabel(log, t) }}
    </div>
    <div v-if="log.note" style="font-size:0.625rem; color:var(--sub); line-height:1.5;">{{ log.note }}</div>
    <a
      v-if="log.sourceUrl"
      :href="log.sourceUrl"
      target="_blank"
      rel="noopener noreferrer"
      style="font-size:0.625rem; color:#2A6FE8; font-weight:800; word-break:break-all;"
    >{{ t('priceLog.openSource') }} ↗</a>
  </div>
</template>
