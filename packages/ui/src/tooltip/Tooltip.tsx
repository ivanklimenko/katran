import { cloneElement, isValidElement, type ReactElement } from 'react'

export type TooltipProps = {
  content: string
  /** truncated — показывать только если текст ребёнка обрезан. */
  when?: 'always' | 'truncated'
  children: ReactElement<Record<string, unknown>>
}

/** Обёртка над механизмом data-k-tip. Ребёнок один; атрибуты добавляются ему. */
export function Tooltip({ content, when = 'always', children }: TooltipProps) {
  if (!isValidElement(children)) throw new Error('Tooltip: нужен один элемент-ребёнок')
  return cloneElement(children, {
    'data-k-tip': content,
    'data-k-tip-if': when === 'truncated' ? 'truncated' : undefined,
  })
}
