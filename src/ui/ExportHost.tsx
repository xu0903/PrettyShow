import { ExportSheet } from './ExportSheet.tsx'
import { closeExport, useExportJob } from './exportJob.ts'

// 匯出面板放在最上層，任何畫面都可以叫出來
export function ExportHost() {
  const job = useExportJob((s) => s.job)
  return job ? <ExportSheet job={job} onClose={closeExport} /> : null
}
