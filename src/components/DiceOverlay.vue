<script setup>
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { typeBgColor } from '../data/constants'
import { isCharaColorConditionMet } from '../game/damage'
import { charaDiceOrientationAllowed } from '../game/effectQueue'
import { FACE_KEYS, faceTypes } from '../game/diceParts'
import { canPayCost } from '../game/energyPayment'
import { asset } from '../data/assetPath'
import ChipIcon from './dice/ChipIcon.vue'

// Same treatment as the price-log chart and the 3D dice tray elsewhere: Three.js/cannon-es
// only get downloaded when a turn actually needs the character-die throw (online mode).
const DiceRoll3DCanvas = defineAsyncComponent(() => import('./dice/DiceRoll3DCanvas.vue'))

const battle = inject('battle')
const online = inject('online')
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

// Online only: whoever's turn it is throws their own configured energy dice (see
// EnergyDiceModal.vue) plus the (real, fixed 6-face) character die together in 3D. Both the
// character-die face and whether the roll actually pays this move's cost are real physics
// results now, not self-reported — see onDiceRolled(). The opponent never runs their own
// physics: once state.diceTransforms syncs, their canvas replays the exact same final dice
// pose (see playOpponentReplay()), so both screens show the identical result.
const isMyTurn = computed(() => !online.myKey.value || online.myKey.value === state.turnPlayer)
const needsThrow = computed(() => !!online.role.value && !state.charaDieFace)
const rolling = ref(false)
const diceCanvasRef = ref(null)
const oppDiceCanvasRef = ref(null)

// Local only, mover's own client: the settled roll stays pinned on screen behind a "確定" button
// instead of falling straight through to the success/fail/chara button list — the transition was
// fast enough that the actual dice result (energy types + chara face) was easy to miss entirely.
// Purely a pacing gate, so it doesn't need to sync — the opponent already has their own separate
// "對方判定招式中/已擲出" status text for the same wait.
const resultAcked = ref(false)
const awaitingAck = computed(() => !!online.role.value && !!state.charaDieFace && !resultAcked.value)

// Rerolls granted by チャンスタックル / ラッキーパンチ on a previous turn.
//
// In hotseat and solo the player just rerolls their real die, so the move-select notice is the
// whole implementation. Online is the opposite: the app threw the die, so it has to be the app
// that throws it again — a notice there would be telling the player to do something they have
// no way to do.
//
// Counted down locally and not synced: the opponent's replay follows state.diceTransforms,
// which a reroll overwrites like any other throw, so they see the final dice either way.
const rerollsLeft = ref(0)
// Declared before the watcher below, which clears it: `immediate: true` runs during setup, so
// a `const` further down would still be in its temporal dead zone.
const rerollingChara = ref(false)
watch(() => state.phase, phase => {
  if (phase !== 'diceRoll') return
  const n = (p.value.pendingNotices || []).find(x => x.kind === 'rerollCharaSelf')
  rerollsLeft.value = n ? n.n : 0
  rerollingChara.value = false
}, { immediate: true })

const canReroll = computed(() => !!online.role.value && !!state.charaDieFace && rerollsLeft.value > 0)

// The CHARACTER die only. The card grants another throw of that one die, not of the whole
// handful — the energy that was rolled stays rolled, and with it whether the move can be paid
// for at all. Throwing everything again would quietly re-decide that too.
async function rerollCharaDie() {
  if (rolling.value || rerollingChara.value || rerollsLeft.value <= 0) return
  rerollsLeft.value -= 1
  rerollingChara.value = true
  rolling.value = true
  try {
    const { buildCharaDieFaces } = await import('../game/diceTextures')
    const charaFaces = await buildCharaDieFaces()
    await diceCanvasRef.value.setDice([charaFaces])
  } finally {
    rolling.value = false
  }
}

function waitForCanvas(canvasRef) {
  if (canvasRef.value) return Promise.resolve()
  return new Promise(resolve => {
    const stop = watch(canvasRef, value => { if (value) { stop(); resolve() } })
  })
}

// Which of the mover's 3 configured energy dice get thrown this turn (cycling if energyCount
// differs from 3) is fully determined by public state (turnCount/diceMod), so both sides derive
// the identical list independently — nothing extra needs to sync for this part.
function diceForThrow(energyDiceConfig) {
  return Array.from({ length: energyCount.value }, (_, i) => energyDiceConfig[i % energyDiceConfig.length])
}

async function buildThrowFaces(energyDiceConfig) {
  const { buildCharaDieFaces, buildEnergyDieFaces } = await import('../game/diceTextures')
  const rollDice = diceForThrow(energyDiceConfig)
  const energyFaces = await Promise.all(rollDice.map(buildEnergyDieFaces))
  const charaFaces = await buildCharaDieFaces()
  return { rollDice, faces: [...energyFaces, charaFaces] }
}

let lastRollDice = []

// Declared up here because onDiceRolled() reads it, and that runs on every settle.
const rerollingEnergy = ref(false)

async function throwDice() {
  if (rolling.value || !diceCanvasRef.value) return
  resultAcked.value = false
  // A superseded reroll never emits, so the flag could otherwise survive into this throw and
  // make a full roll keep the previous turn's energy.
  rerollingChara.value = false
  rolling.value = true
  try {
    const { rollDice, faces } = await buildThrowFaces(p.value.energyDice)
    lastRollDice = rollDice
    await diceCanvasRef.value.setDice(faces)
  } finally {
    rolling.value = false
  }
}

function onDiceRolled(results, transforms) {
  // An energy reroll throws a subset with no character die in it, so none of the reading
  // below applies — the watcher that started it splices the result back in itself.
  if (rerollingEnergy.value) return
  const charaFace = results[results.length - 1]
  // A reroll threw one die, so there is no energy in `results` to read — and none to re-read:
  // keep what the original throw produced, including its cost verdict.
  if (rerollingChara.value) {
    rerollingChara.value = false
    battle.setDiceRollResult(charaFace, state.energyRolledTypes, state.energySuccess, transforms)
    return
  }
  const energyResults = results.slice(0, -1)
  const perDie = energyResults.map((faceKey, i) => faceTypes(lastRollDice[i], faceKey))
  const rolledTypes = perDie.flat()
  const success = canPayCost(rolledTypes, mv.value.cost)
  battle.setDiceRollResult(charaFace, rolledTypes, success, transforms, perDie)
}

// --- ほりかえす / ジュエルフラッシュ: the opponent names dice, this side rethrows them -----

const req = computed(() => state.diceRerollRequest)

// Everything the caster needs to decide with: not just what each die rolled, but what it
// could have rolled. A die showing nothing useful is only worth rerolling if its other five
// faces are better than the one you already have, and that is unknowable from the result
// alone. The target's build is already in shared state (players[key].energyDice), so their
// opponent can draw the real thing rather than a summary of it.
const FACE_LABEL_KEYS = {
  convex: 'convex', concave: 'concave',
  single1: 'single', single2: 'single',
  dual1: 'dual', dual2: 'dual'
}
const REROLL_FACE_ROWS = FACE_KEYS.map(key => ({ key, labelKey: FACE_LABEL_KEYS[key] }))
const rerollTargetDice = computed(() => {
  if (!req.value) return []
  const target = state.players[req.value.targetKey]
  const config = target?.energyDice || []
  const rolled = state.energyDieTypes || []
  // One entry per die actually thrown this turn, which can exceed the configured three when
  // a dice-count modifier is in play — diceForThrow cycles the set, so mirror that here.
  return (rolled.length ? rolled : config).map((types, i) => ({
    index: i,
    die: config.length ? config[i % config.length] : null,
    rolled: rolled[i] || []
  }))
})
// Whoever cast it does the choosing; in hotseat (myKey null) that is simply whoever is holding
// the device, which the move-select notice has already warned about.
const iPickReroll = computed(() =>
  !!req.value && !req.value.indices && (!online.myKey.value || online.myKey.value === req.value.byKey))
// The side whose dice they are does the throwing, because their client owns the canvas.
const iThrowReroll = computed(() =>
  !!req.value && !!req.value.indices && (!online.myKey.value || online.myKey.value === req.value.targetKey))

const rerollPicked = ref([])
watch(req, r => { if (!r) rerollPicked.value = [] })

function toggleRerollPick(i) {
  const at = rerollPicked.value.indexOf(i)
  if (at >= 0) rerollPicked.value.splice(at, 1)
  else if (rerollPicked.value.length < req.value.n) rerollPicked.value.push(i)
}

function confirmRerollPick() {
  if (rerollPicked.value.length !== req.value.n) return
  battle.submitDiceReroll(rerollPicked.value)
}

// Throws only the named dice and splices their new faces back into the existing result —
// the dice nobody pointed at keep what they rolled, and the cost check is redone over the
// whole hand afterwards because a reroll can turn a payable roll into an unpayable one.
//
// Triggered by the player, not automatically. An earlier version watched `iThrowReroll` and
// threw as soon as it turned true, which never fired: the canvas it needs is created by the
// same `v-if` in the same tick, so `diceCanvasRef` was still null and the watcher bailed out
// with nothing to retry it. Putting it behind a button fixes that by construction — by the
// time anyone can press it the canvas is mounted — and it is the right shape anyway, since
// every other throw in this game is something the player does.
async function throwRerollDice() {
  if (rolling.value || rerollingEnergy.value || !req.value?.indices) return
  if (!diceCanvasRef.value) return
  rerollingEnergy.value = true
  rolling.value = true
  try {
    const indices = req.value.indices
    const { buildEnergyDieFaces } = await import('../game/diceTextures')
    // This client threw the original roll, so it still has the die configurations. Falling
    // back to the player's configured set covers a reload mid-turn, where the textures are
    // the same anyway — the dice never change during a match.
    const config = lastRollDice.length ? lastRollDice : diceForThrow(p.value.energyDice)
    const subset = indices.map(i => config[i])
    const faces = await Promise.all(subset.map(buildEnergyDieFaces))
    const results = await diceCanvasRef.value.setDice(faces)
    if (!results) return
    const perDie = [...(state.energyDieTypes || [])]
    indices.forEach((dieIndex, k) => { perDie[dieIndex] = faceTypes(config[dieIndex], results[k]) })
    const rolledTypes = perDie.flat()
    battle.setDiceRollResult(
      state.charaDieFace, rolledTypes, canPayCost(rolledTypes, mv.value.cost),
      state.diceTransforms, perDie)
    battle.clearDiceRerollRequest()
  } finally {
    rerollingEnergy.value = false
    rolling.value = false
  }
}

// Online only, opponent's side: replays the mover's exact throw (same dice, same final pose) —
// see the module doc comment above.
async function playOpponentReplay(transforms) {
  await waitForCanvas(oppDiceCanvasRef)
  const { faces } = await buildThrowFaces(p.value.energyDice)
  oppDiceCanvasRef.value?.replay(faces, transforms)
}
watch(() => state.diceTransforms, transforms => {
  if (isMyTurn.value || !transforms) return
  playOpponentReplay(transforms)
}, { immediate: true })

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

// Online only: whether the actual rolled energy types can pay this move's cost (see
// onDiceRolled()) — null before the throw, so these stay permissive until then (the whole
// button row is hidden behind needsThrow at that point anyway).
const canSucceed = computed(() => !online.role.value || state.energySuccess !== false)
const canFail = computed(() => !online.role.value || state.energySuccess !== true)

// A pinned character die (FIX_CHARADICE_*) leaves only the rows covering the pinned
// orientations selectable, unlike charaDiceBlocked which disables the lot.
function charaAvailable(ce) {
  if (!hasChara.value || !charaDiceOrientationAllowed(ce.orientations, p.value.fixCharaDice)) return false
  if (online.role.value && state.charaDieFace && !ce.orientations.includes(state.charaDieFace)) return false
  if (!canSucceed.value) return false
  return true
}

// Online only: disabled either because the energy roll didn't pay the cost, or because the
// character die landed on a face matching one of this move's chara conditions — physically
// that effect must apply, so "success with no chara bonus" stops being a real outcome this turn.
const successOnlyDisabled = computed(() => {
  if (!canSucceed.value) return true
  return !!online.role.value && !!state.charaDieFace && (mv.value.chara || []).some(charaAvailable)
})

function charaHighlighted(ce) {
  if (!charaAvailable(ce)) return false
  return isCharaColorConditionMet(ce.type, p.value, opp.value)
}

function pickSuccessOnly() {
  if (successOnlyDisabled.value) return
  battle.resolveTurn({ kind: 'success', dmgInfo: dmgInfo.value })
}
function pickChara(ce) {
  if (!charaAvailable(ce)) return
  battle.resolveTurn({ kind: 'chara', ce, dmgInfo: dmgInfo.value })
}
function pickFail() {
  if (!canFail.value) return
  battle.resolveTurn({ kind: 'fail' })
}
function goBack() {
  battle.backToMoveSelect()
}
</script>

<template>
  <div class="dice-overlay">
    <!-- Somebody has to name which of this player's dice go again. Sits above the throw gate
         and replaces it, because the roll is not allowed to settle until it is resolved. -->
    <div v-if="req" class="dr-throw-gate">
      <!-- Only the side that has to rethrow needs a canvas; the caster is just pointing. -->
      <div v-if="iThrowReroll" class="dr-throw-canvas"><DiceRoll3DCanvas ref="diceCanvasRef" @rolled="onDiceRolled" /></div>
      <template v-if="iPickReroll">
        <div class="dr-reroll-title">{{ t('dice.rerollPickTitle', { from: req.from, n: req.n }) }}</div>
        <div class="dr-reroll-dice">
          <button
            v-for="d in rerollTargetDice"
            :key="d.index"
            class="dr-reroll-die"
            :class="{ on: rerollPicked.includes(d.index) }"
            @click="toggleRerollPick(d.index)"
          >
            <div class="dr-reroll-head">
              <span class="dr-reroll-name">{{ t('diceBuilder.die', { n: d.index + 1 }) }}</span>
              <span class="dr-reroll-result">
                <template v-if="d.rolled.length">
                  <span v-for="(ty, j) in d.rolled" :key="j" class="dr-inline-icon half">
                    <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
                  </span>
                </template>
                <span v-else class="dr-reroll-blank">—</span>
              </span>
            </div>
            <!-- All six faces, because "is it worth rerolling" is a question about the five
                 faces that did not come up. -->
            <div v-if="d.die" class="dr-reroll-faces">
              <span v-for="row in REROLL_FACE_ROWS" :key="row.key" class="dr-reroll-face">
                <ChipIcon :types="faceTypes(d.die, row.key)" :size="1.25" />
              </span>
            </div>
          </button>
        </div>
        <button
          class="btn wide"
          :disabled="rerollPicked.length !== req.n"
          :style="rerollPicked.length !== req.n ? 'opacity:.5;' : ''"
          @click="confirmRerollPick"
        >{{ t('common.confirm') }}</button>
      </template>
      <!-- This side's dice were named; they throw the ones that were picked. -->
      <template v-else-if="iThrowReroll">
        <div class="dr-reroll-title">{{ t('dice.rerollThrowTitle', { n: req.indices.length }) }}</div>
        <div class="dr-reroll-dice">
          <div v-for="i in req.indices" :key="i" class="dr-reroll-die">
            <div class="dr-reroll-head">
              <span class="dr-reroll-name">{{ t('diceBuilder.die', { n: i + 1 }) }}</span>
            </div>
            <div v-if="rerollTargetDice[i]?.die" class="dr-reroll-faces">
              <span v-for="row in REROLL_FACE_ROWS" :key="row.key" class="dr-reroll-face">
                <ChipIcon :types="faceTypes(rerollTargetDice[i].die, row.key)" :size="1.25" />
              </span>
            </div>
          </div>
        </div>
        <button
          class="btn wide"
          :disabled="rolling"
          :style="rolling ? 'opacity:.6;' : ''"
          @click="throwRerollDice"
        >{{ rerollingEnergy ? t('dice.rerollThrowing') : t('dice.throwCharaDie') }}</button>
      </template>
      <div v-else class="dr-reroll-title">{{ t('dice.rerollWaiting') }}</div>
    </div>

    <template v-else-if="!isMyTurn">
    <div class="dr-top-row">
      <div
        class="dr-move-card"
        :style="{ backgroundColor: typeBgColor(mv.type), backgroundImage: `url('${asset(`image/BACK/back_${mv.type}.png`)}')` }"
      >
        <div class="dr-cost-row">
          <div v-for="(costType, i) in mv.cost" :key="i" class="cost-dot"><img :src="asset(`image/ICON/${costType}.png`)" class="img-icon" :alt="costType"></div>
        </div>
        <div class="dr-move-name mc-name-big">{{ mv.name }}</div>
      </div>
      <div class="dr-roll-line">
        <template v-if="hasChara">
          <div class="dr-inline-icon big"><img :src="asset('image/ICON/キャラコロ.png')" class="img-icon" alt="キャラコロ"></div>
          <span v-if="energyCount > 0" class="dr-flow-word">{{ t('common.and') }}</span>
        </template>
        <div v-if="energyCount > 0" class="dr-energy-icons one-row">
          <div v-for="(num, i) in energyIcons" :key="i" class="dr-inline-icon big"><img :src="asset(`image/ICON/エネコロ${num}.png`)" class="img-icon" alt="エネコロ"></div>
        </div>
        <span class="dr-flow-word">{{ t('dice.rollSuffix') }}</span>
      </div>
    </div>
    <div class="dr-result-cols">
      <div class="dr-success-col" :style="{ background: typeBgColor(mv.type) }">
        <div class="dr-col-header dr-header-success">{{ t('dice.moveSuccess') }} <span class="arrow">▶</span> <span class="hl">{{ t('dice.charaDiceCheck') }}</span></div>
        <div class="dr-btn-list">
          <div class="dr-success-only-btn dr-readonly" :class="{ 'success-disabled': successOnlyDisabled }">
            <div class="dr-success-only-left">
              <div class="dr-type-icon"><img :src="asset(`image/ICON/${mv.type}.png`)" class="img-icon" :alt="mv.type"></div>
              <div class="dr-chara-btn-text">{{ t('dice.successOnly') }}</div>
            </div>
            <div class="mc-dmg dr-success-only-dmg" :class="successDmgClass">{{ dmgInfo.display }}</div>
          </div>
          <div
            v-for="(ce, i) in mv.chara"
            :key="i"
            class="dr-chara-btn dr-readonly"
            :class="{ 'chara-unavailable': !charaAvailable(ce) }"
          >
            <div class="dr-chara-btn-icons">
              <div v-for="(ori, j) in ce.orientations" :key="j" class="oi"><img :src="asset(`image/ICON/${ori}.png`)" class="img-icon" :alt="ori"></div>
            </div>
            <div class="dr-chara-btn-text" :style="charaHighlighted(ce) ? 'color:#F5F842;' : ''">{{ ce.text }}</div>
          </div>
        </div>
      </div>
      <div class="dr-right-col">
        <div class="dr-throw-gate">
          <div class="dr-throw-canvas compact"><DiceRoll3DCanvas ref="oppDiceCanvasRef" /></div>
          <div class="dr-opponent-status">
            <template v-if="state.charaDieFace">
              <div class="dr-opponent-result-icons">
                <div v-for="(ty, i) in state.energyRolledTypes" :key="i" class="dr-inline-icon half"><img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty"></div>
                <div class="dr-inline-icon half"><img :src="asset(`image/ICON/${state.charaDieFace}.png`)" class="img-icon" :alt="state.charaDieFace"></div>
              </div>
              <span>{{ t('dice.opponentRolled') }}</span>
            </template>
            <span v-else>{{ t('dice.opponentResolving') }}</span>
          </div>
        </div>
      </div>
    </div>
    </template>
    <template v-else>
    <div class="dr-top-row">
      <div
        class="dr-move-card"
        :style="{ backgroundColor: typeBgColor(mv.type), backgroundImage: `url('${asset(`image/BACK/back_${mv.type}.png`)}')` }"
      >
        <div class="dr-cost-row">
          <div v-for="(costType, i) in mv.cost" :key="i" class="cost-dot"><img :src="asset(`image/ICON/${costType}.png`)" class="img-icon" :alt="costType"></div>
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
          <div class="dr-inline-icon big"><img :src="asset('image/ICON/キャラコロ.png')" class="img-icon" alt="キャラコロ"></div>
          <span v-if="energyCount > 0" class="dr-flow-word">{{ t('common.and') }}</span>
        </template>
        <div v-if="energyCount > 0" class="dr-energy-icons one-row">
          <div v-for="(num, i) in energyIcons" :key="i" class="dr-inline-icon big"><img :src="asset(`image/ICON/エネコロ${num}.png`)" class="img-icon" alt="エネコロ"></div>
        </div>
        <span class="dr-flow-word">{{ t('dice.rollSuffix') }}</span>
      </div>
    </div>
    <div v-if="needsThrow || awaitingAck" class="dr-throw-gate">
      <div class="dr-throw-canvas"><DiceRoll3DCanvas ref="diceCanvasRef" @rolled="onDiceRolled" /></div>
      <button v-if="needsThrow" class="btn wide" :disabled="rolling" :style="rolling ? 'opacity:.6;' : ''" @click="throwDice">{{ t('dice.throwCharaDie') }}</button>
      <div v-else class="dr-result-ack">
        <div class="dr-opponent-result-icons">
          <div v-for="(ty, i) in state.energyRolledTypes" :key="i" class="dr-inline-icon half"><img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty"></div>
          <div v-if="hasChara" class="dr-inline-icon half"><img :src="asset(`image/ICON/${state.charaDieFace}.png`)" class="img-icon" :alt="state.charaDieFace"></div>
        </div>
        <div class="dr-result-ack-label" :class="state.energySuccess ? 'succ' : 'fail'">{{ state.energySuccess ? t('common.success') : t('common.fail') }}</div>
        <!-- Offered before the confirm, because taking it means this result is being thrown
             away: once confirmed the player moves on to picking what the roll achieved. -->
        <button
          v-if="canReroll"
          class="btn wide secondary"
          :disabled="rolling"
          :style="rolling ? 'opacity:.6;' : ''"
          @click="rerollCharaDie"
        >{{ t('dice.rerollCharaDie', { n: rerollsLeft }) }}</button>
        <button class="btn wide" @click="resultAcked = true">{{ t('common.confirm') }}</button>
      </div>
    </div>
    <div v-else class="dr-result-cols">
      <div class="dr-success-col" :style="{ background: typeBgColor(mv.type) }">
        <div class="dr-col-header dr-header-success">{{ t('dice.moveSuccess') }} <span class="arrow">▶</span> <span class="hl">{{ t('dice.charaDiceCheck') }}</span></div>
        <div class="dr-btn-list">
          <button class="dr-success-only-btn" :disabled="successOnlyDisabled" :class="{ 'success-disabled': successOnlyDisabled }" @click="pickSuccessOnly">
            <div class="dr-success-only-left">
              <div class="dr-type-icon"><img :src="asset(`image/ICON/${mv.type}.png`)" class="img-icon" :alt="mv.type"></div>
              <div class="dr-chara-btn-text">{{ t('dice.successOnly') }}</div>
            </div>
            <div class="mc-dmg dr-success-only-dmg" :class="successDmgClass">{{ dmgInfo.display }}</div>
          </button>
          <button
            v-for="(ce, i) in mv.chara"
            :key="i"
            class="dr-chara-btn"
            :class="{ 'chara-unavailable': !charaAvailable(ce) }"
            :disabled="!charaAvailable(ce)"
            @click="pickChara(ce)"
          >
            <div class="dr-chara-btn-icons">
              <div v-for="(ori, j) in ce.orientations" :key="j" class="oi"><img :src="asset(`image/ICON/${ori}.png`)" class="img-icon" :alt="ori"></div>
            </div>
            <div class="dr-chara-btn-text" :style="charaHighlighted(ce) ? 'color:#F5F842;' : ''">{{ ce.text }}</div>
          </button>
        </div>
      </div>
      <div class="dr-right-col">
        <div class="dr-fail-box">
          <div class="dr-col-header dr-header-fail">{{ t('dice.energyShortage') }}</div>
          <button class="dr-fail-btn" :disabled="!canFail" :class="{ 'success-disabled': !canFail }" @click="pickFail">{{ t('dice.moveFail') }}</button>
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
    </template>
  </div>
</template>

<style scoped>
/* The dice this roll produced, one button each, tapped to nominate it for a rethrow. An empty
   face shows a dash rather than nothing, so a die that contributed no energy is still a thing
   you can point at. */
.dr-reroll-title { font-size: 0.75rem; font-weight: 800; color: var(--ink); text-align: center; padding: 0.25rem 0.5rem; }
.dr-reroll-dice { display: flex; gap: 0.375rem; justify-content: center; flex-wrap: wrap; padding-bottom: 0.375rem; }
.dr-reroll-die {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  padding: 0.3125rem 0.375rem;
  border: 0.125rem solid var(--line);
  border-radius: 0.375rem;
  background: #fff;
  cursor: pointer;
}
/* What it rolled, on the same line as which die it is — the two facts that identify it. */
.dr-reroll-head { display: flex; align-items: center; gap: 0.25rem; }
.dr-reroll-name { font-size: 0.5rem; font-weight: 800; color: var(--sub); }
.dr-reroll-result { display: flex; align-items: center; gap: 0.0625rem; margin-left: auto; }
/* The build underneath, at a glance rather than at reading size: it is there to be compared
   with the other two dice, not studied. */
.dr-reroll-faces { display: flex; gap: 0.0625rem; }
.dr-reroll-face { display: flex; }
.dr-reroll-die.on { border-color: var(--accent-strong); background: var(--bg); }
.dr-reroll-blank { font-size: 0.75rem; font-weight: 800; color: var(--sub); }
</style>
