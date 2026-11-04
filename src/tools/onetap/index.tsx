// 一鍵美顏：選一個風格，一次設定好美膚、臉型、亮眼、美妝；強度滑桿等比例調整全部。
// 本身不產生任何效果，只是幫其他工具填好參數，之後仍可以進各工具微調。

import { paramsOf } from '../../core/pipeline.ts'
import { getTool } from '../../core/registry.ts'
import { useEditor } from '../../core/store.ts'
import { defineTool } from '../../core/tool.ts'
import { IconWand } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import type { BeautyParams } from '../beauty/index.tsx'
import type { EyesParams } from '../features/index.tsx'
import { LOOKS, NO_MAKEUP, type MakeupParams } from '../makeup/looks.ts'
import { DEFAULT_RESHAPE, type ReshapeParams } from '../reshape/ops.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'

export interface OneTapParams {
  preset: string | null
  amount: number // 0..100
}

interface Preset {
  id: string
  label: string
  beauty: Pick<BeautyParams, 'smooth' | 'whiten'>
  reshape: Partial<ReshapeParams>
  eyes: EyesParams
  /** 套用哪一組妝容（乘上強度） */
  look: string | null
  makeupScale: number
}

const PRESETS: Preset[] = [
  { id: 'natural', label: '自然', beauty: { smooth: 35, whiten: 15 }, reshape: { slim: 15, eyes: 10 }, eyes: { bright: 15, dark: 20 }, look: 'natural', makeupScale: 0.6 },
  { id: 'refined', label: '精緻', beauty: { smooth: 50, whiten: 25 }, reshape: { slim: 30, eyes: 25, nose: 10 }, eyes: { bright: 25, dark: 35 }, look: 'korean', makeupScale: 0.7 },
  { id: 'goddess', label: '女神', beauty: { smooth: 60, whiten: 35 }, reshape: { slim: 40, eyes: 35, nose: 20, chin: 10 }, eyes: { bright: 30, dark: 40 }, look: 'korean', makeupScale: 1 },
  { id: 'genki', label: '元氣', beauty: { smooth: 45, whiten: 25 }, reshape: { slim: 25, eyes: 30 }, eyes: { bright: 30, dark: 30 }, look: 'japanese', makeupScale: 0.9 },
  { id: 'boy', label: '少年感', beauty: { smooth: 40, whiten: 10 }, reshape: { slim: 20, eyes: 10 }, eyes: { bright: 20, dark: 35 }, look: null, makeupScale: 0 },
]

const DEFAULT_AMOUNT = 80

/** 依風格和強度算出要寫進各工具的參數 */
function patchFor(preset: Preset | null, amount: number): Record<string, unknown> {
  const state = useEditor.getState().history.present
  const current = <P,>(id: string) => paramsOf(state, getTool(id)!) as P
  const k = amount / 100
  const scale = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).map(([key, v]) => [key, Math.round((v as number) * k)])) as T

  const beauty = current<BeautyParams>('beauty')
  const reshape = current<ReshapeParams>('reshape')
  const look = preset?.look ? LOOKS.find((l) => l.id === preset.look)!.params : NO_MAKEUP
  const m = (preset?.makeupScale ?? 0) * k
  const makeup: MakeupParams = {
    ...look,
    lip: Math.round(look.lip * m),
    blush: Math.round(look.blush * m),
    brow: Math.round(look.brow * m),
    shadow: Math.round(look.shadow * m),
  }

  return {
    onetap: { preset: preset?.id ?? null, amount },
    beauty: { ...beauty, ...(preset ? scale(preset.beauty) : { smooth: 0, whiten: 0 }) },
    reshape: preset ? { ...reshape, ...DEFAULT_RESHAPE, ...scale(preset.reshape) } : { ...reshape, ...DEFAULT_RESHAPE },
    eyes: preset ? scale(preset.eyes) : { bright: 0, dark: 0 },
    makeup,
  }
}

export const oneTapTool = defineTool<OneTapParams>({
  id: 'onetap',
  label: '一鍵美顏',
  icon: <IconWand />,
  placement: { portrait: 20 },
  defaultParams: { preset: null, amount: DEFAULT_AMOUNT },
  // 自己沒有效果；效果都在被設定的那些工具裡
  isIdentity: () => true,

  Panel: function OneTapPanel({ params }) {
    const previewPatch = useEditor((s) => s.previewPatch)
    const commitPatch = useEditor((s) => s.commitPatch)
    const preset = PRESETS.find((p) => p.id === params.preset) ?? null
    return (
      <div className="beauty-panel">
        {preset && (
          <Slider
            label="強度"
            value={params.amount}
            min={0}
            max={100}
            defaultValue={DEFAULT_AMOUNT}
            onChange={(v) => previewPatch(patchFor(preset, v))}
            onCommit={(v) => commitPatch(patchFor(preset, v))}
          />
        )}
        <div className="chip-row">
          <button className="chip" aria-pressed={!preset} onClick={() => commitPatch(patchFor(null, params.amount))}>
            原圖
          </button>
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={preset?.id === p.id} onClick={() => commitPatch(patchFor(p, params.amount))}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="brush-hint">一次調好美膚、臉型、亮眼、美妝，之後可以再進各工具微調</p>
      </div>
    )
  },
})
