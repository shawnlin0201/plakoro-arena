// Shared formatting for the price log. The history rows and the floating panel both show these
// figures, so they live in one place — the alternative is two copies that drift apart, which is
// how the chart quietly lost its hollow-square markers.
//
// `t` is passed in rather than imported so these stay pure functions with no Vue dependency and
// can be checked without mounting anything.

export function money(n) {
  return Number.isFinite(n) ? `NT$${n.toLocaleString()}` : '—'
}

// "sold 3 · 2 left" and "sold 3 · sold out" mean very different things at the same price, so the
// stock situation is spelled out rather than left to the price alone. Sold-out is said in words
// rather than as "0 left", which reads as missing data instead of a fact. The listed/sold-out
// state isn't repeated beyond that — the row's type column already carries it.
export function stockLabel(log, t) {
  const parts = []
  if (log.soldCount !== null && log.soldCount !== undefined) {
    parts.push(t('priceLog.soldCount', { n: log.soldCount }))
  }
  if (log.isSoldOut) parts.push(t('priceLog.soldOut'))
  else if (log.stockCount !== null && log.stockCount !== undefined) {
    parts.push(t('priceLog.stockCount', { n: log.stockCount }))
  }
  return parts.join(' · ')
}
