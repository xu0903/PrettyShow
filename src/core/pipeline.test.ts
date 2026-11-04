import { describe, expect, it } from 'vitest'
import { buildPasses } from './pipeline.ts'
import type { AnyTool } from './registry.ts'

// 測試用的假工具：參數是數字，0 代表預設值
function fakeTool(id: string, orders: number[]): AnyTool {
  return {
    id,
    label: id,
    icon: null,
    tabOrder: 0,
    defaultParams: 0,
    isIdentity: (p) => p === 0,
    steps: (p) => orders.map((order) => ({ order, pass: { id: `${id}@${order}:${String(p)}`, fragment: '' } })),
    Panel: () => null,
  }
}

const ctx = { pixelScale: 1 }

describe('buildPasses', () => {
  it('預設值的工具會被略過', () => {
    expect(buildPasses({}, [fakeTool('a', [200])], ctx)).toEqual([])
  })

  it('依 order 排序，不同工具的步驟可以交錯', () => {
    const tools = [fakeTool('adjust', [200, 400]), fakeTool('filter', [300]), fakeTool('crop', [100])]
    const ids = buildPasses({ adjust: 1, filter: 2, crop: 3 }, tools, ctx).map((p) => p.id)
    expect(ids).toEqual(['crop@100:3', 'adjust@200:1', 'filter@300:2', 'adjust@400:1'])
  })
})
