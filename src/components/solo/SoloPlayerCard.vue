<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor, CARD_BOTTOM_DARK } from '../../data/constants'

const props = defineProps({
  who: { type: String, required: true } // 'player' | 'ai'
})

const solo = inject('solo')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = solo.state
const c = computed(() => state[props.who])
const isActiveTurn = computed(() => state.turn === props.who)
const label = computed(() => props.who === 'player' ? t('solo.you') : t('solo.opponent'))

const charPicSrc = computed(() => {
  const ch = c.value.character
  if (!ch) return ''
  return ch.imageUrl || `/image/CHARA/${ch.name}.png`
})

const statBadges = computed(() => [
  { label: t('solo.statDice'), value: c.value.energyDiceCount || 1 },
  { label: t('solo.statAtk'), value: `+${c.value.atkBonus || 0}` },
  { label: t('solo.statDef'), value: `+${c.value.defBonus || 0}` }
])

const diceToRoll = computed(() => Math.max(0, (c.value.energyDiceCount || 1) + (c.value.diceMod || 0)))
const showDiceHint = computed(() => isActiveTurn.value && ['moveSelect', 'diceSuccess', 'resolve'].includes(state.phase))
</script>

<template>
  <div class="player-card" :class="{ 'turn-active': isActiveTurn, 'turn-inactive': !isActiveTurn }" :id="'solo-card-' + who">
    <div class="pc-row1" :style="{ background: isActiveTurn ? typeBgColor(c.character.type) : '#FFFFFF' }">
      <div class="pc-icon-col">
        <div class="mon-slot" :class="c.attackAnim">
          <img :src="charPicSrc" class="img-icon" :class="{ 'hit-blink': c.hitBlink, 'frame-out': c.frameOut }" :alt="c.character.name">
          <div v-if="c.dmgOverlay" class="dmg-overlay-num" :class="{ heal: c.dmgOverlay.heal }">{{ c.dmgOverlay.text }}</div>
        </div>
      </div>
      <div class="pc-info-col">
        <div class="pc-status" style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:800;">
          <span>{{ label }}</span>
          <span v-for="b in statBadges" :key="b.label" style="background:rgba(0,0,0,.55); color:#fff; border-radius:6px; padding:1px 6px;">{{ b.label }}{{ b.value }}</span>
        </div>
        <div class="pc-name-hp">
          <div class="pc-name-wrap">
            <div class="pc-type-icon"><img :src="`/image/ICON/${c.character.type}.png`" class="img-icon" :alt="c.character.type"></div>
            <div class="pc-name">{{ c.character.name }}</div>
            <div v-if="who === 'ai'" style="font-size:11px; font-weight:800; color:var(--sub); flex-shrink:0;">Lv.{{ c.tier }}</div>
          </div>
          <div class="pc-hp-num" :class="solo.hpBarClass(c)">{{ Math.max(0, c.hp) }}</div>
        </div>
        <div class="pc-weak-hpbar">
          <div class="pc-weak">HP</div>
          <div class="pc-hpbar-wrap">
            <div class="hp-bar-bg">
              <div class="hp-bar-fill" :class="solo.hpBarClass(c)" :style="{ width: Math.max(0, c.hp / c.maxHp * 100) + '%' }"></div>
            </div>
          </div>
        </div>
        <div v-if="who === 'player'" style="display:flex; align-items:center; gap:4px; margin-top:3px;">
          <div style="font-size:9px; font-weight:800; color:var(--sub); flex-shrink:0;">Lv.{{ c.level }}</div>
          <div style="display:flex; gap:2px; flex:1;">
            <div
              v-for="i in c.level"
              :key="i"
              style="flex:1; height:8px; border-radius:2px; border:1px solid #000;"
              :style="{ background: i <= c.winsSinceLevel ? '#AEFF3E' : '#E9E7E0' }"
            ></div>
          </div>
        </div>
        <div v-if="showDiceHint" style="font-size:16px; font-weight:800; color:#000; margin-top:3px;">{{ t('solo.diceHint', { n: diceToRoll }) }}</div>
      </div>
    </div>
    <div class="pc-row2 revealed" :style="{ background: CARD_BOTTOM_DARK }">
      <div class="moves-mini">
        <div v-for="mid in c.moveIds" :key="mid" class="move-mini" :class="{ 'used-last': c.lastMoveId === mid }">{{ moves[mid].name }}</div>
        <div v-for="i in Math.max(0, 4 - c.moveIds.length)" :key="'empty' + i" class="move-mini">-</div>
      </div>
    </div>
  </div>
</template>
