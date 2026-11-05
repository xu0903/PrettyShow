// 文字用的網路字型（Google Fonts：思源宋體、粉圓、霞鶩文楷）。
// 第一次用到文字工具才下載，之後由 service worker 快取；只會下載用到的字。

import { FONTS, type FontId } from './layers.ts'

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Huninn&family=LXGW+WenKai+TC:wght@400;700&family=Noto+Serif+TC:wght@600&display=swap'

let stylesheet: Promise<void> | null = null

function loadStylesheet(): Promise<void> {
  stylesheet ??= new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = CSS_URL
    // 載不到（離線）也繼續，只是用系統字型
    link.onload = link.onerror = () => resolve()
    document.head.append(link)
  })
  return stylesheet
}

/** 等這些字型（只要畫得出這些字的部分）下載好 */
export async function ensureFonts(fonts: readonly FontId[], text: string): Promise<void> {
  const families = FONTS.filter((f) => fonts.includes(f.id) && f.family).map((f) => f.family!)
  if (families.length === 0) return
  await loadStylesheet()
  await Promise.all(families.map((f) => document.fonts.load(`600 40px "${f}"`, text || '字').catch(() => undefined)))
}

/** 這些字型是不是已經可以用了（畫字之前檢查；還不行就先用系統字型，下載好再重畫） */
export function fontsReady(fonts: readonly FontId[], text: string): boolean {
  return FONTS.filter((f) => fonts.includes(f.id) && f.family).every((f) => document.fonts.check(`600 40px "${f.family}"`, text || '字'))
}
