import { useState } from 'react'
import { exportPhoto, type ExportResult } from '../../core/export.ts'
import { useEditor } from '../../core/store.ts'
import { ExportSheet } from '../ExportSheet.tsx'
import { IconBack, IconRedo, IconUndo } from '../icons.tsx'

// 編輯器頂部：返回首頁、復原、重做、儲存。打開工具時只留復原／重做，要先按 ✓ 或 ✕ 才能離開
export function EditorTopBar() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const inTool = useEditor((s) => s.activeToolId !== null)
  const canUndo = useEditor((s) => s.history.past.length > 0)
  const canRedo = useEditor((s) => s.history.future.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const closeEditor = useEditor((s) => s.closeEditor)
  const [exportJob, setExportJob] = useState<Promise<ExportResult> | null>(null)

  const startExport = () => {
    const { photo, history } = useEditor.getState()
    if (!photo) return
    setExportJob(exportPhoto(photo, history.present))
  }

  const closeExport = () => {
    // 關掉面板後釋放預覽圖的記憶體
    exportJob?.then((r) => URL.revokeObjectURL(r.url)).catch(() => {})
    setExportJob(null)
  }

  return (
    <>
      <header className="ed-top">
        <div className="ed-top-side">
          {!inTool && (
            <button className="icon-btn" aria-label="回首頁" onClick={() => void closeEditor()}>
              <IconBack />
            </button>
          )}
        </div>
        <div className="ed-top-mid">
          <button className="icon-btn" aria-label="復原" disabled={!canUndo} onClick={undo}>
            <IconUndo />
          </button>
          <button className="icon-btn" aria-label="重做" disabled={!canRedo} onClick={redo}>
            <IconRedo />
          </button>
        </div>
        <div className="ed-top-side is-right">
          {!inTool && (
            <button className="ed-save" disabled={!hasPhoto} onClick={startExport}>
              儲存
            </button>
          )}
        </div>
      </header>
      {exportJob && <ExportSheet job={exportJob} onClose={closeExport} />}
    </>
  )
}
