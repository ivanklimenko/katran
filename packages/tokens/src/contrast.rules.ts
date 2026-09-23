import type { ContrastRule } from './contrast'

const surfaces = ['paper', 'sunk', 'ground', 'hover', 'chip', 'val-soft']
const others = ['sunk', 'ground', 'hover', 'chip', 'val-soft']

/** Пороги зафиксированы по замеру эталона 2026-09-23 (спека, Global Constraints плана 1).
 * Пороги 4.0 для пар «семантика на своей -soft» — кратковременная подсветка, не читаемый текст
 * (замер 2026-09-23: ok/ok-soft 4.17, warn/warn-soft 4.26).
 */
export const rules: ContrastRule[] = [
  { fg: 'ink', bg: surfaces, min: 4.5, note: 'основной текст' },
  { fg: 'ink2', bg: surfaces, min: 4.5, note: 'названия полей' },
  { fg: 'muted', bg: ['paper'], min: 4.5, note: 'подписи на бумаге' },
  { fg: 'muted', bg: others, min: 4.0, note: 'подписи на подложках — крупный текст' },
  { fg: 'val', bg: ['paper'], min: 4.5, note: 'значения' },
  { fg: 'val', bg: ['val-soft'], min: 4.0, note: 'значения на подсветке' },
  { fg: 'ok', bg: ['paper'], min: 4.5, note: 'успех' },
  { fg: 'ok', bg: ['ok-soft'], min: 4.0, note: 'успех на подсветке (вспышка копирования)' },
  { fg: 'bad', bg: ['paper'], min: 4.5, note: 'ошибка' },
  { fg: 'bad', bg: ['bad-soft'], min: 4.0, note: 'ошибка на подсветке' },
  { fg: 'warn', bg: ['paper'], min: 4.5, note: 'внимание' },
  { fg: 'warn', bg: ['warn-soft'], min: 4.0, note: 'внимание на подсветке' },
  { fg: 'opt', bg: ['paper'], min: 4.5, note: 'теги полей' },
  { fg: 'opt', bg: ['opt-soft'], min: 4.0, note: 'теги полей на подсветке' },
  { fg: 'faint', bg: surfaces, min: 3.0, note: 'служебный токен, не для читаемого текста' },
  { fg: 'paper', bg: ['val'], min: 4.5, note: 'текст на primary-кнопке' },
]
