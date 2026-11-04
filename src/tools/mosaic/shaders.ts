// 馬賽克：遮罩內換成方塊或模糊。大小以照片長邊的比例計算，預覽和匯出看起來一樣

import { FRAGMENT_HEADER } from '../../gl/pass.ts'

export const mosaicFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_pixelMask;
uniform sampler2D u_blurMask;
uniform float u_block; // 方塊邊長：長邊的比例

void main() {
  vec4 c = texture(u_image, v_uv);
  float mp = texture(u_pixelMask, v_uv).r;
  float mb = texture(u_blurMask, v_uv).r;
  if (mp < 0.004 && mb < 0.004) {
    outColor = c;
    return;
  }
  float b = u_block * max(u_outSize.x, u_outSize.y);
  vec3 col = c.rgb;
  if (mp >= 0.004) {
    // 取方塊中心的顏色
    vec2 cell = (floor(v_uv * u_outSize / b) + 0.5) * b;
    col = mix(col, texture(u_image, cell / u_outSize).rgb, mp);
  }
  if (mb >= 0.004) {
    // 7×7 格子平均（貼圖的線性內插讓每個取樣點本身也有平均效果）
    vec3 sum = vec3(0.0);
    vec2 stepUv = u_texel * b * 0.4;
    for (int y = -3; y <= 3; y++)
      for (int x = -3; x <= 3; x++) sum += texture(u_image, v_uv + vec2(float(x), float(y)) * stepUv).rgb;
    col = mix(col, sum / 49.0, mb);
  }
  outColor = vec4(col, c.a);
}`
