// 濾鏡工具：LUT 濾鏡 + 強度

import { useEffect, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconFilter } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { getLoadedLut, loadLut } from './lutCache.ts'
import { lutPass } from './pass.ts'
import { FILTERS } from './presets.ts'
import { FilterThumb } from './FilterThumb.tsx'
import { getFilterThumbs, type FilterThumbs } from './thumbs.ts'
import './filter.css'

export interface FilterParams {
  /** 濾鏡 id；null 代表原圖 */
  lut: string | null
  /** 強度 0..100 */
  intensity: number
}

/** 剛選一款濾鏡時的強度 */
const DEFAULT_INTENSITY = 80

export const filterTool = defineTool<FilterParams>({
  id: 'filter',
  label: '濾鏡',
  icon: <IconFilter />,
  placement: { beautify: 50 },
  defaultParams: { lut: null, intensity: DEFAULT_INTENSITY },
  isIdentity: (p) => p.lut === null || p.intensity === 0,

  prepare: async (p) => {
    if (p.lut) await loadLut(p.lut)
  },

  steps: (p) => {
    const lut = p.lut ? getLoadedLut(p.lut) : undefined
    // LUT 還在下載就先不套，prepare 完成後會再重畫
    if (!p.lut || !lut) return []
    return [{ order: ORDER.filter, pass: lutPass(p.lut, lut, p.intensity / 100) }]
  },

  Panel: function FilterPanel({ params, onChange, onCommit }) {
    const preview = useEditor((s) => s.photo?.preview)
    const [thumbs, setThumbs] = useState<FilterThumbs | null>(null)

    useEffect(() => {
      if (!preview) return
      const task = { alive: true }
      getFilterThumbs(preview)
        .then((t) => task.alive && setThumbs(t))
        .catch((e) => console.warn('濾鏡縮圖產生失敗', e))
      return () => {
        task.alive = false
      }
    }, [preview])

    const choose = (lut: string | null) => {
      // 再點一次已選的濾鏡不做事；換濾鏡時強度回到預設
      if (lut === params.lut) return
      onCommit({ lut, intensity: DEFAULT_INTENSITY })
    }

    return (
      <div className="filter-panel">
        <div className="filter-slider">
          {params.lut ? (
            <Slider
              label="強度"
              value={params.intensity}
              min={0}
              max={100}
              defaultValue={DEFAULT_INTENSITY}
              onChange={(v) => onChange({ ...params, intensity: v })}
              onCommit={(v) => onCommit({ ...params, intensity: v })}
            />
          ) : (
            <p className="filter-hint">選一款濾鏡</p>
          )}
        </div>
        <div className="filter-row">
          <FilterThumb name="原圖" src={thumbs?.original} selected={params.lut === null} onClick={() => choose(null)} />
          {FILTERS.map((f) => (
            <FilterThumb
              key={f.id}
              name={f.name}
              src={thumbs?.byId[f.id]}
              selected={params.lut === f.id}
              onClick={() => choose(f.id)}
            />
          ))}
        </div>
      </div>
    )
  },
})
