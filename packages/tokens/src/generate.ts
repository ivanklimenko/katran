import type { ColorSet, TokenSource } from './tokens.src'

type Decl = readonly [name: string, value: string]

// Группы объявлений --k-*: общий источник для declarations.ts и vars.ts
function groups(src: TokenSource) {
  const { colorsLight, colorsDark, shadows, sizes, fonts, z, durations } = src
  const colors = (c: ColorSet, shadow: string): Decl[] => [...Object.entries(c), ['shadow', shadow]]
  return {
    base: [
      ['density', '1'],
      ...Object.entries(fonts),
      ...Object.entries(z).map(([k, v]): Decl => [`z-${k}`, String(v)]),
      ...Object.entries(durations).map(([k, v]): Decl => [`t-${k}`, `${v}ms`]),
    ] as Decl[],
    sizes: Object.entries(sizes).map(([k, v]): Decl => [k, `calc(${v}px * var(--k-density))`]),
    light: colors(colorsLight, shadows.light),
    dark: colors(colorsDark, shadows.dark),
  }
}

const lines = (decls: readonly Decl[], indent: string) =>
  decls.map(([k, v]) => `${indent}--k-${k}: ${v};`).join('\n')

const obj = (o: Record<string, string | number>, indent = '  ') =>
  Object.entries(o).map(([k, v]) => `${indent}'${k}': ${typeof v === 'number' ? v : `'${v}'`},`).join('\n')

export function renderTs(src: TokenSource): string {
  return `// Сгенерировано из tokens.src.ts — не править руками. pnpm gen
export const colors = {
  light: {
${obj(src.colorsLight, '    ')}
  },
  dark: {
${obj(src.colorsDark, '    ')}
  },
} as const

export const sizes = {
${obj(src.sizes)}
} as const

export const fonts = {
${obj(src.fonts)}
} as const

export const z = {
${obj(src.z)}
} as const

export const durations = {
${obj(src.durations)}
} as const

export const densities = [${src.densities.join(', ')}] as const
export type Density = (typeof densities)[number]
export type ColorName = keyof typeof colors.light
export type SizeName = keyof typeof sizes
`
}

const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** vars.ts: k — ссылки var(--k-…) на все токены для шаблонов styled-components (`${k.valSoft}`). */
export function renderVars(src: TokenSource): string {
  const g = groups(src)
  const names = [...g.base, ...g.sizes, ...g.light].map(([name]) => name)
  const keys = names.map(camel)
  const twin = keys.find((key, i) => keys.indexOf(key) !== i)
  if (twin) throw new Error(`ключ k.${twin} получают два токена — переименуйте токен в tokens.src.ts`)
  return `// Сгенерировано из tokens.src.ts — не править руками. pnpm gen
/** Ссылки на CSS-переменные токенов для шаблонов styled-components: \`color: \${k.val}\`. */
export const k = {
${names.map((name, i) => `  ${keys[i]}: 'var(--k-${name})',`).join('\n')}
} as const
`
}

/** declarations.ts: тексты объявлений --k-*: …; без селекторов — селекторы ставит потребитель (корень провайдера). */
export function renderDeclarations(src: TokenSource): string {
  const g = groups(src)
  for (const [name, value] of [...g.base, ...g.sizes, ...g.light, ...g.dark]) {
    if (/[`\\]|\$\{/.test(value)) throw new Error(`значение --k-${name} не помещается в шаблонную строку: ${value}`)
  }
  const text = (decls: readonly Decl[]) => lines(decls, '')
  return `// Сгенерировано из tokens.src.ts — не править руками. pnpm gen
/** Объявления токенов по группам: base — плотность, шрифты, слои, длительности; sizes — размеры
 *  (на корне провайдера, иначе плотность провайдера не действует); light, dark — цвета и тень. */
export const declarations: {
  readonly base: string
  readonly sizes: string
  readonly light: string
  readonly dark: string
} = {
  base: \`${text(g.base)}\`,
  sizes: \`${text(g.sizes)}\`,
  light: \`${text(g.light)}\`,
  dark: \`${text(g.dark)}\`,
}
`
}

// ── Шрифты ─────────────────────────────────────────────────────────────────────────────────────────
// Начертания кита — те же файлы @fontsource, что импортировал прежний fonts.css: IBM Plex Sans 400–700
// и IBM Plex Mono 400–600, подмножества кириллица и латиница, только woff2 (Chromium 88 его читает).
// pnpm gen копирует файлы в packages/tokens/fonts и пишет src/fonts.ts с адресами new URL(…, import.meta.url):
// сборщик потребителя (Vite, webpack 5) сам кладёт файлы рядом со своей сборкой.
export const fontSources = [
  { family: 'IBM Plex Sans', pkg: 'ibm-plex-sans', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Mono', pkg: 'ibm-plex-mono', weights: [400, 500, 600] },
] as const
const fontSubsets = ['cyrillic', 'latin'] as const

export type FontFile = { family: string; pkg: string; weight: number; stem: string }

/** Файлы начертаний в порядке прежнего fonts.css: семейство → подмножество → вес. */
export function fontFiles(): FontFile[] {
  return fontSources.flatMap(({ family, pkg, weights }) =>
    fontSubsets.flatMap((subset) => weights.map((weight) => ({ family, pkg, weight, stem: `${pkg}-${subset}-${weight}-normal` }))))
}

/**
 * unicode-range начертания из CSS @fontsource: блок @font-face, чей src ведёт на файл `<stem>.woff2`.
 * Диапазоны есть только в общих файлах веса (`400.css`); в файлах подмножества (`cyrillic-400.css`) их нет.
 */
export function unicodeRangeOf(css: string, stem: string): string {
  const block = css.split('@font-face').find((b) => b.includes(`/${stem}.woff2`))
  const range = block?.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim()
  if (!range) throw new Error(`в CSS @fontsource нет unicode-range для ${stem}.woff2`)
  return range
}

/** fonts.ts: описания начертаний для KatranFonts (@katran/ui). */
export function renderFonts(faces: readonly (FontFile & { unicodeRange: string })[]): string {
  const families = fontSources.map((s) => `'${s.family}'`).join(' | ')
  const weights = [...new Set(fontSources.flatMap((s) => s.weights))].sort().join(' | ')
  return `// Сгенерировано pnpm gen из @fontsource — не править руками.
/** Начертание шрифта кита: семейство, вес, unicode-range подмножества и адрес файла woff2. */
export type FontFaceSpec = {
  readonly family: ${families}
  readonly weight: ${weights}
  readonly unicodeRange: string
  readonly url: string
}

/**
 * Начертания IBM Plex. Файлы woff2 лежат в пакете (папка fonts рядом с dist и src); адреса
 * new URL(…, import.meta.url) разрешает сборщик потребителя — он копирует файлы в свою сборку.
 */
export const fontFaces: readonly FontFaceSpec[] = [
${faces.map((f) => `  { family: '${f.family}', weight: ${f.weight}, unicodeRange: '${f.unicodeRange}', url: new URL('../fonts/${f.stem}.woff2', import.meta.url).href },`).join('\n')}
]
`
}
