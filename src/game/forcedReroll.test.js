// forcedRerollRolls 的驗證。
//
// 重點在 bruteForcePayable：它從骰面定義重新算一遍，不碰 enumerateRolls、不碰 canPayCost，
// 連「怎麼挑那 n 顆」都自己重寫。拿被測程式的輔助函式去驗被測程式，驗得出「有沒有改壞」，
// 驗不出「本來就想錯了」—— 而這支最可能錯的正是後者：選法的最佳化方向、平手規則、以及
// 每個原始骰面該佔幾筆。
import { describe, it, expect } from 'vitest'
import { forcedRerollRolls, payableCount, enumerateRolls } from './energyPayment'
import { FACE_KEYS, faceTypes } from './diceParts'

// 骰子的形狀見 diceParts.js：一個凸面、一個凹面、兩個圓槽（單屬）、兩個方槽（雙屬）。
const die = (convexType, concaveType, singles, duals) => ({
  convexType,
  concaveType,
  singleSlots: singles.map(type => ({ type })),
  dualSlots: duals.map(types => ({ types }))
})

// 近似純火：六面裡四面出火。這正是「重擲完大多還是能用」的來源。
const FIRE = die('ほのお', 'あく', ['ほのお', 'ほのお'], [['ほのお', 'みず']])
const WATER = die('みず', 'ちょう', ['みず', 'みず'], [['みず', 'ほのお']])
const MIXED = die('くさ', 'かくとう', ['ほのお', 'みず'], [['みず', 'くさ'], ['はがね', 'あく']])

const rate = odds => odds.payable / odds.total
const fireIn = types => types.filter(t => t === 'ほのお').length

/** 一組能量能不能付這個費用。自己寫一份，不用 canPayCost。 */
function canPay(types, cost) {
  const pool = [...types]
  let wild = 0
  for (const need of cost) {
    if (need === '無色') { wild += 1; continue }
    const at = pool.indexOf(need)
    if (at === -1) return false
    pool.splice(at, 1)
  }
  return pool.length >= wild
}

/** 從 0..size-1 挑 k 個的所有組合，自己寫一份。 */
function picksOf(size, k) {
  if (k === 0) return [[]]
  if (k > size) return []
  const out = []
  for (let i = 0; i <= size - k; i++) {
    for (const rest of picksOf(size - i - 1, k - 1)) out.push([i, ...rest.map(r => r + i + 1)])
  }
  return out
}

/** count 顆骰的每一種面向組合，自己寫一份。 */
function faceTuples(count) {
  let tuples = [[]]
  for (let d = 0; d < count; d++) {
    const next = []
    for (const t of tuples) for (let f = 0; f < 6; f++) next.push([...t, f])
    tuples = next
  }
  return tuples
}

/**
 * 獨立的暴力解：列出所有原始骰面，對每一種列出所有「剛好 n 顆」的選法與重擲結果，
 * 取付得出來的筆數最少的那個選法，加總回傳。
 */
function bruteForcePayable(dice, cost, n) {
  const faces = dice.map(d => FACE_KEYS.map(key => faceTypes(d, key)))
  let payable = 0
  let total = 0
  for (const shown of faceTuples(dice.length)) {
    let bestHit = Infinity
    let bestCount = 0
    for (const pick of picksOf(dice.length, n)) {
      const kept = shown.flatMap((f, i) => (pick.includes(i) ? [] : faces[i][f]))
      let hit = 0
      let count = 0
      for (const again of faceTuples(pick.length)) {
        const types = [...kept, ...again.flatMap((f, j) => faces[pick[j]][f])]
        count += 1
        if (!cost.length || canPay(types, cost)) hit += 1
      }
      if (hit < bestHit) { bestHit = hit; bestCount = count }
    }
    payable += bestHit
    total += bestCount
  }
  return { payable, total }
}

describe('forcedRerollRolls', () => {
  const cases = [
    { name: '純火三顆，費用兩火', dice: [FIRE, FIRE, FIRE], cost: ['ほのお', 'ほのお'] },
    { name: '混合三顆，費用一火一水', dice: [FIRE, WATER, MIXED], cost: ['ほのお', 'みず'] },
    { name: '混合三顆，費用一草兩無色', dice: [MIXED, MIXED, WATER], cost: ['くさ', '無色', '無色'] }
  ]

  cases.forEach(({ name, dice, cost }) => {
    [1, 2].forEach(n => {
      it(`${name}，重擲 ${n} 顆：與獨立暴力解一致`, () => {
        const got = payableCount(forcedRerollRolls(dice, cost, n), cost)
        const want = bruteForcePayable(dice, cost, n)
        expect(got.total).toBe(want.total)
        expect(got.payable).toBe(want.payable)
      })
    })
  })

  it('只有一顆骰、重擲一顆時，分布等於單純重擲一次', () => {
    // 筆數會是 6×6 —— 原始六面各自展開六種重擲結果。要比的是比率，不是筆數。
    const forced = payableCount(forcedRerollRolls([MIXED], ['みず'], 1), ['みず'])
    const plain = payableCount(enumerateRolls([MIXED]), ['みず'])
    expect(rate(forced)).toBeCloseTo(rate(plain), 10)
  })

  it('重擲會壓低付費機率，但壓得比扣掉一顆骰少', () => {
    const dice = [FIRE, WATER, MIXED]
    const cost = ['ほのお', 'みず']
    const normal = rate(payableCount(enumerateRolls(dice), cost))
    const rerolled = rate(payableCount(forcedRerollRolls(dice, cost, 1), cost))
    // 扣掉骰子也要讓對手挑最壞的那顆，不然兩邊的挑法不對等 —— 隨手砍一顆，砍到的可能
    // 正好是最沒用的那顆，這個比較就沒有意義。
    const denied = Math.min(...dice.map((_, skip) =>
      rate(payableCount(enumerateRolls(dice.filter((_, i) => i !== skip)), cost))))

    expect(rerolled).toBeLessThan(normal)
    // 這一條就是整個改動的理由：骰子還在，所以重擲遠不如扣掉。
    expect(rerolled).toBeGreaterThan(denied)
  })

  it('沒有費用的招不受影響，所有結果都算付得出', () => {
    const odds = payableCount(forcedRerollRolls([FIRE, WATER], [], 1), [])
    expect(odds.payable).toBe(odds.total)
  })

  it('平手時挑留給對手最少該屬性的那個選法', () => {
    // 沒有費用 → 每個選法都「一樣難付」，勝負完全由平手規則決定。
    const dice = [FIRE, WATER]
    const rolls = forcedRerollRolls(dice, [], 1, 'ほのお')
    const got = rolls.reduce((sum, r) => sum + fireIn(r), 0) / rolls.length

    // 獨立算一次。挑選是**逐一原始骰面各挑各的**，不是整體固定一種選法 —— 把這點想成
    // 固定策略的話，對照值會算成偏高的 5/6。
    const rerollSum = d => enumerateRolls([d]).reduce((s, r) => s + fireIn(r), 0)
    let sum = 0
    let count = 0
    for (const f0 of FACE_KEYS) {
      for (const f1 of FACE_KEYS) {
        const rerollFirst = fireIn(faceTypes(dice[1], f1)) * 6 + rerollSum(dice[0])
        const rerollSecond = fireIn(faceTypes(dice[0], f0)) * 6 + rerollSum(dice[1])
        sum += Math.min(rerollFirst, rerollSecond)
        count += 6
      }
    }
    expect(got).toBeCloseTo(sum / count, 10)
  })

  it('每個原始骰面都佔 6^n 筆，權重相同', () => {
    const dice = [FIRE, WATER, MIXED]
    expect(forcedRerollRolls(dice, ['ほのお'], 1).length).toBe(6 ** 3 * 6)
    expect(forcedRerollRolls(dice, ['ほのお'], 2).length).toBe(6 ** 3 * 36)
  })

  it('骰子不夠選滿 n 顆時，退回普通的擲骰', () => {
    const dice = [FIRE]
    expect(forcedRerollRolls(dice, ['ほのお'], 2)).toEqual(enumerateRolls(dice))
  })
})
