// Loads the price log from the published Google Sheet and normalizes it into the shape the
// stats and chart expect. The sheet is hand-edited, so everything here is written to be
// forgiving about spacing, wording and formatting rather than to demand an exact schema.
import { fetchSheetRows, sheetBool, sheetDate, sheetNumber } from './googleSheet'
import { PRICE_PRODUCTS } from './priceProducts'
import { PRICE_SIDES } from '../game/priceStats'

export const PRICE_LOG_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWCzZUCVvVbAd4n0peiANcEIjicAa4kXEs-c-veuOU39y0c71ug2pTwGiA8GDQijjMg0WuE9jcLY_k/pub?gid=2012511755&single=true&output=csv'

// Column headers as they appear in the sheet. Listed here (rather than inline) so a renamed
// column is a one-line fix.
// Each field lists the header names it accepts, tried in order. The sheet is hand-maintained
// and its columns get renamed as the model is worked out (日期 -> 上架日期, 類型 -> 掛售中);
// accepting the old names alongside the new ones means a rename doesn't silently break the
// import — which is exactly what happened when 日期 became 上架日期 and every row quietly fell
// back to its entry date.
const COL = {
  product: ['商品'],
  // When the listing went up / the sighting happened — this is what the time axis plots.
  date: ['上架日期', '日期', '交易日期'],
  // Listing status: 掛售中 (still up) or 已售畢 (sold out). Replaced the old free-text 類型
  // column, which is still read if it reappears.
  status: ['掛售中', '狀態'],
  side: ['類型'],
  // Units still on the shelf, and units already gone. Two columns because a marketplace can
  // show both at once (Shopee lists "3 sold" next to "2 left"), and because together they
  // determine the status without anyone having to label it: nothing left means sold out, any
  // sold means the price was met at least once. Blank means unknown, which is why sheetNumber
  // returns null rather than 0 — "0 left" and "don't know" are opposite facts.
  stock: ['架上數量', '數量'],
  sold: ['已售出數量', '已售出'],
  amount: ['金額', '價格'],
  source: ['來源'],
  url: ['連結', '網址'],
  note: ['備註'],
  // When the row was entered, as opposed to when the listing went up. Fallback for a missing
  // date so a row is never dropped for lack of one.
  recordedAt: ['紀錄日期', '記錄日期'],
  // Optional: with a visibility column present, only ticked rows are shown. Absent entirely
  // (as now) every row is shown, so adding it later can only ever narrow what's visible.
  visible: ['顯示']
}

// First non-empty cell among the accepted header names.
function cell(row, names) {
  for (const name of names) {
    const value = row[name]
    if (value !== undefined && String(value).trim() !== '') return value
  }
  return ''
}

function hasColumn(row, names) {
  return names.some(name => name in row)
}

// "售出" and "賣出" both mean a seller's asking price; "成交" is a completed trade; "求購"/
// "收購" is a buyer looking.
const SIDE_WORDS = [
  [PRICE_SIDES.preorder, ['預購', '預訂', 'preorder', 'pre-order']],
  [PRICE_SIDES.deal, ['成交', '售出完成', '售完', '售罄', 'deal', 'sold']],
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
// A status column is no longer required — the quantities say everything it did — but older
// sheets have one, so its wording is still recognized. Everything here describes the moment it
// was observed and is never revisited: "待售" means it was still for sale that day, not now.
const SOLD_OUT_WORDS = ['已售出', '已售畢', '售畢', '售完', '售罄', 'sold out', 'soldout']
const LISTED_WORDS = ['待售', '掛售中', '販售中', '出售中', 'listed', 'available']

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
  const { ids: productIds, skips } = parseProductCell(cell(row, COL.product))
  if (productIds.length === 0) return { entries: [], skips }

  const total = sheetNumber(cell(row, COL.amount))
  // Fall back to the entry date when the trade date is blank, so a row is never lost over it.
  const dated = sheetDate(cell(row, COL.date)) || sheetDate(cell(row, COL.recordedAt))
  // Only the amount is mandatory — a missing date now means "ongoing" rather than "unusable".
  if (total === null || total <= 0) return { entries: [], skips }
  const isOngoing = !dated
  const tradedAt = dated || todayISO()
  // A date in the future can't describe something that already happened — it's stock that
  // hasn't been released yet, i.e. a preorder. This overrides whatever the type column says,
  // because "成交 on 2027/03" is a contradiction and the date is the more reliable signal.
  const isFuture = tradedAt > todayISO()

  // Only enforce the visibility column when the sheet actually has one.
  if (hasColumn(row, COL.visible) && !sheetBool(cell(row, COL.visible))) return { entries: [], skips }

  const statusText = String(cell(row, COL.status) || '').trim().toLowerCase()
  const stockCount = sheetNumber(cell(row, COL.stock))
  const soldCount = sheetNumber(cell(row, COL.sold))
  // Nothing left on the shelf is sold out. A count beats a label when they disagree, since the
  // label is the one that goes stale.
  const isSoldOut = stockCount === 0 ||
    SOLD_OUT_WORDS.some(w => statusText.includes(w.toLowerCase()))
  // Any units sold proves the price was met, even while stock remains.
  const hasSales = soldCount !== null && soldCount > 0
  // Anything not sold out is still on offer. This used to be read off the status column, which
  // the sheet no longer has — leaving it word-matched made it silently false for every row, so
  // the chart lost the hollow-square marks that tell an open listing from a completed sale.
  const isListed = !isSoldOut ||
    LISTED_WORDS.some(w => statusText.includes(w.toLowerCase()))
  // Priority: a future date can only be a preorder; an explicit type column (legacy) is the
  // contributor speaking directly; otherwise the status decides.
  const legacySide = String(cell(row, COL.side) || '').trim()
  const side = isFuture
    ? PRICE_SIDES.preorder
    : legacySide
      ? parseSide(legacySide)
      : (isSoldOut || hasSales) ? PRICE_SIDES.deal : PRICE_SIDES.sell

  const isBundle = productIds.length > 1
  // Rounded to whole dollars — the shares of an odd total won't add back up to it exactly, but
  // a price list reads better without cents and the rounding error is far below the noise in
  // second-hand prices anyway.
  const amount = isBundle ? Math.round(total / productIds.length) : total
  const source = String(cell(row, COL.source) || '').trim()
  const url = String(cell(row, COL.url) || '').trim()
  const note = String(cell(row, COL.note) || '').trim()

  const entries = productIds.map(productId => ({
    id: `r${index}-${productId}`,
    productId,
    side,
    stockCount,
    soldCount,
    isSoldOut,
    // Still available to buy, as stated by the sheet rather than inferred from a blank date.
    isListed: isListed && !isSoldOut,
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
