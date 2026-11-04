// 瘦臉瘦身（手動）：用手指把輪廓往內推，臉、腰、手臂都可以。每推一筆都能復原

import { create } from 'zustand'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconBody } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import type { Stroke } from '../brush/strokes.ts'
import { warpSteps } from '../warp/warp.ts'
import { strokesToOps } from './ops.ts'

export interface LiquifyParams {
  strokes: Stroke[]
}

/** 力度（%）：手指移動 1 公分，內容只跟著移動「力度」那麼多，比較好控制 */
const DEFAULT_STRENGTH = 30
const useStrength = create<{ strength: number }>(() => ({ strength: DEFAULT_STRENGTH }))

export const liquifyTool = defineTool<LiquifyParams>({
  id: 'liquify',
  label: '瘦臉瘦身',
  icon: <IconBody />,
  placement: { portrait: 60 },
  defaultParams: { strokes: [] },
  isIdentity: (p) => p.strokes.length === 0,

  steps: (p, ctx) => {
    if (!ctx.photo) return []
    // 排在臉部重塑之後
    return warpSteps(strokesToOps(p.strokes, ctx.photo.width, ctx.photo.height), ORDER.reshape + 1)
  },

  Overlay: createBrushOverlay<LiquifyParams>({
    read: (p) => p.strokes,
    write: (p, strokes) => ({ ...p, strokes }),
    extra: () => ({ strength: useStrength.getState().strength / 100 }),
    // 邊推邊看到變形
    live: true,
  }),
  overlayZoom: true,

  Panel: function LiquifyPanel() {
    const strength = useStrength((s) => s.strength)
    const set = (v: number) => useStrength.setState({ strength: v })
    return (
      <div className="brush-panel">
        <p className="brush-hint">從輪廓外側往內慢慢推；力度低一點、多推幾次比較自然</p>
        <div className="brush-size">
          <span className="brush-size-label brush-row-label">力度</span>
          <Slider label="力度" value={strength} min={5} max={100} defaultValue={DEFAULT_STRENGTH} onChange={set} onCommit={set} />
        </div>
        <BrushControls eraser={false} />
      </div>
    )
  },
})
