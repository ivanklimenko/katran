import { Button } from '../button'
import { Empty, EmptyText, EmptyTitle } from './parts'

export type ErrorStateProps = { title: string; text?: string | undefined; retry?: (() => void) | undefined; className?: string | undefined }
export function ErrorState({ title, text, retry, className }: ErrorStateProps) {
  return (
    <Empty role="alert" data-kind="error" className={className}>
      <EmptyTitle>{title}</EmptyTitle>
      {text && <EmptyText>{text}</EmptyText>}
      {retry && <Button onClick={retry}>Повторить</Button>}
    </Empty>
  )
}
