import type { ReactNode } from 'react'
import { useEditor } from '../core/store.ts'
import type { EditorMode } from '../core/tool.ts'

// 用 <label> 包住隱藏的 file input：在 iOS 上這是最穩定的開啟相簿方式
// （用程式呼叫 input.click() 在某些情況會被 Safari 擋掉）
export function PickPhotoButton({
  className,
  children,
  label,
  mode,
}: {
  className: string
  children: ReactNode
  label?: string
  /** 選好照片後打開哪個編輯器；不指定就用目前的 */
  mode?: EditorMode
}) {
  const openPhoto = useEditor((s) => s.openPhoto)
  return (
    <label className={className} aria-label={label}>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          // 清空 value，下次選同一張照片也會觸發 onChange
          e.target.value = ''
          if (file) void openPhoto(file, mode ?? useEditor.getState().mode)
        }}
      />
      {children}
    </label>
  )
}
