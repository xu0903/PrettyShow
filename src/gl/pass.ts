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

/**
 * 2D 貼圖（例如美顏的皮膚遮罩、塗鴉筆跡），以 0..1 的 uv 取樣，和輸出解析度無關。
 * 資料的第一列是圖片的「最下面」一列，和 GL 的座標慣例一致。
 */
export interface Texture2DSource {
  kind: '2d'
  key: string
  /**
   * 同一個 slot 只保留最新的一張：內容一直變的貼圖（例如邊畫邊更新的筆刷遮罩）
   * 換新的 key 時，舊的會被刪掉，GPU 記憶體才不會越用越多。
   */
  slot?: string
  width: number
  height: number
  /** 1 = 單通道 R8（預設），4 = RGBA8（不預乘透明度） */
  channels?: 1 | 4
  /** 長度 width × height × channels */
  data: Uint8Array | Uint8ClampedArray
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
  textures?: Record<string, Texture3DSource | Texture2DSource>
  /**
   * 讀取前面某一步的輸出：{ sampler 名稱: 那一步的 id }。
   * 例如磨皮最後一步要同時看到模糊後和模糊前的畫面。
   */
  inputs?: Record<string, string>
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
