<script setup>
import { computed, inject, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import MoveCard from './MoveCard.vue'
import { loadMoveHistory } from '../data/moveHistory'

const battle = inject('battle')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = battle.state

const orderedMoveIds = computed(() => {
  const tempChar = state.modal.tempChar
  const hist = loadMoveHistory()
  const saved = hist[tempChar.id]
  const historySet = (Array.isArray(saved) && saved.length === 4 && saved.every(mid => tempChar.moves.includes(mid)))
    ? new Set(saved)
    : null
  return historySet ? [...saved, ...tempChar.moves.filter(mid => !historySet.has(mid))] : tempChar.moves
})

function orderOf(mid) {
  const i = state.modal.tempMoves.indexOf(mid)
  return i === -1 ? null : i + 1
}

function pick(mid) {
  battle.toggleMoveInModal(mid)
}

watch(() => state.modal && state.modal.tempMoves.length, async (len) => {
  if (len === 4) {
    await nextTick()
    const sheet = document.querySelector('.modal-sheet')
    if (sheet) sheet.scrollTo({ top: sheet.scrollHeight, behavior: 'smooth' })
  }
})
</script>

<template>
  <div class="modal-title">{{ t('moveSelect.title', { name: state.modal.tempChar.name }) }}</div>
  <div class="move-pick-list">
    <MoveCard
      v-for="mid in orderedMoveIds"
      :key="mid"
      :mv="moves[mid]"
      :selected="state.modal.tempMoves.includes(mid)"
      :order="orderOf(mid)"
      :disabled="!state.modal.tempMoves.includes(mid) && state.modal.tempMoves.length >= 4"
      @pick="pick"
    />
  </div>
  <button
    class="btn wide"
    :disabled="state.modal.tempMoves.length !== 4"
    :style="{
      opacity: state.modal.tempMoves.length !== 4 ? 0.4 : 1,
      background: '#AEFF3E',
      color: '#2A2A2A',
      boxShadow: '0 3px 10px rgba(174,255,62,.4)',
      padding: '24px 20px',
      marginTop: '10px',
      fontSize: '18px',
      fontFamily: `'CorporateLogoBold','Hiragino Sans','Noto Sans JP',sans-serif`
    }"
    @click="battle.confirmCharacterMoves()"
  >{{ t('moveSelect.confirm') }}</button>
</template>
