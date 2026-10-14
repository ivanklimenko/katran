import type { ColorSet, TokenSource } from './tokens.src'

type Decl = readonly [name: string, value: string]

// Группы объявлений --k-*: общий источник для tokens.css, declarations.ts и vars.ts
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

export function renderCss(src: TokenSource): string {
  const g = groups(src)
  const dark = lines(g.dark, '    ')

  return `/* Сгенерировано из tokens.src.ts — не править руками. pnpm gen */
:root {
${lines(g.base, '  ')}
}
/* Светлые цвета — и на :root, и по явному атрибуту: при системной тёмной теме
   поддерево с [data-theme="light"] иначе осталось бы без светлой палитры */
:root, [data-theme="light"] {
${lines(g.light, '  ')}
}
/* Размеры объявляются и на корне провайдера ([data-k-root]) — иначе var(--k-density)
   резолвится в :root и плотность провайдера не действует */
:root, [data-k-root] {
${lines(g.sizes, '  ')}
}
[data-theme="dark"] {
${dark.replace(/^ {4}/gm, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${dark}
  }
}
`
}

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
