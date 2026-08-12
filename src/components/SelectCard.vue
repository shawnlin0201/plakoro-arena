<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { asset } from '../data/assetPath'

const props = defineProps({
  playerKey: { type: String, required: true }
})

const battle = inject('battle')
const { t } = useI18n()
const state = battle.state
const isA = props.playerKey === 'A'
const p = computed(() => state.players[props.playerKey])
const trainerName = computed(() => t(`player.trainer${props.playerKey}`))

function pickChar() {
  battle.openCharSelect(props.playerKey)
}

function reopenMoveSelect() {
  battle.openMoveSelect(props.playerKey, p.value.character)
  state.modal.tempMoves = [...p.value.moveIds]
}

function startFirst() {
  battle.startBattle(props.playerKey)
}
</script>

<template>
  <div class="select-card">
    <div class="select-card-title">{{ trainerName }}</div>
    <div v-if="!p.locked" class="select-box pick-btn" @click="pickChar">
      <div class="null-ball-wrap">
        <img :src="asset('image/ICON/モンスターボールNull.png')" class="ball-icon null-ball" alt="">
        <div class="null-ball-label" v-html="t('select.pickPokemon')"></div>
      </div>
    </div>
    <div v-else class="select-box ball-wrap" @click="reopenMoveSelect">
      <div class="null-ball-wrap">
        <img :src="asset(`image/ICON/モンスターボール${playerKey}.png`)" class="ball-icon wiggle" :class="`wiggle-${playerKey}`" alt="モンスターボール">
        <div class="null-ball-label">{{ t('common.selected') }}</div>
      </div>
    </div>
    <button
      v-if="battle.bothLocked()"
      class="btn wide start-first-btn"
      :style="{ background: isA ? 'var(--trainerA-btn)' : 'var(--trainerB-btn)' }"
      @click="startFirst"
    >{{ t('select.startFirst') }}</button>
  </div>
</template>
