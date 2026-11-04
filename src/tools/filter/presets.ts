// 內建濾鏡清單。LUT 檔放在 public/luts/，由 scripts/gen-luts.mjs 產生。
// 要加入網路上找到的 .cube 濾鏡：把檔案放進 public/luts/，在這裡加一行，file 寫 'xxx.cube'。

export type FilterGroup = 'korean' | 'retro' | 'fresh' | 'classic'

export const GROUPS: { id: FilterGroup; label: string }[] = [
  { id: 'korean', label: '韓系' },
  { id: 'retro', label: '日系復古' },
  { id: 'fresh', label: '清新' },
  { id: 'classic', label: '經典' },
]

export interface FilterPreset {
  id: string
  name: string
  file: string
  group: FilterGroup
}

const png = (id: string, name: string, group: FilterGroup): FilterPreset => ({ id, name, file: id + '.png', group })

export const FILTERS: FilterPreset[] = [
  png('kmilk', '奶油白', 'korean'),
  png('kpeach', '蜜桃', 'korean'),
  png('kcafe', '咖啡廳', 'korean'),
  png('ksky', '天空藍', 'korean'),
  png('kfilm', '韓系膠片', 'korean'),
  png('fuji', '富士底片', 'retro'),
  png('kodak', '柯達金', 'retro'),
  png('showa', '昭和', 'retro'),
  png('polaroid', '拍立得', 'retro'),
  png('summer', '夏日', 'retro'),
  png('clear', '透明感', 'fresh'),
  png('mint', '薄荷', 'fresh'),
  png('morning', '晨光', 'fresh'),
  png('ice', '冰透', 'fresh'),
  png('forest', '森系', 'fresh'),
  png('warm', '暖陽', 'classic'),
  png('cool', '冷調', 'classic'),
  png('film', '底片', 'classic'),
  png('japan', '日系', 'classic'),
  png('fade', '褪色', 'classic'),
  png('cinema', '電影', 'classic'),
  png('vintage', '復古', 'classic'),
  png('mono', '黑白', 'classic'),
]

export function findFilter(id: string | null): FilterPreset | undefined {
  return FILTERS.find((f) => f.id === id)
}
