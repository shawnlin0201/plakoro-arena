// Pure Swiss-system and single-elimination pairing/bracket logic for the tournament scheduler.
// Everything here takes plain data in and returns plain data out — no Vue reactivity — so it's
// trivial to reason about (and console-test) even though this repo has no test runner.

export function shuffle(arr) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const POINTS = { win: 3, draw: 1, loss: 0 }
// Official Play! Pokemon Swiss tiebreakers, applied after raw points: Opponents' Match Win %
// (OMW%), then Opponents' Opponents' Match Win % (OOMW%). Any player's own match-win % is
// floored at 25% before being averaged into someone else's OMW%/OOMW% — otherwise one very weak
// opponent (or a bye-heavy record) could unfairly tank another player's schedule-strength score.
const MATCH_WIN_FLOOR = 0.25

function allMatches(tournament) {
  return tournament.rounds.flatMap(r => r.matches)
}

function averageOver(ids, table) {
  if (ids.length === 0) return 0
  return ids.reduce((sum, id) => sum + (table.get(id) ?? MATCH_WIN_FLOOR), 0) / ids.length
}

// One row per player: wins/losses/draws/points/byes plus the omwp/oomwp tiebreakers, sorted by
// points desc then omwp then oomwp (final tie broken by a stable id compare, never re-shuffled)
// — safe to call every render, since it recomputes from scratch instead of tracking running
// totals that could go stale after an edited result.
export function computeStandings(tournament) {
  const stats = new Map(tournament.players.map(p => [
    p.id,
    { playerId: p.id, name: p.name, wins: 0, losses: 0, draws: 0, points: 0, byes: 0, opponents: [] }
  ]))
  allMatches(tournament).forEach(m => {
    if (m.player2Id === null) {
      const s = stats.get(m.player1Id)
      if (s) { s.wins++; s.points += POINTS.win; s.byes++ }
      return
    }
    if (!m.result) return
    const s1 = stats.get(m.player1Id)
    const s2 = stats.get(m.player2Id)
    if (!s1 || !s2) return
    s1.opponents.push(m.player2Id)
    s2.opponents.push(m.player1Id)
    if (m.result === 'draw') {
      s1.draws++; s2.draws++
      s1.points += POINTS.draw; s2.points += POINTS.draw
    } else {
      const winner = m.result === 'p1' ? s1 : s2
      const loser = m.result === 'p1' ? s2 : s1
      winner.wins++; winner.points += POINTS.win
      loser.losses++
    }
  })

  const matchWinPct = new Map()
  stats.forEach((s, id) => {
    const rounds = s.wins + s.losses + s.draws
    const pct = rounds === 0 ? MATCH_WIN_FLOOR : s.points / (rounds * 3)
    matchWinPct.set(id, Math.max(pct, MATCH_WIN_FLOOR))
  })

  const omwp = new Map()
  stats.forEach((s, id) => omwp.set(id, averageOver(s.opponents, matchWinPct)))

  const oomwp = new Map()
  stats.forEach((s, id) => oomwp.set(id, averageOver(s.opponents, omwp)))

  return [...stats.values()]
    .map(s => ({ ...s, omwp: omwp.get(s.playerId), oomwp: oomwp.get(s.playerId) }))
    .sort((a, b) =>
      b.points - a.points ||
      b.omwp - a.omwp ||
      b.oomwp - a.oomwp ||
      (a.playerId < b.playerId ? -1 : 1)
    )
}

// "Has A already played B" — bye matches don't count as an opponent.
function playedPairsOf(tournament) {
  const pairs = new Set()
  allMatches(tournament).forEach(m => {
    if (m.player2Id === null) return
    pairs.add(m.player1Id + '|' + m.player2Id)
    pairs.add(m.player2Id + '|' + m.player1Id)
  })
  return pairs
}

function hasHadBye(tournament, playerId) {
  return allMatches(tournament).some(m => m.player1Id === playerId && m.player2Id === null)
}

// Round 1: random shuffle, paired adjacently (bye assigned first if the count is odd). Round
// N>1: rank by current standings, shuffle within each point-group (so ranking isn't rigid),
// then greedily pair top-to-bottom, scanning for the first opponent not yet faced. If a player
// reaches the end of the list with no valid (non-rematch) opponent, they're paired with the
// nearest-ranked remaining player anyway and the match is flagged `rematch: true` — a real
// backtracking solver would avoid this in more cases, but is more machinery than this admin
// tool needs; the flagged fallback is honest about the compromise instead of hiding it.
export function pairSwissRound(tournament) {
  const isFirstRound = tournament.rounds.length === 0
  const played = playedPairsOf(tournament)

  let pool
  if (isFirstRound) {
    pool = shuffle(tournament.players.map(p => p.id))
  } else {
    const standings = computeStandings(tournament)
    const groups = new Map()
    standings.forEach(s => {
      if (!groups.has(s.points)) groups.set(s.points, [])
      groups.get(s.points).push(s.playerId)
    })
    pool = [...groups.keys()].sort((a, b) => b - a).flatMap(points => shuffle(groups.get(points)))
  }

  const matches = []
  if (pool.length % 2 === 1) {
    // Bye goes to the lowest-ranked player who hasn't had one yet — falling back to the
    // lowest-ranked player overall if everyone already has (rare, but must resolve to someone).
    let byePlayerId = null
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!hasHadBye(tournament, pool[i])) { byePlayerId = pool[i]; break }
    }
    if (byePlayerId === null) byePlayerId = pool[pool.length - 1]
    pool = pool.filter(id => id !== byePlayerId)
    matches.push({ id: crypto.randomUUID(), player1Id: byePlayerId, player2Id: null, result: null, rematch: false })
  }

  const remaining = pool.slice()
  while (remaining.length > 0) {
    const a = remaining.shift()
    let idx = remaining.findIndex(b => !played.has(a + '|' + b))
    let rematch = false
    if (idx === -1) { idx = 0; rematch = true }
    const b = remaining.splice(idx, 1)[0]
    matches.push({ id: crypto.randomUUID(), player1Id: a, player2Id: b, result: null, rematch })
  }

  return { roundNumber: tournament.rounds.length + 1, matches }
}

export function nextPowerOfTwo(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

// A bye's lone player counts as an immediate winner, same as a recorded result — null means a
// real match still awaiting one.
function winnerOf(match) {
  if (match.player2Id === null) return match.player1Id
  if (match.result === 'p1') return match.player1Id
  if (match.result === 'p2') return match.player2Id
  return null
}

// Round 1: one shuffle decides both bracket order and who gets a bye (the first `byeCount`
// shuffled players). Round N>1: resolve every match in round N to a winner and pair
// winners[2i] vs winners[2i+1] — returns null if round N isn't fully resolved yet.
export function pairEliminationRound(tournament) {
  if (tournament.rounds.length === 0) {
    const order = shuffle(tournament.players.map(p => p.id))
    const size = nextPowerOfTwo(order.length)
    const byeCount = size - order.length
    const byes = order.slice(0, byeCount)
    const rest = order.slice(byeCount)
    const matches = byes.map(id => (
      { id: crypto.randomUUID(), player1Id: id, player2Id: null, result: null, rematch: false }
    ))
    for (let i = 0; i < rest.length; i += 2) {
      matches.push({ id: crypto.randomUUID(), player1Id: rest[i], player2Id: rest[i + 1], result: null, rematch: false })
    }
    return { roundNumber: 1, matches }
  }

  const prevRound = tournament.rounds[tournament.rounds.length - 1]
  const winners = prevRound.matches.map(winnerOf)
  if (winners.some(w => w === null)) return null

  const matches = []
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({ id: crypto.randomUUID(), player1Id: winners[i], player2Id: winners[i + 1] ?? null, result: null, rematch: false })
  }
  return { roundNumber: tournament.rounds.length + 1, matches }
}

export function isTournamentComplete(tournament) {
  if (tournament.rounds.length === 0) return false
  if (tournament.format === 'swiss') return tournament.rounds.length >= tournament.swissTotalRounds
  const last = tournament.rounds[tournament.rounds.length - 1]
  return last.matches.length === 1 && winnerOf(last.matches[0]) !== null
}

export function championOf(tournament) {
  if (tournament.format !== 'elimination' || !isTournamentComplete(tournament)) return null
  const last = tournament.rounds[tournament.rounds.length - 1]
  const winnerId = winnerOf(last.matches[0])
  return tournament.players.find(p => p.id === winnerId) || null
}

// Whether every non-bye match in a round has a recorded result — the gate for "generate next
// round" in the UI.
export function isRoundComplete(round) {
  return round.matches.every(m => m.player2Id === null || m.result !== null)
}

// Stamps a fixed `table` number onto each of a freshly-generated round's matches (null for
// byes, which don't need one) and reorders `round.matches` to match — done ONCE, right after
// the round is generated, using standings as of *before* this round (the tournament object
// passed in must not yet include `round`). This must not be recomputed later from live
// standings: results recorded during this same round would otherwise reshuffle table numbers
// as they come in, which is exactly the bug this avoids. For Swiss, the table order follows the
// better-ranked player of each match (organizers seat the top of the standings at the front
// tables); for elimination, natural bracket order is kept since it already carries structural
// meaning. Either way, byes move to the end since they don't need a table at all. Mutates and
// returns `round`.
export function assignTableNumbers(tournament, round) {
  const real = round.matches.filter(m => m.player2Id !== null)
  const byes = round.matches.filter(m => m.player2Id === null)
  if (tournament.format === 'swiss') {
    const standings = computeStandings(tournament)
    const rankIndex = new Map(standings.map((s, i) => [s.playerId, i]))
    const bestRank = m => Math.min(rankIndex.get(m.player1Id) ?? Infinity, rankIndex.get(m.player2Id) ?? Infinity)
    real.sort((a, b) => bestRank(a) - bestRank(b))
  }
  real.forEach((m, i) => { m.table = i + 1 })
  byes.forEach(m => { m.table = null })
  round.matches = [...real, ...byes]
  return round
}
