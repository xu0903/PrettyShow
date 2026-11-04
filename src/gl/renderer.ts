// WebGL2 渲染器：把來源圖依序跑過多個 RenderPass，最後畫到 canvas 上。
// 預覽和匯出共用同一個類別，只是 canvas 和來源圖的尺寸不同。

import type { Size } from './limits.ts'
import { copyPass, type RenderPass, type Texture3DSource } from './pass.ts'
import { Program } from './program.ts'

interface RenderTarget {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

export interface RendererOptions {
  /** 匯出時要設為 true，才能在畫完之後用 toBlob 讀出畫面 */
  preserveDrawingBuffer?: boolean
}

export class Renderer {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  private gl!: WebGL2RenderingContext
  private programs = new Map<string, Program>()
  private textures3d = new Map<string, WebGLTexture>()
  private sourceTexture: WebGLTexture | null = null
  private sourceSize: Size = { width: 1, height: 1 }
  private targets: RenderTarget[] = []
  /** 中間結果用 16-bit 浮點，連續多步調色時比較不會出現色階斷層 */
  private intermediateFormat: { internal: number; type: number } | null = null
  private lost = false
  /** 保留來源圖，GPU 被系統回收（context lost）後要重新上傳 */
  private source: TexImageSource | null = null

  /** context 恢復後呼叫，讓外部重新渲染 */
  onRestored: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts: RendererOptions = {}) {
    this.canvas = canvas
    const attrs: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    }
    const gl = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null
    if (!gl) throw new Error('這台裝置不支援 WebGL2')
    this.gl = gl
    this.init()

    // iOS 切到背景或記憶體吃緊時可能會回收 GPU，回來時要重建所有資源
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.lost = true
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false
      this.programs.clear()
      this.textures3d.clear()
      this.targets = []
      this.sourceTexture = null
      this.init()
      if (this.source) this.setSource(this.source)
      this.onRestored?.()
    })
  }

  private init(): void {
    const gl = this.gl
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    this.intermediateFormat = this.detectFloatTarget()
  }

  get isLost(): boolean {
    return this.lost || this.gl.isContextLost()
  }

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number
  }

  /** 上傳來源圖（預覽縮圖或匯出用的原圖） */
  setSource(source: TexImageSource): void {
    const gl = this.gl
    this.source = source
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    // 上下翻轉，讓 uv (0,0) 對應圖片左下角，符合 GL 的座標慣例
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    setSampling(gl)
    this.sourceTexture = tex
    const s = source as { width: number; height: number }
    this.sourceSize = { width: s.width, height: s.height }
  }

  /** 依序跑完所有步驟並畫到 canvas，回傳最終輸出的尺寸 */
  render(passes: readonly RenderPass[]): Size {
    if (this.isLost || !this.sourceTexture) return this.sourceSize
    const gl = this.gl
    const list = passes.length > 0 ? passes : [copyPass]

    let inputTex = this.sourceTexture
    let inputSize = this.sourceSize

    list.forEach((pass, i) => {
      const last = i === list.length - 1
      const outSize = pass.outputSize?.(inputSize) ?? inputSize
      const program = this.program(pass)

      if (last) {
        // 最後一步直接畫到畫面上
        if (this.canvas.width !== outSize.width) this.canvas.width = outSize.width
        if (this.canvas.height !== outSize.height) this.canvas.height = outSize.height
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      } else {
        const target = this.target(i % 2, outSize)
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      }
      gl.viewport(0, 0, outSize.width, outSize.height)
      gl.useProgram(program.handle)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, inputTex)
      program.set('u_texel', [1 / inputSize.width, 1 / inputSize.height])
      program.set('u_outSize', [outSize.width, outSize.height])
      for (const [name, value] of Object.entries(pass.uniforms ?? {})) program.set(name, value)
      for (const [name, src] of Object.entries(pass.textures ?? {})) {
        const unit = program.samplerUnits.get(name)
        if (unit === undefined) continue
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_3D, this.texture3d(src))
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (!last) {
        const target = this.targets[i % 2]
        inputTex = target.texture
        inputSize = outSize
      } else {
        inputSize = outSize
      }
    })
    return inputSize
  }

  /** 釋放 GPU 記憶體（匯出完成後一定要呼叫，iOS 的 GPU 記憶體很有限） */
  dispose(): void {
    const gl = this.gl
    for (const p of this.programs.values()) p.dispose()
    for (const t of this.textures3d.values()) gl.deleteTexture(t)
    for (const t of this.targets) {
      gl.deleteTexture(t.texture)
      gl.deleteFramebuffer(t.framebuffer)
    }
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
    this.programs.clear()
    this.textures3d.clear()
    this.targets = []
    this.sourceTexture = null
    this.source = null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  private program(pass: RenderPass): Program {
    let p = this.programs.get(pass.id)
    if (!p) {
      p = new Program(this.gl, pass.fragment)
      this.programs.set(pass.id, p)
    }
    return p
  }

  /** 取得（或重建）第 slot 個中間 framebuffer，兩個輪流使用 */
  private target(slot: number, size: Size): RenderTarget {
    const gl = this.gl
    const existing = this.targets[slot]
    if (existing && existing.width === size.width && existing.height === size.height) return existing
    if (existing) {
      gl.deleteTexture(existing.texture)
      gl.deleteFramebuffer(existing.framebuffer)
    }
    const fmt = this.intermediateFormat ?? { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE }
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt.internal, size.width, size.height)
    setSampling(gl)
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const t = { texture, framebuffer, ...size }
    this.targets[slot] = t
    return t
  }

  private texture3d(src: Texture3DSource): WebGLTexture {
    let t = this.textures3d.get(src.key)
    if (t) return t
    const gl = this.gl
    t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_3D, t)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, src.size, src.size, src.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    this.textures3d.set(src.key, t)
    return t
  }

  /** 檢查能不能把 16-bit 浮點貼圖當作渲染目標；不行就退回 8-bit */
  private detectFloatTarget(): { internal: number; type: number } | null {
    const gl = this.gl
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, 4, 4)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)
    return ok ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : null
  }
}

function setSampling(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}
