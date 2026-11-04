import { useEffect, useRef, useState } from 'react'
import { buildPasses, paramsOf, prepareTools } from '../core/pipeline.ts'
import { getTool, getTools } from '../core/registry.ts'
import { selectViewState, useEditor } from '../core/store.ts'
import type { Size } from '../gl/limits.ts'
import { Renderer } from '../gl/renderer.ts'
import { IconPhoto } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'
import { useLongPress } from './useLongPress.ts'
import { usePinchZoom } from './usePinchZoom.ts'

/** 照片四周留的空間（px）；有操作層（裁切框）時留多一點，把手才不會貼齊螢幕邊緣 */
const PADDING = 12
const OVERLAY_PADDING = 28

/** 等比例縮放到剛好放進容器（contain） */
function containSize(content: Size, box: Size): Size {
  const s = Math.min(box.width / content.width, box.height / content.height)
  return { width: Math.round(content.width * s), height: Math.round(content.height * s) }
}

// 照片區：WebGL 畫布 + 只在這裡有效的雙指縮放 + 長按看原圖 + 工具的操作層
export function PhotoViewport() {
  const photo = useEditor((s) => s.photo)
  const status = useEditor((s) => s.status)
  const error = useEditor((s) => s.error)
  const viewState = useEditor(selectViewState)
  const comparing = useEditor((s) => s.comparing)
  const activeToolId = useEditor((s) => s.activeToolId)
  const setComparing = useEditor((s) => s.setComparing)
  const previewTool = useEditor((s) => s.previewTool)
  const commitTool = useEditor((s) => s.commitTool)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [outputSize, setOutputSize] = useState<Size | null>(null)
  const [boxSize, setBoxSize] = useState<Size | null>(null)

  const activeTool = photo && activeToolId ? getTool(activeToolId) : undefined
  const Overlay = activeTool?.Overlay
  // 有操作層時，照片區的手勢交給操作層
  const gestures = !Overlay

  usePinchZoom(containerRef, stageRef, photo, gestures)
  useLongPress(
    containerRef,
    () => setComparing(true),
    () => setComparing(false),
    gestures,
  )

  const frame = useRef(0)

  /** 用 store 最新的狀態重畫（不依賴 React render，所以 LUT 下載完、context 恢復時也能直接呼叫） */
  const draw = () => {
    const r = rendererRef.current
    if (!r) return
    const s = useEditor.getState()
    const passes = s.comparing
      ? []
      : buildPasses(
          selectViewState(s),
          getTools(),
          { pixelScale: 1, photo: s.photo ?? undefined },
          { activeToolId: s.activeToolId },
        )
    const size = r.render(passes)
    setOutputSize((old) => (old && old.width === size.width && old.height === size.height ? old : size))
  }

  /** 排到下一個畫面再畫；拖滑桿時一個畫面最多畫一次 */
  const scheduleDraw = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      draw()
    })
  }

  // 建立 renderer。canvas 由程式建立：React 開發模式會執行兩次 effect，
  // 若重複使用同一個 canvas，第二次會拿到已經被釋放的 WebGL context。
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !photo) return
    const canvas = document.createElement('canvas')
    canvas.className = 'viewport-canvas'
    stage.prepend(canvas)
    const renderer = new Renderer(canvas)
    rendererRef.current = renderer
    renderer.onRestored = draw
    renderer.setSource(photo.preview)
    draw()

    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      renderer.dispose()
      canvas.remove()
      rendererRef.current = null
    }
  }, [photo])

  // 參數、看原圖、切換工具時重畫；需要的資源（例如 LUT）準備好後再畫一次
  useEffect(() => {
    scheduleDraw()
    const task = { alive: true }
    prepareTools(viewState, getTools(), { activeToolId, photo: photo ?? undefined })
      .then(() => task.alive && scheduleDraw())
      .catch((e) => console.warn('工具資源載入失敗', e))
    return () => {
      task.alive = false
    }
  }, [viewState, comparing, activeToolId, photo])

  // 量測照片區大小（旋轉手機、工具面板打開時會變）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBoxSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = Overlay ? OVERLAY_PADDING : PADDING
  const stageSize =
    outputSize && boxSize && boxSize.width > pad * 2
      ? containSize(outputSize, { width: boxSize.width - pad * 2, height: boxSize.height - pad * 2 })
      : null

  return (
    <div className="viewport" ref={containerRef}>
      <div className="viewport-stage" ref={stageRef} style={stageSize ?? { width: 0, height: 0 }}>
        {Overlay && activeTool && stageSize && (
          <Overlay
            params={paramsOf(viewState, activeTool)}
            onChange={(p) => previewTool(activeTool.id, p)}
            onCommit={(p) => commitTool(activeTool.id, p)}
            stageSize={stageSize}
          />
        )}
      </div>

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
