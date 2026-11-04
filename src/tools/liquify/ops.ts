// 手動推臉：把手指拖過的路徑換算成一連串的「推移」。
// 每移動一小段（筆刷半徑的 1/3）就推一次，推的量等於手指移動的距離，內容會跟著手指走。

import type { Stroke } from '../brush/strokes.ts'
import type { WarpOp } from '../warp/warp.ts'

/** 每隔多少（筆刷半徑的倍數）推一次 */
const SPACING = 0.33

export function strokesToOps(strokes: readonly Stroke[], W: number, H: number): WarpOp[] {
  const L = Math.max(W, H)
  const ops: WarpOp[] = []
  for (const s of strokes) {
    const r = s.r * L
    const step = Math.max(1, r * SPACING)
    // 在像素空間沿著路徑重新取樣
    let last = { x: s.pts[0] * W, y: s.pts[1] * H }
    for (let i = 2; i < s.pts.length; i += 2) {
      const pt = { x: s.pts[i] * W, y: s.pts[i + 1] * H }
      let d = Math.hypot(pt.x - last.x, pt.y - last.y)
      while (d >= step) {
        const k = step / d
        const next = { x: last.x + (pt.x - last.x) * k, y: last.y + (pt.y - last.y) * k }
        ops.push({ kind: 'move', x: next.x / W, y: next.y / H, r: s.r, dx: (next.x - last.x) / L, dy: (next.y - last.y) / L })
        last = next
        d = Math.hypot(pt.x - last.x, pt.y - last.y)
      }
    }
  }
  return ops
}
