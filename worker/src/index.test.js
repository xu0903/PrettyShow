import { describe, expect, it } from 'vitest'
import { checkCode, corsHeaders, pickImage } from './index.js'

const req = (headers) => new Request('https://w.example/v1/ping', { headers })

describe('pickImage', () => {
  it('Interactions API：只拿模型輸出的圖，不拿送出去的照片', () => {
    const data = {
      input: [{ type: 'image', data: 'INPUT' }],
      steps: [
        { type: 'user_input', content: [{ type: 'image', data: 'INPUT' }] },
        { type: 'model_output', content: [{ type: 'text', text: 'ok' }, { type: 'image', data: 'OUT', mime_type: 'image/png' }] },
      ],
    }
    expect(pickImage(data)).toEqual({ image: 'OUT', mime: 'image/png' })
  })

  it('舊的 generateContent 格式', () => {
    const data = { candidates: [{ content: { parts: [{ inlineData: { data: 'OLD', mimeType: 'image/jpeg' } }] } }] }
    expect(pickImage(data)).toEqual({ image: 'OLD', mime: 'image/jpeg' })
  })

  it('沒有圖時把模型的文字說明當成錯誤訊息', () => {
    expect(() => pickImage({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '無法處理' }] }] })).toThrow(/無法處理/)
  })
})

describe('checkCode', () => {
  it('通行碼要完全一樣，沒設定通行碼時一律拒絕', async () => {
    expect(await checkCode(req({ 'X-Access-Code': 'abc' }), { ACCESS_CODE: 'abc' })).toBe(true)
    expect(await checkCode(req({ 'X-Access-Code': 'abd' }), { ACCESS_CODE: 'abc' })).toBe(false)
    expect(await checkCode(req({}), { ACCESS_CODE: '' })).toBe(false)
  })
})

describe('corsHeaders', () => {
  it('只允許自己的網站和 localhost', () => {
    const env = { ALLOWED_ORIGINS: 'https://xu0903.github.io' }
    expect(corsHeaders(req({ Origin: 'https://xu0903.github.io' }), env)['Access-Control-Allow-Origin']).toBe('https://xu0903.github.io')
    expect(corsHeaders(req({ Origin: 'http://localhost:5173' }), env)['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
    expect(corsHeaders(req({ Origin: 'https://evil.example' }), env)['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
