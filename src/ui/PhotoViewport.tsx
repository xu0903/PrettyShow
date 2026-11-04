import { IconPhoto } from './icons.tsx'
import { DiagnosticsCard } from './DiagnosticsCard.tsx'

// 照片區：M1 會換成 WebGL 畫布，並且只有這裡可以雙指縮放
export function PhotoViewport() {
  return (
    <div className="viewport">
      <div className="viewport-empty">
        <button className="pick-btn" disabled>
          <IconPhoto />
          <span>選擇照片</span>
        </button>
        <DiagnosticsCard />
      </div>
    </div>
  )
}
