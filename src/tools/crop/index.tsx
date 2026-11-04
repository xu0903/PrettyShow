// 裁切工具：裁切框、比例、旋轉、翻轉

import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconCrop, IconFlipH, IconFlipV, IconRotateLeft } from '../../ui/icons.tsx'
import { AspectShape } from './AspectShape.tsx'
import { CropOverlay } from './CropOverlay.tsx'
import {
  aspectRatio,
  DEFAULT_CROP,
  flipHorizontal,
  flipVertical,
  FULL_RECT,
  isIdentityCrop,
  rotatedSize,
  rotateLeft,
  setAspect,
  type AspectId,
  type CropParams,
} from './geometry.ts'
import { cropPass } from './pass.ts'
import './crop.css'

// 用大家熟悉的名字（方格、IG 貼文…），比例數字放在旁邊當提示
const ASPECTS: { id: AspectId; label: string; hint?: string }[] = [
  { id: 'free', label: '自由' },
  { id: 'original', label: '原始' },
  { id: '1:1', label: '方格', hint: '1:1' },
  { id: '4:5', label: 'IG 貼文', hint: '4:5' },
  { id: '3:4', label: 'IG 主頁', hint: '3:4' },
  { id: '9:16', label: 'IG 限動', hint: '9:16' },
  { id: '1.91:1', label: 'IG 橫式', hint: '1.91:1' },
  { id: '16:9', label: '寬螢幕', hint: '16:9' },
]

export const cropTool = defineTool<CropParams>({
  id: 'crop',
  label: '裁切',
  icon: <IconCrop />,
  tabOrder: 30,
  defaultParams: DEFAULT_CROP,
  isIdentity: isIdentityCrop,
  steps: (p) => [{ order: ORDER.geometry, pass: cropPass(p) }],
  // 裁切時顯示整張照片（旋轉、翻轉照樣套用），才能拖動裁切框
  viewParams: (p) => ({ ...p, rect: FULL_RECT }),
  Overlay: CropOverlay,

  Panel: function CropPanel({ params, onCommit }) {
    // 比例計算用原圖尺寸（和預覽圖的比例相同）
    const photo = useEditor((s) => s.photo)
    if (!photo) return null
    const size = { width: photo.width, height: photo.height }
    const display = rotatedSize(size, params.quarter)
    return (
      <div className="crop-panel">
        <div className="crop-actions">
          <button className="crop-action" onClick={() => onCommit(rotateLeft(params, size))}>
            <IconRotateLeft />
            <span>旋轉</span>
          </button>
          <button className="crop-action" onClick={() => onCommit(flipHorizontal(params))}>
            <IconFlipH />
            <span>水平翻轉</span>
          </button>
          <button className="crop-action" onClick={() => onCommit(flipVertical(params))}>
            <IconFlipV />
            <span>垂直翻轉</span>
          </button>
          <button className="crop-action" disabled={isIdentityCrop(params)} onClick={() => onCommit(DEFAULT_CROP)}>
            <span className="crop-reset">重設</span>
          </button>
        </div>
        <div className="chip-row">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              className="chip aspect-chip"
              aria-pressed={params.aspect === a.id}
              onClick={() => onCommit(setAspect(params, a.id, size))}
            >
              <AspectShape ratio={aspectRatio(a.id, display)} />
              <span>{a.label}</span>
              {a.hint && <span className="aspect-hint">{a.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
