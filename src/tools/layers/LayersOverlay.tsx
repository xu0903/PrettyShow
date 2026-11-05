// 文字、貼紙的操作層：點一下選取、拖動移動、拖右下角縮放旋轉、按左上角刪除

import { useRef, type ComponentType, type PointerEvent } from 'react'
import type { ToolOverlayProps } from '../../core/tool.ts'
import { layerBox, type Layer } from './layers.ts'
import { select, useSelection } from './selection.ts'
import './layers.css'

interface Config<P> {
  read: (p: P) => readonly Layer[]
  write: (p: P, layers: Layer[]) => P
}

type Drag =
  | { kind: 'move'; id: number; layer: Layer; x: number; y: number; moved: boolean }
  | { kind: 'transform'; id: number; layer: Layer; cx: number; cy: number; angle: number; dist: number }

/** 物件太小或太大都不好操作 */
const MIN_SIZE = 0.03
const MAX_SIZE = 1.2

export function createLayersOverlay<P>(cfg: Config<P>): ComponentType<ToolOverlayProps<P>> {
  return function LayersOverlay({ params, onChange, onCommit, stageSize }: ToolOverlayProps<P>) {
    const selected = useSelection((s) => s.selected)
    const drag = useRef<Drag | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const layers = cfg.read(params)

    const replace = (l: Layer) => cfg.write(params, layers.map((x) => (x.id === l.id ? l : x)))

    /** 物件中心在螢幕上的位置 */
    const centerOf = (l: Layer) => {
      const r = rootRef.current!.getBoundingClientRect()
      return { cx: r.left + l.x * r.width, cy: r.top + l.y * r.height }
    }

    const startMove = (l: Layer) => (e: PointerEvent) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      select(l.id)
      drag.current = { kind: 'move', id: e.pointerId, layer: l, x: e.clientX, y: e.clientY, moved: false }
    }

    const startTransform = (l: Layer) => (e: PointerEvent) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const { cx, cy } = centerOf(l)
      drag.current = {
        kind: 'transform',
        id: e.pointerId,
        layer: l,
        cx,
        cy,
        angle: Math.atan2(e.clientY - cy, e.clientX - cx),
        dist: Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy)),
      }
    }

    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      if (d.kind === 'move') {
        const dx = (e.clientX - d.x) / stageSize.width
        const dy = (e.clientY - d.y) / stageSize.height
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return
        d.moved = true
        onChange(replace({ ...d.layer, x: Math.min(1, Math.max(0, d.layer.x + dx)), y: Math.min(1, Math.max(0, d.layer.y + dy)) }))
      } else {
        const angle = Math.atan2(e.clientY - d.cy, e.clientX - d.cx)
        const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
        const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, d.layer.size * (dist / d.dist)))
        onChange(replace({ ...d.layer, size, rot: d.layer.rot + angle - d.angle }))
      }
    }

    const end = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      drag.current = null
      if (d.kind === 'move' && !d.moved) return // 只是點一下選取
      // 拖動中已經用 onChange 更新過，這裡的 params 就是最新的
      onCommit(params)
    }

    return (
      // 點空白的地方：取消選取
      <div className="layers-overlay" ref={rootRef} onPointerDown={() => select(null)}>
        {layers.map((l) => {
          const { w, h } = layerBox(l, stageSize.width, stageSize.height)
          const isSel = l.id === selected
          return (
            <div
              key={l.id}
              className={isSel ? 'layer-box is-selected' : 'layer-box'}
              style={{
                left: `${l.x * 100}%`,
                top: `${l.y * 100}%`,
                width: w,
                height: h,
                transform: `translate(-50%, -50%) rotate(${l.rot}rad)`,
              }}
              onPointerDown={startMove(l)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              {isSel && (
                <>
                  <button
                    className="layer-handle layer-del"
                    aria-label="刪除"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      select(null)
                      onCommit(cfg.write(params, layers.filter((x) => x.id !== l.id)))
                    }}
                  >
                    ×
                  </button>
                  <div className="layer-handle layer-rot" aria-label="縮放旋轉" onPointerDown={startTransform(l)}>
                    ⤡
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }
}
