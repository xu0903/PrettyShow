/** App 版本：每次發佈新功能時把 package.json 的 version 加一，並在下面寫這一版的更新內容 */
export const APP_VERSION: string = __APP_VERSION__
/** 建置時間（ISO 字串） */
export const BUILD_TIME: string = __BUILD_TIME__

export const CHANGELOG: Record<string, string[]> = {
  '0.7.0': [
    '全新版面：首頁、圖庫、AI 修圖、我，換成紅色系',
    '「圖片美化」和「人像美容」兩個編輯器，工具列可以左右滑，右下角一鍵切換',
    '打開工具後按 ✓ 套用、✕ 放棄這次的修改',
    '圖庫會保存修過的照片，隨時點開接著修；之前修到一半的照片也已經搬進來',
    '照片右下角的按鈕按住可以看原圖',
    '還沒做好的功能先放好位置，標示「即將」',
  ],
  '0.6.0': [
    '新增「美顏」：磨皮、美白，會自動找出照片裡的臉（最多 6 張）',
    '磨皮只作用在皮膚上，眼睛、眉毛、嘴唇和輪廓保持清楚',
    '第一次打開美顏要下載臉部辨識（約 8MB），之後離線也能用',
    '更新通知會列出你沒看到的每一版',
  ],
  '0.5.0': [
    '新增「匯出」：右上角的分享鍵，用原圖解析度輸出，按「儲存到相簿／分享」→「儲存影像」就存進相簿',
    '裁切比例改成好認的名字：方格、IG 貼文、IG 主頁、IG 限動、IG 橫式、寬螢幕，旁邊有小框圖示',
    '新增 IG 橫式 1.91:1',
  ],
  '0.4.0': [
    '新增「濾鏡」：暖陽、冷調、底片、日系、褪色、電影、復古、黑白，縮圖直接用你的照片預覽',
    '每款濾鏡都可以調強度',
    '新增「裁切」：自由、原始、1:1、4:5、9:16、3:4、16:9，拖角落或邊調整大小、拖框內移動',
    '可以往左旋轉、水平翻轉、垂直翻轉',
  ],
  '0.3.0': [
    '新增「調整」：亮度、對比、飽和度、色溫、色調、銳化、暈影',
    '滑桿在整條上任何位置左右滑都能調，雙擊滑桿回到 0',
    '可以復原／重做（頂部左邊的箭頭）',
    '長按照片看原圖，放開回到修好的樣子',
    '關掉 App 再打開，會接著上次修到一半的照片',
  ],
  '0.2.1': ['修正主畫面模式下，底部工具列的圖示和文字被切到：工具列往上移到看得到的範圍內'],
  '0.2.0': [
    '可以從相簿選照片，用 WebGL 顯示預覽',
    '照片區可以雙指縮放、拖曳，雙擊放大／還原',
    '新的 App 圖示，設定裡可以換成另外兩款',
    '修正主畫面模式下，底部多出一條空白、切到工具列文字',
    '更新後打開 App 會跳出這個通知',
  ],
  '0.1.0': ['第一版：PWA 外框、版面與部署'],
}

/** 比較版本號（'0.10.0' > '0.9.1'）；回傳正數代表 a 比較新 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * 從上次看到的版本之後，到目前版本為止的所有更新內容（新的在前）。
 * 中間有版本沒打開過 App 的話，那幾版的內容也會一起列出來。
 * seen 不是合法版本號（例如加入版本號之前的舊版）時只列目前這一版。
 */
export function changesSince(
  seen: string,
  current: string = APP_VERSION,
  log: Record<string, string[]> = CHANGELOG,
): { version: string; notes: string[] }[] {
  const valid = /^\d+(\.\d+)*$/.test(seen)
  return Object.keys(log)
    .filter((v) => compareVersions(v, current) <= 0 && (valid ? compareVersions(v, seen) > 0 : v === current))
    .sort((a, b) => compareVersions(b, a))
    .map((version) => ({ version, notes: log[version] }))
}
