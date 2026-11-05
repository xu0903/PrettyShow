import { useEffect } from 'react'
import './tools/index.ts' // 註冊所有編輯工具
import { useEditor } from './core/store.ts'
import './ui/layout.css'
import './ui/overlays.css'
import { AiScreen } from './ui/ai/AiScreen.tsx'
import { Camera } from './ui/camera/Camera.tsx'
import { Collage } from './ui/collage/Collage.tsx'
import { Editor } from './ui/editor/Editor.tsx'
import { Home } from './ui/home/Home.tsx'
import { ExportHost } from './ui/ExportHost.tsx'
import { Toast } from './ui/Toast.tsx'
import { UpdateToast } from './ui/UpdateToast.tsx'

// 畫面：首頁（分頁：首頁、圖庫、AI 修圖、我）、編輯器（圖片美化／人像美容）、相機、拼圖
export default function App() {
  const screen = useEditor((s) => s.screen)

  // 打開 App 時讀取圖庫；上次修到一半就直接回到編輯器
  useEffect(() => {
    void useEditor.getState().init()
  }, [])

  return (
    <>
      {screen === 'home' && <Home />}
      {screen === 'editor' && <Editor />}
      {screen === 'camera' && <Camera />}
      {screen === 'collage' && <Collage />}
      {screen === 'ai' && <AiScreen />}
      <ExportHost />
      <Toast />
      <UpdateToast />
    </>
  )
}
