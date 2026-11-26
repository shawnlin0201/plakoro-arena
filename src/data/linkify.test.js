import { describe, expect, it } from 'vitest'
import { linkifySegments } from './linkify'

const hrefs = line => linkifySegments(line).filter(s => s.href).map(s => s.href)

describe('linkifySegments', () => {
  it('沒有網址時整行照原樣回傳一段', () => {
    expect(linkifySegments('今天開賣')).toEqual([{ text: '今天開賣', href: null }])
  })

  it('空字串也回得出一段，呼叫端不必分兩種情況', () => {
    expect(linkifySegments('')).toEqual([{ text: '', href: null }])
    expect(linkifySegments(null)).toEqual([{ text: '', href: null }])
  })

  it('抓得到行中間的網址，前後的字留在自己的片段裡', () => {
    expect(linkifySegments('請見 https://plakoro.tw 謝謝')).toEqual([
      { text: '請見 ', href: null },
      { text: 'https://plakoro.tw', href: 'https://plakoro.tw' },
      { text: ' 謝謝', href: null }
    ])
  })

  it('一行有兩個網址時兩個都抓', () => {
    expect(hrefs('A https://a.tw B https://b.tw')).toEqual(['https://a.tw', 'https://b.tw'])
  })

  it('中文句號不會被吃進網址', () => {
    expect(hrefs('詳情見 https://plakoro.tw/terms。')).toEqual(['https://plakoro.tw/terms'])
  })

  it('Line 邀請連結的長查詢字串不會被截斷', () => {
    const url = 'https://line.me/ti/g2/BRErGGvPXkPX_m8gp_jTlnIt1zI0NF1uea8NXw'
    expect(hrefs(`加入請點 ${url}`)).toEqual([url])
  })

  it('網址自己帶的括號留著，文案的右括號不留', () => {
    expect(hrefs('見 https://x.tw/a_(b)')).toEqual(['https://x.tw/a_(b)'])
    expect(hrefs('（請見 https://x.tw/a）')).toEqual(['https://x.tw/a'])
  })

  it('不把裸露的 https:// 當成網址', () => {
    expect(hrefs('協定是 https://')).toEqual([])
  })

  it('http 也算', () => {
    expect(hrefs('http://plakoro.tw')).toEqual(['http://plakoro.tw'])
  })
})
