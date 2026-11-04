// 祛痘祛斑：在痘痘或斑點上點一下，用周圍的膚色補上，再從旁邊借一點皮膚紋理，看起來才不會糊成一塊

import { defineTool, ORDER, type GpuStep } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconSpot } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import type { Stroke } from '../brush/strokes.ts'

export interface AcneParams {
  /** 每一點是一筆只有一個點的筆跡 */
  spots: Stroke[]
}

/** 一次 shader 最多處理幾個點；更多就分成好幾次 */
const PER_PASS = 16

const healFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
const int MAX = ${PER_PASS};
uniform vec4 u_spots[MAX]; // x, y（GL 座標）, 半徑（長邊的比例）, 未使用
uniform int u_count;

void main() {
  vec4 col = texture(u_image, v_uv);
  vec2 p = v_uv * u_outSize;
  float longSide = max(u_outSize.x, u_outSize.y);
  for (int i = 0; i < MAX; i++) {
    if (i >= u_count) break;
    vec4 s = u_spots[i];
    vec2 c = s.xy * u_outSize;
    float r = s.z * longSide;
    float dist = length(p - c);
    if (dist > r) continue;

    // 用圓圈外圍一圈的顏色補：離哪一邊近就比較像哪一邊（類似把邊界平滑地拉進來）
    vec3 sum = vec3(0.0);
    float ws = 0.0;
    for (int k = 0; k < 16; k++) {
      float a = float(k) * 0.392699;
      vec2 q = c + vec2(cos(a), sin(a)) * r * 1.3;
      vec2 dq = q - p;
      float w = 1.0 / max(1.0, dot(dq, dq));
      sum += texture(u_image, q / u_outSize).rgb * w;
      ws += w;
    }
    vec3 fill = sum / ws;

    // 皮膚紋理：從斜上方 2.2 倍半徑外借細節（原色減掉附近的平均 = 只留下毛孔、紋理）
    vec2 o = p + vec2(0.7, 0.7) * r * 2.2;
    float d = r * 0.35;
    vec3 t = texture(u_image, o / u_outSize).rgb;
    vec3 tb = (texture(u_image, (o + vec2(d, 0.0)) / u_outSize).rgb + texture(u_image, (o - vec2(d, 0.0)) / u_outSize).rgb +
               texture(u_image, (o + vec2(0.0, d)) / u_outSize).rgb + texture(u_image, (o - vec2(0.0, d)) / u_outSize).rgb) * 0.25;
    fill += (t - tb) * 0.7;

    // 邊緣柔和過渡
    col.rgb = mix(col.rgb, fill, 1.0 - smoothstep(r * 0.55, r, dist));
  }
  outColor = col;
}`

export const acneTool = defineTool<AcneParams>({
  id: 'acne',
  label: '祛痘祛斑',
  icon: <IconSpot />,
  placement: { portrait: 40 },
  defaultParams: { spots: [] },
  isIdentity: (p) => p.spots.length === 0,

  steps: (p) => {
    const steps: GpuStep[] = []
    for (let i = 0; i < p.spots.length; i += PER_PASS) {
      const chunk = p.spots.slice(i, i + PER_PASS)
      const data = new Array<number>(PER_PASS * 4).fill(0)
      chunk.forEach((s, k) => data.splice(k * 4, 4, s.pts[0], 1 - s.pts[1], s.r, 0))
      steps.push({
        order: ORDER.heal + 1,
        pass: { id: 'acne/heal', fragment: healFragment, uniforms: { u_spots: data, u_count: chunk.length } },
      })
    }
    return steps
  },

  Overlay: createBrushOverlay<AcneParams>({
    read: (p) => p.spots,
    write: (p, spots) => ({ ...p, spots }),
    live: false,
    tapOnly: true,
  }),
  overlayZoom: true,

  Panel: function AcnePanel() {
    return (
      <div className="brush-panel">
        <p className="brush-hint">在痘痘或斑點上點一下就會消失；兩指放大照片可以點得更準</p>
        <BrushControls eraser={false} />
      </div>
    )
  },
})
