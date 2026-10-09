import { useRef, useState, type ReactNode } from 'react'
import { Button, CodeView, Dialog, EditHistory, Input, Menu, Popover, Prompt, type DialogProps, type EditHistoryEntry } from '@katran/ui'
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

const MESSAGE = JSON.stringify({ docId: 'PI-000123', status: 'SENT', amount: '125 000,00', currency: 'USD', receiver: 'ООО «Вымышленный получатель»', lines: Array.from({ length: 30 }, (_, i) => ({ n: i + 1, note: 'строка примера' })) }, null, 2)

/** Сцена окна: Dialog накрывает ближайший позиционированный предок — здесь обёртку с position: relative (в деталке — Drawer.overlay). */
function DialogStage({ opener, children }: { opener: (open: () => void) => ReactNode; children: (close: () => void, open: boolean) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', minHeight: 'calc(var(--k-prompt-w) * 0.75)', flex: '1 1 var(--k-prompt-w)' }}>
      {opener(() => setOpen(true))}
      {children(() => setOpen(false), open)}
    </div>
  )
}

/** Одно свойство — одна сцена: кнопка открывает окно, «Закрыть», Esc и подложка закрывают. */
function DialogExample({ label, ...rest }: { label: string } & Omit<DialogProps, 'open' | 'onClose' | 'footer'>) {
  return (
    <DialogStage opener={(open) => <Button onClick={open}>{label}</Button>}>
      {(close, open) => <Dialog {...rest} open={open} onClose={close} footer={<Button onClick={close}>Закрыть</Button>} />}
    </DialogStage>
  )
}

/** busy: «Отправить» — запрос полсекунды, в это время Esc и подложка не закрывают, кнопки недоступны. */
function BusyDialogDemo() {
  const [busy, setBusy] = useState(false)
  return (
    <DialogStage opener={(open) => <Button onClick={open}>busy</Button>}>
      {(close, open) => (
        <Dialog open={open} busy={busy} title="Переотправка" onClose={close}
          footer={<>
            <Button disabled={busy} onClick={close}>Закрыть</Button>
            <Button variant="primary" disabled={busy} onClick={() => { setBusy(true); window.setTimeout(() => { setBusy(false); close() }, 500) }}>Отправить</Button>
          </>}>
          Во время запроса окно не закрывается ни Esc, ни подложкой.
        </Dialog>
      )}
    </DialogStage>
  )
}

/** initialFocus: при открытии фокус — на «Закрыть», а не на первом фокусируемом («Скопировать»). */
function InitialFocusDemo() {
  const closeRef = useRef<HTMLButtonElement>(null)
  return (
    <DialogStage opener={(open) => <Button onClick={open}>initialFocus</Button>}>
      {(close, open) => (
        <Dialog open={open} title="Фокус на «Закрыть»" onClose={close} initialFocus={() => closeRef.current}
          footer={<><Button>Скопировать</Button><Button ref={closeRef} onClick={close}>Закрыть</Button></>}>
          Начальный фокус задаёт потребитель.
        </Dialog>
      )}
    </DialogStage>
  )
}

/** fallbackFocus: открывшая кнопка пропадает, пока окно открыто, — фокус возвращается на запасной элемент. */
function FallbackFocusDemo() {
  const [open, setOpen] = useState(false)
  const lane = useRef<HTMLButtonElement>(null)
  return (
    <div style={{ position: 'relative', minHeight: 'calc(var(--k-prompt-w) * 0.75)', flex: '1 1 var(--k-prompt-w)' }}>
      <Button ref={lane}>Запасной фокус</Button>{' '}
      {!open && <Button onClick={() => setOpen(true)}>fallbackFocus</Button>}
      <Dialog open={open} title="Кнопка открытия пропала" onClose={() => setOpen(false)} fallbackFocus={() => lane.current}
        footer={<Button onClick={() => setOpen(false)}>Закрыть</Button>}>
        После закрытия фокус — на «Запасной фокус».
      </Dialog>
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
      <h2 className={s.h2}>Dialog</h2>
      <p className={s.note}>Модальное окно поверх своего слоя: подложка, ловушка Tab, Esc и подложка закрывают (Esc не всплывает до деталки), фокус возвращается на открывшую кнопку. По примеру на свойство.</p>
      <div className={s.row} style={{ alignItems: 'stretch' }}>
        <DialogExample label="title, children, footer" title="Окно">Текст окна. Закрывают «Закрыть», Esc и клик по подложке.</DialogExample>
        <DialogExample label='tone="danger"' tone="danger" title="Запрос отклонён">Заголовок — цветом bad.</DialogExample>
        <DialogExample label='size="l"' size="l" title="Исходное сообщение">
          <CodeView code={MESSAGE} language="json" label="Сообщение · JSON" />
        </DialogExample>
        <DialogExample label='role="alertdialog"' role="alertdialog" title="Внимание">Окно, требующее ответа.</DialogExample>
        <BusyDialogDemo />
        <InitialFocusDemo />
        <FallbackFocusDemo />
      </div>
      <h2 className={s.h2}>EditHistory с решением</h2>
      <p className={s.note}>У последней ожидающей записи — «Утвердить» и «Отклонить»; отклонённая запись — бейдж «отклонено», подсказка и причина.</p>
      <div className={s.row} style={{ display: 'block' }}>
        <EditHistory entries={HISTORY} label="поля 57" onConfirm={() => undefined} onReject={() => undefined} />
      </div>
    </>
  )
}
