import { describe, expect, it } from 'vitest'
import { DEFAULT_TALLER, stretchedSize, toAfter, toBefore } from './stretch.ts'

const p = { ...DEFAULT_TALLER, top: 0.5, bottom: 1, amount: 100 }

describe('增高', () => {
  it('只有那一段變長：下半段 1.35 倍，整張變 1.175 倍高', () => {
    expect(stretchedSize({ width: 100, height: 1000 }, p)).toEqual({ width: 100, height: 1175 })
  })

  it('上面不受影響、最下面還是最下面', () => {
    expect(toBefore(0, p)).toBeCloseTo(0, 6)
    expect(toBefore(1, p)).toBeCloseTo(1, 6)
    // 拉長後 0.5/1.175 的位置 = 原本 0.5（拉長那一段的開頭）
    expect(toBefore(0.5 / 1.175, p)).toBeCloseTo(0.5, 6)
  })

  it('toAfter 和 toBefore 互為反函數', () => {
    for (const y of [0.1, 0.5, 0.62, 0.9, 1]) expect(toBefore(toAfter(y, p), p)).toBeCloseTo(y, 6)
  })
})
