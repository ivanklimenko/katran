// `@types/jest-axe` тянет `/// <reference types="jest" />`, что в проекте на
// vitest подменяет глобальный `expect` джестовским и ломает нативные матчеры
// vitest (например, `toHaveBeenCalledOnce`) — поэтому вместо DefinitelyTyped
// пакета здесь свой минимальный тип по рантайм-API `jest-axe`, без Jest.
declare module 'jest-axe' {
  /** Достаточно неточного типа результата: пакет `axe-core` в граф типов не тянем намеренно. */
  export type AxeResults = { violations: unknown[] } & Record<string, unknown>
  export type JestAxe = (html: Element | string, options?: Record<string, unknown>) => Promise<AxeResults>

  export const axe: JestAxe
  export function configureAxe(options?: Record<string, unknown>): JestAxe
  export const toHaveNoViolations: { toHaveNoViolations: (results?: Partial<AxeResults>) => { pass: boolean; message(): string } }
}
