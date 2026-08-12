export const TYPE_KANJI = {
  "くさ": "草",
  "ほのお": "炎",
  "みず": "水",
  "かみなり": "電",
  "エスパー": "超",
  "かくとう": "闘",
  "あく": "悪",
  "はがね": "鋼",
  "ひこう": "飛",
  "ドラゴン": "龍",
  "ノーマル": "無"
}

export function typeVar(t) {
  return `var(--t-${t})`
}

export const TYPE_BG_COLORS = {
  "無色": "#E4DFD2",
  "ちょう": "#DCC4EC",
  "かくとう": "#FFC79A",
  "ほのお": "#FFACAC",
  "みず": "#A8D4EA",
  "くさ": "#B8E6C0",
  "はがね": "#D3D6DA",
  "あく": "#A3D9CE",
  "ひこう": "#C6E6FA",
  "かみなり": "#FFE58A"
}

export const TYPE_BG_FALLBACK = "#ECEAE3"

export const CARD_BOTTOM_DARK = "#262420"

export function typeBgColor(t) {
  return TYPE_BG_COLORS[t] || TYPE_BG_FALLBACK
}
