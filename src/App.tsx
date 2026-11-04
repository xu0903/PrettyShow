import { useEffect } from 'react'
import './tools/index.ts' // 註冊所有編輯工具
import { useEditor } from './core/store.ts'
import './ui/layout.css'
import './ui/overlays.css'
import { TopBar } from './ui/TopBar.tsx'
import { PhotoViewport } from './ui/PhotoViewport.tsx'
import { BottomToolbar } from './ui/BottomToolbar.tsx'
import { UpdateToast } from './ui/UpdateToast.tsx'

// 版面：照片在上、工具列在下，方便單手操作
export default function App() {
  // 打開 App 時還原上次的照片與編輯
  useEffect(() => {
    void useEditor.getState().restoreSession()
  }, [])

  return (
    <div className="app">
      <TopBar />
      <main className="app-main">
        <PhotoViewport />
      </main>
      <BottomToolbar />
      <UpdateToast />
    </div>
  )
}
