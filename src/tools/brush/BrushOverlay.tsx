// 疊在照片上的筆刷操作層：一指畫、兩指交給照片區縮放和拖動。
// 手指位置會換算回「原圖座標」再存，所以先裁切、旋轉再畫，或畫完再裁切，位置都對得上。

import { useEffect, useRef, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react'
import { displayToSourcePoint } from '../../core/pipeline.ts'
import { getTools } from '../../core/registry.ts'
import { useEditor } from '../../core/store.ts'
import type { ToolOverlayProps } from '../../core/tool.ts'
import { round4, type Stroke } from './strokes.ts'
import { useBrush } from './useBrush.ts'
import './brush.css'

export interface BrushOverlayConfig<P> {
  read: (params: P) => readonly Stroke[]
  write: (params: P, strokes: Stroke[]) => P
  /** 這一筆要帶的屬性（顏色、種類…）；回傳 null 代表現在不能畫（例如美膚在自動模式） */
  extra?: () => Partial<Stroke> | null
  /** true：邊畫邊更新效果（馬賽克、磨皮）；false：畫的時候只顯示筆跡，放開才套用（塗鴉、消除筆） */
  live: boolean
  /** 不是即時更新時，畫的過程中筆跡的顏色 */
  previewColor?: (stroke: Stroke) => string
  /** 不允許拖動，只能點一下（祛痘） */
  tapOnly?: boolean
}

interface Local {
  x: number
  y: number
}

/** 手指移動超過這麼多 px 才多記一個點，避免點太密 */
const MIN_STEP_PX = 2.5
const SIZE_PREVIEW_MS = 700

export function createBrushOverlay<P>(cfg: BrushOverlayConfig<P>): ComponentType<ToolOverlayProps<P>> {
  return function BrushOverlay({ params, onChange, onCommit }: ToolOverlayProps<P>) {
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stroke = useRef<{ id: number; s: Stroke; path: Local[]; base: readonly Stroke[] } | null>(null)
    const frame = useRef(0)
    const cursor = useRef<Local | null>(null)
    const size = useBrush((s) => s.size)
    const sizeSeq = useBrush((s) => s.sizeSeq)

    /** 照片在畫面上的位置（含縮放），以及縮放倍數 */
    const measure = () => {
      const el = rootRef.current!
      const rect = el.getBoundingClientRect()
      return { rect, zoom: rect.width / el.offsetWidth }
    }

    const toLocal = (e: { clientX: number; clientY: number }): Local => {
      const { rect } = measure()
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
    }

    const toSource = (p: Local) => {
      const { history, photo } = useEditor.getState()
      const q = displayToSourcePoint(history.present, getTools(), p, { width: photo!.width, height: photo!.height })
      return [round4(q.x), round4(q.y)]
    }

    /** 筆刷半徑（螢幕 px）→ 原圖長邊的比例；把畫面左右兩端換算回原圖，就知道畫面 1px 是原圖多少 */
    const sourceRadius = () => {
      const photo = useEditor.getState().photo!
      const { rect } = measure()
      const [ax, ay] = toSource({ x: 0, y: 0.5 })
      const [bx, by] = toSource({ x: 1, y: 0.5 })
      const shownWidthPx = Math.hypot((bx - ax) * photo.width, (by - ay) * photo.height)
      return (size / 2 / rect.width) * (shownWidthPx / Math.max(photo.width, photo.height))
    }

    // ---- 畫面上的提示：筆跡預覽、手指下的圓圈 ----

    const redraw = (ring: Local | null = cursor.current) => {
      const c = canvasRef.current
      const el = rootRef.current
      if (!c || !el) return
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(el.offsetWidth * dpr)
      const h = Math.round(el.offsetHeight * dpr)
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      const ctx = c.getContext('2d')!
      const cur = stroke.current
      const showPath = !!cur && !cfg.live && cur.path.length > 0
      if (!ring && !showPath) {
        // 沒東西要畫：清空並把畫布藏起來。只清空的話，有些瀏覽器在
        // 「整張清掉、之後不再畫」時偶爾不會更新畫面，會殘留最後一個圓圈
        ctx.clearRect(0, 0, w, h)
        c.style.visibility = 'hidden'
        return
      }
      c.style.visibility = ''
      ctx.clearRect(0, 0, w, h)
      const { zoom } = measure()
      const radius = (size / 2 / zoom) * dpr
      if (cur && showPath) {
        ctx.strokeStyle = ctx.fillStyle = cfg.previewColor?.(cur.s) ?? (cur.s.erase ? 'rgb(255 255 255 / 0.4)' : 'rgb(223 122 69 / 0.55)')
        ctx.lineWidth = radius * 2
        ctx.lineCap = ctx.lineJoin = 'round'
        ctx.beginPath()
        cur.path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)))
        if (cur.path.length === 1) {
          ctx.arc(cur.path[0].x * w, cur.path[0].y * h, radius, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.stroke()
        }
      }
      if (ring) {
        ctx.lineWidth = 1.5 * dpr
        for (const [color, extra] of [
          ['rgb(0 0 0 / 0.5)', 1.5 * dpr],
          ['#fff', 0],
        ] as const) {
          ctx.strokeStyle = color
          ctx.beginPath()
          ctx.arc(ring.x * w, ring.y * h, radius + extra, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    // 調整筆刷大小時，在照片中央顯示一下有多大
    useEffect(() => {
      if (sizeSeq === 0) return
      redraw({ x: 0.5, y: 0.5 })
      const t = setTimeout(() => redraw(null), SIZE_PREVIEW_MS)
      return () => clearTimeout(t)
      // redraw 每次 render 都是新的函式，只需要在大小改變時執行
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sizeSeq])

    // ---- 畫筆 ----

    const current = (): Stroke[] => {
      const cur = stroke.current!
      return [...cur.base, { ...cur.s, pts: cur.s.pts.slice() }]
    }

    const schedule = () => {
      if (frame.current) return
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        if (stroke.current) onChange(cfg.write(params, current()))
      })
    }

    const cancel = () => {
      if (!stroke.current) return
      stroke.current = null
      cancelAnimationFrame(frame.current)
      frame.current = 0
      cursor.current = null
      // 即時更新的話，畫面要回到這一筆之前
      if (cfg.live) onChange(params)
      redraw(null)
    }

    // 第二根手指（可能落在照片外）= 要縮放照片，不是要畫
    useEffect(() => {
      const onDown = (e: PointerEvent) => {
        if (stroke.current && e.pointerId !== stroke.current.id) cancel()
      }
      window.addEventListener('pointerdown', onDown, true)
      return () => window.removeEventListener('pointerdown', onDown, true)
    })

    const onDown = (e: ReactPointerEvent) => {
      if (stroke.current || !e.isPrimary) return
      const extra = cfg.extra ? cfg.extra() : {}
      if (extra === null) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const p = toLocal(e)
      const erase = useBrush.getState().erase
      stroke.current = {
        id: e.pointerId,
        s: { pts: toSource(p), r: round4(sourceRadius()), ...(erase && !cfg.tapOnly ? { erase: true } : {}), ...extra },
        path: [p],
        base: cfg.read(params),
      }
      cursor.current = p
      if (cfg.live) schedule()
      redraw()
    }

    const onMove = (e: ReactPointerEvent) => {
      const cur = stroke.current
      if (!cur || cur.id !== e.pointerId || cfg.tapOnly) return
      const p = toLocal(e)
      cursor.current = p
      const last = cur.path[cur.path.length - 1]
      const { rect } = measure()
      if (Math.hypot((p.x - last.x) * rect.width, (p.y - last.y) * rect.height) >= MIN_STEP_PX) {
        cur.path.push(p)
        cur.s.pts.push(...toSource(p))
        if (cfg.live) schedule()
      }
      redraw()
    }

    const onUp = (e: ReactPointerEvent) => {
      const cur = stroke.current
      if (!cur || cur.id !== e.pointerId) return
      const strokes = current()
      stroke.current = null
      cancelAnimationFrame(frame.current)
      frame.current = 0
      cursor.current = null
      redraw(null)
      onCommit(cfg.write(params, strokes))
    }

    return (
      <div
        className="brush-overlay"
        ref={rootRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={cancel}
      >
        <canvas className="brush-canvas" ref={canvasRef} />
      </div>
    )
  }
}
