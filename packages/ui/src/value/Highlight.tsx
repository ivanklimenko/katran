import type { ReactNode } from 'react'

export type HighlightProps = {
  text: string
  query: string
  className?: string | undefined
}

export function Highlight({ text, query, className }: HighlightProps) {
  // Один символ может занимать две кодовые единицы UTF-16.
  const first = query.codePointAt(0) ?? 0
  if (query.length < 2 || (query.length === 2 && first > 0xffff)) return <>{text}</>

  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(literal, 'giu')
  let match = pattern.exec(text)
  if (match === null) return <>{text}</>

  const parts: ReactNode[] = []
  const markClass = className ? 'k-hl ' + className : 'k-hl'
  let end = 0
  do {
    const { index } = match
    parts.push(text.slice(end, index), <mark key={index} className={markClass}>{match[0]}</mark>)
    end = index + match[0].length
    match = pattern.exec(text)
  } while (match !== null)

  parts.push(text.slice(end))
  return <>{parts}</>
}
