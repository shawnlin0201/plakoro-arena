// Where nameplates come from.
//
// The tournament tool knows a player's name and code and nothing else — no avatar, no flag, no
// medal history. It asks here for the rest. That split is the point: a tournament is one
// afternoon, a nameplate is everything before it, and the two have no business living in the
// same record.
//
// Backed by a bundled JSON file today, which is a stand-in. Whatever replaces it — a database,
// an API, a file the organiser imports — swaps in behind `lookupNameplates` without the
// tournament screens noticing, because what they receive is the same shape either way.
import mock from './nameplates.json'
import { parseNameplates, fallbackNameplate, keyFor } from '../game/playerNameplate'

let cache = null

// Validated once, not per lookup: a malformed store is a startup problem, and re-checking it
// on every pairing row would be work done thousands of times to learn the same thing.
export function loadNameplates() {
  if (cache) return cache
  const result = parseNameplates(mock)
  cache = result.ok ? result.players : {}
  if (!result.ok && import.meta.env.DEV) {
    console.warn(`[nameplates] store rejected: ${result.reason}`)
  }
  return cache
}

// The name shown is the one the organiser typed at this event, not the one the store holds.
//
// The store's copy is a snapshot from whenever it was written; the registration sheet is what
// people in the room are looking for. A player who signs up as 小明 this month should read as
// 小明 on the pairing sheet even if the store still says 阿明 — and renaming them in the
// players tab should change the plate immediately, which it would not if the store won.
//
// Everything else — the flag, the face, the title, the record — stays the store's to say.
function withEventName(plate, player) {
  const name = String(player.name || '').trim()
  return name && name !== plate.name ? { ...plate, name } : plate
}

/**
 * Nameplates for a list of tournament players, in the order given.
 *
 * A player with no entry gets one built from what the tournament does know — their name. They
 * are new, or the store has not caught up, and either way a row without a nameplate would read
 * as a rendering bug rather than as "nothing recorded yet".
 */
export function lookupNameplates(players = []) {
  const store = loadNameplates()
  return players.map(p => withEventName(store[keyFor(p)] || fallbackNameplate(p), p))
}

export function lookupNameplate(player) {
  if (!player) return null
  const store = loadNameplates()
  return withEventName(store[keyFor(player)] || fallbackNameplate(player), player)
}

// Only for tests and for swapping the source during development.
export function __setStore(players) {
  cache = players
}
