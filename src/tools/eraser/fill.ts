// 消除筆的填補：把塗到的範圍當作「未知」，用周圍的顏色由外往內平滑地補起來（push-pull）。
// 做法：建立影像金字塔，每往上一層縮小一半，只平均已知的像素；
// 再從最小的那層往回放大，把未知的地方用上一層的顏色填上。大範圍的洞也會補得很平順。
// 在預覽圖上計算一次，匯出時放大使用（補出來的顏色本來就很平滑，放大不會失真）。

import type { Texture2DSource } from '../../gl/pass.ts'
import { boxBlur, flipRowsRGBA } from '../../image/raster.ts'
import { drawStrokes, type Stroke } from '../brush/strokes.ts'

interface Level {
  w: number
  h: number
  /** 預乘過權重的顏色（rgb） */
  c: Float32Array
  /** 權重 0..1（1 = 已知） */
  a: Float32Array
}

/**
 * push-pull 填補。
 * @param rgb   每個像素的 rgb（0..255），長度 w×h×3
 * @param known 每個像素是否已知（1 已知、0 要補）
 * @returns 補好的 rgb（已知的像素不變）
 */
export function pushPull(rgb: Float32Array, known: Float32Array, w: number, h: number): Float32Array {
  const c0 = new Float32Array(rgb.length)
  for (let i = 0; i < known.length; i++) for (let k = 0; k < 3; k++) c0[i * 3 + k] = rgb[i * 3 + k] * known[i]
  const levels: Level[] = [{ w, h, c: c0, a: Float32Array.from(known) }]

  // 往上：每 2×2 合成 1 格
  while (levels[levels.length - 1].w > 1 || levels[levels.length - 1].h > 1) {
    const f = levels[levels.length - 1]
    const nw = Math.ceil(f.w / 2)
    const nh = Math.ceil(f.h / 2)
    const c = new Float32Array(nw * nh * 3)
    const a = new Float32Array(nw * nh)
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x
        const j = (y >> 1) * nw + (x >> 1)
        a[j] += f.a[i]
        for (let k = 0; k < 3; k++) c[j * 3 + k] += f.c[i * 3 + k]
      }
    // 權重最多到 1，顏色跟著等比例縮放（保持「顏色 = c / a」不變）
    for (let j = 0; j < a.length; j++) {
      if (a[j] > 1) {
        const s = 1 / a[j]
        for (let k = 0; k < 3; k++) c[j * 3 + k] *= s
        a[j] = 1
      }
    }
    levels.push({ w: nw, h: nh, c, a })
  }

  // 往下：未知的部分用上一層（已經補好）的顏色，雙線性內插放大
  for (let L = levels.length - 2; L >= 0; L--) {
    const f = levels[L]
    const p = levels[L + 1]
    const color = (x: number, y: number, k: number) => {
      const j = y * p.w + x
      return p.a[j] > 0 ? p.c[j * 3 + k] / p.a[j] : 0
    }
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x
        const miss = 1 - f.a[i]
        if (miss <= 0) continue
        const fx = Math.min(Math.max((x + 0.5) / 2 - 0.5, 0), p.w - 1)
        const fy = Math.min(Math.max((y + 0.5) / 2 - 0.5, 0), p.h - 1)
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const x1 = Math.min(x0 + 1, p.w - 1)
        const y1 = Math.min(y0 + 1, p.h - 1)
        const tx = fx - x0
        const ty = fy - y0
        for (let k = 0; k < 3; k++) {
          const top = color(x0, y0, k) * (1 - tx) + color(x1, y0, k) * tx
          const bottom = color(x0, y1, k) * (1 - tx) + color(x1, y1, k) * tx
          f.c[i * 3 + k] += miss * (top * (1 - ty) + bottom * ty)
        }
        f.a[i] = 1
      }
  }
  return levels[0].c
}

export interface Fill {
  /** 補好的區塊（RGBA，透明度 = 要蓋上去的程度，第一列是最下面） */
  texture: Texture2DSource
  /** 區塊在照片上的位置（GL 的 uv：x, y, 寬, 高，原點左下） */
  box: [number, number, number, number]
  /** 周圍原本的噪點強度（亮度的標準差，0..1，以預覽圖的像素計） */
  noise: number
}

/**
 * 估計已知像素的噪點強度：每個像素和上下左右平均的差（只看亮度），取標準差。
 * 補出來的顏色很乾淨，要加上差不多的顆粒，夜景、室內照才不會看出一塊「太乾淨」的地方。
 */
export function estimateNoise(rgb: Float32Array, known: Float32Array, w: number, h: number): number {
  const luma = (i: number) => (rgb[i * 3] * 0.299 + rgb[i * 3 + 1] * 0.587 + rgb[i * 3 + 2] * 0.114) / 255
  let sum = 0
  let sq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!known[i] || !known[i - 1] || !known[i + 1] || !known[i - w] || !known[i + w]) continue
      const d = luma(i) - (luma(i - 1) + luma(i + 1) + luma(i - w) + luma(i + w)) / 4
      sum += d
      sq += d * d
      n++
    }
  if (n < 16) return 0
  const mean = sum / n
  return Math.sqrt(Math.max(0, sq / n - mean * mean))
}

const cache = new WeakMap<HTMLCanvasElement, { strokes: readonly Stroke[]; fill: Fill | null }>()
let nextId = 0

/** 已經算好的填補（還沒算或沒有要補的地方就是 undefined / null） */
export function getFill(preview: HTMLCanvasElement, strokes: readonly Stroke[]): Fill | null | undefined {
  const hit = cache.get(preview)
  return hit && hit.strokes === strokes ? hit.fill : undefined
}

/** 依筆跡算出填補（同一份筆跡只算一次） */
export function computeFill(preview: HTMLCanvasElement, strokes: readonly Stroke[]): Fill | null {
  const hit = getFill(preview, strokes)
  if (hit !== undefined) return hit
  const fill = build(preview, strokes)
  cache.set(preview, { strokes, fill })
  return fill
}

function build(preview: HTMLCanvasElement, strokes: readonly Stroke[]): Fill | null {
  const W = preview.width
  const H = preview.height

  // 1. 筆跡畫成遮罩（上到下的順序，和 getImageData 一致）
  const mc = document.createElement('canvas')
  mc.width = W
  mc.height = H
  const mctx = mc.getContext('2d', { willReadFrequently: true })!
  drawStrokes(mctx, strokes)
  const alpha = mctx.getImageData(0, 0, W, H).data
  mc.width = mc.height = 0

  // 2. 找出塗到的範圍，往外多留一圈當作補的參考
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (alpha[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return null
  const margin = Math.max(16, Math.round(Math.max(x1 - x0, y1 - y0) * 0.4))
  const bx = Math.max(0, x0 - margin)
  const by = Math.max(0, y0 - margin)
  const bw = Math.min(W, x1 + margin + 1) - bx
  const bh = Math.min(H, y1 + margin + 1) - by

  // 3. 取出這一塊的像素，塗到的地方當作未知
  const px = preview.getContext('2d', { willReadFrequently: true })!.getImageData(bx, by, bw, bh).data
  const n = bw * bh
  const rgb = new Float32Array(n * 3)
  const known = new Float32Array(n)
  const mask = new Uint8Array(n)
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x
      const m = alpha[((by + y) * W + bx + x) * 4 + 3]
      mask[i] = m
      known[i] = m > 8 ? 0 : 1
      for (let k = 0; k < 3; k++) rgb[i * 3 + k] = px[i * 4 + k]
    }
  const noise = estimateNoise(rgb, known, bw, bh)
  const filled = pushPull(rgb, known, bw, bh)

  // 4. 邊緣羽化，蓋上去才不會看到一圈界線
  const draws = strokes.filter((s) => !s.erase)
  const avgR = (draws.reduce((sum, s) => sum + s.r, 0) / Math.max(1, draws.length)) * Math.max(W, H)
  for (let i = 0; i < 2; i++) boxBlur(mask, bw, bh, Math.max(1, avgR * 0.15))

  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = filled[i * 3]
    out[i * 4 + 1] = filled[i * 3 + 1]
    out[i * 4 + 2] = filled[i * 3 + 2]
    out[i * 4 + 3] = mask[i]
  }
  return {
    texture: { kind: '2d', key: `eraser#${nextId++}`, slot: 'eraser', width: bw, height: bh, channels: 4, data: flipRowsRGBA(out, bw, bh) },
    box: [bx / W, 1 - (by + bh) / H, bw / W, bh / H],
    noise,
  }
}
