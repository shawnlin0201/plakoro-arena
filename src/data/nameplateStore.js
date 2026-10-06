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

/**
 * Nameplates for a list of tournament players, in the order given.
 *
 * A player with no entry gets one built from what the tournament does know — their name. They
 * are new, or the store has not caught up, and either way a row without a nameplate would read
 * as a rendering bug rather than as "nothing recorded yet".
 */
export function lookupNameplates(players = []) {
  const store = loadNameplates()
  return players.map(p => store[keyFor(p)] || fallbackNameplate(p))
}

export function lookupNameplate(player) {
  if (!player) return null
  return loadNameplates()[keyFor(player)] || fallbackNameplate(player)
}

// Only for tests and for swapping the source during development.
export function __setStore(players) {
  cache = players
}
