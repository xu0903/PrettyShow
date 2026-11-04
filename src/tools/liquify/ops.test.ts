import { describe, expect, it } from 'vitest'
import { strokesToOps } from './ops.ts'

describe('strokesToOps', () => {
  it('只點一下不推', () => {
    expect(strokesToOps([{ pts: [0.5, 0.5], r: 0.05 }], 1000, 1000)).toEqual([])
  })

  it('往右拖：每一段都往右推，總推移量等於拖的距離', () => {
    const ops = strokesToOps([{ pts: [0.2, 0.5, 0.4, 0.5], r: 0.03 }], 1000, 1000)
    expect(ops.length).toBeGreaterThan(5)
    let total = 0
    for (const op of ops) {
      if (op.kind !== 'move') throw new Error('應該是推移')
      expect(op.dx).toBeGreaterThan(0)
      expect(op.dy).toBe(0)
      total += op.dx
    }
    // 最後不足一段的部分不推，所以略小於 0.2
    expect(total).toBeGreaterThan(0.18)
    expect(total).toBeLessThanOrEqual(0.2 + 1e-9)
  })

  it('力度 0.3：推的量是三成', () => {
    const full = strokesToOps([{ pts: [0.2, 0.5, 0.4, 0.5], r: 0.03 }], 1000, 1000)
    const soft = strokesToOps([{ pts: [0.2, 0.5, 0.4, 0.5], r: 0.03, strength: 0.3 }], 1000, 1000)
    const sum = (ops: typeof full) => ops.reduce((t, o) => t + (o.kind === 'move' ? o.dx : 0), 0)
    expect(sum(soft)).toBeCloseTo(sum(full) * 0.3, 6)
  })
})
