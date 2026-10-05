import type { CodeLine, CodeToken } from './types'

/** Ширина строки в знаках, до которой атрибуты остаются в строке тега (эталон XML_LINE, index.html:1206). */
export const XML_LINE = 92

const P = (text: string): CodeToken => ({ kind: 'xp', text })
const X = (text: string): CodeToken => ({ kind: 'xx', text })
const SP: CodeToken = { kind: '', text: ' ' }

// Имя с префиксом пространства имён: префикс с двоеточием приглушён
const name = (n: string, kind: string, nsKind: string): CodeToken[] => {
  const i = n.indexOf(':')
  return i > 0 ? [{ kind: nsKind, text: n.slice(0, i + 1) }, { kind, text: n.slice(i + 1) }] : [{ kind, text: n }]
}
const attr = (a: { name: string; value: string }): CodeToken[] => [...name(a.name, 'xa', 'xans'), P('="'), { kind: 'xv', text: a.value }, P('"')]

// Объявление <?xml …?> DOMParser не отдаёт узлом — берём из текста, как эталон
function declaration(src: string): CodeToken[] | null {
  const decl = /^\s*<\?xml([^?]*)\?>/.exec(src)
  if (decl === null) return null
  const body = decl[1] ?? ''
  const out: CodeToken[] = [P('<?xml')]
  const re = /([\w:.-]+)="([^"]*)"/g
  let at = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m.index > at) out.push({ kind: '', text: body.slice(at, m.index) })
    out.push({ kind: 'xa', text: m[1] ?? '' }, P('="'), { kind: 'xv', text: m[2] ?? '' }, P('"'))
    at = re.lastIndex
  }
  if (at < body.length) out.push({ kind: '', text: body.slice(at) })
  out.push(P('?>'))
  return out
}

/**
 * Раскладка XML по строкам (эталон xmlHtml, index.html:1208–1245): разбор DOMParser, отступ по глубине,
 * атрибуты в строку тега, если «голова» ≤ XML_LINE знаков, иначе столбиком под первым атрибутом;
 * единственный короткий текст — в строке тега; комментарии и инструкции обработки пропускаются, CDATA — как текст.
 * Не разобралось — null: вызывающий показывает сырой текст.
 */
export function layoutXml(src: string): CodeLine[] | null {
  let doc: Document | null = null
  try {
    doc = new DOMParser().parseFromString(src, 'application/xml')
  } catch {
    doc = null
  }
  if (doc === null || doc.getElementsByTagName('parsererror').length > 0 || doc.documentElement === null) return null
  const out: CodeLine[] = []
  const line = (depth: number, tokens: CodeToken[], align?: number) => {
    out.push(align === undefined ? { depth, tokens } : { depth, tokens, align })
  }
  const decl = declaration(src)
  if (decl !== null) line(0, decl)

  const walk = (el: Element, d: number) => {
    const kids = Array.from(el.childNodes).filter((n) => n.nodeType === 1 || ((n.nodeType === 3 || n.nodeType === 4) && (n.nodeValue ?? '').trim() !== ''))
    const attrs = Array.from(el.attributes)
    const tag = el.nodeName
    const open = [P('<'), ...name(tag, 'xt', 'xns')]
    const end = kids.length > 0 ? P('>') : P('/>')
    const close = [P('</'), ...name(tag, 'xt', 'xns'), P('>')]
    const only = kids.length === 1 ? kids[0] : undefined
    const text = only !== undefined && only.nodeType !== 1 ? (only.nodeValue ?? '').trim() : null
    const headLen = d * 2 + tag.length + 2 + attrs.reduce((sum, a) => sum + a.name.length + a.value.length + 4, 0)
    if (headLen <= XML_LINE || attrs.length === 0) {
      const head = [...open, ...attrs.flatMap((a) => [SP, ...attr(a)]), end]
      if (text !== null && headLen + text.length + tag.length + 3 <= XML_LINE) {
        line(d, [...head, X(text), ...close])
        return
      }
      line(d, head)
    } else {
      // столбиком: выравнивание под первым атрибутом — «<» + имя + пробел, в ch моноширинного шрифта
      attrs.forEach((a, k) => {
        const tail = k === attrs.length - 1 ? [end] : []
        if (k === 0) line(d, [...open, SP, ...attr(a), ...tail])
        else line(d, [...attr(a), ...tail], tag.length + 2)
      })
    }
    if (kids.length === 0) return
    if (text !== null) line(d + 1, [X(text)])
    else {
      for (const n of kids) {
        if (n.nodeType === 1) walk(n as Element, d + 1)
        else line(d + 1, [X((n.nodeValue ?? '').trim())])
      }
    }
    line(d, close)
  }
  walk(doc.documentElement, 0)
  return out
}
