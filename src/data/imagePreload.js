import { TYPE_BG_COLORS } from './constants'
import { asset } from './assetPath'
import { lowData } from './lowDataMode'

// 骰子圖示。這幾張到處都會出現，而且加起來不到一百 KB，開場抓掉是划算的。
export const PRELOAD_IMAGE_PATHS = [
  asset("image/ICON/キャラコロ.png"),
  asset("image/ICON/エネコロ1.png"),
  asset("image/ICON/エネコロ2.png"),
  asset("image/ICON/エネコロ3.png"),
  asset("image/ICON/エネコロ4.png"),
  asset("image/ICON/エネコロ5.png"),
  asset("image/ICON/エネコロ6.png")
]

// 招式卡的滿版底圖，一種屬性一張。
//
// 這幾張不跟上面那批一起抓：它們只在看得到招式卡的地方才用得上，而首頁一張都不會
// 顯示。玩家在手機上開這個網站，第一個畫面就替他決定要不要花掉這些流量，是這個
// app 不該替他做的決定 —— 所以改成離開首頁之後才補。
//
// 補的時機仍然早於真正用到的那一刻（進任何一個模式就開始），所以進對戰時底圖還是
// 已經在快取裡，不會看到卡片先空白一下才上色。
export const BACKDROP_IMAGE_PATHS =
  Object.keys(TYPE_BG_COLORS).map(t => asset(`image/BACK/back_${t}.webp`))

const IMAGE_LOAD_CACHE_KEY = "plakoro_image_load_cache_v1"

function readImageLoadCache() {
  try {
    const raw = localStorage.getItem(IMAGE_LOAD_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (e) {
    return {}
  }
}

function markImageLoaded(src) {
  try {
    const cache = readImageLoadCache()
    if (!cache[src]) {
      cache[src] = Date.now()
      localStorage.setItem(IMAGE_LOAD_CACHE_KEY, JSON.stringify(cache))
    }
  } catch (e) {}
}

function loadImageWithTimeout(src, timeoutMs) {
  return new Promise(resolve => {
    let settled = false
    const img = new Image()
    const finish = () => {
      if (settled) return
      settled = true
      resolve(img)
    }
    img.onload = () => {
      markImageLoaded(src)
      finish()
    }
    img.onerror = finish
    setTimeout(finish, timeoutMs)
    img.src = src
  })
}

export function preloadEssentialImages() {
  // 攔在這裡而不是 PRELOAD_IMAGE_PATHS：那個陣列在模組載入時就算好了，之後才開啟
  // 低流量模式的話它裡面還是真實網址。
  if (lowData.value) return Promise.resolve([])
  const cache = readImageLoadCache()
  const tasks = PRELOAD_IMAGE_PATHS.map(src => {
    const timeoutMs = cache[src] ? 1500 : 4000
    return loadImageWithTimeout(src, timeoutMs)
  })
  return Promise.all(tasks)
}

// 只跑一次。玩家在模式之間來回切換很常見，而這批圖抓過就在瀏覽器快取裡了，重跑只
// 是多建十一個 Image 物件。
let backdropsStarted = false

export function preloadBattleBackdrops() {
  if (lowData.value || backdropsStarted) return Promise.resolve([])
  backdropsStarted = true
  const cache = readImageLoadCache()
  return Promise.all(BACKDROP_IMAGE_PATHS.map(src =>
    loadImageWithTimeout(src, cache[src] ? 1500 : 4000)
  ))
}

export function preloadCharacterImages(characters) {
  if (lowData.value) return Promise.resolve([])
  const cache = readImageLoadCache()
  const tasks = characters.filter(c => c.imageUrl).map(c => {
    const timeoutMs = cache[c.imageUrl] ? 1500 : 4000
    return loadImageWithTimeout(c.imageUrl, timeoutMs)
  })
  return Promise.all(tasks)
}
