// 美髮：換髮色。自動找出頭髮，保留髮絲的明暗只換顏色

import { useEffect, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconHair } from '../../ui/icons.tsx'
import { ColorRow } from '../../ui/ColorRow.tsx'
import { colorName, type NamedColor } from '../../ui/colors.ts'
import { Slider } from '../../ui/Slider.tsx'
import { hexToRgb } from '../makeup/regions.ts'
import { hairFragment } from '../makeup/shaders.ts'
import { getSegment, HAIR_MODEL, segment } from '../segment/segmenter.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'

export interface HairParams {
  color: string
  amount: number // 0..100
}

const COLORS: NamedColor[] = [
  { color: '#a67b5b', label: '奶茶棕' },
  { color: '#5b3a29', label: '黑茶' },
  { color: '#8a8d91', label: '霧感灰' },
  { color: '#c9a66b', label: '亞麻金' },
  { color: '#7b2d3a', label: '酒紅' },
  { color: '#d98aa5', label: '粉紅' },
  { color: '#2b3550', label: '藍黑' },
  { color: '#6b4c8a', label: '紫色' },
]

/** 選了顏色但強度是 0 時，自動給這個強度 */
const PICK_AMOUNT = 60

export const hairTool = defineTool<HairParams>({
  id: 'hair',
  label: '美髮',
  icon: <IconHair />,
  placement: { portrait: 120 },
  defaultParams: { color: COLORS[0].color, amount: 0 },
  isIdentity: (p) => !p.amount,

  prepare: async (_p, ctx) => {
    if (ctx.photo) await segment(HAIR_MODEL, ctx.photo.preview)
  },

  steps: (p, ctx) => {
    const hair = ctx.photo && getSegment(HAIR_MODEL, ctx.photo.preview)
    if (!hair?.mask) return []
    return [
      {
        // 在磨皮、美妝之後
        order: ORDER.retouch + 4,
        pass: {
          id: 'hair',
          fragment: hairFragment,
          uniforms: { u_color: [...hexToRgb(p.color), p.amount / 100] },
          textures: { u_hair: hair.mask },
        },
      },
    ]
  },

  Panel: function HairPanel({ params, onChange, onCommit }) {
    const preview = useEditor((s) => s.photo?.preview)
    const [found, setFound] = useState<{ preview: HTMLCanvasElement; ok: boolean } | { error: string } | null>(null)

    useEffect(() => {
      if (!preview) return
      const task = { alive: true }
      segment(HAIR_MODEL, preview)
        .then((d) => task.alive && setFound({ preview, ok: !!d.mask }))
        .catch((e: unknown) => {
          console.warn('頭髮辨識失敗', e)
          if (task.alive) setFound({ error: '頭髮辨識載入失敗，請確認網路後再打開一次' })
        })
      return () => {
        task.alive = false
      }
    }, [preview])

    if (found && 'error' in found) return <p className="beauty-status">{found.error}</p>
    if (!found || found.preview !== preview) return <p className="beauty-status">正在找頭髮…</p>
    if (!found.ok) return <p className="beauty-status">這張照片裡找不到頭髮</p>

    const withColor = (color: string) => ({ color, amount: params.amount || PICK_AMOUNT })
    return (
      <div className="beauty-panel">
        <Slider
          label="髮色強度"
          value={params.amount}
          min={0}
          max={100}
          onChange={(v) => onChange({ ...params, amount: v })}
          onCommit={(v) => onCommit({ ...params, amount: v })}
        />
        <ColorRow
          colors={COLORS}
          value={params.amount > 0 ? params.color : null}
          onPick={(c) => onCommit(withColor(c))}
          onPreview={(c) => onChange(withColor(c))}
        />
        <p className="brush-hint">{params.amount > 0 ? `目前：${colorName(COLORS, params.color)}` : '選一個顏色開始染髮，最後的 ＋ 可以自己挑顏色'}</p>
      </div>
    )
  },
})
