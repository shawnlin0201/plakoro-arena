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

/**
 * 被逼著重擲 n 顆骰之後，這組骰子還能擲出哪些結果。
 *
 * 勾魂眼的ほりかえす（1 顆）與ジュエルフラッシュ（2 顆）：對手選好招、擲完骰之後，由
 * 勾魂眼指定哪幾顆要重擲。所以指定的人看得到骰面也看得到對手要打什麼招，會挑**最難付得
 * 出費用**的那 n 顆 —— 這裡就是照那個最佳打法算。
 *
 * 兩個容易算錯的地方：
 *
 *   - **一定要選滿 n 顆。** 介面不讓人少選，所以重擲 2 顆時，第二顆常常是本來就沒問題的
 *     骰子。重擲它期望反而上升，有時還會把原本付不出費用的局面救回來 —— 這就是為什麼
 *     「重擲 2 顆」實際上幾乎沒有比 1 顆強。
 *   - **骰子還在。** 純屬骰六面有五面是自己的屬性，重擲完大多還是能用。所以這跟「扣掉
 *     一顆骰」是完全不同的兩件事，不能借那邊的價錢。
 *
 * 回傳的是展開後的結果清單，原始的每一種骰面各佔 6^n 筆，所以每一筆等權重，可以直接餵給
 * payableCount 或 moveExpectedValue，不必另外帶權重。
 *
 * @param {Array}  dice      對手的骰子
 * @param {Array}  cost      對手那一招的費用；空的話任何結果都付得出，選誰都一樣
 * @param {number} n         被指定重擲的顆數
 * @param {string} [ownType] 平手時改比這個屬性的數量，留 null 就不比
 */
export function forcedRerollRolls(dice, cost, n, ownType = null) {
  // 每顆骰的六面各給出哪些能量，先算好，底下會反覆查。
  const faceEnergy = dice.map(die => FACE_KEYS.map(key => faceTypes(die, key)))
  const picks = combinations(dice.length, n)
  // 選不出 n 顆（骰子比 n 少）就當作沒有這個效果。
  if (picks.length === 0) return enumerateRolls(dice)

  // 同一個「選法 + 留下來的骰面」算出來的結果永遠一樣，而不同的原始骰面常常共用它 ——
  // 例如選法是重擲第 0 顆時，第 0 顆原本是哪一面根本不影響結果。
  const seen = new Map()
  const out = []

  eachFaceCombo(dice.length, shown => {
    let best = null
    for (let p = 0; p < picks.length; p++) {
      const pick = picks[p]
      const key = p + '|' + shown.map((f, i) => (pick.includes(i) ? '' : f)).join(',')
      let option = seen.get(key)
      if (!option) {
        const kept = shown.flatMap((f, i) => (pick.includes(i) ? [] : faceEnergy[i][f]))
        const results = enumerateRolls(pick.map(i => dice[i])).map(again => [...kept, ...again])
        option = {
          payable: cost && cost.length > 0 ? results.filter(r => canPayCost(r, cost)).length : results.length,
          // 加總而不是平均：每個選法的 results 筆數都一樣（6^n），比大小的結果相同。
          own: ownType ? results.reduce((sum, r) => sum + r.filter(t => t === ownType).length, 0) : 0,
          results
        }
        seen.set(key, option)
      }
      // 讓對手最難付費的那個選法；一樣難付的話，挑留給他最少自家屬性的 —— 因為
      // DAMAGE_EXTRA_ENE_* 那類招式的傷害是按該屬性的數量算的。
      if (!best || option.payable < best.payable ||
          (option.payable === best.payable && option.own < best.own)) best = option
    }
    out.push(...best.results)
  })

  return out
}

/** 從 0..size-1 裡挑 n 個的所有組合。 */
function combinations(size, n) {
  if (n <= 0 || n > size) return []
  const out = []
  const walk = (start, chosen) => {
    if (chosen.length === n) { out.push(chosen); return }
    for (let i = start; i < size; i++) walk(i + 1, [...chosen, i])
  }
  walk(0, [])
  return out
}

/** 走過 count 顆骰的每一種面向組合，交給 visit。 */
function eachFaceCombo(count, visit) {
  const shown = new Array(count).fill(0)
  const walk = depth => {
    if (depth === count) { visit(shown); return }
    for (let f = 0; f < FACE_KEYS.length; f++) {
      shown[depth] = f
      walk(depth + 1)
    }
  }
  walk(0)
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
