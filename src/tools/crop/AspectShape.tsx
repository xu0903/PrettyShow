/** 比例的小圖示：照比例畫一個框，一眼就看得出是直的、方的還是橫的 */
export function AspectShape({ ratio }: { ratio: number | null }) {
  const MAX = 14
  const w = ratio === null ? MAX : ratio >= 1 ? MAX : Math.round(MAX * ratio)
  const h = ratio === null ? MAX : ratio >= 1 ? Math.round(MAX / ratio) : MAX
  return (
    <span className="aspect-box">
      <span className={ratio === null ? 'aspect-shape is-free' : 'aspect-shape'} style={{ width: w, height: h }} />
    </span>
  )
}
