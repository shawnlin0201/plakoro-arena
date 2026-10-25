<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FACE_KEYS, CONVEX_TYPES, CONCAVE_TYPES, CHIP_TYPES, faceTypes, randomDie } from '../game/diceParts'
import { asset } from '../data/assetPath'
import ChipIcon from './dice/ChipIcon.vue'

// Deliberately NOT routed through battle.state.modal: editing your own dice build is a purely
// local, own-side task with nothing for the opponent to see mid-edit, and two people online
// happen to do this at almost the same time far more often than char/move picking ever did —
// sharing one state.modal slot meant whoever pressed "done" second stole/closed the other
// side's picker. Local component state confirms once, at the very end (see emit('confirm')),
// which is the only piece that ever needs to reach the opponent.
const props = defineProps({
  initialDice: { type: Array, default: null }
})
const emit = defineEmits(['close', 'confirm'])
const { t } = useI18n()

function cloneDie(die) {
  return {
    convexType: die.convexType,
    concaveType: die.concaveType,
    singleSlots: die.singleSlots.map(s => ({ ...s })),
    dualSlots: die.dualSlots.map(s => ({ ...s, types: [...s.types] }))
  }
}

const dice = ref(props.initialDice ? props.initialDice.map(cloneDie) : [randomDie(), randomDie(), randomDie()])

const CELL = 2.5
const FACE_LABEL_KEYS = {
  convex: 'convex', concave: 'concave',
  single1: 'single', single2: 'single',
  dual1: 'dual', dual2: 'dual'
}
const FACE_ROWS = FACE_KEYS.map(key => ({ key, labelKey: FACE_LABEL_KEYS[key] }))

function slotMeta(faceKey) {
  if (faceKey === 'convex') return { kind: 'convex', options: CONVEX_TYPES }
  if (faceKey === 'concave') return { kind: 'concave', options: CONCAVE_TYPES }
  if (faceKey === 'single1') return { kind: 'single', options: CHIP_TYPES, slotIndex: 0 }
  if (faceKey === 'single2') return { kind: 'single', options: CHIP_TYPES, slotIndex: 1 }
  if (faceKey === 'dual1') return { kind: 'dual', options: CHIP_TYPES, slotIndex: 0 }
  if (faceKey === 'dual2') return { kind: 'dual', options: CHIP_TYPES, slotIndex: 1 }
  return null
}

const editingSlot = ref(null) // { dieIndex, faceKey } | null
const currentMeta = computed(() => editingSlot.value ? slotMeta(editingSlot.value.faceKey) : null)
const editingDie = computed(() => editingSlot.value ? dice.value[editingSlot.value.dieIndex] : null)

function openPicker(dieIndex, faceKey) {
  editingSlot.value = { dieIndex, faceKey }
}
function closePicker() {
  editingSlot.value = null
}

function isTypeSelected(type) {
  const meta = currentMeta.value
  const die = editingDie.value
  if (!meta || !die) return false
  if (meta.kind === 'convex') return die.convexType === type
  if (meta.kind === 'concave') return die.concaveType === type
  if (meta.kind === 'single') return die.singleSlots[meta.slotIndex].type === type
  return false
}

const currentDualTypes = computed(() => {
  const meta = currentMeta.value
  const die = editingDie.value
  if (!die || !meta || meta.kind !== 'dual') return [null, null]
  return die.dualSlots[meta.slotIndex].types
})

function pickType(type) {
  const meta = currentMeta.value
  const die = editingDie.value
  if (!meta || !die) return
  if (meta.kind === 'convex') die.convexType = type
  else if (meta.kind === 'concave') die.concaveType = type
  else if (meta.kind === 'single') die.singleSlots[meta.slotIndex] = { kind: 'single', type }
  else return
  closePicker()
}

function setDualType(half, type) {
  const meta = currentMeta.value
  const die = editingDie.value
  if (!die || !meta || meta.kind !== 'dual') return
  die.dualSlots[meta.slotIndex].types[half] = type
}

const pickerTitleKey = computed(() => {
  const kind = currentMeta.value ? currentMeta.value.kind : null
  if (kind === 'convex') return 'diceBuilder.picker.convexTitle'
  if (kind === 'concave') return 'diceBuilder.picker.concaveTitle'
  if (kind === 'single') return 'diceBuilder.picker.singleTitle'
  if (kind === 'dual') return 'diceBuilder.picker.dualTitle'
  return ''
})

// Quick apply: pick one type, every die's round/square sockets (plus whichever fixed face
// belongs to that type's own pool) become that type in one go — same shortcut the dice
// assembly simulator offers, just without its two-set compare step (there's only ever one set
// of 3 dice here).
// Two steps, same as the assembly simulator's. A die's convex face only holds
// くさ/ほのお/みず/かみなり/はがね and its concave face only あく/かくとう/ちょう/ひこう, so one
// pick can never fill both. This used to take a single pick, apply it to whichever face it
// fitted, and leave the other alone — which contradicted the hint right above it ("pick the
// main energy, then the secondary") and left half the die at whatever it happened to be.
const showQuickApply = ref(false)
const quickApplyMain = ref(null)

function openQuickApply() {
  quickApplyMain.value = null
  showQuickApply.value = true
}

// The second step always draws from the pool the first pick didn't come from.
const quickApplyOppositeIsConcave = computed(() =>
  !!quickApplyMain.value && CONVEX_TYPES.includes(quickApplyMain.value))
const quickApplyOppositeOptions = computed(() =>
  quickApplyOppositeIsConcave.value ? CONCAVE_TYPES : CONVEX_TYPES)

function pickQuickApplyMain(type) {
  quickApplyMain.value = type
}

// `type` is null when the player opts to leave the opposite face as it is.
function pickQuickApplyOpposite(type) {
  applyPureType(quickApplyMain.value, type)
}

function applyPureType(mainType, oppositeType) {
  const mainIsConvex = CONVEX_TYPES.includes(mainType)
  dice.value.forEach(die => {
    if (mainIsConvex) {
      die.convexType = mainType
      if (oppositeType) die.concaveType = oppositeType
    } else {
      die.concaveType = mainType
      if (oppositeType) die.convexType = oppositeType
    }
    // Every chip takes the main type: that is what "pure" means here.
    die.singleSlots[0] = { kind: 'single', type: mainType }
    die.singleSlots[1] = { kind: 'single', type: mainType }
    die.dualSlots[0] = { kind: 'dual', types: [mainType, mainType] }
    die.dualSlots[1] = { kind: 'dual', types: [mainType, mainType] }
  })
  showQuickApply.value = false
  quickApplyMain.value = null
}

function confirm() {
  emit('confirm', dice.value)
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-sheet" style="max-height:85%; overflow-y:auto;">
      <div class="modal-title">{{ t('energyDice.title') }}</div>
      <div class="center-hint" style="padding:0 0.625rem 0.5rem; text-align:center;">{{ t('energyDice.hint') }}</div>

      <div style="display:flex; flex-direction:column; gap:0.625rem; padding:0 0.625rem;">
        <div v-for="(die, di) in dice" :key="di" class="select-card" style="width:100%; align-items:stretch; padding:0.75rem;">
          <div style="font-size:0.8125rem; font-weight:800; padding-bottom:0.375rem;">{{ t('diceBuilder.die', { n: di + 1 }) }}</div>
          <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:0.375rem;">
            <div v-for="row in FACE_ROWS" :key="row.key" style="display:flex; flex-direction:column; align-items:center; gap:0.125rem;">
              <span style="font-size:0.5625rem; font-weight:800; color:var(--sub);">{{ t('diceBuilder.face.' + row.labelKey) }}</span>
              <div style="cursor:pointer;" @click="openPicker(di, row.key)">
                <ChipIcon :types="faceTypes(die, row.key)" :size="CELL" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:0.625rem; justify-content:center; flex-wrap:wrap; padding:0.875rem 0 0.25rem;">
        <button class="btn secondary" @click="openQuickApply">{{ t('diceBuilder.quickApplyButton') }}</button>
        <button class="btn wide" style="max-width:16rem;" @click="confirm">{{ t('energyDice.confirm') }}</button>
      </div>
    </div>

    <div v-if="editingSlot" class="modal-overlay" @click.self="closePicker">
      <div class="modal-sheet" style="max-height:75%; position:relative;">
        <button
          @click="closePicker"
          style="position:absolute; top:0.625rem; right:0.625rem; width:1.75rem; height:1.75rem; border:none; border-radius:50%; background:rgba(0,0,0,.08); color:var(--ink); font-size:0.9375rem; font-weight:800; line-height:1; cursor:pointer;"
        >✕</button>
        <div class="modal-title">{{ t(pickerTitleKey) }}</div>

        <template v-if="currentMeta && currentMeta.kind === 'dual'">
          <div style="font-size:0.75rem; color:var(--sub); text-align:center; margin:-0.25rem 0 0.625rem;">{{ t('diceBuilder.picker.dualHint') }}</div>
          <div v-for="idx in [0, 1]" :key="idx" style="margin-bottom:0.75rem;">
            <div style="font-size:0.6875rem; font-weight:800; color:var(--sub); text-align:center; margin-bottom:0.3125rem;">{{ t('diceBuilder.picker.dualSlotLabel', { n: idx + 1 }) }}</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center;">
              <div
                v-for="ty in currentMeta.options"
                :key="ty"
                @click="setDualType(idx, ty)"
                :style="{
                  width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', overflow: 'hidden',
                  background: '#fff', cursor: 'pointer',
                  border: currentDualTypes[idx] === ty ? '0.1875rem solid #AEFF3E' : '0.125rem solid var(--line)'
                }"
              >
                <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
              </div>
            </div>
          </div>
        </template>

        <div v-else style="display:flex; flex-wrap:wrap; gap:0.625rem; justify-content:center;">
          <div
            v-for="ty in (currentMeta ? currentMeta.options : [])"
            :key="ty"
            @click="pickType(ty)"
            :style="{
              width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem', overflow: 'hidden',
              background: '#fff', cursor: 'pointer',
              border: isTypeSelected(ty) ? '0.1875rem solid #AEFF3E' : '0.125rem solid var(--line)'
            }"
          >
            <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
          </div>
        </div>
      </div>
    </div>

    <div v-if="showQuickApply" class="modal-overlay" @click.self="showQuickApply = false">
      <div class="modal-sheet" style="max-height:75%; position:relative;">
        <button
          @click="showQuickApply = false"
          style="position:absolute; top:0.625rem; right:0.625rem; width:1.75rem; height:1.75rem; border:none; border-radius:50%; background:rgba(0,0,0,.08); color:var(--ink); font-size:0.9375rem; font-weight:800; line-height:1; cursor:pointer;"
        >✕</button>
        <div class="modal-title">{{ t('diceBuilder.quickApplyTitle') }}</div>
        <div style="font-size:0.75rem; color:var(--sub); text-align:center; margin:-0.25rem 0 0.625rem;">{{ t('diceBuilder.quickApplyHint') }}</div>
        <template v-if="!quickApplyMain">
          <div style="font-size:0.8125rem; font-weight:800; color:var(--sub); text-align:center; padding-bottom:0.375rem;">{{ t('diceBuilder.quickApplyStepMain') }}</div>
          <div style="display:flex; flex-wrap:wrap; gap:0.625rem; justify-content:center;">
            <div
              v-for="ty in CHIP_TYPES"
              :key="ty"
              @click="pickQuickApplyMain(ty)"
              style="width:2.75rem; height:2.75rem; border-radius:0.5rem; overflow:hidden; background:#fff; cursor:pointer; border:0.125rem solid var(--line);"
            >
              <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
            </div>
          </div>
        </template>

        <!-- the fixed face the first pick couldn't reach -->
        <template v-else>
          <div style="font-size:0.8125rem; font-weight:800; color:var(--sub); text-align:center; padding-bottom:0.375rem;">
            {{ t('diceBuilder.quickApplyStepOpposite', { face: t('diceBuilder.face.' + (quickApplyOppositeIsConcave ? 'concave' : 'convex')) }) }}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.625rem; justify-content:center;">
            <div
              v-for="ty in quickApplyOppositeOptions"
              :key="ty"
              @click="pickQuickApplyOpposite(ty)"
              style="width:2.75rem; height:2.75rem; border-radius:0.5rem; overflow:hidden; background:#fff; cursor:pointer; border:0.125rem solid var(--line);"
            >
              <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
            </div>
          </div>
          <div style="display:flex; justify-content:center; padding-top:0.75rem;">
            <button class="btn secondary" @click="pickQuickApplyOpposite(null)">{{ t('diceBuilder.quickApplyKeepOpposite') }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
