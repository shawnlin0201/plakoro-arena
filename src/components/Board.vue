<script setup>
import { inject } from 'vue'
import PlayerCard from './PlayerCard.vue'

const props = defineProps({
  turnMode: { type: Boolean, default: false }
})

const battle = inject('battle')
const state = battle.state
</script>

<template>
  <div class="board" :class="{ 'turn-board': turnMode }">
    <div class="player-row" :class="{ 'turn-row': turnMode }">
      <PlayerCard player-key="A" :turn-class="turnMode ? (state.turnPlayer === 'A' ? 'turn-active' : 'turn-inactive') : ''" />
      <PlayerCard player-key="B" :turn-class="turnMode ? (state.turnPlayer === 'B' ? 'turn-active' : 'turn-inactive') : ''" />
    </div>
  </div>
</template>
