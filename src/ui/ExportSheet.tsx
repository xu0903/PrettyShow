import { useEffect, useState } from 'react'
import { canShareFile, downloadFile, shareFile, type ExportResult } from '../core/export.ts'

type Job = { status: 'working' } | { status: 'done'; result: ExportResult } | { status: 'error'; message: string }

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)

// 匯出面板：先在背景用原圖解析度算好，再讓使用者按一下叫出分享選單。
// 分成兩步是因為 iOS 只允許在「點擊的當下」叫出分享選單，算圖的時間太長會被擋掉。
export function ExportSheet({ job, onClose }: { job: Promise<ExportResult>; onClose: () => void }) {
  const [state, setState] = useState<Job>({ status: 'working' })
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    const task = { alive: true }
    job.then(
      (result) => task.alive && setState({ status: 'done', result }),
      (e: unknown) => task.alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      task.alive = false
    }
  }, [job])

  const working = state.status === 'working'
  const result = state.status === 'done' ? state.result : null
  const shareable = result ? canShareFile(result.file) : false

  const share = () => {
    if (!result) return
    setShareError(null)
    shareFile(result.file).catch((e: unknown) => {
      setShareError(e instanceof Error ? e.message : '無法打開分享選單')
    })
  }

  return (
    // 算圖時不能點背景關掉，避免以為已經存好了
    <div className="sheet-backdrop" onClick={working ? undefined : onClose}>
      <section className="sheet export-sheet" role="dialog" aria-label="匯出" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">匯出照片</h2>

        <div className="export-preview">
          {result ? <img src={result.url} alt="匯出結果" /> : working ? <div className="export-spinner" /> : null}
        </div>

        {working && <p className="export-info">正在用原圖解析度處理…</p>}
        {state.status === 'error' && <p className="export-error">{state.message}</p>}
        {result && (
          <p className="export-info">
            {result.width} × {result.height}・{formatBytes(result.file.size)}・JPEG
          </p>
        )}

        {result && shareable && (
          <>
            <button className="export-primary" onClick={share}>
              儲存到相簿／分享
            </button>
            <p className="export-hint">在分享選單選「儲存影像」就會存進相簿，也可以直接傳 LINE、IG。</p>
          </>
        )}
        {result && (
          <button
            className={shareable ? 'sheet-close' : 'export-primary'}
            onClick={() => downloadFile(result.file, result.url)}
          >
            下載檔案
          </button>
        )}
        {shareError && <p className="export-error">{shareError}</p>}

        <button className="sheet-close" disabled={working} onClick={onClose}>
          {working ? '處理中…' : '完成'}
        </button>
      </section>
    </div>
  )
}
