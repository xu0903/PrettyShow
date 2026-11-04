// 亮眼（含去黑眼圈）和白牙：都用五官部位的遮罩，共用同一個 shader

import { useState } from 'react'
import { defineTool, ORDER, type PassContext } from '../../core/tool.ts'
import { IconEye, IconTooth } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { detectFaces } from '../beauty/faces.ts'
import { FaceGate } from '../beauty/FaceGate.tsx'
import { getRegions } from '../makeup/regions.ts'
import { featuresFragment } from '../makeup/shaders.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'

const prepare = async (_p: unknown, ctx: { photo?: { preview: HTMLCanvasElement } }) => {
  if (ctx.photo) await detectFaces(ctx.photo.preview)
}

function featurePass(id: string, ctx: PassContext, u: { bright?: number; dark?: number; teeth?: number }) {
  const regions = ctx.photo && getRegions(ctx.photo.preview)
  if (!regions) return []
  return [
    {
      order: ORDER.retouch + 3,
      pass: {
        id,
        fragment: featuresFragment,
        uniforms: { u_bright: u.bright ?? 0, u_dark: u.dark ?? 0, u_teeth: u.teeth ?? 0 },
        textures: { u_regions: regions.features },
      },
    },
  ]
}

export interface EyesParams {
  bright: number // 亮眼 0..100
  dark: number // 去黑眼圈 0..100
}

const EYE_ITEMS: { key: keyof EyesParams; label: string }[] = [
  { key: 'bright', label: '亮眼' },
  { key: 'dark', label: '黑眼圈' },
]

export const eyesTool = defineTool<EyesParams>({
  id: 'eyes',
  label: '亮眼',
  icon: <IconEye />,
  placement: { portrait: 80 },
  defaultParams: { bright: 0, dark: 0 },
  isIdentity: (p) => !p.bright && !p.dark,
  prepare,
  steps: (p, ctx) => featurePass('features/eyes', ctx, { bright: p.bright / 100, dark: p.dark / 100 }),

  Panel: function EyesPanel({ params, onChange, onCommit }) {
    const [key, setKey] = useState<keyof EyesParams>('bright')
    const item = EYE_ITEMS.find((i) => i.key === key)!
    return (
      <FaceGate>
        <div className="beauty-panel">
          <Slider
            label={item.label}
            value={params[key]}
            min={0}
            max={100}
            onChange={(v) => onChange({ ...params, [key]: v })}
            onCommit={(v) => onCommit({ ...params, [key]: v })}
          />
          <div className="chip-row">
            {EYE_ITEMS.map((i) => (
              <button key={i.key} className="chip" aria-pressed={i.key === key} onClick={() => setKey(i.key)}>
                {i.label}
                {params[i.key] !== 0 && <span className="chip-dot" />}
              </button>
            ))}
          </div>
        </div>
      </FaceGate>
    )
  },
})

export interface TeethParams {
  amount: number // 0..100
}

export const teethTool = defineTool<TeethParams>({
  id: 'teeth',
  label: '白牙',
  icon: <IconTooth />,
  placement: { portrait: 90 },
  defaultParams: { amount: 0 },
  isIdentity: (p) => !p.amount,
  prepare,
  steps: (p, ctx) => featurePass('features/teeth', ctx, { teeth: p.amount / 100 }),

  Panel: function TeethPanel({ params, onChange, onCommit }) {
    return (
      <FaceGate>
        <div className="beauty-panel">
          <Slider
            label="白牙"
            value={params.amount}
            min={0}
            max={100}
            onChange={(v) => onChange({ amount: v })}
            onCommit={(v) => onCommit({ amount: v })}
          />
          <p className="brush-hint">只會處理嘴巴裡的牙齒，嘴唇和皮膚不受影響</p>
        </div>
      </FaceGate>
    )
  },
})
