import { Button } from '../button'
import s from './State.module.css'
export type ErrorStateProps = { title: string; text?: string | undefined; retry?: (() => void) | undefined }
export function ErrorState({ title, text, retry }: ErrorStateProps) {
  return (
    <div role="alert" className={[s.empty, s.error].join(' ')}>
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {retry && <Button onClick={retry}>Повторить</Button>}
    </div>
  )
}
