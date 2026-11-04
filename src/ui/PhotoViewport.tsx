import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../core/store.ts'
import type { Size } from '../gl/limits.ts'
import { Renderer } from '../gl/renderer.ts'
import { IconPhoto } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'
import { usePinchZoom } from './usePinchZoom.ts'

/** 照片四周留的空間（px） */
const PADDING = 12

/** 等比例縮放到剛好放進容器（contain） */
function containSize(content: Size, box: Size): Size {
  const s = Math.min(box.width / content.width, box.height / content.height)
  return { width: Math.round(content.width * s), height: Math.round(content.height * s) }
}

// 照片區：WebGL 畫布 + 只在這裡有效的雙指縮放
export function PhotoViewport() {
  const photo = useEditor((s) => s.photo)
  const status = useEditor((s) => s.status)
  const error = useEditor((s) => s.error)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [outputSize, setOutputSize] = useState<Size | null>(null)
  const [boxSize, setBoxSize] = useState<Size | null>(null)

  usePinchZoom(containerRef, stageRef, photo)

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

    const draw = () => setOutputSize(renderer.render([]))
    renderer.onRestored = draw
    renderer.setSource(photo.preview)
    draw()

    return () => {
      renderer.dispose()
      canvas.remove()
      rendererRef.current = null
    }
  }, [photo])

  // 量測照片區大小（旋轉手機、safe area 改變時會變）
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
