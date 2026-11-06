// 拼圖：選 2–9 張照片，選版型、比例、間距、圓角、底色；點格子選取，拖動調整照片位置

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useEditor } from '../../core/store.ts'
import { decodeImage, releaseCanvas, resizeTo } from '../../image/load.ts'
import { ColorRow } from '../ColorRow.tsx'
import type { NamedColor } from '../colors.ts'
import { startExport } from '../exportJob.ts'
import { IconClose, IconPhoto } from '../icons.tsx'
import { Slider } from '../Slider.tsx'
import { toast } from '../toast.ts'
import { coverCrop, MAX_PHOTOS, templatesFor, type Cell } from './templates.ts'
import '../../tools/brush/brush.css'
import './collage.css'

type Ratio = '1:1' | '4:5' | '3:4' | '9:16'
const RATIOS: { id: Ratio; label: string }[] = [
  { id: '1:1', label: '方格' },
  { id: '4:5', label: 'IG 貼文' },
  { id: '3:4', label: 'IG 主頁' },
  { id: '9:16', label: 'IG 限動' },
]
const BG: NamedColor[] = [
  { color: '#ffffff', label: '白' },
  { color: '#111111', label: '黑' },
  { color: '#f3ece1', label: '奶油' },
  { color: '#f6d6dc', label: '粉' },
  { color: '#d8e6d4', label: '抹茶' },
  { color: '#d6e2f0', label: '天空' },
]
/** 每張照片縮到這個長邊（9 張照片同時在記憶體裡） */
const PHOTO_LONG = 1400
/** 匯出的長邊 */
const EXPORT_LONG = 2400

interface Fit {
  zoom: number
  ox: number
  oy: number
}

interface Look {
  cells: Cell[]
  ratio: Ratio
  gap: number // 0..40（短邊的千分比 × 2.5）
  round: number // 0..40
  bg: string
}

const ratioOf = (r: Ratio) => {
  const [w, h] = r.split(':').map(Number)
  return w / h
}

/** 格子在畫布上的實際位置（扣掉間距） */
function cellRect(c: Cell, W: number, H: number, gap: number) {
  const g = (gap / 400) * Math.min(W, H)
  return { x: g + c.x * (W - g), y: g + c.y * (H - g), w: c.w * (W - g) - g, h: c.h * (H - g) - g }
}

function drawCollage(ctx: CanvasRenderingContext2D, photos: HTMLCanvasElement[], fits: Fit[], look: Look, selected: number | null) {
  const { width: W, height: H } = ctx.canvas
  ctx.fillStyle = look.bg
  ctx.fillRect(0, 0, W, H)
  look.cells.forEach((c, i) => {
    const r = cellRect(c, W, H, look.gap)
    const img = photos[i]
    if (!img || r.w <= 0 || r.h <= 0) return
    const f = fits[i] ?? { zoom: 1, ox: 0, oy: 0 }
    const { sx, sy, sw, sh } = coverCrop(img, r, f.zoom, f.ox, f.oy)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(r.x, r.y, r.w, r.h, (look.round / 400) * Math.min(W, H))
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h)
    ctx.restore()
    if (i === selected) {
      ctx.strokeStyle = '#df7a45'
      ctx.lineWidth = Math.max(2, W / 200)
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    }
  })
}

export function Collage() {
  const goHome = useEditor((s) => s.goHome)
  const openPhoto = useEditor((s) => s.openPhoto)
  const [photos, setPhotos] = useState<HTMLCanvasElement[]>([])
  const [loading, setLoading] = useState(false)
  const [tpl, setTpl] = useState(0)
  const [ratio, setRatio] = useState<Ratio>('4:5')
  const [gap, setGap] = useState(12)
  const [round, setRound] = useState(0)
  const [bg, setBg] = useState('#ffffff')
  const [fits, setFits] = useState<Fit[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const drag = useRef<{ id: number; i: number; x: number; y: number; fit: Fit } | null>(null)

  const templates = templatesFor(Math.max(1, photos.length))
  const look: Look = { cells: templates[Math.min(tpl, templates.length - 1)], ratio, gap, round, bg }

  // 離開時釋放照片
  useEffect(() => () => photos.forEach(releaseCanvas), [photos])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ width: e.contentRect.width, height: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 畫面上的大小：照比例塞進可用的空間
  const k = ratioOf(ratio)
  const viewW = Math.max(1, Math.min(box.width - 24, (box.height - 24) * k))
  const viewH = viewW / k
  const dpr = window.devicePixelRatio || 1

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !photos.length) return
    c.width = Math.round(viewW * dpr)
    c.height = Math.round(viewH * dpr)
    drawCollage(c.getContext('2d')!, photos, fits, look, selected)
  })

  const pick = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, MAX_PHOTOS)
    if (!list.length) return
    if ((files?.length ?? 0) > MAX_PHOTOS) toast(`最多 ${MAX_PHOTOS} 張，只用前 ${MAX_PHOTOS} 張`)
    setLoading(true)
    try {
      const loaded = await Promise.all(
        list.map(async (f) => {
          const img = await decodeImage(f)
          const s = Math.min(1, PHOTO_LONG / Math.max(img.naturalWidth, img.naturalHeight))
          return resizeTo(Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight }), {
            width: Math.round(img.naturalWidth * s),
            height: Math.round(img.naturalHeight * s),
          })
        }),
      )
      setPhotos(loaded)
      setFits(loaded.map(() => ({ zoom: 1, ox: 0, oy: 0 })))
      setTpl(0)
      setSelected(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : '照片讀取失敗')
    } finally {
      setLoading(false)
    }
  }

  /** 手指在畫布上的位置 → 第幾格 */
  const hit = (e: PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) * dpr
    const y = (e.clientY - r.top) * dpr
    return look.cells.findIndex((c) => {
      const cr = cellRect(c, viewW * dpr, viewH * dpr, gap)
      return x >= cr.x && x <= cr.x + cr.w && y >= cr.y && y <= cr.y + cr.h
    })
  }

  const onDown = (e: PointerEvent) => {
    const i = hit(e)
    if (i < 0) return setSelected(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelected(i)
    drag.current = { id: e.pointerId, i, x: e.clientX, y: e.clientY, fit: fits[i] }
  }

  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const img = photos[d.i]
    const cr = cellRect(look.cells[d.i], viewW, viewH, gap)
    const { sw, sh } = coverCrop(img, cr, d.fit.zoom, 0, 0)
    // 手指往右拖 = 看到照片更左邊的地方
    const slackX = (img.width - sw) / 2
    const slackY = (img.height - sh) / 2
    const ox = slackX > 0 ? d.fit.ox - ((e.clientX - d.x) * (sw / cr.w)) / slackX : 0
    const oy = slackY > 0 ? d.fit.oy - ((e.clientY - d.y) * (sh / cr.h)) / slackY : 0
    const next = [...fits]
    next[d.i] = { ...d.fit, ox: Math.min(1, Math.max(-1, ox)), oy: Math.min(1, Math.max(-1, oy)) }
    setFits(next)
  }

  const onUp = (e: PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  const render = async (): Promise<{ file: File; width: number; height: number }> => {
    const W = ratioOf(ratio) >= 1 ? EXPORT_LONG : Math.round(EXPORT_LONG * ratioOf(ratio))
    const H = Math.round(W / ratioOf(ratio))
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    drawCollage(c.getContext('2d')!, photos, fits, look, null)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92))
    c.width = c.height = 0
    if (!blob) throw new Error('拼圖產生失敗')
    return { file: new File([blob], `拼圖_${Date.now()}.jpg`, { type: 'image/jpeg' }), width: W, height: H }
  }

  const save = () => startExport(render().then((r) => ({ ...r, url: URL.createObjectURL(r.file) })))

  const edit = async () => openPhoto((await render()).file, 'beautify')

  const zoom = selected !== null ? (fits[selected]?.zoom ?? 1) : null
  const setZoom = (v: number) => {
    if (selected === null) return
    const next = [...fits]
    next[selected] = { ...next[selected], zoom: v / 100 }
    setFits(next)
  }

  return (
    <div className="collage">
      <header className="ed-top">
        <div className="ed-top-side">
          <button className="icon-btn" aria-label="回首頁" onClick={goHome}>
            <IconClose />
          </button>
        </div>
        <div className="collage-title">拼圖</div>
        <div className="ed-top-side is-right">
          {photos.length > 0 && (
            <button className="ed-save" onClick={save}>
              儲存
            </button>
          )}
        </div>
      </header>

      <main className="collage-main" ref={boxRef}>
        {photos.length ? (
          <canvas
            ref={canvasRef}
            className="collage-canvas"
            style={{ width: viewW, height: viewH }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        ) : (
          <div className="page-empty">
            <p>{loading ? '讀取中…' : `選 2–${MAX_PHOTOS} 張照片`}</p>
            <label className="pick-btn">
              <input type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
              <IconPhoto />
              <span>選擇照片</span>
            </label>
          </div>
        )}
      </main>

      {photos.length > 0 && (
        <div className="bottom collage-panel">
          {zoom !== null ? (
            <Slider label="縮放" value={Math.round(zoom * 100)} min={100} max={300} defaultValue={100} onChange={setZoom} onCommit={setZoom} />
          ) : (
            <p className="brush-hint">點格子可以調整照片的位置和大小</p>
          )}
          <div className="collage-templates">
            {templates.map((t, i) => (
              <button key={i} className="collage-tpl" aria-pressed={i === tpl} onClick={() => setTpl(i)}>
                <svg viewBox="0 0 40 40">
                  {t.map((c, j) => (
                    <rect key={j} x={c.x * 40 + 1.5} y={c.y * 40 + 1.5} width={c.w * 40 - 3} height={c.h * 40 - 3} rx="2" />
                  ))}
                </svg>
              </button>
            ))}
          </div>
          <div className="chip-row">
            {RATIOS.map((r) => (
              <button key={r.id} className="chip" aria-pressed={ratio === r.id} onClick={() => setRatio(r.id)}>
                {r.label}
              </button>
            ))}
            <label className="chip collage-repick">
              <input type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
              重選照片
            </label>
          </div>
          <div className="brush-size">
            <span className="brush-size-label brush-row-label">間距</span>
            <Slider label="間距" value={gap} min={0} max={40} defaultValue={12} onChange={setGap} onCommit={setGap} />
          </div>
          <div className="brush-size">
            <span className="brush-size-label brush-row-label">圓角</span>
            <Slider label="圓角" value={round} min={0} max={40} defaultValue={0} onChange={setRound} onCommit={setRound} />
          </div>
          <ColorRow colors={BG} value={bg} onPick={setBg} onPreview={setBg} />
          <div className="collage-actions">
            <button className="sheet-close" onClick={() => void edit()}>
              拿去修圖
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
