<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()
const state = solo.state

function restart() {
  solo.resetRun()
}
</script>

<template>
  <div class="overlay full">
    <div class="overlay-title">{{ t('solo.gameOver.title') }}</div>
    <div class="overlay-sub">{{ t('solo.gameOver.floorReached', { floor: state.gameOver ? state.gameOver.floor : 1 }) }}</div>
    <button class="btn" style="margin-top:14px;" @click="restart">{{ t('solo.gameOver.retry') }}</button>
  </div>
</template>
