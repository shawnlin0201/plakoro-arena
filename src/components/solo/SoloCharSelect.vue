<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../../data/constants'
import MoveCard from '../MoveCard.vue'
import { asset } from '../../data/assetPath'

const solo = inject('solo')
const { characters, moves } = inject('characterData')
const { t } = useI18n()
const state = solo.state

const affordableMoveIds = computed(() => {
  if (!state.charSelectTemp) return []
  return solo.startingAffordableMoveIds(state.charSelectTemp.character)
})

function pickCharacter(c) {
  solo.selectCharacter(c)
}
function pickMove(mid) {
  solo.toggleStartingMove(mid)
}
function back() {
  state.charSelectTemp = null
}
</script>

<template>
  <div class="board select-board" style="overflow-y:auto;">
    <template v-if="!state.charSelectTemp">
      <div class="modal-title" style="margin:0.5rem 0 0.625rem;">{{ t('solo.charSelect.title') }}</div>
      <div class="grid-2">
        <div v-for="c in characters" :key="c.id" class="pick-card" @click="pickCharacter(c)">
          <div class="pick-top" :style="{ background: typeBgColor(c.type) }">
            <div class="pick-type-icon"><img :src="asset(`image/ICON/${c.type}.png`)" class="img-icon" :alt="c.type"></div>
            <div class="ic"><img :src="c.imageUrl || asset(`image/CHARA/${c.name}.png`)" class="img-icon" :alt="c.name"></div>
          </div>
          <div class="pick-bottom">
            <div class="nm-row"><span class="nm">{{ c.name }}</span></div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="modal-title" style="margin:0.5rem 0 0.625rem;">{{ t('solo.charSelect.pickMove', { name: state.charSelectTemp.character.name }) }}</div>
      <div class="pick-count">{{ state.charSelectTemp.moveIds.length }} / 2</div>
      <div class="move-pick-list" style="padding:0 0.625rem;">
        <MoveCard
          v-for="mid in affordableMoveIds"
          :key="mid"
          :mv="moves[mid]"
          :selected="state.charSelectTemp.moveIds.includes(mid)"
          :order="state.charSelectTemp.moveIds.includes(mid) ? state.charSelectTemp.moveIds.indexOf(mid) + 1 : null"
          :disabled="!state.charSelectTemp.moveIds.includes(mid) && state.charSelectTemp.moveIds.length >= 2"
          @pick="pickMove"
        />
      </div>
      <div style="display:flex; gap:0.625rem; padding:0.875rem 0.625rem;">
        <button class="btn secondary" @click="back">{{ t('common.back') }}</button>
        <button class="btn wide" :disabled="state.charSelectTemp.moveIds.length !== 2" :style="{ opacity: state.charSelectTemp.moveIds.length === 2 ? 1 : 0.4 }" @click="solo.confirmStartingSetup()">{{ t('solo.charSelect.confirm') }}</button>
      </div>
    </template>
  </div>
</template>
