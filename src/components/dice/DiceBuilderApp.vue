<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { randomDie, CONVEX_TYPES, CONCAVE_TYPES, CHIP_TYPES } from '../../game/diceParts'
import { asset } from '../../data/assetPath'

const emit = defineEmits(['back'])
const { t } = useI18n()

const dice = ref([randomDie(), randomDie(), randomDie()])
// Whether die 2 / die 3 (indices 1 and 2) are locked to always mirror die 1's setup.
const sameAsDie1 = ref([false, false])

function cloneDie(die) {
  return {
    convexType: die.convexType,
    concaveType: die.concaveType,
    singleSlots: die.singleSlots.map(s => ({ ...s })),
    dualSlots: die.dualSlots.map(s => ({ ...s, types: [...s.types] }))
  }
}

function syncCheckedDice() {
  for (let i = 1; i <= 2; i++) {
    if (sameAsDie1.value[i - 1]) dice.value[i] = cloneDie(dice.value[0])
  }
}

// Keep die 2 / die 3 mirroring die 1 live — any edit to die 1 (a reroll, or picking a new
// energy on one of its faces) should immediately propagate to whichever dice are locked.
watch(() => dice.value[0], syncCheckedDice, { deep: true })

function onToggleSame(dieIndex, checked) {
  sameAsDie1.value[dieIndex - 1] = checked
  if (checked) dice.value[dieIndex] = cloneDie(dice.value[0])
}

function reroll() {
  dice.value[0] = randomDie()
  for (let i = 1; i <= 2; i++) {
    if (!sameAsDie1.value[i - 1]) dice.value[i] = randomDie()
  }
}

// The 6 faces of a die, in the fixed display order the spec calls for: convex, concave,
// single, single, dual, dual.
const FACE_ROWS = [
  { key: 'convex', labelKey: 'convex' },
  { key: 'concave', labelKey: 'concave' },
  { key: 'single1', labelKey: 'single' },
  { key: 'single2', labelKey: 'single' },
  { key: 'dual1', labelKey: 'dual' },
  { key: 'dual2', labelKey: 'dual' }
]

function faceTypes(die, key) {
  if (key === 'convex') return [die.convexType]
  if (key === 'concave') return [die.concaveType]
  if (key === 'single1') return die.singleSlots[0] ? [die.singleSlots[0].type] : []
  if (key === 'single2') return die.singleSlots[1] ? [die.singleSlots[1].type] : []
  if (key === 'dual1') return die.dualSlots[0] ? die.dualSlots[0].types : []
  if (key === 'dual2') return die.dualSlots[1] ? die.dualSlots[1].types : []
  return []
}

// A single source of truth for the face-cell size, in rem — everything else (the dual-slot
// mini icons, their inset, and the divider line's length) is derived from it proportionally.
const CELL = 2.5
const MINI = CELL * 9 / 24
const INSET = CELL * 1 / 24
const DIVIDER_LEN = CELL * Math.SQRT2

// --- energy picker popup ---
// convex/concave faces are fixed to their own type pool (5-way / 4-way single pick).
// Round sockets hold one single-energy chip (any of the 9 types); square sockets hold one
// dual-energy chip, so picking there means choosing 2 distinct types (diagonal split).
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

function openPicker(dieIndex, faceKey) {
  editingSlot.value = { dieIndex, faceKey }
}

function closePicker() {
  editingSlot.value = null
}

function isTypeSelected(type) {
  const meta = currentMeta.value
  if (!meta || !editingSlot.value) return false
  const die = dice.value[editingSlot.value.dieIndex]
  if (meta.kind === 'convex') return die.convexType === type
  if (meta.kind === 'concave') return die.concaveType === type
  if (meta.kind === 'single') return die.singleSlots[meta.slotIndex].type === type
  return false
}

// A dual-energy chip's 2 types are picked independently, one row of type icons per slot
// half — the two halves can be the same type.
const currentDualTypes = computed(() => {
  const es = editingSlot.value
  const meta = currentMeta.value
  if (!es || !meta || meta.kind !== 'dual') return [null, null]
  return dice.value[es.dieIndex].dualSlots[meta.slotIndex].types
})

function setDualType(idx, type) {
  const es = editingSlot.value
  const meta = currentMeta.value
  if (!es || !meta || meta.kind !== 'dual') return
  dice.value[es.dieIndex].dualSlots[meta.slotIndex].types[idx] = type
}

const pickerTitleKey = computed(() => {
  const kind = currentMeta.value ? currentMeta.value.kind : null
  if (kind === 'convex') return 'diceBuilder.picker.convexTitle'
  if (kind === 'concave') return 'diceBuilder.picker.concaveTitle'
  if (kind === 'single') return 'diceBuilder.picker.singleTitle'
  if (kind === 'dual') return 'diceBuilder.picker.dualTitle'
  return ''
})

function pickType(type) {
  const es = editingSlot.value
  const meta = currentMeta.value
  if (!es || !meta) return
  const die = dice.value[es.dieIndex]

  if (meta.kind === 'convex') {
    die.convexType = type
  } else if (meta.kind === 'concave') {
    die.concaveType = type
  } else if (meta.kind === 'single') {
    die.singleSlots[meta.slotIndex] = { kind: 'single', type }
  }
  closePicker()
}

// --- quick pure-type apply ---
// Sets every die's round/square sockets to the same single type in one go, plus whichever
// fixed face the picked type actually belongs to (skip the convex face for a concave-pool
// type, and vice versa — the fixed face on the OTHER pool is left as-is since the picked
// type can never legally sit there). Applies to all 3 dice regardless of the "same as die 1"
// checkboxes.
const showQuickApply = ref(false)

function applyPureType(type) {
  const isConvexType = CONVEX_TYPES.includes(type)
  dice.value.forEach(die => {
    if (isConvexType) {
      die.convexType = type
    } else {
      die.concaveType = type
    }
    die.singleSlots[0].type = type
    die.singleSlots[1].type = type
    die.dualSlots[0].types = [type, type]
    die.dualSlots[1].types = [type, type]
  })
  showQuickApply.value = false
}

// --- roll simulation ---
const ALL_FACE_KEYS = FACE_ROWS.map(row => row.key)
const rollResults = ref(null) // [{ faceKey, types }, ...] | null

// The character die (キャラコロ) is a separate, fixed 6-face die — not part of the energy
// die being assembled above — using the up/down/left/right/upright/reversed orientation
// icons that character-die move effects already reference elsewhere in the app.
const CHARA_DIE_FACES = ['上', '下', '左', '右', '立', '逆']
const charaRollResult = ref(null)

function rollDice() {
  rollResults.value = dice.value.map(die => {
    const faceKey = ALL_FACE_KEYS[Math.floor(Math.random() * ALL_FACE_KEYS.length)]
    return { faceKey, types: faceTypes(die, faceKey) }
  })
  charaRollResult.value = CHARA_DIE_FACES[Math.floor(Math.random() * CHARA_DIE_FACES.length)]
}

// --- probability table ---
// All 3 dice are rolled together (6x6x6 = 216 equally-likely face combinations). Rather than
// listing all 216 permutations, each one collapses to the multiset of energy types it grants
// (regardless of which die contributed which face or what order), and those 216 outcomes get
// grouped/tallied by that resulting type set.
const showProbTable = ref(false)
const TOTAL_ROLLS = ALL_FACE_KEYS.length ** 3

function sortByChipOrder(types) {
  return [...types].sort((a, b) => CHIP_TYPES.indexOf(a) - CHIP_TYPES.indexOf(b))
}

const probCombos = computed(() => {
  const byKey = new Map()
  for (const faceA of ALL_FACE_KEYS) {
    for (const faceB of ALL_FACE_KEYS) {
      for (const faceC of ALL_FACE_KEYS) {
        const types = sortByChipOrder([
          ...faceTypes(dice.value[0], faceA),
          ...faceTypes(dice.value[1], faceB),
          ...faceTypes(dice.value[2], faceC)
        ])
        const key = types.join(',')
        if (!byKey.has(key)) byKey.set(key, { types, count: 0 })
        byKey.get(key).count += 1
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count)
})

// "Only show" filter: multi-select among the energy types actually present on the 3 dice
// right now (not the full 9), narrowing the list to combos that contain every selected type.
const diceHaveTypes = computed(() => {
  const present = new Set()
  dice.value.forEach(die => {
    ALL_FACE_KEYS.forEach(faceKey => faceTypes(die, faceKey).forEach(ty => present.add(ty)))
  })
  return CHIP_TYPES.filter(ty => present.has(ty))
})

const probFilterTypes = ref([])

function toggleProbFilter(type) {
  const idx = probFilterTypes.value.indexOf(type)
  if (idx >= 0) probFilterTypes.value.splice(idx, 1)
  else probFilterTypes.value.push(type)
}

const filteredProbCombos = computed(() => {
  if (probFilterTypes.value.length === 0) return probCombos.value
  return probCombos.value.filter(combo => combo.types.every(ty => probFilterTypes.value.includes(ty)))
})

// "Group by count" — pick one energy type and combos are bucketed by how many of that type
// they contain (e.g. "3 fire" covers both fire/fire/fire/water and fire/fire/fire/water/water),
// each bucket showing its combined probability, sorted by that count descending; within a
// bucket the individual combos that make it up are still listed with their own probability.
const groupByType = ref(null)
// Which bucket counts (the "n" of "n fire") are currently expanded to show their individual
// combos — collapsed by default so the grouped view starts as just the summary rows.
const expandedGroupCounts = reactive(new Set())

function toggleGroupBy(type) {
  groupByType.value = groupByType.value === type ? null : type
  expandedGroupCounts.clear()
}

function toggleGroupExpanded(n) {
  if (expandedGroupCounts.has(n)) expandedGroupCounts.delete(n)
  else expandedGroupCounts.add(n)
}

const groupedProbCombos = computed(() => {
  if (!groupByType.value) return null
  const groups = new Map() // count of groupByType in combo -> { n, totalCount, combos }
  filteredProbCombos.value.forEach(combo => {
    const n = combo.types.filter(ty => ty === groupByType.value).length
    if (!groups.has(n)) groups.set(n, { n, totalCount: 0, combos: [] })
    const g = groups.get(n)
    g.totalCount += combo.count
    g.combos.push(combo)
  })
  groups.forEach(g => g.combos.sort((a, b) => b.count - a.count))
  return [...groups.values()].sort((a, b) => b.n - a.n)
})
</script>

<template>
  <div v-if="showProbTable" class="board select-board" style="overflow-y:auto; align-items:center;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem;">{{ t('diceBuilder.probTitle') }}</div>
    <div class="center-hint" style="padding-bottom:0.375rem;">{{ t('diceBuilder.probHint') }}</div>

    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; width:100%; max-width:40rem; padding:0 0.625rem 0.625rem;">
      <div style="display:flex; align-items:center; gap:0.375rem; flex-wrap:wrap;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('diceBuilder.probFilterLabel') }}</span>
        <div
          v-for="ty in diceHaveTypes"
          :key="ty"
          @click="toggleProbFilter(ty)"
          :style="{
            width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', overflow: 'hidden',
            background: '#fff', cursor: 'pointer',
            border: probFilterTypes.includes(ty) ? '0.1875rem solid #AEFF3E' : '0.125rem solid var(--line)'
          }"
        >
          <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:0.375rem; flex-wrap:wrap; justify-content:flex-end;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('diceBuilder.probGroupLabel') }}</span>
        <div
          v-for="ty in diceHaveTypes"
          :key="ty"
          @click="toggleGroupBy(ty)"
          :style="{
            width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', overflow: 'hidden',
            background: '#fff', cursor: 'pointer',
            border: groupByType === ty ? '0.1875rem solid #AEFF3E' : '0.125rem solid var(--line)'
          }"
        >
          <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
        </div>
      </div>
    </div>

    <div style="width:100%; max-width:40rem; padding:0 0.625rem;">
      <div v-if="groupByType" style="display:flex; flex-direction:column; gap:0.625rem;">
        <div v-for="group in groupedProbCombos" :key="group.n">
          <div
            @click="toggleGroupExpanded(group.n)"
            style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.3125rem 0.375rem; background:rgba(0,0,0,.05); border-radius:0.375rem; cursor:pointer;"
          >
            <span style="display:flex; align-items:center; gap:0.3125rem; font-size:0.8125rem; font-weight:800;">
              <span style="font-size:0.625rem; color:var(--sub); width:0.75rem; display:inline-block;">{{ expandedGroupCounts.has(group.n) ? '▼' : '▶' }}</span>
              <span style="width:1.25rem; height:1.25rem; border-radius:0.3125rem; overflow:hidden; background:#fff; border:0.09375rem solid var(--line); flex-shrink:0;">
                <img :src="asset(`image/ICON/${groupByType}.png`)" class="img-icon" :alt="groupByType">
              </span>
              × {{ group.n }}
            </span>
            <span style="font-size:0.75rem; font-weight:800; color:var(--sub);">{{ group.totalCount }}/{{ TOTAL_ROLLS }}（{{ (group.totalCount / TOTAL_ROLLS * 100).toFixed(1) }}%）</span>
          </div>
          <template v-if="expandedGroupCounts.has(group.n)">
            <div v-for="combo in group.combos" :key="combo.types.join(',')" style="display:flex; align-items:center; justify-content:space-between; gap:0.625rem; padding:0.25rem 0.125rem 0.25rem 0.875rem; border-bottom:1px solid var(--line);">
              <div style="display:flex; gap:0.1875rem; flex-wrap:wrap;">
                <div v-for="(ty, ti) in combo.types" :key="ti" style="width:1.375rem; height:1.375rem; border-radius:0.3125rem; overflow:hidden; background:#fff; border:0.09375rem solid var(--line); flex-shrink:0;">
                  <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
                </div>
              </div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--sub); text-align:right; flex-shrink:0;">
                {{ combo.count }}/{{ TOTAL_ROLLS }}（{{ (combo.count / TOTAL_ROLLS * 100).toFixed(1) }}%）
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:0.375rem;">
        <div v-for="combo in filteredProbCombos" :key="combo.types.join(',')" style="display:flex; align-items:center; justify-content:space-between; gap:0.625rem; padding:0.25rem 0.125rem; border-bottom:1px solid var(--line);">
          <div style="display:flex; gap:0.1875rem; flex-wrap:wrap;">
            <div v-for="(ty, ti) in combo.types" :key="ti" style="width:1.5rem; height:1.5rem; border-radius:0.3125rem; overflow:hidden; background:#fff; border:0.09375rem solid var(--line); flex-shrink:0;">
              <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
            </div>
          </div>
          <div style="font-size:0.75rem; font-weight:800; color:var(--sub); text-align:right; flex-shrink:0;">
            {{ combo.count }}/{{ TOTAL_ROLLS }}（{{ (combo.count / TOTAL_ROLLS * 100).toFixed(1) }}%）
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:center; padding:0.875rem 0 0.25rem;">
      <button class="btn secondary" @click="showProbTable = false">{{ t('common.back') }}</button>
    </div>
  </div>

  <div v-else class="board select-board" style="overflow-y:auto; align-items:center;">
    <div class="modal-title" style="margin:0.5rem 0 0.25rem;">{{ t('diceBuilder.title') }}</div>
    <div class="center-hint" style="padding-bottom:0.375rem;">{{ t('diceBuilder.hint') }}</div>

    <div class="select-card" style="width:100%; max-width:47.5rem; align-items:stretch; padding:0.875rem;">
      <div style="display:grid; grid-template-columns: 4.375rem repeat(6, 1fr); gap:0.5rem 0.375rem; align-items:center;">
        <div></div>
        <div v-for="row in FACE_ROWS" :key="row.key" style="font-size:0.8125rem; font-weight:800; color:var(--sub); text-align:center;">{{ t('diceBuilder.face.' + row.labelKey) }}</div>

        <template v-for="(die, di) in dice" :key="di">
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.1875rem;">
            <span style="font-size:0.875rem; font-weight:800;">{{ t('diceBuilder.die', { n: di + 1 }) }}</span>
            <label v-if="di > 0" style="display:flex; align-items:center; gap:0.1875rem; font-size:0.625rem; font-weight:800; color:var(--sub); cursor:pointer;">
              <input type="checkbox" :checked="sameAsDie1[di - 1]" @change="onToggleSame(di, $event.target.checked)" style="width:0.75rem; height:0.75rem; margin:0;">
              {{ t('diceBuilder.sameAsDie1Short') }}
            </label>
          </div>
          <div v-for="row in FACE_ROWS" :key="row.key" style="display:flex; justify-content:center; cursor:pointer;" @click="openPicker(di, row.key)">
            <div
              v-if="faceTypes(die, row.key).length > 0"
              :style="{ position: 'relative', width: CELL + 'rem', height: CELL + 'rem', borderRadius: '0.5rem', overflow: 'hidden', background: '#fff', border: '0.125rem solid var(--line)', flexShrink: 0 }"
            >
              <template v-if="faceTypes(die, row.key).length > 1">
                <div :style="{ position: 'absolute', top: '50%', left: '50%', width: DIVIDER_LEN + 'rem', height: '0.09375rem', background: 'var(--line)', transform: 'translate(-50%,-50%) rotate(-45deg)' }"></div>
                <img :src="asset(`image/ICON/${faceTypes(die, row.key)[0]}.png`)" class="img-icon" :alt="faceTypes(die, row.key)[0]" :style="{ position: 'absolute', top: INSET + 'rem', left: INSET + 'rem', width: MINI + 'rem', height: MINI + 'rem' }">
                <img :src="asset(`image/ICON/${faceTypes(die, row.key)[1]}.png`)" class="img-icon" :alt="faceTypes(die, row.key)[1]" :style="{ position: 'absolute', bottom: INSET + 'rem', right: INSET + 'rem', width: MINI + 'rem', height: MINI + 'rem' }">
              </template>
              <img v-else :src="asset(`image/ICON/${faceTypes(die, row.key)[0]}.png`)" class="img-icon" :alt="faceTypes(die, row.key)[0]">
            </div>
            <div v-else :style="{ width: CELL + 'rem', height: CELL + 'rem', borderRadius: '0.5rem', border: '0.125rem dashed var(--sub)', flexShrink: 0 }"></div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="rollResults" style="display:flex; gap:0.875rem; justify-content:center; padding-top:0.75rem;">
      <div v-for="(res, ri) in rollResults" :key="ri" style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
        <div style="font-size:0.6875rem; font-weight:800; color:var(--sub);">{{ t('diceBuilder.die', { n: ri + 1 }) }}</div>
        <div :style="{ position: 'relative', width: CELL + 'rem', height: CELL + 'rem', borderRadius: '0.5rem', overflow: 'hidden', background: '#fff', border: '0.125rem solid var(--line)', flexShrink: 0 }">
          <template v-if="res.types.length > 1">
            <div :style="{ position: 'absolute', top: '50%', left: '50%', width: DIVIDER_LEN + 'rem', height: '0.09375rem', background: 'var(--line)', transform: 'translate(-50%,-50%) rotate(-45deg)' }"></div>
            <img :src="asset(`image/ICON/${res.types[0]}.png`)" class="img-icon" :alt="res.types[0]" :style="{ position: 'absolute', top: INSET + 'rem', left: INSET + 'rem', width: MINI + 'rem', height: MINI + 'rem' }">
            <img :src="asset(`image/ICON/${res.types[1]}.png`)" class="img-icon" :alt="res.types[1]" :style="{ position: 'absolute', bottom: INSET + 'rem', right: INSET + 'rem', width: MINI + 'rem', height: MINI + 'rem' }">
          </template>
          <img v-else :src="asset(`image/ICON/${res.types[0]}.png`)" class="img-icon" :alt="res.types[0]">
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
        <div style="font-size:0.6875rem; font-weight:800; color:var(--sub);">{{ t('diceBuilder.charaDie') }}</div>
        <div :style="{ width: CELL + 'rem', height: CELL + 'rem', borderRadius: '0.5rem', overflow: 'hidden', background: '#fff', border: '0.125rem solid var(--line)', flexShrink: 0 }">
          <img :src="asset(`image/ICON/${charaRollResult}.png`)" class="img-icon" :alt="charaRollResult">
        </div>
      </div>
    </div>

    <div style="display:flex; gap:0.625rem; justify-content:center; flex-wrap:wrap; padding:0.875rem 0 0.25rem;">
      <button class="btn" @click="rollDice">{{ t('diceBuilder.rollButton') }}</button>
      <button class="btn secondary" @click="showQuickApply = true">{{ t('diceBuilder.quickApplyButton') }}</button>
      <button class="btn secondary" @click="showProbTable = true; probFilterTypes = []; groupByType = null; expandedGroupCounts.clear()">{{ t('diceBuilder.probButton') }}</button>
      <button class="btn secondary" @click="reroll">{{ t('diceBuilder.reroll') }}</button>
      <button class="btn secondary" @click="emit('back')">{{ t('common.back') }}</button>
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
      <div style="display:flex; flex-wrap:wrap; gap:0.625rem; justify-content:center;">
        <div
          v-for="ty in CHIP_TYPES"
          :key="ty"
          @click="applyPureType(ty)"
          style="width:2.75rem; height:2.75rem; border-radius:0.5rem; overflow:hidden; background:#fff; cursor:pointer; border:0.125rem solid var(--line);"
        >
          <img :src="asset(`image/ICON/${ty}.png`)" class="img-icon" :alt="ty">
        </div>
      </div>
    </div>
  </div>

</template>
