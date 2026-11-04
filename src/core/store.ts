// 全域狀態：目前的照片、編輯堆疊、正在用的工具、是否在看原圖

import { create } from 'zustand'
import { getMaxTextureSize } from '../gl/capabilities.ts'
import { loadPhoto, releaseCanvas, type LoadedPhoto } from '../image/load.ts'
import * as stack from './editStack.ts'
import type { EditState, History } from './editStack.ts'
import { loadSession, saveHistorySoon, savePhoto } from './persist.ts'

export type PhotoStatus = 'idle' | 'loading' | 'ready' | 'error'

interface EditorState {
  photo: LoadedPhoto | null
  status: PhotoStatus
  error: string | null

  history: History
  /** 拖動滑桿中的暫時狀態（還沒寫入歷史）；null 代表沒有在拖 */
  draft: EditState | null
  /** 目前打開面板的工具 */
  activeToolId: string | null
  /** 長按中：顯示原圖 */
  comparing: boolean

  openPhoto: (file: File) => Promise<void>
  /** 打開 App 時還原上次的照片與編輯 */
  restoreSession: () => Promise<void>
  previewTool: (toolId: string, params: unknown) => void
  commitTool: (toolId: string, params: unknown) => void
  undo: () => void
  redo: () => void
  setActiveTool: (id: string | null) => void
  setComparing: (v: boolean) => void
}

/** 畫面上應該顯示的編輯狀態（拖動中用暫時狀態） */
export const selectViewState = (s: EditorState): EditState => s.draft ?? s.history.present

let restoring: Promise<void> | null = null

export const useEditor = create<EditorState>((set, get) => {
  /** 換上新的照片（舊的預覽圖要釋放） */
  const showPhoto = (photo: LoadedPhoto, history: History) => {
    const old = get().photo
    if (old) releaseCanvas(old.preview)
    set({ photo, status: 'ready', error: null, history, draft: null, comparing: false })
  }

  const setHistory = (history: History) => {
    set({ history, draft: null })
    saveHistorySoon(history)
  }

  return {
    photo: null,
    status: 'idle',
    error: null,
    history: stack.createHistory(),
    draft: null,
    activeToolId: null,
    comparing: false,

    openPhoto: async (file) => {
      set({ status: 'loading', error: null })
      try {
        const photo = await loadPhoto(file, file.name, getMaxTextureSize())
        showPhoto(photo, stack.createHistory())
        await savePhoto(file, file.name)
      } catch (e) {
        set({ status: get().photo ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) })
      }
    },

    restoreSession: () => {
      // React 開發模式會呼叫兩次，只執行一次就好
      restoring ??= (async () => {
        set({ status: 'loading' })
        const session = await loadSession()
        if (!session) {
          if (!get().photo) set({ status: 'idle' })
          return
        }
        try {
          const photo = await loadPhoto(session.photo.file, session.photo.name, getMaxTextureSize())
          // 使用者在還原期間自己選了新照片，就不要蓋掉
          if (get().photo) return
          showPhoto(photo, session.history ?? stack.createHistory())
        } catch {
          if (!get().photo) set({ status: 'idle' })
        }
      })()
      return restoring
    },

    previewTool: (toolId, params) => {
      set({ draft: stack.withToolParams(get().history.present, toolId, params) })
    },

    commitTool: (toolId, params) => {
      const h = get().history
      setHistory(stack.commit(h, stack.withToolParams(h.present, toolId, params)))
    },

    undo: () => setHistory(stack.undo(get().history)),
    redo: () => setHistory(stack.redo(get().history)),

    setActiveTool: (id) => set({ activeToolId: id }),
    setComparing: (v) => set({ comparing: v }),
  }
})
