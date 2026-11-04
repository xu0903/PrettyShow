// 美妝、亮眼、白牙、美髮的 shader。
// 上色的原則：保留原本的明暗和紋理（唇紋、毛流），只換掉顏色，看起來才像真的化上去。

import { FRAGMENT_HEADER } from '../../gl/pass.ts'

/** 共用的色彩函式 */
export const COLOR_GLSL = /* glsl */ `
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
float luma(vec3 c) { return dot(c, LUMA); }

// 「顏色」混合：用 tint 的色相和飽和度、保留 base 的亮度（Photoshop 的 Color 模式）
vec3 setLum(vec3 c, float l) {
  vec3 r = c + (l - luma(c));
  float lo = min(min(r.r, r.g), r.b);
  float hi = max(max(r.r, r.g), r.b);
  float L = luma(r);
  if (lo < 0.0) r = L + (r - L) * L / max(L - lo, 1e-4);
  if (hi > 1.0) r = L + (r - L) * (1.0 - L) / max(hi - L, 1e-4);
  return r;
}

// 柔光：顏色淡淡地疊上去，亮的更亮、暗的更暗
vec3 softLight(vec3 b, vec3 s) {
  return mix(2.0 * b * s + b * b * (1.0 - 2.0 * s), sqrt(b) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s), step(0.5, s));
}
`

/** 美妝：嘴唇、腮紅、眉毛、眼影 */
export const makeupFragment =
  FRAGMENT_HEADER +
  COLOR_GLSL +
  /* glsl */ `
uniform sampler2D u_regions; // R 嘴唇、G 腮紅、B 眉毛、A 眼影
uniform vec4 u_lip;    // rgb + 強度
uniform vec4 u_blush;
uniform vec4 u_brow;
uniform vec4 u_shadow;

void main() {
  vec4 c = texture(u_image, v_uv);
  vec4 m = texture(u_regions, v_uv);
  vec3 col = c.rgb;

  if (m.a > 0.004 && u_shadow.a > 0.0) {
    // 眼影：正片疊底，越深的顏色越明顯
    col = mix(col, col * mix(vec3(1.0), u_shadow.rgb, 0.85), m.a * u_shadow.a);
  }
  if (m.b > 0.004 && u_brow.a > 0.0) {
    // 眉毛：只加深原本就有眉毛（比較暗）的地方，不會把皮膚塗成一塊
    float hair = 1.0 - smoothstep(0.25, 0.6, luma(col));
    col = mix(col, col * u_brow.rgb * 1.6, m.b * u_brow.a * mix(0.35, 1.0, hair));
  }
  if (m.g > 0.004 && u_blush.a > 0.0) {
    col = mix(col, softLight(col, u_blush.rgb), m.g * u_blush.a);
  }
  if (m.r > 0.004 && u_lip.a > 0.0) {
    // 口紅：換成口紅的顏色，亮度大部分跟著口紅（深色口紅才上得了色），
    // 保留一部分原本的明暗變化，再疊一點正片疊底，唇紋才看得到
    float l = luma(col);
    vec3 tinted = mix(setLum(u_lip.rgb, mix(l, luma(u_lip.rgb), 0.75)), col * u_lip.rgb * 1.5, 0.3);
    col = mix(col, tinted, m.r * u_lip.a);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`

/** 亮眼、黑眼圈、白牙 */
export const featuresFragment =
  FRAGMENT_HEADER +
  COLOR_GLSL +
  /* glsl */ `
uniform sampler2D u_regions; // R 眼睛、G 眼下、B 嘴巴裡面
uniform float u_bright;      // 亮眼 0..1
uniform float u_dark;        // 去黑眼圈 0..1
uniform float u_teeth;       // 白牙 0..1

void main() {
  vec4 c = texture(u_image, v_uv);
  vec4 m = texture(u_regions, v_uv);
  vec3 col = c.rgb;

  if (m.r > 0.004 && u_bright > 0.0) {
    // 亮眼：提高對比和亮度，再銳化一點，眼神比較有光
    vec3 n = (texture(u_image, v_uv + vec2(u_texel.x, 0.0)).rgb + texture(u_image, v_uv - vec2(u_texel.x, 0.0)).rgb +
              texture(u_image, v_uv + vec2(0.0, u_texel.y)).rgb + texture(u_image, v_uv - vec2(0.0, u_texel.y)).rgb) * 0.25;
    vec3 e = col + (col - n) * 1.2;
    e = (e - 0.5) * 1.12 + 0.5 + 0.05;
    col = mix(col, e, m.r * u_bright);
  }
  if (m.g > 0.004 && u_dark > 0.0) {
    // 黑眼圈：提亮暗部、稍微減少偏紫偏青的顏色
    vec3 lifted = 1.0 - (1.0 - col) * 0.8;
    lifted = mix(lifted, setLum(lifted, luma(lifted)) * vec3(1.02, 1.0, 0.97), 0.5);
    col = mix(col, lifted, m.g * u_dark * 0.8);
  }
  if (m.b > 0.004 && u_teeth > 0.0) {
    // 白牙：只處理嘴巴裡又亮又偏黃的地方（牙齒），去黃、提亮
    float l = luma(col);
    float yellow = clamp((col.r + col.g) * 0.5 - col.b, 0.0, 1.0);
    float isTooth = smoothstep(0.3, 0.5, l) * smoothstep(0.0, 0.08, yellow + 0.02);
    vec3 white = mix(col, vec3(l), 0.7) * 1.08 + vec3(0.0, 0.005, 0.02);
    col = mix(col, white, m.b * isTooth * u_teeth);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`

/** 美髮：換髮色，保留髮絲的明暗 */
export const hairFragment =
  FRAGMENT_HEADER +
  COLOR_GLSL +
  /* glsl */ `
uniform sampler2D u_hair; // 頭髮遮罩
uniform vec4 u_color;     // rgb + 強度

void main() {
  vec4 c = texture(u_image, v_uv);
  float m = texture(u_hair, v_uv).r;
  if (m < 0.004 || u_color.a <= 0.0) {
    outColor = c;
    return;
  }
  float l = luma(c.rgb);
  // 頭髮通常很暗：把亮度往目標顏色的亮度拉一些，淺色（金、灰）才染得出來，但保留髮絲的明暗變化
  float target = luma(u_color.rgb);
  float newL = clamp(l + (target - 0.18) * 0.6 * smoothstep(0.0, 0.25, l + 0.05), 0.0, 1.0);
  vec3 dyed = setLum(u_color.rgb, newL);
  outColor = vec4(mix(c.rgb, dyed, m * u_color.a), c.a);
}`
