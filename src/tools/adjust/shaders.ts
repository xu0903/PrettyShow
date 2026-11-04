// 基本調整的 shader。數值都在 sRGB 空間計算，和一般修圖 App 的手感接近。

import { FRAGMENT_HEADER } from '../../gl/pass.ts'

/** 調色：亮度、對比、飽和度、色溫、色調（數值範圍都是 -1..1） */
export const colorFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec3 c = texture(u_image, v_uv).rgb;

  // 色溫：暖色加紅減藍，冷色相反（類似白平衡的增益）
  c *= vec3(1.0 + u_temperature * 0.18, 1.0 + u_temperature * 0.03, 1.0 - u_temperature * 0.18);
  // 色調：正值偏洋紅（減綠），負值偏綠
  c *= vec3(1.0 + u_tint * 0.05, 1.0 - u_tint * 0.14, 1.0 + u_tint * 0.05);
  c = clamp(c, 0.0, 1.0);

  // 亮度：用 gamma 曲線調整中間調，亮部和暗部不會一下就爆掉或死黑
  c = pow(c, vec3(exp2(-u_brightness * 0.9)));

  // 對比：以 0.5 為中心拉開或壓縮
  float k = u_contrast >= 0.0 ? 1.0 + u_contrast : 1.0 + u_contrast * 0.7;
  c = (c - 0.5) * k + 0.5;

  // 飽和度：和灰階混合；正值時保護已經很飽和的顏色，避免膚色太艷
  float luma = dot(clamp(c, 0.0, 1.0), LUMA);
  float sat = 1.0 + u_saturation;
  if (u_saturation > 0.0) {
    float chroma = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
    sat = 1.0 + u_saturation * (1.0 - chroma * 0.6);
  }
  c = mix(vec3(luma), c, sat);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

/** 細節：銳化（USM）與暈影 */
export const detailFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform float u_sharpen;   // 0..1
uniform float u_radius;    // 取樣半徑（像素），匯出原圖時會放大
uniform float u_vignette;  // 0..1

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec3 c = texture(u_image, v_uv).rgb;

  if (u_sharpen > 0.0) {
    // 3x3 模糊後和原圖相減得到邊緣，只加強亮度，避免邊緣出現彩色光暈
    vec2 o = u_texel * u_radius;
    vec3 blur = (
      texture(u_image, v_uv + vec2(-o.x, -o.y)).rgb + texture(u_image, v_uv + vec2(0.0, -o.y)).rgb * 2.0 +
      texture(u_image, v_uv + vec2(o.x, -o.y)).rgb + texture(u_image, v_uv + vec2(-o.x, 0.0)).rgb * 2.0 +
      c * 4.0 + texture(u_image, v_uv + vec2(o.x, 0.0)).rgb * 2.0 +
      texture(u_image, v_uv + vec2(-o.x, o.y)).rgb + texture(u_image, v_uv + vec2(0.0, o.y)).rgb * 2.0 +
      texture(u_image, v_uv + vec2(o.x, o.y)).rgb
    ) / 16.0;
    float edge = dot(c - blur, LUMA);
    c += edge * u_sharpen * 2.5;
  }

  if (u_vignette > 0.0) {
    // 依照片長寬比算成圓形的距離，直式和橫式照片的暈影形狀都自然
    float aspect = u_outSize.x / u_outSize.y;
    vec2 p = (v_uv - 0.5) * (aspect > 1.0 ? vec2(aspect, 1.0) : vec2(1.0, 1.0 / aspect));
    float d = length(p) / length(aspect > 1.0 ? vec2(aspect, 1.0) * 0.5 : vec2(1.0, 1.0 / aspect) * 0.5);
    c *= 1.0 - u_vignette * 0.75 * smoothstep(0.35, 1.05, d);
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`
