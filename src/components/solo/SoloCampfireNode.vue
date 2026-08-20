<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()
</script>

<template>
  <div class="overlay full">
    <div style="font-size:3rem;">🔥</div>
    <div class="overlay-title">{{ t('solo.campfire.title') }}</div>
    <div class="overlay-sub">{{ t('solo.campfire.description') }}</div>
    <div style="font-size:1rem; font-weight:800; color:#4E9E6C; margin-top:0.5rem;">{{ t('solo.campfire.effect') }}</div>
    <button class="btn" style="margin-top:1rem;" @click="solo.returnToMap()">{{ t('solo.campfire.continue') }}</button>
  </div>
</template>
