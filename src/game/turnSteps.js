// The steps a turn runs through, and which engine phase belongs to which.
//
// One list, because there were three: App.vue decided what to render from a hand-copied array
// of phase strings, TurnStepper had its own, and the engine had the real one. Adding
// `rerollPick` / `rerollThrow` updated the engine and nothing else, so the reroll panel simply
// never rendered — the screen fell through to the board with no overlay at all.
//
// A phase added here shows up in the stepper and the router at once, and the roster test
// fails if the engine can reach a phase this file has not heard of.

/** Steps in the order a turn runs them, each owning the phases that make it up. */
export const TURN_STEPS = [
  { key: 'moveSelect', phases: ['moveSelect'] },
  // The reroll phases sit inside the dice step: they interrupt a roll that has not settled
  // yet, and DiceOverlay owns the screen for all three.
  { key: 'diceRoll', phases: ['diceRoll', 'rerollPick', 'rerollThrow'] },
  // Several phases, one idea to a player: still working out what the move did.
  { key: 'resolve', phases: ['resolve', 'effectPrompt', 'charaThrowTask', 'energyThrowTask'] },
  { key: 'damage', phases: ['turnResultConfirm'] }
]

/** Phases that are not part of a turn: setup, the first-player draw, and the end. */
export const OUTSIDE_TURN = ['select', 'drawingFirst', 'win']

/** Every phase a turn can be in — what the board treats as "a battle is underway". */
export const IN_TURN_PHASES = TURN_STEPS.flatMap(s => s.phases)

/** Which phases DiceOverlay owns. */
export const DICE_PHASES = TURN_STEPS.find(s => s.key === 'diceRoll').phases

/**
 * Phases where the move list is shown read-only, under whatever overlay is resolving the
 * turn. Not the dice ones: DiceOverlay fills the screen itself.
 */
export const RESOLVING_PHASES = [
  ...TURN_STEPS.find(s => s.key === 'resolve').phases,
  ...TURN_STEPS.find(s => s.key === 'damage').phases
]

export function stepIndexOf(phase) {
  return TURN_STEPS.findIndex(s => s.phases.includes(phase))
}
