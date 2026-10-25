// The unreleased half of the app, behind a knock on the version number.
//
// Some cards are in the data and playable but not announced yet (see `battle_ready` in
// localCards.json). They are covered with 「即將推出」 in the battle pickers rather than hidden,
// because people do want to look them up — but there also has to be a way to actually play
// them before launch day, for testing and for whoever is let in early.
//
// Six taps on the version number in the corner. Nothing on screen advertises it; the only
// acknowledgement is the wordmark picking up a small (BETA), which is also the thing that
// stops someone wondering later why their roster looks different from a friend's.
import { ref, computed } from 'vue'

const STORAGE_KEY = 'plakoro_beta_v1'
const TAPS_REQUIRED = 6

// How long a run of taps stays a run. Long enough to be unhurried, short enough that six
// unrelated taps spread over a session never add up to one.
const TAP_WINDOW_MS = 1500

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch (e) {
    return false
  }
}

const on = ref(load())

export const isBeta = computed(() => on.value)

function persist() {
  try {
    if (on.value) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    // Same stance as the rest of the app's storage: not surviving a reload is a smaller
    // problem than refusing to turn on at all.
  }
}

let taps = 0
let lastTap = 0

/**
 * One tap on the version number. Returns true on the tap that flips it, so the caller can
 * make a noise about it; every other tap returns false and looks like nothing happened.
 *
 * Six more taps turn it back off — an easter egg with no way out is a support question.
 */
export function tapVersion() {
  const now = Date.now()
  taps = now - lastTap > TAP_WINDOW_MS ? 1 : taps + 1
  lastTap = now
  if (taps < TAPS_REQUIRED) return false
  taps = 0
  on.value = !on.value
  persist()
  return true
}
