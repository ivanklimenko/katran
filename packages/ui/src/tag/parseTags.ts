/** Разбор ввода TagInput (спека §5): values — ID, номера, коды; phrases — текст для поиска по вхождению. */
export type TagMode = 'values' | 'phrases'

/** Предел числа чипов по умолчанию: values — ограничение контракта на IN, phrases — держит фильтр в «не больше 100 условий». */
export const TAG_LIMIT: Record<TagMode, number> = { values: 500, phrases: 20 }

const VALUE_SEP = /[\s;,]+/
const VALUE_SEP_CHAR = /[\s;,]/
// Табуляция в фразах набором не вводится (Tab уводит фокус) — она приходит только вставкой строки из Excel: ячейка — фраза.
const PHRASE_SEP_CHAR = /[;\t\r\n]/
const PHRASE_SEP_ANY = /[;\t\r\n"«»]/
const CLOSE: Record<string, string> = { '"': '"', '«': '»' }

type Scan = { tags: string[]; open: boolean; cut: number }

/** Проход по фразам: кавычки `"…"` и `«…»` дают фразу целиком (разделители внутри — её часть), вне кавычек делят `;`, переносы и табуляция.
 * cut — позиция последнего разделителя вне кавычек, open — текст кончился внутри кавычек. */
function scanPhrases(text: string): Scan {
  const tags: string[] = []
  let buf = ''
  let close: string | null = null
  let cut = -1
  const push = () => {
    const t = buf.trim()
    if (t) tags.push(t)
    buf = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (close !== null) {
      if (ch === close) { push(); close = null } else buf += ch
    } else if (CLOSE[ch] !== undefined) {
      push()
      close = CLOSE[ch]!
    } else if (PHRASE_SEP_CHAR.test(ch)) {
      push()
      cut = i
    } else {
      buf += ch
    }
  }
  push()
  return { tags, open: close !== null, cut }
}

/** Весь текст → чипы: значения обрезаны по краям, пустые отброшены. Незакрытая кавычка закрывается концом текста. */
export function splitTags(text: string, mode: TagMode): string[] {
  return mode === 'values' ? text.split(VALUE_SEP).filter(Boolean) : scanPhrases(text).tags
}

/** Есть ли в тексте разделитель режима — вставку такого текста поле разбирает на чипы, остальную вставляет как текст. */
export function hasSeparator(text: string, mode: TagMode): boolean {
  return (mode === 'values' ? VALUE_SEP_CHAR : PHRASE_SEP_ANY).test(text)
}

/** Набранное: чипы — до последнего разделителя, хвост — остаётся текстом. У фраз открытая кавычка ещё не делит. */
export function takeTags(text: string, mode: TagMode): { tags: string[]; rest: string } {
  let cut = -1
  if (mode === 'phrases') {
    const scan = scanPhrases(text)
    if (scan.open) return { tags: [], rest: text }
    cut = scan.cut
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
