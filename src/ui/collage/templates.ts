// 拼圖的版型：每一格是畫面上的一塊（0..1 的比例），依照片張數提供幾種排法

export interface Cell {
  x: number
  y: number
  w: number
  h: number
}

/** rows × cols 的格子 */
export function grid(rows: number, cols: number): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows })
  return cells
}

/** 一張大的在左邊（或上面），其他的排在旁邊 */
function bigPlus(n: number, vertical: boolean, big = 0.6): Cell[] {
  const rest = n - 1
  const cells: Cell[] = [vertical ? { x: 0, y: 0, w: 1, h: big } : { x: 0, y: 0, w: big, h: 1 }]
  for (let i = 0; i < rest; i++)
    cells.push(vertical ? { x: i / rest, y: big, w: 1 / rest, h: 1 - big } : { x: big, y: i / rest, w: 1 - big, h: 1 / rest })
  return cells
}

/** 分成兩排：上面 a 張、下面 b 張 */
function twoRows(a: number, b: number): Cell[] {
  return [
    ...Array.from({ length: a }, (_, i) => ({ x: i / a, y: 0, w: 1 / a, h: 0.5 })),
    ...Array.from({ length: b }, (_, i) => ({ x: i / b, y: 0.5, w: 1 / b, h: 0.5 })),
  ]
}

/** 這個張數可以用的版型（第一個是預設） */
export function templatesFor(n: number): Cell[][] {
  switch (n) {
    case 1:
      return [grid(1, 1)]
    case 2:
      return [grid(1, 2), grid(2, 1), bigPlus(2, false, 0.62), bigPlus(2, true, 0.62)]
    case 3:
      return [bigPlus(3, false), grid(1, 3), grid(3, 1), bigPlus(3, true)]
    case 4:
      return [grid(2, 2), bigPlus(4, false), bigPlus(4, true), grid(1, 4), grid(4, 1)]
    case 5:
      return [twoRows(2, 3), twoRows(3, 2), bigPlus(5, false), bigPlus(5, true)]
    case 6:
      return [grid(3, 2), grid(2, 3), bigPlus(6, true, 0.5)]
    case 7:
      return [twoRows(3, 4), twoRows(4, 3), bigPlus(7, true, 0.5)]
    case 8:
      return [grid(4, 2), grid(2, 4), twoRows(4, 4)]
    default:
      return [grid(3, 3)]
  }
}

/** 最多幾張 */
export const MAX_PHOTOS = 9

/**
 * 照片放進格子：等比例蓋滿（cover），再依縮放和位移調整。
 * @returns 要從照片裁出的範圍（照片 px）
 */
export function coverCrop(
  img: { width: number; height: number },
  cell: { w: number; h: number },
  zoom: number,
  ox: number,
  oy: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const s = Math.max(cell.w / img.width, cell.h / img.height) * zoom
  const sw = cell.w / s
  const sh = cell.h / s
  // ox、oy 是 -1..1：-1 靠左（上），1 靠右（下）
  const sx = ((img.width - sw) / 2) * (1 + ox)
  const sy = ((img.height - sh) / 2) * (1 + oy)
  return { sx, sy, sw, sh }
}
