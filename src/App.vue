<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterData } from './composables/useCharacterData'
import { useBattleState } from './composables/useBattleState'
import { useStageLayout } from './composables/useStageLayout'
import Board from './components/Board.vue'
import SelectBoard from './components/SelectBoard.vue'
import MoveSelectPanel from './components/MoveSelectPanel.vue'
import DiceOverlay from './components/DiceOverlay.vue'
import EffectPromptOverlay from './components/EffectPromptOverlay.vue'
import WinScreen from './components/WinScreen.vue'
import Modal from './components/Modal.vue'
import TurnCutIn from './components/TurnCutIn.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import ModeSelect from './components/ModeSelect.vue'
import SoloApp from './components/solo/SoloApp.vue'
import DiceBuilderApp from './components/dice/DiceBuilderApp.vue'
import StoreInfoApp from './components/StoreInfoApp.vue'

const { t } = useI18n()
const characterData = useCharacterData()
const battle = useBattleState(characterData.moves)
provide('battle', battle)
provide('characterData', characterData)

const state = battle.state
const { isLoading, loadError } = characterData

const mode = ref(null)
const appVersion = __APP_VERSION__

const stageRef = ref(null)
useStageLayout(stageRef)

const inBattleBoard = computed(() => ['moveSelect', 'diceRoll', 'resolve', 'effectPrompt'].includes(state.phase))

watch(() => t('appTitle'), (title) => {
  document.title = title
}, { immediate: true })

onMounted(() => {
  characterData.loadData()
})
</script>

<template>
  <div id="stage" ref="stageRef">
    <div id="app">
      <LanguageSwitcher />
      <div style="position:absolute; right:0.375rem; bottom:0.25rem; z-index:300; font-size:0.625rem; font-weight:700; color:rgba(58,58,58,.5); pointer-events:none;">v{{ appVersion }}</div>

      <div v-if="isLoading" style="display:flex; height:100%; align-items:center; justify-content:center; font-weight:800; font-size:1rem; color:var(--sub);">{{ t('app.loading') }}</div>

      <div v-else-if="loadError" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:0.875rem; padding:1.5rem; text-align:center;">
        <div style="font-weight:800; font-size:0.875rem; color:var(--ink); line-height:1.6;">{{ t('app.loadErrorTitle') }}</div>
        <div style="font-size:0.75rem; color:var(--sub); max-width:20rem; line-height:1.6;">{{ loadError }}</div>
        <button class="btn" @click="characterData.loadData()">{{ t('app.retry') }}</button>
      </div>

      <ModeSelect v-else-if="mode === null" @pick="mode = $event" />

      <template v-else-if="mode === 'duel'">
        <SelectBoard v-if="state.phase === 'select'" />
        <Board v-else :turn-mode="inBattleBoard" />

        <MoveSelectPanel v-if="state.phase === 'moveSelect'" />
        <DiceOverlay v-if="state.phase === 'diceRoll'" />
        <MoveSelectPanel v-if="state.phase === 'resolve' || state.phase === 'effectPrompt'" resolve-phase />
        <EffectPromptOverlay v-if="state.phase === 'effectPrompt'" />
        <WinScreen v-if="state.phase === 'win'" />
        <Modal v-if="state.modal" />
        <TurnCutIn v-if="state.turnCutIn" />
      </template>

      <DiceBuilderApp v-else-if="mode === 'diceBuilder'" @back="mode = null" />

      <StoreInfoApp v-else-if="mode === 'storeInfo'" @back="mode = null" />

      <SoloApp v-else />
    </div>
  </div>
</template>
