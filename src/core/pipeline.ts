// 把編輯狀態轉成要依序執行的 shader 步驟

import type { RenderPass } from '../gl/pass.ts'
import type { EditState } from './editStack.ts'
import type { AnyTool } from './registry.ts'
import type { PassContext, Point, PrepareContext } from './tool.ts'

/** 取得某個工具目前的參數（沒設定過就用預設值） */
export function paramsOf<P>(state: EditState, tool: { id: string; defaultParams: P }): P {
  return (state[tool.id] as P | undefined) ?? tool.defaultParams
}

export interface BuildOptions {
  /** 目前打開面板的工具：它若有 viewParams，畫面改用那組參數 */
  activeToolId?: string | null
}

/** 某個工具實際用來渲染的參數 */
function effectiveParams(state: EditState, tool: AnyTool, opts: BuildOptions): unknown {
  const params = paramsOf(state, tool)
  return tool.id === opts.activeToolId && tool.viewParams ? tool.viewParams(params) : params
}

export function buildPasses(
  state: EditState,
  tools: readonly AnyTool[],
  ctx: PassContext,
  opts: BuildOptions = {},
): RenderPass[] {
  const steps = tools.flatMap((tool) => {
    const params = effectiveParams(state, tool, opts)
    if (!tool.steps || tool.isIdentity(params)) return []
    return tool.steps(params, ctx)
  })
  // 依 order 排序；order 相同時維持工具註冊的順序（sort 是穩定排序）
  return steps.sort((a, b) => a.order - b.order).map((s) => s.pass)
}

/**
 * 畫面上（裁切、旋轉之後）的點 → 原圖上的點，兩者都是 0..1、原點左上。
 * 幾何工具由後往前一個個還原（目前只有裁切）。
 */
export function displayToSourcePoint(state: EditState, tools: readonly AnyTool[], p: Point): Point {
  return tools
    .filter((t) => t.mapToSource)
    .reverse()
    .reduce((q, t) => {
      const params = paramsOf(state, t)
      return t.isIdentity(params) ? q : t.mapToSource!(params, q)
    }, p)
}

/** 讓所有用到的工具先準備好資源（例如下載 LUT）；匯出前一定要等這個完成 */
export async function prepareTools(
  state: EditState,
  tools: readonly AnyTool[],
  opts: BuildOptions & PrepareContext = {},
): Promise<void> {
  await Promise.all(
    tools.map((tool) => {
      const params = effectiveParams(state, tool, opts)
      if (!tool.prepare || tool.isIdentity(params)) return undefined
      return tool.prepare(params, { photo: opts.photo })
    }),
  )
}
