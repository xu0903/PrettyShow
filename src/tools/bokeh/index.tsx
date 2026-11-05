// 背景虛化：智慧（自動找出人，只模糊背景）或圓形（點一下要清楚的位置，外圍慢慢變模糊）

import { useEffect, useState, type PointerEvent } from 'react'
import { create } from 'zustand'
import { displayToSourcePoint, paramsOf } from '../../core/pipeline.ts'
import { getTool, getTools } from '../../core/registry.ts'
import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER, type GpuStep, type ToolOverlayProps } from '../../core/tool.ts'
import { copyPass, FRAGMENT_HEADER, type RenderPass, type Texture2DSource } from '../../gl/pass.ts'
import { IconBlur } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { getSegment, PERSON_MODEL, segment } from '../segment/segmenter.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'

type Mode = 'none' | 'person' | 'radial'

export interface BokehParams {
  mode: Mode
  amount: number // 模糊程度 0..100
  /** 圓形：清楚的中心（原圖 0..1）和半徑（長邊的比例） */
  cx: number
  cy: number
  radius: number // 0..100
}

const DEFAULT: BokehParams = { mode: 'none', amount: 60, cx: 0.5, cy: 0.45, radius: 35 }

const MODES: { id: Mode; label: string }[] = [
  { id: 'none', label: '無' },
  { id: 'person', label: '智慧' },
  { id: 'radial', label: '圓形' },
]

/** 沒有遮罩時用的全黑貼圖 */
const EMPTY: Texture2DSource = { kind: '2d', key: 'bokeh/empty', width: 1, height: 1, data: new Uint8Array([0]) }

/** 高斯模糊（單一方向）；智慧模式時避開人：人身上的像素不算進背景的平均，人的邊緣才不會暈出去 */
const blurFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_person;
uniform float u_useMask;
uniform vec2 u_dir;
uniform float u_radius; // px
void main() {
  vec2 stepUv = u_dir * u_texel * (u_radius / 12.0);
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int i = -12; i <= 12; i++) {
    float t = float(i) / 12.0;
    vec2 uv = v_uv + stepUv * float(i);
    float w = exp(-4.0 * t * t) * mix(1.0, 1.0 - texture(u_person, uv).r, u_useMask) + 1e-4;
    sum += texture(u_image, uv).rgb * w;
    ws += w;
  }
  outColor = vec4(sum / ws, 1.0);
}`

const mixFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_base;
uniform sampler2D u_person;
uniform int u_mode;     // 1 智慧、2 圓形
uniform vec2 u_center;  // GL uv
uniform float u_r;      // 長邊的比例
void main() {
  vec4 base = texture(u_base, v_uv);
  vec3 blurred = texture(u_image, v_uv).rgb;
  float w;
  if (u_mode == 1) {
    w = 1.0 - smoothstep(0.3, 0.7, texture(u_person, v_uv).r);
  } else {
    float d = length((v_uv - u_center) * u_outSize) / max(u_outSize.x, u_outSize.y);
    w = smoothstep(u_r, u_r * 1.8 + 0.02, d);
  }
  outColor = vec4(mix(base.rgb, blurred, w), base.a);
}`

/** 圓形模式：最近一次點的位置（畫面座標），只用來畫提示圈 */
const useRing = create<{ x: number; y: number } | null>(() => null)

export const bokehTool = defineTool<BokehParams>({
  id: 'bokeh',
  label: '背景虛化',
  icon: <IconBlur />,
  placement: { beautify: 120 },
  defaultParams: DEFAULT,
  isIdentity: (p) => p.mode === 'none' || p.amount === 0,

  prepare: async (p, ctx) => {
    if (ctx.photo && p.mode === 'person') await segment(PERSON_MODEL, ctx.photo.preview)
  },

  steps: (p, ctx) => {
    if (!ctx.photo) return []
    const person = p.mode === 'person' ? getSegment(PERSON_MODEL, ctx.photo.preview) : undefined
    // 智慧模式還在找人（或找不到人）：先不套
    if (p.mode === 'person' && !person?.mask) return []
    const mask = person?.mask ?? EMPTY
    const { preview } = ctx.photo
    const radius = Math.max(1, (p.amount / 100) * 0.03 * Math.max(preview.width, preview.height) * ctx.pixelScale)
    const step = (pass: RenderPass): GpuStep => ({ order: ORDER.reshape + 3, pass })
    const blur = (d: 'h' | 'v') =>
      step({
        id: `bokeh/blur-${d}`,
        fragment: blurFragment,
        uniforms: { u_dir: d === 'h' ? [1, 0] : [0, 1], u_radius: radius, u_useMask: p.mode === 'person' ? 1 : 0 },
        textures: { u_person: mask },
      })
    return [
      step({ ...copyPass, id: 'bokeh/base' }),
      blur('h'),
      blur('v'),
      step({
        id: 'bokeh/mix',
        fragment: mixFragment,
        uniforms: { u_mode: p.mode === 'person' ? 1 : 2, u_center: [p.cx, 1 - p.cy], u_r: (p.radius / 100) * 0.6 },
        textures: { u_person: mask },
        inputs: { u_base: 'bokeh/base' },
      }),
    ]
  },

  Overlay: function BokehOverlay({ params, onCommit }: ToolOverlayProps<BokehParams>) {
    const ring = useRing()
    if (params.mode !== 'radial') return null
    const set = (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
      useRing.setState(p)
      const { history, photo } = useEditor.getState()
      const q = displayToSourcePoint(history.present, getTools(), p, { width: photo!.width, height: photo!.height })
      onCommit({ ...params, cx: Math.min(1, Math.max(0, q.x)), cy: Math.min(1, Math.max(0, q.y)) })
    }
    // 沒有裁切時，畫面座標就是原圖座標，可以直接畫出目前的中心
    const state = useEditor.getState().history.present
    const crop = getTool('crop')
    const plain = !crop || crop.isIdentity(paramsOf(state, crop))
    const shown = ring ?? (plain ? { x: params.cx, y: params.cy } : null)
    return (
      <div className="brush-overlay" onPointerDown={set}>
        {shown && <div className="bokeh-ring" style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%` }} />}
      </div>
    )
  },

  Panel: function BokehPanel({ params, onChange, onCommit }) {
    const preview = useEditor((s) => s.photo?.preview)
    const [found, setFound] = useState<{ preview: HTMLCanvasElement; ok: boolean } | null>(null)

    // 選智慧模式時才找人（第一次要下載約 250KB 的模型）
    useEffect(() => {
      if (!preview || params.mode !== 'person') return
      const task = { alive: true }
      segment(PERSON_MODEL, preview)
        .then((d) => task.alive && setFound({ preview, ok: !!d.mask }))
        .catch(() => task.alive && setFound({ preview, ok: false }))
      return () => {
        task.alive = false
      }
    }, [preview, params.mode])

    const status =
      params.mode !== 'person'
        ? null
        : !found || found.preview !== preview
          ? '正在找人…'
          : found.ok
            ? null
            : '這張照片裡找不到人，可以改用「圓形」'

    return (
      <div className="beauty-panel">
        {params.mode !== 'none' && (
          <Slider
            label="模糊"
            value={params.amount}
            min={0}
            max={100}
            defaultValue={DEFAULT.amount}
            onChange={(v) => onChange({ ...params, amount: v })}
            onCommit={(v) => onCommit({ ...params, amount: v })}
          />
        )}
        {params.mode === 'radial' && (
          <div className="brush-size">
            <span className="brush-size-label brush-row-label">範圍</span>
            <Slider
              label="清楚的範圍"
              value={params.radius}
              min={5}
              max={100}
              defaultValue={DEFAULT.radius}
              onChange={(v) => onChange({ ...params, radius: v })}
              onCommit={(v) => onCommit({ ...params, radius: v })}
            />
          </div>
        )}
        <div className="chip-row">
          {MODES.map((m) => (
            <button key={m.id} className="chip" aria-pressed={params.mode === m.id} onClick={() => onCommit({ ...params, mode: m.id })}>
              {m.label}
            </button>
          ))}
          {params.mode === 'radial' && <span className="beauty-count">點照片選要清楚的位置</span>}
        </div>
        {status && <p className="brush-hint">{status}</p>}
      </div>
    )
  },
})
