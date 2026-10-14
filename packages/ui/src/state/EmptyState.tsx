import { Button } from '../button'
import { Empty, EmptyText, EmptyTitle } from './parts'

export type EmptyStateProps = {
  title: string
  text?: string | undefined
  action?: { label: string; onClick: () => void } | undefined
  className?: string | undefined
}
export function EmptyState({ title, text, action, className }: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyTitle>{title}</EmptyTitle>
      {text && <EmptyText>{text}</EmptyText>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </Empty>
  )
}
