// 還沒做好的工具：先在工具列上佔好位置，點了顯示「即將推出」。
// 做好一個工具後，從這裡刪掉那一項、在 tools/index.ts 註冊真正的工具即可。
// （第一階段到第五階段的工具都做好了，目前沒有佔位的項目）

import type { ReactNode } from 'react'
import type { EditorMode } from '../core/tool.ts'

export interface UpcomingTool {
  id: string
  label: string
  icon: ReactNode
  placement: Partial<Record<EditorMode, number>>
}

export const UPCOMING: UpcomingTool[] = []
