import { useState, type ReactNode } from 'react'
import { appIconUrl, getAppIcon } from '../../core/appIcon.ts'
import { useEditor } from '../../core/store.ts'
import {
  IconAI,
  IconBlur,
  IconCamera,
  IconCollage,
  IconCutout,
  IconEraser,
  IconFace,
  IconFrame,
  IconHD,
  IconIdPhoto,
  IconMagic,
  IconPortrait,
  IconText,
} from '../icons.tsx'
import { PickPhotoButton } from '../PickPhotoButton.tsx'
import { comingSoon } from '../toast.ts'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 星期${WEEKDAYS[d.getDay()]}`
}

/** 還沒做好的功能：點了顯示「即將推出」，右上角有小標籤 */
function Soon({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <button className={className} onClick={() => comingSoon(label)}>
      {children}
      <span className="soon-badge">即將</span>
    </button>
  )
}

/** 小工具；有 tool 的已經做好，選好照片就直接打開那個工具 */
const SMALL: { label: string; icon: ReactNode; tool?: string }[] = [
  { label: '背景虛化', icon: <IconBlur />, tool: 'bokeh' },
  { label: '摳圖', icon: <IconCutout /> },
  { label: '消除路人', icon: <IconEraser /> },
  { label: '畫質修復', icon: <IconHD /> },
  { label: 'AI 創意', icon: <IconAI /> },
  { label: '形象照', icon: <IconPortrait /> },
  { label: '文字', icon: <IconText />, tool: 'text' },
  { label: '邊框', icon: <IconFrame />, tool: 'frame' },
]

// 首頁：大按鈕「圖片美化」「相機」、常用功能、更多小工具、最近修過的照片
export function HomeTabView() {
  const gallery = useEditor((s) => s.gallery)
  const openDraft = useEditor((s) => s.openDraft)
  const setTab = useEditor((s) => s.setHomeTab)
  const [date] = useState(today)

  return (
    <div className="home-scroll home-red">
      <header className="home-head">
        <img className="home-logo" src={appIconUrl(getAppIcon())} alt="" />
        <div>
          <div className="home-brand">PrettyShow</div>
          <div className="home-date">{date}</div>
        </div>
      </header>

      <div className="home-hero">
        <PickPhotoButton className="hero-tile" mode="beautify">
          <IconMagic />
          <span>圖片美化</span>
        </PickPhotoButton>
        <Soon className="hero-tile" label="相機">
          <IconCamera />
          <span>相機</span>
        </Soon>
      </div>

      <div className="home-row">
        <PickPhotoButton className="row-tile" mode="portrait">
          <IconFace />
          <span>人像美容</span>
        </PickPhotoButton>
        <Soon className="row-tile" label="拼圖">
          <IconCollage />
          <span>拼圖</span>
        </Soon>
        <Soon className="row-tile" label="證件照">
          <IconIdPhoto />
          <span>證件照</span>
        </Soon>
        <PickPhotoButton className="row-tile" mode="beautify" tool="auto">
          <IconMagic />
          <span>智慧優化</span>
        </PickPhotoButton>
      </div>

      <div className="home-grid">
        {SMALL.map((s) =>
          s.tool ? (
            <PickPhotoButton key={s.label} className="grid-tile" mode="beautify" tool={s.tool}>
              {s.icon}
              <span>{s.label}</span>
            </PickPhotoButton>
          ) : (
            <Soon key={s.label} className="grid-tile" label={s.label}>
              {s.icon}
              <span>{s.label}</span>
            </Soon>
          ),
        )}
      </div>

      {gallery.length > 0 && (
        <section className="home-recent">
          <div className="section-head">
            <h2>最近修過</h2>
            <button onClick={() => setTab('gallery')}>全部 ›</button>
          </div>
          <div className="recent-row">
            {gallery.slice(0, 8).map((d) => (
              <button key={d.id} className="recent-item" aria-label="接著修" onClick={() => void openDraft(d.id)}>
                {d.thumb ? <img src={d.thumb} alt="" /> : <span className="thumb-empty" />}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
