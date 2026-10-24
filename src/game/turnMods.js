// What an effect leaves behind for somebody's next turn.
//
// Nearly every cross-turn effect in the game is phrased the same way on the card — 「次の相手
// の番、〜」/「次の自分の番、〜」, 55 of the 57 that reach past the turn they were cast in.
// That is literally "on [whose] next turn, [this step] works differently", so that is what
// gets stored: a list of modifiers, each tagged with the step it changes.
//
// Sorting them by step is not a tidy-up. Of those 55, not one touches two different steps, so
// the tag is a real property of the effect rather than a bucket we invented to put it in.
//
// This replaces a dozen separately-named fields (charaDiceBlocked, fixCharaDice, diceMod,
// incomingDamageMod, incomingDamageNullify, incomingDamageNullifyAtMost,
// incomingNullifyIfCharaDice, bannedMoveIds, moveChosenByOpponent, pendingDiceReroll, …),
// each of which had its own setting and — the part that bit — its own clearing. Adding
// NULLIFY_TAKEN_LE meant remembering to clear it in three separate places; miss one and the
// shield never expires. One list has one lifecycle.
//
// Everything here is plain data on purpose: it has to survive a snapshot, which is the whole
// reason a reload can resume a battle (see docs/online-battle.md in the API repo).

/** The steps a modifier can attach to. */
export const STEP = {
  MOVE_SELECT: 'moveSelect',
  DICE_ROLL: 'diceRoll',
  DAMAGE: 'damage'
}

/**
 * Attach a modifier to `player`, to apply on their next turn.
 *
 * @param {object} player  the side it applies TO, which is not always the one who cast it
 * @param {object} mod     { step, kind, ...payload }; `from` is the move's name, carried so
 *                         the UI can say what is affecting you rather than only that
 *                         something is
 */
export function plantMod(player, mod) {
  if (!player.mods) player.mods = []
  player.mods.push(mod)
}

/** Every modifier on `player` that the given step has to honour. */
export function modsFor(player, step) {
  return (player.mods || []).filter(m => m.step === step)
}

/** The first modifier of a kind, for the ones that cannot sensibly stack. */
export function modOf(player, step, kind) {
  return (player.mods || []).find(m => m.step === step && m.kind === kind) || null
}

/**
 * Sum the deltas of a stacking kind — dice counts are the only ones, and two effects landing
 * on the same turn really should add up.
 */
export function modSum(player, step, kind) {
  return (player.mods || []).reduce((n, m) => (m.step === step && m.kind === kind ? n + (m.delta || 0) : n), 0)
}

/**
 * Drop the modifiers a turn has finished with.
 *
 * Scoped by step, because the two halves expire at different moments even though both are
 * spent during the same turn. A `diceRoll` or `moveSelect` modifier was planted on the player
 * who is now taking their turn, and is done the moment they have acted. A `damage` one is a
 * shield its owner put on themselves, tested when the other side attacks — so it expires at
 * the end of the attacker's turn, not its owner's.
 *
 * Clearing everything at either moment would be wrong in one direction or the other: too
 * early wipes a ban before its turn arrives, too late leaves a shield up for two turns.
 *
 * @param {object} player
 * @param {string[]} [steps]  which steps to clear; omit for all of them (new battle, reset)
 */
export function clearMods(player, steps) {
  if (!steps) {
    player.mods = []
    return
  }
  player.mods = (player.mods || []).filter(m => !steps.includes(m.step))
}
