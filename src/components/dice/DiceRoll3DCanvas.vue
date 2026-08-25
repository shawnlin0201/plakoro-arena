<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useDiceRoll3D } from '../../composables/useDiceRoll3D'
import shakeSoundUrl from '../../assets/shaking-dice-01.mp3'

const emit = defineEmits(['rolled'])

const canvasRef = ref(null)
let controller = null
let heldPointerId = null

// A press-and-hold gesture on the canvas drives the throw: press gathers the dice into a
// huddle, dragging while held plays a shaking sound, and releasing throws them.
const shakeAudio = new Audio(shakeSoundUrl)
shakeAudio.loop = true
shakeAudio.volume = 0.5

onMounted(() => {
  controller = useDiceRoll3D(canvasRef)
  controller.init()
})

onBeforeUnmount(() => {
  if (controller) controller.dispose()
  shakeAudio.pause()
})

// `faceList` is an array of { canvases, faceByAxis } (see diceTextures.js), one per die to
// place in the tray.
function setDice(faceList) {
  controller.setDice(faceList)
}

// Resolves with the logical face name that landed up on each die, in the same order as the
// last setDice() call. `screenVX`/`screenVY` (screen px/ms) is the pointer's release velocity —
// forwarded to the physics roll so a real flick actually throws the dice that way.
async function roll(screenVX = 0, screenVY = 0) {
  const results = await controller.roll(screenVX, screenVY)
  emit('rolled', results)
  return results
}

let lastClientX = 0
let lastClientY = 0
let lastMoveTime = 0
// Exponential moving average of the pointer's screen velocity (px/ms), so the throw reflects
// the overall flick rather than just the single (possibly near-zero) sample right at release.
let velX = 0
let velY = 0

// Normalized device coordinates (-1..1) of the pointer, for THREE.Raycaster.
function pointerNDC(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
}

function onPointerDown(e) {
  if (!controller || heldPointerId !== null) return
  heldPointerId = e.pointerId
  canvasRef.value.setPointerCapture(heldPointerId)
  lastClientX = e.clientX
  lastClientY = e.clientY
  lastMoveTime = e.timeStamp
  velX = 0
  velY = 0
  controller.gather()
  const { x, y } = pointerNDC(e)
  controller.moveGatherTarget(x, y)
}

function onPointerMove(e) {
  if (heldPointerId !== e.pointerId) return
  if (shakeAudio.paused) shakeAudio.play().catch(() => {}) // needs a user gesture; this is one
  const dt = Math.max(1, e.timeStamp - lastMoveTime)
  const dx = e.clientX - lastClientX
  const dy = e.clientY - lastClientY
  lastClientX = e.clientX
  lastClientY = e.clientY
  lastMoveTime = e.timeStamp
  velX = velX * 0.4 + (dx / dt) * 0.6
  velY = velY * 0.4 + (dy / dt) * 0.6
  const { x, y } = pointerNDC(e)
  controller.moveGatherTarget(x, y)
}

function onPointerUp(e) {
  if (heldPointerId !== e.pointerId) return
  heldPointerId = null
  shakeAudio.pause()
  shakeAudio.currentTime = 0
  // If the pointer already sat still for a bit before release, treat it as a deliberate drop
  // rather than a flick — the tracked velocity is stale, so fade it out.
  const decay = Math.max(0, 1 - (e.timeStamp - lastMoveTime) / 150)
  roll(velX * decay, velY * decay)
  velX = 0
  velY = 0
}

defineExpose({ setDice, roll })
</script>

<template>
  <canvas
    ref="canvasRef"
    style="width:100%; height:100%; display:block; touch-action:none; cursor:grab;"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  ></canvas>
</template>
