// 臉部偵測：用 MediaPipe Face Landmarker 在預覽圖上找臉，每張照片只做一次。
// MediaPipe 的程式（約 13MB 的 wasm）和模型（3.6MB）放在自己的網站上，
// 第一次用到美顏時才下載，之後由 service worker 快取，可以離線使用。

import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Texture2DSource } from '../../gl/pass.ts'
import { buildSkinMask, faceWidth, maskSize, type Point } from './mask.ts'

const MODEL_URL = `${import.meta.env.BASE_URL}models/face_landmarker.task`
/** 一張照片最多找幾張臉 */
const MAX_FACES = 6

export interface FaceData {
  /** 每張臉 478 個特徵點（0..1，原點左上） */
  faces: Point[][]
  /** 皮膚遮罩；沒找到臉時是 null */
  mask: Texture2DSource | null
  /** 最大那張臉的寬度（預覽圖的 px），用來決定磨皮半徑 */
  faceWidthPx: number
}

let landmarker: Promise<FaceLandmarker> | null = null

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
      return FaceLandmarker.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        {
          // iPhone 上 GPU 版偶爾不穩定；單張照片用 CPU 也只要零點幾秒
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: MAX_FACES,
        },
      )
    })()
    // 下載失敗時允許下次重試
    landmarker.catch(() => {
      landmarker = null
    })
  }
  return landmarker
}

const pending = new WeakMap<HTMLCanvasElement, Promise<FaceData>>()
const ready = new WeakMap<HTMLCanvasElement, FaceData>()
let nextId = 0

/** 偵測照片裡的臉（結果依預覽圖快取，換照片後自動釋放） */
export function detectFaces(preview: HTMLCanvasElement): Promise<FaceData> {
  let p = pending.get(preview)
  if (!p) {
    p = (async () => {
      const lm = await getLandmarker()
      const result = lm.detect(preview)
      const faces = result.faceLandmarks.map((f) => f.map(({ x, y }) => ({ x, y })))
      const size = maskSize(preview.width, preview.height)
      const data: FaceData = {
        faces,
        mask:
          faces.length > 0
            ? { kind: '2d', key: `beauty/mask#${nextId++}`, ...size, data: buildSkinMask(faces, size.width, size.height) }
            : null,
        faceWidthPx: Math.max(0, ...faces.map((f) => faceWidth(f) * preview.width)),
      }
      ready.set(preview, data)
      return data
    })()
    pending.set(preview, p)
    p.catch(() => pending.delete(preview))
  }
  return p
}

/** 已經偵測完的結果（還沒好就是 undefined）；shader 步驟必須同步取得 */
export function getFaceData(preview: HTMLCanvasElement): FaceData | undefined {
  return ready.get(preview)
}
