// 美膚工具：磨皮、美白。
// 自動：找出照片裡的臉，整張臉一起處理。手動：用手指塗哪裡就處理哪裡（沒有臉的照片也能用）。

import { defineTool, ORDER, type GpuStep } from '../../core/tool.ts'
import { copyPass, type RenderPass, type Texture2DSource } from '../../gl/pass.ts'
import { IconFace } from '../../ui/icons.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import { fitLong, rasterizeMask, strokeTexture, type Stroke } from '../brush/strokes.ts'
import { AutoPanel, ManualPanel } from './BeautyPanels.tsx'
import { detectFaces, getFaceData } from './faces.ts'
import { bilateralFragment, smoothMixFragment, whitenOnlyFragment } from './shaders.ts'
import { useUi, type Kind } from './ui.ts'
import './beauty.css'

export interface BeautyParams {
  smooth: number // 自動磨皮 0..100
  whiten: number // 自動美白 0..100
  /** 手動塗的筆跡；kind 是 'smooth' 或 'whiten'（舊版存的參數沒有這一項） */
  manual?: Stroke[]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 沒有臉時用的全黑遮罩 */
const EMPTY: Texture2DSource = { kind: '2d', key: 'beauty/empty', width: 1, height: 1, data: new Uint8Array([0]) }

/** 手動遮罩的長邊：預覽 1024，匯出時跟著放大（最多 2048） */
const maskLong = (pixelScale: number) => Math.min(2048, Math.round(1024 * pixelScale))

export const beautyTool = defineTool<BeautyParams>({
  id: 'beauty',
  label: '美膚',
  icon: <IconFace />,
  placement: { portrait: 30 },
  defaultParams: { smooth: 0, whiten: 0, manual: [] },
  isIdentity: (p) => p.smooth === 0 && p.whiten === 0 && !p.manual?.length,

  prepare: async (p, ctx) => {
    // 只有自動模式需要找臉（手動不用下載辨識模型）
    if (ctx.photo && (p.smooth || p.whiten)) await detectFaces(ctx.photo.preview)
  },

  steps: (p, ctx) => {
    if (!ctx.photo) return []
    const face = getFaceData(ctx.photo.preview)
    const manual = p.manual ?? []
    const hasFace = !!face?.mask && (p.smooth > 0 || p.whiten > 0)
    // 還沒偵測完（或沒有臉）又沒有手動筆跡：先不套，prepare 完成後會再重畫
    if (!hasFace && manual.length === 0) return []

    const faceMask = hasFace ? face!.mask! : EMPTY
    const size = fitLong(ctx.photo.width, ctx.photo.height, maskLong(ctx.pixelScale))
    const brush = (kind: Kind) => {
      const strokes = manual.filter((s) => s.kind === kind)
      return strokes.length === 0
        ? EMPTY
        : strokeTexture(`beauty/${kind}`, manual, size, (w, h) => ({ channels: 1, data: rasterizeMask(strokes, w, h, 0.6) }))
    }
    const textures = { u_mask: faceMask, u_brushSmooth: brush('smooth'), u_brushWhiten: brush('whiten') }
    const smooth = hasFace ? p.smooth / 100 : 0
    const whiten = hasFace ? p.whiten / 100 : 0
    const manualSmooth = textures.u_brushSmooth !== EMPTY
    const step = (pass: RenderPass): GpuStep => ({ order: ORDER.retouch, pass })

    if (smooth === 0 && !manualSmooth) {
      return [step({ id: 'beauty/whiten', fragment: whitenOnlyFragment, uniforms: { u_smooth: 0, u_whiten: whiten }, textures })]
    }

    // 半徑跟著臉的大小：臉越大，要抹平的痘痘、毛孔也越大；沒有臉就用照片大小估計
    const { preview } = ctx.photo
    const basis = face?.faceWidthPx ? face.faceWidthPx * 0.03 : Math.max(preview.width, preview.height) * 0.008
    const radius = clamp(basis, 2, 40) * ctx.pixelScale
    // 強度越高，「顏色相近」的範圍越寬，抹得越平
    const sigma = 0.04 + 0.08 * Math.max(smooth, manualSmooth ? 0.75 : 0)
    const blur = (id: string, dir: [number, number]) =>
      step({ id, fragment: bilateralFragment, uniforms: { u_dir: dir, u_radius: radius, u_sigma: sigma }, textures })
    return [
      // 先留一份磨皮前的畫面，最後依遮罩混回去
      step({ ...copyPass, id: 'beauty/base' }),
      blur('beauty/blur-h', [1, 0]),
      blur('beauty/blur-v', [0, 1]),
      step({
        id: 'beauty/mix',
        fragment: smoothMixFragment,
        uniforms: { u_smooth: smooth, u_whiten: whiten },
        textures,
        inputs: { u_base: 'beauty/base' },
      }),
    ]
  },

  // 手動模式：邊塗邊看到效果
  Overlay: createBrushOverlay<BeautyParams>({
    read: (p) => p.manual ?? [],
    write: (p, manual) => ({ ...p, manual }),
    extra: () => {
      const ui = useUi.getState()
      return ui.manual ? { kind: ui.kind } : null
    },
    live: true,
  }),
  overlayZoom: true,

  Panel: function BeautyPanel(props) {
    const manual = useUi((s) => s.manual)
    return (
      <div className="beauty-panel">
        <div className="seg">
          <button className="seg-btn" aria-pressed={!manual} onClick={() => useUi.setState({ manual: false })}>
            自動
          </button>
          <button className="seg-btn" aria-pressed={manual} onClick={() => useUi.setState({ manual: true })}>
            手動
          </button>
        </div>
        {manual ? <ManualPanel /> : <AutoPanel {...props} />}
      </div>
    )
  },
})
