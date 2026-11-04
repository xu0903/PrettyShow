// 圖庫（草稿）：每張修過的照片都存成一份草稿，放在 IndexedDB，
// 可以從「圖庫」或首頁的「最近修過」打開，接著修。
// 照片（Blob）只在建立時存一次；編輯紀錄每次變動後延遲一下再存，避免拖滑桿時一直寫入。

import { del, get, set, update } from 'idb-keyval'
import { isHistory, type History } from './editStack.ts'
import type { EditorMode } from './tool.ts'

export interface DraftMeta {
  id: string
  name: string
  /** 上次是在哪個編輯器修的 */
  mode: EditorMode
  createdAt: number
  updatedAt: number
  /** 小縮圖（data URL），套用了所有編輯 */
  thumb?: string
}

interface SavedPhoto {
  file: Blob
  name: string
}

const LIST_KEY = 'prettyshow.drafts'
const photoKey = (id: string) => `prettyshow.draft.${id}.photo`
const historyKey = (id: string) => `prettyshow.draft.${id}.history`
/** 最多保留幾份草稿（每份都含原圖，iPhone 的儲存空間有限） */
export const MAX_DRAFTS = 24
const SAVE_DELAY_MS = 400

// 舊版（只保存一張照片）的位置，打開時搬進圖庫
const LEGACY_PHOTO_KEY = 'prettyshow.session.photo'
const LEGACY_HISTORY_KEY = 'prettyshow.session.history'

// ---- 清單操作（純函式，方便測試） ----

/** 新增或更新一筆，依最後修改時間排序（新的在前） */
export function upsertMeta(list: readonly DraftMeta[], meta: DraftMeta): DraftMeta[] {
  return [meta, ...list.filter((d) => d.id !== meta.id)].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 超過上限時，回傳保留的清單和要刪掉的草稿 */
export function pruneMeta(list: readonly DraftMeta[], max = MAX_DRAFTS): { keep: DraftMeta[]; drop: DraftMeta[] } {
  return { keep: list.slice(0, max), drop: list.slice(max) }
}

// ---- IndexedDB ----

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isMetaList(v: unknown): v is DraftMeta[] {
  return Array.isArray(v) && v.every((d) => d && typeof d.id === 'string' && typeof d.updatedAt === 'number')
}

export async function listDrafts(): Promise<DraftMeta[]> {
  try {
    const list = await get<unknown>(LIST_KEY)
    return isMetaList(list) ? list : []
  } catch {
    return []
  }
}

async function writeList(change: (list: DraftMeta[]) => DraftMeta[]): Promise<DraftMeta[]> {
  let result: DraftMeta[] = []
  await update<DraftMeta[]>(LIST_KEY, (old) => {
    result = change(isMetaList(old) ? old : [])
    return result
  })
  return result
}

async function removeData(id: string): Promise<void> {
  await Promise.all([del(photoKey(id)), del(historyKey(id))])
}

/** 用新照片建立草稿；超過上限時刪掉最舊的 */
export async function createDraft(file: Blob, name: string, mode: EditorMode): Promise<DraftMeta> {
  const now = Date.now()
  const meta: DraftMeta = { id: newId(), name, mode, createdAt: now, updatedAt: now }
  try {
    await set(photoKey(meta.id), { file, name } satisfies SavedPhoto)
    let drop: DraftMeta[] = []
    await writeList((list) => {
      const r = pruneMeta(upsertMeta(list, meta))
      drop = r.drop
      return r.keep
    })
    await Promise.all(drop.map((d) => removeData(d.id)))
  } catch (e) {
    // 存不了（例如儲存空間不足）不影響編輯，只是之後在圖庫找不到
    console.warn('無法保存照片', e)
  }
  return meta
}

export async function loadDraft(id: string): Promise<{ meta: DraftMeta; photo: SavedPhoto; history: History | null } | null> {
  try {
    const meta = (await listDrafts()).find((d) => d.id === id)
    const photo = await get<SavedPhoto>(photoKey(id))
    if (!meta || !photo || !(photo.file instanceof Blob)) return null
    const history = await get<unknown>(historyKey(id))
    return { meta, photo, history: isHistory(history) ? history : null }
  } catch {
    return null
  }
}

/** 更新草稿的資訊（模式、縮圖），並把它移到最前面 */
export async function touchDraft(id: string, patch: Partial<Pick<DraftMeta, 'mode' | 'thumb'>>): Promise<DraftMeta[]> {
  try {
    return await writeList((list) => {
      const old = list.find((d) => d.id === id)
      return old ? upsertMeta(list, { ...old, ...patch, updatedAt: Date.now() }) : list
    })
  } catch (e) {
    console.warn('無法更新草稿', e)
    return listDrafts()
  }
}

export async function deleteDrafts(ids: readonly string[]): Promise<DraftMeta[]> {
  const targets = new Set(ids)
  const list = await writeList((l) => l.filter((d) => !targets.has(d.id)))
  await Promise.all(ids.map(removeData))
  return list
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function saveHistorySoon(id: string, h: History): void {
  clearTimeout(timers.get(id))
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id)
      set(historyKey(id), h).catch((e) => console.warn('無法保存編輯紀錄', e))
    }, SAVE_DELAY_MS),
  )
}

/**
 * 把舊版只保存一張照片的資料搬進圖庫（只會做一次）。
 * makeThumb 由呼叫端提供（要解碼照片、跑渲染管線），失敗也不影響搬移。
 */
export async function migrateLegacySession(
  makeThumb: (file: Blob, name: string, history: History | null) => Promise<string>,
): Promise<void> {
  try {
    const photo = await get<SavedPhoto>(LEGACY_PHOTO_KEY)
    if (!photo || !(photo.file instanceof Blob)) return
    const raw = await get<unknown>(LEGACY_HISTORY_KEY)
    const history = isHistory(raw) ? raw : null
    const meta = await createDraft(photo.file, photo.name, 'beautify')
    if (history) await set(historyKey(meta.id), history)
    await Promise.all([del(LEGACY_PHOTO_KEY), del(LEGACY_HISTORY_KEY)])
    const thumb = await makeThumb(photo.file, photo.name, history).catch(() => undefined)
    if (thumb) await touchDraft(meta.id, { thumb })
  } catch (e) {
    console.warn('舊資料搬移失敗', e)
  }
}
