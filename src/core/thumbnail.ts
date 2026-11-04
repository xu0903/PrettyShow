// 圖庫縮圖：用小尺寸把目前的編輯重新渲染一次（和匯出同一套管線）

import { Renderer } from '../gl/renderer.ts'
import { releaseCanvas, resizeTo, type LoadedPhoto } from '../image/load.ts'
import type { EditState } from './editStack.ts'
import { buildPasses, prepareTools } from './pipeline.ts'
import { getTools } from './registry.ts'

/** 縮圖長邊（px），圖庫一格約 120pt，3 倍螢幕剛好 */
const THUMB_SIDE = 360

export async function renderThumbnail(photo: LoadedPhoto, state: EditState): Promise<string> {
  const tools = getTools()
  await prepareTools(state, tools, { photo })
  const { preview } = photo
  const s = Math.min(1, THUMB_SIDE / Math.max(preview.width, preview.height))
  const small = resizeTo(preview, { width: Math.round(preview.width * s), height: Math.round(preview.height * s) })
  const out = document.createElement('canvas')
  let renderer: Renderer | null = null
  try {
    renderer = new Renderer(out, { preserveDrawingBuffer: true, highPrecision: false })
    renderer.setSource(small)
    renderer.render(buildPasses(state, tools, { pixelScale: small.width / preview.width, photo }))
    return out.toDataURL('image/jpeg', 0.8)
  } finally {
    renderer?.dispose()
    releaseCanvas(small)
    releaseCanvas(out)
  }
}
