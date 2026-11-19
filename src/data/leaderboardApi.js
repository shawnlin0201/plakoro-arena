// The standings board, read from the server every time it is opened.
//
// Not cached and not derived from anything local: a ranking is only worth looking at if it is
// current, and the numbers behind it live in matches nobody's browser has a copy of.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

/**
 * One leaderboard row's win rate, as a whole percent, or null if nothing has been decided yet.
 *
 * Decided matches only, matching playerBadges.winRate — a bye scores in the standings but says
 * nothing about the player, and counting it would inflate everyone who ever sat out a round.
 *
 * Lives here rather than in the board's own component because the profile badge shows the same
 * figure: two copies of this arithmetic is two numbers that can disagree about one player.
 */
export function winRatePercent(r) {
  const played = (r.wins || 0) + (r.losses || 0) + (r.draws || 0)
  if (!played) return null
  return Math.round((r.wins / played) * 100)
}

/**
 * @param {'offline'|'online'} scope
 * @param {'year'|'all'} window
 * @param {string|null} code  the viewer's own code, so the server can send back their rank even
 *                            when they are past the hundred rows it returns. Optional: the board
 *                            is public and readable while signed out.
 */
export async function fetchLeaderboard(scope = 'offline', window = 'all', code = null) {
  const q = new URLSearchParams({ scope, window })
  if (code) q.set('code', code)
  const res = await fetch(`${API_BASE}/api/leaderboard?${q}`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`)
  return data
}
