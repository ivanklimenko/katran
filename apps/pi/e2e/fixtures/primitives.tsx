import { useState } from 'react'
import { render } from 'react-dom'
import { k } from '@katran/tokens'
import { AmountField, Breadcrumbs, DateInput, Icon, IconButton, Input, KatranFonts, KatranProvider, Link, RadioGroup, Spinner, Text, Textarea, TimeField, TripleState, type DateValue, type RadioOption, type TripleStateValue } from '@katran/ui'

const params = new URLSearchParams(window.location.search)
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
const density = params.get('density') === '1.25' ? 1.25 : 1

const radioOptions: RadioOption[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'blocked', label: 'Закрыт', disabled: true },
  { value: 'ready', label: 'Готов' },
]

const filterHints = { unset: 'Не задано', on: 'Включено', off: 'Выключено' }

function Primitives() {
  const [clicks, setClicks] = useState(0)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [otherStatus, setOtherStatus] = useState<string | null>('draft')
  const [statusChanges, setStatusChanges] = useState(0)
  const [filter, setFilter] = useState<TripleStateValue>('unset')
  const [amount, setAmount] = useState<number | null>(1000.5)
  const [filterChanges, setFilterChanges] = useState(0)
  const [seconds, setSeconds] = useState('')
  const [calendarDate, setCalendarDate] = useState<DateValue>('2026-09-15')

  function changeStatus(value: string) {
    setStatus(value)
    setStatusChanges((count) => count + 1)
  }
  return (
    <KatranProvider theme={theme} density={density}>
      <KatranFonts />
      <div style={{ color: k.val }}>
        <Icon name="search" size="s" label="Поиск" />
        <Icon name="loading" label="Знак загрузки" />
      </div>
      <IconButton name="edit" label="Правка" onClick={() => setClicks((count) => count + 1)} />
      <IconButton name="form-action" label="Свой знак"><span>+</span></IconButton>
      <output aria-label="Число кликов">{clicks}</output>
      <div>
        <Spinner size="s" label="Загрузка S" />
        <Spinner />
        <Spinner size="l" label="Загрузка L" />
      </div>
      <div data-testid="spinner-panel" style={{ width: k.sp8, height: k.sp8 }}>
        <Spinner block label="Загрузка панели" />
      </div>
      <section data-testid="text-samples" style={{ backgroundColor: k.paper }}>
        <Text>Основной текст <Text variant="subhead" as="p">Внутри абзаца</Text></Text>
        <Text variant="subhead">Подзаголовок</Text>
        <Text variant="caption" tone="ink2">Подпись</Text>
        <Text variant="meta" tone="muted">Метаданные</Text>
        <Text variant="inline" weight="bold">Выделение</Text>
      </section>
      <section data-testid="link-samples" style={{ backgroundColor: k.paper }}>
        <Text>Открыть <Link href="#link-target">пример перехода</Link>.</Text>
        <Text variant="caption">Скачать <Link href="data:text/plain,katran" download="katran.txt">пример файла</Link>.</Text>
        <p id="link-target">Цель перехода</p>
      </section>
      <section aria-label="Поля ввода">
        <Textarea aria-label="Комментарий" value={comment} onChange={(event) => setComment(event.currentTarget.value)} />
        <Input aria-label="Однострочное поле" />
        <Textarea aria-label="Невалидный комментарий" size="s" rows={2} invalid placeholder="Укажите причину" />
        <button type="button" onClick={() => setComment('Готовый\nответ')}>Подставить комментарий</button>
      </section>
      <section aria-label="Поля времени">
        <TimeField label="Время с секундами" seconds size="l" notBefore="10:20:30" value={seconds} onChange={setSeconds} />
        <output aria-label="Значение времени">{seconds}</output>
        <DateInput aria-label="Дата для календаря" today="2026-09-15" time value={calendarDate} onChange={setCalendarDate} />
      </section>
      <section aria-label="Радиокнопки">
        <button type="button">Перед радиокнопками</button>
        <RadioGroup label="Статус" name="status" value={status} options={radioOptions} onChange={changeStatus} />
        <RadioGroup label="Другой статус" name="other-status" value={otherStatus} options={radioOptions} onChange={setOtherStatus} />
        <RadioGroup label="Недоступный статус" name="archived-status" value="ready" options={radioOptions} onChange={changeStatus} disabled />
        <output aria-label="Число смен статуса">{statusChanges}</output>
      </section>
      <section aria-label="Пример навигационной цепочки">
        <button type="button">Перед цепочкой</button>
        <Breadcrumbs items={[
          { label: 'Реестры', href: '#registries-target' },
          { label: 'Входящие' },
          { label: 'Платежи', href: '#payments-target' },
        ]} />
        <button type="button">После цепочки</button>
        <p id="registries-target">Раздел реестров</p>
        <p id="payments-target">Раздел платежей</p>
      </section>
      <section aria-label="Фильтр с тремя положениями">
        <button type="button">Перед фильтром</button>
        <TripleState
          label="Фильтр по статусу" icon="filter" hints={filterHints} value={filter}
          onChange={(next) => { setFilter(next); setFilterChanges((count) => count + 1) }}
        />
        <TripleState label="Недоступный фильтр" icon="filter" hints={filterHints} value="off" onChange={setFilter} disabled />
        <output aria-label="Число переключений фильтра">{filterChanges}</output>
      </section>
      <section aria-label="Поле суммы">
        <AmountField label="Сумма платежа" value={amount} onChange={setAmount} />
        <button type="button" onClick={() => setAmount(1000.5)}>Подставить сумму</button>
        <output aria-label="Числовое значение суммы">{String(amount)}</output>
      </section>
    </KatranProvider>
  )
}

render(<Primitives />, document.getElementById('root'))
