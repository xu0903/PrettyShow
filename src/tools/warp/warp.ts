// 局部變形（液化）：臉部重塑、手動推臉共用。
// 每個變形是一個圓形範圍內的「推移」或「縮放」，越靠近圓心影響越大、邊緣自然過渡。
// shader 用反向取樣：對每個輸出像素，算出它應該從原圖的哪個位置取色。

import type { GpuStep } from '../../core/tool.ts'
import { FRAGMENT_HEADER } from '../../gl/pass.ts'

/** 座標都是原圖 0..1、原點左上；半徑和位移是原圖長邊的比例 */
export type WarpOp =
  /** 把 (x, y) 附近的內容往 (dx, dy) 推（圓心是推過去之後的位置） */
  | { kind: 'move'; x: number; y: number; r: number; dx: number; dy: number }
  /** 以 (x, y) 為中心放大（s > 0）或縮小（s < 0），例如大眼、嘴型 */
  | { kind: 'scale'; x: number; y: number; r: number; s: number }

/** 一次 shader 最多處理幾個變形（iOS 的 uniform 數量有限）；更多就分成好幾次 */
export const OPS_PER_PASS = 32

const warpFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
const int MAX = ${OPS_PER_PASS};
uniform vec4 u_a[MAX]; // 圓心 x, y（GL uv）, 半徑, 種類（0 推移、1 縮放）
uniform vec4 u_b[MAX]; // 推移：dx, dy（GL 方向）；縮放：s
uniform int u_count;

void main() {
  vec2 p = v_uv * u_outSize;
  float longSide = max(u_outSize.x, u_outSize.y);
  vec2 offset = vec2(0.0);
  for (int i = 0; i < MAX; i++) {
    if (i >= u_count) break;
    vec4 a = u_a[i];
    vec4 b = u_b[i];
    vec2 q = p - a.xy * u_outSize;
    float r = a.z * longSide;
    float t = dot(q, q) / (r * r);
    if (t >= 1.0) continue;
    // 平滑的權重：圓心 1、邊緣 0，而且邊緣的斜率也是 0，看不出圓的邊界
    float w = (1.0 - t) * (1.0 - t);
    if (a.w < 0.5) offset -= b.xy * longSide * w;
    else offset -= q * b.x * w;
  }
  outColor = texture(u_image, (p + offset) / u_outSize);
}`

/** 變形清單 → shader 步驟（座標換成 GL 的 y 向上） */
export function warpSteps(ops: readonly WarpOp[], order: number): GpuStep[] {
  const steps: GpuStep[] = []
  for (let i = 0; i < ops.length; i += OPS_PER_PASS) {
    const chunk = ops.slice(i, i + OPS_PER_PASS)
    const a = new Array<number>(OPS_PER_PASS * 4).fill(0)
    const b = new Array<number>(OPS_PER_PASS * 4).fill(0)
    chunk.forEach((op, k) => {
      a.splice(k * 4, 4, op.x, 1 - op.y, op.r, op.kind === 'move' ? 0 : 1)
      b.splice(k * 4, 4, ...(op.kind === 'move' ? [op.dx, -op.dy, 0, 0] : [op.s, 0, 0, 0]))
    })
    steps.push({ order, pass: { id: 'warp', fragment: warpFragment, uniforms: { u_a: a, u_b: b, u_count: chunk.length } } })
  }
  return steps
}
