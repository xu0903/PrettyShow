import './ui/layout.css'
import { TopBar } from './ui/TopBar.tsx'
import { PhotoViewport } from './ui/PhotoViewport.tsx'
import { BottomToolbar } from './ui/BottomToolbar.tsx'

// 版面：照片在上、工具列在下，方便單手操作
export default function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="app-main">
        <PhotoViewport />
      </main>
      <BottomToolbar />
    </div>
  )
}
