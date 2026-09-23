import { Button } from '../button'
import s from './State.module.css'
export type EmptyStateProps = {
  title: string
  text?: string | undefined
  action?: { label: string; onClick: () => void } | undefined
}
export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className={s.empty}>
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}
