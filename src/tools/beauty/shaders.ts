// 美顏的 shader。
// 磨皮：雙邊濾波（只平均顏色相近的鄰居，所以痘痘、細紋被抹平，但五官和輪廓的邊緣保留），
// 為了速度拆成水平、垂直兩次；遮罩以外的像素直接跳過。
// 美白：提亮中間調、稍微去黃，只作用在膚色上。
// 手動模式：用手指塗出來的遮罩（u_brushSmooth、u_brushWhiten），和自動找到的臉取較大的那個。

import { FRAGMENT_HEADER } from '../../gl/pass.ts'

/** 判斷「像不像膚色」的共用函式（YCbCr 色彩空間，對亮度不敏感） */
const SKIN_GLSL = /* glsl */ `
float skinLikelihood(vec3 c) {
  float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;
  // 膚色大約落在 Cb 0.30–0.50、Cr 0.52–0.68；範圍放寬一點，避免陰影或化妝被排除
  float d = length(vec2((cb - 0.40) / 0.13, (cr - 0.60) / 0.11));
  return 1.0 - smoothstep(0.7, 1.3, d);
}
`

/** 雙邊濾波（單一方向） */
export const bilateralFragment =
  FRAGMENT_HEADER +
  /* glsl */ `
uniform sampler2D u_mask;
uniform sampler2D u_brushSmooth;
uniform vec2 u_dir;      // (1,0) 水平或 (0,1) 垂直
uniform float u_radius;  // 半徑（px）
uniform float u_sigma;   // 顏色差多少以內才算「相近」

const int TAPS = 10;

void main() {
  vec4 center = texture(u_image, v_uv);
  if (max(texture(u_mask, v_uv).r, texture(u_brushSmooth, v_uv).r) < 0.004) {
    outColor = center;
    return;
  }
  vec2 stepUv = u_dir * u_texel * (u_radius / float(TAPS));
  vec3 sum = center.rgb;
  float wsum = 1.0;
  float inv = -0.5 / (u_sigma * u_sigma);
  for (int i = 1; i <= TAPS; i++) {
    float t = float(i) / float(TAPS);
    float ws = exp(-2.0 * t * t);
    for (int s = -1; s <= 1; s += 2) {
      vec3 c = texture(u_image, v_uv + stepUv * float(i * s)).rgb;
      vec3 d = c - center.rgb;
      float w = ws * exp(dot(d, d) * inv);
      sum += c * w;
      wsum += w;
    }
  }
  outColor = vec4(sum / wsum, center.a);
}`

/**
 * 把磨皮結果依遮罩和強度混回原圖，再做美白。
 * withBase = true：u_image 是磨皮後的畫面，u_base 是磨皮前；false：只美白，u_image 就是原圖。
 */
function mixFragment(withBase: boolean): string {
  return (
    FRAGMENT_HEADER +
    (withBase ? '#define WITH_BASE\n' : '') +
    SKIN_GLSL +
    /* glsl */ `
uniform sampler2D u_mask;
uniform sampler2D u_brushSmooth;
uniform sampler2D u_brushWhiten;
uniform float u_smooth;    // 0..1
uniform float u_whiten;    // 0..1
#ifdef WITH_BASE
uniform sampler2D u_base;
#endif

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
#ifdef WITH_BASE
  vec4 base = texture(u_base, v_uv);
  vec3 blurred = texture(u_image, v_uv).rgb;
#else
  vec4 base = texture(u_image, v_uv);
  vec3 blurred = base.rgb;
#endif
  float mask = texture(u_mask, v_uv).r;
  float skin = skinLikelihood(base.rgb);

  float bs = texture(u_brushSmooth, v_uv).r;
  float bw = texture(u_brushWhiten, v_uv).r;

  // 磨皮：遮罩內、而且像膚色的地方才混入（瀏海、眼鏡框不會被抹掉）；手動塗的地方照塗的範圍
  vec3 c = mix(base.rgb, blurred, max(mask * mix(0.4, 1.0, skin) * u_smooth, bs * 0.85));

  // 美白：臉上全力，臉以外的膚色（脖子、手）也提亮一些，顏色才接得起來
  float w = max(u_whiten * skin * max(mask, 0.6), bw * 0.75);
  vec3 lifted = 1.0 - pow(1.0 - c, vec3(1.0 + 0.9 * w));
  lifted = mix(lifted, vec3(dot(lifted, LUMA)), 0.15 * w);
  outColor = vec4(lifted, base.a);
}`
  )
}

export const smoothMixFragment = mixFragment(true)
export const whitenOnlyFragment = mixFragment(false)
