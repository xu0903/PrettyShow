import type { ReactNode } from 'react'
import { AI_TASKS, aiReady, type AiTask } from '../../core/ai.ts'
import { useEditor } from '../../core/store.ts'
import { IconAI, IconEraser, IconHair, IconHD, IconPortrait } from '../icons.tsx'

const ICONS: Record<AiTask, ReactNode> = {
  hairstyle: <IconHair />,
  remove: <IconEraser />,
  enhance: <IconHD />,
  style: <IconAI />,
  portrait: <IconPortrait />,
}

// AI 修圖：透過自己的 Cloudflare Worker 呼叫 AI 服務（金鑰只放在 Worker）
export function AiTab() {
  const openAi = useEditor((s) => s.openAi)
  const setTab = useEditor((s) => s.setHomeTab)
  const ready = aiReady()
  return (
    <div className="home-scroll">
      <header className="page-head">
        <h1>AI 修圖</h1>
      </header>
      {!ready && (
        <button className="ai-card ai-setup" onClick={() => setTab('me')}>
          <span className="ai-text">
            <b>先設定 AI 服務</b>
            <small>到「我」填入你的 Worker 網址和通行碼</small>
          </span>
          <span className="soon-badge is-inline">設定</span>
        </button>
      )}
      <div className="ai-list">
        {AI_TASKS.map((t) => (
          <button key={t.id} className="ai-card" onClick={() => openAi(t.id)}>
            <span className="ai-icon">{ICONS[t.id]}</span>
            <span className="ai-text">
              <b>{t.label}</b>
              <small>{t.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="page-note">換髮色、換妝容在「人像美容」裡就能做（不用 AI，免費）</p>
    </div>
  )
}
