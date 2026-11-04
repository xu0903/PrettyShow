import { useState } from 'react'
import { exportPhoto, type ExportResult } from '../core/export.ts'
import { useEditor } from '../core/store.ts'
import { ExportSheet } from './ExportSheet.tsx'
import { IconPhoto, IconRedo, IconSettings, IconShare, IconUndo } from './icons.tsx'
import { PickPhotoButton } from './PickPhotoButton.tsx'
import { SettingsSheet } from './SettingsSheet.tsx'

// 頂部列：換照片、復原、重做、設定、匯出
export function TopBar() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const canUndo = useEditor((s) => s.history.past.length > 0)
  const canRedo = useEditor((s) => s.history.future.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportJob, setExportJob] = useState<Promise<ExportResult> | null>(null)

  const startExport = () => {
    const { photo, history } = useEditor.getState()
    if (!photo) return
    // 匯出的是已經確定的編輯（不含拖到一半的滑桿）
    setExportJob(exportPhoto(photo, history.present))
  }

  const closeExport = () => {
    // 關掉面板後釋放預覽圖的記憶體
    exportJob?.then((r) => URL.revokeObjectURL(r.url)).catch(() => {})
    setExportJob(null)
  }
  return (
    <>
      <header className="topbar">
        <div className="topbar-group">
          {hasPhoto && (
            <PickPhotoButton className="icon-btn" label="換照片">
              <IconPhoto />
            </PickPhotoButton>
          )}
          <button className="icon-btn" aria-label="復原" disabled={!canUndo} onClick={undo}>
            <IconUndo />
          </button>
          <button className="icon-btn" aria-label="重做" disabled={!canRedo} onClick={redo}>
            <IconRedo />
          </button>
        </div>
        <div className="topbar-title">PrettyShow</div>
        <div className="topbar-group">
          <button className="icon-btn" aria-label="設定" onClick={() => setSettingsOpen(true)}>
            <IconSettings />
          </button>
          <button className="icon-btn" aria-label="匯出" disabled={!hasPhoto} onClick={startExport}>
            <IconShare />
          </button>
        </div>
      </header>
      {/* 面板放在 header 外面，不影響頂部列的排版 */}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {exportJob && <ExportSheet job={exportJob} onClose={closeExport} />}
    </>
  )
}
