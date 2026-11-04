import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { installGestureLock } from './ui/gestureLock.ts'
import { installViewportFix } from './ui/viewportFix.ts'

// 禁止整頁雙指縮放（iOS 會忽略 user-scalable=no，要另外攔截）
installGestureLock()
// 修正主畫面模式下 App 高度少一截的問題
installViewportFix()

// 發佈新版後：新的離線快取裝好就自動重新載入，不用手動把 App 關掉再開。
// 新版接手控制頁面時立刻重新載入（第一次安裝時不用）
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

// 每次切回 App、以及每 30 分鐘，都去檢查一次有沒有新版
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => void registration.update().catch(() => {})
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    window.setInterval(check, 30 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
