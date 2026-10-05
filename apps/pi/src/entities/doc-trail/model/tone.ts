import type { BadgeTone } from '@katran/ui'

// Эталон: решение комплаенса ALLOW → ok, REVIEW → wait (index.html:1290); нотификация OK → ok, иначе bad (1194);
// стриминг и MPU SENT → ok, иначе wait (1188, 1275); связанный документ DONE → ok (моки 767–770).
const OK = ['ALLOW', 'OK', 'SENT', 'DONE', 'EXPORTED', 'PASSED']
const BAD = ['TIMEOUT', 'DENY', 'BLOCK', 'ERROR', 'FAILED', 'REJECTED', 'INVALID']

/** Тон бейджа по коду решения или статуса — одна таблица на все вкладки doc-trail. */
export function toneOf(code: string): BadgeTone {
  const c = code.toUpperCase()
  if (OK.includes(c)) return 'ok'
  if (BAD.includes(c)) return 'bad'
  return 'wait'
}
