// Everything a player can own — avatars, flags, titles — and what it takes to get one.
//
// The image files are discovered by nameplateAssets.js globbing the asset folders, which gives
// ids and nothing else — enough while the only question was "show this picture", not enough
// once a player opens a gift and the screen has to say what they won and why.
//
// A plain list on purpose. An earlier version derived most of the avatar and flag rows from
// the `{season}-{tier}` id pattern, which saved eight lines per event and cost more than it
// saved: editing one entry's wording meant adding an override beside the rule, and a mistyped
// id still produced confident-looking text instead of standing out. Adding a season is eight
// rows twice a year. Write them.
//
// `kind` is part of the key because avatars and flags share ids — `2026-9-champion` is both a
// face and a banner, and they are not called the same thing.
//
// Titles carry two extra fields:
//   `rank`  what the title is worth; the banner colours it accordingly, so 新鮮人 never arrives
//           in the same gold as 冠軍 — the point of a rare colour is that most people lack it.
//   `group` which section it sits under in the pickers. `general` is special: everything in it
//           is free to everyone (see isTitleUnlocked), so a limited title must not go there no
//           matter how general it sounds. Its ids must also start with `gen-` — that prefix is
//           how the server knows the same thing without being handed this file; see the check
//           at the foot of this module.
export const GROUP_LABELS = {
  general: '通用',
  limited: '限定',
  meetup1: 'Meetup#1',
  meetup2: 'Meetup#2',
  meetup3: 'Meetup#3',
  achievement: '特殊成就',
  secret: '秘密'
}

export const ASSETS = [
  // ── 頭像 ──
  { kind: 'avatar', id: '2026-9-default',       name: 'Meetup#1 賽季頭像',  obtain: 'Meetup#1 賽季開跑' },
  { kind: 'avatar', id: '2026-9-participants',  name: 'Meetup#1 參加頭像',  obtain: '參與 Meetup#1 線下活動' },
  { kind: 'avatar', id: '2026-9-winner',        name: 'Meetup#1 入賞頭像',  obtain: 'Meetup#1 線下活動：前三名' },
  { kind: 'avatar', id: '2026-9-champion',      name: 'Meetup#1 冠軍頭像',  obtain: 'Meetup#1 線下活動：冠軍' },
  { kind: 'avatar', id: '2026-10-default',      name: 'Meetup#2 賽季頭像',  obtain: 'Meetup#2 賽季開跑' },
  { kind: 'avatar', id: '2026-10-participants', name: 'Meetup#2 參加頭像',  obtain: '參與 Meetup#2 線下活動' },
  { kind: 'avatar', id: '2026-10-winner',       name: 'Meetup#2 入賞頭像',  obtain: 'Meetup#2 線下活動：前三名' },
  { kind: 'avatar', id: '2026-10-champion',     name: 'Meetup#2 冠軍頭像',  obtain: 'Meetup#2 線下活動：冠軍' },
  { kind: 'avatar', id: '2026-12-default',      name: 'Meetup#3 賽季頭像',  obtain: 'Meetup#3 賽季開跑' },
  { kind: 'avatar', id: '2026-12-participants', name: 'Meetup#3 參加頭像',  obtain: '參與 Meetup#3 線下活動' },
  { kind: 'avatar', id: '2026-12-winner',       name: 'Meetup#3 入賞頭像',  obtain: 'Meetup#3 線下活動：前三名' },
  { kind: 'avatar', id: '2026-12-champion',     name: 'Meetup#3 冠軍頭像',  obtain: 'Meetup#3 線下活動：冠軍' },
  { kind: 'avatar', id: '2026-early-player',    name: '早鳥玩家頭像',       obtain: '早期註冊 PLAKORO ARENA 的玩家' },
  { kind: 'avatar', id: 'lucky-mascot',         name: 'LUCKY 吉祥物頭像',   obtain: '實體賽事：一擊打出 100 滴以上傷害' },
  { kind: 'avatar', id: 'perfect-mascot',       name: 'PERFECT 吉祥物頭像', obtain: '實體賽事：擊敗對手時，還保留 120 滴血量' },
  { kind: 'avatar', id: 'safe-mascot',          name: 'SAFE 吉祥物頭像',    obtain: '實體賽事：擊敗對手時，僅剩下 10 滴血量' },
  // `secret-` 開頭的素材在玩家沒拿到之前不會出現在選擇器裡（見 nameplateAssets 的
  // isSecretAsset），所以這行獲取條件只有拿到的人看得到 —— 寫「秘密禮物」是刻意的：
  // 能看到它的時候東西已經在手上了，再解釋一次條件反而少了點什麼。
  { kind: 'avatar', id: 'secret-mame',          name: '秘密頭像',           obtain: '秘密禮物' },

  // ── 旗幟 ──
  { kind: 'background', id: '2026-9-default',       name: 'Meetup#1 基本旗幟', obtain: 'Meetup#1 賽季開跑' },
  { kind: 'background', id: '2026-9-participants',  name: 'Meetup#1 參加旗幟', obtain: '參與 Meetup#1 線下活動' },
  { kind: 'background', id: '2026-9-winner',        name: 'Meetup#1 入賞旗幟', obtain: 'Meetup#1 線下活動：前三名' },
  { kind: 'background', id: '2026-9-champion',      name: 'Meetup#1 冠軍旗幟', obtain: 'Meetup#1 線下活動：冠軍' },
  { kind: 'background', id: '2026-10-default',      name: 'Meetup#2 基本旗幟', obtain: 'Meetup#2 賽季開跑' },
  { kind: 'background', id: '2026-10-participants', name: 'Meetup#2 參加旗幟', obtain: '參與 Meetup#2 線下活動' },
  { kind: 'background', id: '2026-10-winner',       name: 'Meetup#2 入賞旗幟', obtain: 'Meetup#2 線下活動：前三名' },
  { kind: 'background', id: '2026-10-champion',     name: 'Meetup#2 冠軍旗幟', obtain: 'Meetup#2 線下活動：冠軍' },
  { kind: 'background', id: '2026-12-default',      name: 'Meetup#3 基本旗幟', obtain: 'Meetup#3 賽季開跑' },
  { kind: 'background', id: '2026-12-participants', name: 'Meetup#3 參加旗幟', obtain: '參與 Meetup#3 線下活動' },
  { kind: 'background', id: '2026-12-winner',       name: 'Meetup#3 入賞旗幟', obtain: 'Meetup#3 線下活動：前三名' },
  { kind: 'background', id: '2026-12-champion',     name: 'Meetup#3 冠軍旗幟', obtain: 'Meetup#3 線下活動：冠軍' },

  { kind: 'background', id: 'secret-tama',          name: '秘密旗幟',          obtain: '秘密禮物' },

  // ── 稱號 ──
  { kind: 'title', id: 'gen-rookie',     name: '骰子新鮮人',    group: 'general',     rank: 'plain',  obtain: '我入坑骰子啦！' },
  { kind: 'title', id: 'early-player',   name: '早鳥玩家',      group: 'limited',     rank: 'epic',   obtain: '早期註冊 PLAKORO ARENA 的玩家' },

  { kind: 'title', id: 'm1-champion',    name: 'Meetup#1 冠軍', group: 'meetup1',     rank: 'gold',   obtain: 'Meetup#1 線下活動：冠軍' },
  { kind: 'title', id: 'm1-runner-up',   name: 'Meetup#1 亞軍', group: 'meetup1',     rank: 'silver', obtain: 'Meetup#1 線下活動：亞軍' },
  { kind: 'title', id: 'm1-third',       name: 'Meetup#1 季軍', group: 'meetup1',     rank: 'bronze', obtain: 'Meetup#1 線下活動：季軍' },
  { kind: 'title', id: 'm1-attendee',    name: 'Meetup#1 會眾', group: 'meetup1',     rank: 'plain',  obtain: '參與 Meetup#1 線下活動' },

  { kind: 'title', id: 'm2-champion',    name: 'Meetup#2 冠軍', group: 'meetup2',     rank: 'gold',   obtain: 'Meetup#2 線下活動：冠軍' },
  { kind: 'title', id: 'm2-runner-up',   name: 'Meetup#2 亞軍', group: 'meetup2',     rank: 'silver', obtain: 'Meetup#2 線下活動：亞軍' },
  { kind: 'title', id: 'm2-third',       name: 'Meetup#2 季軍', group: 'meetup2',     rank: 'bronze', obtain: 'Meetup#2 線下活動：季軍' },
  { kind: 'title', id: 'm2-attendee',    name: 'Meetup#2 會眾', group: 'meetup2',     rank: 'plain',  obtain: '參與 Meetup#2 線下活動' },
  { kind: 'title', id: 'm2-roll',        name: '骰起來！',      group: 'meetup2',     rank: 'plain',  obtain: '參與 Meetup#2 線下活動' },
  { kind: 'title', id: 'm2-no-regret',   name: '落子無悔',      group: 'meetup2',     rank: 'epic',   obtain: 'Meetup#2 線下活動：前三名' },
  { kind: 'title', id: 'm2-general',     name: '骰子大將軍',    group: 'meetup2',     rank: 'legend', obtain: 'Meetup#2 線下活動：冠軍' },

  { kind: 'title', id: 'm3-champion',    name: 'Meetup#3 冠軍', group: 'meetup3',     rank: 'gold',   obtain: 'Meetup#3 線下活動：冠軍' },
  { kind: 'title', id: 'm3-runner-up',   name: 'Meetup#3 亞軍', group: 'meetup3',     rank: 'silver', obtain: 'Meetup#3 線下活動：亞軍' },
  { kind: 'title', id: 'm3-third',       name: 'Meetup#3 季軍', group: 'meetup3',     rank: 'bronze', obtain: 'Meetup#3 線下活動：季軍' },
  { kind: 'title', id: 'm3-attendee',    name: 'Meetup#3 會眾', group: 'meetup3',     rank: 'plain',  obtain: '參與 Meetup#3 線下活動' },
  { kind: 'title', id: 'm3-tourist',     name: '罪惡城觀光客',  group: 'meetup3',     rank: 'plain',  obtain: 'Meetup#3 賽季開跑' },
  { kind: 'title', id: 'm3-gang',        name: '骰子幫成員',    group: 'meetup3',     rank: 'plain',  obtain: '參與 Meetup#3 線下活動' },
  { kind: 'title', id: 'm3-overlord',    name: '街頭骰子霸主',  group: 'meetup3',     rank: 'epic',   obtain: 'Meetup#3 線下活動：前三名' },
  { kind: 'title', id: 'm3-godfather',   name: '地下骰子教父',  group: 'meetup3',     rank: 'legend', obtain: 'Meetup#3 線下活動：冠軍' },

  // Awarded by hand. Nothing checks these — the battle detail that would prove them isn't
  // recorded anywhere — so someone watched it happen and says so. Each pairs with a mascot
  // avatar earned the same way.
  { kind: 'title', id: 'ach-big-hit',    name: '賽到的',        group: 'achievement', rank: 'plain',  obtain: '實體賽事：一擊打出 100 滴以上傷害' },
  { kind: 'title', id: 'ach-last-stand', name: '九死一生',      group: 'achievement', rank: 'epic',   obtain: '實體賽事：擊敗對手時，僅剩下 10 滴血量' },
  { kind: 'title', id: 'ach-untouched',  name: '怎麼結束了？',  group: 'achievement', rank: 'legend', obtain: '實體賽事：擊敗對手時，還保留 120 滴血量' },

  // Its own group, which is how it stays hidden: the picker drops any group with nothing left
  // to show, and a secret nobody owns leaves this one empty. Lumping it in with 限定 would put
  // an empty-looking slot where a player can count what they are missing.
  { kind: 'title', id: 'secret-poop',    name: '便便～',        group: 'secret',      rank: 'epic',   obtain: '秘密禮物' }
]

/*
 * 「通用」組的稱號不需要授予，所有人都戴得到 —— 但那個判斷在兩個地方各做一次：這裡的
 * isTitleUnlocked 決定選擇器上亮不亮，伺服器的 isAssetAllowed 決定存不存得進去。伺服器
 * 讀不到這份目錄，它認的是 id 開頭的 `gen-`。
 *
 * 所以兩邊靠的是一個約定：通用組的 id 一律 gen- 開頭。約定沒人檢查就會壞 —— 這正是上一
 * 次出事的方式：伺服器那邊本來寫死認 `gen-rookie`，通用組只要多第二個稱號，玩家就會看到
 * 一個點得下去、按了儲存卻被退的稱號。
 *
 * 所以在這裡擋下來。開發時就炸，而不是等上線之後靠玩家回報。
 */
if (import.meta.env.DEV) {
  const titles = ASSETS.filter(a => a.kind === 'title')
  const missingPrefix = titles.filter(a => a.group === 'general' && !a.id.startsWith('gen-'))
  // 反過來也要擋。gen- 開頭卻放在別組的話，選擇器會鎖著它，伺服器卻放行 —— 那是一個
  // 「畫面上拿不到、但手刻一個請求就戴得上」的稱號，比對不起來更糟。
  const falsePrefix = titles.filter(a => a.group !== 'general' && a.id.startsWith('gen-'))
  if (missingPrefix.length || falsePrefix.length) {
    throw new Error([
      '通用組的稱號 id 必須以 gen- 開頭，且只有通用組可以用這個前綴（伺服器靠它放行）。',
      missingPrefix.length ? `少了前綴：${missingPrefix.map(a => a.id).join(', ')}` : '',
      falsePrefix.length ? `前綴用錯組：${falsePrefix.map(a => a.id).join(', ')}` : ''
    ].filter(Boolean).join(' '))
  }
}

const BY_KEY = new Map(ASSETS.map(a => [`${a.kind}:${a.id}`, a]))

/**
 * One asset's entry, or null if the catalogue has never heard of it.
 *
 * Null rather than a guess: an unlisted id is a typo in a hand-written grant, or a file added
 * without a catalogue entry — both want to be visible rather than papered over with text that
 * looks right.
 */
export function describeAsset(kind, id) {
  return BY_KEY.get(`${kind}:${id}`) || null
}

// Titles grouped for the pickers, in the order GROUP_LABELS declares. Derived, so a new title
// is added once — to the list above — and appears everywhere.
export const TITLE_GROUPS = Object.entries(GROUP_LABELS)
  .map(([key, label]) => ({ key, label, titles: ASSETS.filter(a => a.kind === 'title' && a.group === key) }))
  .filter(g => g.titles.length)

/**
 * The fields a nameplate needs to render a title, or null for an id the catalogue doesn't list.
 *
 * Null for the same reason as above: a plate showing the wrong accolade is worse than one
 * showing none.
 */
export function resolveTitle(id) {
  const t = BY_KEY.get(`title:${id}`)
  return t ? { text: t.name, rank: t.rank } : null
}
