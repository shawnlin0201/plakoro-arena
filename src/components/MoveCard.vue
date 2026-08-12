<script setup>
import { computed } from 'vue'
import { typeBgColor } from '../data/constants'
import { isCharaColorConditionMet } from '../game/damage'
import { asset } from '../data/assetPath'

const props = defineProps({
  mv: { type: Object, required: true },
  dmgInfo: { type: Object, default: null },
  owner: { type: Object, default: null },
  opponent: { type: Object, default: null },
  selected: { type: Boolean, default: false },
  order: { type: Number, default: null },
  disabled: { type: Boolean, default: false },
  disableBadge: { type: Object, default: null }, // { kind: 'lastused' | 'bind', label }
  clickable: { type: Boolean, default: true }
})
const emit = defineEmits(['pick'])

const dmg = computed(() => props.dmgInfo || { display: props.mv.baseDamage, raw: props.mv.baseDamage, orig: props.mv.baseDamage, mode: 'normal' })
const dmgClass = computed(() => {
  const m = dmg.value.mode
  return m === 'weak' ? 'weak' : m === 'up' ? 'up' : m === 'down' ? 'down' : ''
})
const dmgDiffLabel = computed(() => {
  const diff = dmg.value.raw - dmg.value.orig
  const sign = diff >= 0 ? '+' : '-'
  return `${dmg.value.orig}${sign}${Math.abs(diff)}`
})

function charaHighlighted(ce) {
  return isCharaColorConditionMet(ce.type, props.owner, props.opponent)
}

function onClick() {
  if (props.disabled || !props.clickable) return
  emit('pick', props.mv.id)
}
</script>

<template>
  <div
    class="move-card"
    :class="{ disabled, selected }"
    :data-select-order="order != null ? order : null"
    :style="clickable && !disabled ? '' : 'cursor:default;'"
    @click="onClick"
  >
    <div
      class="mc-top"
      :style="{ backgroundColor: typeBgColor(mv.type), backgroundImage: `url('${asset(`image/BACK/back_${mv.type}.png`)}')`, backgroundSize: 'cover', backgroundPosition: 'center' }"
    >
      <div class="mc-top-row">
        <div class="mc-typename">
          <div class="mc-type-icon"><img :src="asset(`image/ICON/${mv.type}.png`)" class="img-icon" :alt="mv.type"></div>
          <div class="mc-name-big">{{ mv.name }}</div>
        </div>
        <div class="mc-right-stack">
          <div class="mc-cost">
            <div v-for="(t, i) in mv.cost" :key="i" class="cost-dot"><img :src="asset(`image/ICON/${t}.png`)" class="img-icon" :alt="t"></div>
          </div>
          <div class="mc-dmg" :class="dmgClass">
            {{ dmg.display }}<span v-if="dmg.mode !== 'normal'" class="orig">({{ dmgDiffLabel }})</span>
          </div>
        </div>
      </div>
      <div v-if="mv.effect" class="mc-effect">{{ mv.effect }}</div>
    </div>
    <div class="mc-bottom">
      <div v-for="(ce, i) in mv.chara" :key="i" class="mc-chara-row">
        <div style="display:flex; gap:2px; flex-shrink:0;">
          <div v-for="(ori, j) in ce.orientations" :key="j" class="oi"><img :src="asset(`image/ICON/${ori}.png`)" class="img-icon" :alt="ori"></div>
        </div>
        <div class="txt" :style="charaHighlighted(ce) ? 'color:#F5F842;' : ''">{{ ce.text }}</div>
      </div>
    </div>
    <div v-if="disableBadge" class="move-disable-badge" :class="disableBadge.kind">{{ disableBadge.label }}</div>
  </div>
</template>
