// 智慧優化的分析：看照片的亮度分布，算出黑點、白點、曝光（gamma）和白平衡。
// 純函式（輸入像素、輸出參數），方便測試。

export interface Stats {
  /** 每個色版的黑點、白點（0..1） */
  lo: [number, number, number]
  hi: [number, number, number]
  /** 亮度的黑點、白點 */
  lumaLo: number
  lumaHi: number
  /** 拉開黑白點之後的平均亮度 */
  mean: number
}

/** 忽略最暗和最亮的這個比例，避免幾個極端的像素（反光、純黑）影響結果 */
const CLIP = 0.005

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += hist[i]
    if (sum >= target) return i / 255
  }
  return 1
}

/** 從 RGBA 像素（getImageData 的結果）算出統計 */
export function computeStats(px: Uint8ClampedArray): Stats {
  const hists = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  const n = px.length / 4
  for (let i = 0; i < n; i++) {
    const r = px[i * 4]
    const g = px[i * 4 + 1]
    const b = px[i * 4 + 2]
    hists[0][r]++
    hists[1][g]++
    hists[2][b]++
    hists[3][Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)]++
  }
  const lo = [0, 1, 2].map((k) => percentile(hists[k], n, CLIP)) as Stats['lo']
  const hi = [0, 1, 2].map((k) => percentile(hists[k], n, 1 - CLIP)) as Stats['hi']
  const lumaLo = percentile(hists[3], n, CLIP)
  const lumaHi = percentile(hists[3], n, 1 - CLIP)
  // 拉開之後的平均亮度
  let sum = 0
  const span = Math.max(1e-3, lumaHi - lumaLo)
  for (let v = 0; v < 256; v++) sum += hists[3][v] * Math.min(1, Math.max(0, (v / 255 - lumaLo) / span))
  return { lo, hi, lumaLo, lumaHi, mean: sum / n }
}

export type AutoMode = 'auto' | 'portrait' | 'landscape' | 'food' | 'night'

interface ModeTuning {
  /** 拉開黑白點的程度（人像柔和一點） */
  levels: number
  /** 白平衡修正的程度 */
  wb: number
  /** 目標平均亮度 */
  target: number
  vibrance: number
  warm: number
  /** 暗部提亮 */
  lift: number
}

export const MODES: { id: AutoMode; label: string; t: ModeTuning }[] = [
  { id: 'auto', label: '自動', t: { levels: 0.8, wb: 0.5, target: 0.48, vibrance: 0.2, warm: 0, lift: 0.05 } },
  { id: 'portrait', label: '人像', t: { levels: 0.6, wb: 0.5, target: 0.5, vibrance: 0.1, warm: 0.015, lift: 0.06 } },
  { id: 'landscape', label: '風景', t: { levels: 0.9, wb: 0.6, target: 0.47, vibrance: 0.35, warm: 0, lift: 0.04 } },
  { id: 'food', label: '美食', t: { levels: 0.8, wb: 0.4, target: 0.5, vibrance: 0.3, warm: 0.035, lift: 0.03 } },
  { id: 'night', label: '夜景', t: { levels: 0.7, wb: 0.3, target: 0.42, vibrance: 0.15, warm: -0.01, lift: 0.2 } },
]

export interface AutoUniforms {
  u_lo: number[]
  u_hi: number[]
  u_gamma: number
  u_vibrance: number
  u_warm: number
  u_lift: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** 依統計和模式算出 shader 參數 */
export function autoUniforms(s: Stats, mode: AutoMode): AutoUniforms {
  const t = MODES.find((m) => m.id === mode)!.t
  // 每個色版的黑白點 = 亮度的黑白點和該色版自己的黑白點之間（越靠色版自己，白平衡修正越多）
  // 也限制拉開的幅度，避免本來就很暗或很亮的照片被拉得太誇張
  const lo = s.lo.map((v) => clamp(mix(0, mix(s.lumaLo, v, t.wb), t.levels), 0, 0.15))
  const hi = s.hi.map((v) => clamp(mix(1, mix(s.lumaHi, v, t.wb), t.levels), 0.8, 1))
  // 讓平均亮度接近目標
  const mean = clamp(s.mean, 0.05, 0.95)
  const gamma = clamp(Math.log(t.target) / Math.log(mean), 0.65, 1.5)
  return { u_lo: lo, u_hi: hi, u_gamma: gamma, u_vibrance: t.vibrance, u_warm: t.warm, u_lift: t.lift }
}
