import { useState, type ReactNode } from 'react'
import type { AiTask } from '../../core/ai.ts'
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
  IconPhoto,
  IconPortrait,
  IconText,
} from '../icons.tsx'
import { PickPhotoButton } from '../PickPhotoButton.tsx'
import { comingSoon } from '../toast.ts'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 依時間打招呼，下面一行是日期 */
function greeting(): { hello: string; date: string } {
  const d = new Date()
  const h = d.getHours()
  const hello = h >= 5 && h < 11 ? '早安' : h >= 11 && h < 18 ? '午安' : '晚安'
  return { hello, date: `${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${WEEKDAYS[d.getDay()]}` }
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

/** 首頁的工具；有 tool 的選好照片就直接打開那個工具，有 ai 的打開 AI 修圖，都沒有的是還沒做好 */
interface Item {
  label: string
  icon: ReactNode
  mode?: 'beautify' | 'portrait'
  tool?: string
  ai?: AiTask
}

/** 依用途分組 */
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: '修圖',
    items: [
      { label: '智慧優化', icon: <IconMagic />, mode: 'beautify', tool: 'auto' },
      { label: '背景虛化', icon: <IconBlur />, mode: 'beautify', tool: 'bokeh' },
      { label: '文字', icon: <IconText />, mode: 'beautify', tool: 'text' },
      { label: '邊框', icon: <IconFrame />, mode: 'beautify', tool: 'frame' },
    ],
  },
  {
    title: '人像',
    items: [
      { label: '證件照', icon: <IconIdPhoto />, mode: 'portrait', tool: 'idphoto' },
      { label: '形象照', icon: <IconPortrait />, ai: 'portrait' },
      { label: '摳圖', icon: <IconCutout /> },
    ],
  },
  {
    title: 'AI 消除與生成',
    items: [
      { label: '消除路人', icon: <IconEraser />, ai: 'remove' },
      { label: '畫質修復', icon: <IconHD />, ai: 'enhance' },
      { label: 'AI 創意', icon: <IconAI />, ai: 'style' },
    ],
  },
]

function Tool({ item }: { item: Item }) {
  const openAi = useEditor((s) => s.openAi)
  const body = (
    <>
      <span className="tool-badge">{item.icon}</span>
      <span>{item.label}</span>
    </>
  )
  if (item.ai)
    return (
      <button className="grid-tile" onClick={() => openAi(item.ai!)}>
        {body}
      </button>
    )
  if (item.tool)
    return (
      <PickPhotoButton className="grid-tile" mode={item.mode} tool={item.tool}>
        {body}
      </PickPhotoButton>
    )
  return (
    <Soon className="grid-tile" label={item.label}>
      {body}
    </Soon>
  )
}

// 首頁：打招呼、大張的「修一張照片」、人像／相機／拼圖、最近修過的照片、依用途分組的工具
export function HomeTabView() {
  const gallery = useEditor((s) => s.gallery)
  const openDraft = useEditor((s) => s.openDraft)
  const setTab = useEditor((s) => s.setHomeTab)
  const setScreen = useEditor((s) => s.setScreen)
  const [{ hello, date }] = useState(greeting)
  // 大卡片右邊疊兩張最近修過的照片，像桌上的拍立得
  const stack = gallery
    .slice(0, 2)
    .map((d) => d.thumb)
    .filter(Boolean)

  return (
    <div className="home-scroll home-latte">
      <header className="home-head">
        <div>
          <h1 className="home-hello">{hello}</h1>
          <div className="home-date">{date}</div>
        </div>
        <img className="home-logo" src={appIconUrl(getAppIcon())} alt="" />
      </header>

      <PickPhotoButton className="hero-tile" mode="beautify">
        <span className="hero-text">
          <b>修一張照片</b>
          <small>從相簿選一張開始</small>
        </span>
        <span className="hero-stack" aria-hidden="true">
          {stack.length ? (
            stack
              .slice()
              .reverse()
              .map((t, i) => <img key={i} src={t} alt="" />)
          ) : (
            <span className="hero-stack-empty">
              <IconPhoto />
            </span>
          )}
        </span>
      </PickPhotoButton>

      <div className="home-quick">
        <PickPhotoButton className="quick-btn" mode="portrait">
          <IconFace />
          <span>人像美容</span>
        </PickPhotoButton>
        <button className="quick-btn" onClick={() => setScreen('camera')}>
          <IconCamera />
          <span>相機</span>
        </button>
        <button className="quick-btn" onClick={() => setScreen('collage')}>
          <IconCollage />
          <span>拼圖</span>
        </button>
      </div>

      {gallery.length > 0 && (
        <section className="home-recent">
          <div className="section-head">
            <h2>最近修過</h2>
            <button onClick={() => setTab('gallery')}>全部</button>
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

      {GROUPS.map((g) => (
        <section key={g.title} className="home-group">
          <h2>{g.title}</h2>
          <div className="home-grid">
            {g.items.map((it) => (
              <Tool key={it.label} item={it} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
