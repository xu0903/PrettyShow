// 臉部重塑：瘦臉、大眼、瘦鼻、下巴、額頭、嘴型。照片裡每張臉都會套用

import { useState } from 'react'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconFaceShape } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { detectFaces, getFaceData } from '../beauty/faces.ts'
import { LOADING_TEXT, useFaceStatus } from '../beauty/useFaces.ts'
import { warpSteps } from '../warp/warp.ts'
import { DEFAULT_RESHAPE, faceOps, type ReshapeParams } from './ops.ts'
import '../beauty/beauty.css'

type Key = keyof ReshapeParams

const ITEMS: { key: Key; label: string; min: number }[] = [
  { key: 'slim', label: '瘦臉', min: 0 },
  { key: 'eyes', label: '大眼', min: 0 },
  { key: 'nose', label: '瘦鼻', min: 0 },
  { key: 'chin', label: '下巴', min: -100 },
  { key: 'forehead', label: '額頭', min: -100 },
  { key: 'mouth', label: '嘴型', min: -100 },
]

export const reshapeTool = defineTool<ReshapeParams>({
  id: 'reshape',
  label: '臉部重塑',
  icon: <IconFaceShape />,
  placement: { portrait: 50 },
  defaultParams: DEFAULT_RESHAPE,
  isIdentity: (p) => ITEMS.every(({ key }) => !p[key]),

  prepare: async (_p, ctx) => {
    if (ctx.photo) await detectFaces(ctx.photo.preview)
  },

  steps: (p, ctx) => {
    const face = ctx.photo && getFaceData(ctx.photo.preview)
    if (!ctx.photo || !face || face.faces.length === 0) return []
    const { width, height } = ctx.photo
    return warpSteps(
      face.faces.flatMap((f) => faceOps(f, width, height, p)),
      ORDER.reshape,
    )
  },

  Panel: function ReshapePanel({ params, onChange, onCommit }) {
    const [selected, setSelected] = useState<Key>('slim')
    const status = useFaceStatus()
    if (status.state === 'error') return <p className="beauty-status">{status.message}</p>
    if (status.state === 'loading') return <p className="beauty-status">{LOADING_TEXT}</p>
    if (status.faces === 0) return <p className="beauty-status">這張照片裡找不到臉，可以改用「瘦臉瘦身」用手指推</p>

    const item = ITEMS.find((i) => i.key === selected)!
    return (
      <div className="beauty-panel">
        <Slider
          label={item.label}
          value={params[selected]}
          min={item.min}
          max={100}
          onChange={(v) => onChange({ ...params, [selected]: v })}
          onCommit={(v) => onCommit({ ...params, [selected]: v })}
        />
        <div className="chip-row">
          {ITEMS.map((i) => (
            <button key={i.key} className="chip" aria-pressed={i.key === selected} onClick={() => setSelected(i.key)}>
              {i.label}
              {params[i.key] !== 0 && <span className="chip-dot" />}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
