// 3D LUT 的解析與讀取。
// 支援兩種格式：
// - .cube（Adobe/Resolve 的文字格式；網路上找到的濾鏡大多是這種）
// - PNG 長條 LUT：寬 size×size、高 size，像素 (x = b×size + r, y = g)
// 兩者都轉成 RGBA8、r 最快 g 其次 b 最慢的排列，直接上傳成 WebGL 3D 貼圖。

export interface Lut {
  size: number
  /** RGBA8，長度 size³ × 4 */
  data: Uint8Array
}

/** 解析 .cube 文字檔 */
export function parseCube(text: string): Lut {
  let size = 0
  let domainMin = [0, 0, 0]
  let domainMax = [1, 1, 1]
  const values: number[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    const key = parts[0].toUpperCase()
    if (key === 'TITLE') continue
    if (key === 'LUT_3D_SIZE') {
      size = parseInt(parts[1], 10)
      continue
    }
    if (key === 'LUT_1D_SIZE') throw new Error('不支援 1D LUT')
    if (key === 'DOMAIN_MIN') {
      domainMin = parts.slice(1, 4).map(Number)
      continue
    }
    if (key === 'DOMAIN_MAX') {
      domainMax = parts.slice(1, 4).map(Number)
      continue
    }
    // 其他看不懂的關鍵字略過；數字行才當成資料
    if (parts.length >= 3 && /^[-+.\d]/.test(parts[0])) {
      values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]))
    }
  }

  if (size < 2) throw new Error('.cube 缺少 LUT_3D_SIZE')
  const count = size * size * size
  if (values.length !== count * 3) throw new Error(`.cube 資料數量不對：需要 ${count} 行，實際 ${values.length / 3} 行`)

  const data = new Uint8Array(count * 4)
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      const v = (values[i * 3 + c] - domainMin[c]) / (domainMax[c] - domainMin[c])
      data[i * 4 + c] = Math.round(Math.min(1, Math.max(0, v)) * 255)
    }
    data[i * 4 + 3] = 255
  }
  return { size, data }
}

/** PNG 長條 LUT 的像素位置 → 3D 貼圖的索引（r 最快、b 最慢） */
export function stripPixelToIndex(x: number, y: number, size: number): number {
  const r = x % size
  const b = Math.floor(x / size)
  const g = y
  return r + g * size + b * size * size
}

/** 把 PNG 長條 LUT 的像素（getImageData 的結果）轉成 3D 貼圖資料 */
export function lutFromStrip(pixels: Uint8ClampedArray, width: number, height: number): Lut {
  const size = height
  if (size < 2 || width !== size * size) throw new Error(`PNG LUT 尺寸不對：${width}×${height}`)
  const data = new Uint8Array(size * size * size * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4
      const dst = stripPixelToIndex(x, y, size) * 4
      data[dst] = pixels[src]
      data[dst + 1] = pixels[src + 1]
      data[dst + 2] = pixels[src + 2]
      data[dst + 3] = 255
    }
  }
  return { size, data }
}

/** 下載並解析 LUT 檔（依副檔名判斷格式） */
export async function fetchLut(url: string): Promise<Lut> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`無法下載濾鏡：${url}`)
  if (url.endsWith('.cube')) return parseCube(await res.text())

  const bitmap = await createImageBitmap(await res.blob(), {
    // 不要做任何色彩轉換，LUT 的數值必須原封不動
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  })
  // 尺寸要在 close() 之前記下來，close 之後 width / height 會變成 0
  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  bitmap.close()
  canvas.width = 0
  canvas.height = 0
  return lutFromStrip(data, width, height)
}
