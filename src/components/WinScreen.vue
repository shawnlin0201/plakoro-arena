<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'

const battle = inject('battle')
const { t } = useI18n()
const state = battle.state
const winner = computed(() => state.players[state.winner])
const winnerName = computed(() => t(`player.trainer${state.winner}`))
const picSrc = computed(() => winner.value.character.imageUrl || asset(`image/CHARA/${winner.value.character.name}.png`))
</script>

<template>
  <div class="win-screen" :style="{ backgroundImage: `url('${asset(`image/BACK/back_${winner.character.type}.png`)}')` }">
    <div class="win-mon-big"><img :src="picSrc" :alt="winner.character.name"></div>
    <div class="win-text-col">
      <div class="win-title">{{ winnerName }}<span class="hl">{{ t('win.victorySuffix') }}</span></div>
      <button class="win-again-btn" @click="battle.resetGame()">{{ t('win.playAgain') }}</button>
    </div>
  </div>
</template>
