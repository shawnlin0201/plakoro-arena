<script setup>
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import MoveCard from '../MoveCard.vue'

const solo = inject('solo')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = solo.state

function pick(mid) {
  solo.learnBonusMove(mid)
}
</script>

<template>
  <div class="overlay full">
    <div class="overlay-title">{{ t('solo.boss.reward') }}</div>
    <div class="move-pick-list" style="width:100%; max-width:32.5rem; margin-top:0.625rem;">
      <MoveCard
        v-for="mid in state.learnMoveChoices"
        :key="mid"
        :mv="moves[mid]"
        @pick="pick"
      />
    </div>
  </div>
</template>
