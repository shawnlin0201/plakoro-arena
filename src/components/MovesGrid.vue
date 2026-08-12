<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { computeDisplayDamage } from '../game/damage'
import MoveCard from './MoveCard.vue'

const { t } = useI18n()

const props = defineProps({
  player: { type: Object, required: true },
  opponent: { type: Object, required: true },
  movesMap: { type: Object, required: true },
  interactive: { type: Boolean, default: false }
})
const emit = defineEmits(['pick'])

const rows = computed(() => props.player.moveIds.map(mid => {
  const mv = props.movesMap[mid]
  const isLastUsed = mid === props.player.committedLastMoveId
  const isBanned = !!(props.player.committedBannedMoveIds && props.player.committedBannedMoveIds.includes(mid))
  const disabled = isLastUsed || isBanned
  const dmgInfo = computeDisplayDamage(mv, props.player, props.opponent, props.movesMap)
  const disableBadge = disabled
    ? (isBanned
      ? { kind: 'bind', label: props.player.committedBannedMoveSourceName || t('moveCard.unusable') }
      : { kind: 'lastused', label: t('moveCard.usedLastTurn') })
    : null
  return { mid, mv, disabled, dmgInfo, disableBadge }
}))

function onPick(mid) {
  if (!props.interactive) return
  emit('pick', mid)
}
</script>

<template>
  <div class="ms-grid">
    <div v-for="row in rows" :key="row.mid" style="position:relative; display:flex; min-height:0; min-width:0;">
      <MoveCard
        :mv="row.mv"
        :dmg-info="row.dmgInfo"
        :owner="player"
        :opponent="opponent"
        :disabled="row.disabled"
        :disable-badge="row.disableBadge"
        :clickable="interactive"
        style="flex:1 1 auto; min-height:0; width:100%;"
        @pick="onPick"
      />
    </div>
  </div>
</template>
