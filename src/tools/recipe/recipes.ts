// 配方：一組可以套到別張照片的修圖設定（調色、濾鏡、美顏數值…）。
// 只存「跟照片內容無關」的設定：裁切框、筆刷、文字、貼紙這些跟位置有關的不存。
// 自己存的配方放在 localStorage（很小，不用 IndexedDB）。

import type { EditState } from '../../core/editStack.ts'
import type { EditorMode } from '../../core/tool.ts'

export interface Recipe {
  id: string
  name: string
  mode: EditorMode
  /** 工具 id → 參數 */
  state: Record<string, unknown>
  /** 內建的配方不能刪 */
  builtin?: boolean
}

/** 每個編輯器的配方會存哪些工具 */
export const RECIPE_TOOLS: Record<EditorMode, string[]> = {
  beautify: ['auto', 'adjust', 'filter', 'frame'],
  portrait: ['beauty', 'reshape', 'eyes', 'teeth', 'makeup', 'hair'],
}

/** 和位置有關、不能套到別張照片的部分 */
function strip(toolId: string, params: unknown): unknown {
  if (toolId === 'beauty' && params && typeof params === 'object') return { ...params, manual: [] }
  return params
}

/** 從目前的編輯狀態取出要存進配方的部分 */
export function pick(state: EditState, mode: EditorMode): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const id of RECIPE_TOOLS[mode]) if (state[id] !== undefined) out[id] = strip(id, state[id])
  return out
}

/** 要寫進編輯狀態的內容：配方沒有設定的工具恢復預設（清掉），才會和存的時候一模一樣 */
export function patchFor(recipe: Recipe, current: EditState): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const id of RECIPE_TOOLS[recipe.mode]) {
    const v = recipe.state[id]
    // 手動磨皮的筆跡留著（那是這張照片自己的）
    if (id === 'beauty' && v && typeof v === 'object') {
      const manual = (current.beauty as { manual?: unknown } | undefined)?.manual
      patch[id] = { ...v, manual: manual ?? [] }
    } else {
      patch[id] = v
    }
  }
  return patch
}

const KEY = 'prettyshow.recipes'

export function loadRecipes(): Recipe[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? (v as Recipe[]) : []
  } catch {
    return []
  }
}

export function saveRecipes(list: Recipe[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((r) => !r.builtin)))
  } catch {
    // 存不了就算了，只是下次打開不見
  }
}

const builtin = (id: string, name: string, mode: EditorMode, state: Record<string, unknown>): Recipe => ({
  id,
  name,
  mode,
  state,
  builtin: true,
})

const adjust = (o: Record<string, number>) => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  vignette: 0,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  grain: 0,
  ...o,
})

/** 內建配方 */
export const BUILTIN: Recipe[] = [
  builtin('b-kdaily', '韓系日常', 'beautify', {
    filter: { lut: 'kmilk', intensity: 70 },
    adjust: adjust({ brightness: 8, vibrance: 12, highlights: -10 }),
  }),
  builtin('b-jfilm', '日系底片', 'beautify', {
    filter: { lut: 'fuji', intensity: 80 },
    adjust: adjust({ fade: 18, grain: 30, vignette: 15 }),
  }),
  builtin('b-clear', '清透感', 'beautify', {
    filter: { lut: 'clear', intensity: 75 },
    adjust: adjust({ highlights: -15, shadows: 15, vibrance: 10 }),
  }),
  builtin('b-polaroid', '復古拍立得', 'beautify', {
    filter: { lut: 'polaroid', intensity: 85 },
    adjust: adjust({ grain: 25 }),
    frame: { style: 'polaroid', color: '#ffffff', width: 40, ratio: 'keep' },
  }),
  builtin('p-natural', '自然好氣色', 'portrait', {
    beauty: { smooth: 35, whiten: 15, manual: [] },
    eyes: { bright: 20, dark: 30 },
    makeup: { lip: 50, lipColor: '#c97b7e', lipBlur: true, blush: 30, blushColor: '#f4a38c', brow: 0, browColor: '#6b5442', shadow: 0, shadowColor: '#e3b5a4' },
  }),
  builtin('p-idol', '韓系偶像', 'portrait', {
    beauty: { smooth: 50, whiten: 25, manual: [] },
    reshape: { slim: 25, eyes: 20, nose: 10, chin: 0, forehead: 0, mouth: 0 },
    eyes: { bright: 30, dark: 40 },
    makeup: { lip: 75, lipColor: '#c8404f', lipBlur: true, blush: 40, blushColor: '#e8949f', brow: 25, browColor: '#6b5442', shadow: 30, shadowColor: '#d4a0a8' },
  }),
]
