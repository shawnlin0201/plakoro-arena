<script setup>
import { useI18n } from 'vue-i18n'
import SelectCard from './SelectCard.vue'

const { t } = useI18n()
</script>

<template>
  <div class="board select-board">
    <div class="player-row select-row">
      <SelectCard player-key="A" />
      <SelectCard player-key="B" />
    </div>
    <div class="select-credit">
      {{ t('select.credit') }} (<a href="https://zukan.pokemon.co.jp" target="_blank" rel="noopener noreferrer">https://zukan.pokemon.co.jp</a>)
    </div>
  </div>
</template>
