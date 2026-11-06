// 手機上的 AI 消除（MI-GAN，Picsart AI Research，MIT 授權）：把塗到的地方用背景補起來。
// 模型約 28MB、程式約 14MB，第一次用到才下載，之後由 service worker 快取，可以離線使用。
// 模型自己會在塗的範圍附近裁一塊、縮成 512 處理、再貼回原本的解析度。

import { create } from 'zustand'
import type { InpaintRequest, InpaintResponse } from './inpaint.worker.ts'

/** 模型的完整網址（用到時才算：測試環境沒有 location） */
const modelUrl = () => new URL(`${import.meta.env.BASE_URL}models/migan_pipeline_v2.onnx`, location.href).href

/** 給介面顯示的狀態：第一次要下載模型，之後只要運算 */
export const useInpaintStatus = create<{ state: 'idle' | 'downloading' | 'running' | 'ready' | 'error' }>(() => ({
  state: 'idle',
}))

let worker: Worker | null = null
let nextId = 0
let loaded = false
const waiting = new Map<number, { resolve: (v: Uint8ClampedArray<ArrayBuffer>) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./inpaint.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<InpaintResponse>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if ('error' in e.data) w.reject(new Error(e.data.error))
      else w.resolve(e.data.rgba)
    }
  }
  return worker
}

/**
 * 消除：rgba 是一張照片（或照片的一塊），mask 是同樣大小、每個像素 255 保留／0 要補。
 * 回傳補好的 RGBA（沒塗到的地方和原本一樣）。
 */
export async function inpaint(rgba: Uint8ClampedArray, mask: Uint8Array, w: number, h: number): Promise<Uint8ClampedArray<ArrayBuffer>> {
  useInpaintStatus.setState({ state: loaded ? 'running' : 'downloading' })
  const id = nextId++
  try {
    const out = await new Promise<Uint8ClampedArray<ArrayBuffer>>((resolve, reject) => {
      waiting.set(id, { resolve, reject })
      // 複製一份再傳過去（傳過去的會被搬走，呼叫端可能還要用原本的）
      const req: InpaintRequest = { id, modelUrl: modelUrl(), rgba: rgba.slice(), mask: mask.slice(), w, h }
      getWorker().postMessage(req, [req.rgba.buffer, req.mask.buffer])
    })
    loaded = true
    useInpaintStatus.setState({ state: 'ready' })
    return out
  } catch (e) {
    useInpaintStatus.setState({ state: 'error' })
    throw e
  }
}
