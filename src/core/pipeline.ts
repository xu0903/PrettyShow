// 把編輯狀態轉成要依序執行的 shader 步驟

import type { Size } from '../gl/limits.ts'
import type { RenderPass } from '../gl/pass.ts'
import type { EditState } from './editStack.ts'
import type { AnyTool } from './registry.ts'
import { ORDER, type PassContext, type Point, type PrepareContext } from './tool.ts'

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
  let steps = tools.flatMap((tool) => {
    const params = effectiveParams(state, tool, opts)
    if (!tool.steps || tool.isIdentity(params)) return []
    return tool.steps(params, ctx)
  })
  // 打開的工具要求「只看到自己處理完的畫面」：拿掉排在後面、會改變大小或疊在上面的步驟
  const active = opts.activeToolId ? tools.find((t) => t.id === opts.activeToolId) : undefined
  if (active?.isolateView && active.geometryOrder !== undefined) {
    const after = active.geometryOrder
    steps = steps.filter((s) => s.order <= after || (!s.pass.outputSize && s.order < ORDER.frame))
  }
  // 依 order 排序；order 相同時維持工具註冊的順序（sort 是穩定排序）
  return steps.sort((a, b) => a.order - b.order).map((s) => s.pass)
}

/**
 * 畫面上（裁切、邊框…之後）的點 → 原圖上的點，兩者都是 0..1、原點左上。
 * 先依處理順序算出每個幾何工具的輸入尺寸，再由後往前一個個還原。
 */
export function displayToSourcePoint(state: EditState, tools: readonly AnyTool[], p: Point, sourceSize: Size): Point {
  const chain = tools
    .filter((t) => t.mapToSource)
    .sort((a, b) => (a.geometryOrder ?? 0) - (b.geometryOrder ?? 0))
    .map((t) => ({ t, params: paramsOf(state, t) }))
    .filter(({ t, params }) => !t.isIdentity(params))
  let size = sourceSize
  const inputs = chain.map(({ t, params }) => {
    const input = size
    size = t.mapSize ? t.mapSize(params, size) : size
    return input
  })
  let q = p
  for (let i = chain.length - 1; i >= 0; i--) q = chain[i].t.mapToSource!(chain[i].params, q, inputs[i])
  return q
}

/** 一串步驟跑完之後的尺寸（匯出前檢查會不會超過 iOS 的上限） */
export function outputSizeOf(passes: readonly RenderPass[], input: Size): Size {
  return passes.reduce((s, p) => p.outputSize?.(s) ?? s, input)
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
