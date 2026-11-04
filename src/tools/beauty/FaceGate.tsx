import type { ReactNode } from 'react'
import { LOADING_TEXT, useFaceStatus } from './useFaces.ts'
import './beauty.css'

/** 找臉的狀態；找到臉才顯示內容 */
export function FaceGate({ children }: { children: ReactNode }) {
  const status = useFaceStatus()
  if (status.state === 'error') return <p className="beauty-status">{status.message}</p>
  if (status.state === 'loading') return <p className="beauty-status">{LOADING_TEXT}</p>
  if (status.faces === 0) return <p className="beauty-status">這張照片裡找不到臉</p>
  return children
}
