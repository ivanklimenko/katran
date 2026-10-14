import type { ReactElement } from 'react'
import { createGlobalStyle, css } from '../styled'
import { fontFaces, type FontFaceSpec } from '@katran/tokens/fonts'

// Правила собираются один раз при загрузке модуля: в шаблоне styled нет функций (правило 1 спеки).
// Адрес — абсолютный (new URL(…).href от адреса модуля: в dev Vite — /@fs/…, у webpack — от publicPath remote), в кавычках.
// @font-face — текстом шаблона css, а не строкой: так его видят stylelint и check-css-target (планка Chromium 88).
const face = (f: FontFaceSpec) => css`
  @font-face {
    font-family: '${f.family}';
    font-style: normal;
    font-display: swap;
    font-weight: ${f.weight};
    src: url('${f.url}') format('woff2');
    unicode-range: ${f.unicodeRange};
  }
`
const faces = fontFaces.map(face)

const FontFaces = createGlobalStyle`${faces}`

/**
 * Шрифты кита — IBM Plex Sans и Mono (кириллица, латиница) из файлов woff2 пакета @katran/tokens.
 * @font-face глобален по природе — единственное глобальное правило кита, поэтому включается явно:
 * приложение ставит <KatranFonts /> один раз (обычно рядом с KatranProvider). Внешних ресурсов нет —
 * файлы кладёт в сборку приложения его сборщик; под федерацией remote отдаёт их с CORS.
 * Тип возврата — ReactElement (= JSX.Element): глобального JSX в типах React 19 нет.
 */
export function KatranFonts(): ReactElement {
  return <FontFaces />
}
