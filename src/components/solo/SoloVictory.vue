<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()

function restart() {
  solo.resetRun()
}
</script>

<template>
  <div class="overlay full">
    <div style="font-size:3rem;">🏆</div>
    <div class="overlay-title">{{ t('solo.victory.title') }}</div>
    <div class="overlay-sub">{{ t('solo.victory.subtitle') }}</div>
    <button class="btn" style="margin-top:1rem;" @click="restart">{{ t('solo.victory.playAgain') }}</button>
  </div>
</template>
