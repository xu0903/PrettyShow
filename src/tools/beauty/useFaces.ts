// 面板用：打開時就開始找臉，回傳目前的狀態（美膚、臉部重塑共用）

import { useEffect, useState } from 'react'
import { useEditor } from '../../core/store.ts'
import { detectFaces } from './faces.ts'

export type FaceStatus = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; faces: number }

export function useFaceStatus(): FaceStatus {
  const preview = useEditor((s) => s.photo?.preview)
  const [found, setFound] = useState<{ preview: HTMLCanvasElement; faces: number } | { error: string } | null>(null)

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

  if (found && 'error' in found) return { state: 'error', message: found.error }
  // 換照片後、新結果出來之前，不要顯示上一張的結果
  if (!found || found.preview !== preview) return { state: 'loading' }
  return { state: 'ready', faces: found.faces }
}

export const LOADING_TEXT = '正在找臉…（第一次使用要下載辨識模型，請稍等）'
