import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { ApiError, type TabQuery } from '../../../shared/api'
import { remoteTab, type DetailDomain, type DetailSummary, type EditContext, type LocalTabView } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createDetail } from '../lib/createDetail'
import { DocDetail } from './DocDetail'

// Синтетический домен: виджет не знает сущностей — всё доменное приходит объектом DetailDomain
type Doc = { id: string; num: string; ref: string }
type Rows = { rows: string[] }
const rows: Doc[] = [{ id: 'd1', num: '417', ref: 'FX2609220000417' }, { id: 'd2', num: '418', ref: 'FX2609220000418' }]
const sum = (d: Doc, tabsOff: string[]): DetailSummary => ({
  label: `Платёжная инструкция № ${d.num}`, uuid: `uuid-${d.id}`, created: '22.09.2026 07:31:45', type: 'MT103',
  status: { tone: 'ok', label: 'Обработан' }, kind: 'Клиентский перевод · входящий', tabsOff,
})
// виды вкладок: локальная «Доп. поля» из детали; нелокальные — список (Статусы, Аудит) и «Связанные» с ctx
const extraView: LocalTabView<Doc> = { kind: 'local', render: (d) => <div>Доп. поля документа {d.ref}</div> }
const listView = (label: string) => remoteTab<Rows>({
  render: (data) => <ul aria-label={label}>{data.rows.map((r) => <li key={r}>{r}</li>)}</ul>,
  skeletonRows: 3,
})
const linkedView = remoteTab<Rows>({
  render: (data, ctx) => {
    const open = (ctx.expanded ?? []).includes('card')
    return (
      <div data-doc={ctx.docId}>
        {data.rows.map((r) => <button key={r} type="button" onClick={() => ctx.openDocument('d2')}>Открыть {r} в соседней панели</button>)}
        <button type="button" aria-expanded={open} onClick={() => ctx.setExpanded(open ? [] : ['card'])}>Раскрыть</button>
        <button type="button" onClick={() => ctx.announce('Действие будет в 2d')}>Переотправить</button>
      </div>
    )
  },
})
const domain: DetailDomain<Doc, Doc> = {
  title: 'Платёжная инструкция',
  tabs: [
    { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
    { id: 'linked', label: 'Связанные документы' }, { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
  ],
  actions: [
    { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
    { id: 'print', label: 'Печать', icon: 'print', menu: ['Платёжное поручение', 'Форма SWIFT'] },
    { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
  ],
  fields: { '20': { label: 'Референс отправителя', kind: 'ref' } },
  schemaOf: () => ({ hero: ['num'], blocks: ['b1'], fieldsTitle: 'Поля MT103', grid: [['20', null]] }),
  value: (d, tag) => (tag === '20' ? { lines: [d.ref] } : null),
  summary: (d) => sum(d, ['audit']),
  rowSummary: (d) => sum(d, []),
  renderHero: (d) => ({ label: 'Номер', value: d.num }),
  renderBlock: (_d, id) => <div>Блок {id}</div>,
  // у «MPU» вида нет — нейтральная заглушка
  tabViews: { extra: extraView, statuses: listView('Статусы'), linked: linkedView, audit: listView('Аудит') },
}

function setup(
  handler: (id: string) => Promise<Doc> = async (id) => rows.find((r) => r.id === id)!,
  tabHandler: (q: TabQuery) => Promise<unknown> = async (q) => ({ rows: [`${q.tab} ${q.id}`] }),
  opts: { domain?: DetailDomain<Doc, Doc>; editOf?: (docId: string) => EditContext } = {},
) {
  const detailFx = createEffect<string, Doc, ApiError>(handler)
  const tabFx = createEffect<TabQuery, unknown, ApiError>(tabHandler)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, tabFx, localTabs: ['main', 'extra'], lifecycle })
  const utils = renderK(
    <>
      <button type="button">Кнопка открытия</button>
      <DocDetail detail={detail} domain={opts.domain ?? domain} editOf={opts.editOf} rowOf={(id) => rows.find((r) => r.id === id) ?? null} returnFocus={() => screen.queryByText('Кнопка открытия')} />
    </>,
  )
  act(() => { lifecycle.pageOpened() })
  const open = (id: string, secondary = false, quiet?: boolean) => act(() => { detail.open(quiet ? { id, secondary, quiet } : { id, secondary }) })
  return { ...utils, open }
}
const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))
const tabSkeleton = () => document.querySelector('[data-part="tab-skeleton"]')

describe('DocDetail (спека 2a §4.3, §5)', () => {
  it('открытие: имя и лейн из строки реестра сразу, после загрузки — «Общие данные» по схеме', async () => {
    const { open } = setup()
    open('d1')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Обработан')).toBeInTheDocument()
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(document.querySelector('[data-field="20"]')).toHaveTextContent('FX2609220000417')
    expect(screen.getByRole('button', { name: 'uuid-d1' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Действия с документом' })).toBeInTheDocument()
  })

  it('медленная загрузка — скелетон формы, шапка — из строки реестра', async () => {
    const { open } = setup(() => new Promise<Doc>(() => {}))
    open('d1')
    await waitFor(() => expect(document.querySelector('[data-part="skeleton"]')).not.toBeNull())
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Клиентский перевод · входящий')).toBeInTheDocument()
  })

  it('ошибка — alert с текстом ApiError и «Повторить»; повтор загружает', async () => {
    let fail = true
    const { open } = setup(async (id) => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера: Регулятор ?fail=detail')
      return rows.find((r) => r.id === id)!
    })
    open('d1')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить документ')
    expect(alert).toHaveTextContent('Сбой сервера: Регулятор ?fail=detail')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
  })

  it('вкладки: без данных — недоступна; «Доп. поля» — локальный вид из детали без запроса; без вида — нейтральная заглушка', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, async (q) => { asked.push(q.tab); return { rows: [] } })
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    expect(screen.getByRole('tab', { name: 'Доп. поля' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Доп. поля документа FX2609220000417')).toBeInTheDocument()
    expect(asked).toEqual([])
    await userEvent.click(screen.getByRole('tab', { name: 'MPU' }))
    expect(screen.getByText('Вкладка «MPU» не подключена')).toBeInTheDocument()
    expect(screen.queryByText(/будет в срезе 2b/)).toBeNull()
  })

  it('действия — заглушки с объявлением; печать — меню форм', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    expect(refresh).toHaveAttribute('data-k-tip', 'Обновить · F5')
    await userEvent.click(refresh)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Обновить · Платёжная инструкция № 417'))
    await userEvent.click(screen.getByRole('button', { name: 'Печать' }))
    await userEvent.click(within(screen.getByRole('menu', { name: 'Печать — печатная форма' })).getByRole('menuitem', { name: 'Форма SWIFT' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Печать: Форма SWIFT · Платёжная инструкция № 417'))
  })

  it('A и B рядом; Esc закрывает B, потом A; фокус возвращается', async () => {
    const { open } = setup()
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    expect(names()).toEqual(['Платёжная инструкция № 418', 'Платёжная инструкция № 417'])
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
  })

  it('повторное открытие открытого — фокус в заголовок его drawer', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    screen.getByText('Кнопка открытия').focus()
    open('d1')
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('«Закрыть» — drawer закрыт, фокус на кнопке открытия', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(names()).toEqual([])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
  })

  it('R10: открытие не пользователем (quiet) фокус не забирает; открытие пользователем — забирает', async () => {
    const { open } = setup()
    screen.getByText('Кнопка открытия').focus()
    open('d1', false, true)
    await screen.findByText('Блок b1')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Кнопка открытия')).toHaveFocus()
    open('d2')
    expect(names()).toEqual(['Платёжная инструкция № 418'])
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('R11: «Закрыть» у A при открытом B — фокус в заголовок оставшегося drawer (он теперь A)', async () => {
    const { open } = setup()
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    await userEvent.click(within(a).getByRole('button', { name: 'Закрыть' }))
    expect(names()).toEqual(['Платёжная инструкция № 418'])
    const left = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(within(left).getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
    expect(within(left).getByText('A')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container, open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DocDetail: вкладки 2b (спека 2b §3.3, §4)', () => {
  it('нелокальная вкладка — запрос при выборе; скелетон не короче 400 мс, затем вид вкладки', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, (q) => {
      asked.push(`${q.id}:${q.tab}`)
      return new Promise((r) => setTimeout(() => r({ rows: [`${q.tab} ${q.id}`] }), 250))
    })
    open('d1')
    await screen.findByText('Блок b1')
    expect(asked).toEqual([])
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    expect(asked).toEqual(['d1:statuses'])
    await waitFor(() => expect(tabSkeleton()).not.toBeNull())
    expect(tabSkeleton()).toHaveAttribute('data-rows', '3')
    // скелетон показан на 200 мс, ответ — на 250: ворота держат скелетон до 600 мс
    await act(async () => { await new Promise<void>((r) => setTimeout(r, 150)) })
    expect(tabSkeleton()).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Статусы' })).toBeNull()
    expect(await screen.findByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    expect(tabSkeleton()).toBeNull()
  })

  it('возврат на загруженную вкладку — без запроса и без скелетона', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, async (q) => { asked.push(q.tab); return { rows: [`${q.tab} ${q.id}`] } })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    await screen.findByRole('list', { name: 'Статусы' })
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    expect(screen.getByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    expect(tabSkeleton()).toBeNull()
    expect(asked).toEqual(['statuses'])
  })

  it('ошибка вкладки — alert с текстом ApiError и «Повторить»; шапка, лейн и «Общие» живы; повтор загружает', async () => {
    let fail = true
    const { open } = setup(undefined, async (q) => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера: Регулятор ?fail=tab:statuses')
      return { rows: [`${q.tab} ${q.id}`] }
    })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить вкладку')
    expect(alert).toHaveTextContent('Сбой сервера: Регулятор ?fail=tab:statuses')
    expect(names()).toEqual(['Платёжная инструкция № 417'])
    expect(screen.getByText('Обработан')).toBeInTheDocument()
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    expect(screen.getByText('Блок b1')).toBeInTheDocument()
  })

  it('ctx: docId — документ слота; openDocument открывает документ в B; announce — в живой регион', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    await screen.findByRole('button', { name: 'Раскрыть' })
    expect(document.querySelector('[data-doc="d1"]')).not.toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Открыть linked d1 в соседней панели' }))
    await waitFor(() => expect(names()).toEqual(['Платёжная инструкция № 418', 'Платёжная инструкция № 417']))
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    await userEvent.click(within(a).getByRole('button', { name: 'Переотправить' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Действие будет в 2d'))
  })

  it('раскрытое во вкладке переживает переключение вкладок (модель, ключ id:tab)', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    const toggle = await screen.findByRole('button', { name: 'Раскрыть' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
    await screen.findByRole('list', { name: 'Статусы' })
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    expect(await screen.findByRole('button', { name: 'Раскрыть' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('M-g: раскрытое поле «Общих данных» переживает переключение вкладок', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    const toggle = () => document.querySelector<HTMLButtonElement>('[data-field="20"] > button')!
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('M-f: вкладка, выбранная до загрузки и оказавшаяся без данных, — после загрузки выбрана первая', async () => {
    let release = () => {}
    const { open } = setup((id) => new Promise<Doc>((r) => { release = () => r(rows.find((x) => x.id === id)!) }))
    open('d1')
    // до загрузки tabsOff — из строки реестра (пуст): «Аудит» доступна
    await userEvent.click(screen.getByRole('tab', { name: 'Аудит' }))
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
    await act(async () => { release() })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Общие данные' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
  })

  it('без нарушений axe на нелокальной вкладке', async () => {
    const { container, open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('tab', { name: 'Связанные документы' }))
    await screen.findByRole('button', { name: 'Раскрыть' })
    expect(await axe(container)).toHaveNoViolations()
  })
})

/** Контекст правки документа — заглушка с vi.fn(): виджет только передаёт его видам домена и рисует Prompt. */
const editStub = (docId: string, over: Partial<EditContext> = {}): EditContext => ({
  docId, editing: null, draft: null, error: null, saving: false, saveError: null, confirm: null,
  onConfirm: vi.fn(), open: vi.fn(), change: vi.fn(), cancel: vi.fn(), save: vi.fn(), revert: vi.fn(),
  accounts: () => null, retryAccounts: vi.fn(),
  decision: null, canDecide: () => false, confirmEdit: vi.fn(), rejectEdit: vi.fn(), changeReason: vi.fn(), onDecision: vi.fn(),
  ...over,
})

describe('DocDetail: правка (план 2c, §3.4)', () => {
  it('editOf: Prompt контекста — в drawer своего документа, поверх панели', async () => {
    const onConfirm = vi.fn()
    const ctx: Record<string, EditContext> = {
      d1: editStub('d1', {
        onConfirm,
        confirm: { title: 'Отменить правку?', note: 'Несохранённые изменения будут потеряны.', okLabel: 'Отменить правку', cancelLabel: 'Продолжить правку', tone: 'danger' },
      }),
      d2: editStub('d2'),
    }
    const { open } = setup(undefined, undefined, { editOf: (id) => ctx[id] ?? editStub(id) })
    open('d1')
    open('d2', true)
    expect(await screen.findAllByText('Блок b1')).toHaveLength(2)
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    const b = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    const prompt = within(a).getByRole('alertdialog', { name: 'Отменить правку?' })
    expect(within(b).queryByRole('alertdialog')).toBeNull()
    // поверх панели: слой overlay — вне прокручиваемых вкладок
    expect(prompt.closest('[role="tabpanel"]')).toBeNull()
    await userEvent.click(within(prompt).getByRole('button', { name: 'Продолжить правку' }))
    expect(onConfirm).toHaveBeenLastCalledWith(false)
    // Esc в Prompt — отказ; деталка не закрывается (OWN_ESCAPE кита)
    within(prompt).getByRole('button', { name: 'Продолжить правку' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(onConfirm).toHaveBeenLastCalledWith(false)
    expect([...names()].sort()).toEqual(['Платёжная инструкция № 417', 'Платёжная инструкция № 418'])
    await userEvent.click(within(prompt).getByRole('button', { name: 'Отменить правку' }))
    expect(onConfirm).toHaveBeenLastCalledWith(true)
  })

  it('editOf: renderHero/renderBlock получают контекст, ConfigForm — formEdit; без editOf — null и без formEdit', async () => {
    const onEdit = vi.fn()
    const make = () => ({
      renderHero: vi.fn((d: Doc) => ({ label: 'Номер', value: d.num })),
      renderBlock: vi.fn((_d: Doc, id: string) => <div>Блок {id}</div>),
      formEdit: vi.fn(() => ({ can: (tag: string) => tag === '20', editing: null, onEdit, renderEditor: () => null, state: () => null })),
    })
    const withEdit = make()
    const ctx = editStub('d1')
    const first = setup(undefined, undefined, { domain: { ...domain, ...withEdit }, editOf: () => ctx })
    first.open('d1')
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(withEdit.renderHero).toHaveBeenLastCalledWith(rows[0], 'num', ctx)
    expect(withEdit.renderBlock).toHaveBeenLastCalledWith(rows[0], 'b1', ctx)
    expect(withEdit.formEdit).toHaveBeenLastCalledWith(rows[0], ctx)
    await userEvent.click(screen.getByRole('button', { name: 'Редактировать поле 20' }))
    expect(onEdit).toHaveBeenCalledWith('20')
    first.unmount()

    const plain = make()
    const second = setup(undefined, undefined, { domain: { ...domain, ...plain } })
    second.open('d1')
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(plain.renderHero).toHaveBeenLastCalledWith(rows[0], 'num', null)
    expect(plain.renderBlock).toHaveBeenLastCalledWith(rows[0], 'b1', null)
    expect(plain.formEdit).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Редактировать поле 20' })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
