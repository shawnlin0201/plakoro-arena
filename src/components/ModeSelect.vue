<script setup>
import { useI18n } from 'vue-i18n'

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['pick'])
const { t } = useI18n()

// Adding a mode should never mean re-tuning the layout, so the grid is driven off this list
// rather than hand-written cards.
//
// `enabled: false` hides a mode from the menu while leaving it fully built and reachable in
// code. Deleting the entry instead would leave its component, i18n strings and data loader with
// no visible caller, which is how features quietly rot — this way re-enabling is one word.
const MODES = [
  { key: 'duel' },
  { key: 'solo' },
  { key: 'diceBuilder' },
  { key: 'storeInfo' },
  // Hidden 2026-08-28: the market data behind it isn't maintainable by hand yet — most listing
  // sources need a login to snapshot, so the figures would go stale without anyone noticing.
  { key: 'priceLog', enabled: false },
  { key: 'tierList' },
  { key: 'typeChart' },
  // A link out, not a mode. `url` is what tells the menu to render an anchor instead of a
  // button — the card looks the same either way, but one changes screen and one leaves.
  { key: 'line', url: 'https://line.me/ti/g2/nX4Wb5UHJR9vy573jqGe_Q_q2Rd6JsruabTKVw' },
  // `group` moves a mode one level down. The top level is what a player opens the app to do;
  // these three are things an organiser or a theorycrafter comes looking for, and keeping them
  // up front pushed the front page past the point where every card still fit.
  { key: 'tournament', group: 'tools' },
  { key: 'tierMaker', group: 'tools' },
  { key: 'traitChart', group: 'tools' }
]

const GROUPS = [{ key: 'tools' }]

const openGroup = ref(null)

const topLevel = computed(() => [
  ...MODES.filter(m => m.enabled !== false && !m.group),
  ...GROUPS.map(g => ({ ...g, isGroup: true }))
])

const groupModes = computed(() =>
  MODES.filter(m => m.enabled !== false && m.group === openGroup.value))

const cards = computed(() => (openGroup.value ? groupModes.value : topLevel.value))

function pick(card) {
  if (card.isGroup) openGroup.value = card.key
  else emit('pick', card.key)
}

function label(card) {
  return card.isGroup ? t('mode.group.' + card.key) : t('mode.' + card.key)
}

// The cards, split into rows here rather than left to wrap.
//
// Wrapping decides which card lands on which line, but gives the lines no way to share the
// height they have: a wrapped line is as tall as its contents, so each mode added pushed the
// last line further past the bottom of the stage — at nine it was clipped. Real rows can each
// take `flex: 1` and divide the box between them, so the cards shrink instead.
const COLUMNS = 3

// --- notice ticker ---
//
// How many copies of the message the track carries.
//
// Two is not always enough. The track slides left by exactly one copy's width and then jumps
// back, which is seamless only while the copies that remain still cover the full width of the
// band. With the Chinese message the copy came out 17px narrower than the band, so for one
// frame at the loop point a sliver of empty track showed — the flicker. A shorter message, or
// a wider stage, makes that sliver bigger.
//
// So it is measured rather than guessed: enough copies to cover the band, plus one to slide
// away. Re-measured on resize, since this app scales its whole type scale with the stage.
const tickerEl = ref(null)
const tickerCopies = ref(2)

function measureTicker() {
  const el = tickerEl.value
  if (!el) return
  const first = el.querySelector('.mt-text')
  if (!first) return
  const copyW = first.getBoundingClientRect().width
  const bandW = el.getBoundingClientRect().width
  if (!copyW || !bandW) return
  tickerCopies.value = Math.max(2, Math.ceil(bandW / copyW) + 1)
}

onMounted(() => {
  measureTicker()
  window.addEventListener('resize', measureTicker)
})
onBeforeUnmount(() => window.removeEventListener('resize', measureTicker))

// The track is `copies` wide; sliding by one copy is 100/copies percent of it.
const tickerShift = computed(() => `-${(100 / tickerCopies.value).toFixed(4)}%`)

const rows = computed(() => {
  const out = []
  for (let i = 0; i < cards.value.length; i += COLUMNS) {
    out.push(cards.value.slice(i, i + COLUMNS))
  }
  return out
})
</script>

<template>
  <div class="board select-board mode-select">
    <h1 class="mode-wordmark">PLAKORO ARENA</h1>

    <!-- A bounded box with real rows inside it, rather than cards left to wrap. The box's
         height is whatever the stage leaves; the rows divide it between them, so adding a mode
         makes every card a little shorter instead of pushing the last row off the bottom. -->
    <div class="mode-grid">
      <div v-for="(row, i) in rows" :key="i" class="mode-row">
        <component
          :is="c.url ? 'a' : 'button'"
          v-for="c in row"
          :key="c.key"
          class="select-card mode-card"
          :href="c.url"
          :target="c.url ? '_blank' : undefined"
          :rel="c.url ? 'noopener noreferrer' : undefined"
          @click="c.url ? undefined : pick(c)"
        >
          <span class="select-card-title mode-card-title">{{ label(c) }}</span>
        </component>
      </div>
    </div>

    <div v-if="openGroup" class="mode-back">
      <button class="btn secondary" @click="openGroup = null">{{ t('common.back') }}</button>
    </div>

    <!-- Announcements. The track holds as many copies as it takes to stay covered, and slides
         by exactly one of them, so at the loop point a copy is standing where the one before it
         started and the seam never shows. -->
    <div ref="tickerEl" class="mode-ticker" aria-live="off">
      <div class="mt-track" :style="{ '--shift': tickerShift }">
        <span
          v-for="i in tickerCopies"
          :key="i"
          class="mt-text"
          :aria-hidden="i > 1 ? 'true' : undefined"
        >{{ t('notice.meetup2') }}</span>
      </div>
    </div>

    <!-- Attribution sits on the mode select rather than inside each mode: it's the one screen
         every player passes through, and the play screens have no spare room for it. -->
    <div class="select-credit">
      <div>{{ t('credit.sources') }}</div>
      <div>{{ t('credit.rights') }}</div>
    </div>
  </div>
</template>

<style scoped>
.mode-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* The title screen's title. Sits outside the bounded box and takes a fixed share, so the rows
   below divide whatever is left rather than being pushed off the bottom by it.
   
   Set large enough to read as the screen's title rather than a heading over a list. */
.mode-wordmark {
  flex-shrink: 0;
  margin: 0;
  padding: 1.75rem 0 0.75rem;
  /* rem, not vw: the app already scales its root font with the stage, so a viewport unit
     here would drift out of step with everything around it. */
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  /* The tracking adds a trailing gap after the last letter; pulling it back keeps the mark
     optically centred. */
  text-indent: 0.1em;
  line-height: 1;
  color: var(--ink);
  text-align: center;
  white-space: nowrap;
}

/* The bounded box. Takes what the stage leaves, and never more. */
.mode-grid {
  --gap: 0.625rem;
  /* Must stay `flex: 1`. The rows inside are `flex: 1 1 0`, which divides a definite height —
     sizing this box to its content instead leaves them nothing to divide, which is what broke
     the menu. The menu is kept subordinate to the title by capping the rows, not this box. */
  flex: 1;
  /* Without this the box refuses to shrink below its content and overflows the stage — the
     same flex default (min-height:auto) that broke the single-column version. */
  min-height: 0;
  width: 100%;
  max-width: 23rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--gap);
  padding: 0.25rem 0;
}

/* One row. `flex: 1 1 0` with `min-height: 0` is what lets the rows share the box instead of
   each insisting on its content's height — the whole reason the ninth card used to overflow. */
/* Rows share whatever the box has. The cap is what keeps the menu subordinate to the title:
   with only a few cards they would otherwise stretch to fill the screen again. */
.mode-row {
  flex: 1 1 0;
  min-height: 0;
  max-height: 3.25rem;
  display: flex;
  gap: var(--gap);
}

.mode-card {
  /* Half the row, and capped there so a lone card on the last row doesn't stretch across. */
  flex: 1 1 0;
  /* A third of the row, so a last row holding one or two cards keeps them the same width
     as the full rows above rather than spreading them across. */
  max-width: calc((100% - var(--gap) * 2) / 3);
  min-width: 0;
  min-height: 0;
  /* Overridden rather than changing .select-card or --radius: those are shared with every
     other picker in the app, and only this menu's cards got smaller. */
  border-radius: 0.5rem;
  /* Stronger than the global --shadow. That one is tuned for large cards, where a wide soft
     spread reads as depth; at this size it spreads further than the card itself and vanishes.
     A tighter, darker drop keeps the cards sitting on the board. */
  box-shadow: 0 0.125rem 0.375rem rgba(60, 60, 50, 0.16);
  transition: box-shadow 0.12s, transform 0.1s;
  /* The label is the whole card, so it takes the middle. */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.1875rem 0.375rem;
  overflow: hidden;
  cursor: pointer;
  border: none;
  font-family: inherit;
}
/* The link cards are anchors, which bring their own underline and colour. */
.mode-card { text-decoration: none; color: inherit; }
.mode-card:hover { box-shadow: 0 0.1875rem 0.5rem rgba(60, 60, 50, 0.22); }
.mode-card:active { transform: scale(.97); box-shadow: 0 0.0625rem 0.1875rem rgba(60, 60, 50, 0.2); }

.mode-back { flex-shrink: 0; padding-top: 0.875rem; }

.mode-ticker {
  flex-shrink: 0;
  width: 100%;
  margin-top: 0.625rem;
  padding: 0.3125rem 0;
  overflow: hidden;
  background: #1F1F1D;
  /* Full-bleed: the board has side padding, and a band that stops short of the edges reads as
     a box rather than as a ticker running across the screen. */
  margin-left: -0.625rem;
  margin-right: -0.625rem;
  width: calc(100% + 1.25rem);
}

.mt-track {
  display: flex;
  width: max-content;
  animation: mt-scroll 22s linear infinite;
}

.mt-text {
  /* The gap belongs to the text, not the track — a flex gap would be halved at the seam. */
  padding-right: 3rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}

@keyframes mt-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(var(--shift)); }
}

/* Motion that never stops is the kind people ask to be rid of. Held still and centred, the
   message still reads — it just stops moving. */
@media (prefers-reduced-motion: reduce) {
  .mt-track { animation: none; justify-content: center; width: 100%; }
  .mt-text { padding-right: 0; }
  .mt-text:not(:first-child) { display: none; }
}

/* The global .btn is sized for screens whose controls are the main event. Here it sits under
   a menu of 0.875rem labels, and at 1rem/800 in full ink it read as the heaviest thing on the
   screen — which is what kept looking "too dark" while the fill was already almost white. */
.mode-back .btn {
  padding: 0.4375rem 1.125rem;
  font-size: 0.8125rem;
  font-weight: 700;
  /* Colour comes from .btn.secondary; only the size is this menu's business. */
  box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.18);
}

/* Two lines allowed before it truncates — "Character strength ranking" does not fit on one
   at any size the card can afford, and clipping a mode's name is worse than wrapping it. */
.mode-card-title {
  max-width: 100%;
  font-size: 0.875rem;
  line-height: 1.25;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

</style>
