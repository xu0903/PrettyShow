// 相機：即時預覽濾鏡和美顏，拍下來直接進編輯器（濾鏡、美顏會變成可以再調整的設定，不是燒死在照片上）

import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { copyPass, FRAGMENT_HEADER, type RenderPass, type Texture2DSource } from '../../gl/pass.ts'
import { Renderer } from '../../gl/renderer.ts'
import { bilateralFragment } from '../../tools/beauty/shaders.ts'
import { getLoadedLut, loadLut } from '../../tools/filter/lutCache.ts'
import { lutPass } from '../../tools/filter/pass.ts'
import { FILTERS } from '../../tools/filter/presets.ts'
import { IconClose, IconFace, IconRotateLeft } from '../icons.tsx'
import { toast } from '../toast.ts'
import './camera.css'

type Facing = 'user' | 'environment'

/** 預覽畫面的長邊 */
const PREVIEW_LONG = 1280
/** 預覽時的濾鏡強度（拍下來之後在編輯器還可以調） */
const INTENSITY = 0.8
/** 美顏預覽：整個畫面輕輕磨皮、提亮（拍下來後改用找臉的真正美顏） */
const FULL_MASK: Texture2DSource = { kind: '2d', key: 'camera/full', width: 1, height: 1, data: new Uint8Array([255]) }
const brightenFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
void main() {
  vec4 c = texture(u_image, v_uv);
  outColor = vec4(1.0 - (1.0 - c.rgb) * 0.92, c.a);
}`

/** 相機只列出部分濾鏡，避免一排太長 */
const CAMERA_FILTERS = ['kmilk', 'kpeach', 'kfilm', 'fuji', 'kodak', 'polaroid', 'clear', 'mint', 'ice', 'mono']

export function Camera() {
  const goHome = useEditor((s) => s.goHome)
  const openPhoto = useEditor((s) => s.openPhoto)
  const commitPatch = useEditor((s) => s.commitPatch)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [filter, setFilter] = useState<string | null>(null)
  const [beauty, setBeauty] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 畫每一幀時要讀到最新的選擇，用 ref 免得重建迴圈
  const settings = useRef({ filter, beauty })
  useEffect(() => {
    settings.current = { filter, beauty }
    if (filter) void loadLut(filter)
  }, [filter, beauty])

  // 開相機 + 每一幀畫到 WebGL
  useEffect(() => {
    const video = videoRef.current!
    const stage = stageRef.current!
    // 非同步開好相機後才有 stream、renderer；放在同一個物件裡，清理時才拿得到
    const cam: { stream: MediaStream | null; renderer: Renderer | null; frame: number } = { stream: null, renderer: null, frame: 0 }
    const canvas = document.createElement('canvas')
    canvas.className = 'camera-canvas'
    if (facing === 'user') canvas.classList.add('is-mirror')
    stage.prepend(canvas)
    const task = { alive: true }

    const draw = () => {
      cam.frame = requestAnimationFrame(draw)
      const renderer = cam.renderer
      if (!renderer || video.readyState < 2 || !video.videoWidth) return
      renderer.updateSource(video, video.videoWidth, video.videoHeight)
      // 先縮小到長邊 1280 再處理，iPhone 才跑得動 60fps
      const k = Math.min(1, PREVIEW_LONG / Math.max(video.videoWidth, video.videoHeight))
      const passes: RenderPass[] = [
        { ...copyPass, id: 'camera/scale', outputSize: (s) => ({ width: Math.round(s.width * k), height: Math.round(s.height * k) }) },
      ]
      const { filter: f, beauty: b } = settings.current
      if (b) {
        const blur = (dir: [number, number]) => ({
          id: `camera/smooth-${dir[0]}`,
          fragment: bilateralFragment,
          uniforms: { u_dir: dir, u_radius: 4, u_sigma: 0.07 },
          textures: { u_mask: FULL_MASK, u_brushSmooth: FULL_MASK },
        })
        passes.push(blur([1, 0]), blur([0, 1]), { id: 'camera/brighten', fragment: brightenFragment })
      }
      const lut = f ? getLoadedLut(f) : undefined
      if (f && lut) passes.push(lutPass(f, lut, INTENSITY))
      renderer.render(passes)
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // 每一幀都要上傳到 GPU，太大會卡；1920×1440 預覽順、拍下來也夠清楚
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (!task.alive) return stream.getTracks().forEach((t) => t.stop())
        cam.stream = stream
        video.srcObject = stream
        await video.play()
        cam.renderer = new Renderer(canvas)
        draw()
      } catch (e) {
        console.warn('相機打不開', e)
        if (task.alive) setError('打不開相機：請到 iPhone 的「設定 → Safari → 相機」允許使用，再重新打開')
      }
    })()

    return () => {
      task.alive = false
      cancelAnimationFrame(cam.frame)
      cam.stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      cam.renderer?.dispose()
      canvas.remove()
    }
  }, [facing])

  const shoot = async () => {
    const video = videoRef.current!
    if (!video.videoWidth || busy) return
    setBusy(true)
    try {
      // 拍原始畫面（濾鏡、美顏之後在編輯器套用，才能再調整）；前鏡頭左右翻轉成看到的樣子
      const c = document.createElement('canvas')
      c.width = video.videoWidth
      c.height = video.videoHeight
      const ctx = c.getContext('2d')!
      if (facing === 'user') {
        ctx.translate(c.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.95))
      c.width = c.height = 0
      if (!blob) throw new Error('拍照失敗')
      const file = new File([blob], `相機_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const { filter: f, beauty: b } = settings.current
      await openPhoto(file, facing === 'user' ? 'portrait' : 'beautify')
      // 把相機上選的效果變成編輯設定
      const patch: Record<string, unknown> = {}
      if (f) patch.filter = { lut: f, intensity: INTENSITY * 100 }
      if (b) patch.beauty = { smooth: 40, whiten: 15, manual: [] }
      if (Object.keys(patch).length) commitPatch(patch)
    } catch (e) {
      toast(e instanceof Error ? e.message : '拍照失敗')
      setBusy(false)
    }
  }

  return (
    <div className="camera on-dark">
      <div className="camera-stage" ref={stageRef}>
        <video ref={videoRef} playsInline muted className="camera-video" />
        {error && <p className="camera-error">{error}</p>}
      </div>
      <header className="camera-top">
        <button className="icon-btn" aria-label="關閉" onClick={goHome}>
          <IconClose />
        </button>
        <button className="icon-btn" aria-label="切換鏡頭" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          <IconRotateLeft />
        </button>
      </header>
      <div className="camera-bottom">
        <div className="chip-row camera-filters">
          <button className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            原圖
          </button>
          {CAMERA_FILTERS.map((id) => (
            <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {FILTERS.find((f) => f.id === id)?.name}
            </button>
          ))}
        </div>
        <div className="camera-controls">
          <button className="camera-side" aria-pressed={beauty} onClick={() => setBeauty(!beauty)}>
            <IconFace />
            <span>美顏</span>
          </button>
          <button className="camera-shutter" aria-label="拍照" disabled={busy || !!error} onClick={() => void shoot()} />
          <span className="camera-side" />
        </div>
      </div>
    </div>
  )
}
