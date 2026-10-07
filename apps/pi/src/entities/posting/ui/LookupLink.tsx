import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Popover, Skeleton, dimClass, useStableId } from '@katran/ui'
import type { LookupView } from '../../../shared/lib/detail'
import s from './posting.module.css'

export type LookupLinkProps = {
  /** Текст кнопки-ссылки и доступное имя поповера: «Курс», «Проверить баланс». */
  label: string
  /**
   * Состояние и запуск запроса (LookupView): открытие поповера — load (первый раз запрос, дальше кэш); запись снята при
   * открытом поповере (reset после refreshDoc/replaceDetail — idle) — load снова, иначе скелетон висел бы без запроса.
   */
  view: Pick<LookupView<unknown>, 'state' | 'load'>
  /** Рамка вокруг ссылки — «Курс» рядом с суммой 32A (эталон .amt .lnk, сверка Д78, Д85). */
  framed?: boolean | undefined
  children: ReactNode
}

/**
 * Кнопка-ссылка справочного запроса и её поповер (спека 2e §4 п. 6–8): Popover кита, role="dialog", фокус — в содержимое,
 * Esc и клик вне закрывают поповер с возвратом фокуса на ссылку.
 * Фокус держит само содержимое (tabIndex -1), а не первая кнопка: у скелетона и курса кнопок нет, а фокус, оставшийся на
 * ссылке внутри drawer, отдал бы Esc деталке (DrawerStack исключает только цели внутри [role="dialog"] поповера) —
 * закрылась бы деталь вместо поповера (Review Focus 5). Пропавшая кнопка («Повторить» после нажатия) фокус тоже не теряет.
 */
export function LookupLink({ label, view, framed = false, children }: LookupLinkProps) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const id = useStableId()
  const loadRef = useRef(view.load)
  // актуализация ref — в эффекте, не в теле рендера (react-hooks/refs), как в Popover
  useEffect(() => { loadRef.current = view.load })
  const { state } = view
  // открыт и записи нет (первое открытие или reset документа при открытом поповере) — запрос; повтор в полёте модель игнорирует
  useEffect(() => {
    if (open && state === 'idle') loadRef.current()
  }, [open, state])
  useEffect(() => {
    if (open) body.current?.focus()
  }, [open])
  // после каждой отрисовки открытого поповера: фокус потерян (снята кнопка, в которой он был) — обратно в содержимое
  useEffect(() => {
    if (!open) return
    const at = document.activeElement
    if (at === null || at === document.body) body.current?.focus()
  })
  const toggle = () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    // idle грузит эффект выше; ready — кэш (load ничего не делает), error — повторный запрос
    if (state !== 'idle') view.load()
  }
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={[s.lnk, framed ? s.lnkFramed : ''].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
      >
        {label}
      </button>
      <Popover open={open} anchor={btn} onClose={() => setOpen(false)} id={id} label={label} manualFocus className={s.lkPop}>
        <div ref={body} tabIndex={-1} className={s.lkBody}>{children}</div>
      </Popover>
    </>
  )
}

export type LookupBodyProps<T> = {
  view: LookupView<T>
  /** Строк скелетона загрузки. */
  lines?: 1 | 2 | 3 | undefined
  children: (value: T) => ReactNode
}

/** Отказ запроса: текст (role="alert") и «Повторить». */
function LookupError({ text, onRetry }: { text: string | null; onRetry: () => void }) {
  return (
    <div className={s.lkError}>
      <span role="alert">{text}</span>
      <Button size="s" onClick={onRetry}>Повторить</Button>
    </div>
  )
}

/**
 * Содержимое поповера по состоянию запроса (спека 2e §4 п. 8): нет данных — скелетон кита (aria-busy) или ошибка с
 * «Повторить»; данные есть — вид домена, при обновлении приглушён (aria-busy), при неудачном обновлении под ним ошибка
 * и «Повторить» (Review Focus 3).
 */
export function LookupBody<T>({ view, lines = 2, children }: LookupBodyProps<T>) {
  if (view.value === null) {
    if (view.state === 'error') return <LookupError text={view.error} onRetry={view.retry} />
    // idle — load уже отправлен открытием, ответа ещё нет
    return (
      <div className={s.lkSkeleton} aria-busy="true">
        <span className={s.sr}>Загрузка</span>
        <Skeleton.Line lines={lines} width="60%" />
      </div>
    )
  }
  const busy = view.state === 'loading'
  return (
    <div aria-busy={busy || undefined}>
      <div className={busy ? dimClass : undefined}>{children(view.value)}</div>
      {view.state === 'error' && <LookupError text={view.error} onRetry={view.retry} />}
    </div>
  )
}
