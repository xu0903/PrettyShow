// 裁切／旋轉／翻轉的幾何計算（純函式，方便測試）。
//
// 座標約定：所有位置都是 0..1 的比例，原點在左上角、y 向下。
// 「顯示空間」= 原圖先旋轉（每次 90°）再翻轉之後的樣子，裁切框定義在顯示空間。
// 翻轉是在旋轉之後套用，所以「水平翻轉」永遠是畫面上看到的左右翻轉。

import type { Size } from '../../gl/limits.ts'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type AspectId = 'free' | 'original' | '1:1' | '4:5' | '3:4' | '9:16' | '1.91:1' | '16:9'

export interface CropParams {
  /** 順時針旋轉了幾個 90°（0–3） */
  quarter: number
  flipH: boolean
  flipV: boolean
  /** 裁切框（顯示空間） */
  rect: Rect
  aspect: AspectId
}

export const FULL_RECT: Rect = { x: 0, y: 0, w: 1, h: 1 }
/** 裁切框最小的邊長比例 */
export const MIN_SIZE = 0.05
const EPS = 1e-4

export const DEFAULT_CROP: CropParams = { quarter: 0, flipH: false, flipV: false, rect: FULL_RECT, aspect: 'free' }

export function isFullRect(r: Rect): boolean {
  return Math.abs(r.x) < EPS && Math.abs(r.y) < EPS && Math.abs(r.w - 1) < EPS && Math.abs(r.h - 1) < EPS
}

export function isIdentityCrop(p: CropParams): boolean {
  return p.quarter % 4 === 0 && !p.flipH && !p.flipV && isFullRect(p.rect)
}

/** 旋轉後的照片尺寸（轉 90° / 270° 時長寬互換） */
export function rotatedSize(size: Size, quarter: number): Size {
  return quarter % 2 === 1 ? { width: size.height, height: size.width } : size
}

/** 裁切後輸出的像素尺寸 */
export function croppedSize(size: Size, p: CropParams): Size {
  const r = rotatedSize(size, p.quarter)
  return {
    width: Math.max(1, Math.round(r.width * p.rect.w)),
    height: Math.max(1, Math.round(r.height * p.rect.h)),
  }
}

/** 比例（寬 / 高，以像素計）；free 回傳 null */
export function aspectRatio(aspect: AspectId, display: Size): number | null {
  switch (aspect) {
    case 'free':
      return null
    case 'original':
      return display.width / display.height
    default: {
      const [w, h] = aspect.split(':').map(Number)
      return w / h
    }
  }
}

/** 符合比例的最大置中裁切框 */
export function fitAspect(ratio: number, display: Size): Rect {
  // 換算成比例座標下的寬高比
  const rn = ratio * (display.height / display.width)
  const w = rn >= 1 ? 1 : rn
  const h = rn >= 1 ? 1 / rn : 1
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** 往左轉 90°（逆時針），和 iPhone 相簿的旋轉按鈕一樣 */
export function rotateLeft(p: CropParams, size: Size): CropParams {
  const quarter = (p.quarter + 3) % 4
  // 先翻轉再旋轉 = 先旋轉再做另一個方向的翻轉，所以水平、垂直翻轉要互換
  const next = { ...p, quarter, flipH: p.flipV, flipV: p.flipH }
  const display = rotatedSize(size, quarter)
  const ratio = aspectRatio(p.aspect, display)
  // 固定比例時重新置中；自由比例時讓裁切框跟著照片一起轉
  const { x, y, w, h } = p.rect
  next.rect = ratio ? fitAspect(ratio, display) : { x: y, y: 1 - x - w, w: h, h: w }
  return next
}

export function flipHorizontal(p: CropParams): CropParams {
  return { ...p, flipH: !p.flipH, rect: { ...p.rect, x: 1 - p.rect.x - p.rect.w } }
}

export function flipVertical(p: CropParams): CropParams {
  return { ...p, flipV: !p.flipV, rect: { ...p.rect, y: 1 - p.rect.y - p.rect.h } }
}

export function setAspect(p: CropParams, aspect: AspectId, size: Size): CropParams {
  const display = rotatedSize(size, p.quarter)
  const ratio = aspectRatio(aspect, display)
  return { ...p, aspect, rect: ratio ? fitAspect(ratio, display) : p.rect }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 拖動整個裁切框 */
export function moveRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) }
}

/** 拖的是哪個把手：角落 nw/ne/sw/se，或邊 n/s/w/e */
export type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'

/**
 * 拖動把手調整大小。
 * @param r      開始拖之前的裁切框
 * @param dx,dy  手指移動量（比例座標）
 * @param ratio  固定比例（像素寬/高），null 為自由
 * @param display 顯示空間的像素尺寸（換算比例用）
 */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, ratio: number | null, display: Size): Rect {
  let left = r.x
  let top = r.y
  let right = r.x + r.w
  let bottom = r.y + r.h

  if (handle.includes('w')) left = clamp(left + dx, 0, right - MIN_SIZE)
  if (handle.includes('e')) right = clamp(right + dx, left + MIN_SIZE, 1)
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_SIZE)
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIZE, 1)

  if (ratio === null) return { x: left, y: top, w: right - left, h: bottom - top }

  // 固定比例：以對角為錨點，照手指拉得比較遠的那個方向決定大小，再塞回邊界內
  const rn = ratio * (display.height / display.width)
  const anchorX = handle.includes('w') ? r.x + r.w : r.x
  const anchorY = handle.includes('n') ? r.y + r.h : r.y
  const maxW = handle.includes('w') ? anchorX : 1 - anchorX
  const maxH = handle.includes('n') ? anchorY : 1 - anchorY
  let w = right - left
  let h = bottom - top
  if (handle === 'n' || handle === 's') w = h * rn
  else if (handle === 'w' || handle === 'e') h = w / rn
  else if (w / h > rn) h = w / rn
  else w = h * rn
  // 不能超出照片，也不能小於最小尺寸
  const scale = Math.min(1, maxW / w, maxH / h)
  w *= scale
  h *= scale
  const minScale = Math.max(1, MIN_SIZE / w, MIN_SIZE / h)
  w = Math.min(w * minScale, maxW)
  h = Math.min(h * minScale, maxH)

  // 只拖單邊時，另一個方向以原本的中心對齊
  let x = handle.includes('w') ? anchorX - w : anchorX
  let y = handle.includes('n') ? anchorY - h : anchorY
  if (handle === 'n' || handle === 's') x = clamp(r.x + r.w / 2 - w / 2, 0, 1 - w)
  if (handle === 'w' || handle === 'e') y = clamp(r.y + r.h / 2 - h / 2, 0, 1 - h)
  return { x, y, w, h }
}

/**
 * 顯示空間的點 → 原圖的點（shader 用同樣的算法，這裡給測試驗證用）。
 * 先還原翻轉，再還原旋轉。
 */
export function displayToSource(px: number, py: number, p: CropParams): [number, number] {
  let x = p.flipH ? 1 - px : px
  let y = p.flipV ? 1 - py : py
  switch (p.quarter % 4) {
    case 1:
      ;[x, y] = [y, 1 - x]
      break
    case 2:
      ;[x, y] = [1 - x, 1 - y]
      break
    case 3:
      ;[x, y] = [1 - y, x]
      break
  }
  return [x, y]
}
