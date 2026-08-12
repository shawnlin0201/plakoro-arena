import { onMounted, onUnmounted, reactive } from 'vue'

export function useStageLayout(stageEl) {
  // The logical (pre-rotation) pixel size of the game canvas, kept in sync with the stage
  // element itself — descendants that need to size themselves to "the actual visible screen"
  // (rather than trusting a DOM ancestor's resolved flex height, which can be indirect and
  // timing-sensitive) can inject and read this instead.
  const stageSize = reactive({ width: 0, height: 0 })

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
    stageSize.width = stageW
    stageSize.height = stageH
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

  return { stageSize }
}
