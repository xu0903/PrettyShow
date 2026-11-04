import { describe, expect, it } from 'vitest'
import { boxBlur, canvasToMask, flipRowsRGBA } from './raster.ts'

describe('boxBlur', () => {
  it('均勻的圖模糊後不變', () => {
    const d = new Uint8Array(5 * 4).fill(200)
    boxBlur(d, 5, 4, 2)
    expect([...d].every((v) => v === 200)).toBe(true)
  })

  it('單一亮點會擴散、總亮度大致保留', () => {
    const w = 9
    const d = new Uint8Array(w * w)
    d[4 * w + 4] = 255
    boxBlur(d, w, w, 1)
    // 3×3 平均：255 / 9 ≈ 28
    expect(d[4 * w + 4]).toBe(28)
    expect(d[3 * w + 3]).toBe(28)
    expect(d[2 * w + 2]).toBe(0)
  })

  it('半徑 0 不做事', () => {
    const d = new Uint8Array([0, 255, 0])
    boxBlur(d, 3, 1, 0)
    expect([...d]).toEqual([0, 255, 0])
  })
})

describe('canvasToMask', () => {
  it('只取紅色通道，並且上下顛倒', () => {
    // 2×2：上排 (10, 20)，下排 (30, 40)
    const px = new Uint8ClampedArray([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255])
    expect([...canvasToMask(px, 2, 2)]).toEqual([30, 40, 10, 20])
  })

  it('可以指定通道（3 = 透明度）', () => {
    const px = new Uint8ClampedArray([1, 2, 3, 99])
    expect([...canvasToMask(px, 1, 1, 3)]).toEqual([99])
  })
})

describe('flipRowsRGBA', () => {
  it('整列上下對調', () => {
    const px = new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2])
    expect([...flipRowsRGBA(px, 1, 2)]).toEqual([2, 2, 2, 2, 1, 1, 1, 1])
  })
})
