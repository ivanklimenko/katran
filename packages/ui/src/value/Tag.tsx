import type { ReactNode } from 'react'
export type TagProps = { tone?: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok' | undefined; children: ReactNode }
export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className="k-tag" data-tone={tone}>{children}</span>
}
