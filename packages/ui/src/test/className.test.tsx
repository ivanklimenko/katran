import { screen } from '@testing-library/react'
import { useRef, type ComponentType, type ReactElement } from 'react'
import { styled } from '../styled'
import { renderK } from './renderK'
import { Button, ButtonLink, IconButton } from '../button'
import { Checkbox, Input, Select } from '../input'
import { TagInput } from '../tag'
import { MultiSelect, SearchSelect, SuggestInput } from '../select'
import { Calendar, DateInput, DateRange } from '../date'
import { ConfigForm, Disclosure, EditHistory, FieldEditor, FieldRow, KeyValueList } from '../form'
import { AccountValue, CopyValue, Counter, EditMark, FieldTag, LinkValue, StatusBadge, StatusDot, SwiftField, Tag, Timestamp } from '../value'
import { ColumnHeader, ColumnsMenu, DataGrid, SortChips, type RecordLayout } from '../grid'
import { BulkBar, FilterPanel, StatusLane } from '../filters'
import { Pagination } from '../pagination'
import { MiniTable } from '../table'
import { Banner, EmptyState, ErrorState, ProgressBar, Skeleton } from '../state'
import { CodeView } from '../code'

/**
 * Спека styled §4.2–4.3: каждый компонент кита с корневым элементом принимает className и ставит его на корень,
 * поэтому у потребителя работает styled(X). Строка на компонент; Task 7–8 добавляют свои строки.
 * (а) className="probe" — на корне; (б) styled(X) с цветом равной специфичности (0,1,0) перебивает правило кита.
 */
type Probe = ComponentType<{ className?: string }>
/** host 'tr' — компонент рендерится в строке таблицы (ячейка шапки), иначе — в div. */
type Row = [name: string, X: unknown, props: Record<string, unknown>, host?: 'tr']

const noop = () => {}
const opts = [{ value: 'a', label: 'Альфа' }, { value: 'b', label: 'Бета' }]
type Doc = { id: string; num: string }
const layout: RecordLayout<Doc> = { rowKey: (d) => d.id, columns: [{ id: 'num', title: 'Номер', sort: [{ id: 'num', label: 'Номер' }], render: (d) => d.num }] }
const grid = {
  label: 'Документы', layout, rows: [{ id: 'd1', num: '800' }], total: 1, page: 1, pageSize: 20, onPage: noop,
  sort: [], onSort: noop, widths: {}, onResize: noop, order: ['num'], hidden: [], onColumns: noop, state: 'ready',
}
const filters = {
  meta: { fields: [] }, conditions: [], draft: [], dirty: false, open: false, onOpenChange: noop, onEdit: noop, onDiscard: noop,
  onApply: noop, onRevert: noop, onReset: noop, onRemove: noop,
}
const mini = { label: 'Статусы', columns: [{ id: 'a', header: 'А', render: (r: string) => r }], rowKey: (r: string) => r, empty: 'Пусто' }
const entry = { who: 'Иванова А.', when: '24.09.2026 10:15', status: 'confirmed', diff: [{ label: '', was: 'A', now: 'B' }] }

const rows: Row[] = [
  ['Button', Button, { children: 'Кнопка' }],
  ['Button primary s', Button, { children: 'Кнопка', variant: 'primary', size: 's' }],
  ['IconButton', IconButton, { label: 'Закрыть', children: '×' }],
  ['ButtonLink', ButtonLink, { href: '#x', children: 'Ссылка' }],
  ['Input', Input, { 'aria-label': 'Поле' }],
  ['Checkbox без подписи', Checkbox, { 'aria-label': 'Отметка' }],
  ['Checkbox с подписью', Checkbox, { label: 'Отметка' }],
  ['Select', Select, { options: opts, 'aria-label': 'Выбор' }],
  ['TagInput', TagInput, { value: ['A1'], onChange: noop, text: '', onTextChange: noop, mode: 'values', 'aria-label': 'Номера' }],
  ['SearchSelect', SearchSelect, { options: opts, value: null, onChange: noop, 'aria-label': 'Выбор' }],
  ['MultiSelect', MultiSelect, { options: opts, value: ['a'], onChange: noop, 'aria-label': 'Выбор' }],
  ['SuggestInput', SuggestInput, { options: opts, value: '', onChange: noop, onCommit: noop, onCancel: noop, 'aria-label': 'Счёт', emptyText: () => 'нет', notInListText: 'нет в списке' }],
  ['Calendar', Calendar, { month: '2026-09-01', onMonthChange: noop, onPick: noop, today: '2026-09-24' }],
  ['DateInput', DateInput, { value: '', onChange: noop, 'aria-label': 'Дата' }],
  ['DateRange', DateRange, { value: { from: '', to: '' }, onChange: noop, label: 'Период' }],
  ['FieldRow', FieldRow, { tag: '20', def: { label: 'Референс', kind: 'ref' }, value: { lines: ['FX1'] } }],
  ['FieldRow текстовое', FieldRow, { tag: '70', def: { label: 'Детали', kind: 'text', lines: 4, width: 35 }, value: { lines: ['/INV/ 1'] } }],
  ['Disclosure', Disclosure, { title: 'Блок', children: 'тело' }],
  ['Disclosure пустой', Disclosure, { title: 'Блок', empty: true }],
  ['ConfigForm', ConfigForm, { schema: { grid: [['20', null]] }, fields: { 20: { label: 'Референс', kind: 'ref' } }, value: () => ({ lines: ['FX1'] }) }],
  ['KeyValueList', KeyValueList, { items: [{ key: 'a', label: 'Ключ', value: 'Значение' }] }],
  ['KeyValueList в две колонки', KeyValueList, { columns: 2, items: [{ key: 'a', label: 'Ключ', value: 'Значение' }] }],
  ['EditHistory', EditHistory, { entries: [entry], label: 'поля 57' }],
  ['FieldEditor', FieldEditor, { tag: '57', name: 'Банк', original: { lines: ['A'] }, value: { lines: ['A'] }, onChange: noop, lines: 2, width: 35, error: null, rule: 'до 35', onCancel: noop, onSave: noop }],
  // горячий путь (R17): обычные элементы k-*, className — конкатенацией
  ['CopyValue', CopyValue, { value: 'FX1' }],
  ['LinkValue', LinkValue, { name: 'UETR', value: 'x' }],
  ['AccountValue', AccountValue, { value: '40817840500010042371' }],
  ['FieldTag', FieldTag, { tag: '50F' }],
  ['StatusDot', StatusDot, { tone: 'flow', label: 'В работе' }],
  ['SwiftField', SwiftField, { main: 'NRDIRUMMXXX' }],
  ['SwiftField пустое', SwiftField, { main: '' }],
  ['Tag', Tag, { children: 'MT103' }],
  ['Counter', Counter, { value: 3 }],
  ['Timestamp', Timestamp, { iso: '2026-09-24T10:15:00' }],
  ['StatusBadge', StatusBadge, { tone: 'neutral', children: 'черновик' }],
  ['EditMark', EditMark, { tip: 'Изменено' }],
  // Task 7: остальной грид и реестр
  ['DataGrid', DataGrid, grid],
  ['SortChips', SortChips, { sort: [{ key: 'num', dir: 'asc' }], columns: layout.columns, onSort: noop }],
  ['ColumnHeader', ColumnHeader, { column: layout.columns[0], sort: [], onSort: noop, width: 90, onResize: noop }, 'tr'],
  ['FilterPanel', FilterPanel, filters],
  ['StatusLane', StatusLane, { label: 'Статусы', items: [{ value: 'E', label: 'Ошибка', tone: 'bad', count: 2 }], value: null, onChange: noop }],
  ['BulkBar', BulkBar, { selection: { mode: 'ids', ids: ['d1'] }, total: 5, onClear: noop }],
  ['Pagination', Pagination, { page: 1, pageSize: 20, total: 87, onPage: noop }],
  ['MiniTable', MiniTable, { ...mini, rows: ['x'] }],
  ['MiniTable пустая', MiniTable, { ...mini, rows: [] }],
  ['EmptyState', EmptyState, { title: 'Пусто' }],
  ['ErrorState', ErrorState, { title: 'Ошибка' }],
  ['ProgressBar', ProgressBar, { label: 'Загрузка' }],
  ['Skeleton.Line', Skeleton.Line, {}],
  ['Skeleton.Block', Skeleton.Block, { height: 20 }],
  ['Banner', Banner, { tone: 'warn', children: 'Текст' }],
  ['CodeView', CodeView, { code: '{}', language: 'json', label: 'JSON' }],
]

/** Корень компонента — первый элемент обёртки-хозяина (порталы поповеров рендерятся вне её). */
function rootOf(ui: ReactElement, host?: 'tr'): Element {
  renderK(host === 'tr' ? <table><thead><tr data-testid="host">{ui}</tr></thead></table> : <div data-testid="host">{ui}</div>)
  const root = screen.getByTestId('host').firstElementChild
  if (!root) throw new Error('компонент ничего не отрисовал')
  return root
}

// rgb() в шаблонах запрещён ради токенов; здесь это проверочное значение, не цвет интерфейса.
const RECOLORED = 'rgb(1, 2, 3)'

describe('className на корне и styled(X) у потребителя (спека styled §4.2)', () => {
  it.each(rows)('%s: className — на корне', (_, X, props, host) => {
    const C = X as Probe
    expect(rootOf(<C {...props} className="probe" />, host)).toHaveClass('probe')
  })

  it.each(rows)('%s: styled(X) перебивает правила кита', (_, X, props, host) => {
    const Recolored = styled(X as Probe)`
      /* stylelint-disable-next-line declaration-property-value-disallowed-list */
      color: rgb(1 2 3);
    `
    const C = Recolored as unknown as Probe
    expect(getComputedStyle(rootOf(<C {...props} />, host)).color).toBe(RECOLORED)
  })

  // корень ColumnsMenu — поповер в портале, вне обёртки-хозяина: ищется по имени
  it('ColumnsMenu: className — на корне поповера, styled(X) перебивает правила кита', () => {
    const Recolored = styled(ColumnsMenu as Probe)`
      /* stylelint-disable-next-line declaration-property-value-disallowed-list */
      color: rgb(1 2 3);
    `
    const C = Recolored as unknown as ComponentType<Record<string, unknown>>
    function Host() {
      const anchor = useRef<HTMLButtonElement>(null)
      return <><button ref={anchor} type="button">Колонки</button><C open anchor={anchor} onClose={noop} columns={layout.columns} order={['num']} hidden={[]} onChange={noop} className="probe" /></>
    }
    renderK(<Host />)
    const root = screen.getByRole('dialog', { name: 'Состав колонок' })
    expect(root).toHaveClass('probe')
    expect(getComputedStyle(root).color).toBe(RECOLORED)
  })
})
