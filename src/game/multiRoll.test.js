// 合計 N 次角色骰的招式：卡面寫「このワザはキャラコロを合計N回振る」，中幾次算幾次。
//
// 這裡釘住的是「第一擲沒中也要把剩下的擲完」。曾經不是這樣 —— 引擎把招式當成「擲中才有效果」
// 的一般招式，第一擲沒中整段就不跑。水手裏劍基礎傷害 0，所以那等於第一擲決定整招，可是卡片
// 給的是三次機會。
import { describe, it, expect } from 'vitest'
import { advanceEffectQueue, multiRollStart } from './effectQueue'

const SHURIKEN = {
  id: 'EBW02-003', name: '水手裏劍', baseDamage: 0, effectType: null,
  chara: [{ type: 'DAMAGE_EXTRA_3CHARADICE', value: 20, orientations: ['立', '左', '右'] }]
}

// 跑完一整段多擲流程，回傳傷害與一路問了幾擲。
function play(mv, result, answers) {
  const start = multiRollStart(mv, result)
  const ctx = {
    mover: { mods: [], hp: 100 }, opp: { mods: [], hp: 100 }, mv,
    ce: start ? mv.chara[start.ceIndex] : null,
    queue: start ? [start.entry] : [],
    cursor: 0, dmgToOpp: 0, dmgToSelf: 0, multi: start ? start.multi : null
  }
  let asks = 0
  let ask = advanceEffectQueue(ctx)
  while (ask) {
    ask = advanceEffectQueue(ctx, answers[asks++])
  }
  return { dmg: ctx.dmgToOpp, asks }
}

const missed = { kind: 'success' }
const landed = { kind: 'chara', ce: SHURIKEN.chara[0] }

describe('合計 N 次角色骰', () => {
  it('第一擲沒中，剩下的照擲，中幾次算幾次', () => {
    expect(play(SHURIKEN, missed, [true, true])).toEqual({ dmg: 40, asks: 2 })
  })

  it('三擲全沒中才是 0', () => {
    expect(play(SHURIKEN, missed, [false, false])).toEqual({ dmg: 0, asks: 2 })
  })

  it('第一擲中，剩兩擲也中，三次全中', () => {
    expect(play(SHURIKEN, landed, [true, true])).toEqual({ dmg: 60, asks: 2 })
  })

  // 這回合已經擲過的那一次就是第 1 擲，不會叫玩家多擲一次。
  it('總共只問 N-1 次', () => {
    expect(play(SHURIKEN, landed, [false, false]).asks).toBe(2)
  })

  it('能量擲失敗就整招不成立，不進多擲流程', () => {
    expect(multiRollStart(SHURIKEN, { kind: 'fail' })).toBeNull()
  })

  it('沒有這種效果的招式不受影響', () => {
    const plain = { id: 'X', chara: [{ type: 'DAMAGE_EXTRA', value: 20, orientations: ['立'] }] }
    expect(multiRollStart(plain, landed)).toBeNull()
  })
})
