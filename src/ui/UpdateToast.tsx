import { useState } from 'react'
import { APP_VERSION, CHANGELOG } from '../version.ts'

const SEEN_KEY = 'prettyshow.seenVersion'

let decided: boolean | null = null

/**
 * 判斷要不要顯示更新通知。結果快取起來，整個 App 只判斷一次
 * （React 開發模式會把 useState 的初始化函式執行兩次，第二次會讀到剛寫入的版本號）。
 * 第一次安裝不用通知；還沒有版本紀錄、但已經有舊版 service worker 在控制頁面的，
 * 代表是加入版本號之前就在用的人，也要通知。
 */
function shouldShow(): boolean {
  if (decided === null) decided = checkVersion()
  return decided
}

function checkVersion(): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY)
    localStorage.setItem(SEEN_KEY, APP_VERSION)
    const existing = seen ?? (navigator.serviceWorker?.controller ? 'old' : null)
    return existing !== null && existing !== APP_VERSION
  } catch {
    // 讀不到儲存空間就不通知
    return false
  }
}

/** 打開 App 時發現版本變了，就跳出「已更新到 vX」與這一版的更新內容 */
export function UpdateToast() {
  const [show, setShow] = useState(shouldShow)
  if (!show) return null
  const notes = CHANGELOG[APP_VERSION] ?? []
  return (
    <div className="update-backdrop" onClick={() => setShow(false)}>
      <div className="update-card" role="dialog" aria-label="更新內容" onClick={(e) => e.stopPropagation()}>
        <p className="update-title">已更新到 v{APP_VERSION}</p>
        {notes.length > 0 && (
          <ul className="update-notes">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <button className="update-ok" onClick={() => setShow(false)}>
          好
        </button>
      </div>
    </div>
  )
}
