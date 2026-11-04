// 長按偵測：單指按住不動超過一段時間就觸發，放開時結束。
// 和雙指縮放共用同一個區域：一旦有第二根手指或手指移動，就取消長按。
// timer / origin / active 是 effect 內部的區域變數，只在事件處理函式中修改，所以關掉這條誤判。
/* oxlint-disable react/immutability */

import { useEffect, useRef, type RefObject } from 'react'

const HOLD_MS = 300
const MAX_MOVE = 10

export function useLongPress(ref: RefObject<HTMLElement | null>, onStart: () => void, onEnd: () => void): void {
  // callback 放在 ref：長按開始後畫面會更新，若 effect 因此重新註冊，會把進行中的長按取消掉
  const handlers = useRef({ onStart, onEnd })
  useEffect(() => {
    handlers.current = { onStart, onEnd }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const pointers = new Set<number>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let origin: { x: number; y: number } | null = null
    let active = false

    const cancel = () => {
      clearTimeout(timer)
      timer = undefined
      origin = null
      if (active) {
        active = false
        handlers.current.onEnd()
      }
    }

    const onDown = (e: PointerEvent) => {
      pointers.add(e.pointerId)
      if (pointers.size > 1) return cancel()
      origin = { x: e.clientX, y: e.clientY }
      timer = setTimeout(() => {
        active = true
        handlers.current.onStart()
      }, HOLD_MS)
    }
    const onMove = (e: PointerEvent) => {
      if (!origin || active) return
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MAX_MOVE) cancel()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      cancel()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      cancel()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [ref])
}
