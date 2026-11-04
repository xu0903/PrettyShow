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

// Oklab：接近人眼感受的色彩空間。L 是亮度，(a, b) 是色相和彩度；
// 只換 (a, b)、保留大部分的 L，顏色像是半透明地疊在原本的唇色上
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 rgb2oklab(vec3 c) {
  c = toLinear(c);
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklab2rgb(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return toSrgb(vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                     -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                     -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s));
}
`

/**
 * 美妝：嘴唇、腮紅、眉毛、眼影。
 * 強度 1 是「自然的上限」：口紅最多蓋過六成、腮紅五成，不會像塗上一層色塊。
 */
export const makeupFragment =
  FRAGMENT_HEADER +
  COLOR_GLSL +
  /* glsl */ `
uniform sampler2D u_regions;  // R 嘴唇、G 腮紅、B 眉毛、A 眼影
uniform sampler2D u_features; // A 唇中央（暈染唇用）
uniform vec4 u_lip;    // rgb + 強度
uniform float u_lipBlur; // 1 = 暈染唇（中間濃、往唇線變淡），0 = 滿塗
uniform vec4 u_blush;
uniform vec4 u_brow;
uniform vec4 u_shadow;

void main() {
  vec4 c = texture(u_image, v_uv);
  vec4 m = texture(u_regions, v_uv);
  vec3 col = c.rgb;

  if (m.a > 0.004 && u_shadow.a > 0.0) {
    // 眼影：正片疊底，越深的顏色越明顯
    col = mix(col, col * mix(vec3(1.0), u_shadow.rgb, 0.8), m.a * u_shadow.a * 0.6);
  }
  if (m.b > 0.004 && u_brow.a > 0.0) {
    // 眉毛：只加深原本就有眉毛（比較暗）的地方，不會把皮膚塗成一塊
    float hair = 1.0 - smoothstep(0.25, 0.6, luma(col));
    col = mix(col, col * u_brow.rgb * 1.6, m.b * u_brow.a * 0.7 * mix(0.3, 1.0, hair));
  }
  if (m.g > 0.004 && u_blush.a > 0.0) {
    col = mix(col, softLight(col, u_blush.rgb), m.g * u_blush.a * 0.5);
  }
  if (m.r > 0.004 && u_lip.a > 0.0) {
    // 口紅：色相、彩度換成口紅的；亮度只往口紅靠一點，保留唇紋和立體感
    vec3 lab = rgb2oklab(col);
    vec3 target = rgb2oklab(u_lip.rgb);
    vec3 tinted = oklab2rgb(vec3(mix(lab.x, target.x, 0.5), mix(lab.yz, target.yz, 0.85)));
    float center = clamp(texture(u_features, v_uv).a * 1.5, 0.0, 1.0);
    col = mix(col, tinted, m.r * u_lip.a * 0.6 * mix(1.0, center, u_lipBlur));
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
