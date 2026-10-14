import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { IconButton } from '../button'
import { css, keyframes, styled } from '../styled'

export type DrawerProps = {
  /** Доступное имя диалога: «Платёжная инструкция № 812345» (видимый заголовок номера не содержит). */
  label: string
  /** Видимый заголовок шапки. */
  title: string
  /** Правее заголовка: uuid линк-кнопкой, дата создания. */
  meta?: ReactNode | undefined
  onClose: () => void
  /**
   * Куда вернуть фокус при закрытии (размонтировании): элемент передаёт вызывающий. Возврат — только если фокус потерян
   * (был внутри drawer и после его снятия оказался на body); фокус, ушедший из drawer в другое место, не трогается.
   * null, снятый со страницы элемент или исключение в функции — фокус не трогается.
   */
  returnFocus?: (() => HTMLElement | null) | undefined
  /**
   * Переводить ли фокус в заголовок при открытии (монтировании); по умолчанию да. false — открытие не пользователем
   * (автооткрытие первой записи): фокус остаётся, где был. Смена focusKey переводит фокус в заголовок в любом случае.
   */
  initialFocus?: boolean | undefined
  /** Смена значения снова переводит фокус в заголовок — повторное открытие уже открытого документа. */
  focusKey?: number | undefined
  /** Метка слота над шапкой: «A» или «B · сравнение». */
  badge?: { text: string; tone: 'a' | 'b' } | undefined
  /**
   * Слой поверх панели (Prompt правки): рисуется вне прокручиваемого содержимого, поэтому `position: absolute; inset: 0`
   * накрывает видимую часть drawer'а и не уезжает при прокрутке (спека 2c §2.1, план Р1).
   */
  overlay?: ReactNode | undefined
  /** keydown панели (обёртка во всю площадь внутри корня) — из любого её элемента (шапка, кнопка закрытия, содержимое, overlay); F5 деталки — спека 2d. */
  onKeyDown?: ((e: KeyboardEvent<HTMLElement>) => void) | undefined
  children?: ReactNode
  /** Класс корня панели. */
  className?: string | undefined
}

const slideFrames = css`
  from {
    opacity: 0;
    transform: translateX(${k.drawerShift});
  }
`
const slideIn = keyframes`${slideFrames}`

/* Ширина — полная, с рамкой: под корнем провайдера content-box, эталон сверяется по внешней ширине */
const Panel = styled.div`
  box-sizing: border-box;
  position: relative;
  flex: none;
  width: ${k.drawer};
  height: 100%;
  overflow: hidden;
  background: ${k.paper};
  border-left: 1px solid ${k.line};
  box-shadow: ${k.shadow};
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
  pointer-events: auto;
  animation: ${slideIn} ${k.tDrawer} ease-out both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/* Обёртка клавиш (onKeyDown) во всю панель: позиционирована — слой overlay с inset: 0 накрывает ту же площадь, что и корень */
const Keys = styled.div`
  position: absolute;
  inset: 0;
`

/* Прокрутка — внутри, а не у корня: слой overlay (Prompt) с inset: 0 накрывает видимую часть панели и не уезжает с содержимым (спека 2c §2.1) */
const Scroll = styled.div`
  box-sizing: border-box;
  height: 100%;
  overflow: hidden auto;
`

/* Метка слота (эталон .slotlbl): прилипает к верху прокручиваемой части. B — warn-soft/ink2: paper на warn ниже 4.5 для мелкого текста */
const Badge = styled.span`
  position: sticky;
  top: 0;
  z-index: 1;
  float: right;
  padding: 0 ${k.sp1};
  border-radius: 0 0 0 ${k.rS};
  font: 600 ${k.fs3} / ${k.lh3} ${k.sans};
  letter-spacing: 0.06em;

  &[data-tone='a'] {
    background: ${k.val};
    color: ${k.paper};
  }

  &[data-tone='b'] {
    background: ${k.warnSoft};
    color: ${k.ink2};
  }
`

/* Шапка 44 = sp-2 + кнопка h-ctl-m 28 + sp-2 (эталон .dh: 10 + 26 + 8) */
const Head = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  padding: ${k.sp2} ${k.dwPad};
`

const Title = styled.h2`
  margin: 0;
  font: 700 ${k.fsH2} / ${k.lh1} ${k.sans};
  white-space: nowrap;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 2px;
  }
`

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  min-width: 0;
  color: ${k.muted};
  font-size: ${k.fs2};
`

const Close = styled(IconButton)`
  margin-left: auto;
  flex: none;
`

const X = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>

type ReturnRef = { current: (() => HTMLElement | null) | undefined }
/**
 * Куда кит сам вернул фокус последним закрытием. Фокус, который стоит там же, не пользовательский: Esc по B вернул его
 * на кнопку B, следующий Esc по A должен вернуть его на кнопку A (спека 2a §5), а не оставить у B.
 */
let restoredTo: HTMLElement | null = null

/**
 * Возврат фокуса — отдельной функцией: в очистке эффекта читается последняя переданная returnFocus, а не снимок монтирования.
 * Очистка пассивная — узла drawer уже нет, фокус, бывший внутри, браузер перевёл на body. Возврат — только если фокус
 * потерян так (или стоит там, куда его поставило прошлое закрытие): фокус, который пользователь увёл сам, не трогается.
 * Исключение вызывающего глушится: брошенное из очистки эффекта в React 17 размонтирует всё дерево.
 */
function restoreFocus(ref: ReturnRef) {
  const active = document.activeElement
  if (active !== null && active !== document.body && active !== restoredTo) return
  try {
    const el = ref.current?.()
    if (el && el.isConnected) {
      el.focus()
      restoredTo = el
    }
  } catch {
    // фокус не трогается — как при null
  }
}

/**
 * Панель деталки фиксированной ширины у правого края окна (спека 2a §3.1). Не модальная: реестр под ней рабочий,
 * поэтому роль dialog без aria-modal. Esc и раскладку двух панелей держит DrawerStack.
 * Корень не прокручивается: прокрутка — во внутреннем `data-part="scroll"` (метка слота, шапка, содержимое),
 * слой `overlay` — после него, поверх панели (спека 2c §2.1).
 */
export function Drawer({ label, title, meta, onClose, returnFocus, initialFocus = true, focusKey, badge, overlay, onKeyDown, children, className }: DrawerProps) {
  const head = useRef<HTMLHeadingElement>(null)
  const returnRef = useRef(returnFocus)
  // Актуализация ref — в эффекте, не в теле рендера (правило react-hooks/refs), как в Popover
  useEffect(() => { returnRef.current = returnFocus })
  // фокус в заголовок — при открытии (если initialFocus) и по запросу (смена focusKey)
  const mounted = useRef(false)
  const initialRef = useRef(initialFocus)
  useEffect(() => {
    if (mounted.current || initialRef.current) head.current?.focus()
    mounted.current = true
  }, [focusKey])
  // при закрытии — туда, откуда открыли
  useEffect(() => () => restoreFocus(returnRef), [])
  return (
    <Panel role="dialog" aria-label={label} data-k-drawer="" data-slot={badge?.tone} className={className}>
      {/* клавиши — на обёртке role="presentation" во всю панель (как подложка Prompt): keydown любого элемента панели всплывает сюда */}
      <Keys role="presentation" onKeyDown={onKeyDown}>
        <Scroll data-part="scroll">
          {badge && <Badge data-tone={badge.tone}>{badge.text}</Badge>}
          {/* div, а не header: два drawer'а дали бы два ориентира banner (axe landmark-no-duplicate-banner) */}
          <Head data-part="head">
            <Title ref={head} tabIndex={-1}>{title}</Title>
            {meta && <Meta>{meta}</Meta>}
            <Close label="Закрыть" onClick={onClose}><X /></Close>
          </Head>
          {children}
        </Scroll>
        {overlay}
      </Keys>
    </Panel>
  )
}
