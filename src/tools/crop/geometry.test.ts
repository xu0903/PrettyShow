import { describe, expect, it } from 'vitest'
import {
  croppedSize,
  croppedToSource,
  DEFAULT_CROP,
  displayToSource,
  fitAspect,
  flipHorizontal,
  isIdentityCrop,
  moveRect,
  resizeRect,
  rotateLeft,
  setAspect,
  type CropParams,
} from './geometry.ts'

const size = { width: 4000, height: 3000 } // 橫拍
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6))

describe('旋轉與翻轉', () => {
  it('往左轉一次：寬高互換，左上角變成左下角', () => {
    const p = rotateLeft(DEFAULT_CROP, size)
    expect(p.quarter).toBe(3)
    expect(croppedSize(size, p)).toEqual({ width: 3000, height: 4000 })
    // 往左轉後，畫面左下角是原圖的左上角
    close(displayToSource(0, 1, p), [0, 0])
    // 畫面右上角是原圖的右下角
    close(displayToSource(1, 0, p), [1, 1])
  })

  it('轉四次回到原樣', () => {
    let p = DEFAULT_CROP
    for (let i = 0; i < 4; i++) p = rotateLeft(p, size)
    expect(isIdentityCrop(p)).toBe(true)
  })

  it('水平翻轉是畫面上的左右翻轉，轉過之後也一樣', () => {
    const p = flipHorizontal(rotateLeft(DEFAULT_CROP, size))
    // 先轉再翻：畫面右下角 = 原圖左上角
    close(displayToSource(1, 1, p), [0, 0])
  })

  it('翻轉後再轉，畫面跟「看到的東西直接轉 90°」一致', () => {
    const flipped = flipHorizontal(DEFAULT_CROP)
    const p = rotateLeft(flipped, size)
    // 翻轉後的畫面中，左上角是原圖右上角 (1,0)；往左轉後它會到左下角
    close(displayToSource(0, 1, p), [1, 0])
  })

  it('自由比例的裁切框跟著照片一起轉', () => {
    const p: CropParams = { ...DEFAULT_CROP, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }
    const r = rotateLeft(p, size).rect
    close([r.x, r.y, r.w, r.h], [0.2, 0.6, 0.4, 0.3])
    // 裁切框的左上角在原圖的位置不變（往左轉後變成左下角）
    const before = displayToSource(0.1, 0.2, p)
    const after = displayToSource(r.x, r.y + r.h, rotateLeft(p, size))
    close(after, before)
  })
})

describe('croppedToSource', () => {
  it('裁切後畫面的左上角 = 裁切框的左上角', () => {
    const p: CropParams = { ...DEFAULT_CROP, rect: { x: 0.2, y: 0.1, w: 0.5, h: 0.5 } }
    const s = croppedToSource(p, { x: 0, y: 0 })
    close([s.x, s.y], [0.2, 0.1])
  })
  it('往左轉之後，畫面左下角是原圖左上角', () => {
    const p = rotateLeft(DEFAULT_CROP, size)
    const s = croppedToSource(p, { x: 0, y: 1 })
    close([s.x, s.y], [0, 0])
  })
})

describe('比例', () => {
  it('1:1 在橫拍照片上：高度填滿、寬度置中', () => {
    const r = fitAspect(1, size)
    close([r.x, r.y, r.w, r.h], [0.125, 0, 0.75, 1])
  })

  it('9:16 的裁切結果像素比例正確', () => {
    const p = setAspect(DEFAULT_CROP, '9:16', size)
    const out = croppedSize(size, p)
    expect(out.width / out.height).toBeCloseTo(9 / 16, 2)
  })

  it('IG 橫式 1.91:1 的裁切結果像素比例正確', () => {
    const p = setAspect(DEFAULT_CROP, '1.91:1', size)
    const out = croppedSize(size, p)
    expect(out.width / out.height).toBeCloseTo(1.91, 2)
    expect(p.rect.w).toBeCloseTo(1, 6) // 橫拍照片：寬度填滿
  })

  it('原始比例在轉過的照片上用轉過後的比例', () => {
    const p = setAspect(rotateLeft(DEFAULT_CROP, size), 'original', size)
    expect(p.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

describe('拖動裁切框', () => {
  it('移動不會超出照片', () => {
    const r = moveRect({ x: 0.5, y: 0.5, w: 0.4, h: 0.4 }, 0.5, -1)
    close([r.x, r.y], [0.6, 0])
  })

  it('自由比例拖右下角', () => {
    const r = resizeRect({ x: 0, y: 0, w: 0.5, h: 0.5 }, 'se', 0.1, 0.2, null, size)
    close([r.x, r.y, r.w, r.h], [0, 0, 0.6, 0.7])
  })

  it('固定比例拖角落：維持比例，以對角為錨點', () => {
    const start = setAspect(DEFAULT_CROP, '1:1', size).rect
    const r = resizeRect(start, 'nw', 0.1, 0.05, 1, size)
    // 像素比例仍是 1:1
    expect((r.w * size.width) / (r.h * size.height)).toBeCloseTo(1, 6)
    // 右下角不動
    close([r.x + r.w, r.y + r.h], [start.x + start.w, start.y + start.h])
  })

  it('固定比例不會拉出照片外', () => {
    const r = resizeRect({ x: 0.1, y: 0.1, w: 0.3, h: 0.4 }, 'se', 5, 5, 1, size)
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9)
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9)
    expect((r.w * size.width) / (r.h * size.height)).toBeCloseTo(1, 6)
  })

  it('不能縮到比最小尺寸還小', () => {
    const r = resizeRect({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, 'se', -1, -1, null, size)
    expect(r.w).toBeCloseTo(0.05, 6)
    expect(r.h).toBeCloseTo(0.05, 6)
  })
})
