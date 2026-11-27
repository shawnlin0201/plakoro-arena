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
    tagline: '',
    enabled: true,
    // 一個主題就是一疊卡，玩家從裡面挑幾張。帶幾張是當場賽事宣布的規矩，不是這個
    // 工具的，所以這裡不設上限。
    //
    // `no` 是卡面上印的編號，跟 id 分開：id 要從卡還沒編號的時候就固定下來，而編號
    // 是美術定稿時才給的，兩者綁在一起等於每次補編號都要去改一次存檔裡的紀錄。
    //
    // `text` 跟卡面上印的是同一句話。卡面寫的是骰面圖示，這裡寫成字 —— 讀螢幕的人、
    // 以及卡圖還沒進來的時候，看到的要是同一條規則。
    //
    // `image` 是整張卡的成品圖（框、標題、內文都已經印在上面），相對於
    // public/image/THEMECARD/。沒填就只顯示上面的文字 —— 卡表要能在美術進來之前先
    // 排得出來，不然文案跟圖片就得綁在一起等。
    cards: [
      {
        id: 'gtavi-01',
        no: 'GTAVI-01',
        name: '警察！趴下！',
        text: '對手下回合角色骰面固定為倒立。（無法用招式改判骰面）',
        image: 'sin-city/GTAVI-01.webp'
      },
      {
        id: 'gtavi-02',
        no: 'GTAVI-02',
        name: '故障的作弊骰子',
        text: '本回合我方擲骰結束後，由我方決定一顆能量骰，由對方重擲一次。',
        image: 'sin-city/GTAVI-02.webp'
      },
      {
        id: 'gtavi-03',
        no: 'GTAVI-03',
        name: '黑吃黑',
        text: '此回合我方攻擊後執行以下：我方先減 20 血量，對方再減 20 血量。（無法用招式效果免除傷害）',
        image: 'sin-city/GTAVI-03.webp'
      },
      {
        id: 'gtavi-04',
        no: 'GTAVI-04',
        name: '趁火打劫',
        text: '若對手上回合使出火屬性招式，本回合我方造成對手傷害額外加上 20。',
        image: 'sin-city/GTAVI-04.webp'
      },
      {
        id: 'gtavi-05',
        no: 'GTAVI-05',
        name: '直升機追緝',
        text: '對手下回合擲骰時，對手需站起來投擲所有骰子，若骰子掉落骰盤外或桌子底下則該骰無效。（使用此卡的人決定使用哪個骰盤）',
        image: 'sin-city/GTAVI-05.webp'
      },
      {
        id: 'gtavi-06',
        no: 'GTAVI-06',
        name: '不公平的交易',
        text: '先由你選擇對方的一個能量骰，再由對方選擇你的一個能量骰，兩邊同時交換後繼續進行遊戲。',
        image: 'sin-city/GTAVI-06.webp'
      },
      {
        id: 'gtavi-07',
        no: 'GTAVI-07',
        name: '武力支援',
        text: '本回合我方角色骰可重擲一次。',
        image: 'sin-city/GTAVI-07.webp'
      },
      {
        id: 'gtavi-08',
        no: 'GTAVI-08',
        name: '突破火線',
        text: '對手下回合攻擊使我方受到致命傷時，我方丟擲角色骰一次，若面朝左、右，則傷害減 20。',
        image: 'sin-city/GTAVI-08.webp'
      },
      {
        id: 'gtavi-09',
        no: 'GTAVI-09',
        name: '越獄計畫',
        text: '免除對手上回合對你所有招式與主題卡所帶來的控制。',
        image: 'sin-city/GTAVI-09.webp'
      },
      {
        id: 'gtavi-10',
        no: 'GTAVI-10',
        name: '有福同享',
        text: '對手下回合與我方下個回合角色骰固定為立。（無法用招式改判骰面）',
        image: 'sin-city/GTAVI-10.webp'
      },
      {
        id: 'gtavi-11',
        no: 'GTAVI-11',
        name: '口頭警告',
        text: '若本回合無造成對手傷害，則下回合傷害結算時，額外造成對手 20 點傷害。',
        image: 'sin-city/GTAVI-11.webp'
      },
      {
        id: 'gtavi-12',
        no: 'GTAVI-12',
        name: '順手牽羊',
        text: '本回合選擇對手一個招式來使用，需達成招式指定能量與角色骰面。',
        image: 'sin-city/GTAVI-12.webp'
      }
    ]
  }
]

const STORAGE_KEY = 'plakoro_theme_cards_v1'

export function setById(id) {
  return THEME_CARD_SETS.find(s => s.id === id) || null
}

export function visibleSets() {
  return THEME_CARD_SETS.filter(s => s.enabled !== false)
}

function emptyState() {
  return { lastSet: null, bySet: {} }
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
    // 舊版存過一個「一場帶幾張」的上限。那條規矩後來交還給當場的賽事了，所以讀回來
    // 時直接忽略 —— 不必特地清掉，下一次存檔自然就不再寫它。
    if (typeof data.lastSet === 'string' && setById(data.lastSet)) state.lastSet = data.lastSet
    if (data.bySet && typeof data.bySet === 'object') {
      for (const set of THEME_CARD_SETS) {
        const saved = data.bySet[set.id]
        if (!saved || typeof saved !== 'object') continue
        // 只收現在這組卡表還認得的 id。卡表改過之後，舊紀錄裡那些已經不存在的卡會
        // 在這裡被濾掉，而不是變成畫面上選不掉的幽靈。
        const known = new Set(set.cards.map(c => c.id))
        const picked = Array.isArray(saved.picked) ? saved.picked.filter(id => known.has(id)) : []
        const used = Array.isArray(saved.used) ? saved.used.filter(id => picked.includes(id)) : []
        state.bySet[set.id] = { picked, used }
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
