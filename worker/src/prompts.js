// 每個 AI 功能的提示詞（放在 Worker 裡：網站只送「做什麼、哪個選項」，不能隨便讓 AI 做別的事）

const KEEP =
  'Keep the face, facial features, identity, skin tone, expression, body, clothing, background, lighting and camera angle exactly the same. Photorealistic, high quality, natural.'

export const TASKS = {
  // 換髮型：只動頭髮
  hairstyle: {
    options: {
      short: 'a clean short layered haircut',
      bob: 'a chin-length Korean-style bob with soft inward-curled ends',
      longwave: 'long hair with big soft loose waves',
      bangs: 'long straight hair with light Korean "air bangs" (thin see-through fringe)',
      ponytail: 'a high sleek ponytail',
      bun: 'a cute messy top bun with a few face-framing strands',
      curly: 'shoulder-length bouncy natural curls',
      pixie: 'a chic pixie cut',
      twoblock: 'a Korean men\'s two-block haircut, short sides and textured top',
      comma: 'a Korean men\'s "comma hair" style with a curved fringe',
    },
    prompt: (desc) => `Change only the hairstyle of the person in this photo to ${desc}. Keep the original hair color. ${KEEP}`,
  },
  // 消除：照片上半透明紅色塗過的地方
  remove: {
    options: { marked: '' },
    prompt: () =>
      'Remove the people or objects covered by the semi-transparent red brush marks in this photo, and realistically fill those areas with the surrounding background so it looks like they were never there. Remove the red marks completely. Do not change anything else in the photo.',
  },
  // 畫質修復
  enhance: {
    options: { auto: '' },
    prompt: () =>
      'Restore and enhance this photo: increase sharpness and fine detail, remove blur, noise and compression artifacts, and recover clear facial details if there are people. Keep the exact same content, composition, colors and identity. Photorealistic.',
  },
  // AI 創意：換風格
  style: {
    options: {
      anime: 'a soft Japanese anime illustration style with clean line art and pastel colors',
      cartoon3d: 'a cute 3D animated movie character style with soft lighting',
      watercolor: 'a delicate watercolor painting',
      oil: 'a classical oil painting with visible brush strokes',
      sketch: 'a detailed pencil sketch',
      film: 'a nostalgic 1990s film photograph with grain and warm faded colors',
    },
    prompt: (desc) =>
      `Redraw this photo as ${desc}. Keep the same composition, pose and scene, and keep the people recognizable.`,
  },
  // 形象照
  portrait: {
    options: {
      business: 'a professional business headshot wearing a neat dark suit, plain light gray studio background',
      studio: 'a bright, clean studio portrait with a soft beige seamless background',
      korean: 'a Korean photo-studio style profile photo with soft glowing skin, white background and gentle lighting',
    },
    prompt: (desc) =>
      `Turn this photo into ${desc}. Keep the person's identity and facial features exactly the same, neat hair, soft flattering studio lighting, sharp focus, photorealistic.`,
  },
}
