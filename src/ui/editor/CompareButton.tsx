import { useEditor } from '../../core/store.ts'
import { IconCompare } from '../icons.tsx'

// 照片右下角：按住看原圖（裁切時照片上的長按會拖到裁切框，用這個按鈕比較方便）
export function CompareButton() {
  const hasPhoto = useEditor((s) => s.photo !== null)
  const setComparing = useEditor((s) => s.setComparing)
  if (!hasPhoto) return null
  const off = () => setComparing(false)
  return (
    <button
      className="compare-btn"
      aria-label="按住看原圖"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setComparing(true)
      }}
      onPointerUp={off}
      onPointerCancel={off}
      onContextMenu={(e) => e.preventDefault()}
    >
      <IconCompare />
    </button>
  )
}
