import { useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { IconCheck, IconPhoto } from '../icons.tsx'
import { PickPhotoButton } from '../PickPhotoButton.tsx'

const pad = (n: number) => String(n).padStart(2, '0')
const formatDate = (t: number) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 圖庫：修過的照片（草稿），點一下接著修；「選取」可以一次刪掉好幾張
export function GalleryTab() {
  const gallery = useEditor((s) => s.gallery)
  const openDraft = useEditor((s) => s.openDraft)
  const removeDrafts = useEditor((s) => s.removeDrafts)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const finish = () => {
    setSelecting(false)
    setPicked(new Set())
  }

  const remove = () => {
    if (!confirm(`刪除 ${picked.size} 張？修圖紀錄會一起刪掉（相簿裡的原圖不受影響）`)) return
    void removeDrafts([...picked]).then(finish)
  }

  return (
    <div className="home-scroll">
      <header className="page-head">
        <h1>圖庫</h1>
        {gallery.length > 0 && (
          <button className="page-head-btn" onClick={() => (selecting ? finish() : setSelecting(true))}>
            {selecting ? '完成' : '選取'}
          </button>
        )}
      </header>

      {gallery.length === 0 ? (
        <div className="page-empty">
          <p>還沒有修過的照片</p>
          <PickPhotoButton className="pick-btn" mode="beautify">
            <IconPhoto />
            <span>選擇照片</span>
          </PickPhotoButton>
        </div>
      ) : (
        <div className="gallery-grid">
          {gallery.map((d) => (
            <button
              key={d.id}
              className="gallery-item"
              aria-pressed={selecting ? picked.has(d.id) : undefined}
              onClick={() => (selecting ? toggle(d.id) : void openDraft(d.id))}
            >
              {d.thumb ? <img src={d.thumb} alt="" /> : <span className="thumb-empty" />}
              <span className="gallery-date">{formatDate(d.updatedAt)}</span>
              {selecting && <span className="gallery-check">{picked.has(d.id) && <IconCheck />}</span>}
            </button>
          ))}
        </div>
      )}

      {selecting && (
        <div className="gallery-actions">
          <span>已選 {picked.size} 張</span>
          <button className="danger-btn" disabled={picked.size === 0} onClick={remove}>
            刪除
          </button>
        </div>
      )}
    </div>
  )
}
