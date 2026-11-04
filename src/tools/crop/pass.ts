// 裁切／旋轉／翻轉的 shader：輸出畫面的每個點，反推回原圖的位置去取色。
// 算法和 geometry.ts 的 displayToSource 一樣（那邊有單元測試）。

import { FRAGMENT_HEADER, type RenderPass } from '../../gl/pass.ts'
import { croppedSize, type CropParams } from './geometry.ts'

const fragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform vec4 u_rect;   // 裁切框 x, y, w, h（顯示空間，左上為原點）
uniform int u_quarter; // 順時針轉了幾個 90°
uniform bool u_flipH;
uniform bool u_flipV;

void main() {
  // GL 的 uv 原點在左下，先換成左上為原點
  vec2 q = u_rect.xy + vec2(v_uv.x, 1.0 - v_uv.y) * u_rect.zw;
  // 還原翻轉
  if (u_flipH) q.x = 1.0 - q.x;
  if (u_flipV) q.y = 1.0 - q.y;
  // 還原旋轉
  vec2 s = q;
  if (u_quarter == 1) s = vec2(q.y, 1.0 - q.x);
  else if (u_quarter == 2) s = 1.0 - q;
  else if (u_quarter == 3) s = vec2(1.0 - q.y, q.x);
  // 換回 GL 的 uv
  outColor = texture(u_image, vec2(s.x, 1.0 - s.y));
}`

export function cropPass(p: CropParams): RenderPass {
  return {
    id: 'crop/geometry',
    fragment,
    uniforms: {
      u_rect: [p.rect.x, p.rect.y, p.rect.w, p.rect.h],
      u_quarter: p.quarter % 4,
      u_flipH: p.flipH,
      u_flipV: p.flipV,
    },
    outputSize: (input) => croppedSize(input, p),
  }
}
