// 增高的幾何：把畫面上 top～bottom 這一段（例如腿）拉長，整張圖跟著變高。
// 座標都是 0..1、原點左上；top、bottom 是「拉長之前」的位置。純函式，方便測試。

import type { Size } from '../../gl/limits.ts'

export interface TallerParams {
  top: number
  bottom: number
  amount: number // 0..100
}

export const DEFAULT_TALLER: TallerParams = { top: 0.55, bottom: 0.95, amount: 0 }

/** 拉長的倍數：100 時這一段變成 1.35 倍 */
export const factor = (p: TallerParams) => 1 + (p.amount / 100) * 0.35

/** 拉長後的整張圖尺寸 */
export function stretchedSize(input: Size, p: TallerParams): Size {
  const band = (p.bottom - p.top) * input.height
  return { width: input.width, height: Math.round(input.height + band * (factor(p) - 1)) }
}

/** 拉長後的 y（0..1）→ 拉長前的 y（0..1） */
export function toBefore(y: number, p: TallerParams): number {
  const f = factor(p)
  // 拉長後整張的高度（以拉長前的高度為 1）
  const total = 1 + (p.bottom - p.top) * (f - 1)
  const yo = y * total
  const t0 = p.top
  const t1 = p.top + (p.bottom - p.top) * f
  if (yo < t0) return yo
  if (yo < t1) return t0 + (yo - t0) / f
  return yo - (p.bottom - p.top) * (f - 1)
}

/** 拉長前的 y → 拉長後的 y（畫操作層的線用） */
export function toAfter(y: number, p: TallerParams): number {
  const f = factor(p)
  const total = 1 + (p.bottom - p.top) * (f - 1)
  let yo: number
  if (y < p.top) yo = y
  else if (y < p.bottom) yo = p.top + (y - p.top) * f
  else yo = y + (p.bottom - p.top) * (f - 1)
  return yo / total
}
