// 美妝：口紅、腮紅、眉毛、眼影，或一次套用整組妝容

import { useState } from 'react'
import { defineTool, ORDER } from '../../core/tool.ts'
import { IconLipstick } from '../../ui/icons.tsx'
import { ColorRow } from '../../ui/ColorRow.tsx'
import { colorName } from '../../ui/colors.ts'
import { Slider } from '../../ui/Slider.tsx'
import { detectFaces } from '../beauty/faces.ts'
import { LOADING_TEXT, useFaceStatus } from '../beauty/useFaces.ts'
import { colorKey, LOOKS, matchLook, NO_MAKEUP, PARTS, type MakeupParams, type Part } from './looks.ts'
import { getRegions, hexToRgb } from './regions.ts'
import { makeupFragment } from './shaders.ts'
import '../beauty/beauty.css'
import '../brush/brush.css'

/** 選了顏色但強度是 0 時，自動給這個強度 */
const PICK_AMOUNT = 50

const uniform = (color: string, amount: number) => [...hexToRgb(color), amount / 100]
const isClear = (p: MakeupParams) => !p.lip && !p.blush && !p.brow && !p.shadow

export const makeupTool = defineTool<MakeupParams>({
  id: 'makeup',
  label: '美妝',
  icon: <IconLipstick />,
  placement: { portrait: 70 },
  defaultParams: NO_MAKEUP,
  isIdentity: isClear,

  prepare: async (_p, ctx) => {
    if (ctx.photo) await detectFaces(ctx.photo.preview)
  },

  steps: (p, ctx) => {
    const regions = ctx.photo && getRegions(ctx.photo.preview)
    if (!regions) return []
    return [
      {
        order: ORDER.retouch + 2,
        pass: {
          id: 'makeup',
          fragment: makeupFragment,
          uniforms: {
            u_lip: uniform(p.lipColor, p.lip),
            u_lipBlur: p.lipBlur ? 1 : 0,
            u_blush: uniform(p.blushColor, p.blush),
            u_brow: uniform(p.browColor, p.brow),
            u_shadow: uniform(p.shadowColor, p.shadow),
          },
          textures: { u_regions: regions.makeup, u_features: regions.features },
        },
      },
    ]
  },

  Panel: function MakeupPanel({ params, onChange, onCommit }) {
    const [part, setPart] = useState<Part>('lip')
    const status = useFaceStatus()
    if (status.state === 'error') return <p className="beauty-status">{status.message}</p>
    if (status.state === 'loading') return <p className="beauty-status">{LOADING_TEXT}</p>
    if (status.faces === 0) return <p className="beauty-status">這張照片裡找不到臉</p>

    const info = PARTS.find((x) => x.key === part)!
    const look = matchLook(params)
    const withColor = (c: string) => ({ ...params, [colorKey(part)]: c, [part]: params[part] || PICK_AMOUNT })
    const color = params[colorKey(part)]

    return (
      <div className="beauty-panel">
        <div className="chip-row">
          <button className="chip" aria-pressed={isClear(params)} onClick={() => onCommit(NO_MAKEUP)}>
            無
          </button>
          {LOOKS.map((l) => (
            <button key={l.id} className="chip" aria-pressed={look === l.id} onClick={() => onCommit(l.params)}>
              {l.label}
            </button>
          ))}
        </div>
        <Slider
          label={info.label}
          value={params[part]}
          min={0}
          max={100}
          onChange={(v) => onChange({ ...params, [part]: v })}
          onCommit={(v) => onCommit({ ...params, [part]: v })}
        />
        <ColorRow
          colors={info.colors}
          value={params[part] > 0 ? color : null}
          onPick={(c) => onCommit(withColor(c))}
          onPreview={(c) => onChange(withColor(c))}
        />
        <div className="makeup-info">
          <span>{params[part] > 0 ? colorName(info.colors, color) : '選一個顏色'}</span>
          {part === 'lip' && (
            <div className="seg seg-small">
              <button className="seg-btn" aria-pressed={!!params.lipBlur} onClick={() => onCommit({ ...params, lipBlur: true })}>
                暈染
              </button>
              <button className="seg-btn" aria-pressed={!params.lipBlur} onClick={() => onCommit({ ...params, lipBlur: false })}>
                滿塗
              </button>
            </div>
          )}
        </div>
        <div className="chip-row">
          {PARTS.map((x) => (
            <button key={x.key} className="chip" aria-pressed={x.key === part} onClick={() => setPart(x.key)}>
              {x.label}
              {params[x.key] !== 0 && <span className="chip-dot" />}
            </button>
          ))}
        </div>
      </div>
    )
  },
})
