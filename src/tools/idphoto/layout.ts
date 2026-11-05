// 證件照的版面：依臉的位置自動裁切（頭的大小、頭頂留白），和 4×6 沖印排版。純函式，方便測試。

import type { Point } from '../../core/tool.ts'

export type IdSize = 'one' | 'two' | 'bigtwo' | 'usvisa'

export const SIZES: { id: IdSize; label: string; mm: [number, number]; head: number }[] = [
  // head：頭頂到下巴佔照片高度的比例
  { id: 'two', label: '二吋（身分證、護照）', mm: [35, 45], head: 0.76 },
  { id: 'one', label: '一吋', mm: [28, 35], head: 0.72 },
  { id: 'bigtwo', label: '大二吋', mm: [42, 47], head: 0.7 },
  { id: 'usvisa', label: '美國簽證', mm: [51, 51], head: 0.6 },
]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const FOREHEAD = 10
const CHIN = 152
const CHEEK_A = 234
const CHEEK_B = 454

/**
 * 依臉部特徵點算出裁切範圍（0..1，原點左上）。可以超出照片，超出的地方會補上背景色。
 * 特徵點 10 在髮際附近，頭頂大約再往上「額頭到下巴」的 0.45 倍。
 */
export function idCrop(face: readonly Point[], W: number, H: number, size: IdSize): Rect {
  const spec = SIZES.find((s) => s.id === size)!
  const P = (i: number) => ({ x: face[i].x * W, y: face[i].y * H })
  const top = P(FOREHEAD)
  const chin = P(CHIN)
  const crown = top.y - (chin.y - top.y) * 0.45
  const headH = chin.y - crown
  const photoH = headH / spec.head
  const photoW = photoH * (spec.mm[0] / spec.mm[1])
  // 頭頂上方留白：剩下空間的 40%
  const y = crown - photoH * (1 - spec.head) * 0.4
  const cx = (P(CHEEK_A).x + P(CHEEK_B).x) / 2
  return { x: (cx - photoW / 2) / W, y: y / H, w: photoW / W, h: photoH / H }
}

/** 4×6 吋（300dpi）的沖印紙上可以排幾張、排在哪裡（px） */
export function printSheet(size: IdSize, dpi = 300): { width: number; height: number; cells: Rect[]; photo: [number, number] } {
  const spec = SIZES.find((s) => s.id === size)!
  const mm = (v: number) => Math.round((v / 25.4) * dpi)
  const width = mm(152.4)
  const height = mm(101.6)
  const [pw, ph] = [mm(spec.mm[0]), mm(spec.mm[1])]
  const gap = mm(2)
  const cols = Math.floor((width - gap) / (pw + gap))
  const rows = Math.floor((height - gap) / (ph + gap))
  // 置中
  const ox = Math.round((width - (cols * pw + (cols - 1) * gap)) / 2)
  const oy = Math.round((height - (rows * ph + (rows - 1) * gap)) / 2)
  const cells: Rect[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: ox + c * (pw + gap), y: oy + r * (ph + gap), w: pw, h: ph })
  return { width, height, cells, photo: [pw, ph] }
}
