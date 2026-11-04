// 疊在照片上的裁切框：拖框內移動、拖四個角或四條邊調整大小（固定比例時只有四個角）

import { useRef, type PointerEvent } from 'react'
import type { ToolOverlayProps } from '../../core/tool.ts'
import { aspectRatio, moveRect, resizeRect, type CropParams, type Handle, type Rect } from './geometry.ts'

const CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se']
const EDGES: Handle[] = ['n', 's', 'w', 'e']

export function CropOverlay({ params, onChange, onCommit, stageSize }: ToolOverlayProps<CropParams>) {
  const drag = useRef<{ id: number; handle: Handle | 'move'; x: number; y: number; rect: Rect; last: CropParams } | null>(
    null,
  )
  const ratio = aspectRatio(params.aspect, stageSize)
  const { x, y, w, h } = params.rect

  const start = (handle: Handle | 'move') => (e: PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, handle, x: e.clientX, y: e.clientY, rect: params.rect, last: params }
  }

  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // 手指移動量換算成比例座標
    const dx = (e.clientX - d.x) / stageSize.width
    const dy = (e.clientY - d.y) / stageSize.height
    const rect = d.handle === 'move' ? moveRect(d.rect, dx, dy) : resizeRect(d.rect, d.handle, dx, dy, ratio, stageSize)
    d.last = { ...params, rect }
    onChange(d.last)
  }

  const end = (e: PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    onCommit(d.last)
  }

  const handles = ratio === null ? [...CORNERS, ...EDGES] : CORNERS

  return (
    <div className="crop-overlay">
      <div
        className="crop-box"
        style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
        onPointerDown={start('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* 三分線 */}
        <div className="crop-grid" />
        {handles.map((hd) => (
          <div
            key={hd}
            className={`crop-handle crop-handle-${hd}`}
            // 移動、放開的事件會冒泡到外框處理
            onPointerDown={start(hd)}
          />
        ))}
      </div>
    </div>
  )
}
