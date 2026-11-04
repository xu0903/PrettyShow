// 美膚面板的介面狀態（不是編輯內容）：自動或手動、手動時塗的是磨皮還是美白。
// 面板和照片上的筆刷都要用到，所以獨立出來。

import { create } from 'zustand'

export type Kind = 'smooth' | 'whiten'

export const ITEMS: { key: Kind; label: string }[] = [
  { key: 'smooth', label: '磨皮' },
  { key: 'whiten', label: '美白' },
]

export const useUi = create<{ manual: boolean; kind: Kind }>(() => ({ manual: false, kind: 'smooth' }))
