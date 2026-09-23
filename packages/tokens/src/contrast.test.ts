import { describe, expect, it } from 'vitest'
import { checkPalette, contrastRatio } from './contrast'
import { rules } from './contrast.rules'
import { colorsDark, colorsLight } from './tokens.src'

describe('contrastRatio', () => {
  it('чёрный на белом = 21, белый на белом = 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  })
  it('faint на paper — 3.75 (замер 2026-09-23)', () => {
    expect(contrastRatio(colorsLight.faint!, colorsLight.paper!)).toBeCloseTo(3.75, 1)
  })
})

describe('палитра соответствует правилам', () => {
  it('светлая', () => {
    expect(checkPalette(colorsLight, rules)).toEqual([])
  })
  it('тёмная', () => {
    expect(checkPalette(colorsDark, rules)).toEqual([])
  })
  it('нарушение обнаруживается', () => {
    const broken = { ...colorsLight, ink: '#CCCCCC' }
    const v = checkPalette(broken, rules)
    expect(v.length).toBeGreaterThan(0)
    expect(v[0]).toMatchObject({ fg: 'ink', bg: 'paper' })
  })
})
