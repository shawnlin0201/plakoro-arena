// Reads a Google Sheet that's been published to the web as CSV
// (File -> Share -> Publish to web -> CSV), which needs no API key and no backend: the sheet
// itself is the admin panel, and edits show up on the next page load.

// A proper CSV reader rather than a line-splitting one. Published sheets do put newlines inside
// quoted cells whenever someone presses alt+enter in a note field, and splitting on "\n" first
// tears those rows in half — so the parser has to walk character by character and let the quote
// state decide what a row boundary means.
export function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote inside a quoted cell is an escaped literal quote.
        if (normalized[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  // Whatever is left when the text ends is the final cell, unless the file ended on a newline.
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// Turns the CSV into objects keyed by the header row, trimming both keys and values — sheets
// routinely carry stray spaces that would otherwise become part of a key.
export function rowsToObjects(rows) {
  if (rows.length === 0) return []
  const [header, ...body] = rows
  const keys = header.map(k => k.trim())
  return body.map(cells => {
    const obj = {}
    keys.forEach((key, i) => { obj[key] = (cells[i] || '').trim() })
    return obj
  })
}

export async function fetchSheetRows(csvUrl) {
  const res = await fetch(csvUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return rowsToObjects(parseCSV(await res.text()))
}

// Google Sheets checkbox columns come through as the strings "TRUE"/"FALSE"; people also type
// things like "v" or "是" by hand, so accept the common affirmatives.
const TRUTHY = new Set(['true', 'yes', 'y', '1', 'v', '✓', '是', 'o'])

export function sheetBool(value) {
  return TRUTHY.has(String(value || '').trim().toLowerCase())
}

// Sheets hand back dates in whatever format the column is set to. Accept ISO and the
// slash-separated forms, and reject anything unparseable so a typo doesn't become a 1970 date.
export function sheetDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const normalized = raw.replace(/\//g, '-')
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized)
  if (!m) return null
  const [, y, mo, d] = m
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

// Returns null for an empty cell rather than 0, because for some columns those mean opposite
// things — a stock count of 0 is "sold out" while a blank one is "unknown". `Number('')` is 0,
// so the empty case has to be caught before parsing.
export function sheetNumber(value) {
  const raw = String(value ?? '').trim()
  if (raw === '') return null
  // Strip currency symbols, thousands separators and stray spaces before parsing.
  const cleaned = raw.replace(/[^\d.-]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
