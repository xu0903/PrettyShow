import { describe, expect, it } from 'vitest'
import { fitWithin, IOS_MAX_CANVAS_PIXELS } from './limits.ts'

describe('fitWithin', () => {
  it('小圖不放大', () => {
    expect(fitWithin({ width: 1000, height: 800 }, { maxPixels: IOS_MAX_CANVAS_PIXELS })).toEqual({
      width: 1000,
      height: 800,
      scale: 1,
    })
  })

  it('iPhone 4800 萬像素原圖會縮到 iOS canvas 上限內', () => {
    const r = fitWithin({ width: 8064, height: 6048 }, { maxPixels: IOS_MAX_CANVAS_PIXELS })
    expect(r.width * r.height).toBeLessThanOrEqual(IOS_MAX_CANVAS_PIXELS)
    // 長寬比維持不變（誤差在 1px 內）
    expect(Math.abs(r.width / r.height - 8064 / 6048)).toBeLessThan(0.001)
    // 不要縮得太多：至少用到上限的 99.9%
    expect(r.width * r.height).toBeGreaterThan(IOS_MAX_CANVAS_PIXELS * 0.999)
  })

  it('同時受長邊上限限制', () => {
    const r = fitWithin({ width: 12000, height: 1000 }, { maxPixels: IOS_MAX_CANVAS_PIXELS, maxSide: 8192 })
    expect(r.width).toBe(8192)
    expect(r.height).toBe(682)
  })

  it('預覽圖長邊上限', () => {
    const r = fitWithin({ width: 3024, height: 4032 }, { maxSide: 2048 })
    expect(r.height).toBe(2048)
    expect(r.width).toBe(1536)
  })
})
