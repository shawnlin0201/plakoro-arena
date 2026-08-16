<script setup>
import { provide, inject } from 'vue'
import { useSoloRun } from '../../composables/useSoloRun'
import SoloCharSelect from './SoloCharSelect.vue'
import SoloMap from './SoloMap.vue'
import SoloEventNode from './SoloEventNode.vue'
import SoloCampfireNode from './SoloCampfireNode.vue'
import SoloVictory from './SoloVictory.vue'
import SoloBoard from './SoloBoard.vue'
import SoloMoveSelect from './SoloMoveSelect.vue'
import SoloAiSkip from './SoloAiSkip.vue'
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
  <SoloMap v-else-if="state.phase === 'map'" />
  <SoloEventNode v-else-if="state.phase === 'event'" />
  <SoloCampfireNode v-else-if="state.phase === 'campfire'" />
  <SoloVictory v-else-if="state.phase === 'victory'" />
  <template v-else>
    <SoloBoard />
    <SoloMoveSelect v-if="state.phase === 'moveSelect' && state.turn === 'player'" />
    <SoloAiSkip v-if="state.phase === 'aiSkip'" />
    <SoloDiceSuccess v-if="state.phase === 'diceSuccess'" />
    <SoloEffectPrompt v-if="state.phase === 'effectPrompt'" />
    <SoloUpgradePick v-if="state.phase === 'floorClear'" />
    <SoloLearnMove v-if="state.phase === 'learnMove'" />
    <SoloGameOver v-if="state.phase === 'gameOver'" />
  </template>
</template>
