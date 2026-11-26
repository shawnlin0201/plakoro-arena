<!-- Admin-only：商品零件表。
     這份資料原本寫在 data/productParts.js 裡，每加一盒就要改檔、發版、重建與部署一次
     整個網站 —— 而那整趟做的事只有填幾個數字。現在存在資料庫裡，這個畫面是唯一的入口。
     前端那份留著當拿不到伺服器時的退路，所以**這裡存了之後，退路那一份會變舊**：
     真正要緊的改動（新商品上市）請照常存這裡，它會立刻生效。 -->
<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProductParts, saveProductParts } from '../../data/adminApi'
import { adminToken } from '../../data/adminSession'
import { TYPE_FROM_ZH, refreshProductParts } from '../../data/productParts'
import { CONCAVE_TYPES, CONVEX_TYPES } from '../../game/diceParts'

const emit = defineEmits(['back'])
const { t } = useI18n()

// 編輯用的是中文型別名，跟資料庫存的一致 —— 數零件的來源網站就是用中文寫的，而真正
// 在維護這份資料的人是對著那個網站在數，換成日文會讓每次輸入都多一層心算。
const ZH = Object.keys(TYPE_FROM_ZH)
const CONVEX_ZH = ZH.filter(zh => CONVEX_TYPES.includes(TYPE_FROM_ZH[zh]))
const CONCAVE_ZH = ZH.filter(zh => CONCAVE_TYPES.includes(TYPE_FROM_ZH[zh]))

const CATEGORIES = ['starter', 'expeditionSmall', 'dx']
const STATUSES = ['confirmed', 'unknown', 'random']

const list = ref([])
const busy = ref(false)
const error = ref('')
const saved = ref(false)
const open = ref(null)

async function run(fn) {
  busy.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

// 伺服器給的是「只記不為零的那幾個」，編輯器要的是「九個欄位都在」—— 不然要新增一種
// 型別就得先變出一個欄位來。兩邊的形狀不同，所以進出各轉一次。
function spread(counts) {
  const out = {}
  ZH.forEach(zh => { out[zh] = counts?.[zh] || 0 })
  return out
}

function tighten(counts) {
  const out = {}
  Object.entries(counts || {}).forEach(([k, v]) => {
    const n = Math.trunc(Number(v))
    if (Number.isFinite(n) && n > 0) out[k] = n
  })
  return out
}

function toForm(p) {
  return {
    key: p.key || '',
    id: p.id || '',
    name: p.name || '',
    category: p.category || 'starter',
    jpy: p.jpy == null ? '' : String(p.jpy),
    release: p.release || '',
    status: p.status || 'unknown',
    halves: spread(p.halves),
    single: spread(p.single),
    // 方晶片是配對，組合太多，所以不攤平成欄位 —— 用一列一列加的方式，只留真的有的。
    dual: Object.entries(p.dual || {}).map(([pair, n]) => {
      const [a, b] = pair.split('+')
      return { a: a || ZH[0], b: b || ZH[0], n }
    })
  }
}

const load = () => run(async () => {
  const d = await getProductParts(adminToken.value)
  // 伺服器回的是 key/id/name/... 加上三張中文鍵的數量表（見 /api/product-parts）。
  list.value = (d.products || []).map(toForm)
  saved.value = false
})

load()

function blank() {
  return {
    key: '', id: '', name: '', category: 'starter', jpy: '', release: '', status: 'unknown',
    halves: spread(null), single: spread(null), dual: []
  }
}

function add() {
  list.value.push(blank())
  open.value = list.value.length - 1
}

function remove(i) {
  list.value.splice(i, 1)
  if (open.value === i) open.value = null
  else if (open.value > i) open.value -= 1
}

function move(i, delta) {
  const j = i + delta
  if (j < 0 || j >= list.value.length) return
  const [row] = list.value.splice(i, 1)
  list.value.splice(j, 0, row)
  open.value = j
}

function addDual(p) {
  p.dual.push({ a: ZH[0], b: ZH[0], n: 1 })
}

// 同一組配對出現兩次時後面的會蓋掉前面的（物件的鍵只有一個），所以存之前先合起來。
// 不是報錯：填的人想表達的顯然是「總共這麼多」，而不是其中一列作廢。
function dualToCounts(rows) {
  const out = {}
  for (const r of rows || []) {
    const n = Math.trunc(Number(r.n))
    if (!Number.isFinite(n) || n <= 0) continue
    const pair = [r.a, r.b].sort().join('+')
    out[pair] = (out[pair] || 0) + n
  }
  return out
}

const duplicateKeys = computed(() => {
  const seen = new Set()
  const dup = new Set()
  list.value.forEach(p => {
    const k = (p.key || '').trim()
    if (!k) return
    if (seen.has(k)) dup.add(k)
    seen.add(k)
  })
  return dup
})

// 存不下去的理由先算出來，而不是按了才讓伺服器退件：這個畫面一次送整份，被退件等於
// 整份都沒存進去，而填的人不會知道是哪一盒的問題。
const problems = computed(() => {
  const out = []
  list.value.forEach((p, i) => {
    const where = p.name || p.key || `#${i + 1}`
    if (!(p.key || '').trim()) out.push(t('admin.partsErrKey', { where }))
    if (!(p.name || '').trim()) out.push(t('admin.partsErrName', { where }))
    if (p.release && !/^\d{4}-\d{2}(-\d{2})?$/.test(p.release)) out.push(t('admin.partsErrRelease', { where }))
  })
  duplicateKeys.value.forEach(k => out.push(t('admin.partsErrDuplicate', { key: k })))
  if (!list.value.length) out.push(t('admin.partsErrEmpty'))
  return out
})

const save = () => run(async () => {
  await saveProductParts(adminToken.value, list.value.map(p => ({
    key: (p.key || '').trim(),
    id: (p.id || '').trim(),
    name: (p.name || '').trim(),
    category: p.category,
    jpy: p.jpy === '' ? null : Number(p.jpy),
    release: p.release || null,
    status: p.status,
    halves: tighten(p.halves),
    single: tighten(p.single),
    dual: dualToCounts(p.dual)
  })))
  saved.value = true
  // 存完立刻讓玩家端那份跟上，不必重新整理 —— 後台跟前台在同一個 app 裡，而「存了
  // 卻還看到舊的」會讓人以為沒存進去，然後再按一次。
  await refreshProductParts()
})

function sum(counts) {
  return Object.values(counts || {}).reduce((a, b) => a + (Number(b) || 0), 0)
}

function chipTotal(p) {
  return sum(p.single) + (p.dual || []).reduce((a, r) => a + (Number(r.n) || 0), 0)
}
</script>

<template>
  <div class="board select-board pp-board">
    <div class="modal-title pp-title">{{ t('admin.partsTitle') }}</div>

    <div class="pp-scroll">
      <p v-if="error" class="pp-error">{{ error }}</p>
      <p class="pp-note">{{ t('admin.partsNote') }}</p>

      <div class="pp-bar">
        <button class="pp-btn" :disabled="busy" @click="add">{{ t('admin.partsAdd') }}</button>
        <button class="pp-btn ghost" :disabled="busy" @click="load">{{ t('admin.salesReload') }}</button>
      </div>

      <div v-for="(p, i) in list" :key="i" class="pp-item">
        <div class="pp-head">
          <button class="pp-open" @click="open = open === i ? null : i">
            <span class="pp-key" :class="{ bad: duplicateKeys.has((p.key || '').trim()) }">{{ p.key || '—' }}</span>
            <span class="pp-name">{{ p.name || t('admin.partsUnnamed') }}</span>
            <!-- 蓋子與晶片的總數擺在收合狀態看得到的地方：盒上印的就是「改裝晶片 ×N」，
                 數完之後第一件要核對的事就是這個數字對不對得上。 -->
            <span class="pp-sum">{{ t('admin.partsCounts', { halves: sum(p.halves), chips: chipTotal(p) }) }}</span>
            <span class="pp-caret">{{ open === i ? '▴' : '▾' }}</span>
          </button>
          <button class="pp-btn ghost tiny" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button class="pp-btn ghost tiny" :disabled="i === list.length - 1" @click="move(i, 1)">↓</button>
          <button class="pp-btn ghost tiny" @click="remove(i)">✕</button>
        </div>

        <div v-if="open === i" class="pp-body">
          <div class="pp-fields">
            <label class="pp-f"><span>{{ t('admin.partsKey') }}</span>
              <input v-model="p.key" class="pp-in" placeholder="st10"></label>
            <label class="pp-f"><span>{{ t('admin.partsProductId') }}</span>
              <input v-model="p.id" class="pp-in" placeholder="01_7182"></label>
            <label class="pp-f wide"><span>{{ t('admin.partsName') }}</span>
              <input v-model="p.name" class="pp-in" placeholder="啟程套組 青綿鳥 10"></label>
            <label class="pp-f"><span>{{ t('admin.partsCategory') }}</span>
              <select v-model="p.category" class="pp-in">
                <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t(`productInfo.category.${c}`) }}</option>
              </select></label>
            <label class="pp-f"><span>{{ t('admin.partsStatus') }}</span>
              <select v-model="p.status" class="pp-in">
                <option v-for="st in STATUSES" :key="st" :value="st">{{ t(`admin.partsStatus_${st}`) }}</option>
              </select></label>
            <label class="pp-f"><span>{{ t('admin.partsJpy') }}</span>
              <input v-model="p.jpy" class="pp-in" type="number" min="0" placeholder="900"></label>
            <!-- 只知道月份是一個真的會發生的狀態（BANDAI 常常只公布月份），所以這一格
                 收 YYYY-MM 也收 YYYY-MM-DD，不是日期選擇器。 -->
            <label class="pp-f"><span>{{ t('admin.partsRelease') }}</span>
              <input v-model="p.release" class="pp-in" placeholder="2026-12 或 2026-12-05"></label>
          </div>

          <div class="pp-sec-label">{{ t('admin.partsConvex') }}</div>
          <div class="pp-grid">
            <label v-for="zh in CONVEX_ZH" :key="`cv${zh}`" class="pp-cell">
              <span>{{ zh }}</span>
              <input v-model.number="p.halves[zh]" class="pp-num" type="number" min="0">
            </label>
          </div>

          <div class="pp-sec-label">{{ t('admin.partsConcave') }}</div>
          <div class="pp-grid">
            <label v-for="zh in CONCAVE_ZH" :key="`cc${zh}`" class="pp-cell">
              <span>{{ zh }}</span>
              <input v-model.number="p.halves[zh]" class="pp-num" type="number" min="0">
            </label>
          </div>

          <div class="pp-sec-label">{{ t('admin.partsSingle') }}</div>
          <div class="pp-grid">
            <label v-for="zh in ZH" :key="`s${zh}`" class="pp-cell">
              <span>{{ zh }}</span>
              <input v-model.number="p.single[zh]" class="pp-num" type="number" min="0">
            </label>
          </div>

          <!-- 方晶片是兩種型別的配對，九種型別有四十五種組合，而一盒裡通常只有四五種。
               攤成四十五個欄位等於每次都要在一片零裡面找那幾格，所以改成一列一列加。 -->
          <div class="pp-sec-label">{{ t('admin.partsDual') }}</div>
          <div v-for="(d, di) in p.dual" :key="`d${di}`" class="pp-dual">
            <select v-model="d.a" class="pp-in slim">
              <option v-for="zh in ZH" :key="`da${zh}`" :value="zh">{{ zh }}</option>
            </select>
            <span class="pp-plus">＋</span>
            <select v-model="d.b" class="pp-in slim">
              <option v-for="zh in ZH" :key="`db${zh}`" :value="zh">{{ zh }}</option>
            </select>
            <input v-model.number="d.n" class="pp-num" type="number" min="0">
            <button class="pp-btn ghost tiny" @click="p.dual.splice(di, 1)">✕</button>
          </div>
          <button class="pp-btn ghost" @click="addDual(p)">{{ t('admin.partsAddDual') }}</button>
        </div>
      </div>
    </div>

    <div class="pp-foot">
      <!-- 存不下去的理由寫在按鈕上面，不是按了才讓伺服器退件：這裡一次送整份，被退件
           等於整份都沒存進去，而填的人不會知道是哪一盒的問題。 -->
      <p v-if="problems.length" class="pp-problem">{{ problems[0] }}</p>
      <p v-else-if="saved" class="pp-ok">{{ t('admin.partsSaved') }}</p>
      <div class="pp-foot-row">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
        <button class="btn" :disabled="busy || problems.length > 0" @click="save">
          {{ busy ? t('admin.partsSaving') : t('admin.partsSave') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pp-board { align-items: center; overflow: hidden; }
.pp-title { margin: 0.5rem 0 0.25rem; flex-shrink: 0; }

.pp-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  max-width: 32rem;
  padding: 0 0.625rem 0.5rem;
}

.pp-note, .pp-error, .pp-problem, .pp-ok {
  font-size: 0.5625rem;
  font-weight: 700;
  line-height: 1.6;
  margin: 0 0 0.375rem;
}
.pp-note { color: var(--sub); }
.pp-error, .pp-problem { color: #A8571F; }
.pp-ok { color: #2E7D52; }

.pp-bar { display: flex; gap: 0.25rem; margin-bottom: 0.375rem; }

.pp-btn {
  padding: 0.25rem 0.625rem;
  border: 0;
  border-radius: 999px;
  background: var(--accent-strong);
  color: var(--bg);
  font: inherit;
  font-size: 0.625rem;
  font-weight: 800;
  cursor: pointer;
}
.pp-btn.ghost { background: rgba(0, 0, 0, 0.06); color: var(--ink); }
.pp-btn.tiny { padding: 0.25rem 0.4375rem; flex-shrink: 0; }
.pp-btn:disabled { opacity: 0.4; cursor: default; }

.pp-item {
  background: var(--card);
  border: 0.0625rem solid var(--line);
  border-radius: var(--radius-sm);
  margin-bottom: 0.25rem;
}

.pp-head { display: flex; align-items: center; gap: 0.1875rem; padding: 0.25rem 0.375rem; }

.pp-open {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pp-key {
  flex-shrink: 0;
  font-size: 0.5625rem;
  font-weight: 800;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
}
.pp-key.bad { color: #A8571F; }
.pp-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.6875rem;
  font-weight: 800;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-sum { flex-shrink: 0; font-size: 0.5rem; font-weight: 700; color: var(--sub); font-variant-numeric: tabular-nums; }
.pp-caret { flex-shrink: 0; font-size: 0.5625rem; color: var(--sub); }

.pp-body { padding: 0 0.5rem 0.5rem; }

.pp-fields { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.375rem; }
.pp-f { display: flex; flex-direction: column; gap: 0.0625rem; flex: 1 1 7rem; }
.pp-f.wide { flex: 1 1 100%; }
.pp-f > span { font-size: 0.5rem; font-weight: 800; color: var(--sub); }

.pp-in {
  width: 100%;
  padding: 0.1875rem 0.3125rem;
  border: 0.0625rem solid var(--line);
  border-radius: 0.3125rem;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 0.625rem;
}
.pp-in.slim { width: auto; flex: 0 0 3.5rem; }

.pp-sec-label {
  font-size: 0.5625rem;
  font-weight: 800;
  color: var(--sub);
  margin: 0.375rem 0 0.1875rem;
}

.pp-grid { display: flex; flex-wrap: wrap; gap: 0.1875rem; }

.pp-cell {
  display: flex;
  align-items: center;
  gap: 0.1875rem;
  background: var(--bg);
  border-radius: 0.3125rem;
  padding: 0.0625rem 0.25rem;
}
.pp-cell > span { font-size: 0.625rem; font-weight: 800; color: var(--ink); }

.pp-num {
  width: 2.25rem;
  padding: 0.125rem 0.1875rem;
  border: 0.0625rem solid var(--line);
  border-radius: 0.25rem;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-size: 0.625rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pp-dual { display: flex; align-items: center; gap: 0.1875rem; margin-bottom: 0.1875rem; }
.pp-plus { font-size: 0.625rem; font-weight: 800; color: var(--sub); }

.pp-foot {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
}
.pp-foot-row { display: flex; gap: 0.375rem; }
</style>
