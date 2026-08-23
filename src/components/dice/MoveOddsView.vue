<script setup>
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../../data/constants'
import { asset } from '../../data/assetPath'
import { enumerateRolls, payableCount, charaEffectOdds, jointOdds } from '../../game/energyPayment'
import MoveCard from '../MoveCard.vue'

// Which dice sets exist upstream, and their labels, so this view can report a move's odds
// under each configuration side by side.
const props = defineProps({
  sets: { type: Array, required: true },
  setLabels: { type: Array, required: true }
})
const emit = defineEmits(['back'])

const { characters, moves } = inject('characterData')
const { t } = useI18n()

const selectedCharacterId = ref(null)
const selectedCharacter = computed(() =>
  characters.value.find(c => c.id === selectedCharacterId.value) || null
)

// How many times each die gets rolled. Some game rules let a player roll a die more than
// once, and it's the player's own call how many times each one goes — not just an on/off
// switch — so this is a per-die count, defaulting to 1 each (i.e. today's normal roll).
const diceCounts = ref([1, 1, 1])
const activeCount = computed(() => diceCounts.value.reduce((a, b) => a + b, 0))

// Each extra roll multiplies the outcome space by 6 (enumerateRolls is 6^n), so the per-die
// and total caps keep worst case (all 3 dice at MAX_PER_DIE) at 6^9 ≈ 10M — comfortably fast
// for a single synchronous pass, even doubled for a 2-set comparison.
const MAX_PER_DIE = 4
const MAX_TOTAL = 9

function incrementDie(index) {
  if (diceCounts.value[index] >= MAX_PER_DIE) return
  if (activeCount.value >= MAX_TOTAL) return
  diceCounts.value[index] += 1
}
function decrementDie(index) {
  // At least one roll has to stay in play for the odds to mean anything.
  if (diceCounts.value[index] <= 0) return
  if (diceCounts.value[index] <= 1 && activeCount.value <= 1) return
  diceCounts.value[index] -= 1
}

const hasCompare = computed(() => props.sets.length > 1)

// Rolling a die twice is statistically identical to two dice built the same way each rolled
// once, so a die just gets repeated in the list per its count.
function expandDiceByCounts(dice, counts) {
  const expanded = []
  dice.forEach((die, i) => {
    for (let n = 0; n < counts[i]; n++) expanded.push(die)
  })
  return expanded
}

// One roll-outcome list per dice set, covering each die as many times as it's set to roll.
const rollsPerSet = computed(() =>
  props.sets.map(set => enumerateRolls(expandDiceByCounts(set.dice, diceCounts.value)))
)

const showCounts = ref(false)

function pct(payable, total) {
  return (payable / total * 100).toFixed(1)
}

function oddsText(payable, total) {
  const percentage = `${pct(payable, total)}%`
  return showCounts.value ? `${payable}/${total}（${percentage}）` : percentage
}

// Every move the character has, in the order the roster defines — including ones that are
// unpayable with the current dice, since "this build can't cast it at all" is the point.
const moveRows = computed(() => {
  const character = selectedCharacter.value
  if (!character) return []
  return character.moves.map(id => moves.value[id]).filter(Boolean).map(mv => {
    const odds = rollsPerSet.value.map(rolls => payableCount(rolls, mv.cost))
    return {
      mv,
      odds,
      // Per dice set, since the joint figure depends on that set's own success rate.
      charaEffects: mv.chara.map(ce => {
        const charaOdds = charaEffectOdds(ce.orientations)
        return { ce, charaOdds, joint: odds.map(moveOdds => jointOdds(moveOdds, charaOdds)) }
      })
    }
  })
})

</script>

<template>
  <div class="board select-board" style="overflow-y:auto; align-items:center;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem;">{{ t('diceBuilder.moveOdds.title') }}</div>
    <div class="center-hint" style="padding-bottom:0.375rem;">{{ t('diceBuilder.moveOdds.hint') }}</div>

    <!-- character picker -->
    <template v-if="!selectedCharacter">
      <div class="grid-2">
        <div v-for="c in characters" :key="c.id" class="pick-card" @click="selectedCharacterId = c.id">
          <div class="pick-top" :style="{ background: typeBgColor(c.type) }">
            <div class="pick-type-icon"><img :src="asset(`image/ICON/${c.type}.png`)" class="img-icon" :alt="c.type"></div>
            <div class="ic"><img :src="c.imageUrl || asset(`image/CHARA/${c.name}.png`)" class="img-icon" :alt="c.name"></div>
          </div>
          <div class="pick-bottom">
            <div class="nm-row"><span class="nm">{{ c.name }}</span></div>
          </div>
        </div>
      </div>
      <div style="display:flex; justify-content:center; padding:0.875rem 0 0.25rem;">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </template>

    <!-- odds table -->
    <template v-else>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; width:100%; max-width:40rem; padding:0 0.625rem 0.5rem;">
        <div style="display:flex; align-items:center; gap:0.375rem;">
          <div style="width:2rem; height:2rem; border-radius:0.375rem; overflow:hidden; flex-shrink:0;">
            <img :src="selectedCharacter.imageUrl || asset(`image/CHARA/${selectedCharacter.name}.png`)" class="img-icon" :alt="selectedCharacter.name">
          </div>
          <span style="font-size:0.875rem; font-weight:800;">{{ selectedCharacter.name }}</span>
          <button class="btn secondary" style="padding:0.1875rem 0.5rem; font-size:0.625rem;" @click="selectedCharacterId = null">{{ t('diceBuilder.moveOdds.changeCharacter') }}</button>
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ t('diceBuilder.moveOdds.diceInPlay') }}</span>
          <div
            v-for="(count, di) in diceCounts"
            :key="di"
            style="display:flex; align-items:center; gap:0.25rem; font-size:0.625rem; font-weight:800; color:var(--sub);"
          >
            <span>{{ t('diceBuilder.die', { n: di + 1 }) }}</span>
            <button
              type="button"
              @click="decrementDie(di)"
              style="width:1rem; height:1rem; line-height:1; border:1px solid var(--line); border-radius:0.25rem; background:#fff; font-weight:800; cursor:pointer; padding:0;"
            >−</button>
            <span style="min-width:0.75rem; text-align:center; color:var(--ink);">{{ count }}</span>
            <button
              type="button"
              @click="incrementDie(di)"
              style="width:1rem; height:1rem; line-height:1; border:1px solid var(--line); border-radius:0.25rem; background:#fff; font-weight:800; cursor:pointer; padding:0;"
            >+</button>
          </div>
          <label style="display:flex; align-items:center; gap:0.1875rem; font-size:0.625rem; font-weight:800; color:var(--sub); cursor:pointer;">
            <input type="checkbox" v-model="showCounts" style="width:0.75rem; height:0.75rem; margin:0;">
            {{ t('diceBuilder.showCountsLabel') }}
          </label>
        </div>
      </div>

      <div style="width:100%; max-width:40rem; padding:0 0.625rem;">
        <div style="font-size:0.6875rem; font-weight:800; color:var(--sub); padding:0 0.125rem 0.25rem; border-bottom:0.125rem solid var(--line); margin-bottom:0.5rem;">
          {{ t('diceBuilder.moveOdds.moveHeader', { n: activeCount }) }}
        </div>

        <div class="move-pick-list">
          <div v-for="row in moveRows" :key="row.mv.id" style="display:flex; flex-direction:column; gap:0.25rem; min-width:0;">
            <!-- odds sit above the card so the card itself stays exactly as it looks in game -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.375rem; padding:0 0.125rem;">
              <span style="font-size:0.625rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('diceBuilder.moveOdds.successRate') }}</span>
              <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                <span
                  v-for="(o, si) in row.odds"
                  :key="si"
                  :style="{ display: 'flex', alignItems: 'baseline', gap: '0.1875rem', fontSize: '0.75rem', fontWeight: 600, color: o.payable === 0 ? 'var(--line)' : 'var(--sub)', whiteSpace: 'nowrap' }"
                >
                  <span v-if="hasCompare" style="font-weight:800;">{{ setLabels[si] }}</span>
                  <span :style="{ fontSize: '1.25rem', fontWeight: 900, color: o.payable === 0 ? 'var(--line)' : 'var(--ink)' }">{{ oddsText(o.payable, o.total) }}</span>
                </span>
              </div>
            </div>

            <div class="odds-card"><MoveCard :mv="row.mv" :clickable="false" /></div>

            <!-- character-die odds, keyed to the orientation icons on the card's lower half.
                 Reported separately because it rides on a different die from the energy cost. -->
            <div v-if="row.charaEffects.length > 0" style="display:flex; flex-direction:column; gap:0.125rem; padding:0 0.125rem;">
              <div v-for="(entry, ei) in row.charaEffects" :key="ei" style="display:flex; align-items:center; justify-content:space-between; gap:0.375rem;">
                <div style="display:flex; align-items:center; gap:0.1875rem; min-width:0;">
                  <span style="font-size:0.625rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('diceBuilder.moveOdds.charaDieOdds') }}</span>
                  <div style="display:flex; gap:0.0625rem; flex-shrink:0;">
                    <div v-for="(ori, oi) in entry.ce.orientations" :key="oi" style="width:0.875rem; height:0.875rem; flex-shrink:0;">
                      <img :src="asset(`image/ICON/${ori}.png`)" class="img-icon" :alt="ori">
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                  <span
                    v-for="(j, si) in entry.joint"
                    :key="si"
                    :style="{ display: 'flex', alignItems: 'baseline', gap: '0.125rem', whiteSpace: 'nowrap' }"
                  >
                    <span v-if="hasCompare" style="font-size:0.625rem; font-weight:800; color:var(--sub);">{{ setLabels[si] }}</span>
                    <span :style="{ fontSize: '1rem', fontWeight: 900, color: j.payable === 0 ? 'var(--line)' : 'var(--ink)' }">{{ oddsText(j.payable, j.total) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:center; padding:0.875rem 0 0.25rem;">
        <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The odds are the point of this view, so the card is scaled down to a reference thumbnail.
   MoveCard sizes everything in rem (root-relative), so a parent font-size can't scale it —
   each size has to be overridden explicitly. */
.odds-card :deep(.move-card) { min-height: 7.25rem; }
.odds-card :deep(.mc-top) { padding: 0.25rem 0.375rem 0.1875rem; }
.odds-card :deep(.mc-bottom) { padding: 0.125rem 0.375rem 0.25rem; }
.odds-card :deep(.mc-type-icon) { width: 1.125rem; height: 1.125rem; }
.odds-card :deep(.mc-name-big) { font-size: 0.8125rem; }
.odds-card :deep(.cost-dot) { width: 0.8125rem; height: 0.8125rem; }
.odds-card :deep(.mc-dmg) { font-size: 1rem; }
.odds-card :deep(.mc-dmg .orig) { font-size: 0.5rem; }
.odds-card :deep(.mc-effect) { font-size: 0.5rem; }
.odds-card :deep(.mc-chara-row) { font-size: 0.5rem; gap: 0.1875rem; padding-top: 0.125rem; }
.odds-card :deep(.mc-chara-row .oi) { width: 0.75rem; height: 0.75rem; }
</style>
