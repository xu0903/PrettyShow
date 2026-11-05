import { describe, expect, it } from 'vitest'
import type { Point } from '../../core/tool.ts'
import { idCrop, printSheet } from './layout.ts'

function face(): Point[] {
  const f: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  f[10] = { x: 0.5, y: 0.3 }
  f[152] = { x: 0.5, y: 0.6 }
  f[234] = { x: 0.38, y: 0.45 }
  f[454] = { x: 0.62, y: 0.45 }
  return f
}

describe('idCrop', () => {
  it('二吋：比例 35:45，頭佔高度 76%，左右置中', () => {
    const r = idCrop(face(), 1000, 1000, 'two')
    expect((r.w * 1000) / (r.h * 1000)).toBeCloseTo(35 / 45, 5)
    // 頭 = 0.6 - (0.3 - 0.3 × 0.45) = 0.435
    expect(0.435 / r.h).toBeCloseTo(0.76, 5)
    expect(r.x + r.w / 2).toBeCloseTo(0.5, 6)
  })

  it('頭頂上面有留白', () => {
    const r = idCrop(face(), 1000, 1000, 'two')
    const crown = 0.3 - 0.3 * 0.45
    expect(crown).toBeGreaterThan(r.y)
  })
})

describe('printSheet', () => {
  it('4×6 吋 300dpi = 1800×1200，二吋可以排 8 張', () => {
    const s = printSheet('two')
    expect([s.width, s.height]).toEqual([1800, 1200])
    expect(s.cells).toHaveLength(8)
    // 每張都在紙裡面
    for (const c of s.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x + c.w).toBeLessThanOrEqual(1800)
    }
  })
})
