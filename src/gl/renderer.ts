// WebGL2 渲染器：把來源圖依序跑過多個 RenderPass，最後畫到 canvas 上。
// 預覽和匯出共用同一個類別，只是 canvas 和來源圖的尺寸不同。

import type { Size } from './limits.ts'
import { copyPass, type RenderPass, type Texture2DSource, type Texture3DSource } from './pass.ts'
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
  /** 中間結果用 16-bit 浮點（預設 true）。匯出大圖時關掉，GPU 記憶體用量少一半 */
  highPrecision?: boolean
}

export class Renderer {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  private gl!: WebGL2RenderingContext
  private programs = new Map<string, Program>()
  private textures = new Map<string, WebGLTexture>()
  /** slot → 目前在用的貼圖 key */
  private slots = new Map<string, string>()
  private sourceTexture: WebGLTexture | null = null
  private sourceSize: Size = { width: 1, height: 1 }
  private targets: RenderTarget[] = []
  /** 被後面步驟用 inputs 讀取的輸出，各自保留一個 framebuffer，不參與輪流使用 */
  private kept = new Map<string, RenderTarget>()
  /** 中間結果用 16-bit 浮點，連續多步調色時比較不會出現色階斷層 */
  private intermediateFormat: { internal: number; type: number } | null = null
  private lost = false
  private highPrecision: boolean
  /** 保留來源圖，GPU 被系統回收（context lost）後要重新上傳 */
  private source: TexImageSource | null = null

  /** context 恢復後呼叫，讓外部重新渲染 */
  onRestored: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts: RendererOptions = {}) {
    this.canvas = canvas
    this.highPrecision = opts.highPrecision ?? true
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
      this.textures.clear()
      this.slots.clear()
      this.targets = []
      this.kept.clear()
      this.sourceTexture = null
      this.init()
      if (this.source) this.setSource(this.source)
      this.onRestored?.()
    })
  }

  private init(): void {
    const gl = this.gl
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    this.intermediateFormat = this.highPrecision ? this.detectFloatTarget() : null
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
    // 有被後面步驟讀取的輸出要另外保留
    const keep = new Set(list.flatMap((p) => Object.values(p.inputs ?? {})))
    const outputs = new Map<string, WebGLTexture>()

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
        const target = keep.has(pass.id) ? this.keptTarget(pass.id, outSize) : this.target(i % 2, outSize)
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      }
      gl.viewport(0, 0, outSize.width, outSize.height)
      gl.useProgram(program.handle)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, inputTex)
      program.set('u_texel', [1 / inputSize.width, 1 / inputSize.height])
      program.set('u_outSize', [outSize.width, outSize.height])
      for (const [name, value] of Object.entries({ ...pass.uniforms, ...pass.uniformsFor?.(inputSize) })) program.set(name, value)
      const textures = { ...pass.textures, ...pass.texturesFor?.(inputSize) }
      for (const [name, src] of Object.entries(textures)) {
        const unit = program.samplerUnits.get(name)
        if (unit === undefined) continue
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(src.kind === '3d' ? gl.TEXTURE_3D : gl.TEXTURE_2D, this.texture(src))
      }
      for (const [name, id] of Object.entries(pass.inputs ?? {})) {
        const unit = program.samplerUnits.get(name)
        const tex = outputs.get(id)
        if (unit === undefined) continue
        if (!tex) throw new Error(`步驟 ${pass.id} 要讀取的 ${id} 不在它前面`)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, tex)
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (!last) {
        const target = keep.has(pass.id) ? this.kept.get(pass.id)! : this.targets[i % 2]
        inputTex = target.texture
        inputSize = outSize
        outputs.set(pass.id, target.texture)
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
    for (const t of this.textures.values()) gl.deleteTexture(t)
    for (const t of [...this.targets, ...this.kept.values()]) {
      gl.deleteTexture(t.texture)
      gl.deleteFramebuffer(t.framebuffer)
    }
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
    this.programs.clear()
    this.textures.clear()
    this.slots.clear()
    this.targets = []
    this.kept.clear()
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
    const t = this.reuseTarget(this.targets[slot], size)
    this.targets[slot] = t
    return t
  }

  /** 取得（或重建）某一步專用、要保留給後面讀取的 framebuffer */
  private keptTarget(id: string, size: Size): RenderTarget {
    const t = this.reuseTarget(this.kept.get(id), size)
    this.kept.set(id, t)
    return t
  }

  /** 尺寸一樣就沿用，不一樣就刪掉重建 */
  private reuseTarget(existing: RenderTarget | undefined, size: Size): RenderTarget {
    const gl = this.gl
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
    return { texture, framebuffer, ...size }
  }

  private texture(src: Texture3DSource | Texture2DSource): WebGLTexture {
    const cached = this.textures.get(src.key)
    if (cached) return cached
    if (src.kind === '2d' && src.slot) {
      // 同一個 slot 的舊貼圖用不到了
      const old = this.slots.get(src.slot)
      const oldTex = old !== undefined ? this.textures.get(old) : undefined
      if (old !== undefined && oldTex) {
        this.gl.deleteTexture(oldTex)
        this.textures.delete(old)
      }
      this.slots.set(src.slot, src.key)
    }
    const t = src.kind === '3d' ? this.upload3d(src) : this.upload2d(src)
    this.textures.set(src.key, t)
    return t
  }

  private upload2d(src: Texture2DSource): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    // 單通道資料每列不一定是 4 的倍數
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const rgba = src.channels === 4
    const data = src.data instanceof Uint8ClampedArray ? new Uint8Array(src.data.buffer, src.data.byteOffset, src.data.length) : src.data
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      rgba ? gl.RGBA8 : gl.R8,
      src.width,
      src.height,
      0,
      rgba ? gl.RGBA : gl.RED,
      gl.UNSIGNED_BYTE,
      data,
    )
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    setSampling(gl)
    return t
  }

  private upload3d(src: Texture3DSource): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_3D, t)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, src.size, src.size, src.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
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
