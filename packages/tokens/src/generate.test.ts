import { describe, expect, it } from 'vitest'
import { renderDeclarations, renderTs, renderVars } from './generate'
import { source } from './tokens.src'

// Значения токенов — по тексту объявлений (селекторы ставит корень провайдера, его тесты — в @katran/ui)
describe('renderDeclarations: значения токенов', () => {
  const css = renderDeclarations(source)

  it('плотность по умолчанию 1, шрифты, слои, длительности, тень', () => {
    expect(css).toContain('--k-density: 1;')
    expect(css).toContain('--k-sans: "IBM Plex Sans"')
    expect(css).toContain('--k-z-menu: 200')
    expect(css).toContain('--k-t-fast: 120ms')
    expect(css).toContain('--k-shadow: 0 1px 2px rgba(20,26,41,.06)')
  })

  it('размеры умножены на плотность', () => {
    expect(css).toMatch(/--k-fs-1: calc\(12\.5px \* var\(--k-density\)\)/)
    expect(css).toMatch(/--k-h-ctl-m: calc\(28px \* var\(--k-density\)\)/)
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

  it('каждый размерный токен объявлен ровно один раз, каждый цвет — дважды (светлая и тёмная)', () => {
    for (const key of Object.keys(source.sizes)) {
      expect.soft(css.split(`--k-${key}:`).length, `--k-${key}`).toBe(2)
    }
    for (const key of Object.keys(source.colorsLight)) {
      expect.soft(css.split(`--k-${key}:`).length - 1, `--k-${key}`).toBe(2)
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

// Имена токенов tokens.css ветки main на момент перехода на styled-components (срез styled, Task 1):
// у каждого должен быть ключ в k — шаблоны styled ссылаются на токены только через k
const MAIN_NAMES = [
  'ah-row', 'bad-soft', 'bad', 'badge-dot', 'badge-gap', 'badge-px', 'badge-py', 'cal-cell', 'chip', 'code-gutter',
  'code-num', 'code-pl', 'code-pt', 'code-px', 'counter', 'density', 'dialog-l', 'dot-l', 'dot-m', 'dot-s',
  'drawer-shift', 'drawer', 'dt-acc', 'dt-bic', 'dt-dir', 'dt-hist', 'dt-label-l', 'dt-label-m', 'dt-label-s', 'dt-st',
  'dt-sum', 'dt-time', 'dw-pad', 'edit-dot', 'faint', 'fe-box-px', 'fe-box-py', 'fe-gap', 'fe-line', 'fe-pb',
  'fe-pt', 'fe-px', 'field-gap', 'field-opt', 'field-row', 'field-tag', 'filter-field', 'fold', 'fs-1', 'fs-2',
  'fs-3', 'fs-edit', 'fs-h1', 'fs-h2', 'fs-hero', 'fs-kv', 'fs-kvs', 'fs-mark', 'fs-pre', 'fs-prompt',
  'fs-sum', 'grid-gap', 'grid-lead', 'grid-pad', 'grid-rz', 'ground', 'h-ctl-l', 'h-ctl-m', 'h-ctl-s', 'h-field',
  'h-inline', 'hatch', 'hover', 'icon-m', 'icon-s', 'ink2', 'ink', 'kv-gap', 'kv-px', 'kv-row',
  'kvs-gap', 'lane', 'lh-1', 'lh-2', 'lh-3', 'lh-pre', 'line2', 'line', 'mark-dot', 'menu-max-h',
  'menu-min', 'mono', 'muted', 'note-max', 'ok-soft', 'ok', 'opt-btn', 'opt-min', 'opt-soft', 'opt',
  'paper', 'party-row', 'pen', 'preset-w', 'progress', 'prompt-btn-px', 'prompt-btn', 'prompt-shift', 'prompt-w', 'r-badge',
  'r-l', 'r-m', 'r-s', 'range-time-w', 'sans', 'scrim', 'shadow', 'side', 'sp-1', 'sp-2',
  'sp-3', 'sp-4', 'sp-5', 'sp-6', 'sp-7', 'sp-8', 'st-bad', 'st-badd', 'st-flow', 'st-flowd',
  'st-flowl', 'st-grey', 'st-letter-soft', 'st-ok', 'st-okl', 'st-warn', 'sug-kind', 'sug-row', 'sug-tag', 'sug-w',
  'sunk', 'swatch', 't-base', 't-drawer', 't-fast', 't-open-delay', 't-sk-min', 't-sk-show', 'tab-line', 'tab-px',
  'tag-max-h', 'tip-max', 'tt-chev', 'tt-empty', 'tt-gap', 'tt-head', 'tt-num', 'tt-panel-pt', 'tt-row-x', 'tt-row',
  'val-soft', 'val', 'warn-row', 'warn-soft', 'warn', 'z-drawer', 'z-menu', 'z-modal', 'z-sticky', 'z-tooltip'
]
const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

// Имена всех токенов, выведенные прямо из tokens.src.ts (без генератора): плотность, шрифты,
// слои z-*, длительности t-*, размеры, цвета и тень. Новый токен в источнике попадает сюда сам.
const SOURCE_NAMES = [
  'density',
  ...Object.keys(source.fonts),
  ...Object.keys(source.z).map((n) => `z-${n}`),
  ...Object.keys(source.durations).map((n) => `t-${n}`),
  ...Object.keys(source.sizes),
  ...Object.keys(source.colorsLight),
  'shadow',
]

describe('renderVars', () => {
  const ts = renderVars(source)
  const pairs = [...ts.matchAll(/^ {2}(\w+): 'var\(--k-([a-z0-9-]+)\)',$/gm)].map((m) => [m[1] ?? '', m[2] ?? ''] as const)

  it('ключи в camelCase ссылаются на var(--k-…), включая плотность, слои и длительности', () => {
    expect(ts).toContain("valSoft: 'var(--k-val-soft)'")
    expect(ts).toContain("sp1: 'var(--k-sp-1)'")
    expect(ts).toContain("density: 'var(--k-density)'")
    expect(ts).toContain("zModal: 'var(--k-z-modal)'")
    expect(ts).toContain("tFast: 'var(--k-t-fast)'")
  })

  it('у каждого токена tokens.css из main есть ключ', () => {
    const names = new Set(pairs.map(([, name]) => name))
    for (const name of MAIN_NAMES) expect.soft(names.has(name), `--k-${name}`).toBe(true)
  })

  it('ключи k — ровно токены tokens.src.ts, лишних и пропущенных нет', () => {
    expect(pairs.map(([, name]) => name).sort()).toEqual([...SOURCE_NAMES].sort())
  })

  it('ключ — имя токена в camelCase, ключи не повторяются', () => {
    for (const [key, name] of pairs) expect(key).toBe(camel(name))
    expect(new Set(pairs.map(([key]) => key)).size).toBe(pairs.length)
  })

  it('экспортирует k как const и помечен как сгенерированный', () => {
    expect(ts.startsWith('// Сгенерировано из tokens.src.ts')).toBe(true)
    expect(ts).toMatch(/export const k = {[\s\S]*} as const/)
  })
})

describe('renderDeclarations', () => {
  const ts = renderDeclarations(source)
  const block = (name: string) => {
    const m = ts.match(new RegExp(`^ {2}${name}: \`([^\`]*)\`,$`, 'm'))
    if (!m?.[1]) throw new Error(`нет блока ${name}`)
    return m[1]
  }
  const namesOf = (text: string) => [...text.matchAll(/--k-([a-z0-9-]+):/g)].map((m) => m[1] ?? '')

  it('размеры — из tokens.src.ts, умножены на плотность', () => {
    expect(block('sizes')).toContain('--k-sp-1: calc(4px * var(--k-density));')
    expect(block('sizes')).toContain(`--k-h-ctl-m: calc(${source.sizes['h-ctl-m']}px * var(--k-density));`)
  })

  it('база — плотность, шрифты, слои, длительности', () => {
    const base = block('base')
    expect(base).toContain('--k-density: 1;')
    expect(base).toContain('--k-z-modal: ')
    expect(base).toContain('--k-t-fast: 120ms;')
    expect(base).toContain('--k-sans: "IBM Plex Sans"')
  })

  it('светлые и тёмные цвета с тенью, набор имён один и тот же', () => {
    expect(block('light')).toContain('--k-paper: #FFFFFF;')
    expect(block('dark')).toContain('--k-paper: #161B26;')
    expect(block('dark')).toContain(`--k-shadow: ${source.shadows.dark};`)
    expect(namesOf(block('dark')).sort()).toEqual(namesOf(block('light')).sort())
  })

  it('только объявления --k-*: …; без селекторов; вместе — все токены', () => {
    for (const name of ['base', 'sizes', 'light', 'dark']) {
      for (const line of block(name).split('\n')) expect(line).toMatch(/^--k-[a-z0-9-]+: [^{};]+;$/)
    }
    const all = ['base', 'sizes', 'light'].flatMap((name) => namesOf(block(name)))
    expect(all.sort()).toEqual([...SOURCE_NAMES].sort())
  })
})
