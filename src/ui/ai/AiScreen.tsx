// AI 修圖畫面：選照片 → 選選項（消除路人要先塗）→ 生成 → 比較、儲存或拿去修圖

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AI_TASKS, aiEdit, aiReady, prepareImage } from '../../core/ai.ts'
import { useEditor } from '../../core/store.ts'
import { inpaint, useInpaintStatus } from '../../image/inpaint.ts'
import { decodeImage, releaseCanvas, resizeTo } from '../../image/load.ts'
import { startExport } from '../exportJob.ts'
import { IconClose, IconCompare, IconPhoto } from '../icons.tsx'
import { Slider } from '../Slider.tsx'
import '../../tools/brush/brush.css'
import './ai.css'

/** 消除路人：塗的筆跡（照片 0..1 座標）和筆刷大小（照片寬度的比例） */
interface Mark {
  pts: number[]
  r: number
}

/** 手機上消除時，照片的長邊（模型自己會在塗的範圍附近裁切、縮放，這裡只是限制記憶體） */
const LOCAL_LONG = 2048

/** 在手機上用 MI-GAN 消除塗到的地方（免費、不用網路） */
async function localRemove(file: Blob, marks: Mark[]): Promise<Blob> {
  const img = await decodeImage(file)
  const s = Math.min(1, LOCAL_LONG / Math.max(img.naturalWidth, img.naturalHeight))
  const c = resizeTo(Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight }), {
    width: Math.round(img.naturalWidth * s),
    height: Math.round(img.naturalHeight * s),
  })
  const { width: w, height: h } = c
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const rgba = ctx.getImageData(0, 0, w, h).data
  // 塗的地方畫成遮罩：255 保留、0 要補
  const mc = document.createElement('canvas')
  mc.width = w
  mc.height = h
  const m = mc.getContext('2d', { willReadFrequently: true })!
  m.strokeStyle = m.fillStyle = '#fff'
  m.lineCap = m.lineJoin = 'round'
  for (const mk of marks) {
    m.lineWidth = mk.r * 2 * w
    m.beginPath()
    for (let i = 0; i < mk.pts.length; i += 2) (i ? m.lineTo : m.moveTo).call(m, mk.pts[i] * w, mk.pts[i + 1] * h)
    if (mk.pts.length === 2) m.arc(mk.pts[0] * w, mk.pts[1] * h, mk.r * w, 0, Math.PI * 2)
    m.stroke()
    m.fill()
  }
  const md = m.getImageData(0, 0, w, h).data
  mc.width = mc.height = 0
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4 + 3] > 8 ? 0 : 255
  const out = await inpaint(rgba, mask, w, h)
  ctx.putImageData(new ImageData(out, w, h), 0, 0)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.93))
  releaseCanvas(c)
  if (!blob) throw new Error('消除失敗')
  return blob
}

export function AiScreen() {
  const taskId = useEditor((s) => s.aiTask)
  const task = AI_TASKS.find((t) => t.id === taskId) ?? AI_TASKS[0]
  const goHome = useEditor((s) => s.goHome)
  const setHomeTab = useEditor((s) => s.setHomeTab)
  const openPhoto = useEditor((s) => s.openPhoto)
  const [file, setFile] = useState<File | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [option, setOption] = useState(task.options[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null)
  const [comparing, setComparing] = useState(false)
  const [marks, setMarks] = useState<Mark[]>([])
  const [brush, setBrush] = useState(6) // 照片寬度的 %
  // 照片原始尺寸：筆跡的座標系統用它，粗細才不會因為長寬比被拉扁
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const imgRef = useRef<HTMLImageElement>(null)
  const drawing = useRef<{ id: number; mark: Mark } | null>(null)
  const ready = aiReady()
  // 消除路人在手機上做，不用設定 AI 服務；其他功能要 Worker
  const local = task.id === 'remove'
  const usable = local || ready
  const inpaintState = useInpaintStatus((s) => s.state)

  // 釋放圖片網址
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src])
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result])

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setSrc(URL.createObjectURL(f))
    setResult(null)
    setMarks([])
    setError(null)
  }

  const generate = async (useGemini = false) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      if (local && !useGemini) {
        const blob = await localRemove(file, marks)
        setResult({ blob, url: URL.createObjectURL(blob) })
        return
      }
      const image = await prepareImage(file, (ctx, w, h) => {
        // 消除路人：把塗的地方用半透明紅色畫上去，AI 依紅色的範圍消除
        if (task.id !== 'remove') return
        ctx.strokeStyle = ctx.fillStyle = 'rgba(255, 0, 0, 0.55)'
        ctx.lineCap = ctx.lineJoin = 'round'
        for (const m of marks) {
          ctx.lineWidth = m.r * 2 * w
          ctx.beginPath()
          for (let i = 0; i < m.pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, m.pts[i] * w, m.pts[i + 1] * h)
          if (m.pts.length === 2) ctx.arc(m.pts[0] * w, m.pts[1] * h, m.r * w, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
      const blob = await aiEdit(task.id, option, image)
      setResult({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const resultFile = () => new File([result!.blob], `AI_${Date.now()}.${result!.blob.type.includes('png') ? 'png' : 'jpg'}`, { type: result!.blob.type })

  const save = () => {
    const f = resultFile()
    startExport(
      decodeImage(f).then((img) => ({ file: f, width: img.naturalWidth, height: img.naturalHeight, url: URL.createObjectURL(f) })),
    )
  }

  // ---- 消除路人的塗抹 ----
  const toPhoto = (e: PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  const onDown = (e: PointerEvent) => {
    if (task.id !== 'remove' || result || busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = { id: e.pointerId, mark: { pts: toPhoto(e), r: brush / 200 } }
    setMarks([...marks, drawing.current.mark])
  }
  const onMove = (e: PointerEvent) => {
    const d = drawing.current
    if (!d || d.id !== e.pointerId) return
    d.mark = { ...d.mark, pts: [...d.mark.pts, ...toPhoto(e)] }
    setMarks([...marks.slice(0, -1), d.mark])
  }
  const onUp = (e: PointerEvent) => {
    if (drawing.current?.id === e.pointerId) drawing.current = null
  }

  const shown = result && !comparing ? result.url : src

  return (
    <div className="ai-screen">
      <header className="ed-top">
        <div className="ed-top-side">
          <button className="icon-btn" aria-label="回首頁" onClick={goHome}>
            <IconClose />
          </button>
        </div>
        <div className="collage-title">{task.label}</div>
        <div className="ed-top-side is-right">
          {result && (
            <button className="ed-save" onClick={save}>
              儲存
            </button>
          )}
        </div>
      </header>

      <main className="ai-main">
        {!usable ? (
          <div className="page-empty">
            <p>還沒設定 AI 服務</p>
            <button
              className="pick-btn"
              onClick={() => {
                setHomeTab('me')
                goHome()
              }}
            >
              到「我」設定
            </button>
          </div>
        ) : !src ? (
          <div className="page-empty">
            <p>{task.desc}</p>
            <label className="pick-btn">
              <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <IconPhoto />
              <span>選擇照片</span>
            </label>
          </div>
        ) : (
          <div className="ai-photo" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <img
              ref={imgRef}
              src={shown!}
              alt=""
              draggable={false}
              onLoad={(e) => !result && setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            {task.id === 'remove' && !result && (
              <svg className="ai-marks" viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none">
                {marks.map((m, i) => (
                  <polyline
                    key={i}
                    points={Array.from({ length: m.pts.length / 2 }, (_, k) => `${m.pts[k * 2] * natural.w},${m.pts[k * 2 + 1] * natural.h}`).join(' ')}
                    strokeWidth={m.r * 2 * natural.w}
                  />
                ))}
              </svg>
            )}
            {busy && (
              <div className="ai-busy">
                <div className="export-spinner" />
                <span>
                  {local && inpaintState === 'downloading'
                    ? '第一次使用，正在下載消除模型（約 40MB）…'
                    : local && inpaintState === 'running'
                      ? 'AI 消除中，幾秒鐘就好…'
                      : 'AI 處理中，大約 10–30 秒…'}
                </span>
              </div>
            )}
            {result && (
              <button
                className="compare-btn"
                aria-label="按住看原圖"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setComparing(true)
                }}
                onPointerUp={() => setComparing(false)}
                onPointerCancel={() => setComparing(false)}
              >
                <IconCompare />
              </button>
            )}
          </div>
        )}
      </main>

      {usable && src && (
        <div className="bottom ai-panel">
          {!result && (
            <>
              {task.options.length > 1 && (
                <div className="chip-row">
                  {task.options.map((o) => (
                    <button key={o.id} className="chip" aria-pressed={option === o.id} onClick={() => setOption(o.id)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {task.id === 'remove' && (
                <>
                  <div className="brush-size">
                    <span className="brush-size-label brush-row-label">筆刷</span>
                    <Slider label="筆刷大小" value={brush} min={2} max={20} defaultValue={6} onChange={setBrush} onCommit={setBrush} />
                  </div>
                  <p className="brush-hint">用手指塗滿要消除的人或東西{marks.length ? '' : '，再按「開始生成」'}</p>
                </>
              )}
            </>
          )}
          {error && <p className="export-error">{error}</p>}
          <div className="ai-actions">
            {result ? (
              <>
                <button className="sheet-close" onClick={() => setResult(null)}>
                  再試一次
                </button>
                {local && ready && (
                  <button className="sheet-close" disabled={busy} onClick={() => void generate(true)}>
                    用 Gemini
                  </button>
                )}
                <button className="export-primary" onClick={() => void openPhoto(resultFile(), task.id === 'style' ? 'beautify' : 'portrait')}>
                  拿去修圖
                </button>
              </>
            ) : (
              <>
                {task.id === 'remove' && marks.length > 0 && (
                  <button className="sheet-close" onClick={() => setMarks([])} disabled={busy}>
                    清除塗抹
                  </button>
                )}
                <label className="sheet-close ai-repick">
                  <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
                  換照片
                </label>
                <button className="export-primary" disabled={busy || (local && marks.length === 0)} onClick={() => void generate()}>
                  開始生成
                </button>
              </>
            )}
          </div>
          <p className="ai-cost">
            {local ? '在手機上處理，免費、不限次數；效果不夠好可以改用 Gemini' : '每次生成會用到你的 AI 額度（約 NT$1–4／張）'}
          </p>
        </div>
      )}
    </div>
  )
}
