import { describe, it, expect } from 'vitest'
import { computeDisplayDamage } from './damage'
import { plantMod, STEP } from './turnMods'

const move = (baseDamage, extra = {}) => ({ baseDamage, type: 'みず', effectType: null, effectValue: 0, ...extra })
const defender = (weaknesses = []) => ({ character: { weaknesses }, mods: [] })
const attacker = {}

describe('computeDisplayDamage', () => {
  it('is the printed number when nothing applies', () => {
    expect(computeDisplayDamage(move(30), attacker, defender()).display).toBe(30)
  })

  it('adds the defender’s weakness', () => {
    const d = defender([{ type: 'みず', damage: 20 }])
    const r = computeDisplayDamage(move(30), attacker, d)
    expect(r.display).toBe(50)
    expect(r.mode).toBe('weak')
  })

  it('never shows a negative figure', () => {
    const d = defender()
    plantMod(d, { step: STEP.DAMAGE, kind: 'damageDelta', delta: -50 })
    expect(computeDisplayDamage(move(30), attacker, d).display).toBe(0)
  })

  describe('order of the damage-step modifiers', () => {
    // Stated as tests because the order is load-bearing and invisible: a threshold shield has
    // to see the final number, so anything that moves that number must be applied first.
    it('applies a flat change before a threshold shield', () => {
      const d = defender()
      plantMod(d, { step: STEP.DAMAGE, kind: 'damageDelta', delta: -35 })
      plantMod(d, { step: STEP.DAMAGE, kind: 'nullifyAtMost', value: 20 })
      // 50 reduced to 15, which is under the line, so nothing lands.
      expect(computeDisplayDamage(move(50), attacker, d).display).toBe(0)
    })

    it('lets a hit through when the reduction does not reach the line', () => {
      const d = defender()
      plantMod(d, { step: STEP.DAMAGE, kind: 'damageDelta', delta: -20 })
      plantMod(d, { step: STEP.DAMAGE, kind: 'nullifyAtMost', value: 20 })
      expect(computeDisplayDamage(move(50), attacker, d).display).toBe(30)
    })

    it('does not stop a big hit', () => {
      const d = defender()
      plantMod(d, { step: STEP.DAMAGE, kind: 'nullifyAtMost', value: 40 })
      expect(computeDisplayDamage(move(50), attacker, d).display).toBe(50)
      expect(computeDisplayDamage(move(30), attacker, d).display).toBe(0)
    })

    it('an outright override beats a flat change', () => {
      const d = defender()
      plantMod(d, { step: STEP.DAMAGE, kind: 'damageDelta', delta: 40 })
      plantMod(d, { step: STEP.DAMAGE, kind: 'damageSetTo', value: 0 })
      expect(computeDisplayDamage(move(30), attacker, d).display).toBe(0)
    })
  })

  it('ignores modifiers belonging to other steps', () => {
    const d = defender()
    plantMod(d, { step: STEP.DICE_ROLL, kind: 'diceCount', delta: -1 })
    expect(computeDisplayDamage(move(30), attacker, d).display).toBe(30)
  })
})
