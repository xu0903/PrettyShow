// shader 編譯與 uniform 自動設定

import type { UniformValue } from './pass.ts'

// 全螢幕三角形：一個三角形蓋住整個畫面，比兩個三角形組成的矩形少一點運算
const VERTEX = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

interface UniformInfo {
  location: WebGLUniformLocation
  type: number
}

export class Program {
  readonly handle: WebGLProgram
  private readonly uniforms = new Map<string, UniformInfo>()
  /** sampler 名稱 → 貼圖單元編號 */
  readonly samplerUnits = new Map<string, number>()

  private readonly gl: WebGL2RenderingContext

  constructor(gl: WebGL2RenderingContext, fragment: string) {
    this.gl = gl
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
    const p = gl.createProgram()
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p)
      gl.deleteProgram(p)
      throw new Error('Shader 連結失敗：' + log)
    }
    this.handle = p

    // 讀出所有 uniform，之後依型別自動呼叫對應的 gl.uniform*
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
    let unit = 0
    gl.useProgram(p)
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i)
      if (!info) continue
      const name = info.name.replace(/\[0\]$/, '')
      const location = gl.getUniformLocation(p, info.name)
      if (!location) continue
      this.uniforms.set(name, { location, type: info.type })
      if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_3D) {
        gl.uniform1i(location, unit)
        this.samplerUnits.set(name, unit++)
      }
    }
  }

  /** 設定 uniform；shader 沒用到的名稱會被忽略（編譯器可能把它最佳化掉了） */
  set(name: string, value: UniformValue): void {
    const u = this.uniforms.get(name)
    if (!u) return
    const gl = this.gl
    const v = typeof value === 'boolean' ? (value ? 1 : 0) : value
    switch (u.type) {
      case gl.FLOAT:
        gl.uniform1f(u.location, v as number)
        break
      case gl.INT:
      case gl.BOOL:
        gl.uniform1i(u.location, v as number)
        break
      case gl.FLOAT_VEC2:
        gl.uniform2fv(u.location, v as number[])
        break
      case gl.FLOAT_VEC3:
        gl.uniform3fv(u.location, v as number[])
        break
      case gl.FLOAT_VEC4:
        gl.uniform4fv(u.location, v as number[])
        break
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(u.location, false, v as number[])
        break
      default:
        throw new Error(`不支援的 uniform 型別：${name}`)
    }
  }

  dispose(): void {
    this.gl.deleteProgram(this.handle)
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error('Shader 編譯失敗：' + log)
  }
  return s
}
