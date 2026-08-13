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
    <div class="overlay-sub" style="max-width:420px; font-size:15px; line-height:1.7;">{{ text }}</div>
    <div style="font-size:16px; font-weight:800; color:#4E9E6C; margin-top:8px;">{{ effectText }}</div>
    <button class="btn" style="margin-top:16px;" @click="solo.returnToMap()">{{ t('solo.event.continue') }}</button>
  </div>
</template>
