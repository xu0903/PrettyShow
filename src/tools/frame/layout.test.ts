import { describe, expect, it } from 'vitest'
import { DEFAULT_FRAME, frameLayout, isIdentityFrame } from './layout.ts'

const size = { width: 1000, height: 800 }

describe('frameLayout', () => {
  it('純色邊：四邊一樣粗，照片置中', () => {
    const l = frameLayout(size, { ...DEFAULT_FRAME, style: 'color', width: 100 })
    // 12% × 短邊 800 = 96
    expect(l.rect).toEqual({ x: 96, y: 96, w: 1000, h: 800 })
    expect([l.width, l.height]).toEqual([1192, 992])
  })

  it('拍立得：下面比較寬', () => {
    const l = frameLayout(size, { ...DEFAULT_FRAME, style: 'polaroid', width: 0 })
    const bottom = l.height - l.rect.y - l.rect.h
    expect(bottom).toBeGreaterThan(l.rect.y * 3)
  })

  it('指定 1:1：橫的照片上下補齊成正方形', () => {
    const l = frameLayout(size, { ...DEFAULT_FRAME, style: 'blur', width: 0, ratio: '1:1' })
    expect(l.width).toBe(l.height)
    expect(l.rect.x).toBe(0)
    expect(l.rect.y).toBe(100)
  })

  it('沒選樣式就不處理', () => {
    expect(isIdentityFrame(DEFAULT_FRAME)).toBe(true)
    expect(isIdentityFrame({ ...DEFAULT_FRAME, style: 'color' })).toBe(false)
  })
})
