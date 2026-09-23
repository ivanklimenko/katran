import { useRef, useState } from 'react'
import { Button, Input, Menu, Popover } from '@katran/ui'
import s from './Page.module.css'

export function OverlaysPage() {
  const [menu, setMenu] = useState(false)
  const [pop, setPop] = useState(false)
  const [sort, setSort] = useState('status')
  const m = useRef<HTMLButtonElement>(null)
  const p = useRef<HTMLButtonElement>(null)
  const keys = [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }, { id: 'created', label: 'Дата документа' }]
  return (
    <>
      <h1 className={s.h1}>Меню и поповеры</h1>
      <p className={s.note}>Меню сортировки составной колонки: выбранный ключ отмечен, стрелки ходят по пунктам, Escape закрывает и возвращает фокус.</p>
      <div className={s.row}>
        <Button ref={m} onClick={() => setMenu(true)}>Сортировать «Статус» по…</Button>
        <Menu open={menu} anchor={m} onClose={() => setMenu(false)} title="Сортировать «Статус» по"
          items={keys.map((k) => ({ id: k.id, label: k.label, checked: sort === k.id, onSelect: () => setSort(k.id), ...(sort === k.id ? { hint: '↑' } : {}) }))} />
        <Button ref={p} onClick={() => setPop(true)}>Фильтр по сумме</Button>
        <Popover open={pop} anchor={p} onClose={() => setPop(false)} label="Фильтр по сумме">
          <div style={{ display: 'grid', gap: 'var(--k-sp-2)', padding: 'var(--k-sp-2)' }}>
            <Input aria-label="От" placeholder="от" /><Input aria-label="До" placeholder="до" />
            <Button variant="primary" onClick={() => setPop(false)}>Применить</Button>
          </div>
        </Popover>
      </div>
    </>
  )
}
