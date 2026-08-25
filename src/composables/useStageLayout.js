import { onMounted, onUnmounted, ref } from 'vue'

// The UI was designed against this logical width (a typical phone's portrait width) — root
// font-size scales so every `rem` value in the app tracks the stage's actual rendered size
// instead of staying fixed regardless of how large or small the stage ends up being.
const DESIGN_WIDTH = 375
const ROOT_FONT_SIZE = 16

// Whether #stage is currently rotated 90° (see layoutStage() below) — there's only ever one
// stage, so this is a single shared flag rather than something each caller re-derives. Anything
// that turns raw pointer events (always in true, unrotated viewport coordinates) into
// stage-relative directions — e.g. the 3D dice tray's drag/throw handling — needs this to
// correct for the rotation; see DiceRoll3DCanvas.vue.
export const isStagePortrait = ref(false)

export function useStageLayout(stageEl) {
  function layoutStage() {
    const stage = stageEl.value
    if (!stage) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const isPortrait = vh > vw
    const logicalW = isPortrait ? vh : vw
    const logicalH = isPortrait ? vw : vh
    let stageW = logicalW
    let stageH = stageW * 9 / 16
    if (stageH > logicalH) {
      stageH = logicalH
      stageW = stageH * 16 / 9
    }
    stage.style.width = stageW + 'px'
    stage.style.height = stageH + 'px'
    stage.style.transform = isPortrait ? 'translate(-50%,-50%) rotate(90deg)' : 'translate(-50%,-50%)'
    isStagePortrait.value = isPortrait

    // stageH is always the stage's short edge — the same edge the design's 375px width maps
    // to whether or not the stage is currently rotated for portrait phones.
    document.documentElement.style.fontSize = (ROOT_FONT_SIZE * stageH / DESIGN_WIDTH) + 'px'
  }

  onMounted(() => {
    layoutStage()
    window.addEventListener('resize', layoutStage)
    window.addEventListener('orientationchange', layoutStage)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', layoutStage)
    window.removeEventListener('orientationchange', layoutStage)
  })
}
