// 還沒做好的工具：先在工具列上佔好位置，點了顯示「即將推出」。
// 做好一個工具後，從這裡刪掉那一項、在 tools/index.ts 註冊真正的工具即可。

import type { ReactNode } from 'react'
import type { EditorMode } from '../core/tool.ts'
import {
  IconBlur,
  IconFrame,
  IconHeight,
  IconMagic,
  IconRecipe,
  IconSticker,
  IconText,
} from '../ui/icons.tsx'

export interface UpcomingTool {
  id: string
  label: string
  icon: ReactNode
  placement: Partial<Record<EditorMode, number>>
}

export const UPCOMING: UpcomingTool[] = [
  // 圖片美化
  { id: 'recipe', label: '美圖配方', icon: <IconRecipe />, placement: { beautify: 10 } },
  { id: 'auto', label: '智慧優化', icon: <IconMagic />, placement: { beautify: 20 } },
  { id: 'text', label: '文字', icon: <IconText />, placement: { beautify: 60 } },
  { id: 'sticker', label: '貼紙', icon: <IconSticker />, placement: { beautify: 70 } },
  { id: 'frame', label: '邊框', icon: <IconFrame />, placement: { beautify: 80 } },
  { id: 'bokeh', label: '背景虛化', icon: <IconBlur />, placement: { beautify: 120 } },
  // 人像美容
  { id: 'beauty-recipe', label: '美容配方', icon: <IconRecipe />, placement: { portrait: 10 } },
  { id: 'taller', label: '增高', icon: <IconHeight />, placement: { portrait: 100 } },
]
