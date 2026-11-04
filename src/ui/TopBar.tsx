import { useState } from 'react'
import { useEditor } from '../core/store.ts'
import { IconPhoto, IconRedo, IconSettings, IconShare, IconUndo } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'
import { SettingsSheet } from './SettingsSheet.tsx'

// 頂部列：換照片、復原、重做、設定、匯出（復原／重做在 M2、匯出在 M6 接上）
export function TopBar() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
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
          <button className="icon-btn" aria-label="設定" onClick={() => setSettingsOpen(true)}>
            <IconSettings />
          </button>
          <button className="icon-btn" aria-label="匯出" disabled>
            <IconShare />
          </button>
        </div>
      </header>
      {/* 面板放在 header 外面，不影響頂部列的排版 */}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
