<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'
import {
  TYPE_TO_ZH, isReleased, productParts, releaseIsMonthOnly
} from '../data/productParts'

const emit = defineEmits(['back'])
const { t } = useI18n()

// 分類的順序寫死，不是從資料裡推出來的：啟程 → 探險 → DX 是由小到大，而一份「我該
// 買什麼」的清單照這個順序讀才有意義。資料裡出現沒列到的分類時排在最後，不會消失。
const CATEGORY_ORDER = ['starter', 'expeditionSmall', 'dx']

const open = ref(null)

const groups = computed(() => {
  const seen = []
  for (const p of productParts.value) {
    if (!seen.includes(p.category)) seen.push(p.category)
  }
  return seen
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .map(key => ({ key, items: productParts.value.filter(p => p.category === key) }))
})

/** 一盒裡的零件，排成畫面要的四段。數量是 0 的型別不列 —— 那是一張清單，不是一張表格。 */
function sections(p) {
  const row = (counts, label) => ({
    label,
    parts: Object.entries(counts || {})
      .filter(([, n]) => n > 0)
      .map(([ja, n]) => ({ ja, zh: TYPE_TO_ZH[ja] || ja, n }))
      // 多的排前面。要回答的問題是「這盒主要補什麼」，而那就是數量最多的那幾個。
      .sort((a, b) => b.n - a.n || a.zh.localeCompare(b.zh))
  })
  const dual = {
    label: 'dual',
    parts: Object.entries(p.dual || {})
      .filter(([, n]) => n > 0)
      .map(([pair, n]) => {
        const [a, b] = pair.split('+')
        return { ja: pair, zh: `${TYPE_TO_ZH[a] || a}／${TYPE_TO_ZH[b] || b}`, n, pair: [a, b] }
      })
      .sort((a, b) => b.n - a.n || a.zh.localeCompare(b.zh))
  }
  return [row(p.convex, 'convex'), row(p.concave, 'concave'), row(p.single, 'single'), dual]
    .filter(s => s.parts.length)
}

function total(p) {
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0)
  return { halves: sum(p.convex) + sum(p.concave), chips: sum(p.single) + sum(p.dual) }
}

function releaseText(p) {
  if (!p.release) return t('productInfo.releaseUnknown')
  if (releaseIsMonthOnly(p)) return t('productInfo.releaseMonth', { month: p.release })
  return p.release
}

function icon(ja) {
  return asset(`image/ICON/${ja}.png`)
}
</script>

<template>
  <div class="board select-board pi-board">
    <div class="modal-title pi-title">{{ t('productInfo.title') }}</div>
    <div class="pi-hint">{{ t('productInfo.hint') }}</div>

    <div class="pi-scroll">
      <p v-if="!productParts.length" class="pi-empty">{{ t('productInfo.empty') }}</p>

      <template v-for="g in groups" :key="g.key">
        <h3 class="pi-group">{{ t(`productInfo.category.${g.key}`) }}</h3>

        <div v-for="p in g.items" :key="p.key" class="pi-item">
          <button class="pi-head" @click="open = open === p.key ? null : p.key">
            <span class="pi-name">{{ p.shortName || p.name }}</span>
            <span class="pi-meta">
              <!-- 還沒上市的要先講，不然整段內容物讀起來像「現在買得到」。 -->
              <span v-if="!isReleased(p)" class="pi-tag soon">{{ releaseText(p) }}</span>
              <span v-if="p.status === 'random'" class="pi-tag">{{ t('productInfo.statusRandom') }}</span>
              <span v-else-if="p.status === 'unknown'" class="pi-tag">{{ t('productInfo.statusUnknown') }}</span>
              <span class="pi-sum">{{ t('productInfo.summary', total(p)) }}</span>
            </span>
            <span class="pi-caret" aria-hidden="true">{{ open === p.key ? '▴' : '▾' }}</span>
          </button>

          <div v-if="open === p.key" class="pi-body">
            <!-- 還沒數過的那幾盒要說清楚是「不知道」，不是「沒有」。一張空的內容物
                 清單看起來跟「這盒什麼都沒有」一模一樣。 -->
            <p v-if="!sections(p).length" class="pi-none">{{ t('productInfo.contentsUnknown') }}</p>

            <div v-for="sec in sections(p)" :key="sec.label" class="pi-sec">
              <div class="pi-sec-label">{{ t(`productInfo.part.${sec.label}`) }}</div>
              <div class="pi-parts">
                <span v-for="part in sec.parts" :key="part.ja" class="pi-part">
                  <template v-if="part.pair">
                    <img class="pi-ic" :src="icon(part.pair[0])" :alt="part.zh">
                    <img class="pi-ic" :src="icon(part.pair[1])" alt="">
                  </template>
                  <img v-else class="pi-ic" :src="icon(part.ja)" :alt="part.zh">
                  <span class="pi-zh">{{ part.zh }}</span>
                  <span class="pi-n">×{{ part.n }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="pi-foot">
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
    </div>
  </div>
</template>

<style scoped>
.pi-board { align-items: center; overflow: hidden; }
.pi-title { margin: 0.5rem 0 0.25rem; flex-shrink: 0; }

.pi-hint {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--sub);
  margin-bottom: 0.375rem;
  padding: 0 0.75rem;
  text-align: center;
  flex-shrink: 0;
}

.pi-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  max-width: 28rem;
  padding: 0 0.75rem 0.5rem;
}

.pi-group {
  margin: 0.625rem 0 0.25rem;
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--sub);
  letter-spacing: 0.0625rem;
}

.pi-item {
  background: var(--card);
  border: 0.0625rem solid var(--line);
  border-radius: var(--radius-sm);
  margin-bottom: 0.25rem;
  overflow: hidden;
}

.pi-head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pi-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--ink);
}

.pi-meta { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }

.pi-tag {
  font-size: 0.5rem;
  font-weight: 800;
  color: var(--sub);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  padding: 0.0625rem 0.3125rem;
}

.pi-tag.soon { color: #A8571F; background: rgba(168, 87, 31, 0.14); }

.pi-sum {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
}

.pi-caret { flex-shrink: 0; font-size: 0.625rem; color: var(--sub); }

.pi-body { padding: 0 0.625rem 0.5rem; }

.pi-sec { margin-top: 0.375rem; }

.pi-sec-label {
  font-size: 0.5625rem;
  font-weight: 800;
  color: var(--sub);
  margin-bottom: 0.1875rem;
}

.pi-parts { display: flex; flex-wrap: wrap; gap: 0.25rem; }

.pi-part {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  background: var(--bg);
  border-radius: 999px;
  padding: 0.125rem 0.375rem 0.125rem 0.25rem;
}

/* 圖示是辨認零件最快的方式，但單憑顏色分不出九種屬性，所以中文名一起印。 */
.pi-ic { width: 0.875rem; height: 0.875rem; display: block; }
.pi-zh { font-size: 0.5625rem; font-weight: 800; color: var(--ink); }
.pi-n { font-size: 0.5625rem; font-weight: 800; color: var(--sub); font-variant-numeric: tabular-nums; }

.pi-none, .pi-empty {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--sub);
  padding: 0.375rem 0;
}

.pi-empty { text-align: center; padding: 1.5rem 0.75rem; }

.pi-foot {
  padding: 0.5rem 0 0.75rem;
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  flex-shrink: 0;
}
</style>
