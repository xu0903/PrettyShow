// 影像分割（頭髮、人像共用）：用 MediaPipe 的分割模型找出某一類的範圍，每張照片、每個模型只做一次。
// 結果是單通道遮罩（第一列是最下面），以 uv 取樣，預覽和匯出共用。

import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import type { Texture2DSource } from '../../gl/pass.ts'
import { boxBlur } from '../../image/raster.ts'
import { VISION_FILESET } from '../beauty/faces.ts'
import { fitLong } from '../brush/strokes.ts'

export interface SegmentModel {
  /** public/models/ 底下的檔名 */
  file: string
  /** 要哪一類：信心遮罩的第幾張（有些模型只輸出一張） */
  channel: number
  /** 邊緣羽化（遮罩 px） */
  feather: number
}

export interface Segment {
  /** 遮罩；那一類佔畫面太少（例如照片裡沒有人）時是 null */
  mask: Texture2DSource | null
}

/** 模型本身的輸入是 256 或 512，再大也沒有幫助 */
const INPUT_LONG = 512
/** 佔畫面不到這個比例就當作沒有 */
const MIN_COVERAGE = 0.002

const segmenters = new Map<string, Promise<ImageSegmenter>>()

function getSegmenter(file: string): Promise<ImageSegmenter> {
  let s = segmenters.get(file)
  if (!s) {
    s = (async () => {
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
      return ImageSegmenter.createFromOptions(VISION_FILESET, {
        baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/${file}`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    })()
    // 下載失敗時允許下次重試
    s.catch(() => segmenters.delete(file))
    segmenters.set(file, s)
  }
  return s
}

const pending = new Map<string, WeakMap<HTMLCanvasElement, Promise<Segment>>>()
const ready = new Map<string, WeakMap<HTMLCanvasElement, Segment>>()
let nextId = 0

export function segment(model: SegmentModel, preview: HTMLCanvasElement): Promise<Segment> {
  if (!pending.has(model.file)) pending.set(model.file, new WeakMap())
  if (!ready.has(model.file)) ready.set(model.file, new WeakMap())
  const byPreview = pending.get(model.file)!
  let p = byPreview.get(preview)
  if (!p) {
    p = (async () => {
      const seg = await getSegmenter(model.file)
      const { width: w, height: h } = fitLong(preview.width, preview.height, INPUT_LONG)
      const small = document.createElement('canvas')
      small.width = w
      small.height = h
      small.getContext('2d')!.drawImage(preview, 0, 0, w, h)
      const result = seg.segment(small)
      small.width = small.height = 0
      const masks = result.confidenceMasks ?? []
      const m = masks[Math.min(model.channel, masks.length - 1)]
      const mw = m.width
      const mh = m.height
      const conf = m.getAsFloat32Array()
      const data = new Uint8Array(mw * mh)
      let covered = 0
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++) {
          const v = conf[y * mw + x]
          if (v > 0.5) covered++
          // 上下翻轉成 GL 的方向
          data[(mh - 1 - y) * mw + x] = Math.round(Math.min(1, Math.max(0, v)) * 255)
        }
      masks.forEach((x) => x.close())
      boxBlur(data, mw, mh, model.feather)
      const out: Segment = {
        mask: covered / (mw * mh) < MIN_COVERAGE ? null : { kind: '2d', key: `seg/${model.file}#${nextId++}`, width: mw, height: mh, data },
      }
      ready.get(model.file)!.set(preview, out)
      return out
    })()
    byPreview.set(preview, p)
    p.catch(() => byPreview.delete(preview))
  }
  return p
}

/** 已經算好的結果（還沒好就是 undefined） */
export function getSegment(model: SegmentModel, preview: HTMLCanvasElement): Segment | undefined {
  return ready.get(model.file)?.get(preview)
}

export const HAIR_MODEL: SegmentModel = { file: 'hair_segmenter.tflite', channel: 1, feather: 1 }
/** 人像模型只輸出一張「是人的信心」 */
export const PERSON_MODEL: SegmentModel = { file: 'selfie_segmenter.tflite', channel: 0, feather: 2 }
