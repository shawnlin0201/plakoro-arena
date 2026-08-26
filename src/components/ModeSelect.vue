<script setup>
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['pick'])
const { t } = useI18n()
</script>

<template>
  <div class="board select-board" style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
    <div class="player-row select-row" style="flex-direction:column; width:100%; max-width:20rem; flex:1; min-height:0; gap:0.5rem;">
      <div class="select-card" style="cursor:pointer; padding:0.5rem; gap:0.25rem;" @click="emit('pick', 'duel')">
        <div class="select-card-title" style="font-size:0.8125rem;">{{ t('mode.duel') }}</div>
        <div class="select-box" style="font-size:1.375rem;">⚔️</div>
      </div>
      <div class="select-card" style="cursor:pointer; padding:0.5rem; gap:0.25rem;" @click="emit('pick', 'solo')">
        <div class="select-card-title" style="font-size:0.8125rem;">{{ t('mode.solo') }}</div>
        <div class="select-box" style="font-size:1.375rem;">🗼</div>
      </div>
      <div class="select-card" style="cursor:pointer; padding:0.5rem; gap:0.25rem;" @click="emit('pick', 'diceBuilder')">
        <div class="select-card-title" style="font-size:0.8125rem;">{{ t('mode.diceBuilder') }}</div>
        <div class="select-box" style="font-size:1.375rem;">🎲</div>
      </div>
      <div class="select-card" style="cursor:pointer; padding:0.5rem; gap:0.25rem;" @click="emit('pick', 'storeInfo')">
        <div class="select-card-title" style="font-size:0.8125rem;">{{ t('mode.storeInfo') }}</div>
        <div class="select-box" style="font-size:1.375rem;">🗺️</div>
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
