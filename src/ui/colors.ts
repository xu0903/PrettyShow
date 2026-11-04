// 有名字的顏色（色盤用）

export interface NamedColor {
  color: string
  label: string
}

/** 目前顏色的名字（自己挑的就顯示「自選」） */
export function colorName(colors: NamedColor[], value: string): string {
  return colors.find((c) => c.color === value)?.label ?? '自選'
}
