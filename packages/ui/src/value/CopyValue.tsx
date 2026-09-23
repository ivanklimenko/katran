import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { copyText } from '../format/clipboard'
import { useKatran } from '../provider/useKatran'
import s from './Value.module.css'

export type CopyValueProps = {
  value: string
  display?: ReactNode
  /** Показано сокращённо → тултип с полным значением всегда. */
  short?: boolean
  tone?: 'val' | 'ink' | 'ink2' | 'mono'
  /** Максимальная ширина в px при плотности 1. */
  maxWidth?: number
  tabIndex?: number
  className?: string
}

export const FLASH_MS = 600

export function CopyValue({ value, display, short, tone = 'val', maxWidth, tabIndex, className }: CopyValueProps) {
  const { announce } = useKatran()
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const onClick = async () => {
    if (await copyText(value)) {
      announce('Скопировано')
      setFlash(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setFlash(false), FLASH_MS)
    }
  }
  const style = maxWidth ? ({ maxWidth: `calc(${maxWidth}px * var(--k-density))` } as CSSProperties) : undefined
  return (
    <button
      type="button"
      className={[s.copy, s[tone], flash ? s.flash : '', className].filter(Boolean).join(' ')}
      style={style}
      tabIndex={tabIndex}
      data-k-tip={value}
      data-k-tip-if={short ? undefined : 'truncated'}
      onClick={onClick}
    >
      {display ?? value}
    </button>
  )
}
