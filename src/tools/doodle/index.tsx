// 塗鴉筆：用手指在照片上畫線，可以選顏色；橡皮擦只擦掉畫上去的線，不會擦到照片

import { create } from 'zustand'
import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { IconBrush } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import { useBrush } from '../brush/useBrush.ts'
import { fitLong, rasterizeColor, strokeTexture, type Stroke } from '../brush/strokes.ts'

export interface DoodleParams {
  strokes: Stroke[]
}

const COLORS = ['#ffffff', '#111111', '#ff2f55', '#ff9500', '#ffd60a', '#34c759', '#32ade6', '#0a84ff', '#bf5af2', '#ff6fb5']

const useColor = create<{ color: string }>(() => ({ color: COLORS[2] }))

const doodleFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_paint;
void main() {
  vec4 c = texture(u_image, v_uv);
  vec4 d = texture(u_paint, v_uv);
  outColor = vec4(mix(c.rgb, d.rgb, d.a), c.a);
}`

export const doodleTool = defineTool<DoodleParams>({
  id: 'doodle',
  label: '塗鴉筆',
  icon: <IconBrush />,
  placement: { beautify: 100 },
  defaultParams: { strokes: [] },
  isIdentity: (p) => p.strokes.length === 0,

  steps: (p, ctx) => {
    if (!ctx.photo) return []
    // 線條要清楚：用和這次渲染一樣的解析度畫（匯出時就是原圖解析度，最多 4096）
    const { preview } = ctx.photo
    const long = Math.min(4096, Math.round(Math.max(preview.width, preview.height) * ctx.pixelScale))
    const size = fitLong(ctx.photo.width, ctx.photo.height, long)
    const paint = strokeTexture('doodle', p.strokes, size, (w, h) => ({ channels: 4, data: rasterizeColor(p.strokes, w, h) }))
    return [{ order: ORDER.paint + 1, pass: { id: 'doodle', fragment: doodleFragment, textures: { u_paint: paint } } }]
  },

  Overlay: createBrushOverlay<DoodleParams>({
    read: (p) => p.strokes,
    write: (p, strokes) => ({ ...p, strokes }),
    extra: () => ({ color: useColor.getState().color }),
    // 畫的過程直接用筆的顏色顯示，看起來和放開後一樣
    live: false,
    previewColor: (s) => (s.erase ? 'rgb(255 255 255 / 0.35)' : (s.color ?? '#fff')),
  }),
  overlayZoom: true,

  Panel: function DoodlePanel() {
    const color = useColor((s) => s.color)
    return (
      <div className="brush-panel">
        <div className="swatch-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => {
                // 選顏色 = 要畫了，自動切回畫筆
                useColor.setState({ color: c })
                useBrush.getState().setErase(false)
              }}
            />
          ))}
        </div>
        <BrushControls />
      </div>
    )
  },
})
