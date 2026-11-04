// 工具註冊表：工具模組在 src/tools/index.ts 註冊自己，核心只透過這裡取得工具清單

import type { EditorMode, EditTool } from './tool.ts'

/** 型別抹除後的工具（registry 裡的工具 params 型別各不相同） */
export type AnyTool = EditTool<unknown>

const tools = new Map<string, AnyTool>()

export function registerTool<P>(tool: EditTool<P>): void {
  if (tools.has(tool.id)) throw new Error(`工具 id 重複：${tool.id}`)
  tools.set(tool.id, tool as unknown as AnyTool)
}

export function getTool(id: string): AnyTool | undefined {
  return tools.get(id)
}

/** 所有工具（渲染管線用；順序由每個步驟的 order 決定，和這裡無關） */
export function getTools(): AnyTool[] {
  return [...tools.values()]
}

/** 某個編輯器工具列上的工具，依位置排好 */
export function getToolsFor(mode: EditorMode): AnyTool[] {
  return getTools()
    .filter((t) => t.placement[mode] !== undefined)
    .sort((a, b) => a.placement[mode]! - b.placement[mode]!)
}
