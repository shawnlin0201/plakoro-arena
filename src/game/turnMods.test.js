import { describe, it, expect } from 'vitest'
import { plantMod, modsFor, modOf, modSum, clearMods, STEP } from './turnMods'

const player = () => ({ mods: [] })

describe('turnMods', () => {
  it('starts empty', () => {
    expect(modsFor(player(), STEP.DAMAGE)).toEqual([])
    expect(modOf(player(), STEP.DAMAGE, 'damageSetTo')).toBeNull()
    expect(modSum(player(), STEP.DICE_ROLL, 'diceCount')).toBe(0)
  })

  it('keeps modifiers apart by step', () => {
    const p = player()
    plantMod(p, { step: STEP.DAMAGE, kind: 'damageSetTo', value: 0 })
    plantMod(p, { step: STEP.MOVE_SELECT, kind: 'banMoves', ids: ['m1'] })
    expect(modsFor(p, STEP.DAMAGE)).toHaveLength(1)
    expect(modsFor(p, STEP.MOVE_SELECT)).toHaveLength(1)
    expect(modsFor(p, STEP.DICE_ROLL)).toHaveLength(0)
  })

  it('adds up the kinds that stack', () => {
    const p = player()
    plantMod(p, { step: STEP.DICE_ROLL, kind: 'diceCount', delta: -1 })
    plantMod(p, { step: STEP.DICE_ROLL, kind: 'diceCount', delta: -2 })
    // Two effects landing on the same turn really should both apply.
    expect(modSum(p, STEP.DICE_ROLL, 'diceCount')).toBe(-3)
  })

  describe('expiry', () => {
    // The two halves are spent during the same turn but belong to different players, so they
    // cannot be cleared at the same moment. Getting this wrong in either direction is a real
    // bug: too early wipes a ban before its turn arrives, too late leaves a shield up twice.
    it('clears only the steps it is asked to', () => {
      const p = player()
      plantMod(p, { step: STEP.MOVE_SELECT, kind: 'banMoves', ids: ['m1'] })
      plantMod(p, { step: STEP.DAMAGE, kind: 'damageSetTo', value: 0 })

      clearMods(p, [STEP.DAMAGE])
      expect(modOf(p, STEP.MOVE_SELECT, 'banMoves')).not.toBeNull()
      expect(modOf(p, STEP.DAMAGE, 'damageSetTo')).toBeNull()

      clearMods(p, [STEP.MOVE_SELECT])
      expect(modOf(p, STEP.MOVE_SELECT, 'banMoves')).toBeNull()
    })

    it('clears everything when no step is named', () => {
      const p = player()
      plantMod(p, { step: STEP.DAMAGE, kind: 'damageSetTo', value: 0 })
      plantMod(p, { step: STEP.DICE_ROLL, kind: 'diceCount', delta: -1 })
      clearMods(p)
      expect(p.mods).toEqual([])
    })

    // The shape of a bug the old two-field design actually had: a skipped turn never ran
    // resolveTurn, so the live seal was re-committed after every later turn and never expired.
    it('a seal does not survive the turn it was planted for', () => {
      const p = player()
      plantMod(p, { step: STEP.MOVE_SELECT, kind: 'banMoves', ids: ['m1'], from: 'メモリースキップ' })
      clearMods(p, [STEP.MOVE_SELECT, STEP.DICE_ROLL])
      clearMods(p, [STEP.MOVE_SELECT, STEP.DICE_ROLL])
      expect(modOf(p, STEP.MOVE_SELECT, 'banMoves')).toBeNull()
    })
  })

  it('carries the move name, so the UI can say what is affecting you', () => {
    const p = player()
    plantMod(p, { step: STEP.DICE_ROLL, kind: 'diceCount', delta: -1, from: 'がんせきふうじ' })
    expect(modOf(p, STEP.DICE_ROLL, 'diceCount').from).toBe('がんせきふうじ')
  })
})
