// 筆刷的筆跡：每一筆存成「原圖座標」的點列，存在編輯參數裡（非破壞性，可以復原）。
// 要用的時候才畫成遮罩或彩色貼圖，解析度依預覽／匯出決定，所以匯出原圖時一樣清楚。

import type { Texture2DSource } from '../../gl/pass.ts'
import { boxBlur, canvasToMask, flipRowsRGBA } from '../../image/raster.ts'

export interface Stroke {
  /** x0, y0, x1, y1…（原圖 0..1，原點左上） */
  pts: number[]
  /** 半徑：原圖長邊的比例 */
  r: number
  /** 橡皮擦：擦掉之前畫的 */
  erase?: boolean
  /** 塗鴉筆的顏色（#rrggbb） */
  color?: string
  /** 同一個工具裡的不同效果（例如馬賽克的「方塊」和「模糊」），各自畫成一張遮罩 */
  kind?: string
  /** 力度 0..1（例如手動推臉推多少）；沒有就是 1 */
  strength?: number
}

/** 座標只留四位小數：精度足夠（萬分之一），存進歷史紀錄的資料小很多 */
export const round4 = (v: number) => Math.round(v * 10000) / 10000

/** 依長邊算出和照片同比例的尺寸 */
export function fitLong(width: number, height: number, long: number): { width: number; height: number } {
  const s = Math.min(1, long / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) }
}

/** 把筆跡畫到 2D 畫布上（畫布的座標就是原圖座標乘上畫布大小） */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], fallbackColor = '#fff'): void {
  const { width: w, height: h } = ctx.canvas
  const long = Math.max(w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes) {
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    const color = s.erase ? '#000' : (s.color ?? fallbackColor)
    const r = s.r * long
    if (s.pts.length <= 2) {
      // 只點一下：畫一個圓點
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(s.pts[0] * w, s.pts[1] * h, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.strokeStyle = color
    ctx.lineWidth = r * 2
    ctx.beginPath()
    ctx.moveTo(s.pts[0] * w, s.pts[1] * h)
    for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i] * w, s.pts[i + 1] * h)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

function withCanvas<T>(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => T): T {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    return draw(canvas.getContext('2d', { willReadFrequently: true })!)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * 筆跡 → 單通道遮罩（R8，第一列是最下面）。
 * feather：邊緣羽化的程度，是筆刷半徑的倍數（0 = 硬邊）
 */
export function rasterizeMask(strokes: readonly Stroke[], width: number, height: number, feather = 0): Uint8Array {
  return withCanvas(width, height, (ctx) => {
    drawStrokes(ctx, strokes)
    // 用透明度當遮罩：橡皮擦是把透明度擦掉
    const mask = canvasToMask(ctx.getImageData(0, 0, width, height).data, width, height, 3)
    const draws = strokes.filter((s) => !s.erase)
    if (feather > 0 && draws.length > 0) {
      const avgR = (draws.reduce((sum, s) => sum + s.r, 0) / draws.length) * Math.max(width, height)
      const r = (avgR * feather) / 3
      for (let i = 0; i < 3; i++) boxBlur(mask, width, height, r)
    }
    return mask
  })
}

/** 筆跡 → 彩色貼圖（RGBA，第一列是最下面），塗鴉筆用 */
export function rasterizeColor(strokes: readonly Stroke[], width: number, height: number): Uint8ClampedArray {
  return withCanvas(width, height, (ctx) => {
    drawStrokes(ctx, strokes)
    return flipRowsRGBA(ctx.getImageData(0, 0, width, height).data, width, height)
  })
}

// ---- 快取：同一份筆跡、同樣解析度只畫一次 ----

const ids = new WeakMap<readonly Stroke[], number>()
let nextId = 0
const cache = new Map<string, Texture2DSource>()

/** 每一份筆跡陣列一個編號（陣列不會被修改，換內容一定是新陣列） */
function idOf(strokes: readonly Stroke[]): number {
  let id = ids.get(strokes)
  if (id === undefined) {
    id = nextId++
    ids.set(strokes, id)
  }
  return id
}

/**
 * 取得筆跡的貼圖。slot 是用途（例如 'mosaic/pixel'），同一個 slot 只快取最新的一張，
 * renderer 也會用 slot 把舊貼圖從 GPU 刪掉。
 */
export function strokeTexture(
  slot: string,
  strokes: readonly Stroke[],
  size: { width: number; height: number },
  make: (width: number, height: number) => { channels: 1 | 4; data: Uint8Array | Uint8ClampedArray },
): Texture2DSource {
  const key = `${slot}#${idOf(strokes)}@${size.width}x${size.height}`
  const hit = cache.get(slot)
  if (hit?.key === key) return hit
  const { channels, data } = make(size.width, size.height)
  const tex: Texture2DSource = { kind: '2d', key, slot, ...size, channels, data }
  cache.set(slot, tex)
  return tex
}
