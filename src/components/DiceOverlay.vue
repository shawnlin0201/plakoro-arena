<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../data/constants'
import { isCharaColorConditionMet } from '../game/damage'

const battle = inject('battle')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = battle.state

const mv = computed(() => moves.value[state.selectedMove])
const p = computed(() => state.players[state.turnPlayer])
const opp = computed(() => state.players[battle.opponentKey(state.turnPlayer)])
const dmgInfo = computed(() => battle.computeDisplayDamage(mv.value, p.value, opp.value))
const isFirstTurn = computed(() => state.turnCount === 0)
const energyCount = computed(() => Math.max(0, (isFirstTurn.value ? 2 : 3) + (p.value.diceMod || 0)))
const hasChara = computed(() => mv.value.chara && mv.value.chara.length > 0 && !p.value.charaDiceBlocked)

const diceModBadges = computed(() => {
  const badges = []
  if (isFirstTurn.value) badges.push({ label: t('dice.firstTurnBadge'), firstTurn: true })
  ;(p.value.diceModBadges || []).forEach(b => badges.push({ label: b.name, color: typeBgColor(b.type) }))
  return badges
})

const energyIcons = computed(() => Array.from({ length: energyCount.value }, (_, i) => (i % 6) + 1))

const successDmgClass = computed(() => {
  const m = dmgInfo.value.mode
  return m === 'weak' ? 'weak' : m === 'up' ? 'up' : m === 'down' ? 'down' : ''
})

function charaHighlighted(ce) {
  return isCharaColorConditionMet(ce.type, p.value, opp.value)
}

function pickSuccessOnly() {
  battle.resolveTurn({ kind: 'success', dmgInfo: dmgInfo.value })
}
function pickChara(ce) {
  if (!hasChara.value) return
  battle.resolveTurn({ kind: 'chara', ce, dmgInfo: dmgInfo.value })
}
function pickFail() {
  battle.resolveTurn({ kind: 'fail' })
}
function goBack() {
  battle.backToMoveSelect()
}
</script>

<template>
  <div class="dice-overlay">
    <div class="dr-top-row">
      <div
        class="dr-move-card"
        :style="{ backgroundColor: typeBgColor(mv.type), backgroundImage: `url('/image/BACK/back_${mv.type}.png')` }"
      >
        <div class="dr-cost-row">
          <div v-for="(costType, i) in mv.cost" :key="i" class="cost-dot"><img :src="`/image/ICON/${costType}.png`" class="img-icon" :alt="costType"></div>
        </div>
        <div class="dr-move-name mc-name-big">{{ mv.name }}</div>
      </div>
      <div class="dr-roll-line">
        <div v-if="diceModBadges.length > 0" class="dice-mod-badges">
          <div
            v-for="(b, i) in diceModBadges"
            :key="i"
            class="dice-mod-badge"
            :class="{ 'first-turn': b.firstTurn }"
            :style="b.firstTurn ? '' : { background: b.color }"
          >{{ b.label }}</div>
        </div>
        <template v-if="hasChara">
          <div class="dr-inline-icon big"><img :src="'/image/ICON/キャラコロ.png'" class="img-icon" alt="キャラコロ"></div>
          <span v-if="energyCount > 0" class="dr-flow-word">{{ t('common.and') }}</span>
        </template>
        <div v-if="energyCount > 0" class="dr-energy-icons one-row">
          <div v-for="(num, i) in energyIcons" :key="i" class="dr-inline-icon big"><img :src="`/image/ICON/エネコロ${num}.png`" class="img-icon" alt="エネコロ"></div>
        </div>
        <span class="dr-flow-word">{{ t('dice.rollSuffix') }}</span>
      </div>
    </div>
    <div class="dr-result-cols">
      <div class="dr-success-col" :style="{ background: typeBgColor(mv.type) }">
        <div class="dr-col-header dr-header-success">{{ t('dice.moveSuccess') }} <span class="arrow">▶</span> <span class="hl">{{ t('dice.charaDiceCheck') }}</span></div>
        <div class="dr-btn-list">
          <button class="dr-success-only-btn" @click="pickSuccessOnly">
            <div class="dr-success-only-left">
              <div class="dr-type-icon"><img :src="`/image/ICON/${mv.type}.png`" class="img-icon" :alt="mv.type"></div>
              <div class="dr-chara-btn-text">{{ t('dice.successOnly') }}</div>
            </div>
            <div class="mc-dmg dr-success-only-dmg" :class="successDmgClass">{{ dmgInfo.display }}</div>
          </button>
          <button
            v-for="(ce, i) in mv.chara"
            :key="i"
            class="dr-chara-btn"
            :class="{ 'chara-unavailable': !hasChara }"
            :disabled="!hasChara"
            @click="pickChara(ce)"
          >
            <div class="dr-chara-btn-icons">
              <div v-for="(ori, j) in ce.orientations" :key="j" class="oi"><img :src="`/image/ICON/${ori}.png`" class="img-icon" :alt="ori"></div>
            </div>
            <div class="dr-chara-btn-text" :style="charaHighlighted(ce) ? 'color:#F5F842;' : ''">{{ ce.text }}</div>
          </button>
        </div>
      </div>
      <div class="dr-right-col">
        <div class="dr-fail-box">
          <div class="dr-col-header dr-header-fail">{{ t('dice.energyShortage') }}</div>
          <button class="dr-fail-btn" @click="pickFail">{{ t('dice.moveFail') }}</button>
        </div>
        <div class="dr-back-box">
          <button
            class="dr-back-btn"
            :disabled="state.repeatActive"
            :style="state.repeatActive ? 'opacity:.35; pointer-events:none;' : ''"
            @click="goBack"
          >{{ t('common.back') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
