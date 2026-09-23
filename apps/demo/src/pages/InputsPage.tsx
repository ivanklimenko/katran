import { useState } from 'react'
import { Checkbox, Input, Select } from '@katran/ui'
import s from './Page.module.css'

export function InputsPage() {
  const [ind, setInd] = useState(true)
  return (
    <>
      <h1 className={s.h1}>Поля ввода</h1>
      <p className={s.note}>Нативные элементы под токенами: клавиатура, автозаполнение и скринридеры работают без усилий.</p>
      <h2 className={s.h2}>Input</h2>
      <div className={s.row}>
        <Input aria-label="Поиск" placeholder="Поиск по реестру" prefix={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></svg>} />
        <Input aria-label="Номер" defaultValue="A1B2C3" invalid />
        <Input aria-label="Малое" size="s" placeholder="s" /><Input aria-label="Большое" size="l" placeholder="l" />
      </div>
      <h2 className={s.h2}>Checkbox</h2>
      <div className={s.row}>
        <Checkbox label="Выбрать все" indeterminate={ind} onChange={() => setInd(false)} />
        <Checkbox label="Отложенные" defaultChecked /><Checkbox label="Недоступно" disabled />
      </div>
      <h2 className={s.h2}>Select</h2>
      <div className={s.row}>
        <Select aria-label="Тип сообщения" placeholder="Тип" options={['MT103', 'MT202', 'MT202COV', 'MT199'].map((v) => ({ value: v, label: v }))} />
        <Select aria-label="Размер" size="s" options={[20, 50].map((v) => ({ value: String(v), label: String(v) }))} />
      </div>
    </>
  )
}
