// Energy-die assembly simulator: a die is two "half-dice" — one fixed convex face, one
// fixed concave face, plus 2 round sockets (single-type chips) and 2 square sockets
// (two-type diagonal-split chips).
export const CONVEX_TYPES = ["くさ", "ほのお", "みず", "かみなり", "はがね"]
export const CONCAVE_TYPES = ["あく", "かくとう", "ちょう", "ひこう"]
export const CHIP_TYPES = [...CONVEX_TYPES, ...CONCAVE_TYPES]

// The 6 faces of an assembled die, in the fixed display order: convex, concave, round,
// round, square, square. Every face is equally likely, so this doubles as the roll's
// outcome space.
export const FACE_KEYS = ["convex", "concave", "single1", "single2", "dual1", "dual2"]

// The energy a single face grants — 1 type for the fixed faces and round sockets, 2 for a
// square socket's dual chip (which is why a roll's energy count varies, not just its types).
export function faceTypes(die, key) {
  if (key === "convex") return [die.convexType]
  if (key === "concave") return [die.concaveType]
  if (key === "single1") return die.singleSlots[0] ? [die.singleSlots[0].type] : []
  if (key === "single2") return die.singleSlots[1] ? [die.singleSlots[1].type] : []
  if (key === "dual1") return die.dualSlots[0] ? die.dualSlots[0].types : []
  if (key === "dual2") return die.dualSlots[1] ? die.dualSlots[1].types : []
  return []
}

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
