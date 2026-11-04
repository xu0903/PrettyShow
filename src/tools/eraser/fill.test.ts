import { describe, expect, it } from 'vitest'
import { estimateNoise, pushPull } from './fill.ts'

/** 建立 w×h 的灰階圖（rgb 都一樣） */
function gray(values: number[]): Float32Array {
  return Float32Array.from(values.flatMap((v) => [v, v, v]))
}

describe('estimateNoise', () => {
  it('平滑的圖噪點是 0，棋盤格很大', () => {
    const w = 8
    const flat = gray(new Array(w * w).fill(120))
    const checker = gray(Array.from({ length: w * w }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 200 : 40))
    const known = Float32Array.from(new Array(w * w).fill(1))
    expect(estimateNoise(flat, known, w, w)).toBe(0)
    expect(estimateNoise(checker, known, w, w)).toBeGreaterThan(0.1)
  })
})

describe('pushPull', () => {
  it('已知的像素不變', () => {
    const rgb = gray([10, 20, 30, 40])
    const out = pushPull(rgb, Float32Array.from([1, 1, 1, 1]), 2, 2)
    expect([...out].filter((_, i) => i % 3 === 0)).toEqual([10, 20, 30, 40])
  })

  it('四周都是同一個顏色時，中間補成那個顏色', () => {
    const w = 5
    const values = new Array(w * w).fill(100)
    const known = new Array(w * w).fill(1)
    values[12] = 0 // 中間是「髒東西」
    known[12] = 0
    const out = pushPull(gray(values), Float32Array.from(known), w, w)
    expect(out[12 * 3]).toBeCloseTo(100, 4)
  })

  it('左黑右白之間的洞，補出來介於兩者之間', () => {
    // 1×5：0, ?, ?, ?, 200
    const out = pushPull(gray([0, 0, 0, 0, 200]), Float32Array.from([1, 0, 0, 0, 1]), 5, 1)
    const mid = out[2 * 3]
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(200)
  })
})
