import { useEffect, useRef, useState, type RefObject } from 'react'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { durations, k } from '@katran/tokens'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'

const Tip = styled.div`
  position: fixed;
  z-index: ${k.zTooltip};
  max-width: ${k.tipMax};
  padding: ${k.sp1} ${k.sp2};
  border-radius: ${k.rS};
  background: ${k.ink};
  color: ${k.paper};
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};
  box-shadow: ${k.shadow};
  pointer-events: none;
  white-space: pre-line;
  overflow-wrap: anywhere;
`

type Props = { root: RefObject<HTMLElement | null> }

const findTarget = (e: Event): HTMLElement | null =>
  (e.target as Element | null)?.closest?.('[data-k-tip]') ?? null

const wants = (el: HTMLElement) =>
  el.dataset.kTipIf !== 'truncated' || el.scrollWidth > el.clientWidth

/** Единственный тултип на провайдер. Управляется делегированием событий с корня. */
export function TooltipLayer({ root }: Props) {
  const id = useStableId()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ el: HTMLElement; text: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)
  // тултип на экране (а не только ждёт задержки) — Esc тогда принадлежит ему
  const shown = useRef(false)

  useEffect(() => {
    const host = root.current
    if (!host) return

    const descriptionIds = (el: HTMLElement): string[] => el.getAttribute('aria-describedby')?.match(/\S+/g) ?? []
    const removeTipId = (el: HTMLElement, ids = descriptionIds(el)) => {
      if (!ids.includes(id)) return
      const remaining = ids.filter((descriptionId) => descriptionId !== id)
      if (remaining.length > 0) el.setAttribute('aria-describedby', remaining.join(' '))
      else el.removeAttribute('aria-describedby')
    }

    const updates = new MutationObserver(() => {
      const el = current.current
      if (el && shown.current) update(el)
    })

    function hide() {
      window.clearTimeout(timer.current)
      updates.disconnect()
      if (current.current) removeTipId(current.current)
      current.current = null
      shown.current = false
      setState(null)
    }

    function update(el: HTMLElement) {
      const text = el.dataset.kTip
      if (text === undefined) {
        hide()
        return
      }
      const ids = descriptionIds(el)
      // Таким целям тот же текст уже даёт постоянное описание.
      if (el.hasAttribute('data-k-tip-described')) removeTipId(el, ids)
      else if (!ids.includes(id)) el.setAttribute('aria-describedby', [...ids, id].join(' '))

      setState((previous) => previous?.el === el && previous.text === text ? previous : { el, text })
    }

    const show = (el: HTMLElement) => {
      if (current.current === el) return
      hide()
      if (!wants(el)) return
      current.current = el
      timer.current = window.setTimeout(() => {
        shown.current = true
        updates.observe(el, { attributes: true, attributeFilter: ['data-k-tip', 'data-k-tip-described', 'aria-describedby'] })
        update(el)
      }, durations.base)
    }
    const onOver = (e: Event) => { const t = findTarget(e); if (t) show(t) }
    const onOut = (e: Event) => {
      const t = findTarget(e)
      if (!t || t !== current.current) return
      const to = (e as PointerEvent).relatedTarget as Node | null
      if (to && t.contains(to)) return
      hide()
    }
    /**
     * Видимый тултип забирает Esc себе: preventDefault — сигнал слоям ниже (DrawerStack), что Esc уже обработан;
     * без видимого тултипа событие не трогаем. Всплытие не гасим — поповеру и полям Esc по-прежнему приходит.
     * Цена: preventDefault на захвате window отменяет и действие Esc по умолчанию, пока тултип виден, — например,
     * очистку input[type=search]. Первый Esc прячет тултип, второй делает своё (CHANGELOG, TooltipLayer).
     */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (shown.current) e.preventDefault()
      hide()
    }

    // Цель могла исчезнуть вместе со своим поддеревом (закрылся поповер, ушла строка) —
    // события ухода указателя при этом не приходит, тултип повис бы у пустого места.
    const watch = new MutationObserver(() => {
      if (current.current && !current.current.isConnected) hide()
    })
    watch.observe(host, { childList: true, subtree: true })

    host.addEventListener('pointerover', onOver)
    host.addEventListener('pointerout', onOut)
    host.addEventListener('focusin', onOver)
    host.addEventListener('focusout', onOut)
    // Escape — на window в фазе погружения: поповер глушит всплытие своего keydown (stopPropagation),
    // а захват на window идёт раньше захвата на document при любом порядке подписки — слой видит Esc
    // первым и успевает пометить его (preventDefault) до поповера и DrawerStack, даже если деталка
    // открыта с монтирования (эффекты детей подписываются раньше эффекта провайдера).
    window.addEventListener('keydown', onKey, true)
    return () => {
      hide()
      watch.disconnect()
      host.removeEventListener('pointerover', onOver)
      host.removeEventListener('pointerout', onOut)
      host.removeEventListener('focusin', onOver)
      host.removeEventListener('focusout', onOut)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [root, id])

  useEffect(() => {
    if (!state || !box.current) return
    let alive = true
    computePosition(state.el, box.current, { placement: 'top', middleware: [offset(6), flip(), shift({ padding: 8 })] })
      .then(({ x, y }) => { if (alive && box.current) Object.assign(box.current.style, { left: `${x}px`, top: `${y}px` }) })
    return () => { alive = false }
  }, [state])

  if (!state) return null
  return <Tip ref={box} id={id} role="tooltip">{state.text}</Tip>
}
