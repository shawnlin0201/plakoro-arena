import { onMounted, onUnmounted } from 'vue'

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
