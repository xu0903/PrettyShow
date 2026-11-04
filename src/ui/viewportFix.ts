// 修正 iOS 主畫面全螢幕模式（status bar = black-translucent）的底部問題：
// 網頁可以畫的範圍比螢幕短了一截（剛好是狀態列的高度），最下面那一條只會顯示網頁底色，
// 放在那裡的內容（例如工具列的文字）會被切掉。就算把 App 高度設成螢幕高度也畫不出來。
//
// 做法：量出「螢幕高度 − 可畫範圍高度」這段落差，寫進 --vp-gap。
// 這段落差已經蓋住 Home 橫條，所以底部 safe area 要扣掉它（見 index.css 的 --sab），
// 工具列就會完整顯示在可畫範圍內；落差那一條則用和工具列一樣的底色接起來。
// 一般裝置沒有這個問題，落差是 0，版面不受影響。

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
    const gap = Math.max(0, full - window.innerHeight)
    // 超過 80px 不太可能是這個問題（例如鍵盤彈出），就不處理
    root.style.setProperty('--vp-gap', `${gap <= 80 ? gap : 0}px`)
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}
