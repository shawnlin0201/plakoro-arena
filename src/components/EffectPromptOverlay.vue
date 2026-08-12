<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MoveCard from './MoveCard.vue'

const battle = inject('battle')
const { moves } = inject('characterData')
const { t } = useI18n()
const state = battle.state
const ep = computed(() => state.effectPrompt)

const diceCountLabel = computed(() => t('effectPrompt.diceRollLabel', { n: ep.value.max === 6 ? 3 : ep.value.max === 4 ? 2 : 1 }))
const diceSub = computed(() => ep.value.max === 2 ? t('effectPrompt.diceSubSingle') : t('effectPrompt.diceSubMulti'))

const target = computed(() => ep.value.kind === 'bindWaza' ? state.players[ep.value.targetKey] : null)
const targetOpp = computed(() => target.value ? state.players[battle.opponentKey(ep.value.targetKey)] : null)
const bindRemaining = computed(() => ep.value.kind === 'bindWaza' ? ep.value.count - ep.value.picked.length : 0)
const bindMoveRows = computed(() => {
  if (ep.value.kind !== 'bindWaza') return []
  return target.value.moveIds.map(mid => {
    const mv = moves.value[mid]
    const isPrevUsed = mid === target.value.lastMoveId
    const isPicked = ep.value.picked.includes(mid)
    const dmgInfo = battle.computeDisplayDamage(mv, target.value, targetOpp.value)
    return { mid, mv, dmgInfo, disabled: isPrevUsed || isPicked }
  })
})

const repeatCount = ref(1)
const eneCountValue = ref(0)
watch(() => state.effectPrompt, () => {
  repeatCount.value = 1
  eneCountValue.value = 0
})

function submit(value) {
  battle.submitEffectPrompt(value)
}
function pickBindMove(mid) {
  battle.pickBindWazaMove(mid)
}
</script>

<template>
  <div class="overlay full">
    <template v-if="ep.kind === 'diceNumber'">
      <div class="overlay-title">{{ t('effectPrompt.enemyRollTitle', { label: diceCountLabel }) }}</div>
      <div class="overlay-sub">{{ diceSub }}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
        <button v-for="n in ep.max" :key="n" class="btn" @click="submit(n)">{{ n }}</button>
      </div>
    </template>

    <template v-else-if="ep.kind === 'charaDiceCount'">
      <div class="overlay-title">{{ t('effectPrompt.charaDiceCountTitle', { n: ep.n }) }}</div>
      <div style="width:100%; max-width:300px; margin:10px auto 0;">
        <MoveCard :mv="ep.mv" :dmg-info="ep.dmgInfo" :owner="ep.mover" :opponent="ep.opp" :clickable="false" style="min-height:172px;" />
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px;">
        <button v-for="n in ep.n + 1" :key="n" class="btn" @click="submit(n - 1)">{{ n - 1 }}</button>
      </div>
    </template>

    <template v-else-if="ep.kind === 'charaDiceRepeat'">
      <div class="overlay-title">{{ t('effectPrompt.charaDiceRepeatTitle') }}</div>
      <div style="width:100%; max-width:300px; margin:10px auto 0;">
        <MoveCard :mv="ep.mv" :dmg-info="ep.dmgInfo" :owner="ep.mover" :opponent="ep.opp" :clickable="false" style="min-height:172px;" />
      </div>
      <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:14px;">
        <select v-model.number="repeatCount" style="font-size:18px; font-weight:800; padding:8px 12px; border-radius:10px; border:2px solid #EDEBE3; background:#fff; color:var(--ink);">
          <option v-for="n in 20" :key="n" :value="n">{{ n }}</option>
        </select>
        <button class="btn" @click="submit(repeatCount)">{{ t('common.confirm') }}</button>
      </div>
    </template>

    <template v-else-if="ep.kind === 'bindWaza'">
      <div class="overlay-title">{{ t('effectPrompt.bindWazaTitle') }}</div>
      <div class="overlay-sub">{{ t('effectPrompt.bindWazaRemaining', { remaining: bindRemaining }) }}</div>
      <div class="ms-grid" style="margin-top:10px; width:100%; max-width:640px; flex:1 1 auto; min-height:0;">
        <MoveCard
          v-for="row in bindMoveRows"
          :key="row.mid"
          :mv="row.mv"
          :dmg-info="row.dmgInfo"
          :owner="target"
          :opponent="targetOpp"
          :disabled="row.disabled"
          :clickable="!row.disabled"
          @pick="pickBindMove"
        />
      </div>
    </template>

    <template v-else-if="ep.kind === 'eneCount'">
      <div class="overlay-title">{{ t('effectPrompt.eneCountTitle') }}</div>
      <div style="width:100%; max-width:300px; margin:10px auto 0;">
        <MoveCard :mv="ep.mv" :dmg-info="ep.dmgInfo" :owner="ep.mover" :opponent="ep.opp" :clickable="false" style="min-height:172px;" />
      </div>
      <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:14px;">
        <select v-model.number="eneCountValue" style="font-size:18px; font-weight:800; padding:8px 12px; border-radius:10px; border:2px solid #EDEBE3; background:#fff; color:var(--ink);">
          <option v-for="n in 13" :key="n" :value="n - 1">{{ n - 1 }}</option>
        </select>
        <button class="btn" @click="submit(eneCountValue)">{{ t('common.confirm') }}</button>
      </div>
    </template>

    <template v-else-if="ep.kind === 'charaDiceEnemyManual'">
      <div class="overlay-title">
        {{ t('effectPrompt.charaDiceEnemyPrefix') }}<img v-for="(ori, i) in ep.orientations" :key="i" :src="`/image/ICON/${ori}.png`" :alt="ori" style="height:1em; width:1em; object-fit:contain; vertical-align:-0.15em; margin:0 1px;">{{ t('effectPrompt.charaDiceEnemySuffix') }}
      </div>
      <div style="width:100%; max-width:300px; margin:10px auto 0;">
        <MoveCard :mv="ep.mv" :dmg-info="ep.dmgInfo" :owner="ep.mover" :opponent="ep.opp" :clickable="false" style="min-height:172px;" />
      </div>
      <div style="display:flex; gap:12px; justify-content:center; margin-top:14px;">
        <button class="btn" @click="submit(true)">{{ t('common.success') }}</button>
        <button class="btn fail" @click="submit(false)">{{ t('common.fail') }}</button>
      </div>
    </template>
  </div>
</template>
