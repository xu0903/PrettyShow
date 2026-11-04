import { describe, expect, it } from 'vitest'
import { maskSize } from './mask.ts'

describe('maskSize', () => {
  it('長邊縮到 512，保持比例', () => {
    expect(maskSize(2048, 1536)).toEqual({ width: 512, height: 384 })
  })
  it('小圖不放大', () => {
    expect(maskSize(300, 200)).toEqual({ width: 300, height: 200 })
  })
})
