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

function onPick(mid) {
  battle.pickMove(mid)
}
</script>

<template>
  <div class="move-select-panel" :class="{ 'resolve-panel': resolvePhase }" :style="panelStyle">
    <div v-if="!resolvePhase && !isMyTurn" class="move-select-status">{{ t('moveSelect.opponentThinking') }}</div>
    <MovesGrid v-else :player="p" :opponent="opp" :moves-map="moves" :interactive="!resolvePhase" @pick="onPick" />
  </div>
</template>
