<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { exportElementAsPng } from '../data/exportImage'
import {
  TYPE_TO_ZH, isReleased, productParts, releaseIsMonthOnly
} from '../data/productParts'
import ChipIcon from './dice/ChipIcon.vue'

const emit = defineEmits(['back'])
const { t } = useI18n()

// 分類的順序寫死，不是從資料裡推出來的：啟程 → 探險 → DX 是由小到大，而一份「我該
// 買什麼」的清單照這個順序讀才有意義。資料裡出現沒列到的分類時排在最後，不會消失。
const CATEGORY_ORDER = ['starter', 'expedition01', 'expedition02', 'dx']

const groups = computed(() => {
  const seen = []
  for (const p of productParts) {
    if (!seen.includes(p.category)) seen.push(p.category)
  }
  return seen
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .map(key => ({ key, items: productParts.filter(p => p.category === key) }))
})

function entries(counts) {
  return Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    // 多的排前面。一格裡要回答的是「這盒主要補什麼」，而那就是數量最多的那幾個。
    .sort((a, b) => b[1] - a[1])
}

/**
 * 一片一片攤開，不是「一片加一個數字」。
 *
 * 盒子裡裝的就是三片草晶片，那一欄看起來也該是三片 —— 寫成「草 ×3」要讀的人自己把
 * 數字換回畫面，而這一頁存在的理由正是省掉那一步。同一型別的排在一起，所以「這盒
 * 主要補什麼」仍然一眼看得出來。
 */
function pieces(counts, kind) {
  const out = []
  for (const [key, n] of entries(counts)) {
    const types = key.split('+')
    const zh = types.map(ja => TYPE_TO_ZH[ja] || ja).join('／')
    for (let i = 0; i < n; i++) out.push({ key: `${kind}${key}-${i}`, types, zh })
  }
  return out
}

/** 骰蓋。凸在前、凹在後 —— 一顆骰子要一凸一凹，分開看才知道缺的是哪一半。 */
function halves(p) {
  return [...pieces(p.convex, 'cv'), ...pieces(p.concave, 'cc')]
}

/*
 * 晶片分兩段：圓（單屬性）一段、方（雙屬性）另起一段，跟盒子裡分裝的方式一致。
 *
 * 分開是因為這兩種是不同的東西，而排在同一串裡時它們只差「有沒有斜線」——
 * 掃過去的時候要一片一片認，而不是看兩段各有多少。
 *
 * `types` 直接交給 ChipIcon —— 雙屬性是一片斜角分成兩色的晶片，不是兩片。組骰模擬器
 * 已經是這樣畫的，這裡用同一個元件，兩個畫面講的才會是同一種東西。
 */
function singles(p) {
  return pieces(p.single, 's')
}

function duals(p) {
  return pieces(p.dual, 'd')
}

/*
 * 少到一眼數得完的時候就不分段。
 *
 * 分段是為了讓「單屬性幾片、雙屬性幾片」不必一片片去認，但探險盒一共才四片 —— 那個
 * 問題本來就不存在，分段只是多佔一行，而這一頁是上下比較用的，每一列多一行就少看到
 * 一盒。
 *
 * 門檻取八：晶片欄一排大約放得下五片，八片是「一排放不下、但兩排也還看得完」的那個
 * 區間的上緣。再多就值得分段了。
 */
const ONE_ROW_MAX = 8

function splitRows(p) {
  return singles(p).length + duals(p).length > ONE_ROW_MAX
}

function note(p) {
  if (!isReleased(p)) {
    if (!p.release) return t('productInfo.releaseUnknown')
    return releaseIsMonthOnly(p)
      ? t('productInfo.releaseMonth', { month: p.release })
      : t('productInfo.releaseOn', { date: p.release })
  }
  if (p.status === 'random') return t('productInfo.statusRandom')
  if (p.status === 'unknown') return t('productInfo.statusUnknown')
  return ''
}

/* ── 匯出圖片 ────────────────────────────────────────────────────────────
   截的是標題加整份清單。這一頁沒有任何可切換的狀態 —— 看到什麼就是什麼 —— 所以不像
   招式期望排行那樣要把操作用的按鈕排除掉，只要把底下那排留在框外就好。
   ──────────────────────────────────────────────────────────────────── */
const exportTargetRef = ref(null)
const exporting = ref(false)

async function exportImage() {
  if (!exportTargetRef.value || exporting.value) return
  exporting.value = true
  try {
    await exportElementAsPng(exportTargetRef.value, 'plakoro-products')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="board select-board pi-board">
    <!-- 匯出的範圍：標題加整份清單，底下那排按鈕留在框外。 -->
    <div ref="exportTargetRef" class="pi-sheet">
      <div class="modal-title pi-title">{{ t('productInfo.title') }}</div>
      <p v-if="!productParts.length" class="pi-empty">{{ t('productInfo.empty') }}</p>

      <template v-for="g in groups" :key="g.key">
        <h3 class="pi-group">{{ t(`productInfo.category.${g.key}`) }}</h3>

        <!-- 一盒一列，內容物直接攤開 —— 要比較的是「哪一盒補的是我缺的那種」，而那
             個比較只有在兩盒同時看得見的時候才做得成。摺起來的話每比一次就要開關
             兩次。 -->
        <div class="pi-table">
          <div class="pi-row pi-head">
            <span class="pi-c-name">{{ t('productInfo.colName') }}</span>
            <span class="pi-c-halves">{{ t('productInfo.colHalves') }}</span>
            <span class="pi-c-chips">{{ t('productInfo.colChips') }}</span>
          </div>

          <div v-for="p in g.items" :key="p.key" class="pi-row">
            <span class="pi-c-name">
              <span class="pi-name">{{ p.shortName || p.name }}</span>
              <!-- 還沒上市、或還沒清點過的要先講，不然一列空白的內容物看起來就像
                   「這盒什麼都沒有」。 -->
              <span v-if="note(p)" class="pi-note">{{ note(p) }}</span>
            </span>

            <span class="pi-c-halves">
              <span v-if="!halves(p).length" class="pi-dash">—</span>
              <ChipIcon v-for="h in halves(p)" :key="h.key" :types="h.types" :size="1.375" />
            </span>

            <span class="pi-c-chips">
              <span v-if="!singles(p).length && !duals(p).length" class="pi-dash">—</span>
              <!-- 雙屬性是一片斜角分成兩色的晶片，不是兩片，所以交給 ChipIcon 畫 ——
                   跟組骰模擬器同一個元件。並排兩個圖示會被讀成「兩片單屬性」。 -->
              <template v-if="splitRows(p)">
                <span v-if="singles(p).length" class="pi-chip-row">
                  <ChipIcon v-for="c in singles(p)" :key="c.key" :types="c.types" :size="1.375" />
                </span>
                <span v-if="duals(p).length" class="pi-chip-row">
                  <ChipIcon v-for="c in duals(p)" :key="c.key" :types="c.types" :size="1.375" />
                </span>
              </template>
              <span v-else class="pi-chip-row">
                <ChipIcon
                  v-for="c in [...singles(p), ...duals(p)]"
                  :key="c.key"
                  :types="c.types"
                  :size="1.375"
                />
              </span>
            </span>
          </div>
        </div>
      </template>
    </div>

    <div class="pi-foot">
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      <button class="btn secondary" :disabled="exporting" @click="exportImage">
        {{ exporting ? t('productInfo.exporting') : t('productInfo.exportImage') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 整塊板自己捲，不是裡面那一欄 —— 匯出要截的是「整份清單」，而一個會捲的容器量到的
   高度只有看得見的那一截。
   底部 padding 清掉，改由懸浮的那排自己帶：sticky 的 `bottom: 0` 貼的是捲動區的
   padding 內緣，留著 .board 原本那一截就會在按鈕底下露出一條還在動的內容。 */
.pi-board { align-items: center; overflow-y: auto; padding-bottom: 0; }
.pi-title { margin: 0.5rem 0 0.375rem; flex-shrink: 0; }


.pi-sheet {
  width: 100%;
  max-width: 34rem;
  /* 底下那排是懸浮的，會蓋住最後一列 —— 留出它的高度，不然捲到底時最後一盒被壓在
     按鈕底下，而那正是會被誤認成「清單就到這裡」的位置。 */
  padding: 0 0.625rem 3rem;
  background: var(--bg);
}

.pi-group {
  margin: 0.625rem 0 0.1875rem;
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--sub);
  letter-spacing: 0.0625rem;
}

.pi-table {
  background: var(--card);
  border: 0.0625rem solid var(--line);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

/* 名稱與蓋子兩欄固定寬，晶片欄吃掉剩下的 —— 晶片是三欄裡唯一會長到換行的，而名稱
   與蓋子要在上下兩列之間對得齊，不然一整欄讀起來就不像一欄。 */
.pi-row {
  display: grid;
  grid-template-columns: 5rem 5.5rem 1fr;
  /* 沒有間距，欄與欄之間靠分隔線分開 —— 蓋子跟晶片都是一片片的方塊，只隔一段空白
     的話兩欄會讀成同一串。線也讓每一欄的左緣對得齊。 */
  gap: 0;
  /* stretch 而不是 start：分隔線要從一列的上緣拉到下緣，而那要求格子本身就是滿高的。 */
  align-items: stretch;
  padding: 0.3125rem 0.5rem;
  border-top: 0.0625rem solid var(--line);
}

.pi-row:first-child { border-top: 0; }

.pi-head {
  background: rgba(0, 0, 0, 0.03);
  align-items: center;
  font-size: 0.5rem;
  font-weight: 800;
  color: var(--sub);
  position: sticky;
  top: 0;
  z-index: 1;
}

.pi-c-name {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.0625rem;
  min-width: 0;
  padding-right: 0.5rem;
}

.pi-c-halves, .pi-c-chips {
  min-width: 0;
  padding: 0 0.5rem;
  border-left: 0.0625rem solid var(--line);
  gap: 0.1875rem;
}

/* 蓋子固定三個一排。一顆骰子是三凸三凹，排成三個一列時上面那列就是凸、下面那列就
   是凹 —— 版面自己把那件事說完了，不必再加標籤。用 grid 而不是讓它自己換行：換行
   的位置會跟著字級與邊距飄，而「三個一排」是這一欄要表達的意思，不是剛好的結果。 */
.pi-c-halves {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  align-content: center;
  justify-content: start;
}

/* 單屬性一段、雙屬性一段，各自換行。兩段之間的間距大一點，讓「這是兩種東西」不必
   靠讀圖案上有沒有斜線才看得出來。 */
.pi-c-chips {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;
}

.pi-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1875rem;
}

.pi-name {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.3;
}

.pi-note { font-size: 0.5rem; font-weight: 800; color: #A8571F; }




.pi-dash { font-size: 0.625rem; color: var(--sub); }


.pi-empty {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--sub);
  text-align: center;
  padding: 1.5rem 0.75rem;
}

/* 懸浮在畫面下緣，不是躺在清單的尾巴。這一頁是可以捲很久的 —— 返回要是跟著內容捲
   走，想離開就得先捲到底。
   自己帶底色：底下是會動的內容，半透明的話字會疊在圖示上。 */
.pi-foot {
  position: sticky;
  bottom: 0;
  z-index: 2;
  width: 100%;
  margin-top: auto;
  padding: 0.5rem 0 calc(0.75rem + env(safe-area-inset-bottom, 0px));
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  background: var(--bg);
  border-top: 0.0625rem solid var(--line);
}
</style>
