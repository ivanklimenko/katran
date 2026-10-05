import type { ReactNode } from 'react'
import s from './trail.module.css'

/** Пустое значение: «—» глазами, «не заполнено» скринридером (как FieldRow и KeyValueList кита). */
export function Nil() {
  return <span className={s.nil}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
}

export type LinkButtonProps = {
  children: ReactNode
  onClick: () => void
  /** Доступное имя, если видимого текста мало («Исходное сообщение, отправка 2»); видимый текст — его начало. */
  label?: string | undefined
  mono?: boolean | undefined
}

/** Ссылка-кнопка вкладки (эталон a.lnk): заглушки 2d и переход к связанному документу. */
export function LinkButton({ children, onClick, label, mono }: LinkButtonProps) {
  return (
    <button type="button" className={[s.lnk, mono ? s.lnkMono : ''].filter(Boolean).join(' ')} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** Пустое состояние вкладки без таблицы (эталон .tt .empty): «Аудит пуст», «Комплаенс-проверок нет». */
export function TrailEmpty({ text }: { text: string }) {
  return <div className={s.box}><p className={s.empty}>{text}</p></div>
}

/** Сводка в заголовке аккордеона справа (эталон .au .ah .lbl): длина исходника, число ключей секции. */
export function HeadNote({ children }: { children: ReactNode }) {
  return <span className={s.len}>{children}</span>
}
