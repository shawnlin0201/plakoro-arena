// Works out how likely a move is to be payable by a given set of assembled energy dice.
//
// A move's cost is a list of energy types, where "無色" (colorless) is a wildcard any energy
// can pay for. Note that colorless is never a face type — the 9 chip types are the only thing
// a die can roll (see CHIP_TYPES) — so it only ever appears on the cost side.
import { FACE_KEYS, faceTypes } from './diceParts'

export const COLORLESS = "無色"

// Splits a cost list into its specific-type requirements and its wildcard count.
export function parseCost(cost) {
  const specific = new Map()
  let colorless = 0
  cost.forEach(type => {
    if (type === COLORLESS) colorless += 1
    else specific.set(type, (specific.get(type) || 0) + 1)
  })
  return { specific, colorless }
}

// Whether one roll's energy can pay a cost.
//
// No bipartite matching is needed here: a specific requirement can only ever be paid by its
// own type, and a wildcard by anything. So paying every specific requirement from its own
// type first is never worse than any alternative, and whatever is left over is exactly what's
// available for the wildcards. Checking "enough of each type" plus "enough left over" is
// therefore both necessary and sufficient.
export function canPayCost(rolledTypes, cost) {
  const { specific, colorless } = parseCost(cost)
  const have = new Map()
  rolledTypes.forEach(type => have.set(type, (have.get(type) || 0) + 1))

  let specificTotal = 0
  for (const [type, needed] of specific) {
    if ((have.get(type) || 0) < needed) return false
    specificTotal += needed
  }
  return rolledTypes.length - specificTotal >= colorless
}

// Every possible outcome of rolling the given dice together, as a flat list of energy types
// per outcome. Each die contributes one face, so there are 6^n equally likely outcomes —
// 36 for two dice, 216 for three. Written as an iterative product rather than nested loops
// because the player chooses how many (and which) dice take part.
export function enumerateRolls(dice) {
  let outcomes = [[]]
  dice.forEach(die => {
    const next = []
    outcomes.forEach(prefix => {
      FACE_KEYS.forEach(faceKey => {
        next.push([...prefix, ...faceTypes(die, faceKey)])
      })
    })
    outcomes = next
  })
  return outcomes
}

// How many of the given rolls can pay the cost, plus the total, so callers can render the
// raw tally as well as the percentage. A move with no cost at all counts as always payable.
export function payableCount(rolls, cost) {
  if (!cost || cost.length === 0) return { payable: rolls.length, total: rolls.length }
  let payable = 0
  rolls.forEach(roll => {
    if (canPayCost(roll, cost)) payable += 1
  })
  return { payable, total: rolls.length }
}

// A character-die effect fires when the die lands on any of its listed orientations, out of
// the character die's 6 faces.
export const CHARA_DIE_FACE_COUNT = 6

export function charaEffectOdds(orientations) {
  const hits = Array.isArray(orientations) ? orientations.length : 0
  return { hits, total: CHARA_DIE_FACE_COUNT }
}

// How likely a character-die effect is to actually go off. The effect rides on a separate die,
// but it only matters if the move itself lands — a move that can't be paid for never reaches
// the character-die check. So the real figure is the joint probability of both, and a move at
// 80% with a 3-of-6 effect fires 40% of the time, not 50%.
//
// The energy roll and the character die are independent, and both outcome spaces are uniform,
// so multiplying the counts gives an exact combined tally (e.g. 216 rolls x 6 faces = 1296
// equally likely outcomes) with no floating-point rounding.
export function jointOdds(moveOdds, charaOdds) {
  return {
    payable: moveOdds.payable * charaOdds.hits,
    total: moveOdds.total * charaOdds.total
  }
}
