// 目前的匯出工作（全域）：編輯器的「儲存」、拼圖、證件照排版都用同一個匯出面板

import { create } from 'zustand'
import type { ExportResult } from '../core/export.ts'

export const useExportJob = create<{ job: Promise<ExportResult> | null }>(() => ({ job: null }))

export function startExport(job: Promise<ExportResult>): void {
  useExportJob.setState({ job })
}

export function closeExport(): void {
  // 關掉面板後釋放預覽圖的記憶體
  useExportJob.getState().job?.then((r) => URL.revokeObjectURL(r.url)).catch(() => {})
  useExportJob.setState({ job: null })
}
