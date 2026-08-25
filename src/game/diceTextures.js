// Builds the 6 face textures for a 3D die as <canvas> elements — reusing the same visual
// language as the 2D dice builder (single-type faces show one centered icon; dual-type
// faces show two icons in diagonally-split corners with a divider line).
import { asset } from '../data/assetPath'

const TEX_SIZE = 256
const imageCache = new Map()
const iconColorCache = new Map()

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
  imageCache.set(src, promise)
  return promise
}

function makeCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  return canvas
}

function fillBackground(ctx, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
}

// Each ICON/{type}.png is already a solid-colored rounded-square badge (e.g. Grass is a fully
// saturated green square with a white leaf) — the "type color" already lives in the art itself.
// A flat design-system swatch (e.g. constants.js's pastel typeBgColor) is a different, lighter
// shade of the same hue, so filling the face with it under the icon produced a two-tone face that
// didn't read as one consistent color. Sampling the icon's own pixel color guarantees an exact
// match instead.
function sampleIconColor(img) {
  if (iconColorCache.has(img.src)) return iconColorCache.get(img.src)
  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = img.naturalWidth
  sampleCanvas.height = img.naturalHeight
  const sctx = sampleCanvas.getContext('2d')
  sctx.drawImage(img, 0, 0)
  // Top-center edge sits inside the badge's solid-color square for every icon, clear of the
  // rounded corners (which only cut into the very corners) and of the white symbol in the middle.
  const [r, g, b] = sctx.getImageData(Math.floor(img.naturalWidth / 2), 2, 1, 1).data
  const color = `rgb(${r}, ${g}, ${b})`
  iconColorCache.set(img.src, color)
  return color
}

function drawBorder(ctx) {
  ctx.strokeStyle = '#DEDACD'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, TEX_SIZE - 8, TEX_SIZE - 8)
}

// `tintFromIcon` only makes sense for the energy-type badge icons (solid colored squares) — the
// character die's ICON/{上,下,...}.png are black line-art symbols with a black outline, so
// sampling their color would fill the face black and hide the symbol.
export async function buildSingleFaceTexture(type, { tintFromIcon = true } = {}) {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  const img = await loadImage(asset(`image/ICON/${type}.png`))
  fillBackground(ctx, tintFromIcon ? sampleIconColor(img) : '#FFFFFF')
  drawBorder(ctx)
  const pad = TEX_SIZE * 0.08
  ctx.drawImage(img, pad, pad, TEX_SIZE - pad * 2, TEX_SIZE - pad * 2)
  return canvas
}

export async function buildDualFaceTexture(types) {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  const [imgA, imgB] = await Promise.all(types.map(t => loadImage(asset(`image/ICON/${t}.png`))))
  const iconSize = TEX_SIZE * 0.42
  const inset = TEX_SIZE * 0.05

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(TEX_SIZE, 0)
  ctx.lineTo(0, TEX_SIZE)
  ctx.closePath()
  ctx.clip()
  fillBackground(ctx, sampleIconColor(imgA))
  ctx.drawImage(imgA, inset, inset, iconSize, iconSize)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(TEX_SIZE, 0)
  ctx.lineTo(TEX_SIZE, TEX_SIZE)
  ctx.lineTo(0, TEX_SIZE)
  ctx.closePath()
  ctx.clip()
  fillBackground(ctx, sampleIconColor(imgB))
  ctx.drawImage(imgB, TEX_SIZE - inset - iconSize, TEX_SIZE - inset - iconSize, iconSize, iconSize)
  ctx.restore()

  ctx.strokeStyle = '#9A9A93'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(TEX_SIZE, 0)
  ctx.lineTo(0, TEX_SIZE)
  ctx.stroke()

  drawBorder(ctx)

  return canvas
}

// Builds the 6 canvases for an assembled energy die, in the BoxGeometry material-index
// order ([+X, -X, +Y, -Y, +Z, -Z]) so callers can hand them straight to a Three.js material
// array. Order of face -> axis is arbitrary (there's no "correct" side for "convex"), it just
// has to match whatever face-detection logic reads the result back.
export async function buildEnergyDieFaces(die) {
  const [posX, negX, posY, negY, posZ, negZ] = await Promise.all([
    buildSingleFaceTexture(die.convexType),
    buildSingleFaceTexture(die.concaveType),
    buildSingleFaceTexture(die.singleSlots[0].type),
    buildSingleFaceTexture(die.singleSlots[1].type),
    buildDualFaceTexture(die.dualSlots[0].types),
    buildDualFaceTexture(die.dualSlots[1].types)
  ])
  return {
    canvases: [posX, negX, posY, negY, posZ, negZ],
    // Which logical face sits on which axis, so the roll result can be read back after the
    // physics settles.
    faceByAxis: ['convex', 'concave', 'single1', 'single2', 'dual1', 'dual2']
  }
}

export async function buildCharaDieFaces() {
  const order = ['右', '左', '上', '下', '立', '逆'] // +X, -X, +Y, -Y, +Z, -Z
  const canvases = await Promise.all(order.map(type => buildSingleFaceTexture(type, { tintFromIcon: false })))
  return { canvases, faceByAxis: order }
}
