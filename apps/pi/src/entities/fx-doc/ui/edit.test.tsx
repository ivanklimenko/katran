import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm, Prompt } from '@katran/ui'
import type { AccountsSlot, EditContext } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import type { FxDocDetail } from '../model/detail'
import type { FxHistEntry } from '../model/edit'
import { fxDocDetailDomain as dom } from './detail'
import { fxCommitView, fxDecisionFocus, fxDecisionNote } from './edit'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const entry = (p: Partial<FxHistEntry>): FxHistEntry => ({
  who: 'Вы', when: '2026-09-23T11:05:00', was: '', now: '', note: null, status: 'pending', by: null, at: null, reason: null, ...p,
})
const ctx = (p: Partial<EditContext> = {}): EditContext => ({
  docId: d.id, editing: null, draft: null, error: null, saving: false, saveError: null, confirm: null,
  onConfirm: vi.fn(), open: vi.fn(), change: vi.fn(), cancel: vi.fn(), save: vi.fn(), revert: vi.fn(),
  accounts: vi.fn(() => null), retryAccounts: vi.fn(),
  decision: null, canDecide: () => false, confirmEdit: vi.fn(), rejectEdit: vi.fn(), changeReason: vi.fn(), onDecision: vi.fn(),
  ...p,
})
const renderEdit = (doc: FxDocDetail, edit: EditContext | null) => renderK(
  <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)} present={dom.present}
    optionLabels={dom.optionLabels} renderHero={(id) => dom.renderHero(doc, id, edit)} renderBlock={(id) => dom.renderBlock(doc, id, edit)}
    edit={edit && dom.formEdit ? dom.formEdit(doc, edit) : undefined} />,
)
const pen = (tag: string) => screen.queryByRole('button', { name: `Редактировать поле ${tag}` })

describe('виды правки валюты (план 2c, Task 9)', () => {
  it('«Общие»: карандаши у 50/52/56/57/59/70/72, нет у 53/54/55/71A/79; поле 57 с правкой — изменено, аудит «2 изменения»', async () => {
    const edit = ctx()
    renderEdit(d, edit)
    for (const tag of ['50', '52', '56', '57', '59', '70', '72']) expect(pen(tag), tag).toBeInTheDocument()
    for (const tag of ['53', '54', '55', '71A', '79']) expect(pen(tag), tag).toBeNull()
    const f57 = document.querySelector('[data-field="57"]') as HTMLElement
    expect(f57).toHaveAttribute('data-edited')
    expect(f57).toHaveAttribute('data-k-tip', 'Изменено: Иванова М. П., 23.09.2026 10:42')
    await userEvent.click(within(f57).getByRole('button', { expanded: false }))
    expect(f57).toHaveTextContent('2 изменения')
    expect(f57).toHaveTextContent('Кузнецов Д. А., Иванова М. П.')
    await userEvent.click(pen('57')!)
    expect(edit.open).toHaveBeenCalledWith('field:57', d.fields['57'])
  })

  it('открытый редактор 57: «Как есть» — исходное, черновик — edit.draft, правило подвала', async () => {
    const edit = ctx({ editing: 'field:57', draft: { opt: 'A', lines: ['N'.repeat(36), 'VKRBRU8KXXX'] }, error: 'Строка 1: 36 символов, максимум 35' })
    renderEdit(d, edit)
    const editor = screen.getByRole('region', { name: 'Поле 57 · Банк получателя — правка' })
    expect(editor).toHaveTextContent('VOSTOCHNY KREDIT BANK') // was первой записи истории
    expect(within(editor).getByRole('textbox', { name: 'Строка 1' })).toHaveValue('N'.repeat(36))
    expect(editor).toHaveTextContent('4 строк по 35 символов, набор SWIFT X')
    expect(editor).toHaveTextContent('Строка 1: 36 символов, максимум 35')
    expect(within(editor).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    // подсвечена только виноватая строка 1 (Д64), описание ошибкой — у всех
    expect(within(editor).getByRole('textbox', { name: 'Строка 1' })).toHaveAttribute('aria-invalid', 'true')
    expect(within(editor).getByRole('textbox', { name: 'Строка 2' })).not.toHaveAttribute('aria-invalid')
    expect(within(editor).getByRole('textbox', { name: 'Строка 2' })).toHaveAccessibleDescription('Строка 1: 36 символов, максимум 35')
    await userEvent.type(within(editor).getByRole('textbox', { name: 'Строка 2' }), 'Z')
    expect(edit.change).toHaveBeenLastCalledWith({ opt: 'A', lines: ['N'.repeat(36), 'VKRBRU8KXXXZ', '', ''] })
  })

  it('20 исх: Enter — save, Esc — cancel, mousedown вне — cancel; ↺ — revert(refOut, текущее, исходное)', async () => {
    const edit = ctx({ editing: 'refOut', draft: 'FX1' })
    const { unmount } = renderEdit(d, edit)
    const input = screen.getByRole('textbox', { name: '20 исх' })
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('maxLength', '16')
    expect(input.closest('[data-k-edit]')).toHaveTextContent('SWIFT X, до 16 символов')
    await userEvent.type(input, '{Enter}')
    expect(edit.save).toHaveBeenCalledTimes(1)
    await userEvent.type(input, '{Escape}')
    expect(edit.cancel).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByText('Входящее SWIFT'))
    expect(edit.cancel).toHaveBeenCalledTimes(2)
    fireEvent.mouseDown(input)
    expect(edit.cancel).toHaveBeenCalledTimes(2)
    unmount()

    const changed: FxDocDetail = { ...d, refOut: 'FX1', edits: { refOut: { now: 'FX1', canConfirm: false, hist: [entry({ was: '', now: 'FX1' })] } } }
    const view = ctx()
    renderEdit(changed, view)
    expect(screen.getByRole('img', { name: 'Было — · Вы, 23.09.2026 11:05' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Вернуть исходное' }))
    expect(view.revert).toHaveBeenCalledWith('refOut', 'FX1', '')
    await userEvent.click(screen.getByRole('button', { name: 'Изменить 20 исх' }))
    expect(view.open).toHaveBeenCalledWith('refOut', 'FX1')
  })

  it('20 исх: mousedown по Prompt «Отменить правку?» — не «клик вне», правка не отменяется (C1)', () => {
    const edit = ctx({ editing: 'refOut', draft: 'FX1' })
    renderK(
      <>
        <ConfigForm schema={dom.schemaOf(d)} fields={dom.fields} value={(t) => dom.value(d, t)} present={dom.present}
          renderHero={(id) => dom.renderHero(d, id, edit)} renderBlock={(id) => dom.renderBlock(d, id, edit)} edit={dom.formEdit!(d, edit)} />
        <Prompt open title="Отменить правку?" okLabel="Отменить правку" cancelLabel="Продолжить правку" tone="danger" onResult={vi.fn()} />
      </>,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Отменить правку?' })
    fireEvent.mouseDown(within(dialog).getByRole('button', { name: 'Продолжить правку' }))
    fireEvent.mouseDown(within(dialog).getByRole('button', { name: 'Отменить правку' }))
    fireEvent.mouseDown(dialog)
    fireEvent.mouseDown(dialog.parentElement!) // подложка Prompt
    expect(edit.cancel).not.toHaveBeenCalled()
  })

  it('заблокированный документ — только просмотр: ни карандашей, ни ↺, ни редакторов; маркеры и аудит на месте (Д66)', async () => {
    const locked: FxDocDetail = {
      ...d, lock: { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' }, refOut: 'FX1',
      edits: { ...d.edits, refOut: { now: 'FX1', canConfirm: false, hist: [entry({ was: '', now: 'FX1' })] } },
    }
    // даже при «открытом» редакторе в модели — вид его не рисует
    for (const editing of [null, 'refOut', 'accKt', 'valueDate', 'field:57']) {
      const { unmount } = renderEdit(locked, ctx({ editing, draft: editing === 'field:57' ? d.fields['57']! : 'FX1' }))
      expect(screen.queryAllByRole('button', { name: /^(Редактировать поле|Изменить|Вернуть исходное)/ }), String(editing)).toHaveLength(0)
      expect(document.querySelector('[data-k-edit]'), String(editing)).toBeNull()
      expect(screen.queryByRole('region', { name: /— правка$/ })).toBeNull()
      expect(screen.getByRole('img', { name: 'Было — · Вы, 23.09.2026 11:05' })).toBeInTheDocument()
      const f57 = document.querySelector('[data-field="57"]') as HTMLElement
      expect(f57).toHaveAttribute('data-edited')
      if (editing === null) {
        await userEvent.click(within(f57).getByRole('button', { expanded: false }))
        expect(f57).toHaveTextContent('2 изменения')
      }
      unmount()
    }
  })

  it('счёт Кт: подсказка «Только из карточки клиента · USD · 6 сч.»; выбор — change(счёт) и save; ошибка загрузки — «Повторить»', async () => {
    const items = ['40817840100050017762', '40817840200050017763', '40817840300050017764', '40817840400050017765', '40817840500050017766', '40817840600050017767']
      .map((account) => ({ account, ccy: 'USD', kind: 'Текущий' }))
    const ready: AccountsSlot = { state: 'ready', items, error: null }
    const edit = ctx({ editing: 'accKt', accounts: vi.fn(() => ready) })
    const { unmount } = renderEdit(d, edit)
    expect(edit.accounts).toHaveBeenCalledWith('kt')
    expect(screen.getByText('Только из карточки клиента · USD · 6 сч.')).toBeInTheDocument()
    const input = screen.getByRole('combobox', { name: 'Счёт Кт' })
    await userEvent.type(input, '4081784020')
    await userEvent.click(screen.getByRole('option', { name: /40817840200050017763/ }))
    expect(edit.change).toHaveBeenCalledWith('40817840200050017763')
    expect(edit.save).toHaveBeenCalledTimes(1)
    unmount()

    const failed = ctx({ editing: 'accKt', accounts: vi.fn((): AccountsSlot => ({ state: 'error', items: [], error: 'x' })) })
    renderEdit(d, failed)
    expect(screen.getByText(/Не удалось загрузить счета/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(failed.retryAccounts).toHaveBeenCalledWith('kt')
  })

  it('счёт: выбор во время сохранения игнорируется — ни change, ни save (иначе черновик сменился бы без запроса)', async () => {
    const ready: AccountsSlot = { state: 'ready', items: [{ account: '40817840100050017762', ccy: 'USD', kind: 'Текущий' }], error: null }
    const edit = ctx({ editing: 'accKt', saving: true, draft: '40817840200050017763', accounts: vi.fn(() => ready) })
    renderEdit(d, edit)
    await userEvent.click(screen.getByRole('option', { name: /40817840100050017762/ }))
    expect(edit.change).not.toHaveBeenCalled()
    expect(edit.save).not.toHaveBeenCalled()
  })

  it('счёт Дт: справочник ещё не пришёл — «Загрузка счетов…», фокус в поле', () => {
    renderEdit(d, ctx({ editing: 'accDt' }))
    expect(screen.getByRole('combobox', { name: 'Счёт Дт' })).toHaveFocus()
    expect(screen.getByText('Загрузка счетов…')).toBeInTheDocument()
  })

  it('маршрут после смены Кт — помечен, тултип «Маршрут пересчитан после смены счёта Кт · было: …»; ↺ маршрута нет', () => {
    const was = 'NOSTRO 30114840100000000301 → CHASUS33XXX'
    const changed: FxDocDetail = {
      ...d, accKt: '40817840200050017763',
      edits: {
        accKt: { now: '40817840200050017763', canConfirm: false, hist: [entry({ was: d.accKt, now: '40817840200050017763' })] },
        route: { now: null, canConfirm: false, hist: [entry({ who: 'система', was, now: 'NOSTRO 30114840900000000517 → BCLHLV22XXX', status: 'confirmed', by: 'система', at: '2026-09-23T11:05:00' })] },
      },
    }
    const { unmount } = renderEdit(changed, ctx())
    expect(screen.getByRole('img', { name: `Маршрут пересчитан после смены счёта Кт · было: ${was} · система, 23.09.2026 11:05` })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Было 40817 840 1 0005 0017762 · Вы, 23.09.2026 11:05' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Вернуть исходный маршрут' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Вернуть исходное' })).toHaveLength(1) // только у Кт
    unmount()
    // маршрут вернулся к исходному (↺ Кт) — метки нет
    const back: FxDocDetail = { ...changed, routeType: 'NOSTRO', routeAcc: '30114840100000000301', routeRecv: 'CHASUS33XXX' }
    renderEdit(back, ctx())
    expect(screen.queryByRole('img', { name: /Маршрут пересчитан/ })).toBeNull()
  })

  it('дата валютирования: та же дата — cancel; другая — change и save; маркер утверждено/ожидает', async () => {
    // черновик — новая дата, Prompt отклонён: правка открыта с выбранной датой (эталон :1396)
    const edit = ctx({ editing: 'valueDate', draft: '2026-09-25' })
    const { unmount } = renderEdit(d, edit)
    const input = screen.getByRole('textbox', { name: 'Дата валютирования' })
    expect(input).toHaveFocus()
    await userEvent.clear(input)
    expect(edit.change).not.toHaveBeenCalled() // пустая — игнор
    await userEvent.type(input, '23092026')
    expect(edit.cancel).toHaveBeenCalledTimes(1) // текущая дата документа — выход без запроса
    expect(edit.save).not.toHaveBeenCalled()
    await userEvent.clear(input)
    await userEvent.type(input, '24092026')
    expect(edit.change).toHaveBeenCalledWith('2026-09-24')
    expect(edit.save).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(edit.cancel).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(edit.cancel).toHaveBeenCalledTimes(3)
    unmount()

    const moved = (status: FxHistEntry['status']): FxDocDetail => ({
      ...d, valueDates: ['2026-09-24', '2026-09-23', '2026-09-23', '2026-09-23'],
      edits: { valueDate: { now: '2026-09-24', canConfirm: false, hist: [entry({ was: '2026-09-23', now: '2026-09-24', status, by: status === 'confirmed' ? 'Вы' : null, at: status === 'confirmed' ? '2026-09-23T11:06:00' : null })] } },
    })
    const { unmount: un2 } = renderEdit(moved('confirmed'), ctx())
    const mark = screen.getByRole('img', { name: 'Изменено: было 23.09.2026 · Вы, 23.09.2026 11:05 · утверждено Вы, 23.09.2026 11:06' })
    expect(mark).toHaveAttribute('data-status', 'confirmed')
    expect(screen.queryByRole('img', { name: 'Вх, Исх, по Дт и по Кт совпадают' })).toBeNull()
    un2()
    renderEdit(moved('pending'), ctx())
    expect(screen.getByRole('img', { name: 'Изменено: было 23.09.2026 · Вы, 23.09.2026 11:05 · ожидает утверждения' })).toHaveAttribute('data-status', 'pending')
    expect(fxCommitView('valueDate', '2026-09-23', '2026-09-24')).toMatchObject({
      title: 'Утвердить новую дату валютирования?', okLabel: 'Утвердить', cancelLabel: 'Отмена', tone: 'neutral',
    })
  })

  it('дата валютирования: календарь — клик по выбранному (текущему) дню — cancel, без запроса (Д65)', async () => {
    const edit = ctx({ editing: 'valueDate', draft: d.valueDates[0] })
    renderEdit(d, edit)
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    const selected = screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!
    await userEvent.click(within(selected).getByRole('button'))
    expect(edit.cancel).toHaveBeenCalledTimes(1)
    expect(edit.change).not.toHaveBeenCalled()
    expect(edit.save).not.toHaveBeenCalled()
  })

  it('дата валютирования: ошибка сохранения и 409 — строкой у поля (aria-live)', () => {
    renderEdit(d, ctx({ editing: 'valueDate', draft: '2026-09-24', saveError: 'Документ изменили — откройте заново' }))
    const line = screen.getByText('Документ изменили — откройте заново')
    expect(line).toHaveAttribute('aria-live', 'polite')
    expect(line.closest('[data-k-edit]')).not.toBeNull()
  })

  it('счёт: пока справочник грузится, без «· 0 сч.»; «утверждено» без хвостового пробела при пустых by/at', () => {
    const { unmount } = renderEdit(d, ctx({ editing: 'accKt' }))
    expect(screen.queryByText(/0 сч\./)).toBeNull()
    unmount()
    const moved: FxDocDetail = {
      ...d, valueDates: ['2026-09-24', '2026-09-23', '2026-09-23', '2026-09-23'],
      edits: { valueDate: { now: '2026-09-24', canConfirm: false, hist: [entry({ was: '2026-09-23', now: '2026-09-24', status: 'confirmed' })] } },
    }
    renderEdit(moved, ctx())
    expect(screen.getByRole('img', { name: 'Изменено: было 23.09.2026 · Вы, 23.09.2026 11:05 · утверждено' })).toBeInTheDocument()
  })

  it('закрытие правки 20 исх возвращает фокус на карандаш', () => {
    const { rerender } = renderEdit(d, ctx({ editing: 'refOut', draft: '' }))
    const edit = ctx()
    rerender(
      <ConfigForm schema={dom.schemaOf(d)} fields={dom.fields} value={(t) => dom.value(d, t)} present={dom.present}
        renderHero={(id) => dom.renderHero(d, id, edit)} renderBlock={(id) => dom.renderBlock(d, id, edit)} edit={dom.formEdit!(d, edit)} />,
    )
    expect(screen.getByRole('button', { name: 'Изменить 20 исх' })).toHaveFocus()
  })

  it('edit = null — карандашей нет (рубль и просмотр как в 2b)', () => {
    renderEdit(d, null)
    expect(screen.queryAllByRole('button', { name: /Редактировать|Изменить/ })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Вернуть исходное' })).toBeNull()
  })

  it('axe без нарушений: открытый редактор поля и открытая правка счёта', async () => {
    const field = renderEdit(d, ctx({ editing: 'field:57', draft: d.fields['57']! }))
    expect(await axe(field.container)).toHaveNoViolations()
    field.unmount()
    const ready: AccountsSlot = { state: 'ready', items: [{ account: '40817840100050017762', ccy: 'USD', kind: 'Текущий' }], error: null }
    const acc = renderEdit(d, ctx({ editing: 'accKt', accounts: () => ready }))
    expect(await axe(acc.container)).toHaveNoViolations()
    expect(await axe(screen.getByRole('listbox'))).toHaveNoViolations()
    acc.unmount()
  })
})

describe('вторая рука в видах валюты (план 2d, Task 8)', () => {
  const f57 = () => document.querySelector('[data-field="57"]') as HTMLElement
  // строка поля сетки свёрнута: аудит — в её панели (FieldRow кита)
  const expand57 = () => userEvent.click(within(f57()).getByRole('button', { expanded: false }))
  const can57: FxDocDetail = { ...d, edits: { ...d.edits, 'field:57': { ...d.edits['field:57']!, canConfirm: true } } }
  const ktWas = '40702840719992365220'
  const foreign = (target: 'accKt' | 'accDt' | 'refOut', was: string, now: string): FxDocDetail => ({
    ...d, ...(target === 'refOut' ? { refOut: now } : { [target]: now }),
    edits: { [target]: { now, canConfirm: true, hist: [entry({ who: 'Кузнецов Д. А.', when: '2026-09-23T11:05:00', was, now })] } },
  })

  it('поле 57 с canConfirm и canDecide — «Утвердить»/«Отклонить» в сводке аудита без раскрытия; клик — решение по when последней записи', async () => {
    const canDecide = vi.fn(() => true)
    const edit = ctx({ canDecide })
    renderEdit(can57, edit)
    expect(canDecide).toHaveBeenCalledWith('field:57', true)
    await expand57()
    expect(within(f57()).getByRole('button', { name: 'История', expanded: false })).toBeInTheDocument() // сводка, история свёрнута
    await userEvent.click(within(f57()).getByRole('button', { name: 'Утвердить' }))
    expect(edit.confirmEdit).toHaveBeenCalledWith('field:57', '2026-09-23T10:42:00')
    await userEvent.click(within(f57()).getByRole('button', { name: 'Отклонить' }))
    expect(edit.rejectEdit).toHaveBeenCalledWith('field:57', '2026-09-23T10:42:00')
  })

  it('поле 57: canDecide false (открыт редактор, Prompt, сохранение) — кнопок решения нет', async () => {
    renderEdit(can57, ctx({ canDecide: () => false }))
    await expand57()
    expect(f57()).toHaveTextContent('2 изменения')
    expect(within(f57()).queryByRole('button', { name: 'Утвердить' })).toBeNull()
    expect(within(f57()).queryByRole('button', { name: 'Отклонить' })).toBeNull()
  })

  it('счета и 20 исх с ожидающей чужой правкой — кнопки решения у маркера (блока истории у этих целей нет)', async () => {
    const cases = [
      { target: 'accKt', name: 'счёта Кт', doc: foreign('accKt', ktWas, d.accKt) },
      { target: 'accDt', name: 'счёта Дт', doc: foreign('accDt', '30110840700000009999', d.accDt) },
      { target: 'refOut', name: '20 исх', doc: foreign('refOut', '', 'FX1') },
    ] as const
    for (const c of cases) {
      const canDecide = vi.fn(() => true)
      const edit = ctx({ canDecide })
      const { unmount } = renderEdit(c.doc, edit)
      expect(canDecide, c.target).toHaveBeenCalledWith(c.target, true)
      const ok = screen.getByRole('button', { name: `Утвердить правку ${c.name}` })
      // у маркера «изменено» той же строки
      expect(ok.parentElement?.querySelector('[data-k-editmark], [role="img"]'), c.target).not.toBeNull()
      await userEvent.click(ok)
      expect(edit.confirmEdit, c.target).toHaveBeenCalledWith(c.target, '2026-09-23T11:05:00')
      await userEvent.click(screen.getByRole('button', { name: `Отклонить правку ${c.name}` }))
      expect(edit.rejectEdit, c.target).toHaveBeenCalledWith(c.target, '2026-09-23T11:05:00')
      unmount()
    }
    // своя правка (canConfirm false) или нельзя решать сейчас — кнопок нет
    const own: FxDocDetail = { ...foreign('accKt', ktWas, d.accKt) }
    own.edits = { accKt: { ...own.edits.accKt!, canConfirm: false } }
    const { unmount } = renderEdit(own, ctx({ canDecide: (_t, can) => can }))
    expect(screen.queryByRole('button', { name: /правку счёта Кт$/ })).toBeNull()
    unmount()
    renderEdit(foreign('accKt', ktWas, d.accKt), ctx({ canDecide: () => false }))
    expect(screen.queryByRole('button', { name: /правку счёта Кт$/ })).toBeNull()
  })

  it('отклонённая правка счёта и 20 исх — маркер «отклонено» с причиной, даже когда значение вернулось к исходному (Ruling R19)', () => {
    const rej = (target: 'accKt' | 'refOut', was: string, now: string, cur: string, reason: string | null): FxDocDetail => ({
      ...d, ...(target === 'refOut' ? { refOut: cur } : { [target]: cur }),
      edits: { [target]: { now: cur, canConfirm: false, hist: [entry({ who: 'Кузнецов Д. А.', was, now, status: 'rejected', by: 'Вы', at: '2026-09-23T12:07:00', reason })] } },
    })
    // первая правка отклонена: текущее = исходному — без отметки «изменено» и ↺, но с «отклонено»
    const kt = renderEdit(rej('accKt', d.accKt, ktWas, d.accKt, 'Счёт не тот'), ctx())
    const mark = screen.getByRole('img', { name: 'Правка отклонена · Вы, 23.09.2026 12:07 · Причина: Счёт не тот' })
    expect(mark).toHaveAttribute('data-status', 'rejected')
    expect(mark).toHaveAttribute('data-k-tip', 'Правка отклонена · Вы, 23.09.2026 12:07 · Причина: Счёт не тот')
    expect(screen.queryByRole('img', { name: /^Было / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Вернуть исходное' })).toBeNull()
    kt.unmount()
    // без причины — без хвоста «Причина»
    renderEdit(rej('refOut', '', 'FX1', '', null), ctx())
    expect(screen.getByRole('img', { name: 'Правка отклонена · Вы, 23.09.2026 12:07' })).toHaveAttribute('data-status', 'rejected')
  })

  it('fxDecisionFocus — карандаш цели после решения: поле, 20 исх, счета; route и заблокированный документ — null', () => {
    const { container, unmount } = renderEdit(d, ctx())
    expect(fxDecisionFocus(container, 'field:57')).toBe(screen.getByRole('button', { name: 'Редактировать поле 57' }))
    expect(fxDecisionFocus(container, 'refOut')).toBe(screen.getByRole('button', { name: 'Изменить 20 исх' }))
    expect(fxDecisionFocus(container, 'accKt')).toBe(screen.getByRole('button', { name: 'Изменить счёт Кт' }))
    expect(fxDecisionFocus(container, 'accDt')).toBe(screen.getByRole('button', { name: 'Изменить счёт Дт' }))
    expect(fxDecisionFocus(container, 'route')).toBeNull()
    unmount()
    const locked = renderEdit({ ...d, lock: { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' } }, ctx())
    expect(fxDecisionFocus(locked.container, 'accKt')).toBeNull()
  })

  it('заблокированный документ — кнопок решения нет ни у полей, ни у маркеров', async () => {
    const lock = { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' }
    const kt = foreign('accKt', ktWas, d.accKt)
    const locked: FxDocDetail = { ...kt, lock, edits: { ...can57.edits, ...kt.edits } }
    renderEdit(locked, ctx({ canDecide: () => true }))
    await expand57()
    expect(f57()).toHaveTextContent('2 изменения')
    expect(screen.queryAllByRole('button', { name: /^(Утвердить|Отклонить)/ })).toHaveLength(0)
  })

  it('decisionNote: подпись цели, «было → стало» значениями записи, автор и время', () => {
    const kt = foreign('accKt', ktWas, d.accKt)
    const { container, unmount } = renderK(<div>{fxDecisionNote(kt, 'accKt', '2026-09-23T11:05:00')}</div>)
    expect(container).toHaveTextContent('Счёт Кт')
    expect(container).toHaveTextContent('40702 840 7 1999 2365220 → 40817 840 1 0005 0017762')
    expect(container).toHaveTextContent('Кузнецов Д. А., 23.09.2026 11:05')
    unmount()
    // поле — подпись «Поле 57 · Банк получателя», строки диффа записи (не первой правки)
    const field = renderK(<div>{fxDecisionNote(can57, 'field:57', '2026-09-23T10:42:00')}</div>)
    expect(field.container).toHaveTextContent('Поле 57 · Банк получателя')
    expect(field.container).toHaveTextContent('VOSTOCHNY KREDIT BANK KHABAROVSK → VOSTOCHNY KREDIT BANK KHABAROVSK BR')
    expect(field.container).toHaveTextContent('Иванова М. П., 23.09.2026 10:42')
    field.unmount()
    const ref = renderK(<div>{fxDecisionNote(foreign('refOut', '', 'FX1'), 'refOut', '2026-09-23T11:05:00')}</div>)
    expect(ref.container).toHaveTextContent('20 исх')
    expect(ref.container).toHaveTextContent('— → FX1')
  })

  it('история отклонённой правки — «Причина: …» (historyOf передаёт reason)', async () => {
    const rejected: FxDocDetail = {
      ...d, edits: {
        'field:57': {
          ...d.edits['field:57']!,
          hist: [...d.edits['field:57']!.hist.slice(0, 1), { ...d.edits['field:57']!.hist[1]!, status: 'rejected', by: 'Вы', at: '2026-09-23T12:00:00', reason: 'Нет в справочнике' }],
        },
      },
    }
    renderEdit(rejected, ctx())
    await expand57()
    await userEvent.click(within(f57()).getByRole('button', { name: 'История' }))
    expect(f57()).toHaveTextContent('Причина: Нет в справочнике')
  })
})
