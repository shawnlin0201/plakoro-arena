<script setup>
import { provide, inject } from 'vue'
import { useSoloRun } from '../../composables/useSoloRun'
import SoloCharSelect from './SoloCharSelect.vue'
import SoloBoard from './SoloBoard.vue'
import SoloMoveSelect from './SoloMoveSelect.vue'
import SoloDiceSuccess from './SoloDiceSuccess.vue'
import SoloEffectPrompt from './SoloEffectPrompt.vue'
import SoloUpgradePick from './SoloUpgradePick.vue'
import SoloLearnMove from './SoloLearnMove.vue'
import SoloGameOver from './SoloGameOver.vue'

const { characters, moves } = inject('characterData')
const solo = useSoloRun(characters, moves)
provide('solo', solo)

const state = solo.state
</script>

<template>
  <SoloCharSelect v-if="state.phase === 'charSelect'" />
  <template v-else>
    <SoloBoard />
    <SoloMoveSelect v-if="state.phase === 'moveSelect' && state.turn === 'player'" />
    <SoloDiceSuccess v-if="state.phase === 'diceSuccess'" />
    <SoloEffectPrompt v-if="state.phase === 'effectPrompt'" />
    <SoloUpgradePick v-if="state.phase === 'floorClear'" />
    <SoloLearnMove v-if="state.phase === 'learnMove'" />
    <SoloGameOver v-if="state.phase === 'gameOver'" />
  </template>
</template>
