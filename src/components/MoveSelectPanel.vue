<script setup>
import { computed, inject } from 'vue'
import { typeBgColor } from '../data/constants'
import MovesGrid from './MovesGrid.vue'

const props = defineProps({
  resolvePhase: { type: Boolean, default: false }
})

const battle = inject('battle')
const { moves } = inject('characterData')
const state = battle.state

const p = computed(() => state.players[state.turnPlayer])
const opp = computed(() => state.players[battle.opponentKey(state.turnPlayer)])

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
    <MovesGrid :player="p" :opponent="opp" :moves-map="moves" :interactive="!resolvePhase" @pick="onPick" />
  </div>
</template>
