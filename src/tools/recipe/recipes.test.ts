import { describe, expect, it } from 'vitest'
import { patchFor, pick, type Recipe } from './recipes.ts'

describe('pick', () => {
  it('只存這個編輯器的工具，手動筆跡不存', () => {
    const state = { adjust: { a: 1 }, crop: { c: 1 }, beauty: { smooth: 30, manual: [{ pts: [0, 0], r: 1 }] } }
    expect(pick(state, 'beautify')).toEqual({ adjust: { a: 1 } })
    expect(pick(state, 'portrait')).toEqual({ beauty: { smooth: 30, manual: [] } })
  })
})

describe('patchFor', () => {
  const recipe: Recipe = { id: 'x', name: 'x', mode: 'portrait', state: { beauty: { smooth: 50, manual: [] } } }

  it('配方沒有的工具會被清成預設（undefined）', () => {
    const patch = patchFor(recipe, {})
    expect(patch.makeup).toBeUndefined()
    expect('makeup' in patch).toBe(true)
  })

  it('保留這張照片自己的手動筆跡', () => {
    const strokes = [{ pts: [0.1, 0.1], r: 0.02 }]
    const patch = patchFor(recipe, { beauty: { smooth: 0, manual: strokes } })
    expect(patch.beauty).toEqual({ smooth: 50, manual: strokes })
  })
})
