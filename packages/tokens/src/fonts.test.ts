import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fontFaces } from './fonts'
import { unicodeRangeOf } from './generate'

const require = createRequire(import.meta.url)
const fontsourceCss = (file: string) => readFileSync(require.resolve(`@fontsource/${file}`), 'utf8')

describe('fontFaces', () => {
  it('14 начертаний: Sans 400–700 и Mono 400–600, кириллица и латиница', () => {
    expect(fontFaces).toHaveLength(14)
    expect(fontFaces.filter((f) => f.family === 'IBM Plex Sans').map((f) => f.weight).sort()).toEqual([400, 400, 500, 500, 600, 600, 700, 700])
    expect(fontFaces.filter((f) => f.family === 'IBM Plex Mono').map((f) => f.weight).sort()).toEqual([400, 400, 500, 500, 600, 600])
  })

  it('у каждого начертания — адрес woff2 и непустой unicode-range', () => {
    for (const f of fontFaces) {
      expect(f.url).toMatch(/\.woff2$/)
      expect(f.unicodeRange).toMatch(/^U\+/)
    }
  })

  it('адреса ведут на файлы, которые лежат в пакете (packages/tokens/fonts)', () => {
    for (const f of fontFaces) expect(existsSync(fileURLToPath(f.url)), f.url).toBe(true)
  })

  it('кириллица Sans 400 — unicode-range того же файла в CSS @fontsource', () => {
    // В cyrillic-400.css (его импортировал прежний fonts.css) unicode-range нет — диапазон подмножества
    // есть только в общем 400.css, в блоке с тем же файлом woff2.
    const expected = unicodeRangeOf(fontsourceCss('ibm-plex-sans/400.css'), 'ibm-plex-sans-cyrillic-400-normal')
    expect(expected).toBe('U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116')
    const face = fontFaces.find((f) => f.family === 'IBM Plex Sans' && f.weight === 400 && f.url.endsWith('ibm-plex-sans-cyrillic-400-normal.woff2'))
    expect(face?.unicodeRange).toBe(expected)
  })
})

describe('unicodeRangeOf', () => {
  it('нет блока с таким файлом — ошибка, а не пустой диапазон', () => {
    expect(() => unicodeRangeOf(fontsourceCss('ibm-plex-sans/400.css'), 'ibm-plex-sans-klingon-400-normal')).toThrow(/klingon/)
  })
})
