import { describe, expect, it } from 'vitest'
import { exportFileName } from './export.ts'

describe('exportFileName', () => {
  it('用本地時間、補零', () => {
    expect(exportFileName(new Date(2026, 0, 5, 9, 3, 7))).toBe('PrettyShow_20260105_090307.jpg')
  })
})
