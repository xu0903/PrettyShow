// 消除筆：塗掉不想要的東西（電線、小雜物、痘疤…），放開手指後用周圍的顏色補起來。
// 適合小範圍；大範圍、背景複雜的（例如整個路人）之後交給 AI 修圖。

import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconEraser } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import type { Stroke } from '../brush/strokes.ts'
import { computeFill, getFill } from './fill.ts'

export interface EraserParams {
  strokes: Stroke[]
}

const fillFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_fill;
uniform vec4 u_box; // 補好的區塊在照片上的位置（x, y, 寬, 高）
uniform float u_noise; // 要加的顆粒強度

// 每個像素固定的亂數（同一張照片每次算出來都一樣，匯出和預覽一致）
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 c = texture(u_image, v_uv);
  vec2 q = (v_uv - u_box.xy) / u_box.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) {
    outColor = c;
    return;
  }
  vec4 f = texture(u_fill, q);
  // 兩個亂數相加，分布比較接近真實的噪點；乘上 1.7 讓標準差和估計值差不多
  vec2 px = floor(v_uv * u_outSize);
  float n = (hash(px) + hash(px + 17.0) - 1.0) * 1.7 * u_noise;
  outColor = vec4(mix(c.rgb, f.rgb + n, f.a), c.a);
}`

export const eraserTool = defineTool<EraserParams>({
  id: 'eraser',
  label: '消除筆',
  icon: <IconEraser />,
  placement: { beautify: 110, portrait: 110 },
  defaultParams: { strokes: [] },
  isIdentity: (p) => p.strokes.length === 0,

  // 補的計算比較花時間，放在 prepare，不要卡住畫面更新
  prepare: async (p, ctx) => {
    if (ctx.photo) computeFill(ctx.photo.preview, p.strokes)
  },

  steps: (p, ctx) => {
    const fill = ctx.photo && getFill(ctx.photo.preview, p.strokes)
    if (!fill) return []
    return [
      {
        order: ORDER.heal,
        pass: {
          id: 'eraser',
          fragment: fillFragment,
          // 預覽圖縮小時噪點被平均掉了；用原圖解析度匯出時，每個像素的噪點大約要放大同樣的倍數
          uniforms: { u_box: fill.box, u_noise: Math.min(0.08, fill.noise * ctx.pixelScale) },
          textures: { u_fill: fill.texture },
        },
      },
    ]
  },

  Overlay: createBrushOverlay<EraserParams>({
    read: (p) => p.strokes,
    write: (p, strokes) => ({ ...p, strokes }),
    // 塗的時候先用紅色標出範圍，放開才消除
    live: false,
  }),
  overlayZoom: true,

  Panel: function EraserPanel() {
    return (
      <div className="brush-panel">
        <p className="brush-hint">塗滿要消除的東西，放開手指就會用周圍的顏色補上；小範圍效果最好</p>
        <BrushControls />
      </div>
    )
  },
})
