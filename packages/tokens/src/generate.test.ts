import { describe, expect, it } from 'vitest'
import { renderCss, renderTs } from './generate'
import { source } from './tokens.src'

describe('renderCss', () => {
  const css = renderCss(source)

  it('светлая тема в :root, цвета с префиксом --k-', () => {
    expect(css).toMatch(/:root\s*{[^}]*--k-val:\s*#3A6EA5/)
    expect(css).toMatch(/:root\s*{[^}]*--k-st-flow:\s*#3A6EA5/)
  })

  it('тёмная тема — по атрибуту и по системной настройке без явной светлой', () => {
    expect(css).toMatch(/\[data-theme="dark"\]\s*{[^}]*--k-val:\s*#8FB8E0/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{[^}]*--k-val:\s*#8FB8E0/)
  })

  it('размеры умножены на плотность и объявлены на корне провайдера, а не в :root', () => {
    expect(css).toMatch(/:root,\s*\[data-k-root\]\s*{[^}]*--k-fs-1: calc\(12\.5px \* var\(--k-density\)\)/)
    expect(css).toMatch(/:root,\s*\[data-k-root\]\s*{[^}]*--k-h-ctl-m: calc\(28px \* var\(--k-density\)\)/)
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
    expect(rootBlock).not.toContain('--k-fs-1')
  })

  it('плотность по умолчанию 1, шрифты, слои, длительности, тень', () => {
    expect(css).toMatch(/:root\s*{[^}]*--k-density:\s*1;/)
    expect(css).toContain('--k-sans: "IBM Plex Sans"')
    expect(css).toContain('--k-z-menu: 200')
    expect(css).toContain('--k-t-fast: 120ms')
    expect(css).toMatch(/:root\s*{[^}]*--k-shadow: 0 1px 2px rgba\(20,26,41,\.06\)/)
  })
})

describe('renderTs', () => {
  const ts = renderTs(source)
  it('экспортирует цвета обеих тем и размеры', () => {
    expect(ts).toContain("export const colors = {")
    expect(ts).toContain("'st-flow': '#3A6EA5'")
    expect(ts).toContain("'st-flow': '#7FA9D8'")
    expect(ts).toContain("'fs-1': 12.5")
  })
  it('помечен как сгенерированный', () => {
    expect(ts.startsWith('// Сгенерировано из tokens.src.ts')).toBe(true)
  })
})
