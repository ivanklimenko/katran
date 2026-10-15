import type { ReactElement, ReactNode } from 'react'
import { k } from '@katran/tokens'
import { IconButton } from '../button'
import { styled } from '../styled'

export type BannerTone = 'neutral' | 'warn' | 'bad' | 'ok'

export type BannerProps = {
  tone: BannerTone
  /** Текст плашки — в role="status". */
  children: ReactNode
  /** Слот кнопок справа — вне role="status". */
  actions?: ReactNode | undefined
  /** Есть — кнопка-крестик закрытия справа. */
  onClose?: (() => void) | undefined
  /** Доступное имя крестика; по умолчанию «Закрыть». */
  closeLabel?: string | undefined
  className?: string | undefined
}

/* Плашка состояния (спека 2e §2.1): во всю ширину, подложка тона, полоса тона слева 3 px (как уведомление действия 2d);
   текст ink2 — пара бейджа статуса: ink2 на chip / ok-soft / warn-soft / bad-soft проходит 4,5 в обеих темах */
const Root = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  box-sizing: border-box;
  width: 100%;
  min-height: ${k.hCtlL};
  padding: ${k.sp1} ${k.sp2} ${k.sp1} ${k.sp3};
  border-left: 3px solid ${k.stGrey};
  border-radius: ${k.rM};
  background: ${k.chip};
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink2};

  &[data-tone='warn'] {
    border-left-color: ${k.stWarn};
    background: ${k.warnSoft};
  }

  &[data-tone='bad'] {
    border-left-color: ${k.stBad};
    background: ${k.badSoft};
  }

  &[data-tone='ok'] {
    border-left-color: ${k.stOk};
    background: ${k.okSoft};
  }
`

const Text = styled.div`
  flex: 1;
  min-width: 0;
  padding: ${k.sp1} 0;
`

const Actions = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${k.sp2};
`

/** Крестик — переопределение кнопки кита: группа styled(IconButton) стоит в листе позже и при равной специфичности перебивает её. */
const Close = styled(IconButton)`
  flex: none;
  color: ${k.ink2};
`

const X = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>

/**
 * Плашка состояния во всю ширину (спека 2e §2.1): мягкая подложка тона с полосой тона слева, текст ink2 — пары
 * бейджа статуса (StatusBadge): ink2 на ok/warn/bad-soft и chip, ≥ 4,5 в обеих темах (правила контраста токенов).
 * Текст — в role="status", кнопки `actions` и крестик — вне него: статус объявляется без подписей кнопок
 * (как запасное поле ссылки 2d, R20). Обёртка — без роли: группа целиком не объявляется.
 */
export function Banner({ tone, children, actions, onClose, closeLabel = 'Закрыть', className }: BannerProps): ReactElement {
  return (
    <Root className={className} data-tone={tone}>
      <Text role="status">{children}</Text>
      {actions !== undefined && actions !== null && <Actions>{actions}</Actions>}
      {onClose && <Close label={closeLabel} size="s" onClick={onClose}><X /></Close>}
    </Root>
  )
}
