<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor, CARD_BOTTOM_DARK } from '../data/constants'

const props = defineProps({
  playerKey: { type: String, required: true },
  turnClass: { type: String, default: '' } // '', 'turn-active', 'turn-inactive'
})

const battle = inject('battle')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = battle.state

const p = computed(() => state.players[props.playerKey])
const trainerName = computed(() => t(`player.trainer${props.playerKey}`))
const inBattlePhase = computed(() => ['moveSelect', 'diceRoll', 'resolve'].includes(state.phase))
const isActiveTurn = computed(() => state.turnPlayer === props.playerKey && inBattlePhase.value)
const showAsSelected = computed(() => p.value.locked && state.revealed)

const row1Background = computed(() => {
  if (!showAsSelected.value) return 'var(--card)'
  if (!inBattlePhase.value) return typeBgColor(p.value.character.type)
  return isActiveTurn.value ? typeBgColor(p.value.character.type) : '#FFFFFF'
})

const charPicSrc = computed(() => {
  const c = p.value.character
  if (!c) return ''
  return c.imageUrl || `/image/CHARA/${c.name}.png`
})

const incomingDamageText = computed(() => {
  if (!showAsSelected.value || !p.value.incomingDamageMod) return ''
  const sign = p.value.incomingDamageMod > 0 ? '+' : ''
  return t('player.incomingDamageEffect', { sign, value: p.value.incomingDamageMod })
})

function onTap() {
  battle.onCardTap(props.playerKey)
}
</script>

<template>
  <div class="player-card" :class="[turnClass, { 'active-turn': isActiveTurn }]" :id="'card-' + playerKey">
    <div class="pc-row1" :style="{ background: row1Background }">
      <div class="pc-icon-col">
        <div v-if="!showAsSelected" class="mon-slot null-slot" @click="onTap">{{ t('player.notSelected') }}</div>
        <div v-else class="mon-slot" :class="p.attackAnim" @click="onTap">
          <img :src="charPicSrc" class="img-icon" :class="{ 'hit-blink': p.hitBlink, 'frame-out': p.frameOut }" :alt="p.character.name">
          <div v-if="p.dmgOverlay" class="dmg-overlay-num" :class="{ heal: p.dmgOverlay.heal }">{{ p.dmgOverlay.text }}</div>
        </div>
      </div>
      <div class="pc-info-col">
        <div class="pc-status">{{ incomingDamageText }}</div>
        <div class="pc-name-hp">
          <div class="pc-name-wrap">
            <div v-if="showAsSelected" class="pc-type-icon"><img :src="`/image/ICON/${p.character.type}.png`" class="img-icon" :alt="p.character.type"></div>
            <div class="pc-name">{{ showAsSelected ? p.character.name : trainerName }}</div>
            <div v-if="showAsSelected" class="wk-inline">
              <span>{{ t('common.weaknessColon') }}</span>
              <div class="tw-icon"><img :src="`/image/ICON/${p.character.weakness}.png`" class="img-icon" :alt="p.character.weakness"></div>
            </div>
          </div>
          <div class="pc-hp-num" :class="showAsSelected ? battle.hpBarClass(p) : ''">{{ showAsSelected ? Math.max(0, p.hp) : '' }}</div>
        </div>
        <div class="pc-weak-hpbar">
          <div class="pc-weak">{{ showAsSelected ? 'HP' : (p.locked ? t('common.selected') : '') }}</div>
          <div class="pc-hpbar-wrap">
            <div class="hp-bar-bg">
              <div
                class="hp-bar-fill"
                :class="showAsSelected ? battle.hpBarClass(p) : ''"
                :style="{ width: (showAsSelected ? Math.max(0, p.hp / p.maxHp * 100) : 0) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="pc-row2" :class="{ revealed: showAsSelected }" :style="{ background: showAsSelected ? CARD_BOTTOM_DARK : 'var(--card)' }">
      <div class="moves-mini">
        <template v-if="showAsSelected">
          <div v-for="mid in p.moveIds" :key="mid" class="move-mini" :class="{ 'used-last': p.lastMoveId === mid }">{{ moves[mid].name }}</div>
        </template>
        <template v-else>
          <div v-for="i in 4" :key="i" class="move-mini">?</div>
        </template>
      </div>
    </div>
  </div>
</template>
