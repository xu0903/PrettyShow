// AI 修圖畫面：選照片 → 選選項（消除路人要先塗）→ 生成 → 比較、儲存或拿去修圖

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AI_TASKS, aiEdit, aiReady, prepareImage } from '../../core/ai.ts'
import { useEditor } from '../../core/store.ts'
import { inpaint, useInpaintStatus } from '../../image/inpaint.ts'
import { decodeImage, releaseCanvas, resizeTo } from '../../image/load.ts'
import { startExport } from '../exportJob.ts'
import { IconBrush, IconClose, IconCompare, IconEraser, IconPhoto, IconRedo, IconUndo } from '../icons.tsx'
import { Slider } from '../Slider.tsx'
import { usePinchZoom } from '../usePinchZoom.ts'
import '../../tools/brush/brush.css'
import './ai.css'

/** 消除路人：塗的筆跡（照片 0..1 座標）和筆刷大小（照片寬度的比例）；erase 是橡皮擦，把塗過的地方擦掉 */
interface Mark {
  pts: number[]
  r: number
  erase?: boolean
}

/** 把筆跡依序畫到畫布上：塗的用 color，橡皮擦把已經塗的挖掉 */
function paintMarks(ctx: CanvasRenderingContext2D, marks: Mark[], w: number, h: number, color: string) {
  ctx.strokeStyle = ctx.fillStyle = color
  ctx.lineCap = ctx.lineJoin = 'round'
  for (const mk of marks) {
    ctx.globalCompositeOperation = mk.erase ? 'destination-out' : 'source-over'
    ctx.lineWidth = mk.r * 2 * w
    ctx.beginPath()
    if (mk.pts.length === 2) {
      // 只點一下：畫一個圓點
      ctx.arc(mk.pts[0] * w, mk.pts[1] * h, mk.r * w, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    for (let i = 0; i < mk.pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, mk.pts[i] * w, mk.pts[i + 1] * h)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** 有沒有真的塗到東西（全部被擦掉就不用生成） */
const hasPaint = (marks: Mark[]) => marks.some((m) => !m.erase)

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
  paintMarks(m, marks, w, h, '#fff')
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
  // 塗抹紀錄：marks 是目前的筆跡，past／future 是復原、重做用的快照
  const [strokes, setStrokes] = useState<{ marks: Mark[]; past: Mark[][]; future: Mark[][] }>({ marks: [], past: [], future: [] })
  const marks = strokes.marks
  const [brush, setBrush] = useState(6) // 沒放大時照片寬度的 %（放大後筆刷跟著變細，才能塗細節）
  const [erasing, setErasing] = useState(false)
  // 照片原始尺寸：筆跡的座標系統用它，粗細才不會因為長寬比被拉扁
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const mainRef = useRef<HTMLElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // before：這一筆開始前的紀錄，第二根手指放下來（要縮放）時用來取消這一筆
  const drawing = useRef<{ id: number; mark: Mark; before: typeof strokes } | null>(null)
  const fingers = useRef(new Set<number>())
  const ready = aiReady()
  // 消除路人在手機上做，不用設定 AI 服務；其他功能要 Worker
  const local = task.id === 'remove'
  const usable = local || ready
  const inpaintState = useInpaintStatus((s) => s.state)
  // 塗抹時單指留給筆刷、兩指縮放移動；看結果時單指也可以拖、雙擊放大
  const painting = task.id === 'remove' && !result
  usePinchZoom(mainRef, photoRef, src, usable && !!src, painting)

  // 釋放圖片網址
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src])
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result])

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setSrc(URL.createObjectURL(f))
    setResult(null)
    setStrokes({ marks: [], past: [], future: [] })
    setErasing(false)
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
        // （先畫在另一張畫布上，橡皮擦才不會把照片也挖掉）
        if (task.id !== 'remove') return
        const mc = document.createElement('canvas')
        mc.width = w
        mc.height = h
        paintMarks(mc.getContext('2d')!, marks, w, h, '#f00')
        ctx.globalAlpha = 0.55
        ctx.drawImage(mc, 0, 0)
        ctx.globalAlpha = 1
        mc.width = mc.height = 0
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
  // 手指數量在整個照片區算（第二根手指可能放在照片外面）
  const onFingerDown = (e: PointerEvent) => {
    fingers.current.add(e.pointerId)
    if (fingers.current.size > 1 && drawing.current) {
      // 第二根手指：要縮放，不是要塗，把第一根手指剛開始的那一筆收回
      setStrokes(drawing.current.before)
      drawing.current = null
    }
  }
  const onFingerUp = (e: PointerEvent) => void fingers.current.delete(e.pointerId)
  const onDown = (e: PointerEvent) => {
    if (!painting || busy || fingers.current.size > 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    // 筆刷大小以螢幕為準：放大幾倍，換算成照片上就細幾倍
    const zoom = imgRef.current!.getBoundingClientRect().width / imgRef.current!.offsetWidth
    const mark: Mark = { pts: toPhoto(e), r: brush / 200 / zoom, ...(erasing ? { erase: true } : {}) }
    drawing.current = { id: e.pointerId, mark, before: strokes }
    // 每一筆是一個復原步驟；畫新的一筆就不能再重做
    setStrokes({ marks: [...marks, mark], past: [...strokes.past, marks], future: [] })
  }
  const onMove = (e: PointerEvent) => {
    const d = drawing.current
    if (!d || d.id !== e.pointerId) return
    d.mark = { ...d.mark, pts: [...d.mark.pts, ...toPhoto(e)] }
    setStrokes((s) => ({ ...s, marks: [...s.marks.slice(0, -1), d.mark] }))
  }
  const undo = () =>
    setStrokes((s) => (s.past.length ? { marks: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.marks, ...s.future] } : s))
  const redo = () =>
    setStrokes((s) => (s.future.length ? { marks: s.future[0], past: [...s.past, s.marks], future: s.future.slice(1) } : s))
  // 清除也算一步，按復原可以拿回來
  const clearMarks = () => setStrokes((s) => ({ marks: [], past: [...s.past, s.marks], future: [] }))
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

      <main
        className="ai-main on-dark"
        ref={mainRef}
        onPointerDownCapture={onFingerDown}
        onPointerUpCapture={onFingerUp}
        onPointerCancelCapture={onFingerUp}
      >
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
          <>
            <div className="ai-photo" ref={photoRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <img
                ref={imgRef}
                src={shown!}
                alt=""
                draggable={false}
                onLoad={(e) => !result && setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              {task.id === 'remove' && !result && (
                <svg className="ai-marks" viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none">
                  {/* 塗的畫白、擦的畫黑，當成遮罩蓋一層半透明的顏色：後面的筆會蓋過前面的 */}
                  <mask id="ai-marks-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={natural.w} height={natural.h}>
                    {marks.map((m, i) => {
                      // 只點一下的話重複一個點，圓頭線條才會畫出圓點
                      const pts = m.pts.length === 2 ? [...m.pts, ...m.pts] : m.pts
                      return (
                        <polyline
                          key={i}
                          points={Array.from({ length: pts.length / 2 }, (_, k) => `${pts[k * 2] * natural.w},${pts[k * 2 + 1] * natural.h}`).join(' ')}
                          stroke={m.erase ? '#000' : '#fff'}
                          strokeWidth={m.r * 2 * natural.w}
                        />
                      )
                    })}
                  </mask>
                  <rect className="ai-marks-fill" width={natural.w} height={natural.h} mask="url(#ai-marks-mask)" />
                </svg>
              )}
            </div>
            {/* 放在照片外面：照片放大時，轉圈圈和比較按鈕不會跟著變大 */}
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
          </>
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
                  <div className="brush-controls">
                    <div className="brush-modes">
                      <button className="brush-mode" aria-pressed={!erasing} aria-label="畫筆" onClick={() => setErasing(false)}>
                        <IconBrush />
                      </button>
                      <button className="brush-mode" aria-pressed={erasing} aria-label="橡皮擦" onClick={() => setErasing(true)}>
                        <IconEraser />
                      </button>
                    </div>
                    <div className="brush-size">
                      <Slider label="筆刷大小" value={brush} min={2} max={20} defaultValue={6} onChange={setBrush} onCommit={setBrush} />
                    </div>
                    <div className="brush-modes">
                      <button className="brush-mode" aria-label="復原塗抹" disabled={!strokes.past.length || busy} onClick={undo}>
                        <IconUndo />
                      </button>
                      <button className="brush-mode" aria-label="重做塗抹" disabled={!strokes.future.length || busy} onClick={redo}>
                        <IconRedo />
                      </button>
                    </div>
                  </div>
                  <p className="brush-hint">
                    {erasing
                      ? '塗過頭的地方用橡皮擦擦掉，兩指可以放大'
                      : hasPaint(marks)
                        ? '兩指放大可以塗得更細，塗好按「開始生成」'
                        : '用手指塗滿要消除的人或東西，兩指可以放大'}
                  </p>
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
                  <button className="sheet-close" onClick={clearMarks} disabled={busy}>
                    清除塗抹
                  </button>
                )}
                <label className="sheet-close ai-repick">
                  <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
                  換照片
                </label>
                <button className="export-primary" disabled={busy || (local && !hasPaint(marks))} onClick={() => void generate()}>
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
