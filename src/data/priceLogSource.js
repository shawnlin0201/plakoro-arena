// Loads the price log from the published Google Sheet and normalizes it into the shape the
// stats and chart expect. The sheet is hand-edited, so everything here is written to be
// forgiving about spacing, wording and formatting rather than to demand an exact schema.
import { fetchSheetRows, sheetBool, sheetDate, sheetNumber } from './googleSheet'
import { PRICE_PRODUCTS } from './priceProducts'
import { PRICE_SIDES } from '../game/priceStats'

export const PRICE_LOG_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWCzZUCVvVbAd4n0peiANcEIjicAa4kXEs-c-veuOU39y0c71ug2pTwGiA8GDQijjMg0WuE9jcLY_k/pub?gid=2012511755&single=true&output=csv'

// Column headers as they appear in the sheet. Listed here (rather than inline) so a renamed
// column is a one-line fix.
const COL = {
  product: '商品',
  date: '日期',
  side: '類型',
  amount: '金額',
  source: '來源',
  url: '連結',
  note: '備註',
  // Optional: if the sheet gains a visibility column, only ticked rows are shown. Absent
  // entirely (as now) every row is shown, so adding the column later can't silently blank the
  // site — it only ever narrows what's already visible.
  visible: '顯示'
}

// "售出" and "賣出" both mean a seller's asking price; "成交" is a completed trade; "求購"/
// "收購" is a buyer looking.
const SIDE_WORDS = [
  [PRICE_SIDES.preorder, ['預購', '預訂', 'preorder', 'pre-order']],
  [PRICE_SIDES.deal, ['成交', '售出完成', 'deal', 'sold']],
  [PRICE_SIDES.sell, ['售出', '賣出', '出售', '販售', 'sell', 'ask']],
  [PRICE_SIDES.buy, ['求購', '收購', '徵求', '徵', 'buy', 'bid']]
]

// A blank or unrecognized type is read as an asking price, not a completed trade. A marketplace
// link only ever proves that someone listed at that price; that it sold is a separate claim
// needing separate evidence. Defaulting the other way put every unlabelled listing — including
// wishful ones at several times the going rate — into the trade figures, which is exactly where
// they distort the number people rely on.
function parseSide(raw) {
  const text = String(raw || '').trim().toLowerCase()
  for (const [side, words] of SIDE_WORDS) {
    if (words.some(w => text.includes(w.toLowerCase()))) return side
  }
  return PRICE_SIDES.sell
}

// The sheet writes products as human-readable labels like "預組 04 - 皮卡丘" or "探險 01 - 中盒",
// and a single cell can name several of them, comma-separated, when one transaction covered a
// bundle. Match on category keyword + number so spacing, the trailing Pokémon name and
// zero-padding don't matter.
const CATEGORY_WORDS = [
  ['st', ['預組', '啟程']],
  ['eb', ['探險']]
]

// An expedition wave is sold in three very different forms whose prices differ by an order of
// magnitude: an inner box (~NT$1300), a single small box (~NT$150), and a single figure pulled
// from one (~NT$200, more for rare finishes). Each needs its own product entry — pooling them
// would produce a median that describes none of them. Inner box and small box both have one;
// individual figures don't yet, so those are skipped and counted.
const INNER_BOX_WORDS = ['中盒']
const SMALL_BOX_WORDS = ['小盒', '不挑款', '單顆', '單盒']

// Why a label was skipped, so the UI can say "3 entries not shown" instead of silently dropping
// data the contributor took the trouble to log.
export const SKIP_REASONS = {
  unknownProduct: 'unknownProduct',
  expeditionSingleFigure: 'expeditionSingleFigure'
}

function parseProductRef(label) {
  const text = String(label || '').trim()
  if (!text) return { id: null, skip: null }

  const prefix = CATEGORY_WORDS.find(([, words]) => words.some(w => text.includes(w)))
  if (!prefix) return { id: null, skip: SKIP_REASONS.unknownProduct }

  const num = /(\d{1,2})/.exec(text)
  if (!num) return { id: null, skip: SKIP_REASONS.unknownProduct }

  const id = `${prefix[0]}${String(num[1]).padStart(2, '0')}`
  const product = PRICE_PRODUCTS.find(p => p.id === id)
  if (!product) return { id: null, skip: SKIP_REASONS.unknownProduct }

  if (prefix[0] === 'eb') {
    // Whatever follows the dash qualifies which form is meant: "中盒" is the inner box, "小盒"
    // and friends are a loose small box, and anything else ("大岩蛇透粉A") names one specific
    // figure. A bare "探險 01" with no qualifier is taken as the inner box, since that's the
    // unit these are normally traded in — being strict there would silently drop rows that
    // simply didn't spell it out.
    const qualifier = text.split(/[-–—]/).slice(1).join('-').trim()
    if (SMALL_BOX_WORDS.some(w => qualifier.includes(w))) {
      const smallId = `${id}s`
      return PRICE_PRODUCTS.some(p => p.id === smallId)
        ? { id: smallId, skip: null }
        : { id: null, skip: SKIP_REASONS.expeditionSingleFigure }
    }
    const isInnerBox = qualifier === '' || INNER_BOX_WORDS.some(w => qualifier.includes(w))
    if (!isInnerBox) {
      // Names a specific figure — needs a per-variant product before it can be shown.
      return { id: null, skip: SKIP_REASONS.expeditionSingleFigure }
    }
  }

  return { id, skip: null }
}

export function parseProductCell(cell) {
  const ids = []
  const skips = []
  String(cell || '').split(/[,、;／/]+/).forEach(part => {
    const { id, skip } = parseProductRef(part)
    if (id && !ids.includes(id)) ids.push(id)
    else if (skip) skips.push(skip)
  })
  return { ids, skips }
}

// A blank date means the listing is still up: there's no end date because it hasn't ended.
// Such a row reads as "as of today, this price is still being asked", so it's dated today and
// flagged — the flag is what stops it being mistaken for something that happened today. Once
// the listing closes, filling in the date turns it into a fixed historical point.
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// One sheet row becomes one entry per product it names. When a row covers several products the
// amount is the total for the lot, so it's split evenly across them and each product records
// its per-item share — that share is a normal price like any other and counts towards the
// headline figures. The original total is kept alongside it so the history can show where the
// number came from ("with 預組06, NT$400 for the pair").
//
// Even splitting is an approximation: a rarer item in the lot was probably worth more than an
// even share of it. It's kept because most bundles are of comparable items, and the alternative
// — discarding bundled rows — throws away real market data.
function rowToEntries(row, index) {
  const { ids: productIds, skips } = parseProductCell(row[COL.product])
  if (productIds.length === 0) return { entries: [], skips }

  const total = sheetNumber(row[COL.amount])
  const dated = sheetDate(row[COL.date])
  // Only the amount is mandatory — a missing date now means "ongoing" rather than "unusable".
  if (total === null || total <= 0) return { entries: [], skips }
  const isOngoing = !dated
  const tradedAt = dated || todayISO()
  // A date in the future can't describe something that already happened — it's stock that
  // hasn't been released yet, i.e. a preorder. This overrides whatever the type column says,
  // because "成交 on 2027/03" is a contradiction and the date is the more reliable signal.
  const isFuture = tradedAt > todayISO()

  // Only enforce the visibility column when the sheet actually has one.
  if (COL.visible in row && !sheetBool(row[COL.visible])) return { entries: [], skips }

  const isBundle = productIds.length > 1
  // Rounded to whole dollars — the shares of an odd total won't add back up to it exactly, but
  // a price list reads better without cents and the rounding error is far below the noise in
  // second-hand prices anyway.
  const amount = isBundle ? Math.round(total / productIds.length) : total
  const source = String(row[COL.source] || '').trim()
  const url = String(row[COL.url] || '').trim()
  const note = String(row[COL.note] || '').trim()

  const entries = productIds.map(productId => ({
    id: `r${index}-${productId}`,
    productId,
    side: isFuture ? PRICE_SIDES.preorder : parseSide(row[COL.side]),
    amount,
    tradedAt,
    source,
    sourceUrl: url || null,
    note: note || null,
    isOngoing,
    isBundle,
    bundleTotal: isBundle ? total : null,
    bundleSize: productIds.length,
    bundleWith: productIds.filter(id => id !== productId)
  }))
  return { entries, skips }
}

export function rowsToPriceLogs(rows) {
  const byProduct = {}
  const skipped = {}
  rows.forEach((row, i) => {
    const { entries, skips } = rowToEntries(row, i)
    entries.forEach(entry => {
      if (!byProduct[entry.productId]) byProduct[entry.productId] = []
      byProduct[entry.productId].push(entry)
    })
    skips.forEach(reason => { skipped[reason] = (skipped[reason] || 0) + 1 })
  })
  return { byProduct, skipped }
}

export async function fetchPriceLogs(csvUrl = PRICE_LOG_CSV_URL) {
  return rowsToPriceLogs(await fetchSheetRows(csvUrl))
}
