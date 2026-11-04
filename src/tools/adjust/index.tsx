// 基本調整工具：亮度、對比、飽和度、色溫、色調、銳化、暈影

import { useState } from 'react'
import { defineTool, ORDER, type GpuStep } from '../../core/tool.ts'
import { IconSliders } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { colorFragment, detailFragment } from './shaders.ts'
import './adjust.css'

export interface AdjustParams {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  temperature: number // -100..100
  tint: number // -100..100
  sharpen: number // 0..100
  vignette: number // 0..100
}

type Key = keyof AdjustParams

const ITEMS: { key: Key; label: string; min: number }[] = [
  { key: 'brightness', label: '亮度', min: -100 },
  { key: 'contrast', label: '對比', min: -100 },
  { key: 'saturation', label: '飽和度', min: -100 },
  { key: 'temperature', label: '色溫', min: -100 },
  { key: 'tint', label: '色調', min: -100 },
  { key: 'sharpen', label: '銳化', min: 0 },
  { key: 'vignette', label: '暈影', min: 0 },
]

const DEFAULTS: AdjustParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  vignette: 0,
}

export const adjustTool = defineTool<AdjustParams>({
  id: 'adjust',
  label: '調整',
  icon: <IconSliders />,
  tabOrder: 10,
  defaultParams: DEFAULTS,
  isIdentity: (p) => ITEMS.every(({ key }) => p[key] === 0),

  steps: (p, ctx) => {
    const steps: GpuStep[] = []
    if (p.brightness || p.contrast || p.saturation || p.temperature || p.tint) {
      steps.push({
        order: ORDER.color,
        pass: {
          id: 'adjust/color',
          fragment: colorFragment,
          uniforms: {
            u_brightness: p.brightness / 100,
            u_contrast: p.contrast / 100,
            u_saturation: p.saturation / 100,
            u_temperature: p.temperature / 100,
            u_tint: p.tint / 100,
          },
        },
      })
    }
    if (p.sharpen || p.vignette) {
      steps.push({
        order: ORDER.detail,
        pass: {
          id: 'adjust/detail',
          fragment: detailFragment,
          uniforms: {
            u_sharpen: p.sharpen / 100,
            u_radius: ctx.pixelScale,
            u_vignette: p.vignette / 100,
          },
        },
      })
    }
    return steps
  },

  Panel: function AdjustPanel({ params, onChange, onCommit }) {
    const [selected, setSelected] = useState<Key>('brightness')
    const item = ITEMS.find((i) => i.key === selected)!
    return (
      <div className="adjust-panel">
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
              {/* 有調整過的項目加一個小圓點 */}
              {params[i.key] !== 0 && <span className="chip-dot" />}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
