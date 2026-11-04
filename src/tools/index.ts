// 所有編輯工具在這裡註冊。新增工具只要寫好模組、在這裡加一行，核心程式不用改。

import { registerTool } from '../core/registry.ts'
import { adjustTool } from './adjust/index.tsx'
import { beautyTool } from './beauty/index.tsx'
import { cropTool } from './crop/index.tsx'
import { filterTool } from './filter/index.tsx'

registerTool(adjustTool)
registerTool(beautyTool)
registerTool(filterTool)
registerTool(cropTool)
