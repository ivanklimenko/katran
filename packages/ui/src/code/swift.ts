import type { CodeToken } from './types'

// Эталон swiftHtml (index.html:1207): заголовки блоков {1: … {S:, теги полей в начале строки :20: / :32A:, UETR в {121:…}
const SWIFT = /\{(?:\d|S):|^:\d{2}[A-Z]?:|\{121:([0-9a-f-]{36})\}/gm

const push = (out: CodeToken[], kind: string, text: string) => {
  if (text === '') return
  const last = out[out.length - 1]
  if (kind === '' && last !== undefined && last.kind === '') last.text += text
  else out.push({ kind, text })
}

/** Подсветка сообщения SWIFT MT: blk — заголовок блока, tag — тег поля, uetr — UETR; соседние куски без подсветки склеены. */
export function tokenizeSwift(src: string): CodeToken[] {
  const out: CodeToken[] = []
  SWIFT.lastIndex = 0
  let at = 0
  let m: RegExpExecArray | null
  while ((m = SWIFT.exec(src)) !== null) {
    push(out, '', src.slice(at, m.index))
    const [text, uetr] = m
    if (uetr !== undefined) {
      push(out, '', '{121:')
      push(out, 'uetr', uetr)
      push(out, '', '}')
    } else push(out, text.charAt(0) === '{' ? 'blk' : 'tag', text)
    at = SWIFT.lastIndex
  }
  push(out, '', src.slice(at))
  return out
}
