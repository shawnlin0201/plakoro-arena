// Background music: one Audio element, a fixed playlist, looping forever. A module-level
// singleton rather than a composable — there is exactly one soundtrack for the whole app
// regardless of how many components come and go, the same reasoning useDiceRoll3D.js's shared
// `rollAudio` already follows. Exposes reactive state (current track, playing/paused) and
// transport controls so a player widget can show and drive it.
import { ref, watch } from 'vue'
import { asset } from './assetPath'
import { audioSettings } from './audioSettings'

// Filenames read as `<artist>-<title words>.mp3` — not a format this project defined, just
// what the three tracks already dropped into public/music/ happen to follow.
const TRACK_FILES = [
  'Kolomna-nice-on-the-soul.mp3',
  'ShimaFM-why-no.mp3',
  'lnplusmusic-urban-street-city.mp3'
]

function parseTrack(file) {
  const [artist, ...words] = file.replace(/\.[^.]+$/, '').split('-')
  const title = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return { artist, title, url: asset(`music/${file}`) }
}

export const TRACKS = TRACK_FILES.map(parseTrack)

const player = new Audio()
export const currentIndex = ref(0)
export const isPlaying = ref(false)
let started = false

function applyVolume() {
  player.volume = audioSettings.value.muted ? 0 : audioSettings.value.volume
}

function loadTrack(i, autoplay) {
  started = true
  currentIndex.value = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length
  player.src = TRACKS[currentIndex.value].url
  applyVolume()
  if (autoplay) player.play().catch(() => {})
}

player.addEventListener('ended', () => loadTrack(currentIndex.value + 1, true))
player.addEventListener('play', () => { isPlaying.value = true })
player.addEventListener('pause', () => { isPlaying.value = false })

// Reacts immediately to the slider/mute toggle regardless of whether music has started yet.
watch(audioSettings, applyVolume, { immediate: true })

export function nextTrack() {
  loadTrack(currentIndex.value + 1, true)
}
export function prevTrack() {
  loadTrack(currentIndex.value - 1, true)
}

// Also the first-press path: nothing is loaded into the element until someone asks for music,
// so the first press has a track to put there before it can play one.
export function togglePlay() {
  if (!started) {
    loadTrack(currentIndex.value, true)
    return
  }
  if (player.paused) player.play().catch(() => {})
  else player.pause()
}

// NOTE nothing starts the music on its own.
//
// It used to: the first pointerdown or keydown anywhere on the page started track 1, because
// browsers block audio until the page has been interacted with and that was the earliest
// moment it was allowed. But "allowed to" is not "asked to" — opening the app in a quiet room,
// at a table, or next to someone else's game and having it start singing is the app taking a
// decision that belongs to whoever is holding the phone.
//
// So silence is the default, and the play button in MusicPlayer.vue is the only way in. That
// button is a real user gesture, which is exactly what the autoplay policy wants anyway.
