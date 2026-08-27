// Statistics for the price log. Pure functions over an array of log entries — no Vue, no d3
// rendering — so the numbers behind the chart can be checked independently of how they're drawn.
import { max, mean, median, min, quantile } from 'd3-array'

// What a logged price represents. Keeping these apart matters: a seller's asking price, a
// buyer's wanted price and an actual completed trade are three different numbers, and averaging
// them together produces a figure that describes nothing. Only DEAL is a real market price;
// SELL and BUY are open offers that may never clear.
//
// PREORDER is a fourth case: stock that hasn't been released yet, priced by a shop rather than
// set by the second-hand market. It typically sits at or near the distributor's price and moves
// for entirely different reasons, so pooling it with resale prices would misrepresent both.
export const PRICE_SIDES = {
  deal: 'deal',
  sell: 'sell',
  buy: 'buy',
  preorder: 'preorder'
}

export const SOURCE_TYPES = ['store', 'shopee', 'ruten', 'facebook', 'inPerson', 'other']

// Figures are computed over exactly the entries handed in — the caller's filter decides what
// counts, and nothing is silently excluded here.
//
// An earlier version narrowed to completed trades internally, which meant the UI's "asking"
// filter did nothing when trades existed: the highest asking price of NT$1800 vanished behind
// a highest "trade" of NT$1600, even with asking prices switched on. One layer of filtering,
// under the reader's control, is both more honest and easier to reason about.
//
// `sides` reports which kinds actually made it in, so the UI can say what the numbers cover.
export function priceStats(logs) {
  const amounts = logs.map(l => l.amount).filter(n => Number.isFinite(n))
  const sides = [...new Set(logs.map(l => l.side))]

  if (amounts.length === 0) {
    return { count: 0, sides, low: null, mid: null, avg: null, high: null, q1: null, q3: null, latest: null }
  }

  const sorted = [...amounts].sort((a, b) => a - b)
  return {
    count: amounts.length,
    sides,
    low: min(sorted),
    high: max(sorted),
    // Both are reported because the gap between them is itself informative: they sit close
    // together on a healthy spread, and diverge exactly when a few extreme prices are pulling
    // the average around. The median is the one to trust as a headline — a single wishful
    // listing at several times the going rate moves the mean and barely touches the median.
    mid: median(sorted),
    avg: Math.round(mean(sorted)),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    latest: latestOf(logs)
  }
}

// Trades and asking prices answer different questions — "what did people pay" versus "what are
// people asking" — and mixing them yields a figure describing neither. Split so each can be
// read on its own; `all` stays available for the chart, which plots everything together.
export function statsBySide(logs) {
  const bySide = { all: priceStats(logs) }
  Object.values(PRICE_SIDES).forEach(side => {
    bySide[side] = priceStats(logs.filter(l => l.side === side))
  })
  return bySide
}

function latestOf(logs) {
  let newest = null
  logs.forEach(log => {
    const t = new Date(log.tradedAt).getTime()
    if (!Number.isFinite(t)) return
    if (!newest || t > new Date(newest.tradedAt).getTime()) newest = log
  })
  return newest
}

// How far a price sits from the distributor's suggested price, as a signed percentage. This is
// the number a buyer actually cares about — "is this shop over the odds?" — and it's why the
// baseline is drawn on the chart.
export function premiumAgainstAgent(amount, agentPrice) {
  if (!Number.isFinite(amount) || !Number.isFinite(agentPrice) || agentPrice <= 0) return null
  return (amount - agentPrice) / agentPrice * 100
}

// Sorted oldest-first, which is the order a time axis and a trend line both need.
export function sortByTradedAt(logs) {
  return [...logs].sort((a, b) => new Date(a.tradedAt) - new Date(b.tradedAt))
}

export function groupBySide(logs) {
  const grouped = {}
  Object.values(PRICE_SIDES).forEach(side => {
    grouped[side] = logs.filter(l => l.side === side)
  })
  return grouped
}
