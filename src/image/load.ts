// 讀取照片、產生預覽縮圖。
// 原圖不常駐記憶體：只保留原始檔案（Blob），匯出時再解碼成需要的尺寸，
// 這樣可以避免 iPhone 4800 萬像素照片一直佔用幾百 MB 記憶體。

import { fitWithin, IOS_MAX_CANVAS_PIXELS, PREVIEW_MAX_SIDE, type Size } from '../gl/limits.ts'

export interface LoadedPhoto {
  /** 原始檔案，匯出和下次打開 App 時使用 */
  file: Blob
  name: string
  /** 原圖尺寸（已套用 EXIF 方向） */
  width: number
  height: number
  /** 預覽用縮圖 */
  preview: HTMLCanvasElement
}

/**
 * 解碼圖片。用 <img> 而不是 createImageBitmap，
 * 因為 Safari 的 <img> 一定會套用 EXIF 方向，直拍照片才不會躺著。
 * 從相簿選的 HEIC 會被 Safari 自動轉成 JPEG；從「檔案」選的 HEIC，Safari 17 以上也能直接解碼。
 */
export async function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } catch {
    throw new Error('無法讀取這張照片，格式可能不支援')
  } finally {
    // decode 完成後圖片資料已在記憶體中，可以先釋放 URL
    URL.revokeObjectURL(url)
  }
}

/**
 * 把圖縮到指定尺寸。縮小比例很大時，每次只縮一半，
 * 避免一次大幅縮小造成鋸齒和摩爾紋。
 */
export function resizeTo(source: CanvasImageSource & Size, target: Size): HTMLCanvasElement {
  let current: CanvasImageSource = source
  let cw = source.width
  let ch = source.height
  const temps: HTMLCanvasElement[] = []

  while (cw / 2 >= target.width && ch / 2 >= target.height) {
    cw = Math.floor(cw / 2)
    ch = Math.floor(ch / 2)
    const step = drawTo(current, cw, ch)
    temps.push(step)
    current = step
  }
  const out = drawTo(current, target.width, target.height)
  // 中間的暫存 canvas 立刻釋放（iOS 對 canvas 總記憶體有限制）
  for (const t of temps) releaseCanvas(t)
  return out
}

function drawTo(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  return c
}

/** iOS 不會馬上回收 canvas 記憶體，把尺寸設成 0 可以強制釋放 */
export function releaseCanvas(c: HTMLCanvasElement): void {
  c.width = 0
  c.height = 0
}

export async function loadPhoto(file: Blob, name = 'photo', maxTextureSize = 4096): Promise<LoadedPhoto> {
  const img = await decodeImage(file)
  const size = { width: img.naturalWidth, height: img.naturalHeight }
  const previewSize = fitWithin(size, {
    maxSide: Math.min(PREVIEW_MAX_SIDE, maxTextureSize),
    maxPixels: IOS_MAX_CANVAS_PIXELS,
  })
  const source = Object.assign(img, size) // 讓 width/height 等於原始像素尺寸
  const preview = resizeTo(source, previewSize)
  return { file, name, ...size, preview }
}

/** 匯出用：把原始檔案解碼成不超過裝置上限的最大尺寸 */
export async function decodeForExport(
  file: Blob,
  maxTextureSize: number,
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const img = await decodeImage(file)
  const size = { width: img.naturalWidth, height: img.naturalHeight }
  const fit = fitWithin(size, { maxPixels: IOS_MAX_CANVAS_PIXELS, maxSide: maxTextureSize })
  const canvas = resizeTo(Object.assign(img, size), fit)
  return { canvas, scale: fit.scale }
}
