// 瘦臉瘦身（手動）：用手指把輪廓往內推，臉、腰、手臂都可以。每推一筆都能復原

import { defineTool, ORDER } from '../../core/tool.ts'
import { IconBody } from '../../ui/icons.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { createBrushOverlay } from '../brush/BrushOverlay.tsx'
import type { Stroke } from '../brush/strokes.ts'
import { warpSteps } from '../warp/warp.ts'
import { strokesToOps } from './ops.ts'

export interface LiquifyParams {
  strokes: Stroke[]
}

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
    // 邊推邊看到變形
    live: true,
  }),
  overlayZoom: true,

  Panel: function LiquifyPanel() {
    return (
      <div className="brush-panel">
        <p className="brush-hint">從輪廓外側往內推就會變瘦；筆刷大一點推出來比較自然</p>
        <BrushControls eraser={false} />
      </div>
    )
  },
})
