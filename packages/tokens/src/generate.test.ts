import { describe, expect, it } from 'vitest'
import { renderCss, renderTs } from './generate'
import { source } from './tokens.src'

describe('renderCss', () => {
  const css = renderCss(source)

  it('светлые цвета — на :root и по атрибуту data-theme="light"', () => {
    expect(css).toMatch(/:root,\s*\[data-theme="light"\]\s*{[^}]*--k-val:\s*#3A6EA5/)
    expect(css).toMatch(/:root,\s*\[data-theme="light"\]\s*{[^}]*--k-st-flow:\s*#3A6EA5/)
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
    expect(css).toMatch(/:root,\s*\[data-theme="light"\]\s*{[^}]*--k-shadow: 0 1px 2px rgba\(20,26,41,\.06\)/)
  })

  it('вертикаль записи грида и статусная точка «l»: grid-pad 8, grid-gap, dot-l', () => {
    expect(css).toMatch(/--k-grid-pad: calc\(8px \* var\(--k-density\)\)/)
    expect(css).toContain('--k-grid-gap:')
    expect(css).toContain('--k-dot-l:')
  })

  it('деталка: ширина drawer и длительность появления (спека 2a)', () => {
    expect(css).toMatch(/--k-drawer: calc\(800px \* var\(--k-density\)\)/)
    expect(css).toContain('--k-t-drawer: 180ms')
    expect(css).toMatch(/--k-lane: calc\(36px \* var\(--k-density\)\)/)
  })

  it('вкладки деталки линией: высота полосы tab-line 32, отступ вкладки tab-px 10 (спека 2a)', () => {
    expect(css).toMatch(/--k-tab-line: calc\(32px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-tab-px: calc\(10px \* var\(--k-density\)\)/)
  })

  it('«Общие данные» деталки: строка поля 27, строка сторон рубля 23, сетки блоков dt-* (спека 2a)', () => {
    expect(css).toMatch(/--k-field-row: calc\(27px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-party-row: calc\(23px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-lh-pre: calc\(16\.3px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-dt-label-l: calc\(250px \* var\(--k-density\)\)/)
  })
  it('бейдж статуса вкладок деталки: точка 6, радиус 10 (спека 2b)', () => {
    expect(css).toMatch(/--k-badge-dot: calc\(6px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-r-badge: calc\(10px \* var\(--k-density\)\)/)
  })
  it('таблица вкладок деталки MiniTable: строка 24, шапка 22, раскрываемая строка 26 (спека 2b)', () => {
    expect(css).toMatch(/--k-tt-row: calc\(24px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-tt-head: calc\(22px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-tt-row-x: calc\(26px \* var\(--k-density\)\)/)
  })

  it('«ключ–значение» вкладок деталки: строка 24, отступ 10, кегли 11.5 и 12 (спека 2b)', () => {
    expect(css).toMatch(/--k-kv-row: calc\(24px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-kv-px: calc\(10px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-fs-kv: calc\(11\.5px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-fs-kvs: calc\(12px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-ah-row: calc\(25px \* var\(--k-density\)\)/)
  })

  it('просмотр кода: поле номеров строк 46, номер 30, отступ SWIFT 28 (спека 2b)', () => {
    expect(css).toMatch(/--k-code-gutter: calc\(46px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-code-num: calc\(30px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-code-pl: calc\(28px \* var\(--k-density\)\)/)
  })

  it('правка деталки (спека 2c): Prompt 340 / 30, поле редактора 21, опция 18, поле на месте 22, подсказка 24, подложка', () => {
    expect(css).toMatch(/--k-prompt-w: calc\(340px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-prompt-btn: calc\(30px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-prompt-shift: calc\(6px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-fe-line: calc\(21px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-opt-btn: calc\(18px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-h-inline: calc\(22px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-sug-row: calc\(24px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-scrim: #141A2947/i)
  })

  it('каждый размерный токен объявлен ровно один раз, каждый цвет — минимум трижды', () => {
    for (const key of Object.keys(source.sizes)) {
      expect.soft(css.split(`--k-${key}:`).length, `--k-${key}`).toBe(2)
    }
    for (const key of Object.keys(source.colorsLight)) {
      expect.soft(css.split(`--k-${key}:`).length - 1, `--k-${key}`).toBeGreaterThanOrEqual(3)
    }
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
