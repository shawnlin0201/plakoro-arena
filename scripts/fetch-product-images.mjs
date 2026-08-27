// Downloads the official product photos from BANDAI HOBBY SITE into public/image/PRODUCT/.
//
// They're saved locally rather than hot-linked: the CDN could rename or expire a path at any
// time, hot-linking someone else's bandwidth is impolite, and a local copy is one fewer origin
// for the page to depend on. Attribution for these images is in the app's credit line.
//
// Run: npm run fetch-product-images
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'image', 'PRODUCT')

// The site returns 403 to a default fetch user-agent.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Local product id -> BANDAI item code. The expedition inner box and small box share one
// official listing, so they share a photo too.
const ITEMS = [
  { id: 'st01', item: '01_7173' },
  { id: 'st02', item: '01_7174' },
  { id: 'st03', item: '01_7175' },
  { id: 'st04', item: '01_7176' },
  { id: 'st05', item: '01_7177' },
  { id: 'st06', item: '01_7178' },
  { id: 'eb01', item: '01_7172' },
  { id: 'eb01s', item: '01_7172' }
]

async function getPage(itemCode) {
  const res = await fetch(`https://global.bandai-hobby.net/tw/item/${itemCode}/`, {
    headers: { 'User-Agent': UA }
  })
  if (!res.ok) throw new Error(`item page ${itemCode}: HTTP ${res.status}`)
  return res.text()
}

// The first slide of the main carousel is the packaging shot, which is what a price listing
// should show. Scoped to that block so the page's related-products thumbnails don't win.
//
// The CDN serves signed URLs — the Expires/Key-Pair-Id/Signature query string is mandatory, and
// requesting the bare path returns 403 MissingKey. So the whole src attribute has to be carried
// through intact, query string and all. The signature is short-lived, which is another reason
// to download the file rather than link to it.
function firstCarouselImage(html, itemCode) {
  const start = html.indexOf('pg-products__sliderMain')
  if (start === -1) throw new Error(`${itemCode}: main carousel not found`)
  const end = html.indexOf('pg-products__sliderThumb', start)
  const block = html.slice(start, end === -1 ? start + 8000 : end)
  const match = block.match(/src="(https:\/\/d2854ts9oov59b\.cloudfront\.net\/[^"]+)"/)
  if (!match) throw new Error(`${itemCode}: no image in carousel`)
  return match[1].replace(/&amp;/g, '&')
}

// The originals are ~450 kB each at full press-kit resolution, which is wildly more than a
// 640px card needs and the app already loads far too much. Downscaled with macOS's built-in
// sips (no extra dependency) — skipped with a warning elsewhere, since a large image is still
// better than no image.
const MAX_EDGE = 640
const JPEG_QUALITY = 72

async function shrink(path) {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    await promisify(execFile)('sips', [
      '-Z', String(MAX_EDGE),
      '--setProperty', 'formatOptions', String(JPEG_QUALITY),
      path, '--out', path
    ])
    return true
  } catch {
    return false
  }
}

async function download(url, destPath) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`image: HTTP ${res.status}`)
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()))
  const { stat } = await import('fs/promises')
  const before = (await stat(destPath)).size
  const shrunk = await shrink(destPath)
  const after = (await stat(destPath)).size
  return { before, after, shrunk }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // One page fetch per distinct item code, not per product.
  const pages = new Map()
  for (const { item } of ITEMS) {
    if (pages.has(item)) continue
    console.log(`Fetching item page ${item}...`)
    pages.set(item, await getPage(item))
    await new Promise(r => setTimeout(r, 400)) // be gentle with their server
  }

  for (const { id, item } of ITEMS) {
    const url = firstCarouselImage(pages.get(item), item)
    const dest = join(OUT_DIR, `${id}.jpg`)
    const { before, after, shrunk } = await download(url, dest)
    const note = shrunk
      ? `${(before / 1024).toFixed(0)} -> ${(after / 1024).toFixed(0)} KB`
      : `${(after / 1024).toFixed(0)} KB (sips unavailable, not resized)`
    console.log(`  ${id}.jpg  ${note}`)
  }

  console.log(`\nWrote ${ITEMS.length} images to ${OUT_DIR}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
