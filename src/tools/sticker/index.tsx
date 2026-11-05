// 貼紙：用 iPhone 內建的彩色 emoji，不用另外下載圖片；可以拖動、放大、旋轉

import { useState } from 'react'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconSticker } from '../../ui/icons.tsx'
import { createLayersOverlay } from '../layers/LayersOverlay.tsx'
import { LAYER_FRAGMENT, layersTexture, newId, type StickerLayer } from '../layers/layers.ts'
import { select, useSelection } from '../layers/selection.ts'
import '../beauty/beauty.css'

export interface StickerParams {
  layers: StickerLayer[]
}

const GROUPS: { label: string; items: string[] }[] = [
  { label: '熱門', items: ['✨', '💖', '🌸', '🎀', '⭐', '🌈', '☁️', '🔥', '💫', '🫧', '🤍', '🩷', '💕', '🌷', '🍀', '👑'] },
  { label: '表情', items: ['😍', '🥰', '😘', '😎', '🤪', '😝', '🙈', '🥺', '😆', '🤭', '😴', '🫶', '✌️', '👍', '🙏', '💯'] },
  { label: '動物', items: ['🐰', '🐱', '🐶', '🐻', '🐥', '🦋', '🐼', '🐨', '🦊', '🐹', '🐧', '🦄', '🐳', '🐟', '🐝', '🐞'] },
  { label: '美食', items: ['🍰', '🧋', '🍩', '🍓', '🍑', '🍦', '🧁', '🍪', '🍫', '🍒', '🥐', '🍜', '🍣', '🍔', '🍕', '☕'] },
  { label: '生活', items: ['📷', '🎧', '🎂', '🎈', '🎁', '💌', '🌙', '☀️', '🌊', '🏖️', '✈️', '🎄', '🎉', '💐', '🕯️', '📍'] },
]

export const stickerTool = defineTool<StickerParams>({
  id: 'sticker',
  label: '貼紙',
  icon: <IconSticker />,
  placement: { beautify: 70 },
  defaultParams: { layers: [] },
  isIdentity: (p) => p.layers.length === 0,

  steps: (p) => [
    {
      // 排在文字後面一點：同時有貼紙和文字時，文字蓋在貼紙上
      order: ORDER.overlay - 1,
      pass: {
        id: 'layers/sticker',
        fragment: LAYER_FRAGMENT,
        texturesFor: (size) => ({ u_layers: layersTexture('sticker', p.layers, size, true) }),
      },
    },
  ],

  Overlay: createLayersOverlay<StickerParams>({
    read: (p) => p.layers,
    write: (p, layers) => ({ ...p, layers: layers as StickerLayer[] }),
  }),

  Panel: function StickerPanel({ params, onCommit }) {
    const [group, setGroup] = useState(0)
    const selected = useSelection((s) => s.selected)

    const add = (emoji: string) => {
      // 連續加好幾個時稍微錯開，才不會疊在一起看不到
      const n = params.layers.length % 5
      const l: StickerLayer = { kind: 'sticker', id: newId(), emoji, x: 0.5 + (n - 2) * 0.06, y: 0.45 + (n % 2) * 0.06, size: 0.18, rot: 0 }
      onCommit({ ...params, layers: [...params.layers, l] })
      select(l.id)
    }

    return (
      <div className="layers-panel">
        <div className="chip-row">
          {GROUPS.map((g, i) => (
            <button key={g.label} className="chip" aria-pressed={i === group} onClick={() => setGroup(i)}>
              {g.label}
            </button>
          ))}
          {selected && params.layers.some((l) => l.id === selected) && (
            <span className="beauty-count">拖右下角放大旋轉</span>
          )}
        </div>
        <div className="sticker-grid">
          {GROUPS[group].items.map((e) => (
            <button key={e} className="sticker-btn" onClick={() => add(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
