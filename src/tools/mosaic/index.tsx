// 馬賽克：用手指塗抹要遮住的地方，可選方塊或模糊

import { create } from 'zustand'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconMosaic } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import { fitLong, rasterizeMask, strokeTexture, type Stroke } from '../brush/strokes.ts'
import { mosaicFragment } from './shaders.ts'

export interface MosaicParams {
  strokes: Stroke[]
}

type Style = 'pixel' | 'blur'
const STYLES: { id: Style; label: string }[] = [
  { id: 'pixel', label: '方塊' },
  { id: 'blur', label: '模糊' },
]

/** 目前選的樣式（介面狀態，之後畫的筆才會用新的樣式） */
const useStyle = create<{ style: Style }>(() => ({ style: 'pixel' }))

/** 方塊大小：照片長邊的 1.8% */
const BLOCK = 0.018
/** 遮罩的長邊：預覽 1024，匯出時跟著放大（最多 2048） */
const maskLong = (pixelScale: number) => Math.min(2048, Math.round(1024 * pixelScale))

export const mosaicTool = defineTool<MosaicParams>({
  id: 'mosaic',
  label: '馬賽克',
  icon: <IconMosaic />,
  placement: { beautify: 90 },
  defaultParams: { strokes: [] },
  isIdentity: (p) => p.strokes.length === 0,

  steps: (p, ctx) => {
    if (!ctx.photo) return []
    const size = fitLong(ctx.photo.width, ctx.photo.height, maskLong(ctx.pixelScale))
    // 每種樣式各畫一張遮罩；橡皮擦對兩種都有效
    const mask = (style: Style) => {
      const strokes = p.strokes.filter((s) => s.erase || (s.kind ?? 'pixel') === style)
      return strokeTexture(`mosaic/${style}`, p.strokes, size, (w, h) => ({
        channels: 1,
        data: rasterizeMask(strokes, w, h, 0.15),
      }))
    }
    return [
      {
        order: ORDER.paint,
        pass: {
          id: 'mosaic',
          fragment: mosaicFragment,
          uniforms: { u_block: BLOCK },
          textures: { u_pixelMask: mask('pixel'), u_blurMask: mask('blur') },
        },
      },
    ]
  },

  Overlay: createBrushOverlay<MosaicParams>({
    read: (p) => p.strokes,
    write: (p, strokes) => ({ ...p, strokes }),
    extra: () => ({ kind: useStyle.getState().style }),
    live: true,
  }),
  overlayZoom: true,

  Panel: function MosaicPanel() {
    const style = useStyle((s) => s.style)
    return (
      <div className="brush-panel">
        <div className="chip-row">
          {STYLES.map((s) => (
            <button key={s.id} className="chip" aria-pressed={style === s.id} onClick={() => useStyle.setState({ style: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
        <BrushControls />
      </div>
    )
  },
})
