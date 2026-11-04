// LUT 的快取：每款濾鏡只下載、解析一次

import { fetchLut, type Lut } from './lut.ts'
import { findFilter } from './presets.ts'

const loaded = new Map<string, Lut>()
const loading = new Map<string, Promise<Lut>>()

/** 已經載入的 LUT（同步取得，給 steps 用） */
export function getLoadedLut(id: string): Lut | undefined {
  return loaded.get(id)
}

export function loadLut(id: string): Promise<Lut> {
  const ready = loaded.get(id)
  if (ready) return Promise.resolve(ready)
  let p = loading.get(id)
  if (!p) {
    const preset = findFilter(id)
    if (!preset) return Promise.reject(new Error(`沒有這款濾鏡：${id}`))
    p = fetchLut(`${import.meta.env.BASE_URL}luts/${preset.file}`)
      .then((lut) => {
        loaded.set(id, lut)
        return lut
      })
      .finally(() => loading.delete(id))
    loading.set(id, p)
  }
  return p
}
