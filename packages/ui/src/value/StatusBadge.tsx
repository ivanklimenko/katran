import type { ReactNode } from 'react'
import s from './Value.module.css'

/** ok — успех, bad — ошибка/отказ, wait — в ожидании/на проверке, neutral — без оценки. */
export type BadgeTone = 'ok' | 'bad' | 'wait' | 'neutral'
export type StatusBadgeProps = { tone: BadgeTone; children: ReactNode }

/**
 * Бейдж решения или статуса (эталон .st, index.html:105–107): пилюля на мягкой подложке тона с точкой.
 * Текст — ink2 на всех тонах (ok/warn на своих -soft не дают 4.5, правило контраста), тон несут подложка и точка.
 * Точка декоративная: смысл — в тексте.
 */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className={s.badge} data-badge={tone}>
      <span className={s.badgeDot} aria-hidden="true" />
      {children}
    </span>
  )
}
