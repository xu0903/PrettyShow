// 修正 iOS 主畫面全螢幕模式（status bar = black-translucent）的高度問題：
// 畫面會延伸到狀態列底下，但 100% / 100vh / 100lvh 算出來的高度都少了狀態列那一段，
// 底部就多出一條和 safe-area-inset-top 一樣高的空白，還會切到工具列。
// 全螢幕模式下沒有瀏覽器工具列，所以直接用螢幕高度當作 App 高度。

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function installViewportFix(): void {
  if (!isStandalone()) return
  const root = document.documentElement
  root.dataset.standalone = ''

  const update = () => {
    // iOS 的 screen.width / height 不會隨著旋轉交換，要自己判斷方向
    const portrait = window.matchMedia('(orientation: portrait)').matches
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    root.style.setProperty('--app-h', `${Math.max(window.innerHeight, full)}px`)
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}
