import { IconRedo, IconShare, IconUndo } from './icons.tsx'

// 頂部列：復原、重做、匯出（M2、M6 才會接上功能）
export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-group">
        <button className="icon-btn" aria-label="復原" disabled>
          <IconUndo />
        </button>
        <button className="icon-btn" aria-label="重做" disabled>
          <IconRedo />
        </button>
      </div>
      <div className="topbar-title">PrettyShow</div>
      <div className="topbar-group">
        <button className="icon-btn" aria-label="匯出" disabled>
          <IconShare />
        </button>
      </div>
    </header>
  )
}
