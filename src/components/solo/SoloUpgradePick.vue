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
    <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:14px; width:100%; max-width:640px;">
      <div
        v-for="(choice, i) in state.upgradeChoices"
        :key="i"
        class="select-card"
        style="flex:1 1 160px; max-width:220px; cursor:pointer;"
        @click="pick(choice)"
      >
        <div style="font-size:34px;">{{ ICONS[choice.kind] }}</div>
        <div class="select-card-title" style="font-size:15px; text-align:center;">{{ labelFor(choice) }}</div>
      </div>
    </div>
  </div>
</template>
