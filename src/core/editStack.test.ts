import { describe, expect, it } from 'vitest'
import { commit, createHistory, isHistory, MAX_UNDO, redo, undo, withToolParams } from './editStack.ts'

describe('editStack', () => {
  it('commit 之後可以復原、重做', () => {
    let h = createHistory()
    h = commit(h, withToolParams(h.present, 'adjust', { brightness: 10 }))
    h = commit(h, withToolParams(h.present, 'adjust', { brightness: 20 }))
    expect(h.present).toEqual({ adjust: { brightness: 20 } })

    h = undo(h)
    expect(h.present).toEqual({ adjust: { brightness: 10 } })
    h = undo(h)
    expect(h.present).toEqual({})
    // 已經到底，再復原不會變
    expect(undo(h)).toBe(h)

    h = redo(h)
    h = redo(h)
    expect(h.present).toEqual({ adjust: { brightness: 20 } })
    expect(redo(h)).toBe(h)
  })

  it('復原後再修改，重做紀錄會被清掉', () => {
    let h = createHistory()
    h = commit(h, { a: 1 })
    h = commit(h, { a: 2 })
    h = undo(h)
    h = commit(h, { a: 3 })
    expect(h.future).toEqual([])
    expect(h.past).toEqual([{}, { a: 1 }])
  })

  it('內容沒變就不記錄', () => {
    const h = commit(createHistory(), { a: 1 })
    expect(commit(h, { a: 1 })).toBe(h)
  })

  it(`最多保留 ${MAX_UNDO} 步`, () => {
    let h = createHistory()
    for (let i = 1; i <= MAX_UNDO + 20; i++) h = commit(h, { a: i })
    expect(h.past.length).toBe(MAX_UNDO)
    expect(h.past[0]).toEqual({ a: 20 })
  })

  it('不修改原本的物件', () => {
    const h0 = createHistory()
    const h1 = commit(h0, { a: 1 })
    expect(h0.present).toEqual({})
    expect(h0.past).toEqual([])
    undo(h1)
    expect(h1.present).toEqual({ a: 1 })
  })

  it('isHistory 驗證儲存的格式', () => {
    expect(isHistory(commit(createHistory(), { a: 1 }))).toBe(true)
    expect(isHistory(null)).toBe(false)
    expect(isHistory({ past: [], future: [] })).toBe(false)
  })
})
