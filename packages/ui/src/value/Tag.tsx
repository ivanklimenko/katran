import type { ReactNode } from 'react'
import s from './Value.module.css'
export type TagProps = { tone?: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok' | undefined; children: ReactNode }
export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={s.tag} data-tone={tone}>{children}</span>
}
