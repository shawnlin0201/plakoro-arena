// Product master for the price log. Kept as a static file for now — these are physical retail
// products, so the list only changes when BANDAI announces a new wave, not at runtime. Once the
// Supabase table is live this can be swapped for a fetch without touching the components.
//
// `agentPrice` is the Taiwan distributor's suggested retail price (NT$), which is the same
// island-wide and serves as the baseline every logged price is compared against. Individual
// shops price above or below it — that spread is the whole point of the feature.
//
// `jpyPriceTax` is BANDAI's Japanese tax-inclusive price, kept for reference only: it doesn't
// track the Taiwan price at all (starter sets are ¥990 across the board, while the local price
// jumps from NT$150 to NT$250 at wave 07).

export const PRODUCT_CATEGORIES = {
  starter: 'starter',
  expedition: 'expedition'
}

// Which packaging a price refers to. A starter set is sold one-per-box so it has a single unit;
// the expedition boxes come as an inner box of 12 small boxes, and that inner box is how they're
// actually traded (it's the only way to reliably complete a wave's 6 Pokémon).
export const PRODUCT_UNITS = {
  single: 'single',
  innerBox: 'innerBox',
  smallBox: 'smallBox'
}

export const PRICE_PRODUCTS = [
  {
    id: 'st01',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '01',
    // Japanese roster name — resolved to the player's language through useCharacterData, and
    // also the filename of the figure photo under public/image/CHARA.
    pokemon: ['フシギダネ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7173/'
  },
  {
    id: 'st02',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '02',
    pokemon: ['ヒトカゲ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7174/'
  },
  {
    id: 'st03',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '03',
    pokemon: ['ゼニガメ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7175/'
  },
  {
    id: 'st04',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '04',
    pokemon: ['ピカチュウ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7176/'
  },
  {
    id: 'st05',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '05',
    pokemon: ['イーブイ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7177/'
  },
  {
    id: 'st06',
    category: PRODUCT_CATEGORIES.starter,
    unit: PRODUCT_UNITS.single,
    seriesNo: '06',
    pokemon: ['ミュウ'],
    agentPrice: 150,
    jpyPriceTax: 990,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7178/'
  },
  {
    id: 'eb01',
    category: PRODUCT_CATEGORIES.expedition,
    unit: PRODUCT_UNITS.innerBox,
    seriesNo: '01',
    // A wave's 6 Pokémon, each in 2 poses and 3 finishes (36 variants in total). An inner box
    // holds 12 small boxes, which is what makes completing the 6 realistic.
    pokemon: ['カイロス', 'ファイヤー', 'フリーザー', 'サンダー', 'イワーク', 'ベトベター'],
    smallBoxesPerInnerBox: 12,
    agentPrice: 1300,
    // Sold per small box in Japan (¥385 tax-inclusive); BANDAI never lists an inner-box price,
    // so this is the 12-box equivalent rather than a quoted figure.
    jpyPriceTax: 385 * 12,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7172/'
  },
  {
    id: 'eb01s',
    category: PRODUCT_CATEGORIES.expedition,
    unit: PRODUCT_UNITS.smallBox,
    seriesNo: '01',
    pokemon: ['カイロス', 'ファイヤー', 'フリーザー', 'サンダー', 'イワーク', 'ベトベター'],
    // The distributor prices the inner box, not the small box, so there's no official local
    // figure to compare against — this is the inner box's per-box cost, which is the number a
    // buyer is actually weighing a loose box against. Flagged so the UI can say it's derived.
    agentPrice: Math.round(1300 / 12),
    agentPriceDerived: true,
    jpyPriceTax: 385,
    releaseDate: '2026-07-18',
    officialUrl: 'https://global.bandai-hobby.net/tw/item/01_7172/'
  }
]

export function findPriceProduct(id) {
  return PRICE_PRODUCTS.find(p => p.id === id) || null
}
