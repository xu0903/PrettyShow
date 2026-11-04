// 把目前的照片和編輯紀錄存在 IndexedDB，關掉 App 再打開可以接著修。
// 照片（Blob）只在換照片時存一次；編輯紀錄每次變動後延遲一下再存，避免拖滑桿時一直寫入。

import { del, get, set } from 'idb-keyval'
import { isHistory, type History } from './editStack.ts'

const PHOTO_KEY = 'prettyshow.session.photo'
const HISTORY_KEY = 'prettyshow.session.history'
const SAVE_DELAY_MS = 400

interface SavedPhoto {
  file: Blob
  name: string
}

export async function savePhoto(file: Blob, name: string): Promise<void> {
  try {
    await set(PHOTO_KEY, { file, name } satisfies SavedPhoto)
    await del(HISTORY_KEY)
  } catch (e) {
    // 存不了（例如儲存空間不足）不影響編輯，只是下次打開不會還原
    console.warn('無法保存照片', e)
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
export function saveHistorySoon(h: History): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    set(HISTORY_KEY, h).catch((e) => console.warn('無法保存編輯紀錄', e))
  }, SAVE_DELAY_MS)
}

export async function loadSession(): Promise<{ photo: SavedPhoto; history: History | null } | null> {
  try {
    const photo = await get<SavedPhoto>(PHOTO_KEY)
    if (!photo || !(photo.file instanceof Blob)) return null
    const history = await get<unknown>(HISTORY_KEY)
    return { photo, history: isHistory(history) ? history : null }
  } catch {
    return null
  }
}
