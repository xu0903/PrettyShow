// 頭髮分割：用 MediaPipe 的頭髮模型（約 0.8MB）找出頭髮的範圍，每張照片只做一次

import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import type { Texture2DSource } from '../../gl/pass.ts'
import { boxBlur } from '../../image/raster.ts'
import { VISION_FILESET } from '../beauty/faces.ts'
import { fitLong } from '../brush/strokes.ts'

const MODEL_URL = `${import.meta.env.BASE_URL}models/hair_segmenter.tflite`
/** 模型本身的輸入是 512×512，再大也沒有幫助 */
const INPUT_LONG = 512

let segmenter: Promise<ImageSegmenter> | null = null

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenter) {
    segmenter = (async () => {
      const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
      return ImageSegmenter.createFromOptions(VISION_FILESET, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    })()
    segmenter.catch(() => {
      segmenter = null
    })
  }
  return segmenter
}

export interface HairData {
  /** 頭髮遮罩；沒有頭髮時是 null */
  mask: Texture2DSource | null
}

const pending = new WeakMap<HTMLCanvasElement, Promise<HairData>>()
const ready = new WeakMap<HTMLCanvasElement, HairData>()
let nextId = 0

/** 頭髮佔畫面不到這個比例就當作沒有頭髮 */
const MIN_COVERAGE = 0.002

export function segmentHair(preview: HTMLCanvasElement): Promise<HairData> {
  let p = pending.get(preview)
  if (!p) {
    p = (async () => {
      const seg = await getSegmenter()
      const { width: w, height: h } = fitLong(preview.width, preview.height, INPUT_LONG)
      const small = document.createElement('canvas')
      small.width = w
      small.height = h
      small.getContext('2d')!.drawImage(preview, 0, 0, w, h)
      const result = seg.segment(small)
      small.width = small.height = 0
      // 信心遮罩：第 0 張是背景、第 1 張是頭髮
      const masks = result.confidenceMasks ?? []
      const hair = masks[1] ?? masks[0]
      const mw = hair.width
      const mh = hair.height
      const conf = hair.getAsFloat32Array()
      const data = new Uint8Array(mw * mh)
      let covered = 0
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++) {
          const v = conf[y * mw + x]
          if (v > 0.5) covered++
          // 上下翻轉成 GL 的方向
          data[(mh - 1 - y) * mw + x] = Math.round(Math.min(1, Math.max(0, v)) * 255)
        }
      masks.forEach((m) => m.close())
      // 邊緣稍微柔和，髮絲邊緣才不會有一圈硬邊
      boxBlur(data, mw, mh, 1)
      const out: HairData = {
        mask:
          covered / (mw * mh) < MIN_COVERAGE
            ? null
            : { kind: '2d', key: `hair#${nextId++}`, width: mw, height: mh, data },
      }
      ready.set(preview, out)
      return out
    })()
    pending.set(preview, p)
    p.catch(() => pending.delete(preview))
  }
  return p
}

export function getHair(preview: HTMLCanvasElement): HairData | undefined {
  return ready.get(preview)
}
