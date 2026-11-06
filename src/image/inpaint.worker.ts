// 背景執行緒：跑 MI-GAN 消除模型（ONNX Runtime Web，單執行緒 wasm）。
// 放在 Worker 裡，模型算幾秒鐘的時候畫面不會卡住。

import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

// GitHub Pages 沒辦法開多執行緒（需要特殊的伺服器標頭），用單執行緒
ort.env.wasm.numThreads = 1
ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href }

let session: Promise<ort.InferenceSession> | null = null

export interface InpaintRequest {
  id: number
  modelUrl: string
  /** RGBA，長度 w × h × 4 */
  rgba: Uint8ClampedArray
  /** 每個像素一個值：255 保留、0 要補 */
  mask: Uint8Array
  w: number
  h: number
}

export type InpaintResponse = { id: number; rgba: Uint8ClampedArray<ArrayBuffer> } | { id: number; error: string }

self.onmessage = async (e: MessageEvent<InpaintRequest>) => {
  const { id, modelUrl, rgba, mask, w, h } = e.data
  try {
    session ??= ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
    const s = await session
    // RGBA（每個像素連在一起）→ 模型要的 CHW（R 全部、G 全部、B 全部）
    const n = w * h
    const chw = new Uint8Array(n * 3)
    for (let i = 0; i < n; i++) {
      chw[i] = rgba[i * 4]
      chw[n + i] = rgba[i * 4 + 1]
      chw[2 * n + i] = rgba[i * 4 + 2]
    }
    const res = await s.run({
      image: new ort.Tensor('uint8', chw, [1, 3, h, w]),
      mask: new ort.Tensor('uint8', mask, [1, 1, h, w]),
    })
    const o = res.result.data as Uint8Array
    const out = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) {
      out[i * 4] = o[i]
      out[i * 4 + 1] = o[n + i]
      out[i * 4 + 2] = o[2 * n + i]
      out[i * 4 + 3] = 255
    }
    ;(self as unknown as Worker).postMessage({ id, rgba: out } satisfies InpaintResponse, [out.buffer])
  } catch (err) {
    session = null // 下次重新載入（例如下載中斷）
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies InpaintResponse)
  }
}
