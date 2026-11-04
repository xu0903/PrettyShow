// 美妝的參數、各部位可選的顏色、整組妝容。
// 口紅色參考韓團近期流行（半透明的 MLBB、乾燥玫瑰、櫻桃玫瑰、蜜桃珊瑚、無花果、奶茶棕、霧感藕紫）
// 和日本美妝雜誌（MAQUIA、VOCE）常見的くすみピンク、ピンクベージュ、アプリコット、テラコッタ。

import type { NamedColor } from '../../ui/colors.ts'

export type Part = 'lip' | 'blush' | 'brow' | 'shadow'

export interface MakeupParams {
  lip: number // 強度 0..100（100 = 自然的上限）
  lipColor: string
  /** 暈染唇：顏色集中在嘴唇中間、往唇線變淡（舊版存的參數沒有這一項 = 滿塗） */
  lipBlur?: boolean
  blush: number
  blushColor: string
  brow: number
  browColor: string
  shadow: number
  shadowColor: string
}

export const LIP_COLORS: NamedColor[] = [
  // 韓系
  { color: '#c97b7e', label: 'MLBB 玫瑰' },
  { color: '#b5676c', label: '乾燥玫瑰' },
  { color: '#c8404f', label: '櫻桃玫瑰' },
  { color: '#e8836f', label: '蜜桃珊瑚' },
  { color: '#9e5560', label: '無花果' },
  { color: '#b87d6b', label: '奶茶棕' },
  { color: '#a9727f', label: '霧感藕紫' },
  // 日系
  { color: '#d08a8f', label: 'くすみピンク' },
  { color: '#d9a09a', label: 'ピンクベージュ' },
  { color: '#e4956f', label: 'アプリコット' },
  { color: '#b8634d', label: 'テラコッタ' },
  { color: '#9a5a58', label: 'ローズブラウン' },
]

export const BLUSH_COLORS: NamedColor[] = [
  { color: '#f4a38c', label: '蜜桃' },
  { color: '#e8949f', label: '玫瑰' },
  { color: '#f39a83', label: '珊瑚' },
  { color: '#cfa6d8', label: '薰衣草' },
  { color: '#f1a77e', label: '杏桃' },
  { color: '#d9a0a6', label: '煙燻粉' },
]

export const BROW_COLORS: NamedColor[] = [
  { color: '#6b5442', label: '灰棕' },
  { color: '#7a5c45', label: '淺棕' },
  { color: '#5a4636', label: '深棕' },
  { color: '#3e2c22', label: '黑棕' },
]

export const SHADOW_COLORS: NamedColor[] = [
  { color: '#e3b5a4', label: '裸粉' },
  { color: '#d4a0a8', label: '玫瑰粉' },
  { color: '#c9a28a', label: '奶茶' },
  { color: '#d9b38c', label: '香檳金' },
  { color: '#b8a0c8', label: '冷調紫' },
  { color: '#8c5a46', label: '大地棕' },
  { color: '#3b2f33', label: '煙燻黑' },
]

export const PARTS: { key: Part; label: string; colors: NamedColor[] }[] = [
  { key: 'lip', label: '口紅', colors: LIP_COLORS },
  { key: 'blush', label: '腮紅', colors: BLUSH_COLORS },
  { key: 'brow', label: '眉毛', colors: BROW_COLORS },
  { key: 'shadow', label: '眼影', colors: SHADOW_COLORS },
]

export const colorKey = (part: Part) => `${part}Color` as const

export const NO_MAKEUP: MakeupParams = {
  lip: 0,
  lipColor: LIP_COLORS[0].color,
  lipBlur: true,
  blush: 0,
  blushColor: BLUSH_COLORS[0].color,
  brow: 0,
  browColor: BROW_COLORS[0].color,
  shadow: 0,
  shadowColor: SHADOW_COLORS[0].color,
}

/** 整組妝容：一次設定四個部位 */
export const LOOKS: { id: string; label: string; params: MakeupParams }[] = [
  {
    id: 'natural',
    label: '素顏感',
    params: { lip: 55, lipColor: '#c97b7e', lipBlur: true, blush: 35, blushColor: '#f4a38c', brow: 30, browColor: '#6b5442', shadow: 20, shadowColor: '#e3b5a4' },
  },
  {
    id: 'korean',
    label: '韓系暈染',
    params: { lip: 75, lipColor: '#c8404f', lipBlur: true, blush: 40, blushColor: '#e8949f', brow: 25, browColor: '#6b5442', shadow: 30, shadowColor: '#d4a0a8' },
  },
  {
    id: 'mlbb',
    label: '乾燥玫瑰',
    params: { lip: 70, lipColor: '#b5676c', lipBlur: false, blush: 30, blushColor: '#d9a0a6', brow: 35, browColor: '#5a4636', shadow: 35, shadowColor: '#c9a28a' },
  },
  {
    id: 'japanese',
    label: '日系透明感',
    params: { lip: 65, lipColor: '#d08a8f', lipBlur: true, blush: 50, blushColor: '#cfa6d8', brow: 25, browColor: '#7a5c45', shadow: 30, shadowColor: '#b8a0c8' },
  },
  {
    id: 'apricot',
    label: '日系杏桃',
    params: { lip: 65, lipColor: '#e4956f', lipBlur: false, blush: 50, blushColor: '#f1a77e', brow: 25, browColor: '#7a5c45', shadow: 35, shadowColor: '#d9b38c' },
  },
  {
    id: 'smoky',
    label: '煙燻',
    params: { lip: 60, lipColor: '#9a5a58', lipBlur: false, blush: 20, blushColor: '#d9a0a6', brow: 45, browColor: '#3e2c22', shadow: 70, shadowColor: '#3b2f33' },
  },
]

/** 目前的參數剛好是哪一組妝容（自己調過就不是了） */
export function matchLook(p: MakeupParams): string | null {
  return LOOKS.find((l) => (Object.keys(l.params) as (keyof MakeupParams)[]).every((k) => l.params[k] === p[k]))?.id ?? null
}
