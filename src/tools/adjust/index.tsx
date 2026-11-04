// 調色工具：亮度、對比、飽和度、自然飽和度、色溫、色調、高光、陰影、褪色、銳化、顆粒、暈影

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
  // 以下是 v0.11 加的；舊版存的參數沒有這幾項，當作 0
  vibrance?: number // -100..100
  highlights?: number // -100..100
  shadows?: number // -100..100
  fade?: number // 0..100
  grain?: number // 0..100
}

type Key = keyof AdjustParams

const ITEMS: { key: Key; label: string; min: number }[] = [
  { key: 'brightness', label: '亮度', min: -100 },
  { key: 'contrast', label: '對比', min: -100 },
  { key: 'saturation', label: '飽和度', min: -100 },
  { key: 'vibrance', label: '自然飽和度', min: -100 },
  { key: 'temperature', label: '色溫', min: -100 },
  { key: 'tint', label: '色調', min: -100 },
  { key: 'highlights', label: '高光', min: -100 },
  { key: 'shadows', label: '陰影', min: -100 },
  { key: 'fade', label: '褪色', min: 0 },
  { key: 'sharpen', label: '銳化', min: 0 },
  { key: 'grain', label: '顆粒', min: 0 },
  { key: 'vignette', label: '暈影', min: 0 },
]

const v = (p: AdjustParams, key: Key) => p[key] ?? 0

const DEFAULTS: AdjustParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  vignette: 0,
  vibrance: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  grain: 0,
}

export const adjustTool = defineTool<AdjustParams>({
  id: 'adjust',
  label: '調色',
  icon: <IconSliders />,
  placement: { beautify: 40 },
  defaultParams: DEFAULTS,
  isIdentity: (p) => ITEMS.every(({ key }) => !v(p, key)),

  steps: (p, ctx) => {
    const steps: GpuStep[] = []
    if (p.brightness || p.contrast || p.saturation || p.temperature || p.tint || v(p, 'vibrance') || v(p, 'highlights') || v(p, 'shadows') || v(p, 'fade')) {
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
            u_vibrance: v(p, 'vibrance') / 100,
            u_highlights: v(p, 'highlights') / 100,
            u_shadows: v(p, 'shadows') / 100,
            u_fade: v(p, 'fade') / 100,
          },
        },
      })
    }
    if (p.sharpen || p.vignette || v(p, 'grain')) {
      steps.push({
        order: ORDER.detail,
        pass: {
          id: 'adjust/detail',
          fragment: detailFragment,
          uniforms: {
            u_sharpen: p.sharpen / 100,
            u_radius: ctx.pixelScale,
            u_vignette: p.vignette / 100,
            u_grain: v(p, 'grain') / 100,
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
          value={v(params, selected)}
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
              {!!v(params, i.key) && <span className="chip-dot" />}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
