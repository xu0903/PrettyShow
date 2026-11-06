// 消除筆：塗掉不想要的東西（路人、電線、小雜物…），放開手指後補起來。
// 先用周圍的顏色快速補上，手機上的 AI 模型（MI-GAN）算好後自動換成更自然的結果。

import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconEraser } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import type { Stroke } from '../brush/strokes.ts'
import { useInpaintStatus } from '../../image/inpaint.ts'
import { computeAiFill, computeFill, getFill } from './fill.ts'

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

  // 補的計算比較花時間，放在 prepare，不要卡住畫面更新：快速版馬上好，AI 版好了會再重畫一次
  prepare: async (p, ctx) => {
    if (!ctx.photo) return
    computeFill(ctx.photo.preview, p.strokes)
    await computeAiFill(ctx.photo.preview, p.strokes).catch((e: unknown) => console.warn('AI 消除失敗，改用一般補色', e))
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
    const ai = useInpaintStatus((s) => s.state)
    const hint =
      ai === 'downloading'
        ? '第一次使用，正在下載 AI 消除模型（約 40MB，之後離線也能用）…'
        : ai === 'running'
          ? 'AI 消除中，幾秒鐘就好…'
          : ai === 'error'
            ? 'AI 消除失敗，先用一般補色（可以再塗一次重試）'
            : '塗滿要消除的人或東西，放開手指就會補上背景'
    return (
      <div className="brush-panel">
        <p className="brush-hint">{hint}</p>
        <BrushControls />
      </div>
    )
  },
})
