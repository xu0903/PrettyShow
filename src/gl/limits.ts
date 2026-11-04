// 尺寸上限相關的計算（純函式，方便測試）

/** iOS Safari 單一 canvas 的像素上限（4096 × 4096），超過會畫不出來或直接當掉 */
export const IOS_MAX_CANVAS_PIXELS = 16_777_216

/** 預覽圖的長邊上限：夠清晰、可以稍微放大，滑桿調整也夠流暢 */
export const PREVIEW_MAX_SIDE = 2048

export interface Size {
  width: number
  height: number
}

export interface FitLimits {
  /** 總像素上限 */
  maxPixels?: number
  /** 長、寬各自的上限（例如 gl.MAX_TEXTURE_SIZE） */
  maxSide?: number
}

/**
 * 在不超過限制的前提下等比例縮小，絕不放大。
 * 回傳整數尺寸與實際縮放比例。
 */
export function fitWithin(size: Size, limits: FitLimits): Size & { scale: number } {
  const { width: w, height: h } = size
  const maxPixels = limits.maxPixels ?? Infinity
  const maxSide = limits.maxSide ?? Infinity

  const scale = Math.min(1, Math.sqrt(maxPixels / (w * h)), maxSide / Math.max(w, h))
  if (scale >= 1) return { width: w, height: h, scale: 1 }

  let width = Math.max(1, Math.floor(w * scale))
  let height = Math.max(1, Math.floor(h * scale))
  // 四捨五入後仍可能剛好超過像素上限，逐步修正
  while (width * height > maxPixels) {
    if (width >= height) width--
    else height--
  }
  return { width, height, scale: width / w }
}
