import { paramsOf } from '../core/pipeline.ts'
import { getTool, getTools } from '../core/registry.ts'
import { selectViewState, useEditor } from '../core/store.ts'

// 底部：上面是目前工具的操作面板，下面是工具分頁。工具清單來自註冊表
export function BottomToolbar() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const activeToolId = useEditor((s) => s.activeToolId)
  const setActiveTool = useEditor((s) => s.setActiveTool)
  const tools = getTools()
  const active = hasPhoto && activeToolId ? getTool(activeToolId) : undefined

  return (
    <div className="bottom">
      {active && <ToolPanel toolId={active.id} />}
      <nav className="toolbar">
        {tools.map((t) => (
          <button
            key={t.id}
            className="tool-tab"
            disabled={!hasPhoto}
            aria-pressed={active?.id === t.id}
            // 再點一次同一個分頁就收起面板
            onClick={() => setActiveTool(active?.id === t.id ? null : t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function ToolPanel({ toolId }: { toolId: string }) {
  const tool = getTool(toolId)!
  const params = useEditor((s) => paramsOf(selectViewState(s), tool))
  const previewTool = useEditor((s) => s.previewTool)
  const commitTool = useEditor((s) => s.commitTool)
  const { Panel } = tool
  return (
    <div className="tool-panel">
      <Panel params={params} onChange={(p) => previewTool(toolId, p)} onCommit={(p) => commitTool(toolId, p)} />
    </div>
  )
}
