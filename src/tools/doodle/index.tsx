// 塗鴉筆：用手指在照片上畫線，可以選顏色；橡皮擦只擦掉畫上去的線，不會擦到照片

import { create } from 'zustand'
import { defineTool, ORDER } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'
import { ColorRow } from '../../ui/ColorRow.tsx'
import type { NamedColor } from '../../ui/colors.ts'
import { IconBrush } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import { useBrush } from '../brush/useBrush.ts'
import { fitLong, rasterizeColor, strokeTexture, type Stroke } from '../brush/strokes.ts'

export interface DoodleParams {
  strokes: Stroke[]
}

const COLORS: NamedColor[] = [
  { color: '#ffffff', label: '白' },
  { color: '#111111', label: '黑' },
  { color: '#ff2f55', label: '紅' },
  { color: '#ff9500', label: '橘' },
  { color: '#ffd60a', label: '黃' },
  { color: '#34c759', label: '綠' },
  { color: '#32ade6', label: '青' },
  { color: '#0a84ff', label: '藍' },
  { color: '#bf5af2', label: '紫' },
  { color: '#ff6fb5', label: '粉' },
]

const useColor = create<{ color: string }>(() => ({ color: COLORS[2].color }))

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
        <ColorRow
          colors={COLORS}
          value={color}
          onPick={(c) => {
            // 選顏色 = 要畫了，自動切回畫筆
            useColor.setState({ color: c })
            useBrush.getState().setErase(false)
          }}
        />
        <BrushControls />
      </div>
    )
  },
})
