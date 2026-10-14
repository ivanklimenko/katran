import type { k } from '@katran/tokens'

/** Тема кита в теме styled-components хоста: токены под своим ключом, тема хоста не затирается. */
export type KatranTheme = { katran: typeof k }

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- дополнение интерфейса библиотеки
  export interface DefaultTheme extends KatranTheme {}
}
