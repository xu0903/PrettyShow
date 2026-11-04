// 用程式產生內建濾鏡的 LUT（PNG 長條格式，見 src/tools/filter/lut.ts），輸出到 public/luts/。
// 每款濾鏡是一個「輸入顏色 → 輸出顏色」的函式，數值都是 0..1 的 sRGB。
// 執行：npm run luts
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SIZE = 33

// ---- 調色小工具 ----
const clamp = (x) => Math.min(1, Math.max(0, x))
const mix = (a, b, t) => a + (b - a) * t
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const smooth = (x) => x * x * (3 - 2 * x)
const map = (c, f) => c.map((v, i) => f(v, i))

/** S 曲線：k > 0 增加對比，暗部和亮部不會硬切 */
const sCurve = (c, k) => map(c, (v) => mix(v, smooth(clamp(v)), k))
/** 抬黑（褪色感）與壓白 */
const liftGain = (c, lift, gain = 1) => map(c, (v) => (lift + v * (1 - lift)) * gain)
/** 中間調亮度：g > 1 變亮 */
const gamma = (c, g) => map(c, (v) => Math.pow(clamp(v), 1 / g))
/** 飽和度 */
const saturate = (c, s) => {
  const l = luma(c)
  return map(c, (v) => mix(l, v, s))
}
/** 色溫：正值偏暖 */
const warm = (c, t) => [c[0] * (1 + t), c[1] * (1 + t * 0.2), c[2] * (1 - t)]
/** 分離色調：暗部染 shadow、亮部染 highlight（顏色以 0.5 為中性） */
const splitTone = (c, shadow, highlight, amount) => {
  const l = clamp(luma(c))
  return map(c, (v, i) => v + ((shadow[i] - 0.5) * (1 - l) + (highlight[i] - 0.5) * l) * amount)
}

// ---- 8 款濾鏡（id 要和 src/tools/filter/presets.ts 一致） ----
const LOOKS = {
  // 暖陽：偏暖、亮部帶一點金黃
  warm: (c) => {
    c = warm(c, 0.07)
    c = splitTone(c, [0.5, 0.48, 0.46], [0.58, 0.53, 0.42], 0.35)
    c = sCurve(c, 0.25)
    return saturate(c, 1.1)
  },
  // 冷調：偏藍、乾淨
  cool: (c) => {
    c = warm(c, -0.06)
    c = splitTone(c, [0.42, 0.48, 0.6], [0.48, 0.51, 0.55], 0.4)
    c = sCurve(c, 0.2)
    return saturate(c, 0.95)
  },
  // 底片：抬黑、暖膚色、綠色稍微往青
  film: (c) => {
    c = [c[0], c[1] * 0.97 + c[2] * 0.03, c[2]]
    c = liftGain(c, 0.06, 0.97)
    c = splitTone(c, [0.45, 0.5, 0.56], [0.57, 0.52, 0.44], 0.4)
    c = sCurve(c, 0.3)
    return saturate(c, 0.88)
  },
  // 褪色：低對比、低飽和、黑色變灰
  fade: (c) => {
    c = liftGain(c, 0.13, 0.95)
    c = map(c, (v) => mix(v, 0.5, 0.12))
    return saturate(c, 0.72)
  },
  // 日系：明亮、低對比、暗部偏青
  japan: (c) => {
    c = gamma(c, 1.18)
    c = liftGain(c, 0.05)
    c = splitTone(c, [0.44, 0.52, 0.56], [0.5, 0.51, 0.53], 0.45)
    c = map(c, (v) => mix(v, 0.55, 0.08))
    return saturate(c, 0.8)
  },
  // 黑白：高對比黑白，紅黃偏亮（膚色好看）
  mono: (c) => {
    const l = clamp(0.35 * c[0] + 0.55 * c[1] + 0.1 * c[2])
    const v = sCurve([l, l, l], 0.45)
    return v
  },
  // 電影：暗部青綠、亮部橘
  cinema: (c) => {
    c = splitTone(c, [0.38, 0.52, 0.58], [0.62, 0.52, 0.4], 0.55)
    c = sCurve(c, 0.3)
    return saturate(c, 1.05)
  },
  // 復古：泛黃、褪色、藍色變弱
  vintage: (c) => {
    c = saturate(c, 0.7)
    c = warm(c, 0.05)
    c = [c[0] * 0.98 + 0.05, c[1] * 0.97 + 0.045, c[2] * 0.85 + 0.03]
    c = splitTone(c, [0.47, 0.53, 0.47], [0.55, 0.52, 0.45], 0.3)
    return sCurve(c, 0.15)
  },
}

mkdirSync('public/luts', { recursive: true })
const W = SIZE * SIZE
for (const [id, look] of Object.entries(LOOKS)) {
  const px = Buffer.alloc(W * SIZE * 3)
  for (let g = 0; g < SIZE; g++) {
    for (let b = 0; b < SIZE; b++) {
      for (let r = 0; r < SIZE; r++) {
        const out = look([r / (SIZE - 1), g / (SIZE - 1), b / (SIZE - 1)])
        const i = (g * W + b * SIZE + r) * 3
        px[i] = Math.round(clamp(out[0]) * 255)
        px[i + 1] = Math.round(clamp(out[1]) * 255)
        px[i + 2] = Math.round(clamp(out[2]) * 255)
      }
    }
  }
  await sharp(px, { raw: { width: W, height: SIZE, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(`public/luts/${id}.png`)
  console.log('已產生', id)
}
