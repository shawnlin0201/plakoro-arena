// 把一行公告切成「純文字」與「網址」兩種片段。
//
// 做成切片段而不是組一段 HTML 丟給 v-html：公告的內文是後台打進去的，而 v-html 會把
// 裡面的標籤當成標籤執行。後台現在只有自己人進得去，但「只有自己人」是一個會變的前提，
// 而這個函式的輸出會進到每一個玩家的畫面 —— 把一段使用者輸入變成可執行的 HTML，是那
// 種一旦寫下去就很難再收回來的決定。片段由 Vue 自己插進去，標籤永遠只是字。

// 網址先抓到底，標點留給下一步處理。中文文案裡網址後面往往緊跟著句號或全形括號，
// 而「不含空白」是這裡唯一能靠的邊界。
const URL_RE = /https?:\/\/[^\s]+/g

// 貼在網址尾巴、但不屬於網址的標點。
//
// 右括號要看情況：Google 地圖、維基百科那類網址本來就帶括號，整段砍掉會連到錯的地方。
// 所以只有在這一段裡左右括號數量對不上時才砍 —— 「(見 https://x.com/a_(b))」會留下
// a_(b)，而「請見 https://x.com/a)」的那個右括號會被當成文案的一部分。
const TRAILING = /[.,;:!?、。，；：！？…"'」』）)\]】]+$/

function trimTrailing(url) {
  let out = url
  for (;;) {
    const m = TRAILING.exec(out)
    if (!m) return out
    const cut = out.slice(0, m.index)
    const dropped = m[0]
    // 砍掉的那一截如果是在補一個真的有被打開的括號，就不該砍。
    if (/^[)）\]】]+$/.test(dropped)) {
      const opens = (cut.match(/[(（[【]/g) || []).length
      const closes = (cut.match(/[)）\]】]/g) || []).length
      if (opens > closes) return cut + dropped.slice(0, opens - closes)
    }
    if (cut === out) return out
    out = cut
  }
}

/**
 * @param {string} line
 * @returns {Array<{text: string, href: string|null}>} 依原順序排好的片段。href 是 null
 *   就是普通的字。整行沒有網址時回傳一個片段，所以呼叫端不必分兩種情況寫。
 */
export function linkifySegments(line) {
  const text = String(line == null ? '' : line)
  const out = []
  let last = 0
  URL_RE.lastIndex = 0
  for (;;) {
    const m = URL_RE.exec(text)
    if (!m) break
    const url = trimTrailing(m[0])
    // 整串都是標點（例如單獨一個 "https://"）就不算網址，當普通文字放過去。
    if (!/^https?:\/\/\S/.test(url)) continue
    if (m.index > last) out.push({ text: text.slice(last, m.index), href: null })
    out.push({ text: url, href: url })
    last = m.index + url.length
    URL_RE.lastIndex = last
  }
  if (last < text.length) out.push({ text: text.slice(last), href: null })
  return out.length ? out : [{ text, href: null }]
}
