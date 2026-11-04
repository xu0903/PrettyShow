// 內建濾鏡清單。LUT 檔放在 public/luts/，由 scripts/gen-luts.mjs 產生。
// 要加入網路上找到的 .cube 濾鏡：把檔案放進 public/luts/，在這裡加一行，file 寫 'xxx.cube'。

export interface FilterPreset {
  id: string
  name: string
  file: string
}

export const FILTERS: FilterPreset[] = [
  { id: 'warm', name: '暖陽', file: 'warm.png' },
  { id: 'cool', name: '冷調', file: 'cool.png' },
  { id: 'film', name: '底片', file: 'film.png' },
  { id: 'japan', name: '日系', file: 'japan.png' },
  { id: 'fade', name: '褪色', file: 'fade.png' },
  { id: 'cinema', name: '電影', file: 'cinema.png' },
  { id: 'vintage', name: '復古', file: 'vintage.png' },
  { id: 'mono', name: '黑白', file: 'mono.png' },
]

export function findFilter(id: string | null): FilterPreset | undefined {
  return FILTERS.find((f) => f.id === id)
}
