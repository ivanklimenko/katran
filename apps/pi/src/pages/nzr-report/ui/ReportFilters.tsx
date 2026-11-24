import { useState } from 'react'
import { Button, Input, Select } from '@katran/ui'
import { STATUSES, STATUS_LABEL } from '../../../entities/doc-status'
import { EMPTY_FILTERS, type Filters } from '../model/report'
import { Form, Labeled, Panel } from './styles'

export function ReportFilters({ initial, onApply, onReset }: { initial: Filters; onApply: (f: Filters) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState(false)
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((s) => ({ ...s, [key]: value }))
  return (
    <Panel id="nzr-filters" aria-label="Фильтры постановок">
      <Form onSubmit={(e) => {
        e.preventDefault()
        const invalid = Boolean(draft.from && draft.to && draft.from > draft.to)
        setError(invalid)
        if (!invalid) onApply(draft)
      }}>
        <Labeled>Постановка с<Input type="date" value={draft.from} onChange={(e) => update('from', e.target.value)} /></Labeled>
        <Labeled>по<Input type="date" aria-label="Дата постановки по" value={draft.to} invalid={error} onChange={(e) => update('to', e.target.value)} /></Labeled>
        <Labeled>Продукт<Select value={draft.product} placeholder="Все продукты"
          options={['RETAIL', 'CORPORATE'].map((value) => ({ value, label: value }))}
          onChange={(e) => update('product', e.target.value)} /></Labeled>
        <Labeled>Статус документа<Select value={draft.status} placeholder="Все статусы" options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          onChange={(e) => update('status', STATUSES.find((s) => s === e.target.value) ?? '')} /></Labeled>
        <Button variant="primary" type="submit">Применить</Button>
        <Button onClick={() => { setDraft(EMPTY_FILTERS); setError(false); onReset() }}>Сбросить</Button>
        {error && <span role="alert">Дата «по» должна быть не раньше даты «с».</span>}
      </Form>
    </Panel>
  )
}
