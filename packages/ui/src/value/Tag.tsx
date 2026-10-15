import type { ReactNode } from 'react'
export type TagProps = { tone?: 'neutral' | 'opt' | 'mt' | 'warn' | 'ok' | undefined; children: ReactNode; className?: string | undefined }
export function Tag({ tone = 'neutral', children, className }: TagProps) {
  return <span className={className ? `k-tag ${className}` : 'k-tag'} data-tone={tone}>{children}</span>
}
