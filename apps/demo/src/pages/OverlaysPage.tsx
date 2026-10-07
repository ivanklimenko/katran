import { useRef, useState } from 'react'
import { Button, EditHistory, Input, Menu, Popover, Prompt, type EditHistoryEntry } from '@katran/ui'
import s from './Page.module.css'

const HISTORY: EditHistoryEntry[] = [
  { who: 'Кузнецов Д. А.', when: '22.09.2026 09:15', status: 'rejected', by: 'Смирнова Е. В.', at: '22.09.2026 09:40', reason: 'BIC не по справочнику', diff: [{ label: '', was: 'VKRBRU8KXXX', now: 'VKRBRU8K2KD' }] },
  { who: 'Иванова М. П.', when: '22.09.2026 10:42', status: 'pending', note: 'Полное наименование филиала', diff: [{ label: '', was: 'VKRBRU8KXXX', now: 'VKRBRU8K3KD' }] },
]

/** Prompt с телом: причина обязательна (okDisabled), запрос «в полёте» (busy) — полсекунды, затем ошибка. */
function RejectPromptDemo() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const close = () => { setOpen(false); setReason(''); setError(undefined) }
  const onResult = (ok: boolean) => {
    if (!ok) { close(); return }
    setBusy(true)
    setError(undefined)
    window.setTimeout(() => { setBusy(false); setError('Нет прав') }, 500)
  }
  return (
    <div style={{ position: 'relative', minHeight: 'calc(var(--k-prompt-w) * 0.75)', width: '100%' }}>
      <Button onClick={() => setOpen(true)}>Отклонить правку…</Button>
      <Prompt open={open} title="Отклонить правку?" okLabel="Отклонить" tone="danger" okDisabled={reason.trim() === ''} busy={busy} error={error} onResult={onResult}>
        <Input aria-label="Причина" placeholder="Причина" maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Prompt>
    </div>
  )
}

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
          items={keys.map((k) => ({ id: k.id, label: k.label, checked: sort === k.id, onSelect: () => setSort(k.id), hint: sort === k.id ? '↑' : undefined }))} />
        <Button ref={p} onClick={() => setPop(true)}>Фильтр по сумме</Button>
        <Popover open={pop} anchor={p} onClose={() => setPop(false)} label="Фильтр по сумме">
          <div style={{ display: 'grid', gap: 'var(--k-sp-2)', padding: 'var(--k-sp-2)' }}>
            <Input aria-label="От" placeholder="от" /><Input aria-label="До" placeholder="до" />
            <Button variant="primary" onClick={() => setPop(false)}>Применить</Button>
          </div>
        </Popover>
      </div>
      <h2 className={s.h2}>Prompt с телом</h2>
      <p className={s.note}>Тело — поле причины: «Отклонить» недоступна, пока причина пуста; во время запроса обе кнопки недоступны, Esc не закрывает; ошибка — строкой над кнопками.</p>
      <div className={s.row}>
        <RejectPromptDemo />
      </div>
      <h2 className={s.h2}>EditHistory с решением</h2>
      <p className={s.note}>У последней ожидающей записи — «Утвердить» и «Отклонить»; отклонённая запись — бейдж «отклонено», подсказка и причина.</p>
      <div className={s.row} style={{ display: 'block' }}>
        <EditHistory entries={HISTORY} label="поля 57" onConfirm={() => undefined} onReject={() => undefined} />
      </div>
    </>
  )
}
