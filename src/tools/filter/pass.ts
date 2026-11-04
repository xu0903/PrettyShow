// 套用 LUT 的 shader 步驟（濾鏡工具和縮圖共用）

import { FRAGMENT_HEADER, type RenderPass } from '../../gl/pass.ts'
import type { Lut } from './lut.ts'

const fragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler3D u_lut;
uniform float u_lutSize;
uniform float u_intensity;

void main() {
  vec3 c = texture(u_image, v_uv).rgb;
  // 對齊到格點中心，3D 貼圖的線性內插才會落在正確的格子之間
  vec3 coord = c * ((u_lutSize - 1.0) / u_lutSize) + 0.5 / u_lutSize;
  vec3 graded = texture(u_lut, coord).rgb;
  outColor = vec4(mix(c, graded, u_intensity), 1.0);
}`

export function lutPass(id: string, lut: Lut, intensity: number): RenderPass {
  return {
    id: 'filter/lut',
    fragment,
    uniforms: { u_lutSize: lut.size, u_intensity: intensity },
    textures: { u_lut: { kind: '3d', key: `lut:${id}`, size: lut.size, data: lut.data } },
  }
}
