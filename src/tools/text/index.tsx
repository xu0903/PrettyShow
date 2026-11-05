// 文字：在照片上加字，可以選顏色、字型（黑體、明體、粉圓、文楷）、樣式（純文字、描邊、底色標籤）

import { useState } from 'react'
import { defineTool, ORDER } from '../../core/tool.ts'
import { ColorRow } from '../../ui/ColorRow.tsx'
import type { NamedColor } from '../../ui/colors.ts'
import { IconText } from '../../ui/icons.tsx'
import { ensureFonts, fontsReady } from '../layers/fonts.ts'
import { createLayersOverlay } from '../layers/LayersOverlay.tsx'
import { FONTS, LAYER_FRAGMENT, layersTexture, newId, type TextLayer, type TextStyle } from '../layers/layers.ts'
import { select, useSelection } from '../layers/selection.ts'

export interface TextParams {
  layers: TextLayer[]
}

const COLORS: NamedColor[] = [
  { color: '#ffffff', label: '白' },
  { color: '#111111', label: '黑' },
  { color: '#ff2f55', label: '紅' },
  { color: '#ff8fab', label: '粉' },
  { color: '#ffb84d', label: '橘' },
  { color: '#ffe066', label: '黃' },
  { color: '#8fd19e', label: '綠' },
  { color: '#7cc4f2', label: '藍' },
  { color: '#b39ddb', label: '紫' },
]

const STYLES: { id: TextStyle; label: string }[] = [
  { id: 'plain', label: '純文字' },
  { id: 'outline', label: '描邊' },
  { id: 'label', label: '底色' },
]

const usedFonts = (layers: readonly TextLayer[]) => [...new Set(layers.map((l) => l.font))]
const allText = (layers: readonly TextLayer[]) => layers.map((l) => l.text).join('')

export const textTool = defineTool<TextParams>({
  id: 'text',
  label: '文字',
  icon: <IconText />,
  placement: { beautify: 60 },
  defaultParams: { layers: [] },
  isIdentity: (p) => p.layers.length === 0,

  // 網路字型要先下載（只下載用到的字）
  prepare: async (p) => ensureFonts(usedFonts(p.layers), allText(p.layers)),

  steps: (p) => {
    const ready = fontsReady(usedFonts(p.layers), allText(p.layers))
    return [
      {
        order: ORDER.overlay,
        pass: {
          id: 'layers/text',
          fragment: LAYER_FRAGMENT,
          // 依最後輸出的尺寸畫字，字才不會被拉長，匯出原圖時也清楚
          texturesFor: (size) => ({ u_layers: layersTexture('text', p.layers, size, ready) }),
        },
      },
    ]
  },

  Overlay: createLayersOverlay<TextParams>({
    read: (p) => p.layers,
    write: (p, layers) => ({ ...p, layers: layers as TextLayer[] }),
  }),

  Panel: function TextPanel({ params, onChange, onCommit }) {
    const selected = useSelection((s) => s.selected)
    const layer = params.layers.find((l) => l.id === selected)
    // 輸入中的文字：打字時只更新預覽，離開輸入框才寫入一筆復原紀錄（記下是哪一個物件的）
    const [typing, setTyping] = useState<{ id: string; text: string } | null>(null)
    const draft = typing && typing.id === layer?.id ? typing.text : null

    const update = (patch: Partial<TextLayer>, commit = true) => {
      if (!layer) return
      const next = { ...params, layers: params.layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l)) }
      if (commit) onCommit(next)
      else onChange(next)
    }

    const add = () => {
      const l: TextLayer = {
        kind: 'text',
        id: newId(),
        text: '輸入文字',
        x: 0.5,
        y: 0.5,
        size: 0.08,
        rot: 0,
        color: '#ffffff',
        font: 'sans',
        style: 'outline',
      }
      onCommit({ ...params, layers: [...params.layers, l] })
      select(l.id)
    }

    if (!layer)
      return (
        <div className="layers-panel">
          <div className="layers-empty">
            <button className="layers-add" onClick={add}>
              ＋ 新增文字
            </button>
            <span>{params.layers.length ? '點照片上的文字可以修改、拖動；拖右下角放大旋轉' : '新增後可以拖動、放大、旋轉'}</span>
          </div>
        </div>
      )

    return (
      <div className="layers-panel">
        <div className="text-input-row">
          <input
            className="text-input"
            value={draft ?? layer.text}
            placeholder="輸入文字"
            onChange={(e) => {
              setTyping({ id: layer.id, text: e.target.value })
              update({ text: e.target.value }, false)
            }}
            onBlur={() => {
              if (draft !== null) update({ text: draft || ' ' })
              setTyping(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <button onClick={add}>＋ 新增</button>
        </div>
        <ColorRow colors={COLORS} value={layer.color} onPick={(c) => update({ color: c })} onPreview={(c) => update({ color: c }, false)} />
        <div className="chip-row">
          {FONTS.map((f) => (
            <button key={f.id} className="chip" style={{ fontFamily: f.css }} aria-pressed={layer.font === f.id} onClick={() => update({ font: f.id })}>
              {f.label}
            </button>
          ))}
          {STYLES.map((s) => (
            <button key={s.id} className="chip" aria-pressed={layer.style === s.id} onClick={() => update({ style: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
