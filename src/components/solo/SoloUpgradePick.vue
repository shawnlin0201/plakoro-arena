<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

const solo = inject('solo')
const { t } = useI18n()
const state = solo.state

const ICONS = { hp: '❤️', atk: '⚔️', def: '🛡️' }

function labelFor(choice) {
  if (choice.kind === 'hp') return t('solo.upgrade.hp', { amount: choice.amount })
  if (choice.kind === 'atk') return t('solo.upgrade.atk', { amount: choice.amount })
  if (choice.kind === 'def') return t('solo.upgrade.def', { amount: choice.amount })
  return ''
}

function pick(choice) {
  solo.applyLevelUpChoice(choice)
}
</script>

<template>
  <div class="overlay full">
    <div class="overlay-title">{{ t('solo.upgrade.title', { level: state.player.level }) }}</div>
    <div style="display:flex; gap:0.875rem; flex-wrap:wrap; justify-content:center; margin-top:0.875rem; width:100%; max-width:40rem;">
      <div
        v-for="(choice, i) in state.upgradeChoices"
        :key="i"
        class="select-card"
        style="flex:1 1 10rem; max-width:13.75rem; cursor:pointer;"
        @click="pick(choice)"
      >
        <div style="font-size:2.125rem;">{{ ICONS[choice.kind] }}</div>
        <div class="select-card-title" style="font-size:0.9375rem; text-align:center;">{{ labelFor(choice) }}</div>
      </div>
    </div>
  </div>
</template>
