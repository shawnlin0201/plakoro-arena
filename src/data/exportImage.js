// One way to turn a piece of the screen into a PNG someone can share.
//
// Every "匯出圖片" button in the app goes through here, which is the point: the three of them
// used to each call html2canvas with their own options, and the differences between those
// options were accidents rather than decisions. The two things every export needs — the custom
// fonts surviving the capture, and the footer saying where the picture came from — are
// therefore written once.
import html2canvas from 'html2canvas'
import { asset } from './assetPath'

// Fetched once per page load and cached. An export is a deliberate, occasional action, so
// paying for the read on the first one is fine; paying for it on every one is not.
const dataUrlCache = new Map()
function dataUrl(path) {
  const key = asset(path)
  if (!dataUrlCache.has(key)) {
    dataUrlCache.set(key, fetch(key)
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status} ${key}`))))
      .then(b => new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = rej
        fr.readAsDataURL(b)
      }))
      // A missing file must not take the whole export down with it — the picture is still
      // worth having without the QR code.
      .catch(() => null))
  }
  return dataUrlCache.get(key)
}

// NOTE there is deliberately no font installation here any more.
//
// An earlier attempt inlined 851Gkktt as a data URI and registered it on the live document
// (document.fonts.add + a second @font-face in <head>) so the capture could use it. It did
// two bad things and one useless one: the page then carried two declarations of the same
// family with different font-display values, which is enough to change how text renders on
// screen; it fetched 1.4MB and base64'd it; and it never worked, because html2canvas does not
// honour this element's font at all — enlarging the real node made the live page visibly
// change while the captured image stayed exactly the same.

// How much bigger a damage number gets in the picture.
//
// It needs the help because html2canvas cannot use 851Gkktt. That face fills its em box almost
// completely, so swapping it for the fallback at the same size drops the digits to roughly
// half the height they had — which is why 1rem of 851Gkktt out-reads the 0.8125rem the success
// rate beside it uses, and why matching font-size alone is not enough.
const DMG_SCALE = 1.0

// Done with a transform, not font-size.
//
// font-size does not survive the capture in any form. Set in onclone, the layout moved but
// the glyphs did not, so the number drifted left without growing. Set on the live element
// before capturing — the page visibly flashed at the new size and the picture still came out
// identical. html2canvas is not reading this node's font metrics at all. `transform` goes
// through its matrix handling instead, which is a different path entirely.
//
// Applied in the clone, so the live page never flickers. Origin at the right edge because the
// number is right-aligned on the card: growing from there keeps it inside the card instead of
// pushing it across the artwork.
function enlargeDamage(root) {
  root.querySelectorAll('.mc-dmg').forEach(n => {
    n.style.setProperty('display', 'inline-block', 'important')
    n.style.setProperty('transform-origin', '100% 50%', 'important')
    n.style.setProperty('transform', `scale(${DMG_SCALE})`, 'important')
  })
}

const CREDIT_LINES = ['此資料來自 PLAKORO ARENA 工具，', '最新資訊請參考 PLAKORO TAIWAN 社群。']
const QR_PATH = 'image/line-invite-qrcode.png'

// 2, not 3.
//
// The odds sheet is the biggest thing exported here, and at 3 its canvas came out
// 3348x4638 — 15.5 million pixels, about 62MB once RGBA. That is close enough to the canvas
// area ceiling iOS Safari enforces that the export can come back blank on a phone, which is
// the device most likely to be sharing it. At 2 the same sheet is 2232x3092 (6.9M px, ~28MB)
// and the file drops from 7.5MB to 4.1MB — still 2232px wide, so it survives being zoomed
// into on any screen. Nothing legible was bought by the third multiple.
const DEFAULT_SCALE = 2

// The stage the picture is always drawn at, whatever stage the exporter happens to be on.
//
// Everything in the app is sized in `rem`, and the root font-size tracks the stage's short
// edge (useStageLayout). That is right for a screen and wrong for a file: capture the same
// sheet on a phone and on a desktop and you got two different pictures, because the element
// being photographed was literally a different number of CSS pixels tall.
//
// So the capture is scaled by however far the live root sits from this reference. The element
// is N rem across either way, and N rem at the reference root is a fixed pixel count — so the
// PNG comes out the same size on every device, and the only thing the window still decides is
// how much of the scaling html2canvas does versus how much the layout already did.
const EXPORT_STAGE_HEIGHT = 720
const EXPORT_ROOT_PX = 16 * EXPORT_STAGE_HEIGHT / 375

function normalisedScale(density) {
  const live = parseFloat(getComputedStyle(document.documentElement).fontSize)
  // A root font-size this should never be means the stage has not laid out yet; capturing at
  // the plain density is wrong-sized but still a picture, which beats dividing by zero.
  if (!(live > 0)) return density
  return density * EXPORT_ROOT_PX / live
}

// Appended inside the clone, so nothing about the live screen moves while the picture is
// taken. Sized in `rem` like the rest of the project: the root font-size is what the stage
// scales, so rem is what keeps the credit the same size *relative to the sheet it sits under*
// on every device. In px it would drift against the content instead of with it.
//
// `qrSrc` is already a data URI by the time it gets here. An <img> created during onclone has
// no chance to finish a network request before html2canvas paints, so a plain path renders as
// a blank gap.
function appendCredit(doc, target, qrSrc) {
  const bar = doc.createElement('div')
  bar.setAttribute('style', [
    'display:flex', 'align-items:center', 'gap:0.75rem', 'justify-content:center',
    'padding:0.625rem 0.75rem 0.25rem', 'margin-top:0.375rem',
    'border-top:0.0625rem solid rgba(0,0,0,.12)'
  ].join(';'))

  const text = doc.createElement('div')
  text.setAttribute('style', [
    'font-size:1rem', 'font-weight:700', 'line-height:1.45', 'color:#1F1F1D',
    'font-family:"Hiragino Sans","Noto Sans TC","Noto Sans JP",sans-serif',
    'text-align:right', 'white-space:nowrap'
  ].join(';'))
  CREDIT_LINES.forEach(line => {
    const row = doc.createElement('div')
    row.textContent = line
    text.appendChild(row)
  })

  bar.appendChild(text)
  if (qrSrc) {
    const qr = doc.createElement('img')
    qr.src = qrSrc
    qr.setAttribute('style', 'width:3.5rem;height:3.5rem;display:block;flex:none;')
    bar.appendChild(qr)
  }
  target.appendChild(bar)
}

/**
 * Capture `el` and hand the viewer a PNG.
 *
 * @param {HTMLElement} el          what to photograph
 * @param {string} filename         without the extension; illegal characters are stripped
 * @param {object} [opts]
 * @param {string} [opts.background]  the ground the capture composites onto
 * @param {number} [opts.scale]       pixel density; see DEFAULT_SCALE
 * @param {string} [opts.hide]        selector for edit-only chrome to drop from the clone
 * @param {(doc: Document, root: HTMLElement) => void} [opts.onclone]  further clone surgery
 */
export async function exportElementAsPng(el, filename, opts = {}) {
  if (!el) return false
  const { background = '#ffffff', scale = DEFAULT_SCALE, hide, onclone } = opts

  // Resolved before the capture starts, so the clone has no network round trip to lose.
  const qrSrc = await dataUrl(QR_PATH)
  const canvas = await html2canvas(el, {
    backgroundColor: background,
    scale: normalisedScale(scale),
    useCORS: true,
    // NOT foreignObjectRendering. It draws the text correctly — the browser's own engine, so
    // 851Gkktt and the multi-value text-shadow outlines both survive — but everything inside
    // an SVG <foreignObject> has to be a data URI, so every card's artwork and every energy
    // icon comes out blank. Losing the outline is a smaller loss than losing the pictures.
    // Fixing it properly means inlining every <img> AND every CSS background-image first.
    onclone(doc, root) {
      enlargeDamage(root)
      if (hide) doc.querySelectorAll(hide).forEach(n => n.remove())
      if (onclone) onclone(doc, root)
      appendCredit(doc, root, qrSrc)
    }
  })

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(filename).replace(/[\\/:*?"<>|]/g, '-') || 'plakoro'}.png`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
