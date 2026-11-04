// 渲染管線中「一個 shader 步驟」的描述。
// 工具模組只需要描述自己要跑什麼 shader、帶什麼參數，WebGL 的細節由 renderer 處理。

import type { Size } from './limits.ts'

export type UniformValue = number | boolean | readonly number[]

/** 3D LUT 貼圖（濾鏡用）。key 相同就重複使用已上傳的貼圖 */
export interface Texture3DSource {
  kind: '3d'
  key: string
  /** 每一軸的格數，例如 33 */
  size: number
  /** RGBA8，長度 size³ × 4，排列順序 r 最快、b 最慢 */
  data: Uint8Array
}

export interface RenderPass {
  /** 用來快取編譯好的 program；同一段 fragment 要用同一個 id */
  id: string
  /**
   * GLSL ES 3.0 的 fragment shader。renderer 會提供：
   *   in vec2 v_uv;              輸出畫面的座標 0..1（左下為原點）
   *   uniform sampler2D u_image; 上一步的結果
   *   uniform vec2 u_texel;      上一步結果的 1px 大小（1/寬, 1/高）
   *   uniform vec2 u_outSize;    這一步輸出的像素尺寸
   *   out vec4 outColor;
   */
  fragment: string
  uniforms?: Record<string, UniformValue>
  textures?: Record<string, Texture3DSource>
  /** 輸出尺寸；不提供就和輸入一樣（裁切、旋轉會改變尺寸） */
  outputSize?: (input: Size) => Size
}

/** 每段 fragment 共用的開頭 */
export const FRAGMENT_HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_texel;
uniform vec2 u_outSize;
out vec4 outColor;
`

/** 單純複製，沒有任何步驟時使用 */
export const copyPass: RenderPass = {
  id: 'core/copy',
  fragment: FRAGMENT_HEADER + /* glsl */ `
void main() {
  outColor = texture(u_image, v_uv);
}`,
}
