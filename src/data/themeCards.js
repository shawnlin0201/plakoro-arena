// 主題卡 —— 實體聚會限定的規則卡。
//
// 這裡沒有任何判定。主題卡改的是「這場比賽怎麼打」，不是「這一擲算幾點」，而實體賽
// 的裁判是坐在對面的那個人 —— app 要是也跟著算一次，兩邊算出不同答案時反而要先吵
// 「以誰為準」。所以這個模組只做三件事：卡表、玩家選了哪幾張、哪幾張已經用掉了。
//
// 卡面文字一律中文，跟印出來的實體卡同一份文案。這跟法律條文同一個理由：現場拿在手
// 上的那張卡只有中文，介面翻成日文只會讓兩個人對著不同的字討論同一張卡。介面本身
// （按鈕、提示）仍然照常 i18n。

// 一季一組。換主題不是改這裡的結構，是在陣列裡多加一組 —— 舊的那組留著，因為玩家
// 可能還想回頭看上一季帶過什麼。
//
// `enabled: false` 可以把還沒公開的那組先藏起來，卡表照樣寫在這裡、照樣進版控，不必
// 等到活動當天才貼上去。
export const THEME_CARD_SETS = [
  {
    id: 'sin-city',
    name: '罪惡城',
    // 主題列表上的一句話。不是卡表的摘要，是「這一場的世界長什麼樣」。
    tagline: '警匪對峙的一夜。先選邊站，再決定帶哪幾張上桌。',
    // 這一組共用的卡框。放在主題上而不是每張卡上，因為換主題才會換框 —— 同一組裡
    // 十張卡各自記一次同樣的檔名，只是十個會不同步的地方。陣營要是有自己的框，寫
    // 在陣營上就會蓋過這一個。
    // 檔案放 public/image/THEMECARD/ 底下，值寫相對路徑（例：'sin-city/frame.png'）。
    frame: '',
    enabled: true,
    // 一個主題分成兩邊，玩家只能選一邊。這是規則本身，不是分類方式 —— 兩邊的卡放
    // 在同一個陣列裡再標一個 side 欄位也做得到，但那樣「只能選一邊」就變成畫面上
    // 的一條規矩，而不是資料的形狀，之後很容易在某個地方忘記擋。
    factions: [
      {
        id: 'police',
        name: '警察',
        tagline: '壓制對手的行動',
        frame: '',
        cards: [
          {
            id: 'sin-city-police-freeze',
            name: '「趴下！」',
            text: '對手下回合角色骰固定為趴下。',
            // 卡圖同樣相對於 public/image/THEMECARD/。沒填就只顯示文字 —— 卡表要
            // 能在美術進來之前先排得出來，不然文案跟圖片就得綁在一起等。
            image: ''
          },
          {
            id: 'sin-city-police-shoot',
            name: '「射擊」',
            text: '對方下回合角色骰若不是左橫或右橫，立刻扣除 20 HP。',
            image: ''
          }
        ]
      },
      {
        id: 'crook',
        name: '歹徒',
        tagline: '改寫自己的運氣',
        frame: '',
        cards: [
          {
            id: 'sin-city-crook-loaded-dice',
            name: '「作弊骰子」',
            text: '從丟出的能量骰、角色骰挑選一個重新丟一次。',
            image: ''
          }
        ]
      }
    ]
  }
]

// 一組主題的全部卡，不分陣營。只有「這個 id 還存在嗎」這種問題該用它 —— 玩家看得
// 到的任何一個畫面都是站在某一邊的，拿整組卡表去跑就會把另一邊的卡也端出來。
export function allCards(set) {
  return (set.factions || []).flatMap(f => f.cards || [])
}

export function factionOf(set, factionId) {
  return (set && set.factions || []).find(f => f.id === factionId) || null
}

export const DEFAULT_LIMIT = 2

// 上限給到 6：一組卡表目前就幾張，選超過等於全帶，那就不叫選卡了。但實際要帶幾張是
// 主辦當場宣布的，不是程式說了算 —— 所以這裡只擋住明顯荒謬的數字，剩下交給玩家。
export const MIN_LIMIT = 1
export const MAX_LIMIT = 6

const STORAGE_KEY = 'plakoro_theme_cards_v1'

export function setById(id) {
  return THEME_CARD_SETS.find(s => s.id === id) || null
}

export function visibleSets() {
  return THEME_CARD_SETS.filter(s => s.enabled !== false)
}

function emptyState() {
  return { limit: DEFAULT_LIMIT, lastSet: null, bySet: {} }
}

/**
 * 讀回上一次的選卡。形狀對不上就當作沒有 —— 這份東西的用途是「現場少按幾下」，
 * 為了救一份半殘的紀錄而讓畫面進到奇怪的狀態，划不來。
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return emptyState()
    const state = emptyState()
    if (Number.isInteger(data.limit)) {
      state.limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, data.limit))
    }
    if (typeof data.lastSet === 'string' && setById(data.lastSet)) state.lastSet = data.lastSet
    if (data.bySet && typeof data.bySet === 'object') {
      for (const set of THEME_CARD_SETS) {
        const saved = data.bySet[set.id]
        if (!saved || typeof saved !== 'object') continue
        const faction = factionOf(set, saved.faction)
        if (!faction) continue
        // 只收這一邊還認得的 id。卡表改過、或者陣營從底下被換掉之後，舊紀錄裡那些
        // 已經不存在的卡會在這裡被濾掉，而不是變成畫面上選不掉的幽靈。對面陣營的
        // 卡也擋在這裡 —— 選邊是規則，不是上一次打開時的偏好。
        const known = new Set(faction.cards.map(c => c.id))
        const picked = Array.isArray(saved.picked) ? saved.picked.filter(id => known.has(id)) : []
        const used = Array.isArray(saved.used) ? saved.used.filter(id => picked.includes(id)) : []
        state.bySet[set.id] = { faction: faction.id, picked, used }
      }
    }
    return state
  } catch {
    return emptyState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 無痕模式、配額滿了之類的。記不起來只是下次要重選一次，不值得打斷現場。
  }
}

// 卡圖與卡框都住在 public/image/THEMECARD/ 底下。寫成相對路徑而不是完整網址，是因為
// 這個 app 可能被部署在子路徑下，組網址一律要過 assetPath（見該檔開頭）。
export function themeCardAsset(path) {
  return path ? `image/THEMECARD/${path}` : ''
}
