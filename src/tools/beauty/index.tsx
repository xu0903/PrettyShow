// 美顏工具：磨皮、美白（之後再加瘦臉、大眼）

import { useEffect, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { defineTool, ORDER, type GpuStep } from '../../core/tool.ts'
import { copyPass, type RenderPass } from '../../gl/pass.ts'
import { IconFace } from '../../ui/icons.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { detectFaces, getFaceData } from './faces.ts'
import { bilateralFragment, smoothMixFragment, whitenOnlyFragment } from './shaders.ts'
import './beauty.css'

export interface BeautyParams {
  smooth: number // 磨皮 0..100
  whiten: number // 美白 0..100
}

type Key = keyof BeautyParams

const ITEMS: { key: Key; label: string }[] = [
  { key: 'smooth', label: '磨皮' },
  { key: 'whiten', label: '美白' },
]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const beautyTool = defineTool<BeautyParams>({
  id: 'beauty',
  label: '美膚',
  icon: <IconFace />,
  placement: { portrait: 30 },
  defaultParams: { smooth: 0, whiten: 0 },
  isIdentity: (p) => p.smooth === 0 && p.whiten === 0,

  prepare: async (_p, ctx) => {
    if (ctx.photo) await detectFaces(ctx.photo.preview)
  },

  steps: (p, ctx) => {
    const face = ctx.photo && getFaceData(ctx.photo.preview)
    // 還沒偵測完或沒有臉：先不套，prepare 完成後會再重畫
    if (!face?.mask) return []
    const mask = face.mask
    const smooth = p.smooth / 100
    const whiten = p.whiten / 100
    const step = (pass: RenderPass): GpuStep => ({ order: ORDER.retouch, pass })

    if (smooth === 0) {
      return [
        step({
          id: 'beauty/whiten',
          fragment: whitenOnlyFragment,
          uniforms: { u_smooth: 0, u_whiten: whiten },
          textures: { u_mask: mask },
        }),
      ]
    }

    // 半徑跟著臉的大小：臉越大，要抹平的痘痘、毛孔也越大
    const radius = clamp(face.faceWidthPx * 0.03, 2, 40) * ctx.pixelScale
    // 強度越高，「顏色相近」的範圍越寬，抹得越平
    const sigma = 0.04 + 0.08 * smooth
    const blur = (id: string, dir: [number, number]) =>
      step({
        id,
        fragment: bilateralFragment,
        uniforms: { u_dir: dir, u_radius: radius, u_sigma: sigma },
        textures: { u_mask: mask },
      })
    return [
      // 先留一份磨皮前的畫面，最後依遮罩混回去
      step({ ...copyPass, id: 'beauty/base' }),
      blur('beauty/blur-h', [1, 0]),
      blur('beauty/blur-v', [0, 1]),
      step({
        id: 'beauty/mix',
        fragment: smoothMixFragment,
        uniforms: { u_smooth: smooth, u_whiten: whiten },
        textures: { u_mask: mask },
        inputs: { u_base: 'beauty/base' },
      }),
    ]
  },

  Panel: function BeautyPanel({ params, onChange, onCommit }) {
    const preview = useEditor((s) => s.photo?.preview)
    const [selected, setSelected] = useState<Key>('smooth')
    const [found, setFound] = useState<{ preview: HTMLCanvasElement; faces: number } | { error: string } | null>(null)

    // 面板一打開就開始找臉，拖滑桿時才不用等
    useEffect(() => {
      if (!preview) return
      const task = { alive: true }
      detectFaces(preview)
        .then((d) => task.alive && setFound({ preview, faces: d.faces.length }))
        .catch((e: unknown) => {
          console.warn('臉部偵測失敗', e)
          if (task.alive) setFound({ error: '臉部辨識載入失敗，請確認網路後再打開一次' })
        })
      return () => {
        task.alive = false
      }
    }, [preview])

    if (found && 'error' in found) return <p className="beauty-status">{found.error}</p>
    const faces = found && found.preview === preview ? found.faces : null
    if (faces === null) return <p className="beauty-status">正在找臉…（第一次使用要下載辨識模型，請稍等）</p>
    if (faces === 0) return <p className="beauty-status">這張照片裡找不到臉</p>

    const item = ITEMS.find((i) => i.key === selected)!
    return (
      <div className="beauty-panel">
        <Slider
          label={item.label}
          value={params[selected]}
          min={0}
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
          <span className="beauty-count">找到 {faces} 張臉</span>
        </div>
      </div>
    )
  },
})
