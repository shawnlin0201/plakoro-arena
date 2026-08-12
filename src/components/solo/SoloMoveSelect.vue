<script setup>
import { computed, inject } from 'vue'
import { typeBgColor } from '../../data/constants'
import MoveCard from '../MoveCard.vue'

const solo = inject('solo')
const { moves } = inject('characterData')
const state = solo.state

const player = computed(() => state.player)
const ai = computed(() => state.ai)
const available = computed(() => {
  const a = solo.availableMoveIds('player')
  // Same fallback as the AI's move choice: if every known move is disabled (e.g. the
  // player only knows 1 move and it was used last turn), don't lock them out entirely.
  return a.length > 0 ? a : player.value.moveIds
})

const rows = computed(() => player.value.moveIds.map(mid => {
  const mv = moves.value[mid]
  const disabled = !available.value.includes(mid)
  const baseDmgInfo = solo.computeDisplayDamage(mv, player.value, ai.value)
  const atk = player.value.atkBonus || 0
  // Show as "XX(+YY)" so the player can see their attack bonus is applied on top of
  // the move's own number, matching how resolveTurn actually adds atkBonus at cast time.
  const dmgInfo = atk > 0 ? { ...baseDmgInfo, display: `${baseDmgInfo.display}(+${atk})` } : baseDmgInfo
  const isBanned = (player.value.committedBannedMoveIds || []).includes(mid)
  const disableBadge = disabled
    ? (isBanned ? { kind: 'bind', label: player.value.committedBannedMoveSourceName } : { kind: 'lastused', label: '' })
    : null
  return { mid, mv, disabled, dmgInfo, disableBadge }
}))

function pick(mid) {
  solo.pickMove(mid)
}
</script>

<template>
  <div class="move-select-panel" :style="{ background: typeBgColor(player.character.type), boxShadow: 'none', height: '80%', borderRadius: '0 18px 0 0' }">
    <div class="ms-grid">
      <div v-for="row in rows" :key="row.mid" style="position:relative; display:flex; min-height:0; min-width:0;">
        <MoveCard
          :mv="row.mv"
          :dmg-info="row.dmgInfo"
          :owner="player"
          :opponent="ai"
          :disabled="row.disabled"
          :disable-badge="row.disableBadge"
          style="flex:1 1 auto; min-height:0; width:100%;"
          @pick="pick"
        />
      </div>
    </div>
  </div>
</template>
