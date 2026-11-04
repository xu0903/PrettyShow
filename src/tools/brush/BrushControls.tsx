import { IconBrush, IconEraser } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { BRUSH_DEFAULT, BRUSH_MAX, BRUSH_MIN, useBrush } from './useBrush.ts'
import './brush.css'

// 筆刷工具共用的控制列：畫筆／橡皮擦切換 + 筆刷大小
export function BrushControls({ eraser = true }: { eraser?: boolean }) {
  const size = useBrush((s) => s.size)
  const erase = useBrush((s) => s.erase)
  const setSize = useBrush((s) => s.setSize)
  const setErase = useBrush((s) => s.setErase)
  return (
    <div className="brush-controls">
      {eraser && (
        <div className="brush-modes">
          <button className="brush-mode" aria-pressed={!erase} aria-label="畫筆" onClick={() => setErase(false)}>
            <IconBrush />
          </button>
          <button className="brush-mode" aria-pressed={erase} aria-label="橡皮擦" onClick={() => setErase(true)}>
            <IconEraser />
          </button>
        </div>
      )}
      <div className="brush-size">
        <span className="brush-size-label">大小</span>
        <Slider
          label="筆刷大小"
          value={size}
          min={BRUSH_MIN}
          max={BRUSH_MAX}
          defaultValue={BRUSH_DEFAULT}
          onChange={setSize}
          onCommit={setSize}
        />
      </div>
    </div>
  )
}
