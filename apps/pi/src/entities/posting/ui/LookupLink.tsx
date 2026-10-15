import { useEffect, useRef, useState, type ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, Popover, Skeleton, dimClass, exitOnEdgeTab, useStableId } from '@katran/ui'
import type { LookupView } from '../../../shared/lib/detail'
import { Sr } from '../../../shared/ui'

/* Кнопка-ссылка справочного запроса (эталон a.lnk, grid.html:88–89; сверка Д85): цвет --k-val, подчёркивание при наведении.
   data-framed — «Курс» рядом с суммой 32A, с рамкой (эталон .amt .lnk, grid.html:158) */
const LinkBtn = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: 500 ${k.fsKv} / ${k.lh2} ${k.sans};
  color: ${k.val};
  white-space: nowrap;
  cursor: pointer;

  /* модификатор до состояний — порядок по возрастанию специфичности (no-descending-specificity); свойства не пересекаются */
  &:where([data-framed]) {
    margin-left: ${k.sp2};
    padding: 0 ${k.sp1};
    border: 1px solid ${k.line};
    border-radius: ${k.rS};
    vertical-align: middle;
  }

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

/* Поповер справочного запроса — styled(Popover): группа приложения определена позже панели поповера кита (0,1,0)
   и перебивает её отступ порядком групп */
const LkPop = styled(Popover)`
  padding: ${k.sp2};
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  text-align: left;
  white-space: normal;
`

/* фокус ставит сам поповер (программно) — обводка не нужна, как у заголовка drawer */
const LkBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};

  &:focus {
    outline: none;
  }
`

const LkSkeleton = styled.div`
  min-width: ${k.menuMin};
`

const LkError = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  margin-top: ${k.sp2};
  color: ${k.bad};
`

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
 * Tab с последней остановки, Shift+Tab с первой или с самого содержимого, Tab с содержимого без остановок (скелетон, курс)
 * закрывают поповер с фокусом на ссылке (exitOnEdgeTab кита, как у полей дат): портал в конце документа, иначе Tab увёл бы
 * фокус за страницу, поповер остался бы открыт, а следующий Esc закрыл бы деталь.
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
      <LinkBtn
        ref={btn}
        type="button"
        data-framed={framed ? '' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
      >
        {label}
      </LinkBtn>
      <LkPop open={open} anchor={btn} onClose={() => setOpen(false)} id={id} label={label} manualFocus>
        <div role="presentation" onKeyDown={(e) => exitOnEdgeTab(e, btn, () => setOpen(false))}>
          <LkBody ref={body} tabIndex={-1}>{children}</LkBody>
        </div>
      </LkPop>
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
    <LkError>
      <span role="alert">{text}</span>
      <Button size="s" onClick={onRetry}>Повторить</Button>
    </LkError>
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
      <LkSkeleton aria-busy="true">
        <Sr>Загрузка</Sr>
        <Skeleton.Line lines={lines} width="60%" />
      </LkSkeleton>
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
