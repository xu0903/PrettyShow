import { getToolsFor } from '../../core/registry.ts'
import { useEditor } from '../../core/store.ts'
import { UPCOMING } from '../../tools/upcoming.tsx'
import { IconFace, IconMagic } from '../icons.tsx'
import { comingSoon } from '../toast.ts'

// 編輯器底部的工具列：可以左右滑，右邊固定一個切換到另一個編輯器的按鈕（去美容／去美化）
export function ToolRow() {
  const mode = useEditor((s) => s.mode)
  const hasPhoto = useEditor((s) => s.photo !== null)
  const openTool = useEditor((s) => s.openTool)
  const setMode = useEditor((s) => s.setMode)

  const items = [
    ...getToolsFor(mode).map((t) => ({
      id: t.id,
      label: t.label,
      icon: t.icon,
      order: t.placement[mode]!,
      onClick: () => openTool(t.id),
      soon: false,
    })),
    ...UPCOMING.filter((u) => u.placement[mode] !== undefined).map((u) => ({
      id: u.id,
      label: u.label,
      icon: u.icon,
      order: u.placement[mode]!,
      onClick: () => comingSoon(u.label),
      soon: true,
    })),
  ].sort((a, b) => a.order - b.order)

  const other = mode === 'beautify' ? { label: '去美容', icon: <IconFace /> } : { label: '去美化', icon: <IconMagic /> }

  return (
    <nav className="tool-row">
      <div className="tool-row-scroll">
        {items.map((i) => (
          <button key={i.id} className={i.soon ? 'tool-item is-soon' : 'tool-item'} disabled={!hasPhoto} onClick={i.onClick}>
            {i.icon}
            <span>{i.label}</span>
          </button>
        ))}
      </div>
      <button
        className="tool-item tool-switch"
        disabled={!hasPhoto}
        onClick={() => setMode(mode === 'beautify' ? 'portrait' : 'beautify')}
      >
        {other.icon}
        <span>{other.label}</span>
      </button>
    </nav>
  )
}
