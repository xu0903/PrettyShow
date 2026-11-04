// 點陣資料的小工具：模糊、畫布轉單通道遮罩、上下翻轉（遮罩、筆刷、消除筆共用）

/**
 * 盒狀模糊（水平再垂直，原地修改）。跑三次就很接近高斯模糊。
 * 用滑動視窗累加，每個像素的成本和半徑無關。
 */
export function boxBlur(data: Uint8Array, width: number, height: number, radius: number): void {
  const r = Math.max(0, Math.round(radius))
  if (r === 0) return
  const line = new Float32Array(Math.max(width, height))
  const pass = (count: number, length: number, at: (i: number, j: number) => number) => {
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < length; j++) line[j] = data[at(i, j)]
      // 邊界外視為和邊界的像素相同
      let sum = line[0] * (r + 1)
      for (let j = 1; j <= r; j++) sum += line[Math.min(j, length - 1)]
      for (let j = 0; j < length; j++) {
        data[at(i, j)] = Math.round(sum / (2 * r + 1))
        sum += line[Math.min(j + r + 1, length - 1)] - line[Math.max(j - r, 0)]
      }
    }
  }
  pass(height, width, (y, x) => y * width + x)
  pass(width, height, (x, y) => y * width + x)
}

/**
 * 把畫布的內容轉成單通道、上下顛倒（GL 的第一列是最下面）。
 * channel：取哪個通道（0 = R，3 = 透明度）
 */
export function canvasToMask(pixels: Uint8ClampedArray, width: number, height: number, channel = 0): Uint8Array {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const src = y * width * 4 + channel
    const dst = (height - 1 - y) * width
    for (let x = 0; x < width; x++) out[dst + x] = pixels[src + x * 4]
  }
  return out
}

/** RGBA 像素上下翻轉（畫布的第一列是最上面，GL 貼圖的第一列是最下面） */
export function flipRowsRGBA(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length)
  const row = width * 4
  for (let y = 0; y < height; y++) out.set(pixels.subarray(y * row, (y + 1) * row), (height - 1 - y) * row)
  return out
}
