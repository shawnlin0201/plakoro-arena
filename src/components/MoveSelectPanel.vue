<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../data/constants'
import MovesGrid from './MovesGrid.vue'

const props = defineProps({
  resolvePhase: { type: Boolean, default: false }
})

const battle = inject('battle')
const online = inject('online')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = battle.state

const p = computed(() => state.players[state.turnPlayer])
const opp = computed(() => state.players[battle.opponentKey(state.turnPlayer)])

// Online only: while actually picking (not resolvePhase, which just shows the already-picked
// move to both sides afterward), the opponent only learns that a choice is being made, not
// which moves are on the table.
const isMyTurn = computed(() => !online.myKey.value || online.myKey.value === state.turnPlayer)

const panelStyle = computed(() => ({
  background: typeBgColor(p.value.character.type),
  boxShadow: 'none',
  height: '80%',
  borderRadius: state.turnPlayer === 'A' ? '0 1.125rem 0 0' : '1.125rem 0 0 0'
}))

// What the player has to do themselves before choosing — reroll a die, swap a chip, or hand
// the device over because their move is the opponent's to pick this turn. Shown here rather
// than on the dice screen because this is where their turn starts, and two of the three have
// to happen before a move is chosen at all.
//
// `pickEnemyWaza` is listed alongside the others even though the app enforces that one: the
// enforcement is "the person holding the device picks", and at a table that only works if
// somebody says so.
const notices = computed(() => (p.value.pendingNotices || []).map(n => ({
  key: n.kind,
  text: t(`moveSelect.notice.${n.kind}`, { n: n.n, from: n.from })
})))

function onPick(mid) {
  battle.pickMove(mid)
}
</script>

<template>
  <div class="move-select-panel" :class="{ 'resolve-panel': resolvePhase }" :style="panelStyle">
    <div v-if="!resolvePhase && !isMyTurn" class="move-select-status">{{ t('moveSelect.opponentThinking') }}</div>
    <template v-else>
      <div v-if="!resolvePhase && notices.length" class="ms-notices">
        <div v-for="n in notices" :key="n.key" class="ms-notice">{{ n.text }}</div>
      </div>
      <MovesGrid :player="p" :opponent="opp" :moves-map="moves" :interactive="!resolvePhase" @pick="onPick" />
    </template>
  </div>
</template>

<style scoped>
/* Sits above the moves, in the type colour's own panel, so it reads as part of the turn
   rather than as an error. Wraps instead of truncating: these are instructions. */
.ms-notices {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  padding: 0 0.375rem 0.3125rem;
}
.ms-notice {
  padding: 0.1875rem 0.4375rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.55);
  font-size: 0.5625rem;
  font-weight: 800;
  line-height: 1.35;
  color: #fff;
}
</style>
