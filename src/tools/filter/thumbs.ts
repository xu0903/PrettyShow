// 濾鏡縮圖：用目前照片的小縮圖套上每一款濾鏡，讓你選之前就看得到效果。
// 每張照片只算一次（快取在 WeakMap，照片換掉後自動釋放）。

import { Renderer } from '../../gl/renderer.ts'
import { resizeTo, releaseCanvas } from '../../image/load.ts'
import { loadLut } from './lutCache.ts'
import { lutPass } from './pass.ts'
import { FILTERS } from './presets.ts'

const THUMB = 120 // px（約 2x 螢幕的 60pt）

export interface FilterThumbs {
  original: string
  byId: Record<string, string>
}

const cache = new WeakMap<HTMLCanvasElement, Promise<FilterThumbs>>()

export function getFilterThumbs(preview: HTMLCanvasElement): Promise<FilterThumbs> {
  let p = cache.get(preview)
  if (!p) {
    p = build(preview)
    cache.set(preview, p)
  }
  return p
}

async function build(preview: HTMLCanvasElement): Promise<FilterThumbs> {
  // 取中間的正方形再縮小
  const side = Math.min(preview.width, preview.height)
  const square = document.createElement('canvas')
  square.width = side
  square.height = side
  square.getContext('2d')!.drawImage(preview, (preview.width - side) / 2, (preview.height - side) / 2, side, side, 0, 0, side, side)
  const small = resizeTo(square, { width: THUMB, height: THUMB })
  releaseCanvas(square)

  const luts = await Promise.all(FILTERS.map((f) => loadLut(f.id)))

  // 用一個暫時的 WebGL canvas 依序畫出每款濾鏡，畫完立刻轉成圖片
  const glCanvas = document.createElement('canvas')
  const renderer = new Renderer(glCanvas, { preserveDrawingBuffer: true })
  renderer.setSource(small)
  const byId: Record<string, string> = {}
  FILTERS.forEach((f, i) => {
    renderer.render([lutPass(f.id, luts[i], 1)])
    byId[f.id] = glCanvas.toDataURL('image/jpeg', 0.85)
  })
  renderer.dispose()
  const original = small.toDataURL('image/jpeg', 0.85)
  releaseCanvas(small)
  return { original, byId }
}
