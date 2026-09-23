import type { ColorSet, TokenSource } from './tokens.src'

const colorLines = (c: ColorSet, indent: string) =>
  Object.entries(c).map(([k, v]) => `${indent}--k-${k}: ${v};`).join('\n')

export function renderCss(src: TokenSource): string {
  const { colorsLight, colorsDark, shadows, sizes, fonts, z, durations } = src
  const sizeLines = Object.entries(sizes)
    .map(([k, v]) => `  --k-${k}: calc(${v}px * var(--k-density));`).join('\n')
  const fontLines = Object.entries(fonts).map(([k, v]) => `  --k-${k}: ${v};`).join('\n')
  const zLines = Object.entries(z).map(([k, v]) => `  --k-z-${k}: ${v};`).join('\n')
  const tLines = Object.entries(durations).map(([k, v]) => `  --k-t-${k}: ${v}ms;`).join('\n')
  const dark = `${colorLines(colorsDark, '    ')}\n    --k-shadow: ${shadows.dark};`

  return `/* Сгенерировано из tokens.src.ts — не править руками. pnpm gen */
:root {
  --k-density: 1;
${colorLines(colorsLight, '  ')}
  --k-shadow: ${shadows.light};
${sizeLines}
${fontLines}
${zLines}
${tLines}
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
