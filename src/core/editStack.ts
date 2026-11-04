// 編輯堆疊（非破壞性編輯）：
// 每一筆紀錄是「所有工具的參數」快照，渲染時永遠從原圖重新算，所以不會累積畫質損失。
// 復原／重做只是在快照之間移動。純函式，方便測試。

/** 工具 id → 該工具的參數。沒出現的工具代表使用預設值 */
export type EditState = Readonly<Record<string, unknown>>

export interface History {
  past: EditState[]
  present: EditState
  future: EditState[]
}

/** 最多保留幾步復原 */
export const MAX_UNDO = 100

export const EMPTY_STATE: EditState = Object.freeze({})

export function createHistory(present: EditState = EMPTY_STATE): History {
  return { past: [], present, future: [] }
}

function sameState(a: EditState, b: EditState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 寫入新的一筆；內容沒有變就不記錄（例如滑桿拖了又拖回原位） */
export function commit(h: History, next: EditState): History {
  if (sameState(h.present, next)) return h
  const past = [...h.past, h.present]
  if (past.length > MAX_UNDO) past.shift()
  return { past, present: next, future: [] }
}

export function undo(h: History): History {
  if (h.past.length === 0) return h
  const present = h.past[h.past.length - 1]
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] }
}

export function redo(h: History): History {
  if (h.future.length === 0) return h
  const [present, ...future] = h.future
  return { past: [...h.past, h.present], present, future }
}

/** 設定某個工具的參數，回傳新的狀態（不修改原本的） */
export function withToolParams(state: EditState, toolId: string, params: unknown): EditState {
  return { ...state, [toolId]: params }
}

/** 檢查從儲存空間讀回來的資料格式對不對 */
export function isHistory(v: unknown): v is History {
  if (!v || typeof v !== 'object') return false
  const h = v as History
  return Array.isArray(h.past) && Array.isArray(h.future) && !!h.present && typeof h.present === 'object'
}
