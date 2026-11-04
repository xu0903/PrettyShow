// 五官部位的遮罩：嘴唇、腮紅、眉毛、眼影、眼睛、眼下（黑眼圈）、牙齒。
// 用臉部特徵點畫出每個部位，再依臉的大小羽化。每張照片只算一次（快取在預覽圖上），
// 換顏色、調強度只改 shader 的參數，所以拖滑桿很順。
// 打包成兩張 RGBA 貼圖：A = 嘴唇、腮紅、眉毛、眼影；B = 眼睛、眼下、牙齒、唇中央（暈染唇用）

import type { Texture2DSource } from '../../gl/pass.ts'
import { boxBlur, flipRowsRGBA } from '../../image/raster.ts'
import { getFaceData } from '../beauty/faces.ts'
import { BROW_A, BROW_B, EYE_A, EYE_B, LIPS } from '../beauty/landmarks.ts'
import type { Point } from '../beauty/mask.ts'
import { fitLong } from '../brush/strokes.ts'

const INNER_LIPS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
const UPPER_LID_A = [33, 246, 161, 160, 159, 158, 157, 173, 133]
const LOWER_LID_A = [33, 7, 163, 144, 145, 153, 154, 155, 133]
const UPPER_LID_B = [263, 466, 388, 387, 386, 385, 384, 398, 362]
const LOWER_LID_B = [263, 249, 390, 373, 374, 380, 381, 382, 362]
/** 蘋果肌附近（腮紅的中心） */
const CHEEKS = [50, 280]
const EYE_TOP_BOTTOM: [number, number][] = [
  [159, 145],
  [386, 374],
]

/** 遮罩長邊（px）：部位都很柔和，1024 就夠，匯出時放大使用 */
const MASK_LONG = 1024

export interface Regions {
  /** R 嘴唇、G 腮紅、B 眉毛、A 眼影 */
  makeup: Texture2DSource
  /** R 眼睛、G 眼下、B 嘴巴裡面（牙齒）、A 唇中央（越靠近上下唇交界越亮） */
  features: Texture2DSource
}

const cache = new WeakMap<HTMLCanvasElement, Regions | null>()
let nextId = 0

/** 這張照片的部位遮罩；還沒找臉或沒有臉時是 null */
export function getRegions(preview: HTMLCanvasElement): Regions | null {
  const hit = cache.get(preview)
  if (hit !== undefined) return hit
  const face = getFaceData(preview)
  if (!face) return null // 還在找臉，先不要快取
  const regions = face.faces.length > 0 ? build(face.faces, preview.width, preview.height) : null
  cache.set(preview, regions)
  return regions
}

function build(faces: Point[][], W: number, H: number): Regions {
  const { width: w, height: h } = fitLong(W, H, MASK_LONG)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const P = (f: Point[], i: number) => ({ x: f[i].x * w, y: f[i].y * h })
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const faceW = (f: Point[]) => dist(P(f, 234), P(f, 454))
  const maxFace = Math.max(...faces.map(faceW))

  const poly = (pts: { x: number; y: number }[]) => {
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
  }
  const ring = (f: Point[], idx: readonly number[]) => poly(idx.map((i) => P(f, i)))

  /** 眼皮的線往上（或往下）推出一片區域：眼影、眼下 */
  const band = (f: Point[], lid: number[], k: number, n: number) => {
    const [t, b] = EYE_TOP_BOTTOM[n]
    const eyeH = Math.max(2, dist(P(f, t), P(f, b)))
    const line = lid.map((i) => P(f, i))
    poly([...line, ...line.map((p) => ({ x: p.x, y: p.y + eyeH * k })).reverse()])
  }

  /** 畫一個部位：draw 畫白色，cut 挖掉；回傳羽化後的單通道（上到下） */
  const mask = (draw: (f: Point[]) => void, feather: number, cut?: (f: Point[]) => void): Uint8Array => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    for (const f of faces) {
      draw(f)
      ctx.fill()
    }
    if (cut) {
      ctx.globalCompositeOperation = 'destination-out'
      for (const f of faces) {
        cut(f)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    const px = ctx.getImageData(0, 0, w, h).data
    const out = new Uint8Array(w * h)
    for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3]
    const r = (maxFace * feather) / 3
    for (let i = 0; i < 3; i++) boxBlur(out, w, h, r)
    return out
  }

  const both = (fn: (f: Point[], n: 0 | 1) => void) => (f: Point[]) => {
    fn(f, 0)
    ctx.fill()
    fn(f, 1)
  }
  const eyes = (f: Point[]) => {
    ring(f, EYE_A)
    ctx.fill()
    ring(f, EYE_B)
  }

  const lips = mask((f) => ring(f, LIPS), 0.012, (f) => ring(f, INNER_LIPS))
  const blush = mask(
    both((f, n) => {
      const c = P(f, CHEEKS[n])
      // 蘋果肌稍微往下、往外一點，橢圓形
      const fw = faceW(f)
      ctx.beginPath()
      ctx.ellipse(c.x + (n === 0 ? -1 : 1) * fw * 0.02, c.y + fw * 0.03, fw * 0.12, fw * 0.08, 0, 0, Math.PI * 2)
    }),
    0.12,
  )
  const brows = mask(both((f, n) => ring(f, n === 0 ? BROW_A : BROW_B)), 0.015)
  const shadow = mask(
    both((f, n) => band(f, n === 0 ? UPPER_LID_A : UPPER_LID_B, -1.3, n)),
    0.05,
    eyes,
  )
  const eye = mask(eyes, 0.006)
  const under = mask(
    both((f, n) => band(f, n === 0 ? LOWER_LID_A : LOWER_LID_B, 1.1, n)),
    0.04,
    eyes,
  )
  const teeth = mask((f) => ring(f, INNER_LIPS), 0.006)
  // 唇中央：沿著上下唇交界畫一條粗線再大幅羽化，暈染唇的顏色集中在這裡、往唇線變淡
  const lipCenter = mask(
    (f) => {
      ring(f, INNER_LIPS)
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = Math.max(2, dist(P(f, 0), P(f, 17)) * 0.55)
      ctx.stroke()
    },
    0.035,
  )
  canvas.width = canvas.height = 0

  const pack = (a: Uint8Array, b: Uint8Array, c: Uint8Array, d: Uint8Array | null): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      out[i * 4] = a[i]
      out[i * 4 + 1] = b[i]
      out[i * 4 + 2] = c[i]
      out[i * 4 + 3] = d ? d[i] : 0
    }
    return flipRowsRGBA(out, w, h)
  }
  const id = nextId++
  return {
    makeup: { kind: '2d', key: `regions/makeup#${id}`, width: w, height: h, channels: 4, data: pack(lips, blush, brows, shadow) },
    features: { kind: '2d', key: `regions/features#${id}`, width: w, height: h, channels: 4, data: pack(eye, under, teeth, lipCenter) },
  }
}

/** shader 共用：把 #rrggbb 轉成 0..1 的 rgb */
export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
