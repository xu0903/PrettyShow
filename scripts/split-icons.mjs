// 從九宮格圖示（design/icon-sheet.png）切出選用的 App 圖示，輸出到 public/icons/，
// 並用預設的那一個產生 PWA 的固定圖示檔。執行：npm run icons
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SHEET = 'design/icon-sheet.png'
/** 要用的格子（1–9，由左到右、由上到下）→ 圖示 id。id 要和 src/core/appIcon.ts 一致 */
const PICKS = { 2: 'olive', 1: 'cream', 7: 'leaf' }
/** 預設圖示；PWA 的固定圖示檔也用這一張 */
const DEFAULT_ID = 'olive'

const { data, info } = await sharp(SHEET).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const at = (x, y) => (y * W + x) * 3
const bg = [data[at(8, 8)], data[at(8, 8) + 1], data[at(8, 8) + 2]]
const differs = (x, y) => {
  const i = at(x, y)
  return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 10
}

/** 找出一整排裡「不是背景」的連續區段，也就是每一格圖示的範圍 */
function runs(length, isFilled) {
  const out = []
  let start = -1
  for (let i = 0; i <= length; i++) {
    const filled = i < length && isFilled(i)
    if (filled && start < 0) start = i
    if (!filled && start >= 0) {
      if (i - start > 40) out.push([start, i - 1])
      start = -1
    }
  }
  return out
}
const count = (n, test) => Array.from({ length: n }, (_, i) => i).filter(test).length
const cols = runs(W, (x) => count(H, (y) => differs(x, y)) > H * 0.05)
const rows = runs(H, (y) => count(W, (x) => differs(x, y)) > W * 0.05)
if (cols.length !== 3 || rows.length !== 3) throw new Error(`找不到 3×3 的格子（cols ${cols.length}, rows ${rows.length}）`)

/**
 * 圖上的圖示已經是圓角方塊，但 iPhone 會自己再裁一次圓角，所以要輸出「填滿的正方形」：
 * 把四個角落圓角以外的區域，用圓角邊緣往內一點的顏色補起來。
 */
function fillCorners(buf, size) {
  const r = Math.round(size * 0.26)
  const get = (x, y) => (y * size + x) * 3
  const out = Buffer.from(buf)
  for (const [cx, cy, sx, sy] of [
    [r, r, -1, -1],
    [size - 1 - r, r, 1, -1],
    [r, size - 1 - r, -1, 1],
    [size - 1 - r, size - 1 - r, 1, 1],
  ]) {
    for (let dy = 0; dy <= r; dy++) {
      for (let dx = 0; dx <= r; dx++) {
        const d = Math.hypot(dx, dy)
        if (d <= r - 6) continue
        const x = cx + sx * dx
        const y = cy + sy * dy
        const k = (r - 8) / d
        const src = get(Math.round(cx + sx * dx * k), Math.round(cy + sy * dy * k))
        buf.copy(out, get(x, y), src, src + 3)
      }
    }
  }
  return out
}

mkdirSync('public/icons', { recursive: true })
let n = 0
for (const [top, bottom] of rows) {
  for (const [left, right] of cols) {
    n++
    const id = PICKS[n]
    if (!id) continue
    // 取正方形並往內縮幾個像素，避開邊緣的陰影與反鋸齒
    const size = Math.min(right - left, bottom - top) - 8
    const x = Math.round((left + right) / 2 - size / 2)
    const y = Math.round((top + bottom) / 2 - size / 2)
    const tile = await sharp(SHEET).removeAlpha().extract({ left: x, top: y, width: size, height: size }).raw().toBuffer()
    const square = sharp(fillCorners(tile, size), { raw: { width: size, height: size, channels: 3 } })
    // 設定頁的選單預覽 + 換圖示時用的 apple-touch-icon
    for (const s of [180, 192]) await square.clone().resize(s, s).png().toFile(`public/icons/icon-${id}-${s}.png`)

    if (id === DEFAULT_ID) {
      await square.clone().resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
      await square.clone().resize(192, 192).png().toFile('public/icons/icon-192.png')
      await square.clone().resize(512, 512).png().toFile('public/icons/icon-512.png')
      await square.clone().resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
      await square.clone().resize(32, 32).png().toFile('public/icons/favicon-32.png')
    }
    console.log(`第 ${n} 格 → ${id}${id === DEFAULT_ID ? '（預設）' : ''}`)
  }
}
