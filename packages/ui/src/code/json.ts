import type { CodeToken } from './types'

// Лексемы JSON; строка проверена JSON.parse, поэтому лексер разбирает только корректный текст.
// Строка — шаблоном без возвратов «развёрнутой петлёй»: `"(?:[^"\\]|\\.)*"` даёт в irregexp стек, растущий с длиной
// строки, и RangeError на валидной строке в несколько МБ (base64 в аудите)
const LEX = /("[^"\\]*(?:\\.[^"\\]*)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],:])|(\s+)/g

/**
 * Подсветка JSON (эталон jsonHtml, index.html:1187): ключи, строки, числа, литералы true/false/null, пунктуация.
 * На входе — текст JSON (потребитель делает JSON.stringify(x, null, 2)); не JSON — один кусок без подсветки.
 */
export function tokenizeJson(src: string): CodeToken[] {
  try {
    JSON.parse(src)
  } catch {
    return [{ kind: '', text: src }]
  }
  const out: CodeToken[] = []
  LEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = LEX.exec(src)) !== null) {
    const [text, str, num, lit, punct] = m
    if (str !== undefined) {
      // ключ — строка, за которой (через пробелы) идёт двоеточие
      const rest = src.slice(LEX.lastIndex)
      out.push({ kind: /^\s*:/.test(rest) ? 'key' : 'str', text })
    } else if (num !== undefined) out.push({ kind: 'num', text })
    else if (lit !== undefined) out.push({ kind: 'lit', text })
    else if (punct !== undefined) out.push({ kind: 'punct', text })
    else out.push({ kind: '', text })
  }
  return out
}
