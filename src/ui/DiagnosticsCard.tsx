import { useState } from 'react'

// 暫時的檢查卡片：讓你在 iPhone 上確認 PWA 環境是否正確。M1 完成後移除。
interface Diag {
  standalone: boolean
  secure: boolean
  webgl2: boolean
  maxTexture: number
  safeTop: string
  safeBottom: string
  canShareFiles: boolean
}

function readSafeArea(side: 'top' | 'bottom'): string {
  // 用一個隱形元素讀出 env(safe-area-inset-*) 的實際像素值
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;visibility:hidden;padding-${side}:env(safe-area-inset-${side})`
  document.body.appendChild(el)
  const v = getComputedStyle(el).getPropertyValue(`padding-${side}`)
  el.remove()
  return v
}

function collect(): Diag {
  const gl = document.createElement('canvas').getContext('webgl2')
  const probe = new File([new Uint8Array(1)], 'probe.jpg', { type: 'image/jpeg' })
  return {
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    secure: window.isSecureContext,
    webgl2: !!gl,
    maxTexture: gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 0,
    safeTop: readSafeArea('top'),
    safeBottom: readSafeArea('bottom'),
    canShareFiles: typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }),
  }
}

export function DiagnosticsCard() {
  // 只在第一次 render 時檢查一次
  const [d] = useState<Diag>(collect)

  const row = (label: string, value: string, ok: boolean) => (
    <div className="diag-row" key={label}>
      <span>{label}</span>
      <span className={ok ? 'diag-ok' : 'diag-warn'}>{value}</span>
    </div>
  )

  return (
    <div className="diag">
      {row('主畫面全螢幕', d.standalone ? '是' : '否（Safari 分頁中）', d.standalone)}
      {row('HTTPS 安全環境', d.secure ? '是' : '否', d.secure)}
      {row('WebGL2', d.webgl2 ? '支援' : '不支援', d.webgl2)}
      {row('最大貼圖尺寸', `${d.maxTexture}px`, d.maxTexture >= 4096)}
      {row('Safe area 上／下', `${d.safeTop} / ${d.safeBottom}`, true)}
      {row('可分享檔案', d.canShareFiles ? '是' : '否', d.canShareFiles)}
    </div>
  )
}
