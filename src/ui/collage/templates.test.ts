import { describe, expect, it } from 'vitest'
import { coverCrop, grid, MAX_PHOTOS, templatesFor } from './templates.ts'

describe('templatesFor', () => {
  it('每個張數的每個版型，格子數都等於張數，而且剛好鋪滿整個畫面', () => {
    for (let n = 1; n <= MAX_PHOTOS; n++) {
      for (const t of templatesFor(n)) {
        expect(t).toHaveLength(n)
        const area = t.reduce((s, c) => s + c.w * c.h, 0)
        expect(area).toBeCloseTo(1, 6)
      }
    }
  })
})

describe('grid', () => {
  it('2×2 的第四格在右下', () => {
    expect(grid(2, 2)[3]).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 })
  })
})

describe('coverCrop', () => {
  it('橫的照片放進正方形格子：裁掉左右、置中', () => {
    const c = coverCrop({ width: 400, height: 200 }, { w: 100, h: 100 }, 1, 0, 0)
    expect(c).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 })
  })

  it('放大 2 倍：裁的範圍變一半', () => {
    const c = coverCrop({ width: 400, height: 200 }, { w: 100, h: 100 }, 2, 0, 0)
    expect(c.sw).toBe(100)
    expect(c.sx).toBe(150)
  })

  it('位移 -1 靠最左邊', () => {
    expect(coverCrop({ width: 400, height: 200 }, { w: 100, h: 100 }, 1, -1, 0).sx).toBe(0)
  })
})
