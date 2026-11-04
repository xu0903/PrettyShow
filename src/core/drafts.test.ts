import { describe, expect, it } from 'vitest'
import { pruneMeta, upsertMeta, type DraftMeta } from './drafts.ts'

const d = (id: string, updatedAt: number): DraftMeta => ({ id, name: id, mode: 'beautify', createdAt: 0, updatedAt })

describe('upsertMeta', () => {
  it('新的一筆排在最前面', () => {
    expect(upsertMeta([d('a', 1)], d('b', 2)).map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('同一個 id 會取代舊的，不會重複', () => {
    const list = upsertMeta([d('a', 1), d('b', 2)], { ...d('a', 3), name: 'new' })
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
    expect(list[0].name).toBe('new')
  })
})

describe('pruneMeta', () => {
  it('超過上限時刪掉最後面（最舊）的', () => {
    const { keep, drop } = pruneMeta([d('c', 3), d('b', 2), d('a', 1)], 2)
    expect(keep.map((x) => x.id)).toEqual(['c', 'b'])
    expect(drop.map((x) => x.id)).toEqual(['a'])
  })
})
