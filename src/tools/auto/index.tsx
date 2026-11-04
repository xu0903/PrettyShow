// 智慧優化：分析照片的亮度分布，自動調整黑白點、曝光、白平衡和鮮豔度。
// 有自動、人像、風景、美食、夜景五種模式，強度滑桿可以調淡

import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconMagic } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { autoUniforms, computeStats, MODES, type AutoMode, type Stats } from './stats.ts'
import '../beauty/beauty.css'

export interface AutoParams {
  mode: AutoMode | null
  amount: number // 0..100
}

const DEFAULT_AMOUNT = 100
/** 分析用的縮圖長邊 */
const ANALYZE_LONG = 256

const autoFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform vec3 u_lo;
uniform vec3 u_hi;
uniform float u_gamma;
uniform float u_vibrance;
uniform float u_warm;
uniform float u_lift;
uniform float u_amount;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec4 c0 = texture(u_image, v_uv);
  vec3 c = clamp((c0.rgb - u_lo) / max(u_hi - u_lo, vec3(1e-3)), 0.0, 1.0);
  c = pow(c, vec3(u_gamma));
  float l = dot(c, LUMA);
  c += u_lift * (1.0 - c) * (1.0 - smoothstep(0.0, 0.5, l));
  c *= vec3(1.0 + u_warm, 1.0 + u_warm * 0.2, 1.0 - u_warm);
  float chroma = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(dot(c, LUMA)), c, 1.0 + u_vibrance * (1.0 - chroma));
  outColor = vec4(mix(c0.rgb, clamp(c, 0.0, 1.0), u_amount), c0.a);
}`

const cache = new WeakMap<HTMLCanvasElement, Stats>()

function statsOf(preview: HTMLCanvasElement): Stats {
  let s = cache.get(preview)
  if (!s) {
    const k = Math.min(1, ANALYZE_LONG / Math.max(preview.width, preview.height))
    const w = Math.max(1, Math.round(preview.width * k))
    const h = Math.max(1, Math.round(preview.height * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(preview, 0, 0, w, h)
    s = computeStats(ctx.getImageData(0, 0, w, h).data)
    c.width = c.height = 0
    cache.set(preview, s)
  }
  return s
}

export const autoTool = defineTool<AutoParams>({
  id: 'auto',
  label: '智慧優化',
  icon: <IconMagic />,
  placement: { beautify: 20 },
  defaultParams: { mode: null, amount: DEFAULT_AMOUNT },
  isIdentity: (p) => !p.mode || !p.amount,

  steps: (p, ctx) => {
    if (!ctx.photo || !p.mode) return []
    return [
      {
        // 在所有調色之前：先把照片「修正」好，濾鏡、調色才疊在正確的基礎上
        order: ORDER.color - 10,
        pass: {
          id: 'auto',
          fragment: autoFragment,
          uniforms: { ...autoUniforms(statsOf(ctx.photo.preview), p.mode), u_amount: p.amount / 100 },
        },
      },
    ]
  },

  Panel: function AutoPanel({ params, onChange, onCommit }) {
    return (
      <div className="beauty-panel">
        {params.mode && (
          <Slider
            label="強度"
            value={params.amount}
            min={0}
            max={100}
            defaultValue={DEFAULT_AMOUNT}
            onChange={(v) => onChange({ ...params, amount: v })}
            onCommit={(v) => onCommit({ ...params, amount: v })}
          />
        )}
        <div className="chip-row">
          <button className="chip" aria-pressed={!params.mode} onClick={() => onCommit({ ...params, mode: null })}>
            原圖
          </button>
          {MODES.map((m) => (
            <button
              key={m.id}
              className="chip"
              aria-pressed={params.mode === m.id}
              onClick={() => onCommit({ mode: m.id, amount: params.mode ? params.amount : DEFAULT_AMOUNT })}
            >
              {m.label}
            </button>
          ))}
        </div>
        {!params.mode && <p className="beauty-status">選一個模式，會依照片自動調整亮度、對比、白平衡</p>}
      </div>
    )
  },
})
