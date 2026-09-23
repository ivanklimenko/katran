// Расширение vitest.Assertion матчером jest-axe: у самого `jest-axe` нет
// собственных типов, а расширять `namespace jest` (как DefinitelyTyped)
// смысла нет — в проекте только vitest. См. jest-axe.d.ts рядом.
import 'vitest'

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T
  }
}
