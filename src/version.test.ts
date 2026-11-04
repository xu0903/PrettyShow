import { describe, expect, it } from 'vitest'
import { changesSince, compareVersions } from './version.ts'

const log = { '0.6.0': ['c'], '0.5.0': ['b'], '0.4.0': ['a'], '0.10.0': ['future'] }

describe('compareVersions', () => {
  it('逐段比較數字，不是比字串', () => {
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('0.4.0', '0.5.0')).toBeLessThan(0)
  })
})

describe('changesSince', () => {
  it('跳過的版本也列出來，新的在前', () => {
    expect(changesSince('0.4.0', '0.6.0', log).map((c) => c.version)).toEqual(['0.6.0', '0.5.0'])
  })
  it('不列出比目前版本新的內容', () => {
    expect(changesSince('0.5.0', '0.6.0', log).map((c) => c.version)).toEqual(['0.6.0'])
  })
  it('舊版沒有版本紀錄時只列目前這一版', () => {
    expect(changesSince('old', '0.6.0', log).map((c) => c.version)).toEqual(['0.6.0'])
  })
})
