import { useEditor } from '../core/store.ts'
import { IconPhoto, IconRedo, IconShare, IconUndo } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'

// 頂部列：換照片、復原、重做、匯出（復原／重做在 M2、匯出在 M6 接上）
export function TopBar() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  return (
    <header className="topbar">
      <div className="topbar-group">
        {hasPhoto && (
          <PickPhotoButton className="icon-btn" label="換照片">
            <IconPhoto />
          </PickPhotoButton>
        )}
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
