// Единственное место @katran/ui, которое импортирует styled-components (R13). Модули кита берут
// styled, css, createGlobalStyle и прочее отсюда.
//
// styled-components 5 — пакет CommonJS без поля exports. Бандлеры (Vite, webpack) отдают функцию styled
// как default, а Node при импорте CJS из ESM отдаёт как default весь module.exports — функция оказывается
// в default.default, и `import styled from 'styled-components'` ломал импорт dist кита в Node
// (TypeError: styled.div is not a function — например, unit-тесты хоста с внешними зависимостями).
// Именованные экспорты Node находит сам (cjs-module-lexer), нормализуется только default.
import * as sc from 'styled-components'

/** Функция styled из модуля любой формы: сам модуль, его default или default.default. */
export function pickStyled<T>(mod: unknown): T {
  const inner = (m: unknown): unknown => (m !== null && (typeof m === 'object' || typeof m === 'function') ? (m as { default?: unknown }).default : undefined)
  const found = [mod, inner(mod), inner(inner(mod))].find((c) => typeof c === 'function')
  if (!found) throw new Error('styled-components: функция styled не найдена ни в модуле, ни в default, ни в default.default')
  return found as T
}

export const styled = pickStyled<typeof sc.default>(sc)
export default styled

export { css, createGlobalStyle, keyframes, ThemeProvider, useTheme } from 'styled-components'
export type { DefaultTheme, FlattenSimpleInterpolation, Keyframes, StyledComponent } from 'styled-components'
