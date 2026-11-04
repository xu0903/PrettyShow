// 畫面中間短暫出現的提示文字（例如「即將推出」）

import { create } from 'zustand'

interface ToastState {
  message: string | null
  /** 每次顯示加一，連續顯示同一句話也會重新計時 */
  seq: number
}

export const useToast = create<ToastState>(() => ({ message: null, seq: 0 }))

let timer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string, ms = 1600): void {
  clearTimeout(timer)
  useToast.setState((s) => ({ message, seq: s.seq + 1 }))
  timer = setTimeout(() => useToast.setState({ message: null }), ms)
}

export const comingSoon = (label: string) => toast(`「${label}」即將推出`)
