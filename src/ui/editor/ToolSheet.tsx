import { paramsOf } from '../../core/pipeline.ts'
import { getTool } from '../../core/registry.ts'
import { selectViewState, useEditor } from '../../core/store.ts'
import { IconCheck, IconClose } from '../icons.tsx'

// 打開某個工具時的底部：上面是工具自己的操作面板，下面是 ✕（放棄）、工具名稱、✓（套用）
export function ToolSheet({ toolId }: { toolId: string }) {
  const tool = getTool(toolId)!
  const params = useEditor((s) => paramsOf(selectViewState(s), tool))
  const previewTool = useEditor((s) => s.previewTool)
  const commitTool = useEditor((s) => s.commitTool)
  const applyTool = useEditor((s) => s.applyTool)
  const cancelTool = useEditor((s) => s.cancelTool)
  const { Panel } = tool
  return (
    <div className="tool-sheet">
      <div className="tool-panel">
        <Panel params={params} onChange={(p) => previewTool(toolId, p)} onCommit={(p) => commitTool(toolId, p)} />
      </div>
      <div className="tool-footer">
        <button className="icon-btn" aria-label="取消" onClick={cancelTool}>
          <IconClose />
        </button>
        <span className="tool-footer-title">{tool.label}</span>
        <button className="icon-btn" aria-label="套用" onClick={applyTool}>
          <IconCheck />
        </button>
      </div>
    </div>
  )
}
