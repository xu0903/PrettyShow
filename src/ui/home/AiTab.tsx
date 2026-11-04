import type { ReactNode } from 'react'
import { IconAI, IconEraser, IconHD, IconIdPhoto, IconPortrait } from '../icons.tsx'
import { comingSoon } from '../toast.ts'

const AI_TOOLS: { label: string; desc: string; icon: ReactNode }[] = [
  { label: '消除路人', desc: '把背景裡不想要的人或物整個抹掉', icon: <IconEraser /> },
  { label: '畫質修復', desc: '模糊、低解析度的照片變清楚', icon: <IconHD /> },
  { label: 'AI 創意', desc: '用一句話把照片變成不同風格', icon: <IconAI /> },
  { label: '形象照', desc: '用自拍生成正式的形象照', icon: <IconPortrait /> },
  { label: '證件照換背景', desc: '自動去背、換成證件照底色', icon: <IconIdPhoto /> },
]

// AI 修圖：之後透過自己的 Cloudflare Worker 呼叫 AI 服務（金鑰只放在 Worker）
export function AiTab() {
  return (
    <div className="home-scroll">
      <header className="page-head">
        <h1>AI 修圖</h1>
      </header>
      <div className="ai-list">
        {AI_TOOLS.map((t) => (
          <button key={t.label} className="ai-card" onClick={() => comingSoon(t.label)}>
            <span className="ai-icon">{t.icon}</span>
            <span className="ai-text">
              <b>{t.label}</b>
              <small>{t.desc}</small>
            </span>
            <span className="soon-badge is-inline">即將</span>
          </button>
        ))}
      </div>
      <p className="page-note">AI 功能需要接上 AI 服務，會在其他功能完成後加入。</p>
    </div>
  )
}
