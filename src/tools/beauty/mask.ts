// 皮膚遮罩：用臉部特徵點畫出臉的範圍，挖掉眼睛、眉毛、嘴唇，再把邊緣模糊，
// 讓磨皮只作用在皮膚上，也不會在臉的邊緣出現明顯的界線。

import { boxBlur, canvasToMask } from '../../image/raster.ts'
import { BROW_A, BROW_B, CHEEK_A, CHEEK_B, EYE_A, EYE_B, FACE_OVAL, LIPS } from './landmarks.ts'

/** 正規化座標（0..1，原點左上） */
export interface Point {
  x: number
  y: number
}

/** 遮罩的長邊（px）。遮罩本身很柔和，不需要高解析度 */
export const MASK_MAX_SIDE = 512

/** 臉寬（以 0..1 的寬度比例表示） */
export function faceWidth(face: readonly Point[]): number {
  const a = face[CHEEK_A]
  const b = face[CHEEK_B]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 依照片比例決定遮罩尺寸 */
export function maskSize(imageWidth: number, imageHeight: number): { width: number; height: number } {
  const s = Math.min(1, MASK_MAX_SIDE / Math.max(imageWidth, imageHeight))
  return { width: Math.max(1, Math.round(imageWidth * s)), height: Math.max(1, Math.round(imageHeight * s)) }
}

/** 畫出所有臉的皮膚遮罩；回傳 R8 資料（第一列是最下面） */
export function buildSkinMask(faces: readonly (readonly Point[])[], width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.lineJoin = 'round'

  const path = (face: readonly Point[], ring: readonly number[]) => {
    ctx.beginPath()
    ring.forEach((i, k) => {
      const p = face[i]
      if (k === 0) ctx.moveTo(p.x * width, p.y * height)
      else ctx.lineTo(p.x * width, p.y * height)
    })
    ctx.closePath()
  }

  let maxFace = 0
  for (const face of faces) {
    const fw = faceWidth(face) * width
    maxFace = Math.max(maxFace, fw)
    // 臉：往內縮一點，模糊之後邊緣才不會吃到背景或頭髮
    ctx.fillStyle = '#fff'
    path(face, FACE_OVAL)
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = fw * 0.06
    ctx.stroke()

    // 挖掉五官：外擴一些，睫毛、眉毛邊緣、唇線才會保持清楚
    ctx.fillStyle = '#000'
    for (const [ring, grow] of [
      [EYE_A, 0.07],
      [EYE_B, 0.07],
      [BROW_A, 0.05],
      [BROW_B, 0.05],
      [LIPS, 0.04],
    ] as const) {
      path(face, ring)
      ctx.fill()
      ctx.lineWidth = fw * grow
      ctx.stroke()
    }
  }

  const { data } = ctx.getImageData(0, 0, width, height)
  canvas.width = 0
  canvas.height = 0
  const mask = canvasToMask(data, width, height)
  // 羽化半徑跟著臉的大小
  const r = maxFace * 0.035
  for (let i = 0; i < 3; i++) boxBlur(mask, width, height, r)
  return mask
}
