import type { ReactNode } from 'react'
import { IconCrop, IconFilter, IconSliders } from './icons.tsx'

// 底部工具列：M2 之後會改成從工具註冊表動態產生
const placeholderTools: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'adjust', label: '調整', icon: <IconSliders /> },
  { id: 'filter', label: '濾鏡', icon: <IconFilter /> },
  { id: 'crop', label: '裁切', icon: <IconCrop /> },
]

export function BottomToolbar() {
  return (
    <nav className="toolbar">
      {placeholderTools.map((t) => (
        <button key={t.id} className="tool-tab" disabled>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
