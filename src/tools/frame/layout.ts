// 邊框的版面：照片放在哪裡、整張圖多大（純函式，預覽、匯出、座標換算共用）

import type { Size } from '../../gl/limits.ts'

export type FrameStyle = 'none' | 'color' | 'blur' | 'polaroid' | 'film' | 'rounded'
export type FrameRatio = 'keep' | '1:1' | '4:5' | '3:4' | '9:16'

export interface FrameParams {
  style: FrameStyle
  /** 純色邊、圓角的底色 */
  color: string
  /** 邊框粗細 0..100 */
  width: number
  /** 整張圖的比例：放進 IG 的方格、限動時常用 */
  ratio: FrameRatio
}

export const DEFAULT_FRAME: FrameParams = { style: 'none', color: '#ffffff', width: 40, ratio: 'keep' }

export interface FrameLayout extends Size {
  /** 照片在整張圖上的位置（px，原點左上） */
  rect: { x: number; y: number; w: number; h: number }
}

/** 邊框最粗是短邊的 12% */
const MAX_BORDER = 0.12

export function frameLayout(input: Size, p: FrameParams): FrameLayout {
  const W = input.width
  const H = input.height
  const m = Math.min(W, H)
  const t = (p.width / 100) * MAX_BORDER * m
  let [left, right, top, bottom] = [t, t, t, t]
  if (p.style === 'polaroid') {
    // 拍立得：三邊一樣，下面特別寬（可以寫字）
    const s = Math.max(t, 0.045 * m)
    ;[left, right, top, bottom] = [s, s, s, s * 3.4]
  } else if (p.style === 'film') {
    // 膠卷：上下要放齒孔
    const band = Math.max(t, 0.09 * m)
    ;[left, right, top, bottom] = [band * 0.35, band * 0.35, band, band]
  }
  let outW = W + left + right
  let outH = H + top + bottom
  if (p.ratio !== 'keep') {
    const [rw, rh] = p.ratio.split(':').map(Number)
    const target = rw / rh
    // 不夠寬就左右補，不夠高就上下補（平均分配）
    if (outW / outH < target) {
      const extra = outH * target - outW
      left += extra / 2
      outW += extra
    } else {
      const extra = outW / target - outH
      top += extra / 2
      outH += extra
    }
  }
  const width = Math.round(outW)
  const height = Math.round(outH)
  return { width, height, rect: { x: Math.round(left), y: Math.round(top), w: W, h: H } }
}

export function isIdentityFrame(p: FrameParams): boolean {
  return p.style === 'none' || (p.width === 0 && p.ratio === 'keep' && p.style !== 'polaroid' && p.style !== 'film')
}
