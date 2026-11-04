// 產生 App 圖示（PNG），不依賴任何第三方套件。
// 圖案是「老派復古相機 + 大地色背景」，共有 A–F 六款可選。
//
// 用法：
//   node scripts/gen-icons.mjs            → 用 DEFAULT_DESIGN 產生 public/icons/ 下的所有圖示
//   node scripts/gen-icons.mjs C          → 改用 C 款
//   node scripts/gen-icons.mjs --preview <輸出路徑.png>  → 產生六款並排的對照圖
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ★ 選定的款式改這裡
const DEFAULT_DESIGN = 'A'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// ---- 最小 PNG 編碼器 ----
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // 位元深度
  ihdr[9] = 6 // RGBA
  const stride = w * 4 + 1
  const raw = Buffer.alloc(h * stride) // 每列開頭是 filter byte 0
  for (let y = 0; y < h; y++) rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- 形狀（SDF：距離 <= 0 代表在形狀內） ----
// 座標系：圖示中心為 (0,0)，範圍 -0.5..0.5，y 向下
const box = (cx, cy, w, h, r = 0) => (x, y) => {
  const qx = Math.abs(x - cx) - w / 2 + r
  const qy = Math.abs(y - cy) - h / 2 + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r
const intersect = (a, b) => (x, y) => Math.max(a(x, y), b(x, y))
const outline = (s, t) => (x, y) => Math.abs(s(x, y)) - t

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

// 背景：中心稍亮的徑向漸層，加一點底片顆粒感
function earthBg(inner, outer) {
  const ci = hex(inner)
  const co = hex(outer)
  return (x, y) => {
    const t = Math.min(1, Math.hypot(x, y + 0.05) / 0.72)
    const n = (Math.sin(x * 9137.1 + y * 4271.3) * 43758.5453) % 1 // 決定性的雜訊
    return mix(ci, co, t).map((v) => v + n * 0.018)
  }
}
function linearBg(top, bottom) {
  const ct = hex(top)
  const cb = hex(bottom)
  return (_x, y) => mix(ct, cb, y + 0.5)
}

// 一個款式 = 背景 + 由下往上疊的圖層 [形狀, 顏色]
// 共用的鏡頭：外圈金屬、黑色鏡筒、鏡片、反光
function lens(cx, cy, r, metal, barrel = '#211915', glass = '#2f3d44') {
  return [
    [circle(cx, cy, r), metal],
    [circle(cx, cy, r * 0.8), barrel],
    [outline(circle(cx, cy, r * 0.66), r * 0.025), metal],
    [circle(cx, cy, r * 0.52), glass],
    [circle(cx, cy, r * 0.3), '#1b2429'],
    [circle(cx - r * 0.22, cy - r * 0.22, r * 0.13), '#b8c6cb'],
    [circle(cx + r * 0.2, cy + r * 0.2, r * 0.05), '#7d8f96'],
  ]
}

const designs = {
  // A：赤陶背景、奶油色旁軸相機（深棕皮革）
  A: {
    bg: earthBg('#c96c43', '#9c4a2a'),
    layers: (s) => {
      const body = box(0, 0.06 * s, 0.76 * s, 0.46 * s, 0.07 * s)
      return [
        [box(-0.2 * s, -0.2 * s, 0.2 * s, 0.1 * s, 0.03 * s), '#efe4cf'], // 頂部凸起
        [box(0.22 * s, -0.19 * s, 0.1 * s, 0.06 * s, 0.02 * s), '#3b2a21'], // 快門鈕
        [body, '#efe4cf'],
        [intersect(body, box(0, 0.12 * s, 1, 0.24 * s)), '#4a3226'], // 皮革
        [box(-0.24 * s, -0.07 * s, 0.13 * s, 0.07 * s, 0.015 * s), '#2a201b'], // 觀景窗
        [box(0.26 * s, -0.07 * s, 0.07 * s, 0.05 * s, 0.012 * s), '#2a201b'],
        ...lens(0.05 * s, 0.08 * s, 0.2 * s, '#d4cab8'),
      ]
    },
  },
  // B：橄欖綠背景、銀頂黑身的經典旁軸
  B: {
    bg: earthBg('#7d7944', '#56522a'),
    layers: (s) => {
      const body = box(0, 0.05 * s, 0.8 * s, 0.44 * s, 0.06 * s)
      return [
        [box(0.2 * s, -0.2 * s, 0.12 * s, 0.07 * s, 0.02 * s), '#d9d2c3'], // 快門盤
        [box(-0.25 * s, -0.19 * s, 0.1 * s, 0.05 * s, 0.015 * s), '#d9d2c3'], // 倒片鈕
        [body, '#d9d2c3'],
        [intersect(body, box(0, 0.08 * s, 1, 0.3 * s)), '#1f1b18'], // 黑色蒙皮
        [box(-0.22 * s, -0.1 * s, 0.14 * s, 0.06 * s, 0.01 * s), '#3a3631'], // 觀景窗
        [box(0.12 * s, -0.1 * s, 0.1 * s, 0.06 * s, 0.01 * s), '#3a3631'],
        [circle(0.31 * s, -0.1 * s, 0.022 * s), '#c9963c'], // 赭黃小圓點
        ...lens(0, 0.1 * s, 0.19 * s, '#cfc8b9', '#141110'),
      ]
    },
  },
  // C：沙色背景、棕色雙眼相機（TLR）
  C: {
    bg: earthBg('#e0cba6', '#bfa47a'),
    layers: (s) => {
      const body = box(0, 0.03 * s, 0.48 * s, 0.72 * s, 0.06 * s)
      return [
        [box(0, -0.35 * s, 0.48 * s, 0.08 * s, 0.03 * s), '#3b2a20'], // 頂部遮光罩
        [body, '#6b4a32'],
        [box(0, 0.03 * s, 0.4 * s, 0.64 * s, 0.04 * s), '#5a3d29'], // 前面板
        [box(0, 0.02 * s, 0.3 * s, 0.045 * s, 0.01 * s), '#e9dcc3'], // 名牌
        ...lens(0, -0.14 * s, 0.11 * s, '#d4cab8'), // 取景鏡
        ...lens(0, 0.19 * s, 0.13 * s, '#d4cab8'), // 拍攝鏡
      ]
    },
  },
  // D：芥末黃背景、奶油色拍立得（大地色彩虹條）
  D: {
    bg: earthBg('#d4a24a', '#a9772a'),
    layers: (s) => {
      const body = box(0, 0.03 * s, 0.7 * s, 0.62 * s, 0.1 * s)
      const stripe = (i, c) => [intersect(body, box((i - 1.5) * 0.06 * s, 0, 0.06 * s, 1)), c]
      return [
        [body, '#f2e8d5'],
        [intersect(body, box(0, 0.27 * s, 1, 0.14 * s)), '#e2d5bd'], // 下方出紙口區
        [box(0, 0.27 * s, 0.4 * s, 0.025 * s, 0.01 * s), '#3b2c22'], // 出紙口
        stripe(0, '#b5532f'),
        stripe(1, '#d68a3a'),
        stripe(2, '#c9a54a'),
        stripe(3, '#6f7a3d'),
        [box(-0.2 * s, -0.17 * s, 0.12 * s, 0.09 * s, 0.02 * s), '#2a201b'], // 觀景窗
        [box(0.2 * s, -0.17 * s, 0.14 * s, 0.09 * s, 0.02 * s), '#3b2c22'], // 閃光燈
        [box(0.2 * s, -0.17 * s, 0.11 * s, 0.06 * s, 0.015 * s), '#e8e2d6'],
        ...lens(0, 0.02 * s, 0.15 * s, '#3b2c22', '#1b1512'),
      ]
    },
  },
  // E：深可可背景、干邑皮革相機配黃銅鏡頭
  E: {
    bg: earthBg('#54392a', '#2f1f16'),
    layers: (s) => {
      const body = box(0, 0.06 * s, 0.78 * s, 0.46 * s, 0.07 * s)
      return [
        [box(0, -0.2 * s, 0.22 * s, 0.12 * s, 0.04 * s), '#e6d6b8'], // 中央稜鏡蓋（單眼）
        [box(0.26 * s, -0.18 * s, 0.1 * s, 0.05 * s, 0.02 * s), '#c9a25a'], // 黃銅快門
        [body, '#e6d6b8'],
        [intersect(body, box(0, 0.12 * s, 1, 0.28 * s)), '#a86b3c'], // 干邑皮革
        [box(-0.28 * s, -0.07 * s, 0.06 * s, 0.04 * s, 0.01 * s), '#3a281d'],
        ...lens(0, 0.08 * s, 0.21 * s, '#c9a25a', '#2a1c14'),
      ]
    },
  },
  // F：鏽紅→赭黃漸層背景、奶油色線條相機（極簡）
  F: {
    bg: linearBg('#c2602f', '#d9a24f'),
    layers: (s) => {
      const t = 0.028 * s
      const cream = '#f6ecd9'
      return [
        [outline(box(0, 0.06 * s, 0.74 * s, 0.46 * s, 0.08 * s), t), cream],
        // 頂部凸起只畫機身上緣以上的部分，讓它和機身線條相連
        [intersect(outline(box(-0.18 * s, -0.215 * s, 0.2 * s, 0.09 * s, 0.03 * s), t), (_x, y) => y + 0.17 * s), cream],
        [outline(circle(0.03 * s, 0.07 * s, 0.17 * s), t), cream],
        [outline(circle(0.03 * s, 0.07 * s, 0.09 * s), t), cream],
        [circle(0.23 * s, -0.07 * s, 0.03 * s), cream],
      ]
    },
  },
}

// 把一個款式畫成 RGBA buffer
function renderDesign(key, size, scale = 1) {
  const d = designs[key]
  const layers = d.layers(scale).map(([shape, color]) => [shape, typeof color === 'string' ? hex(color) : color])
  const buf = Buffer.alloc(size * size * 4)
  const ss = size <= 64 ? 6 : 4 // 超取樣抗鋸齒
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size - 0.5
          const y = (py + (sy + 0.5) / ss) / size - 0.5
          let c = d.bg(x, y)
          for (const [shape, color] of layers) if (shape(x, y) <= 0) c = color
          r += c[0]; g += c[1]; b += c[2]
        }
      }
      const n = ss * ss
      const i = (py * size + px) * 4
      buf[i] = Math.round(Math.min(1, Math.max(0, r / n)) * 255)
      buf[i + 1] = Math.round(Math.min(1, Math.max(0, g / n)) * 255)
      buf[i + 2] = Math.round(Math.min(1, Math.max(0, b / n)) * 255)
      buf[i + 3] = 255 // iOS 圖示必須不透明，圓角由系統處理
    }
  }
  return buf
}

// 對照圖：六款排成 3x2，套上 iOS 圓角，看起來比較像實際主畫面
function renderPreview(path) {
  const cell = 256
  const gap = 40
  const keys = Object.keys(designs)
  const cols = 3
  const rows = Math.ceil(keys.length / cols)
  const W = cols * cell + (cols + 1) * gap
  const H = rows * cell + (rows + 1) * gap
  const sheet = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) sheet.set([28, 28, 30, 255], i * 4)
  const radius = cell * 0.225
  const mask = box(cell / 2, cell / 2, cell, cell, radius)
  keys.forEach((k, idx) => {
    const icon = renderDesign(k, cell)
    const ox = gap + (idx % cols) * (cell + gap)
    const oy = gap + Math.floor(idx / cols) * (cell + gap)
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        // 圓角邊緣用 SDF 做 1px 抗鋸齒
        const a = Math.min(1, Math.max(0, 0.5 - mask(x + 0.5, y + 0.5)))
        if (a <= 0) continue
        const si = ((oy + y) * W + ox + x) * 4
        const ii = (y * cell + x) * 4
        for (let c = 0; c < 3; c++) sheet[si + c] = Math.round(sheet[si + c] * (1 - a) + icon[ii + c] * a)
      }
    }
  })
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePng(W, H, sheet))
  console.log('已產生對照圖', path, '（由左到右、由上到下：' + keys.join(' ') + '）')
}

// ---- 主程式 ----
const args = process.argv.slice(2)
if (args[0] === '--preview') {
  renderPreview(args[1] ?? join(outDir, '..', '..', 'icon-preview.png'))
} else {
  const key = (args[0] ?? DEFAULT_DESIGN).toUpperCase()
  if (!designs[key]) throw new Error(`沒有 ${key} 款，可選：${Object.keys(designs).join(', ')}`)
  mkdirSync(outDir, { recursive: true })
  const targets = [
    ['apple-touch-icon.png', 180, 1],
    ['icon-192.png', 192, 1],
    ['icon-512.png', 512, 1],
    ['icon-maskable-512.png', 512, 0.78], // maskable 圖案要縮進中間的安全區
    ['favicon-32.png', 32, 1],
  ]
  for (const [name, size, scale] of targets) {
    writeFileSync(join(outDir, name), encodePng(size, size, renderDesign(key, size, scale)))
    console.log(`已產生 ${name}（${key} 款）`)
  }
}
