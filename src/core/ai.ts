// AI 修圖的用戶端：照片縮小後送到自己的 Cloudflare Worker，Worker 再去呼叫 AI 服務。
// API 金鑰只在 Worker 裡；這裡只存 Worker 的網址和通行碼（在「我」裡面設定，存在這台手機上）。

import { decodeImage, releaseCanvas, resizeTo } from '../image/load.ts'

export type AiTask = 'hairstyle' | 'remove' | 'enhance' | 'style' | 'portrait'

export const AI_TASKS: { id: AiTask; label: string; desc: string; options: { id: string; label: string }[] }[] = [
  {
    id: 'hairstyle',
    label: 'AI 換髮型',
    desc: '換成不同的髮型，臉和背景不變',
    options: [
      { id: 'bob', label: '韓系鮑伯' },
      { id: 'bangs', label: '空氣瀏海' },
      { id: 'longwave', label: '大波浪' },
      { id: 'short', label: '清爽短髮' },
      { id: 'ponytail', label: '高馬尾' },
      { id: 'bun', label: '丸子頭' },
      { id: 'curly', label: '捲髮' },
      { id: 'pixie', label: '精靈短髮' },
      { id: 'twoblock', label: '男生 two-block' },
      { id: 'comma', label: '逗號瀏海' },
    ],
  },
  { id: 'remove', label: '消除路人', desc: '用手指塗掉不想要的人或物，AI 補上背景', options: [{ id: 'marked', label: '消除塗到的地方' }] },
  { id: 'enhance', label: '畫質修復', desc: '模糊、低解析度的照片變清楚', options: [{ id: 'auto', label: '自動修復' }] },
  {
    id: 'style',
    label: 'AI 創意',
    desc: '把照片變成不同的畫風',
    options: [
      { id: 'anime', label: '日系動漫' },
      { id: 'cartoon3d', label: '3D 卡通' },
      { id: 'watercolor', label: '水彩' },
      { id: 'oil', label: '油畫' },
      { id: 'sketch', label: '素描' },
      { id: 'film', label: '90 年代底片' },
    ],
  },
  {
    id: 'portrait',
    label: '形象照',
    desc: '用自拍做出正式的形象照',
    options: [
      { id: 'korean', label: '韓系證件風' },
      { id: 'business', label: '商務西裝' },
      { id: 'studio', label: '棚拍' },
    ],
  },
]

const SETTINGS_KEY = 'prettyshow.ai'
/** 送去 AI 的照片長邊：AI 輸出大約 1024，再大只是浪費流量 */
const SEND_LONG = 1536

export interface AiSettings {
  url: string
  code: string
}

export function getAiSettings(): AiSettings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<AiSettings>
    return { url: v.url ?? '', code: v.code ?? '' }
  } catch {
    return { url: '', code: '' }
  }
}

export function setAiSettings(s: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ url: s.url.trim().replace(/\/+$/, ''), code: s.code }))
  } catch {
    // 存不了（無痕模式）就只在這次有效
  }
}

export const aiReady = () => {
  const s = getAiSettings()
  return !!s.url && !!s.code
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const { url, code } = getAiSettings()
  if (!url || !code) throw new Error('還沒設定 AI：到「我」填入 Worker 網址和通行碼')
  let res: Response
  try {
    res = await fetch(url + path, { ...init, headers: { ...init?.headers, 'X-Access-Code': code } })
  } catch {
    throw new Error('連不到 AI 服務：請確認網路，以及「我」裡面的 Worker 網址')
  }
  if (res.status === 401) throw new Error('通行碼錯誤')
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(d.error ?? `AI 服務錯誤（${res.status}）`)
  }
  return res
}

/** 測試連線，回傳 Worker 設定的模型 */
export async function aiPing(): Promise<string> {
  const d = (await (await call('/v1/ping')).json()) as { model?: string }
  return d.model ?? ''
}

/** 照片 → 縮小的 JPEG（base64），可以在上面加東西（例如消除路人的紅色筆跡） */
export async function prepareImage(
  file: Blob,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Promise<string> {
  const img = await decodeImage(file)
  const s = Math.min(1, SEND_LONG / Math.max(img.naturalWidth, img.naturalHeight))
  const c = resizeTo(Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight }), {
    width: Math.round(img.naturalWidth * s),
    height: Math.round(img.naturalHeight * s),
  })
  draw?.(c.getContext('2d')!, c.width, c.height)
  const url = c.toDataURL('image/jpeg', 0.9)
  releaseCanvas(c)
  return url.slice(url.indexOf(',') + 1)
}

/** 請 AI 處理，回傳結果圖 */
export async function aiEdit(task: AiTask, option: string, imageBase64: string): Promise<Blob> {
  const res = await call('/v1/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, option, image: imageBase64 }),
  })
  const d = (await res.json()) as { image: string; mime: string }
  const bytes = Uint8Array.from(atob(d.image), (ch) => ch.charCodeAt(0))
  return new Blob([bytes], { type: d.mime || 'image/png' })
}
