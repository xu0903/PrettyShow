// 證件照：自動依臉裁成證件尺寸、換背景色，還可以排成 4×6 沖印紙（便利商店、相館都能印）

import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER } from '../../core/tool.ts'
import { exportPhoto } from '../../core/export.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { decodeImage } from '../../image/load.ts'
import { ColorRow } from '../../ui/ColorRow.tsx'
import type { NamedColor } from '../../ui/colors.ts'
import { startExport } from '../../ui/exportJob.ts'
import { IconIdPhoto } from '../../ui/icons.tsx'
import { detectFaces, getFaceData } from '../beauty/faces.ts'
import { useFaceStatus } from '../beauty/useFaces.ts'
import { hexToRgb } from '../makeup/regions.ts'
import { getSegment, PERSON_MODEL, segment } from '../segment/segmenter.ts'
import { idCrop, printSheet, SIZES, type IdSize, type Rect } from './layout.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'
import '../layers/layers.css'

export interface IdPhotoParams {
  size: IdSize | null
  bg: string
}

const BG: NamedColor[] = [
  { color: '#ffffff', label: '白' },
  { color: '#e9e9e9', label: '淺灰' },
  { color: '#3d8ce0', label: '藍' },
  { color: '#d4252a', label: '紅' },
]

const idFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_person;
uniform vec4 u_rect; // 裁切範圍（原圖 uv，原點左下）
uniform vec3 u_bg;
void main() {
  vec2 uv = u_rect.xy + v_uv * u_rect.zw;
  vec3 c = texture(u_image, clamp(uv, 0.0, 1.0)).rgb;
  float person = texture(u_person, clamp(uv, 0.0, 1.0)).r;
  // 照片外面（頭頂上方不夠高時）也是背景
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float keep = smoothstep(0.35, 0.65, person) * inside;
  outColor = vec4(mix(u_bg, c, keep), 1.0);
}`

/** 照片裡最大的那張臉的裁切範圍（還沒找到臉時是 null） */
function cropOf(p: IdPhotoParams, photo = useEditor.getState().photo ?? undefined): Rect | null {
  if (!photo || !p.size) return null
  const face = getFaceData(photo.preview)
  if (!face?.faces.length) return null
  // 合照的話用最大的臉
  const main = face.faces.reduce((a, b) => (Math.abs(a[454].x - a[234].x) >= Math.abs(b[454].x - b[234].x) ? a : b))
  return idCrop(main, photo.width, photo.height, p.size)
}

export const idPhotoTool = defineTool<IdPhotoParams>({
  id: 'idphoto',
  label: '證件照',
  icon: <IconIdPhoto />,
  placement: { portrait: 130 },
  defaultParams: { size: null, bg: '#ffffff' },
  isIdentity: (p) => !p.size,

  prepare: async (_p, ctx) => {
    if (!ctx.photo) return
    await Promise.all([detectFaces(ctx.photo.preview), segment(PERSON_MODEL, ctx.photo.preview)])
  },

  steps: (p, ctx) => {
    const rect = cropOf(p, ctx.photo)
    const person = ctx.photo && getSegment(PERSON_MODEL, ctx.photo.preview)
    if (!rect || !person?.mask) return []
    return [
      {
        // 在裁切之前：座標還是原圖的，臉和人像遮罩才對得上
        order: ORDER.geometry - 1,
        pass: {
          id: 'idphoto',
          fragment: idFragment,
          uniforms: { u_rect: [rect.x, 1 - rect.y - rect.h, rect.w, rect.h], u_bg: hexToRgb(p.bg) },
          textures: { u_person: person.mask },
          outputSize: (s) => ({ width: Math.max(1, Math.round(s.width * rect.w)), height: Math.max(1, Math.round(s.height * rect.h)) }),
        },
      },
    ]
  },
  mapToSource: (p, pt) => {
    const r = cropOf(p)
    return r ? { x: r.x + pt.x * r.w, y: r.y + pt.y * r.h } : pt
  },
  mapSize: (p, s) => {
    const r = cropOf(p)
    return r ? { width: Math.round(s.width * r.w), height: Math.round(s.height * r.h) } : s
  },
  geometryOrder: ORDER.geometry - 1,

  Panel: function IdPhotoPanel({ params, onChange, onCommit }) {
    const status = useFaceStatus()

    const printJob = () => {
      const { photo, history } = useEditor.getState()
      if (!photo || !params.size) return
      const size = params.size
      startExport(
        exportPhoto(photo, history.present).then(async (single) => {
          URL.revokeObjectURL(single.url)
          const img = await decodeImage(single.file)
          const sheet = printSheet(size)
          const c = document.createElement('canvas')
          c.width = sheet.width
          c.height = sheet.height
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, c.width, c.height)
          for (const cell of sheet.cells) ctx.drawImage(img, cell.x, cell.y, cell.w, cell.h)
          // 裁切線
          ctx.strokeStyle = '#c8c8c8'
          ctx.lineWidth = 1
          for (const cell of sheet.cells) ctx.strokeRect(cell.x - 0.5, cell.y - 0.5, cell.w + 1, cell.h + 1)
          const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.95))
          c.width = c.height = 0
          if (!blob) throw new Error('排版產生失敗')
          const file = new File([blob], `證件照排版_${Date.now()}.jpg`, { type: 'image/jpeg' })
          return { file, width: sheet.width, height: sheet.height, url: URL.createObjectURL(file) }
        }),
      )
    }

    if (status.state === 'error') return <p className="beauty-status">{status.message}</p>
    if (status.state === 'loading') return <p className="beauty-status">正在找臉…</p>
    if (status.faces === 0) return <p className="beauty-status">這張照片裡找不到臉，請換一張正面、清楚的照片</p>

    return (
      <div className="layers-panel">
        <div className="chip-row">
          {SIZES.map((s) => (
            <button key={s.id} className="chip" aria-pressed={params.size === s.id} onClick={() => onCommit({ ...params, size: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
        {params.size && (
          <>
            <ColorRow colors={BG} value={params.bg} onPick={(c) => onCommit({ ...params, bg: c })} onPreview={(c) => onChange({ ...params, bg: c })} />
            <div className="layers-empty">
              <button className="layers-add" onClick={printJob}>
                產生 4×6 沖印排版
              </button>
              <span>單張直接按右上角「儲存」；各機關的規定（背景色、表情）請以公告為準</span>
            </div>
          </>
        )}
        {!params.size && <p className="brush-hint">選一個尺寸，會自動依臉的位置裁切、換背景</p>}
      </div>
    )
  },
})
