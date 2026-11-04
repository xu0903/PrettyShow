import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGestureLock } from './ui/gestureLock.ts'

// 禁止整頁雙指縮放（iOS 會忽略 user-scalable=no，要另外攔截）
installGestureLock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
