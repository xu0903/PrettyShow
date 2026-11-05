// 疊在照片最上面的物件（文字、貼紙）：資料格式、量大小、畫到畫布上。
// 位置、大小都是「最後輸出的畫面」的比例，所以預覽和匯出原圖時位置、大小都一樣。

import { FRAGMENT_HEADER, type Texture2DSource } from '../../gl/pass.ts'
import { flipRowsRGBA } from '../../image/raster.ts'

export type FontId = 'sans' | 'serif' | 'round' | 'hand'
export type TextStyle = 'plain' | 'outline' | 'label'

interface Base {
  id: string
  /** 中心點（0..1，原點左上） */
  x: number
  y: number
  /** 字高或貼紙高度：畫面短邊的比例 */
  size: number
  /** 旋轉（弧度，順時針） */
  rot: number
}

export interface TextLayer extends Base {
  kind: 'text'
  text: string
  color: string
  font: FontId
  style: TextStyle
}

export interface StickerLayer extends Base {
  kind: 'sticker'
  emoji: string
}

export type Layer = TextLayer | StickerLayer

export const FONTS: { id: FontId; label: string; css: string; family?: string }[] = [
  { id: 'sans', label: '黑體', css: '"PingFang TC", "Noto Sans TC", "Heiti TC", sans-serif' },
  { id: 'serif', label: '明體', css: '"Noto Serif TC", "Songti TC", serif', family: 'Noto Serif TC' },
  { id: 'round', label: '粉圓', css: '"Huninn", "PingFang TC", sans-serif', family: 'Huninn' },
  { id: 'hand', label: '文楷', css: '"LXGW WenKai TC", "Kaiti TC", cursive', family: 'LXGW WenKai TC' },
]

const fontCss = (id: FontId) => FONTS.find((f) => f.id === id)!.css

export const newId = () => Math.random().toString(36).slice(2, 10)

/** 文字的行高、內距（字高的倍數） */
const LINE = 1.25
const PAD = { plain: 0.12, outline: 0.18, label: 0.4 }

let measureCtx: CanvasRenderingContext2D | null = null

/** 物件在畫面上的大小（px）；W、H 是整個畫面的大小 */
export function layerBox(l: Layer, W: number, H: number): { w: number; h: number; fontPx: number } {
  const fontPx = l.size * Math.min(W, H)
  if (l.kind === 'sticker') return { w: fontPx * 1.15, h: fontPx * 1.15, fontPx }
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  measureCtx.font = `600 ${fontPx}px ${fontCss(l.font)}`
  const lines = (l.text || ' ').split('\n')
  const textW = Math.max(...lines.map((s) => measureCtx!.measureText(s || ' ').width))
  const pad = fontPx * PAD[l.style]
  return { w: textW + pad * 2, h: lines.length * fontPx * LINE + pad * 2, fontPx }
}

/** 白字配深色描邊、深色字配白色描邊 */
function contrastOf(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  const l = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)
  return l > 150 ? 'rgba(0,0,0,0.75)' : '#ffffff'
}

/** 把所有物件畫到畫布上 */
export function drawLayers(ctx: CanvasRenderingContext2D, layers: readonly Layer[]): void {
  const { width: W, height: H } = ctx.canvas
  for (const l of layers) {
    const { w, h, fontPx } = layerBox(l, W, H)
    ctx.save()
    ctx.translate(l.x * W, l.y * H)
    ctx.rotate(l.rot)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (l.kind === 'sticker') {
      ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
      ctx.fillText(l.emoji, 0, fontPx * 0.05)
      ctx.restore()
      continue
    }
    if (l.style === 'label') {
      // 底色標籤：圓角矩形，字的顏色就是底色，字用對比色
      ctx.fillStyle = l.color
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, fontPx * 0.35)
      ctx.fill()
    }
    ctx.font = `600 ${fontPx}px ${fontCss(l.font)}`
    const lines = (l.text || ' ').split('\n')
    const top = -((lines.length - 1) * fontPx * LINE) / 2
    lines.forEach((line, i) => {
      const y = top + i * fontPx * LINE
      if (l.style === 'outline') {
        ctx.lineJoin = 'round'
        ctx.lineWidth = fontPx * 0.16
        ctx.strokeStyle = contrastOf(l.color)
        ctx.strokeText(line, 0, y)
      }
      ctx.fillStyle = l.style === 'label' ? contrastOf(l.color) : l.color
      ctx.fillText(line, 0, y)
    })
    ctx.restore()
  }
}

// ---- 貼圖快取：同一份物件、同樣尺寸只畫一次 ----

const ids = new WeakMap<readonly Layer[], number>()
let nextId = 0
const cache = new Map<string, Texture2DSource>()

export function layersTexture(
  slot: string,
  layers: readonly Layer[],
  size: { width: number; height: number },
  fontsReady: boolean,
): Texture2DSource {
  let id = ids.get(layers)
  if (id === undefined) {
    id = nextId++
    ids.set(layers, id)
  }
  // 字型還沒下載完時先用系統字型畫，下載完 key 會不一樣，自動重畫
  const key = `${slot}#${id}@${size.width}x${size.height}${fontsReady ? '' : '~'}`
  const hit = cache.get(slot)
  if (hit?.key === key) return hit
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  drawLayers(ctx, layers)
  const data = flipRowsRGBA(ctx.getImageData(0, 0, size.width, size.height).data, size.width, size.height)
  canvas.width = canvas.height = 0
  const tex: Texture2DSource = { kind: '2d', key, slot, ...size, channels: 4, data }
  cache.set(slot, tex)
  return tex
}

/** 疊上物件的 shader（貼圖是沒有預乘透明度的 RGBA） */
export const LAYER_FRAGMENT =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_layers;
void main() {
  vec4 c = texture(u_image, v_uv);
  vec4 l = texture(u_layers, v_uv);
  outColor = vec4(mix(c.rgb, l.rgb, l.a), c.a);
}`
