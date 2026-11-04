// 筆刷的介面狀態（不是編輯內容，不進復原紀錄）：筆刷大小、畫筆還是橡皮擦。
// 面板和照片上的操作層都會用到，所以放在共用的 store。

import { create } from 'zustand'

export const BRUSH_MIN = 8
export const BRUSH_MAX = 120
export const BRUSH_DEFAULT = 40

interface BrushState {
  /** 筆刷直徑（螢幕上的 px，和照片放大多少無關；放大照片就能畫得更細） */
  size: number
  erase: boolean
  /** 每次調整大小加一：操作層看到就在照片中央顯示一下筆刷大小 */
  sizeSeq: number
  setSize: (size: number) => void
  setErase: (erase: boolean) => void
}

export const useBrush = create<BrushState>((set) => ({
  size: BRUSH_DEFAULT,
  erase: false,
  sizeSeq: 0,
  setSize: (size) => set((s) => ({ size, sizeSeq: s.sizeSeq + 1 })),
  setErase: (erase) => set({ erase }),
}))
