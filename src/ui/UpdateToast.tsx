import { useState } from 'react'
import { APP_VERSION, changesSince, compareVersions } from '../version.ts'

const SEEN_KEY = 'prettyshow.seenVersion'

/** 上次看過的版本；不需要通知時是 null。undefined 代表還沒判斷 */
let decided: string | null | undefined

/**
 * 判斷要不要顯示更新通知。結果快取起來，整個 App 只判斷一次
 * （React 開發模式會把 useState 的初始化函式執行兩次，第二次會讀到剛寫入的版本號）。
 * 第一次安裝不用通知；還沒有版本紀錄、但已經有舊版 service worker 在控制頁面的，
 * 代表是加入版本號之前就在用的人，也要通知。
 */
function seenVersion(): string | null {
  if (decided === undefined) decided = checkVersion()
  return decided
}

function checkVersion(): string | null {
  try {
    const seen = localStorage.getItem(SEEN_KEY)
    localStorage.setItem(SEEN_KEY, APP_VERSION)
    const existing = seen ?? (navigator.serviceWorker?.controller ? 'old' : null)
    // 只有版本「變新」才通知（退回舊版或版本號寫錯時不要跳）
    if (existing === null) return null
    const valid = /^\d+(\.\d+)*$/.test(existing)
    return !valid || compareVersions(APP_VERSION, existing) > 0 ? existing : null
  } catch {
    // 讀不到儲存空間就不通知
    return null
  }
}

/** 打開 App 時發現版本變了，就跳出「已更新到 vX」與上次之後的所有更新內容 */
export function UpdateToast() {
  const [seen, setSeen] = useState(seenVersion)
  if (seen === null) return null
  const changes = changesSince(seen)
  const close = () => setSeen(null)
  return (
    <div className="update-backdrop" onClick={close}>
      <div className="update-card" role="dialog" aria-label="更新內容" onClick={(e) => e.stopPropagation()}>
        <p className="update-title">已更新到 v{APP_VERSION}</p>
        <div className="update-body">
          {changes.map((c) => (
            <section key={c.version}>
              {/* 一次跨好幾版時，標出每一版 */}
              {changes.length > 1 && <p className="update-version">v{c.version}</p>}
              <ul className="update-notes">
                {c.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button className="update-ok" onClick={close}>
          好
        </button>
      </div>
    </div>
  )
}
