// 邊框：純色邊、模糊背景、拍立得、膠卷、圓角；也可以補成 1:1、4:5、9:16 放上 IG

import { defineTool, ORDER } from '../../core/tool.ts'
import { copyPass, FRAGMENT_HEADER } from '../../gl/pass.ts'
import { ColorRow } from '../../ui/ColorRow.tsx'
import type { NamedColor } from '../../ui/colors.ts'
import { IconFrame } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { hexToRgb } from '../makeup/regions.ts'
import { DEFAULT_FRAME, frameLayout, isIdentityFrame, type FrameParams, type FrameRatio, type FrameStyle } from './layout.ts'
import '../beauty/beauty.css'

const STYLES: { id: FrameStyle; label: string }[] = [
  { id: 'none', label: '無' },
  { id: 'color', label: '純色' },
  { id: 'blur', label: '模糊背景' },
  { id: 'polaroid', label: '拍立得' },
  { id: 'film', label: '膠卷' },
  { id: 'rounded', label: '圓角' },
]

const RATIOS: { id: FrameRatio; label: string }[] = [
  { id: 'keep', label: '原比例' },
  { id: '1:1', label: '方格' },
  { id: '4:5', label: 'IG 貼文' },
  { id: '3:4', label: 'IG 主頁' },
  { id: '9:16', label: 'IG 限動' },
]

const COLORS: NamedColor[] = [
  { color: '#ffffff', label: '白' },
  { color: '#111111', label: '黑' },
  { color: '#f3ece1', label: '奶油' },
  { color: '#e9d7c9', label: '奶茶' },
  { color: '#f6d6dc', label: '粉' },
  { color: '#d8e6d4', label: '抹茶' },
  { color: '#d6e2f0', label: '天空' },
]

const STYLE_ID: Record<FrameStyle, number> = { none: 0, color: 0, rounded: 0, polaroid: 0, blur: 1, film: 2 }

/** 高斯模糊（單一方向），模糊背景用：半徑是照片長邊的比例 */
const blurFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform vec2 u_dir;
uniform float u_radius;
void main() {
  float r = u_radius * max(u_outSize.x, u_outSize.y);
  vec2 stepUv = u_dir * u_texel * (r / 12.0);
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int i = -12; i <= 12; i++) {
    float t = float(i) / 12.0;
    float w = exp(-4.0 * t * t);
    sum += texture(u_image, v_uv + stepUv * float(i)).rgb * w;
    ws += w;
  }
  outColor = vec4(sum / ws, 1.0);
}`

const frameFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_base; // 原本的照片（u_image 是模糊過的，模糊背景用；其他樣式兩個一樣）
uniform vec4 u_rect;   // 照片的位置（輸出的 uv：x, y, 寬, 高，原點左下）
uniform int u_style;   // 0 純色、1 模糊背景、2 膠卷
uniform vec3 u_color;
uniform float u_round; // 照片圓角半徑（px）

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = v_uv * u_outSize;
  vec2 lo = u_rect.xy * u_outSize;
  vec2 hi = (u_rect.xy + u_rect.zw) * u_outSize;
  float d = sdRoundBox(px - (lo + hi) * 0.5, (hi - lo) * 0.5, u_round);
  // 邊緣抗鋸齒
  float inside = 1.0 - smoothstep(-0.75, 0.75, d);

  vec3 bg = u_color;
  if (u_style == 1) {
    // 模糊背景：模糊過的照片放大到蓋滿整張，稍微調暗
    vec2 inAspect = vec2(u_rect.z * u_outSize.x, u_rect.w * u_outSize.y);
    float s = max(u_outSize.x / inAspect.x, u_outSize.y / inAspect.y);
    vec2 uv = 0.5 + (v_uv - 0.5) * (u_outSize / (inAspect * s));
    bg = texture(u_image, uv).rgb * 0.85;
  } else if (u_style == 2) {
    // 膠卷：黑底，上下各一排圓角齒孔
    bg = vec3(0.06);
    float band = lo.y;
    float hh = band * 0.36;
    float hw = hh * 0.72;
    float gap = hh * 1.7;
    vec2 cell = vec2(mod(px.x, gap) - gap * 0.5, 0.0);
    float cyTop = u_outSize.y - band * 0.5;
    float cyBottom = band * 0.5;
    float hole = min(sdRoundBox(vec2(cell.x, px.y - cyTop), vec2(hw, hh) * 0.5, hw * 0.25),
                     sdRoundBox(vec2(cell.x, px.y - cyBottom), vec2(hw, hh) * 0.5, hw * 0.25));
    bg = mix(vec3(0.9), bg, smoothstep(-0.75, 0.75, hole));
  }

  vec2 q = (v_uv - u_rect.xy) / u_rect.zw;
  vec3 photo = texture(u_base, clamp(q, 0.0, 1.0)).rgb;
  outColor = vec4(mix(bg, photo, inside), 1.0);
}`

export const frameTool = defineTool<FrameParams>({
  id: 'frame',
  label: '邊框',
  icon: <IconFrame />,
  placement: { beautify: 80 },
  defaultParams: DEFAULT_FRAME,
  isIdentity: isIdentityFrame,

  steps: (p) => [
    // 先留一份原本的照片；模糊背景要先把照片模糊好（水平、垂直各一次，才平滑）
    { order: ORDER.frame, pass: { ...copyPass, id: 'frame/base' } },
    ...(p.style === 'blur'
      ? (['h', 'v'] as const).map((d) => ({
          order: ORDER.frame,
          pass: { id: `frame/blur-${d}`, fragment: blurFragment, uniforms: { u_dir: d === 'h' ? [1, 0] : [0, 1], u_radius: 0.045 } },
        }))
      : []),
    {
      order: ORDER.frame,
      pass: {
        id: 'frame',
        fragment: frameFragment,
        inputs: { u_base: 'frame/base' },
        outputSize: (input) => {
          const l = frameLayout(input, p)
          return { width: l.width, height: l.height }
        },
        // 版面要依實際輸入尺寸算（預覽、匯出不同），所以在跑到這一步時才算
        uniformsFor: (input) => {
          const l = frameLayout(input, p)
          const { x, y, w, h } = l.rect
          return {
            u_rect: [x / l.width, 1 - (y + h) / l.height, w / l.width, h / l.height],
            u_round: p.style === 'rounded' ? Math.min(w, h) * 0.06 : 0,
          }
        },
        uniforms: {
          u_style: STYLE_ID[p.style],
          u_color: hexToRgb(p.style === 'polaroid' ? '#fbfaf6' : p.color),
        },
      },
    },
  ],
  mapToSource: (p, pt, input) => {
    const l = frameLayout(input, p)
    return { x: (pt.x * l.width - l.rect.x) / l.rect.w, y: (pt.y * l.height - l.rect.y) / l.rect.h }
  },
  mapSize: (p, input) => {
    const l = frameLayout(input, p)
    return { width: l.width, height: l.height }
  },
  geometryOrder: ORDER.frame,

  Panel: function FramePanel({ params, onChange, onCommit }) {
    const active = params.style !== 'none'
    return (
      <div className="beauty-panel">
        {active && params.style !== 'polaroid' && params.style !== 'film' && (
          <Slider
            label="粗細"
            value={params.width}
            min={0}
            max={100}
            defaultValue={DEFAULT_FRAME.width}
            onChange={(v) => onChange({ ...params, width: v })}
            onCommit={(v) => onCommit({ ...params, width: v })}
          />
        )}
        <div className="chip-row">
          {STYLES.map((s) => (
            <button key={s.id} className="chip" aria-pressed={params.style === s.id} onClick={() => onCommit({ ...params, style: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
        {(params.style === 'color' || params.style === 'rounded') && (
          <ColorRow colors={COLORS} value={params.color} onPick={(c) => onCommit({ ...params, color: c })} onPreview={(c) => onChange({ ...params, color: c })} />
        )}
        {active && (
          <div className="chip-row">
            {RATIOS.map((r) => (
              <button key={r.id} className="chip" aria-pressed={params.ratio === r.id} onClick={() => onCommit({ ...params, ratio: r.id })}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  },
})
