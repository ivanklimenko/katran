import { useRef, useState } from 'react'
import { copyText } from '../format/clipboard'
import { useKatran } from '../provider/useKatran'
import { FLASH_MS } from './CopyValue'
import s from './Value.module.css'

export type LinkValueProps = { name: string; value?: string | undefined; tabIndex?: number | undefined }

/** Длинная непонятная строка (uuid, референс) показывается именем; клик копирует значение. */
export function LinkValue({ name, value, tabIndex }: LinkValueProps) {
  const { announce } = useKatran()
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const onClick = async () => {
    if (value && (await copyText(value))) {
      announce('Скопировано')
      setFlash(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setFlash(false), FLASH_MS)
    }
  }
  return (
    <button
      type="button"
      className={[s.link, value ? '' : s.off, flash ? s.flash : ''].filter(Boolean).join(' ')}
      disabled={!value}
      tabIndex={tabIndex}
      data-k-tip={value ? `${value} — копировать` : `${name}: нет значения`}
      onClick={onClick}
    >
      {name}
    </button>
  )
}
