<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'
import {
  DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT,
  loadState, saveState, themeCardAsset, visibleSets
} from '../data/themeCards'

const emit = defineEmits(['back'])
const { t } = useI18n()

const sets = visibleSets()
const saved = loadState()

const limit = ref(saved.limit || DEFAULT_LIMIT)
// 每一組卡表各記各的。換主題不該把上一組挑好的卡洗掉 —— 兩場不同主題的賽事可能在
// 同一天，而玩家會在兩個畫面之間來回對照。
const bySet = ref(saved.bySet || {})

/* 三層：主題列表 → 卡表（選卡、按確定）→ 出陣（按使用）。
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

watch([limit, activeSetId, bySet], () => {
  saveState({ limit: limit.value, lastSet: activeSetId.value, bySet: bySet.value })
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

const frameImage = computed(() =>
  activeSet.value && activeSet.value.frame ? asset(themeCardAsset(activeSet.value.frame)) : ''
)

/* ── 選卡 ── */

function isPicked(card) {
  return picked.value.includes(card.id)
}

// 選到第幾張。現場講「我第一張出警察」要講得出口，所以卡上標的是順序而不是一個勾。
function pickOrder(card) {
  const i = picked.value.indexOf(card.id)
  return i < 0 ? null : i + 1
}

function toggle(card) {
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

const isUsed = card => used.value.includes(card.id)

function toggleUsed(card) {
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

      <div class="tcard-scroll">
        <div v-if="sets.length === 0" class="tcard-empty">{{ t('themeCards.noSets') }}</div>
        <button v-for="s in sets" :key="s.id" class="tcard-theme" @click="openSet(s)">
          <span class="tcard-theme-name">{{ s.name }}</span>
          <span class="tcard-theme-sub">
            {{ s.tagline || t('themeCards.cardCount', { n: s.cards.length }) }}
          </span>
          <span v-if="slot(s.id).picked.length" class="tcard-theme-mark">
            {{ t('themeCards.pickedMark', { n: slot(s.id).picked.length }) }}
          </span>
        </button>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </template>

    <!-- ── 卡表／選卡 ── -->
    <template v-else-if="view === 'pick'">
      <div class="modal-title tcard-title">{{ activeSet.name }}</div>

      <div class="tcard-limit">
        <span class="tcard-limit-label">{{ t('themeCards.limitLabel') }}</span>
        <button class="tcard-step" :disabled="limit <= MIN_LIMIT" @click="setLimit(limit - 1)">−</button>
        <span class="tcard-limit-n">{{ limit }}</span>
        <button class="tcard-step" :disabled="limit >= MAX_LIMIT" @click="setLimit(limit + 1)">＋</button>
      </div>
      <div class="tcard-hint">{{ t('themeCards.limitHint') }}</div>

      <div class="tcard-scroll grid">
        <div v-if="activeSet.cards.length === 0" class="tcard-empty">{{ t('themeCards.noCards') }}</div>
        <div
          v-for="card in activeSet.cards"
          :key="card.id"
          class="tcard"
          :class="{ on: isPicked(card), muted: !isPicked(card) && picked.length >= limit }"
          role="button"
          tabindex="0"
          @click="toggle(card)"
          @keydown.enter.prevent="toggle(card)"
          @keydown.space.prevent="toggle(card)"
        >
          <span v-if="pickOrder(card)" class="tcard-order">{{ pickOrder(card) }}</span>
          <!-- 卡框疊在卡圖上，兩者都還沒進來時整塊不佔位 —— 卡表要能在美術完成之前
               先排得出來。 -->
          <div v-if="cardImage(card) || frameImage" class="tcard-art">
            <img v-if="cardImage(card)" class="tcard-art-img" :src="cardImage(card)" :alt="card.name">
            <img v-if="frameImage" class="tcard-art-frame" :src="frameImage" alt="" aria-hidden="true">
          </div>
          <div class="tcard-name">{{ card.name }}</div>
          <div class="tcard-text">{{ card.text }}</div>
        </div>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="view = 'themes'">{{ t('common.back') }}</button>
        <button class="btn" :disabled="picked.length === 0" @click="view = 'play'">
          {{ t('themeCards.confirm', { n: picked.length }) }}
        </button>
      </div>
    </template>

    <!-- ── 出陣 ── -->
    <template v-else>
      <div class="modal-title tcard-title">{{ t('themeCards.playTitle') }}</div>
      <div class="tcard-hint">{{ t('themeCards.playHint', { n: remaining }) }}</div>

      <div class="tcard-scroll">
        <div
          v-for="(card, i) in pickedCards"
          :key="card.id"
          class="tcard big"
          :class="{ spent: isUsed(card) }"
        >
          <span class="tcard-order">{{ i + 1 }}</span>
          <!-- 卡面跟按鈕分開包：章蓋的是卡，不是按鈕。兩者放在同一層時章會落在整張
               的正中央，也就是壓在「收回」上面 —— 那顆鈕變得看不清楚，而且看起來
               像是章在說那顆鈕已經用掉了。 -->
          <div class="tcard-body">
            <div v-if="cardImage(card) || frameImage" class="tcard-art">
              <img v-if="cardImage(card)" class="tcard-art-img" :src="cardImage(card)" :alt="card.name">
              <img v-if="frameImage" class="tcard-art-frame" :src="frameImage" alt="" aria-hidden="true">
            </div>
            <div class="tcard-name">{{ card.name }}</div>
            <div class="tcard-text">{{ card.text }}</div>
            <!-- 用掉的那張要一眼看得出來，因為這個畫面是拿給對面的人看的，不是給自
                 己記的。所以不是把按鈕變灰就算了，卡面本身要蓋上章。 -->
            <div v-if="isUsed(card)" class="tcard-stamp">{{ t('themeCards.usedStamp') }}</div>
          </div>
          <button class="btn tcard-use" :class="{ secondary: isUsed(card) }" @click="toggleUsed(card)">
            {{ isUsed(card) ? t('themeCards.undoUse') : t('themeCards.markUsed') }}
          </button>
        </div>
      </div>

      <div class="tcard-foot">
        <button class="btn secondary" @click="view = 'pick'">{{ t('themeCards.repick') }}</button>
        <button class="btn secondary" :disabled="used.length === 0" @click="newMatch">
          {{ t('themeCards.newMatch') }}
        </button>
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

/* 列表自己捲，上面的標題與張數跟下面的按鈕都留在原地 —— 現場要改張數時不必先把列
   表捲回最上面。 */
.tcard-scroll {
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

/* 卡表兩欄。一欄的話一張卡佔滿整個寬度，十張卡要捲很久才看得完一輪；兩欄剛好讓一
   組卡表在一個畫面裡比較得完。 */
.tcard-scroll.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 0.5rem;
}

.tcard-scroll.grid .tcard-empty { grid-column: 1 / -1; }

/* ── 主題列表 ── */
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

/* ── 卡 ── */
.tcard {
  position: relative;
  background: var(--card);
  border: 0.125rem solid var(--line);
  border-radius: var(--radius);
  padding: 0.5rem 0.625rem;
  text-align: left;
  cursor: pointer;
  flex-shrink: 0;
}

.tcard.big { cursor: default; }

.tcard.on {
  border-color: var(--accent-strong);
  background: var(--accent);
}

/* 選滿之後，沒選到的卡退到背景去。做成 disabled 的話點下去完全沒反應，玩家會以為
   卡壞了；這樣是看得出來「不是不能點，是你已經選滿了」。 */
.tcard.muted { opacity: 0.45; }

/* 淡掉的是卡面，不包含底下那顆鈕 —— 收回是用掉之後唯一還要按得到的東西。 */
.tcard.spent .tcard-art,
.tcard.spent .tcard-name,
.tcard.spent .tcard-text { opacity: 0.4; }

.tcard-body { position: relative; }

/* 卡框與卡圖都是同一個方框，疊在一起。框是上層，所以框的透明區域才是圖露出來的地
   方 —— 等美術進來時不必改這裡，換檔案就好。 */
.tcard-art {
  position: relative;
  width: 100%;
  aspect-ratio: 5 / 7;
  margin-bottom: 0.375rem;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tcard-art-img,
.tcard-art-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tcard-order {
  position: absolute;
  top: -0.375rem;
  left: -0.375rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  background: var(--accent-strong);
  color: var(--bg);
  font-size: 0.625rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.tcard-name {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--ink);
}

.tcard-text {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--sub);
  margin-top: 0.125rem;
  line-height: 1.4;
}

.tcard-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  border: 0.1875rem solid var(--danger);
  color: var(--danger);
  border-radius: 0.375rem;
  padding: 0.125rem 0.75rem;
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: 0.125rem;
  pointer-events: none;
}

.tcard-use { margin-top: 0.5rem; width: 100%; }

.tcard-empty {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--sub);
  padding: 1.5rem 0.75rem;
  text-align: center;
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
