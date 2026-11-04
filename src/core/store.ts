// 全域狀態：目前在哪個畫面、圖庫、正在修的照片、編輯堆疊、正在用的工具

import { create } from 'zustand'
import { getMaxTextureSize } from '../gl/capabilities.ts'
import { loadPhoto, releaseCanvas, type LoadedPhoto } from '../image/load.ts'
import * as drafts from './drafts.ts'
import type { DraftMeta } from './drafts.ts'
import * as stack from './editStack.ts'
import type { EditState, History } from './editStack.ts'
import { renderThumbnail } from './thumbnail.ts'
import type { EditorMode } from './tool.ts'

export type PhotoStatus = 'idle' | 'loading' | 'ready' | 'error'
export type Screen = 'home' | 'editor'
export type HomeTab = 'home' | 'gallery' | 'ai' | 'me'

interface EditorState {
  screen: Screen
  homeTab: HomeTab
  /** 目前是哪個編輯器 */
  mode: EditorMode
  /** 圖庫裡的草稿（新的在前） */
  gallery: DraftMeta[]
  /** 正在修的草稿 */
  draftId: string | null

  photo: LoadedPhoto | null
  status: PhotoStatus
  error: string | null

  history: History
  /** 拖動滑桿中的暫時狀態（還沒寫入歷史）；null 代表沒有在拖 */
  live: EditState | null
  /** 目前打開的工具 */
  activeToolId: string | null
  /** 打開工具時的狀態，按 ✕ 時回到這裡 */
  toolEntry: { state: EditState; pastLength: number } | null
  /** 長按中：顯示原圖 */
  comparing: boolean

  /** 打開 App 時：搬移舊資料、讀圖庫，上次修到一半就直接回到編輯器 */
  init: () => Promise<void>
  setHomeTab: (tab: HomeTab) => void
  /** 選了新照片：建立草稿並打開編輯器 */
  openPhoto: (file: File, mode: EditorMode) => Promise<void>
  /** 從圖庫打開草稿 */
  openDraft: (id: string, mode?: EditorMode) => Promise<void>
  /** 回首頁（先更新縮圖） */
  closeEditor: () => Promise<void>
  /** 切換美化／美容編輯器（同一張照片、同一份編輯） */
  setMode: (mode: EditorMode) => void
  removeDrafts: (ids: readonly string[]) => Promise<void>

  previewTool: (toolId: string, params: unknown) => void
  commitTool: (toolId: string, params: unknown) => void
  /** 一次設定好幾個工具的參數（例如一鍵美顏），只算一筆復原紀錄 */
  previewPatch: (patch: Record<string, unknown>) => void
  commitPatch: (patch: Record<string, unknown>) => void
  undo: () => void
  redo: () => void
  openTool: (id: string) => void
  /** ✓：保留這個工具裡做的修改 */
  applyTool: () => void
  /** ✕：放棄這個工具裡做的修改 */
  cancelTool: () => void
  setComparing: (v: boolean) => void
}

/** 畫面上應該顯示的編輯狀態（拖動中用暫時狀態） */
export const selectViewState = (s: EditorState): EditState => s.live ?? s.history.present

/** 在編輯器裡時記下草稿 id：iOS 把 App 關掉再打開，可以直接回到編輯器 */
const OPEN_DRAFT_KEY = 'prettyshow.openDraft'
const THUMB_DELAY_MS = 1500

function remember(id: string | null): void {
  try {
    if (id) localStorage.setItem(OPEN_DRAFT_KEY, id)
    else localStorage.removeItem(OPEN_DRAFT_KEY)
  } catch {
    // 無痕模式等情況存不了，不影響使用
  }
}

function remembered(): string | null {
  try {
    return localStorage.getItem(OPEN_DRAFT_KEY)
  } catch {
    return null
  }
}

let initializing: Promise<void> | null = null
/** 每次開照片加一；非同步載入完成時若已經不是最新的一次，就丟掉結果 */
let openToken = 0
let thumbTimer: ReturnType<typeof setTimeout> | undefined

export const useEditor = create<EditorState>((set, get) => {
  const releasePhoto = () => {
    const old = get().photo
    if (old) releaseCanvas(old.preview)
  }

  /** 重新產生目前草稿的縮圖 */
  const updateThumb = async () => {
    clearTimeout(thumbTimer)
    const { photo, history, draftId, mode } = get()
    if (!photo || !draftId) return
    try {
      const thumb = await renderThumbnail(photo, history.present)
      set({ gallery: await drafts.touchDraft(draftId, { thumb, mode }) })
    } catch (e) {
      console.warn('縮圖產生失敗', e)
    }
  }

  const setHistory = (history: History) => {
    set({ history, live: null })
    const id = get().draftId
    if (id) drafts.saveHistorySoon(id, history)
    clearTimeout(thumbTimer)
    thumbTimer = setTimeout(() => void updateThumb(), THUMB_DELAY_MS)
  }

  /** 進入編輯器、開始載入 */
  const beginOpen = (mode: EditorMode) => {
    releasePhoto()
    set({
      screen: 'editor',
      mode,
      photo: null,
      status: 'loading',
      error: null,
      history: stack.createHistory(),
      live: null,
      activeToolId: null,
      toolEntry: null,
      comparing: false,
    })
    return ++openToken
  }

  const failOpen = (token: number, e: unknown) => {
    if (token !== openToken) return
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }

  return {
    screen: 'home',
    homeTab: 'home',
    mode: 'beautify',
    gallery: [],
    draftId: null,
    photo: null,
    status: 'idle',
    error: null,
    history: stack.createHistory(),
    live: null,
    activeToolId: null,
    toolEntry: null,
    comparing: false,

    init: () => {
      // React 開發模式會呼叫兩次，只執行一次就好
      initializing ??= (async () => {
        await drafts.migrateLegacySession(async (file, name, history) => {
          const photo = await loadPhoto(file, name, getMaxTextureSize())
          try {
            return await renderThumbnail(photo, history?.present ?? stack.EMPTY_STATE)
          } finally {
            releaseCanvas(photo.preview)
          }
        })
        const gallery = await drafts.listDrafts()
        set({ gallery })
        const last = remembered()
        if (last && gallery.some((d) => d.id === last) && get().screen === 'home') await get().openDraft(last)
      })()
      return initializing
    },

    setHomeTab: (homeTab) => set({ homeTab }),

    openPhoto: async (file, mode) => {
      const token = beginOpen(mode)
      try {
        const photo = await loadPhoto(file, file.name, getMaxTextureSize())
        if (token !== openToken) return releaseCanvas(photo.preview)
        set({ photo, status: 'ready' })
        const meta = await drafts.createDraft(file, file.name, mode)
        if (token !== openToken) return
        set({ draftId: meta.id, gallery: await drafts.listDrafts() })
        remember(meta.id)
        void updateThumb()
      } catch (e) {
        failOpen(token, e)
      }
    },

    openDraft: async (id, mode) => {
      const token = beginOpen(mode ?? get().gallery.find((d) => d.id === id)?.mode ?? 'beautify')
      try {
        const saved = await drafts.loadDraft(id)
        if (!saved) throw new Error('找不到這張照片，可能已經被刪除')
        const photo = await loadPhoto(saved.photo.file, saved.photo.name, getMaxTextureSize())
        if (token !== openToken) return releaseCanvas(photo.preview)
        set({ photo, status: 'ready', draftId: id, history: saved.history ?? stack.createHistory() })
        remember(id)
      } catch (e) {
        failOpen(token, e)
      }
    },

    closeEditor: async () => {
      openToken++
      await updateThumb()
      releasePhoto()
      remember(null)
      set({
        screen: 'home',
        photo: null,
        status: 'idle',
        error: null,
        draftId: null,
        history: stack.createHistory(),
        live: null,
        activeToolId: null,
        toolEntry: null,
        comparing: false,
      })
    },

    setMode: (mode) => {
      set({ mode, activeToolId: null, toolEntry: null })
      const id = get().draftId
      if (id) void drafts.touchDraft(id, { mode }).then((gallery) => set({ gallery }))
    },

    removeDrafts: async (ids) => {
      set({ gallery: await drafts.deleteDrafts(ids) })
    },

    previewTool: (toolId, params) => {
      set({ live: stack.withToolParams(get().history.present, toolId, params) })
    },

    commitTool: (toolId, params) => {
      const h = get().history
      setHistory(stack.commit(h, stack.withToolParams(h.present, toolId, params)))
    },

    previewPatch: (patch) => {
      set({ live: { ...get().history.present, ...patch } })
    },

    commitPatch: (patch) => {
      const h = get().history
      setHistory(stack.commit(h, { ...h.present, ...patch }))
    },

    undo: () => setHistory(stack.undo(get().history)),
    redo: () => setHistory(stack.redo(get().history)),

    openTool: (id) => {
      const h = get().history
      set({ activeToolId: id, toolEntry: { state: h.present, pastLength: h.past.length } })
    },

    applyTool: () => set({ activeToolId: null, toolEntry: null }),

    cancelTool: () => {
      const { toolEntry, history } = get()
      set({ activeToolId: null, toolEntry: null })
      if (!toolEntry || history.present === toolEntry.state) return
      // 回到打開工具前的狀態，工具裡做的每一步都不留在復原紀錄裡
      setHistory({ past: history.past.slice(0, toolEntry.pastLength), present: toolEntry.state, future: [] })
    },

    setComparing: (v) => set({ comparing: v }),
  }
})
