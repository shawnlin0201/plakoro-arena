<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({ players: { type: Array, required: true } })
const { t } = useI18n()

// Eligibility is local, ephemeral UI state (not part of the saved tournament) — the organizer
// checks people in/out of the prize pool per draw (e.g. unchecking a previous winner before
// drawing again), and there's no reason that should follow the tournament across reloads.
// Pre-populated with every known player id at setup time, all true, so Vue's reactivity tracks
// each key from the start rather than relying on properties added later.
const eligibility = reactive(Object.fromEntries(props.players.map(p => [p.id, true])))

const eligiblePlayers = computed(() => props.players.filter(p => eligibility[p.id]))
const sliceAngle = computed(() => (eligiblePlayers.value.length > 0 ? 360 / eligiblePlayers.value.length : 360))

const WHEEL_COLORS = ['#FFACAC', '#FFE58A', '#B8E6C0', '#A8D4EA', '#DCC4EC', '#C6E6FA', '#FFC79A', '#D3D6DA']
const wheelGradient = computed(() => {
  const n = eligiblePlayers.value.length
  if (n === 0) return WHEEL_COLORS[0]
  const seg = 360 / n
  const stops = []
  for (let i = 0; i < n; i++) {
    stops.push(`${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
  }
  return `conic-gradient(${stops.join(', ')})`
})

const wheelRotation = ref(0)
const spinning = ref(false)
const winner = ref(null)

// Accelerate for 4s, decelerate for 14s (18s total) — long and slow enough near the end that
// several slices each visibly get a moment of "is it this one?" before it finally settles.
// Asymmetric, so a plain CSS easing curve won't do; this integrates a constant angular
// acceleration then a constant deceleration by hand, each frame, via requestAnimationFrame.
const ACCEL_SEC = 4
const DECEL_SEC = 14
const TOTAL_SEC = ACCEL_SEC + DECEL_SEC

let rafId = null
let spinStartTime = 0
let spinStartRotation = 0
let totalSpinDelta = 0
let pendingWinnerIndex = -1

// The winner is chosen uniformly at random FIRST — the animation's landing angle is then
// derived to match it, rather than letting wherever the animation happens to stop decide the
// winner. That keeps the draw fair regardless of animation timing/rounding.
function startSpin() {
  const n = eligiblePlayers.value.length
  if (spinning.value || n === 0) return
  winner.value = null

  const seg = 360 / n
  pendingWinnerIndex = Math.floor(Math.random() * n)
  // Landing exactly on a slice's midpoint every time is dull, and gives away "is this the one?"
  // too early during the final crawl — landing at a random point within the slice instead (never
  // quite at the boundary, so which slice won stays unambiguous) means the pointer can end up
  // near an edge, so a neighboring slice genuinely looks like it might be the one right up until
  // it isn't.
  const withinSlice = 0.08 + Math.random() * 0.84
  const targetMod = (((-(pendingWinnerIndex + withinSlice) * seg) % 360) + 360) % 360
  const currentMod = ((wheelRotation.value % 360) + 360) % 360
  const delta = ((targetMod - currentMod) % 360 + 360) % 360
  const EXTRA_SPINS = 6
  totalSpinDelta = delta + EXTRA_SPINS * 360

  spinStartRotation = wheelRotation.value
  spinStartTime = performance.now()
  spinning.value = true

  // Total distance = distance covered accelerating for ACCEL_SEC + decelerating for DECEL_SEC,
  // given a peak velocity `maxVel` (deg/s) reached at t=ACCEL_SEC: accel phase covers
  // 0.5*(maxVel/ACCEL_SEC)*ACCEL_SEC² = 0.5*maxVel*ACCEL_SEC; decel phase covers
  // maxVel*DECEL_SEC - 0.5*(maxVel/DECEL_SEC)*DECEL_SEC² = 0.5*maxVel*DECEL_SEC. Solving
  // totalSpinDelta = 0.5*maxVel*(ACCEL_SEC+DECEL_SEC) for maxVel:
  const maxVel = (2 * totalSpinDelta) / (ACCEL_SEC + DECEL_SEC)
  const accel1 = maxVel / ACCEL_SEC
  const accel2 = maxVel / DECEL_SEC
  const dist1 = 0.5 * accel1 * ACCEL_SEC * ACCEL_SEC

  const frame = now => {
    const elapsed = (now - spinStartTime) / 1000
    if (elapsed >= TOTAL_SEC) {
      wheelRotation.value = spinStartRotation + totalSpinDelta
      spinning.value = false
      winner.value = eligiblePlayers.value[pendingWinnerIndex]
      rafId = null
      return
    }
    let angle
    if (elapsed <= ACCEL_SEC) {
      angle = 0.5 * accel1 * elapsed * elapsed
    } else {
      const t2 = elapsed - ACCEL_SEC
      angle = dist1 + maxVel * t2 - 0.5 * accel2 * t2 * t2
    }
    wheelRotation.value = spinStartRotation + angle
    rafId = requestAnimationFrame(frame)
  }
  rafId = requestAnimationFrame(frame)
}

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

// The draw button lives in the parent's bottom action row (next to the back button) rather
// than inside this component's own layout — exposed here so the parent can trigger/gate it.
const canSpin = computed(() => eligiblePlayers.value.length > 0)
defineExpose({ startSpin, spinning, canSpin })
</script>

<template>
  <!-- overflow:hidden here — a rotating wheel's transformed bounding box can flicker the
       container's scrollbar in and out during the spin; the player list's own inner div still
       scrolls normally, this just stops the outer wrapper itself from ever scrolling. -->
  <div style="display:flex; gap:0.75rem; height:100%; min-height:0; overflow:hidden;">
    <div style="flex:1.2; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.625rem;">
      <div style="position:relative; width:100%; max-width:13rem;">
        <div style="position:absolute; top:-0.5rem; left:50%; transform:translateX(-50%); font-size:1.125rem; z-index:2; color:#000; line-height:1;">▼</div>
        <div style="position:relative; width:100%; padding-top:100%;">
          <div
            style="position:absolute; inset:0; border-radius:50%; overflow:hidden; box-shadow:var(--shadow); border:0.1875rem solid #fff;"
            :style="{ transform: `rotate(${wheelRotation}deg)`, background: wheelGradient }"
          >
            <!-- Each label's own wrapper spans the whole wheel (not just a quadrant) and
                 rotates around its center, which IS the wheel's center — a slice's label sits
                 near the wheel's true top edge before rotation, then the whole wrapper (label
                 included) rotates by that slice's own angle. That makes the text's orientation
                 tangent to the circle: horizontal at 12 o'clock, rotating progressively as its
                 slice sweeps around — rather than the old approach, which anchored each label
                 inside a quarter-wheel box offset from center and made both its position and
                 the "which slice is this" alignment wrong (this is almost certainly also what
                 caused the wheel's stopped position and the announced winner to disagree). -->
            <div
              v-for="(p, i) in eligiblePlayers"
              :key="p.id"
              style="position:absolute; inset:0;"
              :style="{ transform: `rotate(${i * sliceAngle + sliceAngle / 2}deg)` }"
            >
              <span
                style="position:absolute; top:6%; left:50%; transform:translateX(-50%); display:inline-block; font-size:0.5625rem; font-weight:800; white-space:nowrap; max-width:4rem; overflow:hidden; text-overflow:ellipsis; text-shadow:0 1px 2px rgba(0,0,0,.45);"
                :style="{ color: winner && winner.id === p.id ? '#000' : '#fff' }"
              >{{ p.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:0.25rem;">
      <div style="font-size:0.75rem; font-weight:800; color:var(--sub); flex-shrink:0;">{{ t('tournament.detail.lotteryPoolLabel') }}</div>
      <div style="flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:0.125rem;">
        <label v-for="p in players" :key="p.id" style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:700; color:var(--ink); padding:0.25rem 0;">
          <input v-model="eligibility[p.id]" type="checkbox" style="width:0.875rem; height:0.875rem; margin:0; flex-shrink:0;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ p.name }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
