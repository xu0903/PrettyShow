// 美膚的兩種面板：自動（找臉、滑桿）和手動（筆刷）

import { useEffect, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { Slider } from '../../ui/Slider.tsx'
import { BrushControls } from '../brush/BrushControls.tsx'
import { detectFaces } from './faces.ts'
import type { BeautyParams } from './index.tsx'
import { ITEMS, useUi, type Kind } from './ui.ts'

export function ManualPanel() {
  const kind = useUi((s) => s.kind)
  return (
    <>
      <div className="chip-row">
        {ITEMS.map((i) => (
          <button key={i.key} className="chip" aria-pressed={kind === i.key} onClick={() => useUi.setState({ kind: i.key })}>
            {i.label}筆
          </button>
        ))}
        <span className="beauty-count">用手指塗抹要{kind === 'smooth' ? '磨皮' : '美白'}的地方</span>
      </div>
      <BrushControls />
    </>
  )
}

export function AutoPanel({
  params,
  onChange,
  onCommit,
}: {
  params: BeautyParams
  onChange: (p: BeautyParams) => void
  onCommit: (p: BeautyParams) => void
}) {
  const preview = useEditor((s) => s.photo?.preview)
  const [selected, setSelected] = useState<Kind>('smooth')
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
  if (faces === 0)
    return (
      <p className="beauty-status">
        這張照片裡找不到臉，
        <button className="link-btn" onClick={() => useUi.setState({ manual: true })}>
          改用手動
        </button>
      </p>
    )

  const item = ITEMS.find((i) => i.key === selected)!
  return (
    <>
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
    </>
  )
}
