import { TYPE_BG_COLORS } from './constants'

export const PRELOAD_IMAGE_PATHS = [
  "/image/ICON/キャラコロ.png",
  "/image/ICON/エネコロ1.png",
  "/image/ICON/エネコロ2.png",
  "/image/ICON/エネコロ3.png",
  "/image/ICON/エネコロ4.png",
  "/image/ICON/エネコロ5.png",
  "/image/ICON/エネコロ6.png",
  ...Object.keys(TYPE_BG_COLORS).map(t => `/image/BACK/back_${t}.png`)
]

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
  const cache = readImageLoadCache()
  const tasks = PRELOAD_IMAGE_PATHS.map(src => {
    const timeoutMs = cache[src] ? 1500 : 4000
    return loadImageWithTimeout(src, timeoutMs)
  })
  return Promise.all(tasks)
}

export function preloadCharacterImages(characters) {
  const cache = readImageLoadCache()
  const tasks = characters.filter(c => c.imageUrl).map(c => {
    const timeoutMs = cache[c.imageUrl] ? 1500 : 4000
    return loadImageWithTimeout(c.imageUrl, timeoutMs)
  })
  return Promise.all(tasks)
}
