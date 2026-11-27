// What energy-die parts each retail product actually contains.
//
// `jpy` is the Japanese list price. It is never shown — the planner is a parts list, not a price
// list — but it has to be here, because the objective needs it: boxes are not interchangeable
// units. The DX set holds roughly three starters' worth of parts, so "fewest boxes" would rank
// one DX box above three starters and recommend the more expensive option while appearing to
// recommend the smaller one.
//
// Source: pla-koro.com's product database, which counted them off the official BANDAI product
// photos. Types are named the way that site names them (火 for the official 炎, 格 for 鬥,
// 飛 for 空); TYPE_FROM_ZH below maps them onto the Japanese names the rest of this codebase
// uses, so nothing outside this file has to know about the discrepancy.
//
// Every `confirmed` set is internally consistent with its own printed contents list: a starter
// set lists "改裝晶片 ×18", and its single + dual counts add up to exactly 18. That agreement is
// the reason this data is trustworthy enough to base a shopping list on.
//
// `release` is the announced on-sale date, either a full date or just a month when that's all
// BANDAI has said. It matters because a shopping list is useless if half of it isn't in shops
// yet: the planner has to separate "buy this today" from "this would help, in December".
//
// `status` is carried through rather than filtered out, because "we don't know" and "it's
// random" are answers the planner has to be able to give:
//   confirmed - counted off the photos, safe to plan against
//   unknown   - not yet published or not yet counted
//   random    - a blind box: the six Pokémon in a wave share one SKU, so which parts you get
//               is decided when you open it


import { CONVEX_TYPES, CONCAVE_TYPES } from '../game/diceParts'

// The source site writes types in Chinese; the game data uses Japanese.
export const TYPE_FROM_ZH = {
  草: 'くさ', 火: 'ほのお', 水: 'みず', 雷: 'かみなり', 鋼: 'はがね',
  惡: 'あく', 格: 'かくとう', 超: 'ちょう', 飛: 'ひこう'
}
export const TYPE_TO_ZH = Object.fromEntries(Object.entries(TYPE_FROM_ZH).map(([zh, ja]) => [ja, zh]))

export const PART_STATUS = { confirmed: 'confirmed', unknown: 'unknown', random: 'random' }

// A half-die carries one fixed face. Which pool it belongs to is decided by its type, not by
// anything in the data — the convex face can only ever be one of five types and the concave one
// of four, so a count of "火 halves" is unambiguously a count of convex halves.
export function halfKind(jaType) {
  if (CONVEX_TYPES.includes(jaType)) return 'convex'
  if (CONCAVE_TYPES.includes(jaType)) return 'concave'
  return null
}

// Raw counts keyed by the source site's Chinese type names. `dual` keys are "A+B" pairs, and
// a pair of the same type (火+火) is a real printed chip, not a data error — which is what
// makes an all-one-type die buildable at all.
const RAW = {
  st01: { id: '01_7173', name: '啟程套組 妙蛙種子 01', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 草: 1, 惡: 1, 火: 1, 格: 1, 雷: 1, 超: 1 },
    single: { 草: 3, 飛: 1, 水: 1, 火: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '草+草': 5, '惡+草': 2, '惡+惡': 1, '格+格': 1 } },
  st02: { id: '01_7174', name: '啟程套組 小火龍 02', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 火: 1, 雷: 1, 鋼: 1, 格: 1, 飛: 1, 超: 1 },
    single: { 火: 3, 雷: 1, 水: 1, 草: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '火+火': 5, '火+雷': 1, '超+超': 1, '鋼+雷': 1, '火+鋼': 1 } },
  st03: { id: '01_7175', name: '啟程套組 傑尼龜 03', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 草: 1, 格: 1, 水: 1, 飛: 1, 雷: 1, 惡: 1 },
    single: { 水: 3, 超: 1, 火: 1, 草: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '水+水': 5, '格+水': 2, '格+格': 1, '惡+草': 1 } },
  st04: { id: '01_7176', name: '啟程套組 皮卡丘 04', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 鋼: 1, 格: 1, 水: 1, 飛: 1, 雷: 1, 惡: 1 },
    single: { 雷: 3, 超: 1, 火: 1, 草: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '雷+雷': 5, '鋼+雷': 2, '惡+惡': 1, '火+雷': 1 } },
  st05: { id: '01_7177', name: '啟程套組 伊布 05', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 火: 1, 飛: 1, 草: 1, 超: 1, 水: 1, 惡: 1 },
    single: { 飛: 3, 超: 1, 雷: 1, 水: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '飛+飛': 4, '超+飛': 1, '惡+飛': 1, '格+格': 1, '惡+惡': 1, '惡+超': 1 } },
  st06: { id: '01_7178', name: '啟程套組 夢幻 06', category: 'starter', jpy: 900, release: '2026-07-18', status: 'confirmed',
    halves: { 火: 1, 水: 1, 草: 1, 超: 1, 格: 1, 惡: 1 },
    single: { 超: 4, 飛: 1, 雷: 1, 鋼: 1, 惡: 1, 格: 1 },
    dual: { '超+超': 5, '惡+超': 1, '格+水': 1, '格+格': 1, '惡+惡': 1 } },
  st07: { id: '01_7179', name: '啟程套組 耿鬼 07', category: 'starter', jpy: 900, release: '2026-09-12', status: 'confirmed',
    halves: { 草: 1, 惡: 1, 鋼: 1, 超: 1, 火: 1, 飛: 1 },
    single: { 惡: 3, 雷: 1, 超: 2, 飛: 1, 格: 1, 水: 1 },
    dual: { '惡+惡': 5, '惡+超': 2, '火+飛': 1, '雷+飛': 1 } },
  st08: { id: '01_7180', name: '啟程套組 巨金怪 08', category: 'starter', jpy: 900, release: '2026-09-12', status: 'confirmed',
    halves: { 火: 1, 超: 1, 鋼: 1, 惡: 1, 雷: 1, 飛: 1 },
    single: { 鋼: 3, 雷: 1, 格: 1, 惡: 1, 水: 1, 火: 1, 草: 1 },
    dual: { '鋼+鋼': 5, '格+鋼': 1, '雷+雷': 1, '水+飛': 1, '格+草': 1 } },
  st09: { id: '01_7181', name: '啟程套組 路卡利歐 09', category: 'starter', jpy: 900, release: '2026-09-12', status: 'confirmed',
    halves: { 鋼: 1, 格: 1, 水: 1, 飛: 1, 雷: 1, 超: 1 },
    single: { 格: 3, 惡: 1, 鋼: 2, 火: 1, 超: 1, 雷: 1 },
    dual: { '格+格': 5, '格+鋼': 2, '火+雷': 1, '鋼+鋼': 1 } },

  // 官方只有一個商品：「PLAKORO 探險盒組 01」，品番 01_7172，六隻共用同一個品番，開了
  // 才知道是哪一隻（https://global.bandai-hobby.net/tw/item/01_7172/，內含角色骰子 ×1、
  // 改裝晶片 ×4）。所以「01」是**盒號**，不是寶可夢的編號 —— 這裡的六列是同一盒的六種
  // 內容，不是六個商品。
  //
  // 仍然分成六列，是因為購物規劃需要知道「拿到哪一隻會得到哪四片晶片」。玩家轉賣開封
  // 過的確認款，所以指定某一隻是買得到的；但在店頭買它是盲盒，planner 的建議要照這個
  // 前提讀。
  //
  // Expedition boxes carry no half-dice at all — a figure and a handful of chips only, so they
  // top up chips and can never supply a fixed face. They ship in waves of six (EBC01, EBC02…),
  // and the wave is the category: a wave is what goes on sale together and what sells out
  // together, so "which wave is this from" is the question a buyer actually asks. Sold at retail as a blind box, but
  // players resell the ones they've opened as 確認款, so a specific figure is obtainable and the
  // planner treats it as any other product.
  eb01s01: { id: '01_7172', name: '探險盒組 凱羅斯', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 草: 2 }, dual: { '草+草': 1, '格+格': 1 } },
  eb01s02: { id: '01_7172', name: '探險盒組 火焰鳥', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 火: 1, 飛: 1 }, dual: { '火+火': 1, '飛+飛': 1 } },
  eb01s03: { id: '01_7172', name: '探險盒組 急凍鳥', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 水: 1, 飛: 1 }, dual: { '水+水': 1, '飛+飛': 1 } },
  eb01s04: { id: '01_7172', name: '探險盒組 閃電鳥', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 雷: 1, 飛: 1 }, dual: { '雷+雷': 1, '飛+飛': 1 } },
  eb01s05: { id: '01_7172', name: '探險盒組 大岩蛇', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 格: 2 }, dual: { '格+格': 2 } },
  eb01s06: { id: '01_7172', name: '探險盒組 臭泥', category: 'expedition01', jpy: 350, release: '2026-07-18', status: 'confirmed',
    halves: {}, single: { 惡: 2 }, dual: { '惡+惡': 2 } },

  // 探險盒組 02（品番 01_7182、¥350、2026 年 11 月）。跟 01 一樣是盲盒：六隻共用同一
  // 個品番，開到哪一隻是拆開才知道的，所以六列的 id 相同。官方只公布到月份，沒有給
  // 到日，release 就照實寫成月份 —— isReleased 會從那個月的 1 號起算。
  //
  // 晶片數跟官方標示的「改裝晶片 × 4」一致：每一隻都是兩片圓的加兩片方的。
  eb02s01: { id: '01_7182', name: '探險盒組 忍蛙', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 水: 2 }, dual: { '水+超': 1, '水+草': 1 } },
  eb02s02: { id: '01_7182', name: '探險盒組 小緞匠', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 超: 1, 鋼: 1 }, dual: { '超+超': 2 } },
  eb02s03: { id: '01_7182', name: '探險盒組 勾魂眼', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 惡: 2 }, dual: { '惡+惡': 1, '惡+水': 1 } },
  eb02s04: { id: '01_7182', name: '探險盒組 波士可多拉', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 鋼: 2 }, dual: { '鋼+鋼': 2 } },
  eb02s05: { id: '01_7182', name: '探險盒組 列空座', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 火: 1, 雷: 1 }, dual: { '火+雷': 2 } },
  eb02s06: { id: '01_7182', name: '探險盒組 吉利蛋', category: 'expedition02', jpy: 350, release: '2026-11', status: 'confirmed',
    halves: {}, single: { 飛: 2 }, dual: { '飛+飛': 2 } },

  dx01: { id: '01_7285', name: 'DX 啟程套組 01（皮卡丘・伊布・夢幻）', category: 'dx', jpy: 4000, release: '2026-12', status: 'confirmed',
    halves: { 鋼: 1, 格: 2, 水: 3, 飛: 2, 雷: 1, 惡: 3, 火: 2, 草: 2, 超: 2 },
    single: { 雷: 5, 超: 6, 火: 1, 草: 1, 鋼: 3, 惡: 3, 格: 3, 飛: 4, 水: 1 },
    dual: { '雷+雷': 5, '鋼+雷': 2, '惡+惡': 3, '火+雷': 1, '飛+飛': 4, '超+飛': 1, '惡+飛': 1,
            '格+格': 2, '惡+超': 2, '超+超': 5, '格+水': 1 } }
}


function toJa(counts) {
  const out = {}
  Object.entries(counts || {}).forEach(([zh, n]) => { out[TYPE_FROM_ZH[zh] || zh] = n })
  return out
}

function dualToJa(counts) {
  const out = {}
  Object.entries(counts || {}).forEach(([pair, n]) => {
    const key = pair.split('+').map(z => TYPE_FROM_ZH[z] || z).sort().join('+')
    out[key] = (out[key] || 0) + n
  })
  return out
}

// Products with their type names translated, and halves split into the two pools so callers
// never have to re-derive which face a type belongs to.
// The grid shows a lot of these side by side, so the category prefix (which the section heading
// already says) is dropped: "啟程套組 小火龍 02" reads as "小火龍 02".
function shortName(name) {
  return name.replace(/^(啟程套組|探險盒組|DX 啟程套組)\s*/, '')
}

function normalise(key, p) {
  const halves = toJa(p.halves)
  const convex = {}
  const concave = {}
  Object.entries(halves).forEach(([ja, n]) => {
    if (halfKind(ja) === 'convex') convex[ja] = n
    else if (halfKind(ja) === 'concave') concave[ja] = n
  })
  return { key, ...p, shortName: shortName(p.name), convex, concave, single: toJa(p.single), dual: dualToJa(p.dual) }
}

/**
 * 這一份就是唯一的一份。
 *
 * 曾經把它搬進資料庫、配一頁後台表單，想讓新商品不必改檔發版。那條路沒有省到人：九種
 * 屬性各幾片是要對著官方商品照數出來的，數的人是誰，誰就在改這個檔 —— 後台只是把同
 * 一件事多繞一圈伺服器，還讓「產品資訊」這頁多了一個連不上就空白的理由。
 *
 * 新商品一兩個月才一盒，跟著一次版本走完全來得及。
 */
export const productParts = Object.entries(RAW).map(([key, p]) => normalise(key, p))



// Whether a product is on sale as of `asOf`. Month-only dates count from the 1st: BANDAI hasn't
// named a day, so the first of the month is the earliest it could be out, and treating it as
// later would keep saying "not yet" through the whole month it actually shipped in.
export function isReleased(product, asOf = new Date()) {
  if (!product.release) return false
  const parts = product.release.split('-').map(Number)
  const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
  return d <= asOf
}

// True when only the month is known — the UI should say "December" rather than invent the 1st.
export function releaseIsMonthOnly(product) {
  return !!product.release && product.release.split('-').length === 2
}
