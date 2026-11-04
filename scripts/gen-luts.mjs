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

/** 亮部染色（不影響暗部），例如韓系的奶油、蜜桃亮部 */
const tintHighlights = (c, tint, amount) => {
  const l = smooth(clamp(luma(c)))
  return map(c, (v, i) => v + (tint[i] - 0.5) * l * amount)
}

// ---- HSL 與「只調某個顏色」（例如把綠色往橄欖綠偏，底片常見） ----
function rgb2hsl([r, g, b]) {
  r = clamp(r)
  g = clamp(g)
  b = clamp(b)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hsl2rgb([h, s, l]) {
  h = ((h % 360) + 360) % 360
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

/**
 * 只調某個色相附近的顏色。
 * @param center 色相中心（度）：紅 0、黃 60、綠 120、青 180、藍 220、洋紅 300
 * @param width  影響範圍（度）
 * @param adj    dh 色相偏移（度）、ds 飽和度倍數、dl 亮度增減
 */
const selective = (c, center, width, { dh = 0, ds = 1, dl = 0 }) => {
  const [h, s, l] = rgb2hsl(c)
  let d = Math.abs(h - center) % 360
  if (d > 180) d = 360 - d
  const w = s < 0.02 ? 0 : smooth(clamp(1 - d / width))
  if (w === 0) return c
  return hsl2rgb([h + dh * w, clamp(s * mix(1, ds, w)), clamp(l + dl * w * s)])
}

// ---- 濾鏡（id 要和 src/tools/filter/presets.ts 一致） ----
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

  // ======== 韓系：明亮、柔和、低對比，亮部帶奶油或蜜桃色 ========
  // 奶油白（밀크톤）：整體提亮、抬黑、亮部奶油色，皮膚乾淨
  kmilk: (c) => {
    c = gamma(c, 1.15)
    c = liftGain(c, 0.06, 0.98)
    c = tintHighlights(c, [0.56, 0.53, 0.47], 0.35)
    c = map(c, (v) => mix(v, 0.6, 0.06))
    return saturate(c, 0.85)
  },
  // 蜜桃（피치톤）：亮部偏粉橘，膚色紅潤
  kpeach: (c) => {
    c = gamma(c, 1.1)
    c = liftGain(c, 0.04)
    c = tintHighlights(c, [0.6, 0.5, 0.48], 0.4)
    c = selective(c, 25, 50, { ds: 1.08, dl: 0.03 })
    c = sCurve(c, 0.1)
    return saturate(c, 0.95)
  },
  // 咖啡廳：暖米色、綠色降飽和、柔和對比
  kcafe: (c) => {
    c = warm(c, 0.05)
    c = selective(c, 120, 60, { dh: -15, ds: 0.6 })
    c = selective(c, 220, 60, { ds: 0.7 })
    c = liftGain(c, 0.05, 0.97)
    c = splitTone(c, [0.5, 0.48, 0.45], [0.55, 0.52, 0.46], 0.35)
    return saturate(c, 0.85)
  },
  // 天空藍：乾淨的冷調，藍天更藍、白色更白
  ksky: (c) => {
    c = warm(c, -0.04)
    c = selective(c, 215, 50, { ds: 1.25, dl: 0.04 })
    c = gamma(c, 1.08)
    c = sCurve(c, 0.12)
    return saturate(c, 0.95)
  },
  // 韓系膠片：暗部帶青綠、亮部暖、微微褪色
  kfilm: (c) => {
    c = liftGain(c, 0.05, 0.97)
    c = splitTone(c, [0.45, 0.52, 0.52], [0.56, 0.52, 0.46], 0.4)
    c = selective(c, 120, 60, { dh: -10, ds: 0.8 })
    c = sCurve(c, 0.18)
    return saturate(c, 0.88)
  },

  // ======== 日系復古：底片的色偏、褪色、泛黃 ========
  // 富士底片：綠色偏青、暗部青綠、亮部微洋紅，有點褪色
  fuji: (c) => {
    c = selective(c, 120, 60, { dh: 15, ds: 0.9 })
    c = selective(c, 0, 40, { ds: 0.9 })
    c = splitTone(c, [0.44, 0.53, 0.52], [0.53, 0.5, 0.5], 0.4)
    c = liftGain(c, 0.05, 0.97)
    return sCurve(c, 0.22)
  },
  // 柯達金：溫暖的金黃色、紅色飽和
  kodak: (c) => {
    c = warm(c, 0.08)
    c = splitTone(c, [0.52, 0.49, 0.44], [0.6, 0.55, 0.4], 0.4)
    c = selective(c, 10, 40, { ds: 1.15 })
    c = selective(c, 220, 60, { ds: 0.8 })
    c = sCurve(c, 0.25)
    return saturate(c, 1.05)
  },
  // 昭和：大幅褪色、泛黃、低飽和、帶一點洋紅
  showa: (c) => {
    c = saturate(c, 0.6)
    c = liftGain(c, 0.12, 0.93)
    c = [c[0] * 0.97 + 0.05, c[1] * 0.95 + 0.04, c[2] * 0.82 + 0.03]
    c = splitTone(c, [0.53, 0.47, 0.5], [0.56, 0.53, 0.44], 0.35)
    return sCurve(c, 0.12)
  },
  // 拍立得：抬黑、暗部青、亮部奶油、柔和
  polaroid: (c) => {
    c = liftGain(c, 0.1, 0.95)
    c = splitTone(c, [0.43, 0.52, 0.56], [0.57, 0.54, 0.45], 0.45)
    c = map(c, (v) => mix(v, 0.55, 0.08))
    return saturate(c, 0.82)
  },
  // 夏日：明亮、天空青藍、高曝光的日系夏天
  summer: (c) => {
    c = gamma(c, 1.2)
    c = selective(c, 210, 60, { dh: -10, ds: 1.15 })
    c = splitTone(c, [0.45, 0.52, 0.55], [0.52, 0.52, 0.5], 0.35)
    c = liftGain(c, 0.04)
    return saturate(c, 0.92)
  },

  // ======== 清新：通透、乾淨、偏冷或偏綠 ========
  // 透明感：明亮、低對比、微冷、去黃
  clear: (c) => {
    c = gamma(c, 1.15)
    c = warm(c, -0.03)
    c = selective(c, 50, 40, { ds: 0.75 })
    c = map(c, (v) => mix(v, 0.62, 0.07))
    return saturate(c, 0.88)
  },
  // 薄荷：帶一點青綠，清涼
  mint: (c) => {
    c = gamma(c, 1.1)
    c = splitTone(c, [0.45, 0.54, 0.52], [0.48, 0.53, 0.51], 0.45)
    c = selective(c, 120, 70, { dh: 15, ds: 1.05 })
    return saturate(c, 0.9)
  },
  // 晨光：柔和的暖亮、低對比
  morning: (c) => {
    c = gamma(c, 1.12)
    c = liftGain(c, 0.05)
    c = tintHighlights(c, [0.56, 0.54, 0.46], 0.3)
    c = map(c, (v) => mix(v, 0.6, 0.06))
    return saturate(c, 0.92)
  },
  // 冰透：冷藍、高調、白色很白
  ice: (c) => {
    c = gamma(c, 1.15)
    c = warm(c, -0.07)
    c = splitTone(c, [0.44, 0.5, 0.58], [0.48, 0.51, 0.54], 0.35)
    return saturate(c, 0.82)
  },
  // 森系：綠色往橄欖、暖、柔和
  forest: (c) => {
    c = selective(c, 120, 70, { dh: -20, ds: 0.75, dl: -0.03 })
    c = warm(c, 0.03)
    c = liftGain(c, 0.06, 0.97)
    c = splitTone(c, [0.47, 0.52, 0.47], [0.54, 0.53, 0.47], 0.3)
    return saturate(c, 0.9)
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
