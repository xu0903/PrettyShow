// 美妝的參數、各部位可選的顏色、整組妝容

export type Part = 'lip' | 'blush' | 'brow' | 'shadow'

export interface MakeupParams {
  lip: number // 強度 0..100
  lipColor: string
  blush: number
  blushColor: string
  brow: number
  browColor: string
  shadow: number
  shadowColor: string
}

export const PARTS: { key: Part; label: string; colors: string[] }[] = [
  { key: 'lip', label: '口紅', colors: ['#d9475a', '#e0566b', '#c96a6a', '#f27d7d', '#ff8a80', '#b5525e', '#a3283c', '#8c3b3b'] },
  { key: 'blush', label: '腮紅', colors: ['#f7a1a8', '#f29a9a', '#ff9f8f', '#f5b0c0', '#e8907a', '#d98a7a'] },
  { key: 'brow', label: '眉毛', colors: ['#5a4636', '#6b5442', '#7a5c45', '#3e2c22', '#2e2520'] },
  { key: 'shadow', label: '眼影', colors: ['#e3b5a4', '#c9a28a', '#d4a0a8', '#b08070', '#8c5a46', '#3b2f33'] },
]

export const colorKey = (part: Part) => `${part}Color` as const

export const NO_MAKEUP: MakeupParams = {
  lip: 0,
  lipColor: PARTS[0].colors[0],
  blush: 0,
  blushColor: PARTS[1].colors[0],
  brow: 0,
  browColor: PARTS[2].colors[0],
  shadow: 0,
  shadowColor: PARTS[3].colors[0],
}

/** 整組妝容：一次設定四個部位 */
export const LOOKS: { id: string; label: string; params: MakeupParams }[] = [
  {
    id: 'natural',
    label: '自然',
    params: { lip: 35, lipColor: '#c96a6a', blush: 25, blushColor: '#f29a9a', brow: 20, browColor: '#5a4636', shadow: 15, shadowColor: '#c9a28a' },
  },
  {
    id: 'korean',
    label: '韓系',
    params: { lip: 50, lipColor: '#e0566b', blush: 30, blushColor: '#f7a1a8', brow: 15, browColor: '#6b5442', shadow: 25, shadowColor: '#e3b5a4' },
  },
  {
    id: 'japanese',
    label: '日系',
    params: { lip: 40, lipColor: '#f27d7d', blush: 45, blushColor: '#ff9f8f', brow: 15, browColor: '#7a5c45', shadow: 25, shadowColor: '#d4a0a8' },
  },
  {
    id: 'western',
    label: '歐美',
    params: { lip: 80, lipColor: '#a3283c', blush: 30, blushColor: '#e8907a', brow: 40, browColor: '#3e2c22', shadow: 45, shadowColor: '#8c5a46' },
  },
  {
    id: 'smoky',
    label: '煙燻',
    params: { lip: 35, lipColor: '#b5525e', blush: 15, blushColor: '#d98a7a', brow: 40, browColor: '#2e2520', shadow: 60, shadowColor: '#3b2f33' },
  },
]

/** 目前的參數剛好是哪一組妝容（自己調過就不是了） */
export function matchLook(p: MakeupParams): string | null {
  return LOOKS.find((l) => (Object.keys(l.params) as (keyof MakeupParams)[]).every((k) => l.params[k] === p[k]))?.id ?? null
}
