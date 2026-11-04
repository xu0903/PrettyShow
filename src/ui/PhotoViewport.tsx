import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPasses } from '../core/pipeline.ts'
import { getTools } from '../core/registry.ts'
import { selectViewState, useEditor } from '../core/store.ts'
import type { Size } from '../gl/limits.ts'
import type { RenderPass } from '../gl/pass.ts'
import { Renderer } from '../gl/renderer.ts'
import { IconPhoto } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'
import { useLongPress } from './useLongPress.ts'
import { usePinchZoom } from './usePinchZoom.ts'

/** 照片四周留的空間（px） */
const PADDING = 12

/** 等比例縮放到剛好放進容器（contain） */
function containSize(content: Size, box: Size): Size {
  const s = Math.min(box.width / content.width, box.height / content.height)
  return { width: Math.round(content.width * s), height: Math.round(content.height * s) }
}

// 照片區：WebGL 畫布 + 只在這裡有效的雙指縮放 + 長按看原圖
export function PhotoViewport() {
  const photo = useEditor((s) => s.photo)
  const status = useEditor((s) => s.status)
  const error = useEditor((s) => s.error)
  const viewState = useEditor(selectViewState)
  const comparing = useEditor((s) => s.comparing)
  const setComparing = useEditor((s) => s.setComparing)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [outputSize, setOutputSize] = useState<Size | null>(null)
  const [boxSize, setBoxSize] = useState<Size | null>(null)

  usePinchZoom(containerRef, stageRef, photo)
  useLongPress(
    containerRef,
    () => setComparing(true),
    () => setComparing(false),
  )

  // 看原圖時不跑任何步驟
  const passes = useMemo(
    () => (comparing ? [] : buildPasses(viewState, getTools(), { pixelScale: 1 })),
    [viewState, comparing],
  )
  // 最新的步驟放在 ref，給 requestAnimationFrame 和 context 恢復時使用
  const passesRef = useRef<RenderPass[]>(passes)
  const frame = useRef(0)

  const draw = () => {
    const r = rendererRef.current
    if (!r) return
    const size = r.render(passesRef.current)
    setOutputSize((old) => (old && old.width === size.width && old.height === size.height ? old : size))
  }

  // 建立 renderer。canvas 由程式建立：React 開發模式會執行兩次 effect，
  // 若重複使用同一個 canvas，第二次會拿到已經被釋放的 WebGL context。
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !photo) return
    const canvas = document.createElement('canvas')
    canvas.className = 'viewport-canvas'
    stage.appendChild(canvas)
    const renderer = new Renderer(canvas)
    rendererRef.current = renderer
    renderer.onRestored = draw
    renderer.setSource(photo.preview)
    draw()

    return () => {
      cancelAnimationFrame(frame.current)
      renderer.dispose()
      canvas.remove()
      rendererRef.current = null
    }
    // draw 只讀 ref，不需要列為依賴
  }, [photo])

  // 參數改變時重畫；拖滑桿時一個畫面最多畫一次
  useEffect(() => {
    passesRef.current = passes
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      draw()
    })
  }, [passes])

  // 量測照片區大小（旋轉手機、工具面板打開時會變）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBoxSize({ width: width - PADDING * 2, height: height - PADDING * 2 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stageSize = outputSize && boxSize && boxSize.width > 0 ? containSize(outputSize, boxSize) : null

  return (
    <div className="viewport" ref={containerRef}>
      <div className="viewport-stage" ref={stageRef} style={stageSize ?? { width: 0, height: 0 }} />

      {photo && comparing && <div className="compare-badge">原圖</div>}

      {!photo && status !== 'loading' && (
        <div className="viewport-empty">
          <PickPhotoButton className="pick-btn">
            <IconPhoto />
            <span>選擇照片</span>
          </PickPhotoButton>
          {error && <p className="viewport-error">{error}</p>}
        </div>
      )}

      {status === 'loading' && <div className="viewport-loading">讀取中…</div>}
    </div>
  )
}
