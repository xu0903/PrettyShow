import { useEditor } from '../../core/store.ts'
import { PhotoViewport } from '../PhotoViewport.tsx'
import { CompareButton } from './CompareButton.tsx'
import { EditorTopBar } from './EditorTopBar.tsx'
import { ToolRow } from './ToolRow.tsx'
import { ToolSheet } from './ToolSheet.tsx'
import './editor.css'

// 編輯器：上面頂部列、中間照片、下面是工具列或打開中的工具。美化和美容共用這個畫面，只是工具不同
export function Editor() {
  const activeToolId = useEditor((s) => s.activeToolId)
  const hasPhoto = useEditor((s) => s.photo !== null)
  return (
    <div className="app">
      <EditorTopBar />
      <main className="app-main">
        <PhotoViewport />
        <CompareButton />
      </main>
      <div className="bottom">{hasPhoto && activeToolId ? <ToolSheet toolId={activeToolId} /> : <ToolRow />}</div>
    </div>
  )
}
