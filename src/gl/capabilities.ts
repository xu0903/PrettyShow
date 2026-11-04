// 讀取裝置的 WebGL 能力（只檢查一次並快取）

let cachedMaxTexture: number | null = null

/** gl.MAX_TEXTURE_SIZE：單張貼圖長寬的上限（近年的 iPhone 是 16384） */
export function getMaxTextureSize(): number {
  if (cachedMaxTexture !== null) return cachedMaxTexture
  const gl = document.createElement('canvas').getContext('webgl2')
  cachedMaxTexture = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096
  // 立刻釋放這個探測用的 context，iOS 同時存在的 WebGL context 數量有限
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return cachedMaxTexture
}
