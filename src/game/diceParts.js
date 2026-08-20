// Energy-die assembly simulator: a die is two "half-dice" — one fixed convex face, one
// fixed concave face, plus 2 round sockets (single-type chips) and 2 square sockets
// (two-type diagonal-split chips).
export const CONVEX_TYPES = ["くさ", "ほのお", "みず", "かみなり", "はがね"]
export const CONCAVE_TYPES = ["あく", "かくとう", "ちょう", "ひこう"]
export const CHIP_TYPES = [...CONVEX_TYPES, ...CONCAVE_TYPES]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickTwoDistinct(arr) {
  const a = pick(arr)
  let b = pick(arr)
  while (b === a) b = pick(arr)
  return [a, b]
}

export function randomSingleChip() {
  return { kind: "single", type: pick(CHIP_TYPES) }
}

export function randomDualChip() {
  return { kind: "dual", types: pickTwoDistinct(CHIP_TYPES) }
}

export function randomDie() {
  return {
    convexType: pick(CONVEX_TYPES),
    concaveType: pick(CONCAVE_TYPES),
    singleSlots: [randomSingleChip(), randomSingleChip()],
    dualSlots: [randomDualChip(), randomDualChip()]
  }
}
