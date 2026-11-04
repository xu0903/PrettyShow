// 把編輯狀態轉成要依序執行的 shader 步驟

import type { RenderPass } from '../gl/pass.ts'
import type { EditState } from './editStack.ts'
import type { AnyTool } from './registry.ts'
import type { PassContext } from './tool.ts'

/** 取得某個工具目前的參數（沒設定過就用預設值） */
export function paramsOf<P>(state: EditState, tool: { id: string; defaultParams: P }): P {
  return (state[tool.id] as P | undefined) ?? tool.defaultParams
}

export function buildPasses(state: EditState, tools: readonly AnyTool[], ctx: PassContext): RenderPass[] {
  const steps = tools.flatMap((tool) => {
    const params = paramsOf(state, tool)
    if (!tool.steps || tool.isIdentity(params)) return []
    return tool.steps(params, ctx)
  })
  // 依 order 排序；order 相同時維持工具註冊的順序（sort 是穩定排序）
  return steps.sort((a, b) => a.order - b.order).map((s) => s.pass)
}
