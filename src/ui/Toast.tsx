import { useToast } from './toast.ts'

export function Toast() {
  const message = useToast((s) => s.message)
  const seq = useToast((s) => s.seq)
  if (!message) return null
  // key 換掉讓動畫重新播放
  return (
    <div className="toast" key={seq} role="status">
      {message}
    </div>
  )
}
