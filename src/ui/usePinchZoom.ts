// 照片區的手勢：雙指縮放、單指拖曳（放大時）、雙擊切換放大。
// 直接修改 DOM 的 transform，不經過 React 狀態，拖動時才能維持 60fps。
// s / tx / ty 是 effect 內部的區域變數，只在事件處理函式中修改，不會影響 render，
// 所以關掉 react/immutability 的誤判。
/* oxlint-disable react/immutability */

import { useEffect, type RefObject } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 8
const DOUBLE_TAP_SCALE = 2.5
const TAP_MAX_MOVE = 10
const TAP_MAX_MS = 250
const DOUBLE_TAP_MS = 300

interface Point {
  x: number
  y: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * @param containerRef 接收手勢的區域（照片區）
 * @param targetRef    被縮放的元素（包住 canvas 的 stage）
 * @param resetKey     這個值改變時回到原始大小（例如換照片）
 * @param enabled      false 時停用手勢並回到原始大小（例如拖裁切框時）
 */
export function usePinchZoom(
  containerRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  resetKey: unknown,
  enabled = true,
): void {
  useEffect(() => {
    const el = containerRef.current
    const target = targetRef.current
    if (!el || !target || !enabled) return

    let s = 1
    let tx = 0
    let ty = 0
    const pointers = new Map<number, Point>()
    // 手勢開始時的狀態；手指數量改變就重新記錄
    let start: { s: number; tx: number; ty: number; d: number; m: Point } | null = null
    let tapStart: { t: number; p: Point } | null = null
    let lastTap = 0

    const apply = (animate = false) => {
      target.style.transition = animate ? 'transform 0.2s ease-out' : 'none'
      target.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`
    }
    apply()

    const center = (): Point => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }

    // 限制拖曳範圍：放大後照片邊緣不能拖進畫面內
    const clampPan = () => {
      const r = el.getBoundingClientRect()
      const maxX = Math.max(0, (target.offsetWidth * s - r.width) / 2)
      const maxY = Math.max(0, (target.offsetHeight * s - r.height) / 2)
      tx = clamp(tx, -maxX, maxX)
      ty = clamp(ty, -maxY, maxY)
    }

    // 以畫面上的某一點為中心縮放到 ns 倍
    const zoomAt = (p: Point, ns: number, from = { s, tx, ty }) => {
      const c = center()
      const px = (p.x - c.x - from.tx) / from.s
      const py = (p.y - c.y - from.ty) / from.s
      s = ns
      tx = p.x - c.x - px * ns
      ty = p.y - c.y - py * ns
    }

    const begin = () => {
      const pts = [...pointers.values()]
      if (pts.length >= 2) {
        const [a, b] = pts
        start = { s, tx, ty, d: dist(a, b), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      } else if (pts.length === 1) {
        start = { s, tx, ty, d: 0, m: pts[0] }
      } else {
        start = null
      }
    }

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      tapStart = pointers.size === 1 ? { t: e.timeStamp, p: { x: e.clientX, y: e.clientY } } : null
      begin()
    }

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!start) return
      const pts = [...pointers.values()]
      if (pts.length >= 2) {
        const [a, b] = pts
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        // 縮小時允許稍微小於 1 倍，放手後再彈回來，手感比較自然
        const ns = clamp((start.s * dist(a, b)) / start.d, MIN_SCALE * 0.6, MAX_SCALE)
        zoomAt(start.m, ns, start)
        // 兩指中心移動 = 同時拖曳
        tx += m.x - start.m.x
        ty += m.y - start.m.y
        apply()
      } else if (s > 1) {
        tx = start.tx + (pts[0].x - start.m.x)
        ty = start.ty + (pts[0].y - start.m.y)
        clampPan()
        apply()
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)

      // 判斷是不是點一下（沒移動、時間很短）
      const isTap =
        tapStart && e.timeStamp - tapStart.t < TAP_MAX_MS && dist(tapStart.p, { x: e.clientX, y: e.clientY }) < TAP_MAX_MOVE
      tapStart = null

      if (pointers.size === 0) {
        if (isTap && e.timeStamp - lastTap < DOUBLE_TAP_MS) {
          // 雙擊：已放大就還原，否則以點擊位置放大
          if (s > 1) {
            s = 1
            tx = 0
            ty = 0
          } else {
            zoomAt({ x: e.clientX, y: e.clientY }, DOUBLE_TAP_SCALE)
          }
          lastTap = 0
        } else {
          lastTap = isTap ? e.timeStamp : 0
          if (s < MIN_SCALE) {
            s = MIN_SCALE
            tx = 0
            ty = 0
          }
        }
        clampPan()
        apply(true)
      }
      begin()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      target.style.transform = ''
    }
  }, [containerRef, targetRef, resetKey, enabled])
}
