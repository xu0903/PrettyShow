// 匯出：用原圖解析度把同樣的 shader 步驟重跑一次，輸出 JPEG，再交給分享選單或下載。
// 預覽只用縮小的圖，原圖只在這裡解碼一次，用完立刻釋放（iPhone 的記憶體很有限）。

import { getMaxTextureSize } from '../gl/capabilities.ts'
import { Renderer } from '../gl/renderer.ts'
import { decodeForExport, releaseCanvas, type LoadedPhoto } from '../image/load.ts'
import type { EditState } from './editStack.ts'
import { buildPasses, prepareTools } from './pipeline.ts'
import { getTools } from './registry.ts'

export interface ExportResult {
  file: File
  width: number
  height: number
  /** 預覽用的 object URL，不用時要 URL.revokeObjectURL */
  url: string
}

const JPEG_QUALITY = 0.92
/** 超過這個像素數，中間結果改用 8-bit，避免 iPhone 的 GPU 記憶體不夠 */
const HIGH_PRECISION_MAX_PIXELS = 8_000_000

const pad = (n: number) => String(n).padStart(2, '0')

/** 匯出的檔名：PrettyShow_20261104_153012.jpg */
export function exportFileName(date: Date): string {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `PrettyShow_${d}_${t}.jpg`
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法產生圖片檔'))), type, quality)
  })
}

/** 用原圖解析度渲染目前的編輯結果 */
export async function exportPhoto(photo: LoadedPhoto, state: EditState): Promise<ExportResult> {
  const tools = getTools()
  // 濾鏡之類的資源要先準備好；匯出不看目前打開的工具，裁切一定會套用
  await prepareTools(state, tools)

  const { canvas: full } = await decodeForExport(photo.file, getMaxTextureSize())
  const sourceWidth = full.width
  const out = document.createElement('canvas')
  let renderer: Renderer | null = null
  try {
    renderer = new Renderer(out, {
      preserveDrawingBuffer: true,
      highPrecision: full.width * full.height <= HIGH_PRECISION_MAX_PIXELS,
    })
    renderer.setSource(full)
    // 已經上傳到 GPU 了，CPU 這份先釋放
    releaseCanvas(full)
    // 銳化半徑這類以像素為單位的效果，要跟著放大才會和預覽看起來一樣
    const passes = buildPasses(state, tools, { pixelScale: sourceWidth / photo.preview.width })
    const size = renderer.render(passes)
    // GPU 被系統回收的話畫面是空的，不要輸出一張黑圖
    if (renderer.isLost) throw new Error('記憶體不足，匯出失敗，請關掉其他 App 再試一次')
    const blob = await canvasToBlob(out, 'image/jpeg', JPEG_QUALITY)
    const file = new File([blob], exportFileName(new Date()), { type: 'image/jpeg' })
    return { file, ...size, url: URL.createObjectURL(file) }
  } finally {
    releaseCanvas(full)
    renderer?.dispose()
    releaseCanvas(out)
  }
}

/** 這個瀏覽器能不能用系統分享選單分享檔案（iPhone 上選「儲存影像」就會存到相簿） */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/**
 * 打開系統分享選單。一定要在使用者點擊的當下直接呼叫，
 * iOS 不允許在等待其他工作之後才叫出分享選單。
 * 回傳 false 代表使用者自己取消了。
 */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file] })
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false
    throw e
  }
}

/** 不支援分享時的備案：直接下載 */
export function downloadFile(file: File, url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
}
