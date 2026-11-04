// iOS Safari 從 iOS 10 開始忽略 viewport 的 user-scalable=no，
// 所以要自己攔截 Safari 專有的 gesture 事件和多指 touchmove，才能禁止整頁縮放。
// 照片區的縮放是用 pointer events 自己實作的，不受這裡影響。

export function installGestureLock(): void {
  const prevent = (e: Event) => e.preventDefault()

  // Safari 專有：雙指縮放／旋轉手勢
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('gestureend', prevent, { passive: false })

  // 多指 touchmove 也擋掉，避免縮放和整頁回彈
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false },
  )
}
