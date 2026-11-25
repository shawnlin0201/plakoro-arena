<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'
import {
  DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, allCards,
  factionOf, loadState, saveState, themeCardAsset, visibleSets
} from '../data/themeCards'

const emit = defineEmits(['back'])
const { t } = useI18n()

const sets = visibleSets()
const saved = loadState()

const limit = ref(saved.limit || DEFAULT_LIMIT)
// 每一組卡表各記各的。換主題不該把上一組挑好的卡洗掉 —— 兩場不同主題的賽事可能在
// 同一天，而玩家會在兩個畫面之間來回對照。
const bySet = ref(saved.bySet || {})

/* 四層：主題列表 → 選邊 → 卡表（左右翻、選卡、按確定）→ 出陣（按使用）。
   做成一層一層而不是一頁，是因為這幾件事發生在不同時間：挑主題跟選邊是賽前決定的，
   選卡是開打前做的，出陣是打到一半拿給對手看的。擠在同一頁的話，最後那個畫面上滿
   是當下不該再按的按鈕。

   選邊單獨一步，是因為它跟選卡不是同一種決定：卡可以邊看邊換，邊選錯了整手卡都要
   重來。放在同一頁上就會變成卡表上方一排可以隨手點到的標籤。 */
const view = ref('themes')
const activeSetId = ref(null)

const activeSet = computed(() => sets.find(s => s.id === activeSetId.value) || null)

function slot(id) {
  if (!bySet.value[id]) bySet.value[id] = { faction: null, picked: [], used: [] }
  return bySet.value[id]
}

// 玩家站的那一邊。沒選邊就沒有卡表 —— 這個主題的卡全部都屬於某一邊。
const activeFaction = computed(() =>
  activeSet.value ? factionOf(activeSet.value, slot(activeSet.value.id).faction) : null)

// 選邊。換邊等於整手卡重來，因為對面的卡本來就帶不走 —— 與其留著一份跨不過去的
// 紀錄，不如在這裡就清乾淨，讓「我現在帶的是哪幾張」只有一個答案。
function chooseFaction(faction) {
  const s = slot(activeSetId.value)
  if (s.faction !== faction.id) {
    s.faction = faction.id
    s.picked = []
    s.used = []
  }
  view.value = 'pick'
}

const picked = computed(() => (activeSet.value ? slot(activeSet.value.id).picked : []))
const used = computed(() => (activeSet.value ? slot(activeSet.value.id).used : []))

const pickedCards = computed(() =>
  activeFaction.value
    ? picked.value.map(id => activeFaction.value.cards.find(c => c.id === id)).filter(Boolean)
    : []
)

watch([limit, activeSetId, bySet], () => {
  saveState({ limit: limit.value, lastSet: activeSetId.value, bySet: bySet.value })
}, { deep: true })

function openSet(set) {
  activeSetId.value = set.id
  const s = slot(set.id)
  // 已經選好、而且已經用掉其中幾張的那一組，直接回到出陣 —— 那代表上一場還沒打完，
  // 手機只是鎖了一次屏。重新選卡永遠按得到，但不該是回來時的預設動作。
  if (!factionOf(set, s.faction)) view.value = 'faction'
  else view.value = s.used.length > 0 ? 'play' : 'pick'
}

function cardImage(card) {
  return card.image ? asset(themeCardAsset(card.image)) : ''
}

// 陣營自己的框優先。警察跟歹徒的卡在桌上要一眼分得出來，而那通常就是框的差別。
const frameImage = computed(() => {
  const own = activeFaction.value && activeFaction.value.frame
  const shared = activeSet.value && activeSet.value.frame
  const file = own || shared
  return file ? asset(themeCardAsset(file)) : ''
})

/* ── 左右翻卡 ──────────────────────────────────────────────────────────
   一次一張。卡是有正面的東西 —— 縮成兩欄的小方塊可以比較，但看不出那是一張卡，而
   實體賽上玩家手裡拿的就是卡。

   翻頁用的是原生的橫向捲動加 scroll-snap，不是自己算 transform：這樣手指滑、箭頭
   點、鍵盤 Tab 過去都走同一條路，而慣性與回彈是瀏覽器原本就做好的。
   ──────────────────────────────────────────────────────────────────── */
const trackRef = ref(null)
const activeIndex = ref(0)

// 目前這個畫面在翻的是哪一疊。選卡翻的是整組卡表，出陣翻的只有自己帶的那幾張。
const slides = computed(() => {
  if (view.value === 'pick') return activeFaction.value ? activeFaction.value.cards : []
  if (view.value === 'play') return pickedCards.value
  return []
})

const activeCard = computed(() => slides.value[activeIndex.value] || null)

// 一格的寬度就是可視區的寬度，所以第幾張 = 捲過幾個可視區寬。比起量每個元素的位
// 置，這個算法不會因為間距或邊框改了就失準。
function onScroll() {
  const el = trackRef.value
  if (!el || !el.clientWidth) return
  activeIndex.value = Math.round(el.scrollLeft / el.clientWidth)
}

function go(i) {
  const el = trackRef.value
  if (!el) return
  const n = Math.max(0, Math.min(slides.value.length - 1, i))
  el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
}

// 換畫面要回到第一張，而且是瞬間回到 —— 這時候捲動動畫會變成「新畫面自己動了一
// 下」，看起來像誤觸。等 DOM 換完才捲，不然捲的還是上一疊。
watch(view, async () => {
  activeIndex.value = 0
  await nextTick()
  if (trackRef.value) trackRef.value.scrollLeft = 0
})

/* ── 選卡 ── */

function isPicked(card) {
  return card ? picked.value.includes(card.id) : false
}

// 選到第幾張。現場講「我第一張出警察」要講得出口，所以卡上標的是順序而不是一個勾。
function pickOrder(card) {
  if (!card) return null
  const i = picked.value.indexOf(card.id)
  return i < 0 ? null : i + 1
}

// 選取是底下那顆鈕，不是點卡本身：在一個要用滑的介面裡，點擊跟滑動只差幾個像素，
// 而選錯卡在現場是要重講一次規則的。
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
  if (s.picked.length >= limit.value) return
  s.picked.push(card.id)
}

const pickFull = computed(() => picked.value.length >= limit.value)

// 調張數調到比已選的少時，從最後選的那張開始退。退最早選的那張會把玩家心裡的第一
// 順位拿走，而他剛剛做的動作是「少帶一張」，不是「重選」。
function setLimit(n) {
  const next = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, n))
  limit.value = next
  for (const s of Object.values(bySet.value)) {
    while (s.picked.length > next) {
      const dropped = s.picked.pop()
      const u = s.used.indexOf(dropped)
      if (u >= 0) s.used.splice(u, 1)
    }
  }
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

const remaining = computed(() => pickedCards.value.filter(c => !isUsed(c)).length)
</script>

<template>
  <div class="board select-board tc-board">
    <!-- ── 主題列表 ── -->
    <template v-if="view === 'themes'">
      <div class="modal-title tcard-title">{{ t('themeCards.title') }}</div>
      <div class="tcard-hint">{{ t('themeCards.themesHint') }}</div>

      <div class="tcard-list">
        <div v-if="sets.length === 0" class="tcard-empty">{{ t('themeCards.noSets') }}</div>
        <button v-for="s in sets" :key="s.id" class="tcard-theme" @click="openSet(s)">
          <span class="tcard-theme-name">{{ s.name }}</span>
          <span class="tcard-theme-sub">
            {{ s.tagline || t('themeCards.cardCount', { n: allCards(s).length }) }}
          </span>
          <!-- 標的是「你站哪邊、帶了幾張」。只報張數的話，回到這一頁最想確認的那
               件事反而看不到。 -->
          <span v-if="slot(s.id).picked.length" class="tcard-theme-mark">
            {{ t('themeCards.pickedMark', {
              side: factionOf(s, slot(s.id).faction)?.name || '',
              n: slot(s.id).picked.length
            }) }}
          </span>
        </button>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </template>

    <!-- ── 選邊 ── -->
    <template v-else-if="view === 'faction'">
      <div class="modal-title tcard-title">{{ activeSet.name }}</div>
      <div class="tcard-hint">{{ t('themeCards.factionHint') }}</div>

      <div class="tcard-list">
        <button
          v-for="f in activeSet.factions"
          :key="f.id"
          class="tcard-faction"
          @click="chooseFaction(f)"
        >
          <span class="tcard-faction-name">{{ f.name }}</span>
          <span class="tcard-faction-sub">{{ f.tagline }}</span>
          <span class="tcard-faction-count">{{ t('themeCards.cardCount', { n: f.cards.length }) }}</span>
        </button>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="view = 'themes'">{{ t('common.back') }}</button>
      </div>
    </template>

    <!-- ── 卡表／選卡與出陣共用同一疊卡，只有上下的字跟按鈕不同 ── -->
    <template v-else>
      <div class="modal-title tcard-title">
        {{ view === 'pick' ? activeSet.name : t('themeCards.playTitle') }}
      </div>
      <!-- 站哪邊要一直看得到。選邊是在上一個畫面做的，走到這裡已經不在眼前了，而
           它決定了這一整疊卡。 -->
      <div v-if="activeFaction" class="tcard-side">{{ activeFaction.name }}</div>

      <div v-if="view === 'pick'" class="tcard-limit">
        <span class="tcard-limit-label">{{ t('themeCards.limitLabel') }}</span>
        <button class="tcard-step" :disabled="limit <= MIN_LIMIT" @click="setLimit(limit - 1)">−</button>
        <span class="tcard-limit-n">{{ limit }}</span>
        <button class="tcard-step" :disabled="limit >= MAX_LIMIT" @click="setLimit(limit + 1)">＋</button>
      </div>

      <div class="tcard-hint">
        {{ view === 'pick' ? t('themeCards.limitHint') : t('themeCards.playHint', { n: remaining }) }}
      </div>

      <div v-if="slides.length === 0" class="tcard-empty">{{ t('themeCards.noCards') }}</div>

      <template v-else>
        <div class="tcard-stage">
          <button
            class="tcard-arrow left"
            :disabled="activeIndex <= 0"
            :aria-label="t('themeCards.prev')"
            @click="go(activeIndex - 1)"
          >‹</button>

          <div ref="trackRef" class="tcard-track" @scroll.passive="onScroll">
            <div v-for="card in slides" :key="card.id" class="tcard-slide">
              <div class="tcard" :class="{ on: view === 'pick' && isPicked(card), spent: view === 'play' && isUsed(card) }">
                <span v-if="pickOrder(card)" class="tcard-order">{{ pickOrder(card) }}</span>
                <!-- 卡框疊在卡圖上，兩者都還沒進來時只剩文字 —— 卡表要能在美術完成
                     之前先排得出來，不然文案跟圖片就得綁在一起等。 -->
                <div class="tcard-art">
                  <img v-if="cardImage(card)" class="tcard-art-img" :src="cardImage(card)" :alt="card.name">
                  <img v-if="frameImage" class="tcard-art-frame" :src="frameImage" alt="" aria-hidden="true">
                  <div v-if="!cardImage(card)" class="tcard-plain">
                    <div class="tcard-name">{{ card.name }}</div>
                    <div class="tcard-text">{{ card.text }}</div>
                  </div>
                  <!-- 用掉的那張要一眼看得出來，因為這個畫面是拿給對面的人看的，不
                       是給自己記的。所以不是把按鈕變灰就算了，卡面本身要蓋上章。 -->
                  <div v-if="view === 'play' && isUsed(card)" class="tcard-stamp">
                    {{ t('themeCards.usedStamp') }}
                  </div>
                </div>
                <!-- 卡圖進來之後，名稱與效果印在卡上，底下這行就只留名稱當標籤。 -->
                <div v-if="cardImage(card)" class="tcard-caption">{{ card.name }}</div>
              </div>
            </div>
          </div>

          <button
            class="tcard-arrow right"
            :disabled="activeIndex >= slides.length - 1"
            :aria-label="t('themeCards.next')"
            @click="go(activeIndex + 1)"
          >›</button>
        </div>

        <div class="tcard-count">{{ activeIndex + 1 }} / {{ slides.length }}</div>

        <!-- 這一張的動作。固定在同一個位置，所以翻到哪張都是按同一個地方 —— 現場
             不必每翻一張就重新找按鈕。 -->
        <div class="tcard-act">
          <button
            v-if="view === 'pick'"
            class="btn"
            :class="{ secondary: isPicked(activeCard) }"
            :disabled="!isPicked(activeCard) && pickFull"
            @click="toggle(activeCard)"
          >
            {{ isPicked(activeCard)
              ? t('themeCards.unpick', { n: pickOrder(activeCard) })
              : pickFull ? t('themeCards.pickFull', { n: limit }) : t('themeCards.pick') }}
          </button>
          <button
            v-else
            class="btn"
            :class="{ secondary: isUsed(activeCard) }"
            @click="toggleUsed(activeCard)"
          >
            {{ isUsed(activeCard) ? t('themeCards.undoUse') : t('themeCards.markUsed') }}
          </button>
        </div>
      </template>

      <div class="tcard-foot">
        <template v-if="view === 'pick'">
          <button class="btn secondary" @click="view = 'faction'">{{ t('themeCards.changeSide') }}</button>
          <button class="btn" :disabled="picked.length === 0" @click="view = 'play'">
            {{ t('themeCards.confirm', { n: picked.length }) }}
          </button>
        </template>
        <template v-else>
          <button class="btn secondary" @click="view = 'pick'">{{ t('themeCards.repick') }}</button>
          <button class="btn secondary" :disabled="used.length === 0" @click="newMatch">
            {{ t('themeCards.newMatch') }}
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tc-board {
  align-items: center;
  overflow: hidden;
}

.tcard-title { margin: 0.5rem 0 0.25rem; flex-shrink: 0; }

.tcard-limit {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.tcard-limit-label { font-size: 0.6875rem; font-weight: 800; color: var(--ink); }
.tcard-limit-n {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--ink);
  min-width: 1.25rem;
  text-align: center;
}

.tcard-step {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 0.0625rem solid var(--line);
  background: var(--card);
  color: var(--ink);
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.tcard-step:disabled { opacity: 0.35; cursor: default; }

.tcard-hint {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--sub);
  margin: 0.25rem 0 0.375rem;
  text-align: center;
  padding: 0 0.75rem;
  flex-shrink: 0;
}

/* ── 主題列表 ── */
.tcard-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  max-width: 24rem;
  padding: 0 0.75rem 0.375rem;
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

/* 選邊的兩顆鈕比主題列更高，而且平分剩下的高度：這一頁只有一個決定，它該佔滿整
   個畫面，而不是縮在上緣看起來像還有別的東西在底下。 */
.tcard-faction {
  flex: 1 1 0;
  min-height: 4.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1875rem;
  background: var(--card);
  border: 0.125rem solid var(--line);
  border-radius: var(--radius);
  padding: 0.75rem;
  cursor: pointer;
}

.tcard-faction-name { font-size: 1.25rem; font-weight: 800; color: var(--ink); }
.tcard-faction-sub { font-size: 0.6875rem; font-weight: 700; color: var(--sub); }
.tcard-faction-count { font-size: 0.5625rem; font-weight: 800; color: var(--sub); }

.tcard-side {
  font-size: 0.625rem;
  font-weight: 800;
  color: var(--accent-strong);
  background: var(--accent);
  border-radius: 999px;
  padding: 0.0625rem 0.5rem;
  flex-shrink: 0;
}
.tcard-theme-sub { font-size: 0.625rem; font-weight: 700; color: var(--sub); }

.tcard-theme-mark {
  position: absolute;
  top: 0.5rem;
  right: 0.625rem;
  font-size: 0.5625rem;
  font-weight: 800;
  color: var(--accent-strong);
  background: var(--accent);
  border-radius: 999px;
  padding: 0.0625rem 0.375rem;
}

/* ── 左右翻的卡台 ── */
.tcard-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 24rem;
  display: flex;
  align-items: center;
}

/* 一格 = 一個可視區寬。卡本身置中、有自己的上限寬度，所以不必靠左右 padding 把卡
   推到中間 —— 捲動容器的尾端 padding 在部分瀏覽器會被吃掉，最後一張就卡不到中間。 */
.tcard-track {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.tcard-track::-webkit-scrollbar { display: none; }

.tcard-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0;
}

.tcard-arrow {
  flex: 0 0 auto;
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
  z-index: 1;
}

.tcard-arrow:disabled { opacity: 0.25; cursor: default; }

/* ── 卡 ── */
.tcard {
  position: relative;
  /* 高度優先：卡台剩多少就長多高，寬度跟著 63:88 算出來。反過來寫（先定寬）的話，
     螢幕一矮卡就被切掉下緣。 */
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.tcard-art {
  position: relative;
  /* 實體卡 6.3 × 8.8 cm。 */
  aspect-ratio: 63 / 88;
  height: 100%;
  min-height: 0;
  max-width: 100%;
  background: var(--card);
  border: 0.125rem solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.tcard.on .tcard-art {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 0.1875rem var(--accent);
}

.tcard.spent .tcard-art-img,
.tcard.spent .tcard-plain { opacity: 0.4; }

.tcard-art-img,
.tcard-art-frame {
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
  gap: 0.375rem;
  padding: 1rem 0.875rem;
  text-align: center;
}

.tcard-name {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.3;
}

.tcard-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--sub);
  line-height: 1.5;
}

.tcard-caption {
  font-size: 0.6875rem;
  font-weight: 800;
  color: var(--ink);
  flex-shrink: 0;
}

.tcard-order {
  position: absolute;
  top: -0.25rem;
  left: -0.25rem;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--accent-strong);
  color: var(--bg);
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* 蓋在下三分之一，不是正中央。這個畫面是拿給對手看的，而他要看的是「你用掉了哪
   一張」—— 章壓在卡名上的話，看得出有東西被用掉了，卻看不出是什麼。 */
.tcard-stamp {
  position: absolute;
  top: 68%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 0.25rem solid var(--danger);
  color: var(--danger);
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
  font-variant-numeric: tabular-nums;
}

.tcard-act {
  padding-top: 0.5rem;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  min-width: 11rem;
}

.tcard-act .btn { min-width: 11rem; }

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
