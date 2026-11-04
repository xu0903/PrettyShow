// 一排可以選的顏色 + 最後一個「自己挑」（打開系統的調色盤）。
// 調色盤拖動中只更新預覽，關掉（或放開）時才寫入一筆復原紀錄。

import { useEffect, useRef } from 'react'
import type { NamedColor } from './colors.ts'
import './colorRow.css'

interface ColorRowProps {
  colors: NamedColor[]
  /** 目前的顏色；null 代表沒有選（例如強度是 0） */
  value: string | null
  /** 點了預設的顏色，或調色盤選好了 */
  onPick: (color: string) => void
  /** 調色盤拖動中 */
  onPreview?: (color: string) => void
}

export function ColorRow({ colors, value, onPick, onPreview }: ColorRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const custom = value !== null && !colors.some((c) => c.color === value)

  // React 的 onChange 其實是 input 事件（拖動中一直觸發）；真正選好要聽原生的 change 事件
  const pickRef = useRef(onPick)
  const previewRef = useRef(onPreview)
  useEffect(() => {
    pickRef.current = onPick
    previewRef.current = onPreview
  })
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onInput = () => previewRef.current?.(el.value)
    const onChange = () => pickRef.current(el.value)
    el.addEventListener('input', onInput)
    el.addEventListener('change', onChange)
    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('change', onChange)
    }
  }, [])

  return (
    <div className="swatch-row">
      {colors.map((c) => (
        <button
          key={c.color}
          className="swatch"
          style={{ background: c.color }}
          aria-label={c.label}
          aria-pressed={value === c.color}
          onClick={() => onPick(c.color)}
        />
      ))}
      <label
        className="swatch swatch-custom"
        aria-label="自己挑顏色"
        aria-pressed={custom}
        style={custom ? { background: value } : undefined}
      >
        <input ref={inputRef} type="color" defaultValue={value ?? '#c97b7e'} />
        {!custom && <span>+</span>}
      </label>
    </div>
  )
}
