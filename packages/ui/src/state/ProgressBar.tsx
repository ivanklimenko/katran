import s from './State.module.css'
export function ProgressBar({ label }: { label: string }) {
  return <div role="progressbar" aria-label={label} className={s.progress}><span className={s.progressBar} /></div>
}
