import type { ReactElement, ReactNode } from 'react'
import { IconButton } from '../button'
import s from './Banner.module.css'

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
}

const X = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>

/**
 * Плашка состояния во всю ширину (спека 2e §2.1): мягкая подложка тона с полосой тона слева, текст ink2 — пары
 * бейджа статуса (StatusBadge): ink2 на ok/warn/bad-soft и chip, ≥ 4,5 в обеих темах (правила контраста токенов).
 * Текст — в role="status", кнопки `actions` и крестик — вне него: статус объявляется без подписей кнопок
 * (как запасное поле ссылки 2d, R20). Обёртка — без роли: группа целиком не объявляется.
 */
export function Banner({ tone, children, actions, onClose, closeLabel = 'Закрыть' }: BannerProps): ReactElement {
  return (
    <div className={s.banner} data-tone={tone}>
      <div role="status" className={s.text}>{children}</div>
      {actions !== undefined && actions !== null && <div className={s.actions}>{actions}</div>}
      {onClose && <IconButton label={closeLabel} size="s" className={s.close} onClick={onClose}><X /></IconButton>}
    </div>
  )
}
