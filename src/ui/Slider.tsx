// 單手操作的滑桿：在整條軌道上任何位置左右滑都能調整（相對拖動，不必精準按到圓點），
// 雙擊回到預設值。拖動中呼叫 onChange（只更新預覽），放開時呼叫 onCommit（寫入歷史）。

import { useRef } from 'react'
import './slider.css'

interface SliderProps {
  value: number
  min: number
  max: number
  /** 雙擊回到的值；也是雙向滑桿的中心 */
  defaultValue?: number
  onChange: (v: number) => void
  onCommit: (v: number) => void
  label?: string
}

const DOUBLE_TAP_MS = 300

export function Slider({ value, min, max, defaultValue = 0, onChange, onCommit, label }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; v: number; moved: boolean; last: number } | null>(null)
  const lastTap = useRef(0)

  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)))
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const bipolar = min < defaultValue && defaultValue < max

  // 填色從中心（雙向）或最左邊開始
  const from = bipolar ? pct(defaultValue) : 0
  const to = pct(value)
  const fillStyle = { left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }

  return (
    <div
      className="slider"
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { id: e.pointerId, x: e.clientX, v: value, moved: false, last: value }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId || !trackRef.current) return
        const dx = e.clientX - d.x
        if (!d.moved && Math.abs(dx) < 3) return
        d.moved = true
        // 拖過整條軌道的寬度 = 整個數值範圍
        const next = clamp(d.v + (dx / trackRef.current.offsetWidth) * (max - min))
        if (next !== d.last) {
          d.last = next
          onChange(next)
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        drag.current = null
        if (d.moved) {
          onCommit(d.last)
          lastTap.current = 0
          return
        }
        // 沒有拖動 = 點一下；連點兩下回到預設值
        if (e.timeStamp - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0
          onCommit(defaultValue)
        } else {
          lastTap.current = e.timeStamp
        }
      }}
      onPointerCancel={() => {
        const d = drag.current
        drag.current = null
        if (d?.moved) onCommit(d.last)
      }}
    >
      <div className="slider-track">
        <div className="slider-fill" style={fillStyle} />
        {bipolar && <div className="slider-center" style={{ left: `${from}%` }} />}
        <div className="slider-thumb" style={{ left: `${to}%` }}>
          <span className="slider-value">{value > 0 && bipolar ? `+${value}` : value}</span>
        </div>
      </div>
    </div>
  )
}
