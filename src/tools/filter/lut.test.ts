import { describe, expect, it } from 'vitest'
import { lutFromStrip, parseCube, stripPixelToIndex } from './lut.ts'

describe('parseCube', () => {
  it('解析 2×2×2 的 identity LUT（r 最快）', () => {
    const text = `# 註解
TITLE "identity"
LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`
    const lut = parseCube(text)
    expect(lut.size).toBe(2)
    // 第 1 筆（r=1,g=0,b=0）
    expect([...lut.data.slice(4, 8)]).toEqual([255, 0, 0, 255])
    // 最後一筆白色
    expect([...lut.data.slice(28, 32)]).toEqual([255, 255, 255, 255])
  })

  it('套用 DOMAIN_MIN / DOMAIN_MAX', () => {
    const rows = Array.from({ length: 8 }, () => '0 5 10').join('\n')
    const lut = parseCube(`LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 10 10 10\n${rows}`)
    expect([...lut.data.slice(0, 4)]).toEqual([0, 128, 255, 255])
  })

  it('資料行數不對會報錯', () => {
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0')).toThrow()
  })
})

describe('PNG 長條 LUT', () => {
  it('像素位置對應：x = b×size + r, y = g', () => {
    expect(stripPixelToIndex(0, 0, 4)).toBe(0)
    expect(stripPixelToIndex(1, 0, 4)).toBe(1) // r=1
    expect(stripPixelToIndex(0, 1, 4)).toBe(4) // g=1
    expect(stripPixelToIndex(4, 0, 4)).toBe(16) // b=1
    expect(stripPixelToIndex(15, 3, 4)).toBe(63)
  })

  it('尺寸不對會報錯（包含 0×0）', () => {
    expect(() => lutFromStrip(new Uint8ClampedArray(0), 0, 0)).toThrow()
    expect(() => lutFromStrip(new Uint8ClampedArray(10 * 3 * 4), 10, 3)).toThrow()
  })

  it('identity 長條圖轉回來仍是 identity', () => {
    const size = 3
    const w = size * size
    const px = new Uint8ClampedArray(w * size * 4)
    const v = (i: number) => Math.round((i / (size - 1)) * 255)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < w; x++) px.set([v(x % size), v(y), v(Math.floor(x / size)), 255], (y * w + x) * 4)

    const lut = lutFromStrip(px, w, size)
    for (let b = 0; b < size; b++)
      for (let g = 0; g < size; g++)
        for (let r = 0; r < size; r++) {
          const i = (r + g * size + b * size * size) * 4
          expect([...lut.data.slice(i, i + 3)]).toEqual([v(r), v(g), v(b)])
        }
  })
})
