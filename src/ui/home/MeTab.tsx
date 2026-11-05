import { useState } from 'react'
import { APP_ICONS, appIconUrl, getAppIcon, setAppIcon } from '../../core/appIcon.ts'
import { MAX_DRAFTS } from '../../core/drafts.ts'
import { useEditor } from '../../core/store.ts'
import { APP_VERSION, BUILD_TIME } from '../../version.ts'
import { isStandalone } from '../viewportFix.ts'
import { AiSettings } from './AiSettings.tsx'

// 「我」：App 圖示、AI 服務設定、圖庫用量、版本資訊
export function MeTab() {
  const [icon, setIcon] = useState(getAppIcon)
  const count = useEditor((s) => s.gallery.length)
  const standalone = isStandalone()

  const choose = (id: string) => {
    setIcon(id)
    setAppIcon(id)
  }

  return (
    <div className="home-scroll">
      <header className="page-head">
        <h1>我</h1>
      </header>

      <section className="me-card">
        <h2 className="sheet-title">App 圖示</h2>
        <div className="icon-grid">
          {APP_ICONS.map((i) => (
            <button key={i.id} className="icon-choice" aria-pressed={icon === i.id} onClick={() => choose(i.id)}>
              <img src={appIconUrl(i.id)} alt="" />
              <span>{i.name}</span>
            </button>
          ))}
        </div>
        <div className="sheet-note">
          <p>主畫面上的圖示在「加入主畫面」那一刻就決定了，在這裡選了不會自動換掉已經加好的圖示。</p>
          <p>
            要換圖示：用 <b>Safari</b> 打開這個網站 → 在這裡選好圖示 → 刪掉主畫面上舊的 PrettyShow → 再「加入主畫面」一次。
          </p>
          {standalone && <p>你現在是從主畫面打開的，請改用 Safari 打開網站再選。</p>}
        </div>
      </section>

      <AiSettings />

      <section className="me-card">
        <h2 className="sheet-title">圖庫</h2>
        <p className="me-line">
          已保存 {count} 張（最多 {MAX_DRAFTS} 張，超過時自動刪掉最舊的）
        </p>
      </section>

      <section className="me-card">
        <h2 className="sheet-title">版本</h2>
        <p className="sheet-version">
          v{APP_VERSION}
          <span>建置於 {new Date(BUILD_TIME).toLocaleString('zh-TW', { hour12: false })}</span>
        </p>
      </section>
    </div>
  )
}
