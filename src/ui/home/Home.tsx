import type { ReactNode } from 'react'
import { useEditor, type HomeTab } from '../../core/store.ts'
import { IconAI, IconGallery, IconHome, IconUser } from '../icons.tsx'
import { AiTab } from './AiTab.tsx'
import { GalleryTab } from './GalleryTab.tsx'
import { HomeTabView } from './HomeTabView.tsx'
import { MeTab } from './MeTab.tsx'
import './home.css'

const TABS: { id: HomeTab; label: string; icon: ReactNode }[] = [
  { id: 'home', label: '首頁', icon: <IconHome /> },
  { id: 'gallery', label: '圖庫', icon: <IconGallery /> },
  { id: 'ai', label: 'AI 修圖', icon: <IconAI /> },
  { id: 'me', label: '我', icon: <IconUser /> },
]

// 首頁外框：上面是分頁內容，下面是分頁列
export function Home() {
  const tab = useEditor((s) => s.homeTab)
  const setTab = useEditor((s) => s.setHomeTab)
  return (
    <div className="home">
      <div className="home-page">
        {tab === 'home' && <HomeTabView />}
        {tab === 'gallery' && <GalleryTab />}
        {tab === 'ai' && <AiTab />}
        {tab === 'me' && <MeTab />}
      </div>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className="tab-btn" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
