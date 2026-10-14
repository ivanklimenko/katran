import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { useStableId } from '../compat/useStableId'
import { css, keyframes, styled } from '../styled'

export type DialogTone = 'neutral' | 'danger'

export type DialogProps = {
  open: boolean
  /** Видимый заголовок и доступное имя окна (aria-labelledby). */
  title: string
  /** Esc, mousedown левой кнопкой по подложке — пока не `busy`. Кнопки footer закрывают окно сами. */
  onClose: () => void
  children: ReactNode
  /** Кнопки окна — справа внизу. */
  footer?: ReactNode | undefined
  /** danger — заголовок цветом bad. */
  tone?: DialogTone | undefined
  /** Запрос в полёте: aria-busy на окне, Esc и подложка не вызывают onClose. Кнопки гасит потребитель. */
  busy?: boolean | undefined
  /** m — ширина Prompt (токен prompt-w), l — окно сообщения (токен dialog-l); по умолчанию m. */
  size?: 'm' | 'l' | undefined
  /** По умолчанию dialog; Prompt передаёт alertdialog. */
  role?: 'dialog' | 'alertdialog' | undefined
  /** Куда поставить фокус при открытии; null/undefined — первый фокусируемый окна, нет такого — само окно. */
  initialFocus?: (() => HTMLElement | null | undefined) | undefined
  /**
   * Куда вернуть фокус при закрытии, если элемент, бывший в фокусе при открытии, уже не в DOM или фокуса не было (body).
   * Вызывается в момент закрытия.
   */
  fallbackFocus?: (() => HTMLElement | null | undefined) | undefined
  /** Класс корня — подложки окна. */
  className?: string | undefined
}

const fadeFrames = css`
  from {
    opacity: 0;
  }
`
const fadeIn = keyframes`${fadeFrames}`

const riseFrames = css`
  from {
    opacity: 0;
    transform: translateY(${k.promptShift});
  }
`
const riseIn = keyframes`${riseFrames}`

/* Подложка (эталон .pr-scrim, prompt.css): накрывает ближайший позиционированный предок — в деталке слой overlay Drawer,
   только свой документ, а не страницу */
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;

  /* строка — не выше слоя: иначе неявная строка auto растёт по окну и max-height: 100% окна не ограничивает (тело не прокручивается) */
  grid-template-rows: minmax(0, 1fr);
  place-items: center;
  padding: ${k.sp4};
  background: ${k.scrim};
  animation: ${fadeIn} ${k.tFast} ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Title = styled.h4`
  flex: none;
  margin: 0;
  font: 600 ${k.fsPrompt} / 1.35 ${k.sans};
  color: ${k.ink};
`

/* Окно (эталон .pr): рамка, отступы 16 / 16 / 12, радиус 8, подъём 6 → 0 при появлении; не выше слоя — тело прокручивается */
const Box = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(${k.promptW}, 100%);
  max-height: 100%;
  min-height: 0;
  padding: ${k.sp4} ${k.sp4} ${k.sp3};
  border: 1px solid ${k.line};
  border-radius: ${k.rL};
  background: ${k.paper};
  box-shadow: ${k.shadow};
  color: ${k.ink};
  animation: ${riseIn} ${k.tFast} ease-out;

  /* size="l" — окно сообщения */
  &[data-size='l'] {
    width: min(${k.dialogL}, 100%);
  }

  /* фокус на окне — только от клика по его тексту (tabIndex -1, с клавиатуры недостижимо): без обводки */
  &:focus {
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  /* tone="danger" — акцент заголовка */
  &[data-tone='danger'] > ${Title} {
    color: ${k.bad};
  }
`

/* тело под заголовком; длинное (код сообщения) прокручивается внутри окна */
const Content = styled.div`
  min-height: 0;
  margin-top: ${k.sp3};
  overflow: auto;
  font: ${k.fs1} / 1.45 ${k.sans};
  color: ${k.ink2};
`

const Acts = styled.div`
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: ${k.sp2};
  margin-top: ${k.sp4};
`

/**
 * Внутренние расширения для Prompt (не экспортируются из пакета): Prompt рисуется поверх Dialog без изменения поведения 2c–2d.
 * `describedBy` — id пояснения; `scrimMark` — data-k-prompt на подложке Prompt (на него опирается e2e 2d; модальный слой Popover и правка приложения
 * узнают по data-k-dialog — его несёт подложка любого Dialog);
 * `bare` — тело без обёртки (отступы блоков Prompt — свои); `refocusKey` — смена при открытом окне заново ставит начальный фокус
 * (Prompt: tone); `watchKey` — смена заново проверяет потерю фокуса (Prompt: okDisabled).
 */
export type DialogFrameProps = DialogProps & {
  describedBy?: string | undefined
  scrimMark?: 'prompt' | undefined
  bare?: boolean | undefined
  refocusKey?: string | undefined
  watchKey?: boolean | undefined
}

/** Фокусируемые элементы окна (ловушка Tab): поля, кнопки, ссылки (кроме tabindex="-1") и элементы с неотрицательным tabindex, кроме недоступных. */
const FOCUSABLE = 'input, textarea, select, button, a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
const focusables = (box: HTMLElement): HTMLElement[] =>
  Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute('type') !== 'hidden')

/**
 * Модальное окно внутри своего слоя (спека 2e §2.1): без портала — подложка `position: absolute; inset: 0` накрывает
 * ближайший позиционированный предок (в деталке — слой Drawer.overlay, только этот drawer; в демо — обёртку с
 * `position: relative`). Окно — dialog (или alertdialog) с aria-modal и именем из заголовка; Tab ходит по кругу по всем
 * фокусируемым окна; Esc — onClose без всплытия (drawer не закрывается), mousedown левой кнопкой по подложке — onClose;
 * `busy` гасит оба. Закрытие (open → false или размонтирование) возвращает фокус туда, где он был при открытии, если тот
 * элемент ещё в DOM; иначе — на `fallbackFocus()`. Без `dialog.showModal` и `inert` (Chromium 88).
 */
export function Dialog(props: DialogProps): ReactElement | null {
  return <DialogFrame {...props} />
}

export function DialogFrame({
  open, title, onClose, children, footer, tone = 'neutral', busy = false, size = 'm', role = 'dialog', initialFocus, fallbackFocus,
  className, describedBy, scrimMark, bare = false, refocusKey, watchKey,
}: DialogFrameProps): ReactElement | null {
  const titleId = useStableId()
  const box = useRef<HTMLDivElement>(null)
  // функции фокуса — свежие из последнего рендера, без пересоздания эффектов
  const initial = useRef(initialFocus)
  const fallback = useRef(fallbackFocus)
  useLayoutEffect(() => {
    initial.current = initialFocus
    fallback.current = fallbackFocus
  })

  useEffect(() => {
    if (!open) return undefined
    const before = document.activeElement
    const target = initial.current?.() ?? (box.current && (focusables(box.current)[0] ?? box.current))
    target?.focus()
    return () => {
      // body — фокуса не было (открывшая кнопка пропала, едва окно открылось): тоже запасной
      if (before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus()
      else fallback.current?.()?.focus()
    }
  }, [open, refocusKey])

  // кнопка, ставшая недоступной (busy), теряет клавиатуру: фокус — на окно, чтобы Esc и Tab оставались в нём
  useEffect(() => {
    if (!open || !box.current) return
    const active = document.activeElement
    const lost = active === null || active === document.body
      || (box.current.contains(active) && (active as HTMLButtonElement).disabled === true)
    if (lost) box.current.focus()
  }, [open, busy, watchKey])

  if (!open) return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onClose()
    } else if (e.key === 'Tab' && box.current) {
      // по кругу по всем фокусируемым; с окна (вне списка) Tab — на первый, Shift+Tab — на последний
      e.preventDefault()
      const all = focusables(box.current)
      if (all.length === 0) return
      const i = all.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : (i < 0 || i === all.length - 1 ? 0 : i + 1)
      all[next]?.focus()
    }
  }
  // только левой кнопкой и по самой подложке: mousedown внутри окна сюда приходит с другим target
  const onScrimDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!busy && e.button === 0 && e.target === e.currentTarget) onClose()
  }

  return (
    // клавиши — на подложке (role="presentation", как обёртки поповеров кита): фокус всегда внутри окна, keydown всплывает сюда
    <Scrim
      role="presentation"
      className={className}
      data-k-dialog=""
      data-k-prompt={scrimMark === 'prompt' ? '' : undefined}
      onMouseDown={onScrimDown}
      onKeyDown={onKeyDown}
    >
      <Box
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-busy={busy || undefined}
        ref={box}
        // клик по тексту окна фокусирует его, а не body: Esc и ловушка Tab продолжают работать
        tabIndex={-1}
        data-size={size}
        data-tone={tone}
      >
        <Title id={titleId}>{title}</Title>
        {bare ? children : <Content>{children}</Content>}
        {footer !== undefined && footer !== null && <Acts>{footer}</Acts>}
      </Box>
    </Scrim>
  )
}
