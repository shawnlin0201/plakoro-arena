<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()

function skip() {
  solo.skipAiTurn()
}
</script>

<template>
  <div class="overlay full">
    <div class="overlay-title">{{ t('solo.aiSkip.title') }}</div>
    <div class="overlay-sub">{{ t('solo.aiSkip.desc') }}</div>
    <button class="btn" style="margin-top:1rem;" @click="skip">{{ t('solo.aiSkip.button') }}</button>
  </div>
</template>
