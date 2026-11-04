import { describe, expect, it } from 'vitest'
import { autoUniforms, computeStats } from './stats.ts'

/** n 個同樣顏色的像素 */
function fill(n: number, rgb: [number, number, number]): number[] {
  return Array.from({ length: n }, () => [...rgb, 255]).flat()
}

describe('computeStats', () => {
  it('找出黑點、白點', () => {
    const px = Uint8ClampedArray.from([...fill(500, [40, 40, 40]), ...fill(500, [200, 200, 200])])
    const s = computeStats(px)
    expect(s.lumaLo).toBeCloseTo(40 / 255, 2)
    expect(s.lumaHi).toBeCloseTo(200 / 255, 2)
    // 拉開之後一半黑一半白，平均 0.5
    expect(s.mean).toBeCloseTo(0.5, 2)
  })
})

describe('autoUniforms', () => {
  it('偏暗的照片會被提亮（gamma < 1）', () => {
    const dark = computeStats(Uint8ClampedArray.from([...fill(900, [30, 30, 30]), ...fill(100, [120, 120, 120])]))
    expect(autoUniforms(dark, 'auto').u_gamma).toBeLessThan(1)
  })

  it('偏藍的照片：藍色版的白點比較高，修正後藍色會被壓下來', () => {
    const blue = computeStats(Uint8ClampedArray.from([...fill(500, [20, 20, 40]), ...fill(500, [180, 190, 240])]))
    const u = autoUniforms(blue, 'auto')
    expect(u.u_hi[2]).toBeGreaterThan(u.u_hi[0])
  })

  it('黑白點的幅度有上限', () => {
    const flat = computeStats(Uint8ClampedArray.from(fill(1000, [128, 128, 128])))
    const u = autoUniforms(flat, 'landscape')
    for (const v of u.u_lo) expect(v).toBeLessThanOrEqual(0.15)
    for (const v of u.u_hi) expect(v).toBeGreaterThanOrEqual(0.8)
  })
})
