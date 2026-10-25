// Every character, every move — checked against the engine rather than described by hand.
//
// Writing 200 individual tests would mean writing them again every time a set is released,
// and the ones nobody remembered to write are exactly where the bugs were. These walk the
// roster instead, so a card added tomorrow is covered the moment it lands in the data.
//
// Each move is its own `it`, so a failure names the card: "ゲッコウガ みずしゅりけん
// (EBW02-003)" rather than "roster › effects".
import { describe, it, expect } from 'vitest'
import { advanceEffectQueue, isEffectTypeHandled } from './effectQueue'
import { moveExpectedValue } from './moveExpectedValue'
import { enumerateRolls } from './energyPayment'
import { CHARA_DIE_FACE_COUNT } from './energyPayment'
import { randomDie } from './diceParts'
import { IN_TURN_PHASES, OUTSIDE_TURN } from './turnSteps'
import generatedChara from '../data/generated/chara.json'
import generatedWaza from '../data/generated/waza.json'
import localCards from '../data/localCards.json'
import zhTW from '../data/translations/zh-TW.json'
import en from '../data/translations/en.json'

// Same merge the app does: local wins on a shared id (see useCharacterData).
function merge(generated, local) {
  const byId = new Map(generated.map(r => [String(r.id).trim(), r]))
  for (const r of local) byId.set(String(r.id).trim(), r)
  return [...byId.values()]
}
const CHARA = merge(generatedChara, localCards.chara || [])
const WAZA = merge(generatedWaza, localCards.waza || [])

const ORIENTATIONS = ['立', '逆', '上', '下', '左', '右']
const ENERGY = ['くさ', 'ほのお', 'みず', 'かみなり', 'はがね', 'あく', 'かくとう', 'ちょう', 'ひこう', 'ドラゴン', '無色']

const effectSlots = w => [
  { text: w.waza_effect, type: w.waza_effect_type, value: w.waza_effect_value, die: null },
  ...[1, 2, 3].map(i => ({
    text: w[`chara_effect${i}`], type: w[`chara_effect_type${i}`],
    value: w[`chara_effect_value${i}`], die: w[`chara_die${i}`]
  }))
].filter(s => s.type)

// A context shaped like the real one, with both players stubbed enough for any effect to
// write to. Effects mutate players directly, so these have to be fresh per move.
function makeCtx(w, queue) {
  const side = () => ({
    hp: 120, maxHp: 120, character: { type: 'みず', weaknesses: [] },
    moveIds: ['x1', 'x2', 'x3', 'x4'], diceModBadges: [], mods: [],
    committedLastMoveId: null, committedLastMoveFailed: false, committedTookDamage: false
  })
  const first = effectSlots(w).find(s => s.die)
  return {
    moverKey: 'A', oppKey: 'B',
    mover: side(), opp: side(),
    mv: { id: w.id, name: w.waza_name, type: w.waza_type, baseDamage: w.waza_damage || 0, chara: [] },
    ce: first ? { orientations: first.die.split(',').map(x => x.trim()).filter(Boolean) } : null,
    queue, cursor: 0, dmgToOpp: w.waza_damage || 0, dmgToSelf: 0
  }
}

// Answer whatever the queue asks, so every branch of every effect actually executes. The
// values are deliberately plausible rather than clever — the point is that nothing throws
// and the queue terminates, not that the arithmetic matches a particular roll.
//
// `seen` counts how many times this ask has come round. Open-ended runs (サンダーチェイン:
// throw again until one misses) are unbounded by the rules, so a test that always answers
// "hit" never ends — correctly. It misses on the third throw instead.
function answerFor(ask, seen = 0) {
  switch (ask.kind) {
    case 'charaDiceStep': return ask.total === null ? seen < 2 : true
    case 'charaDiceEnemyManual': return true
    case 'diceNumber': return 2
    case 'eneCount': return 1
    case 'charaDiceSelect': return (ask.orientations && ask.orientations[0]) || '立'
    case 'bindWaza': return ['x1']
    default: return 1
  }
}

describe('roster data', () => {
  it('has characters and moves', () => {
    expect(CHARA.length).toBeGreaterThan(0)
    expect(WAZA.length).toBeGreaterThan(0)
  })

  it('gives every move an id and exactly one owner', () => {
    const ids = WAZA.map(w => String(w.id).trim())
    expect(new Set(ids).size).toBe(ids.length)
    const names = new Set(CHARA.map(c => String(c.name).trim()))
    const orphans = WAZA.filter(w => !names.has(String(w.chara_name).trim()))
    expect(orphans.map(w => `${w.id} ${w.chara_name}`)).toEqual([])
  })

  it('leaves no effect type without a handler', () => {
    const missing = new Set()
    WAZA.forEach(w => effectSlots(w).forEach(s => {
      if (!isEffectTypeHandled(s.type)) missing.add(s.type)
    }))
    expect([...missing]).toEqual([])
  })
})

describe.each(CHARA.map(c => [String(c.name).trim(), c]))('%s', (name, chara) => {
  const moves = WAZA.filter(w => String(w.chara_name).trim() === name)

  it('has at least one move', () => {
    expect(moves.length).toBeGreaterThan(0)
  })

  it('has the stats a battle needs', () => {
    expect(ENERGY).toContain(chara.type)
    expect(Number(chara.HP)).toBeGreaterThan(0)
    if (chara.weakness_type1) expect(ENERGY).toContain(chara.weakness_type1)
  })

  describe.each(moves.map(w => [`${w.waza_name} (${w.id})`, w]))('%s', (_label, w) => {
    it('is typed and priced with real energy', () => {
      expect(ENERGY).toContain(w.waza_type)
      const cost = String(w.waza_energy || '').split(',').map(s => s.trim()).filter(Boolean)
      expect(cost.length).toBeGreaterThan(0)
      cost.forEach(c => expect(ENERGY).toContain(c))
    })

    it('names only real character-die faces', () => {
      effectSlots(w).filter(s => s.die).forEach(s => {
        const faces = s.die.split(',').map(x => x.trim()).filter(Boolean)
        expect(faces.length).toBeGreaterThan(0)
        expect(faces.length).toBeLessThanOrEqual(CHARA_DIE_FACE_COUNT)
        faces.forEach(f => expect(ORIENTATIONS).toContain(f))
        // A face listed twice would double-count the odds it contributes.
        expect(new Set(faces).size).toBe(faces.length)
      })
    })

    it('runs its effects to completion', () => {
      const queue = effectSlots(w).map(s => ({ type: s.type, value: s.value || 0 }))
      if (!queue.length) return
      const ctx = makeCtx(w, queue)
      let ask = advanceEffectQueue(ctx)
      // Generous, but finite: an effect that asks forever is the bug this catches.
      for (let guard = 0; ask && guard < 40; guard++) {
        ask = advanceEffectQueue(ctx, answerFor(ask, guard))
      }
      expect(ask).toBeNull()
      expect(Number.isFinite(ctx.dmgToOpp)).toBe(true)
      expect(Number.isFinite(ctx.dmgToSelf)).toBe(true)
    })

    it('resumes mid-queue to the same result', () => {
      const queue = effectSlots(w).map(s => ({ type: s.type, value: s.value || 0 }))
      if (!queue.length) return

      const run = (reviveAfterFirstAsk) => {
        let ctx = makeCtx(w, queue)
        let ask = advanceEffectQueue(ctx)
        let revived = false
        for (let guard = 0; ask && guard < 40; guard++) {
          const answer = answerFor(ask, guard)
          if (reviveAfterFirstAsk && !revived) {
            revived = true
            // What a reload has to survive on: the plain half of the context, snapshotted and
            // rebuilt. If any continuation were still hiding in a closure this would diverge.
            const saved = JSON.parse(JSON.stringify({
              queue: ctx.queue, cursor: ctx.cursor, multi: ctx.multi,
              dmgToOpp: ctx.dmgToOpp, dmgToSelf: ctx.dmgToSelf
            }))
            ctx = { ...makeCtx(w, queue), ...saved }
          }
          ask = advanceEffectQueue(ctx, answer)
        }
        return { dmgToOpp: ctx.dmgToOpp, dmgToSelf: ctx.dmgToSelf }
      }

      expect(run(true)).toEqual(run(false))
    })

    it('prices without throwing', () => {
      const rolls = enumerateRolls([randomDie(), randomDie(), randomDie()])
      const mv = {
        id: w.id, name: w.waza_name, type: w.waza_type, baseDamage: w.waza_damage || 0,
        cost: String(w.waza_energy || '').split(',').map(s => s.trim()).filter(Boolean),
        effectType: w.waza_effect_type, effectValue: w.waza_effect_value || 0,
        chara: effectSlots(w).filter(s => s.die).map(s => ({
          orientations: s.die.split(',').map(x => x.trim()).filter(Boolean),
          type: s.type, value: s.value || 0
        }))
      }
      const r = moveExpectedValue(mv, { rolls })
      expect(Number.isFinite(r.ev) || r.ev === Infinity).toBe(true)
      expect(r.pSuccess).toBeGreaterThanOrEqual(0)
      expect(r.pSuccess).toBeLessThanOrEqual(1)
    })

    it('is readable in every language', () => {
      const id = String(w.id).trim()
      ;[['zh-TW', zhTW], ['en', en]].forEach(([loc, table]) => {
        const entry = table.waza[id]
        expect(entry, `${id} missing from ${loc}`).toBeTruthy()
        expect(entry.name, `${id} has no name in ${loc}`).toBeTruthy()
      })
    })
  })
})

// turnSteps.js is what decides both what renders and what the stepper shows, so a phase the
// engine can reach but that file has never heard of renders nothing at all. That is not a
// cosmetic failure: adding rerollPick/rerollThrow without updating the router left the reroll
// panel completely unrendered, and the screen fell through to a bare board.
describe('turn step coverage', () => {
  const MAPPED = new Set(IN_TURN_PHASES)
  const OUTSIDE_A_TURN = new Set(OUTSIDE_TURN)

  it('maps every phase the engine enters', async () => {
    const { readFileSync } = await import('fs')
    const src = readFileSync('src/composables/useBattleState.js', 'utf8')
    const entered = new Set([...src.matchAll(/enterPhase\("(\w+)"/g)].map(m => m[1]))
    expect(entered.size).toBeGreaterThan(0)
    const unmapped = [...entered].filter(p => !MAPPED.has(p) && !OUTSIDE_A_TURN.has(p))
    expect(unmapped).toEqual([])
  })
})
