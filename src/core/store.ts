// 全域狀態：目前的照片（M2 會再加入編輯堆疊）

import { create } from 'zustand'
import { getMaxTextureSize } from '../gl/capabilities.ts'
import { loadPhoto, releaseCanvas, type LoadedPhoto } from '../image/load.ts'

export type PhotoStatus = 'idle' | 'loading' | 'ready' | 'error'

interface EditorState {
  photo: LoadedPhoto | null
  status: PhotoStatus
  error: string | null
  openPhoto: (file: File) => Promise<void>
}

export const useEditor = create<EditorState>((set, get) => ({
  photo: null,
  status: 'idle',
  error: null,

  openPhoto: async (file) => {
    set({ status: 'loading', error: null })
    try {
      const photo = await loadPhoto(file, file.name, getMaxTextureSize())
      // 換照片時釋放舊的預覽圖
      const old = get().photo
      if (old) releaseCanvas(old.preview)
      set({ photo, status: 'ready' })
    } catch (e) {
      set({ status: get().photo ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },
}))
