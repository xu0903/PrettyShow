/** App 版本：每次發佈新功能時把 package.json 的 version 加一，並在下面寫這一版的更新內容 */
export const APP_VERSION: string = __APP_VERSION__
/** 建置時間（ISO 字串） */
export const BUILD_TIME: string = __BUILD_TIME__

export const CHANGELOG: Record<string, string[]> = {
  '0.2.0': [
    '可以從相簿選照片，用 WebGL 顯示預覽',
    '照片區可以雙指縮放、拖曳，雙擊放大／還原',
    '新的 App 圖示，設定裡可以換成另外兩款',
    '修正主畫面模式下，底部多出一條空白、切到工具列文字',
    '更新後打開 App 會跳出這個通知',
  ],
  '0.1.0': ['第一版：PWA 外框、版面與部署'],
}
