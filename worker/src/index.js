// PrettyShow 的 AI 中繼站（Cloudflare Worker）。
// 網站把照片送到這裡，這裡帶著 API 金鑰去呼叫 Google Gemini，再把結果傳回去。
// 金鑰（GEMINI_API_KEY）和通行碼（ACCESS_CODE）用 `wrangler secret put` 設定，不會出現在網站上。

import { TASKS } from './prompts.js'

/** 照片最大多少（base64 之後）；App 會先縮小到長邊 1536，大約 0.5–1.5MB */
const MAX_BODY = 8 * 1024 * 1024
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta'

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

    if (!cors['Access-Control-Allow-Origin']) return json({ error: '這個網站不能使用' }, 403)
    if (!(await checkCode(request, env))) return json({ error: '通行碼錯誤' }, 401)

    // 測試連線
    if (url.pathname === '/v1/ping') return json({ ok: true, model: env.MODEL })

    if (url.pathname !== '/v1/edit' || request.method !== 'POST') return json({ error: '找不到' }, 404)
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return json({ error: '照片太大' }, 413)

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: '格式錯誤' }, 400)
    }
    const task = TASKS[body.task]
    if (!task || !(body.option in task.options) || typeof body.image !== 'string') return json({ error: '不支援的功能' }, 400)

    try {
      const image = await callGemini(env, task.prompt(task.options[body.option]), body.image)
      return json(image)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502)
    }
  },
}

/** 只允許自己的網站（和開發用的 localhost）呼叫 */
export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim())
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)
  return ok
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {}
}

/** 比對通行碼（用固定時間的比較，避免被一個字一個字猜出來） */
export async function checkCode(request, env) {
  const given = new TextEncoder().encode(request.headers.get('X-Access-Code') ?? '')
  const expected = new TextEncoder().encode(env.ACCESS_CODE ?? '')
  if (!expected.length) return false
  const [a, b] = (await Promise.all([crypto.subtle.digest('SHA-256', given), crypto.subtle.digest('SHA-256', expected)])).map(
    (d) => new Uint8Array(d),
  )
  // 兩邊都是 32 bytes 的雜湊，逐一比較每個 byte（不會提早結束）
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** 呼叫 Gemini 的圖片模型；先用新版的 Interactions API，不支援時改用舊的 generateContent */
async function callGemini(env, prompt, imageBase64) {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }
  const res = await fetch(`${GEMINI}/interactions`, {
    method: 'POST',
    headers: { ...headers, 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({
      model: env.MODEL,
      input: [
        { type: 'text', text: prompt },
        { type: 'image', mime_type: 'image/jpeg', data: imageBase64 },
      ],
      response_format: { type: 'image' },
    }),
  })
  if (res.ok) return pickImage(await res.json())
  if (res.status !== 404) throw new Error(await errorText(res))

  // 舊的呼叫方式（有些模型可能只支援這個）
  const old = await fetch(`${GEMINI}/models/${env.MODEL}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  if (!old.ok) throw new Error(await errorText(old))
  return pickImage(await old.json())
}

/** 從回應裡找出最後一張圖（兩種 API 的格式都支援）；只看模型的輸出，不會拿到自己送出去的照片 */
export function pickImage(data) {
  let found = null
  let text = ''
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    // Interactions API：{ type: 'image', data, mime_type }
    if (v.type === 'image' && typeof v.data === 'string') found = { image: v.data, mime: v.mime_type ?? 'image/png' }
    // generateContent：{ inlineData: { data, mimeType } }
    const inline = v.inlineData ?? v.inline_data
    if (inline && typeof inline.data === 'string') found = { image: inline.data, mime: inline.mimeType ?? inline.mime_type ?? 'image/png' }
    if (typeof v.text === 'string') text += v.text
    Object.values(v).forEach(walk)
  }
  if (Array.isArray(data?.steps)) data.steps.filter((st) => st.type === 'model_output').forEach(walk)
  else if (Array.isArray(data?.candidates)) walk(data.candidates)
  else if (data?.output_image) walk(data.output_image)
  else walk(data)
  if (!found) throw new Error(text ? `AI 沒有產生圖片：${text.slice(0, 200)}` : 'AI 沒有產生圖片，請換一張照片或稍後再試')
  return found
}

async function errorText(res) {
  try {
    const d = await res.json()
    return `AI 服務錯誤（${res.status}）：${d.error?.message ?? JSON.stringify(d).slice(0, 200)}`
  } catch {
    return `AI 服務錯誤（${res.status}）`
  }
}
