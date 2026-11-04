// 濾鏡選單裡的一格：縮圖 + 名稱

export function FilterThumb({ name, src, selected, onClick }: { name: string; src?: string; selected: boolean; onClick: () => void }) {
  return (
    <button className="filter-thumb" aria-pressed={selected} onClick={onClick}>
      {src ? <img src={src} alt="" /> : <span className="filter-thumb-empty" />}
      <span>{name}</span>
    </button>
  )
}
