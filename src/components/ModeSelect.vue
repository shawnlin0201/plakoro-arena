<script setup>
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['pick'])
const { t } = useI18n()
</script>

<template>
  <div class="board select-board" style="align-items:center; justify-content:center; display:flex;">
    <div class="player-row select-row" style="flex-direction:column; width:100%; max-width:320px;">
      <div class="select-card" style="cursor:pointer;" @click="emit('pick', 'duel')">
        <div class="select-card-title">{{ t('mode.duel') }}</div>
        <div class="select-box" style="font-size:34px;">⚔️</div>
      </div>
      <div class="select-card" style="cursor:pointer;" @click="emit('pick', 'solo')">
        <div class="select-card-title">{{ t('mode.solo') }}</div>
        <div class="select-box" style="font-size:34px;">🗼</div>
      </div>
    </div>
  </div>
</template>
