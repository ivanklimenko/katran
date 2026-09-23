import type { ContrastRule } from './contrast'

const surfaces = ['paper', 'sunk', 'ground', 'hover', 'chip', 'val-soft']
const others = ['sunk', 'ground', 'hover', 'chip', 'val-soft']

/** Пороги зафиксированы по замеру эталона 2026-09-23 (спека, Global Constraints плана 1).
 * Порог для читаемого текста — 4.5, в том числе для семантики на своей -soft.
 * Исключение — ok и warn на своих -soft: там 4.0, потому что это кратковременная
 * подсветка (вспышка копирования, строка внимания), а не читаемый текст
 * (замер 2026-09-23: ok/ok-soft 4.17, warn/warn-soft 4.26).
 */
export const rules: ContrastRule[] = [
  { fg: 'ink', bg: surfaces, min: 4.5, note: 'основной текст' },
  { fg: 'ink2', bg: surfaces, min: 4.5, note: 'названия полей' },
  { fg: 'muted', bg: ['paper'], min: 4.5, note: 'подписи на бумаге' },
  { fg: 'muted', bg: others, min: 4.0, note: 'подписи на подложках — крупный текст' },
  { fg: 'val', bg: ['paper', 'val-soft'], min: 4.5, note: 'значения, в том числе на подсветке' },
  { fg: 'ok', bg: ['paper'], min: 4.5, note: 'успех' },
  { fg: 'ok', bg: ['ok-soft'], min: 4.0, note: 'успех на подсветке (вспышка копирования), замер 4.17 — кратковременная подсветка' },
  { fg: 'bad', bg: ['paper', 'bad-soft'], min: 4.5, note: 'ошибка, в том числе на подсветке' },
  { fg: 'warn', bg: ['paper'], min: 4.5, note: 'внимание' },
  { fg: 'warn', bg: ['warn-soft'], min: 4.0, note: 'внимание на подсветке, замер 4.26 — кратковременная подсветка' },
  { fg: 'opt', bg: ['paper', 'opt-soft'], min: 4.5, note: 'теги полей, в том числе на подсветке' },
  { fg: 'faint', bg: surfaces, min: 3.0, note: 'служебный токен, не для читаемого текста' },
  { fg: 'paper', bg: ['val'], min: 4.5, note: 'текст на primary-кнопке' },
  { fg: 'paper', bg: ['st-flow', 'st-flowd', 'st-bad', 'st-badd', 'st-warn', 'st-ok'], min: 4.5, note: 'буква в статусной точке' },
]
