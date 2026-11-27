<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'
import { loadState, saveState, themeCardAsset, visibleSets } from '../data/themeCards'

const emit = defineEmits(['back'])
const { t } = useI18n()

const sets = visibleSets()
const saved = loadState()

// 每一組卡表各記各的。換主題不該把上一組挑好的卡洗掉 —— 兩場不同主題的賽事可能在
// 同一天，而玩家會在兩個畫面之間來回對照。
const bySet = ref(saved.bySet || {})

/* 三層：主題列表 → 卡表（左右翻、選卡、按確定）→ 出陣（按使用）。
   做成三層而不是一頁，是因為這三件事發生在不同時間：挑主題是賽前看的，選卡是開打
   前做的，出陣是打到一半拿給對手看的。擠在同一頁的話，最後那個畫面上滿是當下不該
   再按的按鈕。 */
const view = ref('themes')
const activeSetId = ref(null)

const activeSet = computed(() => sets.find(s => s.id === activeSetId.value) || null)

function slot(id) {
  if (!bySet.value[id]) bySet.value[id] = { picked: [], used: [] }
  return bySet.value[id]
}

const picked = computed(() => (activeSet.value ? slot(activeSet.value.id).picked : []))
const used = computed(() => (activeSet.value ? slot(activeSet.value.id).used : []))

const pickedCards = computed(() =>
  activeSet.value
    ? picked.value.map(id => activeSet.value.cards.find(c => c.id === id)).filter(Boolean)
    : []
)

watch([activeSetId, bySet], () => {
  saveState({ lastSet: activeSetId.value, bySet: bySet.value })
}, { deep: true })

function openSet(set) {
  activeSetId.value = set.id
  // 已經選好、而且已經用掉其中幾張的那一組，直接回到出陣 —— 那代表上一場還沒打完，
  // 手機只是鎖了一次屏。重新選卡永遠按得到，但不該是回來時的預設動作。
  const s = slot(set.id)
  view.value = s.used.length > 0 ? 'play' : 'pick'
}

function cardImage(card) {
  return card.image ? asset(themeCardAsset(card.image)) : ''
}

/* ── 橫向卡台 ──────────────────────────────────────────────────────────
   整疊卡排成一條，可以自由左右滑，不是一張一張翻頁。少了吸附之後，卡與卡之間停得
   下來，兩張並排比較也就成立了 —— 而那是選卡時真正在做的事。

   底下那排按鈕作用在「中間那一張」，所以仍然要知道現在中間是誰：取離可視區中心最
   近的那張。箭頭只是幫忙推一段距離，不是跳到下一頁。

   用原生的橫向捲動而不是自己算 transform：手指滑、滾輪、鍵盤走過去都是同一條路，
   慣性與回彈也是瀏覽器原本就做好的。桌機沒有手指，所以另外補了一段「按著卡面拖」。

   兩端的留白是真的元素，不是容器的 padding —— 捲動容器的尾端 padding 在部分瀏覽器
   會被吃掉，最後一張就推不到中間。
   ──────────────────────────────────────────────────────────────────── */
const trackRef = ref(null)
const activeIndex = ref(0)

const slides = computed(() => {
  if (view.value === 'pick') return activeSet.value ? activeSet.value.cards : []
  if (view.value === 'play') return pickedCards.value
  return []
})

const activeCard = computed(() => slides.value[activeIndex.value] || null)

// 把第 i 張推到正中央。算的是那一格的實際位置，不是「第幾格 × 一格寬」—— 兩端的
// 留白跟間距都算在裡面了，所以不必在這裡重算一次版面。
function centreOn(i) {
  const el = trackRef.value
  if (!el) return
  const node = el.querySelectorAll('.tcard-slide')[i]
  if (!node) return
  el.scrollTo({ left: node.offsetLeft - (el.clientWidth - node.clientWidth) / 2, behavior: 'smooth' })
}

// 中間是哪一張。比的是每一張的中心與可視區中心的距離，而不是從捲動距離除出來的 ——
// 可以自由停在兩張之間之後，除法會在半格的位置來回跳。
function onScroll() {
  const el = trackRef.value
  if (!el) return
  const mid = el.getBoundingClientRect().left + el.clientWidth / 2
  let best = 0
  let bestDist = Infinity
  el.querySelectorAll('.tcard-slide').forEach((node, i) => {
    const r = node.getBoundingClientRect()
    const d = Math.abs(r.left + r.width / 2 - mid)
    if (d < bestDist) { bestDist = d; best = i }
  })
  activeIndex.value = best
}

// 箭頭剛好跳一張。基準是「現在中間是哪一張」而不是捲動距離，所以從兩張之間的位置
// 按下去，落點一樣是隔壁那張的正中央，不會把半格的誤差一路累積下去。
function nudge(dir) {
  const next = Math.min(Math.max(activeIndex.value + dir, 0), slides.value.length - 1)
  centreOn(next)
}

// 直接點一張就把它移到中央。整條卡同時看得到五六張，最近的那張不一定是中間那張 ——
// 要選旁邊的卡時，點它比按兩下箭頭直覺。拖曳中的放開不算點擊。
function onSlideClick(i) {
  if (drag && drag.moved) return
  centreOn(i)
}

/* 桌機上按著卡面拖。
   手機本來就滑得動，但滑鼠在一個橫向捲動的容器上預設只會選到文字 —— 而這個畫面長
   得就像一疊可以撥開的卡。
   門檻設 4px：低於它的位移算點擊，不然按鈕會被輕微的手震吃掉。 */
let drag = null

function onPointerDown(e) {
  // 只接主鍵，而且不攔箭頭那兩顆 —— 它們是按鈕，不是卡面。
  if (e.button !== 0 || e.target.closest('.tcard-arrow')) return
  const el = trackRef.value
  if (!el) return
  drag = { x: e.clientX, left: el.scrollLeft, moved: false }
}

function onPointerMove(e) {
  if (!drag) return
  const el = trackRef.value
  if (!el) return
  const dx = e.clientX - drag.x
  if (!drag.moved && Math.abs(dx) < 4) return
  drag.moved = true
  el.scrollLeft = drag.left - dx
  // 拖到一半時瀏覽器會想選字或拉圖，兩者都讓拖曳看起來壞掉。
  e.preventDefault()
}

function endDrag() {
  drag = null
}

/* 兩端留白的寬度。卡片是「高度撐滿卡台、寬度照 63:88 算」，所以卡有多寬要等版面
   算完才知道 —— CSS 寫不出這個值，只能量完再填回去。
   螢幕轉向、網址列收起來都會改變卡台高度，所以是持續觀察而不是量一次。 */
const padW = ref(0)

function measurePad() {
  const el = trackRef.value
  if (!el) return
  const slide = el.querySelector('.tcard-slide')
  const w = slide ? slide.getBoundingClientRect().width : 0
  padW.value = Math.max(0, (el.clientWidth - w) / 2)
}

let trackObserver = null

watch(trackRef, el => {
  trackObserver?.disconnect()
  trackObserver = null
  if (!el || typeof ResizeObserver === 'undefined') return
  trackObserver = new ResizeObserver(measurePad)
  trackObserver.observe(el)
})

onBeforeUnmount(() => trackObserver?.disconnect())

// 換畫面要回到第一張，而且是瞬間回到 —— 這時候捲動動畫會變成「新畫面自己動了一
// 下」，看起來像誤觸。等 DOM 換完才捲，不然捲的還是上一疊。
watch(view, async () => {
  activeIndex.value = 0
  await nextTick()
  measurePad()
  await nextTick()
  if (trackRef.value) trackRef.value.scrollLeft = 0
})

/* ── 選卡 ── */

const isPicked = card => (card ? picked.value.includes(card.id) : false)

// 選到第幾張。現場講「我第一張出警察」要講得出口，所以卡上標的是順序而不是一個勾。
function pickOrder(card) {
  if (!card) return null
  const i = picked.value.indexOf(card.id)
  return i < 0 ? null : i + 1
}

// 選取是底下那顆鈕，不是點卡本身：在一個要用滑的介面裡，點擊跟滑動只差幾個像素，
// 而選錯卡在現場是要重講一次規則的。
//
// 帶幾張不設上限 —— 那是當場賽事宣布的規矩，不是這個工具的。
function toggle(card) {
  if (!card) return
  const s = slot(activeSet.value.id)
  const i = s.picked.indexOf(card.id)
  if (i >= 0) {
    s.picked.splice(i, 1)
    const u = s.used.indexOf(card.id)
    if (u >= 0) s.used.splice(u, 1)
    return
  }
  s.picked.push(card.id)
}

/* ── 出陣 ── */

const isUsed = card => (card ? used.value.includes(card.id) : false)

function toggleUsed(card) {
  if (!card) return
  const s = slot(activeSet.value.id)
  const i = s.used.indexOf(card.id)
  if (i >= 0) s.used.splice(i, 1)
  else s.used.push(card.id)
}

// 用掉的紀錄會留到下次打開 —— 手機在聚會中途會鎖屏，重開就歸零的話這個勾等於沒用。
// 代價是要有人說一聲「這場結束了」，就是這顆鈕。
function newMatch() {
  const s = slot(activeSet.value.id)
  s.used.splice(0, s.used.length)
}
</script>

<template>
  <div class="board select-board tc-board">
    <!-- ── 主題列表 ── -->
    <template v-if="view === 'themes'">
      <div class="modal-title tcard-title">{{ t('themeCards.title') }}</div>

      <div class="tcard-list">
        <div v-if="sets.length === 0" class="tcard-empty">{{ t('themeCards.noSets') }}</div>
        <button v-for="s in sets" :key="s.id" class="tcard-theme" @click="openSet(s)">
          <span class="tcard-theme-name">{{ s.name }}</span>
          <span class="tcard-theme-sub">
            {{ s.tagline || t('themeCards.cardCount', { n: s.cards.length }) }}
          </span>
        </button>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </template>

    <!-- ── 卡表／選卡與出陣共用同一疊卡，只有底下那排按鈕不同 ── -->
    <template v-else>
      <div class="modal-title tcard-title">
        {{ view === 'pick' ? activeSet.name : t('themeCards.playTitle') }}
      </div>

      <div v-if="slides.length === 0" class="tcard-empty">{{ t('themeCards.noCards') }}</div>

      <template v-else>
        <div class="tcard-stage">
          <div
            ref="trackRef"
            class="tcard-track"
            :class="{ dragging: !!drag }"
            @scroll.passive="onScroll"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="endDrag"
            @pointercancel="endDrag"
            @pointerleave="endDrag"
          >
            <div class="tcard-pad" :style="{ flex: `0 0 ${padW}px` }" aria-hidden="true"></div>
            <div
              v-for="(card, i) in slides"
              :key="card.id"
              class="tcard-slide"
              :class="{ off: i !== activeIndex }"
              @click="onSlideClick(i)"
            >
              <div class="tcard" :class="{ on: view === 'pick' && isPicked(card), spent: view === 'play' && isUsed(card) }">
                <span v-if="pickOrder(card)" class="tcard-order">{{ pickOrder(card) }}</span>
                <!-- 卡圖是整張卡的成品（框、標題、內文都已經印在上面），所以有圖的
                     時候這裡不再另外疊任何東西。沒圖的那幾張退回文字版 —— 卡表要能
                     在美術進來之前先排得出來，不然文案跟圖片就得綁在一起等。 -->
                <div class="tcard-art">
                  <img v-if="cardImage(card)" class="tcard-art-img" :src="cardImage(card)" :alt="card.name" loading="lazy" decoding="async">
                  <div v-else class="tcard-plain">
                    <div class="tcard-name">{{ card.name }}</div>
                    <div class="tcard-text">{{ card.text }}</div>
                  </div>
                  <!-- 用掉的那張要一眼看得出來，因為這個畫面是拿給對面的人看的，不
                       是給自己記的。所以不是把按鈕變灰就算了，卡面本身要蓋上章。 -->
                  <div v-if="view === 'play' && isUsed(card)" class="tcard-stamp">
                    {{ t('themeCards.usedStamp') }}
                  </div>
                </div>
              </div>
            </div>
            <div class="tcard-pad" :style="{ flex: `0 0 ${padW}px` }" aria-hidden="true"></div>
          </div>

          <!-- 箭頭疊在卡台上，不佔版面寬度 —— 中間那張卡要拿到的是所有剩下的空間。 -->
          <button
            class="tcard-arrow left"
            :disabled="activeIndex <= 0"
            :aria-label="t('themeCards.prev')"
            @click="nudge(-1)"
          >‹</button>
          <button
            class="tcard-arrow right"
            :disabled="activeIndex >= slides.length - 1"
            :aria-label="t('themeCards.next')"
            @click="nudge(1)"
          >›</button>
        </div>

        <div class="tcard-count">{{ activeIndex + 1 }} / {{ slides.length }}</div>
      </template>

      <!-- 一排按鈕，這一張的動作跟整個畫面的動作並列。位置固定，所以翻到哪一張都是
           按同一個地方。 -->
      <div class="tcard-foot">
        <template v-if="view === 'pick'">
          <button class="btn secondary" @click="view = 'themes'">{{ t('common.back') }}</button>
          <button
            v-if="slides.length"
            class="btn"
            :class="{ secondary: isPicked(activeCard) }"
            @click="toggle(activeCard)"
          >
            {{ isPicked(activeCard) ? t('themeCards.unpick', { n: pickOrder(activeCard) }) : t('themeCards.pick') }}
          </button>
          <button class="btn" :disabled="picked.length === 0" @click="view = 'play'">
            {{ t('themeCards.confirm', { n: picked.length }) }}
          </button>
        </template>
        <template v-else>
          <button class="btn secondary" @click="view = 'pick'">{{ t('themeCards.repick') }}</button>
          <button
            v-if="slides.length"
            class="btn"
            :class="{ secondary: isUsed(activeCard) }"
            @click="toggleUsed(activeCard)"
          >
            {{ isUsed(activeCard) ? t('themeCards.undoUse') : t('themeCards.markUsed') }}
          </button>
          <button class="btn secondary" :disabled="used.length === 0" @click="newMatch">
            {{ t('themeCards.newMatch') }}
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tc-board { align-items: center; overflow: hidden; }

.tcard-title { margin: 0.375rem 0 0.25rem; flex-shrink: 0; }

/* ── 主題列表 ── */
.tcard-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  max-width: 24rem;
  padding: 0.25rem 0.75rem 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tcard-theme {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  background: var(--card);
  border: 0.125rem solid var(--line);
  border-radius: var(--radius);
  padding: 0.625rem 0.75rem;
  text-align: left;
  cursor: pointer;
  flex-shrink: 0;
}

.tcard-theme-name { font-size: 0.875rem; font-weight: 800; color: var(--ink); }
.tcard-theme-sub { font-size: 0.625rem; font-weight: 700; color: var(--sub); }

/* ── 卡台 ── */
.tcard-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
}

.tcard-track {
  gap: 0.375rem;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  /* 橫向滑動交給這一條，不要讓瀏覽器當成翻頁／上一頁的手勢。 */
  touch-action: pan-x;
}

.tcard-track.dragging { cursor: grabbing; }

/* 拖的時候不要選到字，也不要把卡圖拉出來變成拖放。 */
.tcard-track.dragging,
.tcard-track.dragging * { user-select: none; }
.tcard-art-img { -webkit-user-drag: none; user-select: none; }

.tcard-track::-webkit-scrollbar { display: none; }

/* 兩端的留白，讓第一張與最後一張也停得到正中央。用真的元素而不是容器的 padding：
   捲動容器的尾端 padding 在部分瀏覽器會被吃掉。 */
/* 兩端的留白要剛好等於「可視區一半 − 半張卡」，第一張與最後一張才停得到正中央。
   卡寬是從卡台高度算出來的，CSS 這裡拿不到，所以由 padW 量好之後送進來。 */
.tcard-pad { height: 1px; }

.tcard-slide {
  flex: 0 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* 旁邊那幾張只是淡一點。原本還會縮小，那是「一次只給你看一張」時代的做法 —— 現在
   整排都要看得清楚，縮小只會讓人以為它們是另一種東西。 */
.tcard-slide.off { opacity: 0.55; }
.tcard-slide { transition: opacity 0.2s, transform 0.2s; }

@media (prefers-reduced-motion: reduce) {
  .tcard-slide { transition: none; }
}

.tcard-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 0.0625rem solid var(--line);
  background: var(--card);
  color: var(--ink);
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  opacity: 0.9;
}

.tcard-arrow.left { left: 0.125rem; }
.tcard-arrow.right { right: 0.125rem; }
.tcard-arrow:disabled { opacity: 0.2; cursor: default; }

/* ── 卡 ── */
.tcard {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tcard-art {
  position: relative;
  /* 實體卡 6.3 × 8.8 cm。高度吃滿卡台、寬度照比例算 —— 這一頁要讓人讀得到卡面上
     印的字，所以決定大小的是縱向剩多高，不是橫向排得下幾張。 */
  aspect-ratio: 63 / 88;
  height: 100%;
  width: auto;
  background: var(--card);
  border-radius: var(--radius);
  overflow: hidden;
}

.tcard.on .tcard-art { box-shadow: 0 0 0 0.25rem var(--accent-strong); }

.tcard.spent .tcard-art-img,
.tcard.spent .tcard-plain { opacity: 0.4; }

.tcard-art-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 還沒有卡圖時的卡面。不是佔位圖 —— 名稱跟效果本來就是這張卡要講的兩件事，美術進
   來之後它們改印在圖上，這一塊就不顯示了。 */
.tcard-plain {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.25rem 1rem;
  text-align: center;
  border: 0.125rem solid var(--line);
  border-radius: var(--radius);
}

.tcard-name { font-size: 1.125rem; font-weight: 800; color: var(--ink); line-height: 1.3; }
.tcard-text { font-size: 0.8125rem; font-weight: 700; color: var(--sub); line-height: 1.6; }

.tcard-order {
  position: absolute;
  top: -0.375rem;
  left: -0.375rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--accent-strong);
  color: var(--bg);
  font-size: 0.8125rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* 蓋在下三分之一，不是正中央。這個畫面是拿給對手看的，而他要看的是「你用掉了哪一
   張」—— 章壓在卡名上的話，看得出有東西被用掉了，卻看不出是什麼。 */
.tcard-stamp {
  position: absolute;
  top: 68%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 0.25rem solid var(--danger);
  color: var(--danger);
  background: rgba(255, 255, 255, 0.82);
  border-radius: 0.5rem;
  padding: 0.25rem 1rem;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: 0.1875rem;
  white-space: nowrap;
  pointer-events: none;
}

.tcard-count {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--sub);
  flex-shrink: 0;
  padding-top: 0.25rem;
  font-variant-numeric: tabular-nums;
}

.tcard-empty {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--sub);
  padding: 1.5rem 0.75rem;
  text-align: center;
  flex: 1 1 auto;
}

.tcard-foot {
  padding: 0.5rem 0 0.75rem;
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}
</style>
