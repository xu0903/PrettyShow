// 臉部重塑：依 MediaPipe 的臉部特徵點，把每個滑桿換算成幾個局部變形。
// 方向都沿著「臉的中軸」（額頭頂端到下巴），臉歪一邊時也會往正確的方向收。

import type { Point } from '../../core/tool.ts'
import { EYE_A, EYE_B } from '../beauty/landmarks.ts'
import type { WarpOp } from '../warp/warp.ts'

export interface ReshapeParams {
  slim: number // 瘦臉 0..100
  eyes: number // 大眼 0..100
  nose: number // 瘦鼻 0..100
  chin: number // 下巴 -100..100（正值變長）
  forehead: number // 額頭 -100..100（正值變高）
  mouth: number // 嘴型 -100..100（正值變大）
}

export const DEFAULT_RESHAPE: ReshapeParams = { slim: 0, eyes: 0, nose: 0, chin: 0, forehead: 0, mouth: 0 }

// 特徵點編號
const FOREHEAD = 10
const CHIN = 152
const CHEEK_A = 234
const CHEEK_B = 454
/** 下半張臉的輪廓（兩側各五點，由臉頰往下巴） */
const JAW_A = [132, 58, 172, 136, 150]
const JAW_B = [361, 288, 397, 365, 379]
/** 越靠近下巴收得越多 */
const JAW_WEIGHT = [0.6, 0.85, 1, 1, 0.8]
const NOSE_WINGS = [129, 358]
const MOUTH_CORNERS = [61, 291]
const EYE_CORNERS: [number, number][] = [
  [33, 133],
  [263, 362],
]

interface V {
  x: number
  y: number
}

const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k })
const len = (a: V) => Math.hypot(a.x, a.y)
const norm = (a: V): V => {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l }
}
const mean = (pts: V[]): V => mul(pts.reduce(add, { x: 0, y: 0 }), 1 / pts.length)

/**
 * 一張臉的變形清單。
 * @param face 478 個特徵點（0..1，原點左上）
 * @param W,H  照片的像素尺寸（只用來算長寬比）
 */
export function faceOps(face: readonly Point[], W: number, H: number, p: ReshapeParams): WarpOp[] {
  const L = Math.max(W, H)
  // 在像素空間計算，最後再換回 0..1
  const P = (i: number): V => ({ x: face[i].x * W, y: face[i].y * H })
  const ops: WarpOp[] = []
  const move = (dest: V, r: number, d: V) => ops.push({ kind: 'move', x: dest.x / W, y: dest.y / H, r: r / L, dx: d.x / L, dy: d.y / L })
  const scale = (c: V, r: number, s: number) => ops.push({ kind: 'scale', x: c.x / W, y: c.y / H, r: r / L, s })

  const faceW = len(sub(P(CHEEK_B), P(CHEEK_A)))
  const top = P(FOREHEAD)
  const chin = P(CHIN)
  const down = norm(sub(chin, top))
  /** 點到中軸的垂足：往這個方向推就是往臉的中間收 */
  const toAxis = (pt: V): V => {
    const foot = add(top, mul(down, (pt.x - top.x) * down.x + (pt.y - top.y) * down.y))
    return norm(sub(foot, pt))
  }
  // 推移的圓心放在「推過去之後」的位置（反向取樣才準）
  const push = (pt: V, d: V, r: number) => move(add(pt, d), r, d)

  if (p.slim) {
    const k = (p.slim / 100) * faceW * 0.045
    for (const side of [JAW_A, JAW_B])
      side.forEach((i, n) => push(P(i), mul(toAxis(P(i)), k * JAW_WEIGHT[n]), faceW * 0.18))
  }
  if (p.eyes) {
    const s = (p.eyes / 100) * 0.2
    ;[EYE_A, EYE_B].forEach((ring, n) => {
      const [a, b] = EYE_CORNERS[n]
      scale(mean(ring.map(P)), len(sub(P(a), P(b))) * 1.1, s)
    })
  }
  if (p.nose) {
    const k = (p.nose / 100) * faceW * 0.03
    for (const i of NOSE_WINGS) push(P(i), mul(toAxis(P(i)), k), faceW * 0.08)
  }
  if (p.chin) push(chin, mul(down, (p.chin / 100) * faceW * 0.07), faceW * 0.28)
  if (p.forehead) push(top, mul(down, -(p.forehead / 100) * faceW * 0.06), faceW * 0.35)
  if (p.mouth) {
    const [a, b] = MOUTH_CORNERS.map(P)
    scale(mean([a, b]), len(sub(b, a)) * 0.9, (p.mouth / 100) * 0.18)
  }
  return ops
}
