import { describe, expect, it } from 'vitest'
import { buildPasses, prepareTools } from './pipeline.ts'
import type { AnyTool } from './registry.ts'

// 測試用的假工具：參數是數字，0 代表預設值
function fakeTool(id: string, orders: number[]): AnyTool {
  return {
    id,
    label: id,
    icon: null,
    placement: {},
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

describe('viewParams / prepareTools', () => {
  it('面板打開的工具改用 viewParams 顯示', () => {
    const crop = { ...fakeTool('crop', [100]), viewParams: () => 0 }
    expect(buildPasses({ crop: 5 }, [crop], ctx).length).toBe(1)
    // 面板打開時用 viewParams（回傳預設值 0）→ 被略過
    expect(buildPasses({ crop: 5 }, [crop], ctx, { activeToolId: 'crop' })).toEqual([])
  })

  it('只準備有用到的工具', async () => {
    const prepared: string[] = []
    const make = (id: string) => ({ ...fakeTool(id, [300]), prepare: async () => void prepared.push(id) })
    await prepareTools({ a: 1 }, [make('a'), make('b')])
    expect(prepared).toEqual(['a'])
  })
})
