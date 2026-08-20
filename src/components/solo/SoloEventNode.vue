<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()
const state = solo.state

const ev = computed(() => state.currentEvent)
const text = computed(() => t(`solo.events.${ev.value.id}.text`, { name: ev.value.characterName }))
const effectText = computed(() => t(`solo.events.${ev.value.id}.effect`))
</script>

<template>
  <div class="overlay full">
    <div class="overlay-title">{{ t('solo.event.title') }}</div>
    <div class="overlay-sub" style="max-width:26.25rem; font-size:0.9375rem; line-height:1.7;">{{ text }}</div>
    <div style="font-size:1rem; font-weight:800; color:#4E9E6C; margin-top:0.5rem;">{{ effectText }}</div>
    <button class="btn" style="margin-top:1rem;" @click="solo.returnToMap()">{{ t('solo.event.continue') }}</button>
  </div>
</template>
