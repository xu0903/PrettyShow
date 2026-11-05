// 增高的操作層：兩條可以上下拖的線，中間是要拉長的範圍

import { useRef, type PointerEvent } from 'react'
import type { ToolOverlayProps } from '../../core/tool.ts'
import { toAfter, toBefore, type TallerParams } from './stretch.ts'
import '../brush/brush.css'
import './taller.css'

/** 兩條線至少要隔這麼遠 */
const MIN_BAND = 0.08

export function TallerOverlay({ params, onChange, onCommit }: ToolOverlayProps<TallerParams>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; which: 'top' | 'bottom' } | null>(null)
  const topY = toAfter(params.top, params)
  const bottomY = toAfter(params.bottom, params)

  const start = (which: 'top' | 'bottom') => (e: PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, which }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const r = rootRef.current!.getBoundingClientRect()
    // 手指的位置換回「拉長前」的座標
    const y = Math.min(1, Math.max(0, toBefore((e.clientY - r.top) / r.height, params)))
    const next =
      d.which === 'top'
        ? { ...params, top: Math.min(y, params.bottom - MIN_BAND) }
        : { ...params, bottom: Math.max(y, params.top + MIN_BAND) }
    onChange(next)
  }
  const end = (e: PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return
    drag.current = null
    onCommit(params)
  }

  return (
    <div className="brush-overlay" ref={rootRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="taller-band" style={{ top: `${topY * 100}%`, height: `${(bottomY - topY) * 100}%` }} />
      {(['top', 'bottom'] as const).map((w) => (
        <div key={w} className="taller-line" style={{ top: `${(w === 'top' ? topY : bottomY) * 100}%` }} onPointerDown={start(w)}>
          <span>{w === 'top' ? '從這裡' : '到這裡'}</span>
        </div>
      ))}
    </div>
  )
}
