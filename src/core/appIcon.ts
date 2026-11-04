// App 圖示的選擇。iOS 不能用程式改主畫面上已經加好的圖示，
// 只能先換掉網頁的 apple-touch-icon，之後再「加入主畫面」時就會用新的那一張。

export const APP_ICON_KEY = 'prettyshow.appIcon'
/** 預設圖示；固定的 PWA 圖示檔也是這一張（見 scripts/split-icons.mjs） */
export const DEFAULT_APP_ICON = 'olive'

// 圖檔由 scripts/split-icons.mjs 從 design/icon-sheet.png 切出來，放在 public/icons/
export const APP_ICONS: { id: string; name: string }[] = [
  { id: 'olive', name: '橄欖綠相機' },
  { id: 'cream', name: '奶茶色相機' },
  { id: 'leaf', name: '窗光綠葉' },
]

export function appIconUrl(id: string, size: 180 | 192 = 192): string {
  return `${import.meta.env.BASE_URL}icons/icon-${id}-${size}.png`
}

export function getAppIcon(): string {
  try {
    const id = localStorage.getItem(APP_ICON_KEY)
    return APP_ICONS.some((i) => i.id === id) ? id! : DEFAULT_APP_ICON
  } catch {
    return DEFAULT_APP_ICON
  }
}

/** 記住選擇，並把網頁的圖示換成選的那一個 */
export function setAppIcon(id: string): void {
  try {
    localStorage.setItem(APP_ICON_KEY, id)
  } catch {
    // 無痕模式等情況存不了，至少這次還是會換
  }
  document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.setAttribute('href', appIconUrl(id, 180))
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((l) => l.setAttribute('href', appIconUrl(id, 192)))
}
