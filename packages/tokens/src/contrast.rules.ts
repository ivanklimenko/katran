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
  /* Тег роли (Провайдеры) на warn-soft/ok-soft: текст должен быть читаемым (не кратковременной
   * подсветкой), порог 4.5. warn/warn-soft и ok/ok-soft дают только 4.26/4.17 (см. заметку выше) —
   * поэтому текст тега тоном ink2, который проходит 4.5 на обеих подложках (замер 8.87/8.73). */
  { fg: 'ink2', bg: ['warn-soft', 'ok-soft'], min: 4.5, note: 'тег роли на подсветке' },
  { fg: 'muted', bg: ['paper'], min: 4.5, note: 'подписи на бумаге' },
  { fg: 'muted', bg: others, min: 4.0, note: 'подписи на подложках — крупный текст' },
  /* Теги warn/ok/opt в заблокированной/неактивной записи: грид приглушает ink2/warn/opt до muted
   * переопределением токенов (не прозрачностью, финал 5b I1/M3), подложка тега остаётся своей -soft.
   * Порог — как у подписей на подложках (приглушённое состояние, эталон .is-locked .tag muted). */
  { fg: 'muted', bg: ['warn-soft', 'ok-soft', 'opt-soft'], min: 4.0, note: 'приглушённый тег в записи-состоянии' },
  { fg: 'val', bg: ['paper', 'val-soft'], min: 4.5, note: 'значения, в том числе на подсветке' },
  { fg: 'ok', bg: ['paper'], min: 4.5, note: 'успех' },
  { fg: 'ok', bg: ['ok-soft'], min: 4.0, note: 'успех на подсветке (вспышка копирования), замер 4.17 — кратковременная подсветка' },
  { fg: 'bad', bg: ['paper', 'bad-soft'], min: 4.5, note: 'ошибка, в том числе на подсветке' },
  { fg: 'ink', bg: ['bad-soft'], min: 4.5, note: 'текст невалидного чипа TagInput' },
  { fg: 'warn', bg: ['paper'], min: 4.5, note: 'внимание' },
  { fg: 'warn', bg: ['warn-soft'], min: 4.0, note: 'внимание на подсветке, замер 4.26 — кратковременная подсветка' },
  { fg: 'opt', bg: ['paper', 'opt-soft'], min: 4.5, note: 'теги полей, в том числе на подсветке' },
  { fg: 'faint', bg: surfaces, min: 3.0, note: 'служебный токен, не для читаемого текста' },
  { fg: 'paper', bg: ['val'], min: 4.5, note: 'текст на primary-кнопке' },
  { fg: 'paper', bg: ['st-flow', 'st-flowd', 'st-bad', 'st-badd', 'st-warn', 'st-ok'], min: 4.5, note: 'буква в статусной точке' },
  { fg: 'st-letter-soft', bg: ['st-flowl', 'st-okl', 'st-grey'], min: 4.5, note: 'буква в статусной точке на светлых тонах' },
]
