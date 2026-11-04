import { describe, expect, it } from 'vitest'
import type { Point } from '../../core/tool.ts'
import { DEFAULT_RESHAPE, faceOps } from './ops.ts'

/** 假的臉：所有點都在中間，只把會用到的點放到合理的位置（正面、直立） */
function fakeFace(): Point[] {
  const f: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  f[10] = { x: 0.5, y: 0.2 } // 額頭
  f[152] = { x: 0.5, y: 0.8 } // 下巴
  f[234] = { x: 0.3, y: 0.5 }
  f[454] = { x: 0.7, y: 0.5 }
  for (const i of [132, 58, 172, 136, 150]) f[i] = { x: 0.33, y: 0.65 }
  for (const i of [361, 288, 397, 365, 379]) f[i] = { x: 0.67, y: 0.65 }
  return f
}

describe('faceOps', () => {
  it('全部是 0 就沒有變形', () => {
    expect(faceOps(fakeFace(), 1000, 1000, DEFAULT_RESHAPE)).toEqual([])
  })

  it('瘦臉：兩側輪廓都往臉的中間推', () => {
    const ops = faceOps(fakeFace(), 1000, 1000, { ...DEFAULT_RESHAPE, slim: 100 })
    expect(ops).toHaveLength(10)
    for (const op of ops) {
      if (op.kind !== 'move') throw new Error('應該是推移')
      // 左邊的點往右推、右邊的點往左推；上下方向不動
      expect(Math.sign(op.dx)).toBe(op.x < 0.5 ? 1 : -1)
      expect(op.dy).toBeCloseTo(0, 6)
    }
  })

  it('下巴：正值往下拉、負值往上收', () => {
    const longer = faceOps(fakeFace(), 1000, 1000, { ...DEFAULT_RESHAPE, chin: 50 })[0]
    const shorter = faceOps(fakeFace(), 1000, 1000, { ...DEFAULT_RESHAPE, chin: -50 })[0]
    if (longer.kind !== 'move' || shorter.kind !== 'move') throw new Error('應該是推移')
    expect(longer.dy).toBeGreaterThan(0)
    expect(shorter.dy).toBeLessThan(0)
  })

  it('大眼：兩隻眼睛各一個放大', () => {
    const ops = faceOps(fakeFace(), 1000, 1000, { ...DEFAULT_RESHAPE, eyes: 50 })
    expect(ops.map((o) => o.kind)).toEqual(['scale', 'scale'])
  })
})
