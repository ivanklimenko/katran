/** Разбор ввода TagInput (спека §5): values — ID, номера, коды; phrases — текст для поиска по вхождению. */
export type TagMode = 'values' | 'phrases'

/** Предел числа чипов по умолчанию: values — ограничение контракта на IN, phrases — держит фильтр в «не больше 100 условий». */
export const TAG_LIMIT: Record<TagMode, number> = { values: 500, phrases: 20 }

const VALUE_SEP = /[\s;,]+/
const VALUE_SEP_CHAR = /[\s;,]/
// Табуляция в фразах набором не вводится (Tab уводит фокус) — она приходит только вставкой строки из Excel: ячейка — фраза.
const PHRASE_SEP_CHAR = /[;\t\r\n]/
const CLOSE: Record<string, string> = { '"': '"', '«': '»' }

type Scan = { tags: string[]; cut: number }

/** Проход по фразам. Сегменты делят `;`, табуляция и переносы. Сегмент целиком из фраз в кавычках через пробел
 * (`"…"`, `«…»`; закрывает кавычка того же вида) — это эти фразы без кавычек, а разделители внутри таких кавычек
 * сегмент не делят (ячейка Excel `"a; b"`). Любой другой сегмент — одна фраза как есть, с кавычками: `ООО «Ромашка»`,
 * `до "в кавычках" после`; кавычка посреди сегмента ничего не держит. Незакрытая кавычка цепочки в конце текста
 * снимается, её фраза идёт до конца.
 * cut — позиция последнего разделителя вне кавычек: разделитель внутри незакрытой кавычки его не сдвигает, поэтому
 * набор такого сегмента ещё не делится. */
function scanPhrases(text: string): Scan {
  const tags: string[] = []
  let cut = -1
  let start = 0
  // сегмент пока — цепочка фраз в кавычках; parts — их содержимое
  let chain = true
  let parts: string[] = []
  // перед кавычкой был пробел или начало сегмента — кавычка может открыть очередную фразу цепочки
  let gap = true
  let close: string | null = null
  let from = 0
  const push = (t: string) => { const v = t.trim(); if (v) tags.push(v) }
  const endSegment = (to: number) => {
    if (chain) parts.forEach(push); else push(text.slice(start, to))
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (close !== null) {
      if (ch === close) { parts.push(text.slice(from, i)); close = null; gap = false }
    } else if (PHRASE_SEP_CHAR.test(ch)) {
      endSegment(i)
      cut = i
      start = i + 1
      chain = true
      parts = []
      gap = true
    } else if (!chain) {
      // сегмент уже одна фраза как есть
    } else if (/\s/.test(ch)) {
      gap = true
    } else if (gap && CLOSE[ch] !== undefined) {
      close = CLOSE[ch]!
      from = i + 1
    } else {
      chain = false
    }
  }
  if (close !== null) parts.push(text.slice(from))
  endSegment(text.length)
  return { tags, cut }
}

/** Весь текст → чипы: значения обрезаны по краям, пустые отброшены. Незакрытая кавычка цепочки закрывается концом текста. */
export function splitTags(text: string, mode: TagMode): string[] {
  return mode === 'values' ? text.split(VALUE_SEP).filter(Boolean) : scanPhrases(text).tags
}

/** Делится ли текст на несколько чипов: у values — есть разделитель; у phrases — есть `;`, табуляция, перенос
 * или разбор даёт больше одной фразы (цепочка в кавычках). Такую вставку поле разбирает на чипы, остальную вставляет текстом. */
export function hasSeparator(text: string, mode: TagMode): boolean {
  return mode === 'values' ? VALUE_SEP_CHAR.test(text) : PHRASE_SEP_CHAR.test(text) || scanPhrases(text).tags.length > 1
}

/** Набранное: чипы — до последнего разделителя, хвост — остаётся текстом. У фраз разделитель внутри незакрытой кавычки цепочки ещё не делит. */
export function takeTags(text: string, mode: TagMode): { tags: string[]; rest: string } {
  let cut = -1
  if (mode === 'phrases') {
    // cut — последний разделитель вне кавычек: сегмент с незакрытой кавычкой цепочки целиком остаётся в хвосте
    cut = scanPhrases(text).cut
  } else {
    for (let i = text.length - 1; i >= 0 && cut < 0; i--) if (VALUE_SEP_CHAR.test(text[i]!)) cut = i
  }
  if (cut < 0) return { tags: [], rest: text }
  return { tags: splitTags(text.slice(0, cut + 1), mode), rest: text.slice(cut + 1).trimStart() }
}

/** Ключ повтора: values — точное совпадение, phrases — без учёта регистра. */
export const tagKey = (t: string, mode: TagMode): string => (mode === 'phrases' ? t.toLowerCase() : t)

/** Добавить чипы: повторы пропускаются, сверх max — не добавляются и считаются в dropped. */
export function mergeTags(current: string[], add: string[], mode: TagMode, max: number): { value: string[]; added: number; dropped: number } {
  const seen = new Set(current.map((t) => tagKey(t, mode)))
  const value = current.slice()
  let added = 0
  let dropped = 0
  for (const t of add) {
    const k = tagKey(t, mode)
    if (seen.has(k)) continue
    seen.add(k)
    if (value.length >= max) { dropped++; continue }
    value.push(t)
    added++
  }
  return { value, added, dropped }
}
