import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Banner, Prompt } from '@katran/ui'
import { createEffect, createEvent, createStore } from 'effector'
import { useUnit } from 'effector-react'
import { ApiError, type TabQuery } from '../../../shared/api'
import { remoteTab, type ActionsView, type AnnulInfo, type AnnulView, type DetailDomain, type DetailLookups, type DetailSummary, type EditContext, type LocalTabView, type NotifView } from '../../../shared/lib/detail'
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
    { id: 'print', label: 'Печать', icon: 'print', menu: [{ label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Форма SWIFT', form: 'swift-form' }] },
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
  opts: {
    domain?: DetailDomain<Doc, Doc>; editOf?: (docId: string) => EditContext; actionsOf?: ((docId: string) => ActionsView) | undefined
    lookupsOf?: ((docId: string) => DetailLookups) | undefined; annulOf?: ((docId: string) => AnnulView) | undefined
    notifOf?: ((docId: string) => NotifView) | undefined
  } = {},
) {
  const detailFx = createEffect<string, Doc, ApiError>(handler)
  const tabFx = createEffect<TabQuery, unknown, ApiError>(tabHandler)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, tabFx, localTabs: ['main', 'extra'], lifecycle })
  const utils = renderK(
    <>
      <button type="button">Кнопка открытия</button>
      <DocDetail detail={detail} domain={opts.domain ?? domain} editOf={opts.editOf} actionsOf={opts.actionsOf} lookupsOf={opts.lookupsOf} annulOf={opts.annulOf} notifOf={opts.notifOf} rowOf={(id) => rows.find((r) => r.id === id) ?? null} returnFocus={() => screen.queryByText('Кнопка открытия')} />
    </>,
  )
  act(() => { lifecycle.pageOpened() })
  const open = (id: string, secondary = false, quiet?: boolean) => act(() => { detail.open(quiet ? { id, secondary, quiet } : { id, secondary }) })
  const close = (slot: 'a' | 'b' = 'a') => act(() => { detail.close(slot) })
  return { ...utils, open, close, detail }
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
    // фейковые часы (и Date ворот скелетона) — с выбора вкладки: на реальных под нагрузкой ожидание скелетона опаздывало,
    // и «ещё скелетон» проверялся уже после 600 мс (флейк pnpm check); waitFor/findBy под фейковыми часами не нужны
    vi.useFakeTimers()
    try {
      const at = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
      fireEvent.click(screen.getByRole('tab', { name: 'Статусы' }))
      await at(0)
      expect(asked).toEqual(['d1:statuses'])
      // порог показа — 200 мс
      await at(199)
      expect(tabSkeleton()).toBeNull()
      await at(1)
      expect(tabSkeleton()).toHaveAttribute('data-rows', '3')
      // ответ — на 250 мс: ворота держат скелетон до 200 + 400 = 600 мс, данные до этого не показываются
      await at(50)
      expect(tabSkeleton()).not.toBeNull()
      expect(screen.queryByRole('list', { name: 'Статусы' })).toBeNull()
      await at(349)
      expect(tabSkeleton()).not.toBeNull()
      expect(screen.queryByRole('list', { name: 'Статусы' })).toBeNull()
      await at(1)
      expect(screen.getByRole('list', { name: 'Статусы' })).toHaveTextContent('statuses d1')
      expect(tabSkeleton()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
    expect(withEdit.renderHero).toHaveBeenLastCalledWith(rows[0], 'num', ctx, null)
    expect(withEdit.renderBlock).toHaveBeenLastCalledWith(rows[0], 'b1', ctx, null)
    expect(withEdit.formEdit).toHaveBeenLastCalledWith(rows[0], ctx)
    await userEvent.click(screen.getByRole('button', { name: 'Редактировать поле 20' }))
    expect(onEdit).toHaveBeenCalledWith('20')
    first.unmount()

    const plain = make()
    const second = setup(undefined, undefined, { domain: { ...domain, ...plain } })
    second.open('d1')
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(plain.renderHero).toHaveBeenLastCalledWith(rows[0], 'num', null, null)
    expect(plain.renderBlock).toHaveBeenLastCalledWith(rows[0], 'b1', null, null)
    expect(plain.formEdit).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Редактировать поле 20' })).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('DocDetail: справочные запросы (спека 2e §3.5)', () => {
  it('lookupsOf: renderHero/renderBlock получают lookups своего документа четвёртым аргументом; без lookupsOf — null', async () => {
    const make = () => ({
      renderHero: vi.fn((d: Doc) => ({ label: 'Номер', value: d.num })),
      renderBlock: vi.fn((_d: Doc, id: string) => <div>Блок {id}</div>),
    })
    const lookupsByDoc: Record<string, DetailLookups> = { d1: { rates: undefined }, d2: { balances: undefined } }
    const asked: string[] = []
    const withLookups = make()
    const first = setup(undefined, undefined, {
      domain: { ...domain, ...withLookups },
      lookupsOf: (id) => { asked.push(id); return lookupsByDoc[id]! },
    })
    first.open('d1')
    first.open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    expect(withLookups.renderHero).toHaveBeenCalledWith(rows[0], 'num', null, lookupsByDoc.d1)
    expect(withLookups.renderBlock).toHaveBeenCalledWith(rows[0], 'b1', null, lookupsByDoc.d1)
    expect(withLookups.renderHero).toHaveBeenCalledWith(rows[1], 'num', null, lookupsByDoc.d2)
    expect(withLookups.renderBlock).toHaveBeenCalledWith(rows[1], 'b1', null, lookupsByDoc.d2)
    expect(new Set(asked)).toEqual(new Set(['d1', 'd2']))
    first.unmount()

    const plain = make()
    const second = setup(undefined, undefined, { domain: { ...domain, ...plain } })
    second.open('d1')
    expect(await screen.findByText('Блок b1')).toBeInTheDocument()
    expect(plain.renderHero).toHaveBeenLastCalledWith(rows[0], 'num', null, null)
    expect(plain.renderBlock).toHaveBeenLastCalledWith(rows[0], 'b1', null, null)
  })
})

describe('DocDetail: нотификации (спека 2e §3.5)', () => {
  // вкладка «Связанные» как «Нотификации»: показывает и вызывает поля TabContext переотправки и окна сообщения
  const notifTab = remoteTab<Rows>({
    render: (_data, ctx) => (
      <div data-part="notif" data-busy={String(ctx.resendBusy)}>
        {ctx.resend && <button type="button" onClick={() => ctx.resend?.()}>Переотправить все</button>}
        {ctx.resend && <button type="button" onClick={() => ctx.resend?.('n2', 2)}>Переотправить, отправка 2</button>}
        {ctx.openMessage && <button type="button" onClick={() => ctx.openMessage?.('n2', 2)}>Исходное сообщение, отправка 2</button>}
      </div>
    ),
  })
  const notifDomain: DetailDomain<Doc, Doc> = { ...domain, tabViews: { ...domain.tabViews, linked: notifTab } }

  it('notifOf: TabContext получает resend, resendBusy, openMessage своего документа', async () => {
    const calls: unknown[][] = []
    const notifOf = (id: string): NotifView => ({
      resend: (...a) => calls.push([id, 'resend', ...a]),
      resendBusy: id === 'd2',
      openMessage: (...a) => calls.push([id, 'open', ...a]),
    })
    const { open, detail } = setup(undefined, undefined, { domain: notifDomain, notifOf })
    open('d1')
    open('d2', true)
    act(() => { detail.setTab({ slot: 'a', tab: 'linked' }) })
    act(() => { detail.setTab({ slot: 'b', tab: 'linked' }) })
    // часть вкладки — в drawer своего документа (порядок drawer в DOM — забота DrawerStack)
    const partOf = (name: string) => screen.getByRole('dialog', { name }).querySelector<HTMLElement>('[data-part="notif"]')
    await waitFor(() => expect(document.querySelectorAll('[data-part="notif"]')).toHaveLength(2))
    const a = partOf('Платёжная инструкция № 417')
    const b = partOf('Платёжная инструкция № 418')
    expect(a).toHaveAttribute('data-busy', 'false')
    expect(b).toHaveAttribute('data-busy', 'true')
    await userEvent.click(within(a!).getByRole('button', { name: 'Переотправить все' }))
    await userEvent.click(within(b!).getByRole('button', { name: 'Переотправить, отправка 2' }))
    await userEvent.click(within(a!).getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    expect(calls).toEqual([['d1', 'resend'], ['d2', 'resend', 'n2', 2], ['d1', 'open', 'n2', 2]])
  })

  it('без notifOf — полей в TabContext нет (вкладка как в 2b)', async () => {
    const { open, detail } = setup(undefined, undefined, { domain: notifDomain })
    open('d1')
    act(() => { detail.setTab({ slot: 'a', tab: 'linked' }) })
    const part = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-part="notif"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(part).toHaveAttribute('data-busy', 'undefined')
    expect(within(part).queryAllByRole('button')).toHaveLength(0)
  })
})

/** Вид действий документа — заглушка с vi.fn(): виджет не знает модели действий (план 2d §3.3). */
const actionsStub = (over: Partial<ActionsView> = {}): ActionsView => ({
  run: vi.fn(), pending: () => false, linkFallback: null, closeLinkFallback: vi.fn(), notice: null, closeNotice: vi.fn(), ...over,
})
// лейн 2d: шесть действий эталона без «Редактировать»; блок с полем ввода — для F5 в поле
const laneDomain: DetailDomain<Doc, Doc> = {
  ...domain,
  actions: [
    { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
    { id: 'esid', label: 'Создать служебный документ', icon: 'doc' },
    { id: 'down', label: 'Скачать', icon: 'download' },
    { id: 'print', label: 'Печать', icon: 'print', menu: [{ label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Форма SWIFT', form: 'swift-form' }] },
    { id: 'link', label: 'Скопировать ссылку', icon: 'link' },
    { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
  ],
  renderBlock: (_d, id) => <div>Блок {id}<input aria-label="Поле блока" /></div>,
  decisionNote: (d, target, when) => <>Цель {target} · запись {when} · № {d.num}</>,
}
const refreshAction = laneDomain.actions[0]!
const decisionOf = (over: Partial<NonNullable<EditContext['decision']>> = {}): NonNullable<EditContext['decision']> => ({
  kind: 'confirm', target: 'field:57', when: '2026-09-23T10:42:00', reason: '', busy: false, error: null, ...over,
})

describe('DocDetail: действия лейна (план 2d §3.5)', () => {
  it('actionsOf: «Обновить» и «Скачать» — run действия без объявления; печать — run с пунктом меню', async () => {
    const view = actionsStub()
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: () => view })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(view.run).toHaveBeenLastCalledWith(refreshAction, undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Скачать' }))
    expect(view.run).toHaveBeenLastCalledWith(laneDomain.actions[2], undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Печать' }))
    await userEvent.click(within(screen.getByRole('menu', { name: 'Печать — печатная форма' })).getByRole('menuitem', { name: 'Форма SWIFT' }))
    expect(view.run).toHaveBeenLastCalledWith(laneDomain.actions[3], { label: 'Форма SWIFT', form: 'swift-form' })
    expect(view.run).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('actionsOf получает id документа своего drawer', async () => {
    const asked: string[] = []
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: (id) => { asked.push(id); return actionsStub() } })
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    expect(new Set(asked)).toEqual(new Set(['d1', 'd2']))
  })

  it('«Создать служебный документ» и «Аннулировать» без annulOf — заглушка «Действие пока недоступно» и при actionsOf (срез 2e)', async () => {
    const view = actionsStub()
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: () => view })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Создать служебный документ' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Действие пока недоступно'))
    await userEvent.click(screen.getByRole('button', { name: 'Аннулировать' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Действие пока недоступно'))
    expect(view.run).not.toHaveBeenCalled()
  })

  it('pending — кнопка действия aria-disabled и aria-busy, но в фокусе (Ruling R19), клик игнорируется; F5 на ней — «Обновить»; остальные доступны', async () => {
    const view = actionsStub({ pending: (id) => id === 'down' })
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: () => view })
    open('d1')
    await screen.findByText('Блок b1')
    const down = screen.getByRole('button', { name: 'Скачать' })
    expect(down).toHaveAttribute('aria-disabled', 'true')
    expect(down).not.toHaveAttribute('disabled')
    expect(down).toHaveAttribute('aria-busy', 'true')
    down.focus()
    expect(down).toHaveFocus()
    await userEvent.click(down)
    expect(view.run).not.toHaveBeenCalled()
    fireEvent.keyDown(down, { key: 'F5' })
    expect(view.run).toHaveBeenCalledTimes(1)
    expect(view.run).toHaveBeenCalledWith(expect.objectContaining({ id: 'refresh' }))
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    expect(refresh).toBeEnabled()
    expect(refresh).not.toHaveAttribute('aria-busy')
  })

  it('запасная ссылка — группа «Ссылка на документ» в drawer своего документа: поле только для чтения, ссылка выделена, подсказка — описание поля, «Закрыть ссылку» — closeLinkFallback; появление объявлено', async () => {
    const url = 'http://localhost/#/fx-docs?doc=d1'
    const own = actionsStub({ linkFallback: url })
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: (id) => (id === 'd1' ? own : actionsStub()) })
    // quiet: заголовок drawer не забирает фокус — в жизни уведомление появляется в уже открытом drawer
    open('d1', false, true)
    open('d2', true, true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    const b = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(within(b).queryByRole('group', { name: 'Ссылка на документ' })).toBeNull()
    const note = within(a).getByRole('group', { name: 'Ссылка на документ' })
    // интерактивное содержимое — не в живой области: role=status у уведомления нет
    expect(within(a).queryByRole('status')).toBeNull()
    expect(note).toHaveTextContent('Скопируйте ссылку: Ctrl+C')
    const field = within(note).getByRole('textbox')
    expect(field).toHaveValue(url)
    expect(field).toHaveAttribute('readonly')
    expect(field).toHaveFocus()
    expect(field).toHaveAccessibleDescription('Скопируйте ссылку: Ctrl+C')
    expect([(field as HTMLInputElement).selectionStart, (field as HTMLInputElement).selectionEnd]).toEqual([0, url.length])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Буфер обмена недоступен. Скопируйте ссылку: Ctrl+C'))
    await userEvent.click(within(note).getByRole('button', { name: 'Закрыть ссылку' }))
    expect(own.closeLinkFallback).toHaveBeenCalledTimes(1)
  })

  describe('запасная ссылка: клавиатура (финальное ревью 2d, I3)', () => {
    const url = 'http://localhost/#/fx-docs?doc=d1'
    const shown = createEvent<string | null>()
    const closed = createEvent()
    const $link = createStore<string | null>(null).on(shown, (_, l) => l).reset(closed)
    const run = vi.fn()
    // вид действий со своим стором ссылки: закрытие действительно убирает уведомление (возврат фокуса)
    const useLinkActions = (): ActionsView => {
      const link = useUnit($link)
      return actionsStub({ run, linkFallback: link, closeLinkFallback: () => { closed() } })
    }
    const ready = async () => {
      run.mockClear()
      act(() => { closed() })
      const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: useLinkActions })
      open('d1')
      await screen.findByText('Блок b1')
      const copy = screen.getByRole('button', { name: 'Скопировать ссылку' })
      copy.focus()
      act(() => { shown(url) })
      const field = screen.getByRole('textbox', { name: 'Ссылка на документ' })
      expect(field).toHaveFocus()
      return { copy, field }
    }

    it('F5 в поле ссылки (только для чтения) — «Обновить», страница не перезагружается', async () => {
      const { field } = await ready()
      expect(fireEvent.keyDown(field, { key: 'F5' })).toBe(false)
      expect(run).toHaveBeenCalledWith(refreshAction)
    })

    it('Esc в поле — закрыто уведомление, не деталка; фокус вернулся на «Скопировать ссылку»', async () => {
      const { copy } = await ready()
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('group', { name: 'Ссылка на документ' })).toBeNull()
      expect(screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })).toBeInTheDocument()
      expect(copy).toHaveFocus()
    })

    it('Esc на «Закрыть ссылку» — тоже только уведомление; «Закрыть ссылку» кликом — фокус на «Скопировать ссылку»', async () => {
      const first = await ready()
      screen.getByRole('button', { name: 'Закрыть ссылку' }).focus()
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('group', { name: 'Ссылка на документ' })).toBeNull()
      expect(screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })).toBeInTheDocument()
      expect(first.copy).toHaveFocus()
      act(() => { shown(url) })
      await userEvent.click(screen.getByRole('button', { name: 'Закрыть ссылку' }))
      expect(screen.queryByRole('group', { name: 'Ссылка на документ' })).toBeNull()
      expect(first.copy).toHaveFocus()
    })
  })

  it('уведомление действия — под лейном своего drawer: текст виден, тон в data-tone; «Закрыть уведомление» — closeNotice', async () => {
    const own = actionsStub({ notice: { text: 'Сообщение не сформировано', tone: 'bad' } })
    const { open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: (id) => (id === 'd1' ? own : actionsStub()) })
    open('d1', false, true)
    open('d2', true, true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    const b = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(b.querySelector('[data-part="action-notice"]')).toBeNull()
    const note = a.querySelector('[data-part="action-notice"]') as HTMLElement
    expect(note).toHaveTextContent('Сообщение не сформировано')
    expect(note).toHaveAttribute('data-tone', 'bad')
    expect(note).toBeVisible()
    // объявляет модель (announce): у видимого уведомления своей живой области нет — иначе текст прозвучал бы дважды
    expect(note.closest('[aria-live]')).toBeNull()
    await userEvent.click(within(note).getByRole('button', { name: 'Закрыть уведомление' }))
    expect(own.closeNotice).toHaveBeenCalledTimes(1)
    expect(own.run).not.toHaveBeenCalled()
  })

  it('уведомление успеха и запасная ссылка вместе — оба видны; без нарушений axe', async () => {
    const view = actionsStub({ notice: { text: 'Ссылка скопирована', tone: 'ok' }, linkFallback: 'http://localhost/#/fx-docs?doc=d1' })
    const { container, open } = setup(undefined, undefined, { domain: laneDomain, actionsOf: () => view })
    open('d1', false, true)
    await screen.findByText('Блок b1')
    expect(document.querySelector('[data-part="action-notice"]')).toHaveAttribute('data-tone', 'ok')
    expect(screen.getByRole('group', { name: 'Ссылка на документ' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DocDetail: Prompt решения второй руки (план 2d §4 п. 1–3)', () => {
  const withDecision = (decision: EditContext['decision'], over: Partial<EditContext> = {}) => {
    const ctx = editStub('d1', { decision, ...over })
    const utils = setup(undefined, undefined, { domain: laneDomain, editOf: (id) => (id === 'd1' ? ctx : editStub(id)) })
    // quiet: drawer не забирает фокус в заголовок — фокус ставит Prompt (в жизни решение открывается в уже открытом drawer)
    utils.open('d1', false, true)
    return { ...utils, ctx }
  }

  it('утвердить: «Утвердить правку?», тело — decisionNote, «Утвердить» — onDecision(true), «Отмена» — onDecision(false)', async () => {
    const { ctx } = withDecision(decisionOf())
    await screen.findByText('Блок b1')
    const prompt = screen.getByRole('alertdialog', { name: 'Утвердить правку?' })
    expect(prompt).toHaveAccessibleDescription('Цель field:57 · запись 2026-09-23T10:42:00 · № 417')
    expect(within(prompt).queryByRole('textbox')).toBeNull()
    const ok = within(prompt).getByRole('button', { name: 'Утвердить' })
    expect(ok).not.toHaveAttribute('data-tone')
    expect(ok).toHaveFocus()
    await userEvent.click(ok)
    expect(ctx.onDecision).toHaveBeenLastCalledWith(true)
    await userEvent.click(within(prompt).getByRole('button', { name: 'Отмена' }))
    expect(ctx.onDecision).toHaveBeenLastCalledWith(false)
  })

  it('отклонить: «Отклонить правку?», danger, поле «Причина» 140 со счётчиком; пустая причина — «Отклонить» недоступна; ввод — changeReason', async () => {
    const { ctx } = withDecision(decisionOf({ kind: 'reject' }))
    await screen.findByText('Блок b1')
    const prompt = screen.getByRole('alertdialog', { name: 'Отклонить правку?' })
    const reason = within(prompt).getByRole('textbox', { name: 'Причина' })
    expect(reason.tagName).toBe('TEXTAREA')
    expect(reason).toHaveAttribute('maxLength', '140')
    expect(reason).toHaveAccessibleDescription('0/140')
    expect(reason).toHaveFocus()
    const no = within(prompt).getByRole('button', { name: 'Отклонить' })
    expect(no).toHaveAttribute('data-tone', 'danger')
    expect(no).toBeDisabled()
    await userEvent.type(reason, 'x')
    expect(ctx.changeReason).toHaveBeenLastCalledWith('x')
  })

  it('причина из пробелов — «Отклонить» недоступна; непустая — доступна, счётчик по длине', async () => {
    const { unmount } = withDecision(decisionOf({ kind: 'reject', reason: '   ' }))
    await screen.findByText('Блок b1')
    expect(screen.getByRole('button', { name: 'Отклонить' })).toBeDisabled()
    expect(screen.getByText('3/140')).toBeInTheDocument()
    unmount()
    const { ctx } = withDecision(decisionOf({ kind: 'reject', reason: 'Неверный счёт' }))
    await screen.findByText('Блок b1')
    const no = screen.getByRole('button', { name: 'Отклонить' })
    expect(no).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Причина' })).toHaveAccessibleDescription('13/140')
    await userEvent.click(no)
    expect(ctx.onDecision).toHaveBeenLastCalledWith(true)
  })

  it('busy — Prompt занят, кнопки недоступны; error — role=alert в Prompt', async () => {
    const { unmount } = withDecision(decisionOf({ busy: true }))
    await screen.findByText('Блок b1')
    const prompt = screen.getByRole('alertdialog', { name: 'Утвердить правку?' })
    expect(prompt).toHaveAttribute('aria-busy', 'true')
    expect(within(prompt).getByRole('button', { name: 'Утвердить' })).toBeDisabled()
    expect(within(prompt).getByRole('button', { name: 'Отмена' })).toBeDisabled()
    unmount()
    withDecision(decisionOf({ kind: 'reject', reason: 'Причина', error: 'Сбой сервера: Регулятор ?fail=decide' }))
    await screen.findByText('Блок b1')
    const again = screen.getByRole('alertdialog', { name: 'Отклонить правку?' })
    expect(within(again).getByRole('alert')).toHaveTextContent('Сбой сервера: Регулятор ?fail=decide')
  })

  it('Prompt правки 2c и решение одновременно — один Prompt, правки', async () => {
    withDecision(decisionOf(), {
      confirm: { title: 'Отменить правку?', okLabel: 'Отменить правку', cancelLabel: 'Продолжить правку', tone: 'danger' },
    })
    await screen.findByText('Блок b1')
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.getByRole('alertdialog', { name: 'Отменить правку?' })).toBeInTheDocument()
  })

  it('без decisionNote у домена — Prompt без тела-описания', async () => {
    const ctx = editStub('d1', { decision: decisionOf() })
    const { open } = setup(undefined, undefined, { domain: { ...laneDomain, decisionNote: undefined }, editOf: () => ctx })
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('alertdialog', { name: 'Утвердить правку?' })).not.toHaveAttribute('aria-describedby')
  })

  it('без нарушений axe: Prompt отклонения и лейн с действием в полёте', async () => {
    const ctx = editStub('d1', { decision: decisionOf({ kind: 'reject', reason: 'Неверный счёт', error: 'Сбой сервера' }) })
    const { container, open } = setup(undefined, undefined, {
      domain: laneDomain, editOf: () => ctx, actionsOf: () => actionsStub({ pending: (id) => id === 'down' }),
    })
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('alertdialog', { name: 'Отклонить правку?' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DocDetail: F5 — «Обновить» (план 2d §4 п. 4)', () => {
  const f5 = (el: Element, init: KeyboardEventInit = {}) => fireEvent.keyDown(el, { key: 'F5', ...init })
  const ready = async (over: { edit?: Partial<EditContext>; actions?: boolean } = {}) => {
    const view = actionsStub()
    const { open } = setup(undefined, undefined, {
      domain: laneDomain,
      editOf: (id) => editStub(id, over.edit),
      actionsOf: over.actions === false ? undefined : () => view,
    })
    open('d1')
    await screen.findByText('Блок b1')
    return view
  }

  it('F5 на кнопке лейна — run(refresh) и preventDefault', async () => {
    const view = await ready()
    expect(f5(screen.getByRole('button', { name: 'Скачать' }))).toBe(false)
    expect(view.run).toHaveBeenCalledWith(refreshAction)
    expect(f5(screen.getByRole('heading', { name: 'Платёжная инструкция' }))).toBe(false)
    expect(view.run).toHaveBeenCalledTimes(2)
  })

  it('F5 в поле ввода — браузеру', async () => {
    const view = await ready()
    expect(f5(screen.getByRole('textbox', { name: 'Поле блока' }))).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('Ctrl+F5, Shift+F5, Alt+F5, Meta+F5 и другие клавиши — браузеру', async () => {
    const view = await ready()
    const btn = screen.getByRole('button', { name: 'Обновить' })
    expect(f5(btn, { ctrlKey: true })).toBe(true)
    expect(f5(btn, { shiftKey: true })).toBe(true)
    expect(f5(btn, { altKey: true })).toBe(true)
    expect(f5(btn, { metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(btn, { key: 'F4' })).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('открыт редактор документа — браузеру', async () => {
    const view = await ready({ edit: { editing: 'field:57' } })
    expect(f5(screen.getByRole('button', { name: 'Обновить' }))).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('открыт Prompt (правки или решения) — браузеру, в том числе из поля «Причина»', async () => {
    const view = await ready({ edit: { decision: decisionOf({ kind: 'reject' }) } })
    expect(f5(screen.getByRole('textbox', { name: 'Причина' }))).toBe(true)
    expect(f5(screen.getByRole('button', { name: 'Отмена' }))).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('открыт Prompt правки 2c — браузеру', async () => {
    const view = await ready({ edit: { confirm: { title: 'Отменить правку?', okLabel: 'Отменить правку', cancelLabel: 'Продолжить правку', tone: 'danger' } } })
    expect(f5(screen.getByRole('button', { name: 'Продолжить правку' }))).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('без actionsOf — браузеру (поведение 2a)', async () => {
    await ready({ actions: false })
    expect(f5(screen.getByRole('button', { name: 'Обновить' }))).toBe(true)
  })
})

/** Вид аннулирования документа — заглушка: виджет не знает модели аннулирования (спека 2e §3.5). */
const laneOf = (over: Partial<ReturnType<AnnulView['lane']>> = {}) => ({ disabled: false, hint: null, busy: false, run: vi.fn(), ...over })
const annulStub = (over: Partial<AnnulView> = {}): AnnulView => ({ lane: () => laneOf(), banner: () => null, prompt: () => null, ...over })
// у d1 — отклонённый запрос (плашка rejected), у d2 — без запроса
const rejectedAnnul = {
  status: 'rejected' as const, who: 'Кузнецов Д. А.', when: '2026-09-23T10:00:00', reason: 'Дубликат', by: 'Петров С. В.', at: '2026-09-24T11:30:00',
  rejectReason: 'Платёж корректен', canConfirm: false,
}
const infoOf = (d: Doc): AnnulInfo => ({
  canAnnul: d.id === 'd1', annul: d.id === 'd1' ? rejectedAnnul : null, lockedBy: null, statusLabel: 'Обработан', subject: `№ ${d.num}`,
})
const annulDomain: DetailDomain<Doc, Doc> = { ...laneDomain, annulInfo: infoOf }
/** Плашка-заглушка: отклонённый запрос документа, «Закрыть плашку» — onDismiss; dismissed — прячет. */
const bannerStub: AnnulView['banner'] = (info, dismissed, onDismiss) => (info?.annul == null || dismissed ? null : (
  <Banner tone="neutral" onClose={onDismiss} closeLabel="Закрыть плашку">Запрос на аннулирование отклонён · {info.subject}</Banner>
))

describe('DocDetail: аннулирование (спека 2e §3.5, §4 п. 1–4)', () => {
  it('annulOf: кнопка «Аннулировать» берёт состояние из lane по AnnulInfo домена; недоступна — aria-disabled (не disabled), подсказка lane, клик игнорируется', async () => {
    const run = vi.fn()
    const lane = vi.fn((info: AnnulInfo | null) => laneOf({ disabled: true, hint: info === null ? null : 'Документ аннулирован', run }))
    const { open } = setup(undefined, undefined, { domain: annulDomain, actionsOf: () => actionsStub(), annulOf: () => annulStub({ lane }) })
    open('d1')
    await screen.findByText('Блок b1')
    expect(lane).toHaveBeenLastCalledWith(infoOf(rows[0]!))
    const ban = screen.getByRole('button', { name: 'Аннулировать' })
    expect(ban).toHaveAttribute('aria-disabled', 'true')
    expect(ban).not.toHaveAttribute('disabled')
    expect(ban).toHaveAttribute('data-k-tip', 'Документ аннулирован')
    ban.focus()
    expect(ban).toHaveFocus()
    await userEvent.click(ban)
    expect(run).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('до загрузки детали lane получает null — кнопка недоступна', async () => {
    const asked: (AnnulInfo | null)[] = []
    const { open } = setup(() => new Promise<Doc>(() => {}), undefined, {
      domain: annulDomain, actionsOf: () => actionsStub(), annulOf: () => annulStub({ lane: (info) => { asked.push(info); return laneOf({ disabled: info === null }) } }),
    })
    open('d1')
    expect(asked).toContain(null)
    expect(asked.every((x) => x === null)).toBe(true)
    expect(screen.getByRole('button', { name: 'Аннулировать' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('доступная «Аннулировать» — run lane, без объявления и без run действий; подсказка — подпись', async () => {
    const run = vi.fn()
    const view = actionsStub()
    const { open } = setup(undefined, undefined, { domain: annulDomain, actionsOf: () => view, annulOf: () => annulStub({ lane: () => laneOf({ run }) }) })
    open('d2')
    await screen.findByText('Блок b1')
    const ban = screen.getByRole('button', { name: 'Аннулировать' })
    expect(ban).not.toHaveAttribute('aria-disabled')
    expect(ban).not.toHaveAttribute('aria-busy')
    expect(ban).toHaveAttribute('data-k-tip', 'Аннулировать')
    await userEvent.click(ban)
    expect(run).toHaveBeenCalledTimes(1)
    expect(view.run).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('busy lane — aria-busy и aria-disabled', async () => {
    const { open } = setup(undefined, undefined, { domain: annulDomain, annulOf: () => annulStub({ lane: () => laneOf({ disabled: true, busy: true, hint: 'Завершите текущую операцию с документом' }) }) })
    open('d1')
    await screen.findByText('Блок b1')
    const ban = screen.getByRole('button', { name: 'Аннулировать' })
    expect(ban).toHaveAttribute('aria-busy', 'true')
    expect(ban).toHaveAttribute('aria-disabled', 'true')
  })

  it('плашка — между лейном и вкладками своего документа', async () => {
    const { open } = setup(undefined, undefined, {
      domain: annulDomain, annulOf: (id) => annulStub({ banner: id === 'd1' ? bannerStub : () => null }),
    })
    open('d1')
    open('d2', true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    const b = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(within(b).queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    const banner = within(a).getByText('Запрос на аннулирование отклонён · № 417')
    const lane = a.querySelector('[data-part="lane"]')!
    const tabs = a.querySelector('[data-part="tabs"]')!
    expect(lane.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tabs.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('закрытая плашка скрыта до закрытия деталки; повторное открытие того же документа — снова видна', async () => {
    const { open, close } = setup(undefined, undefined, { domain: annulDomain, annulOf: () => annulStub({ banner: bannerStub }) })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть плашку' }))
    expect(screen.queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    // смена вкладки и обратно — состояние drawer, плашка по-прежнему закрыта
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Общие данные' }))
    expect(screen.queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    close()
    await waitFor(() => expect(names()).toEqual([]))
    open('d1')
    expect(await screen.findByText('Запрос на аннулирование отклонён · № 417')).toBeInTheDocument()
  })

  it('«Закрыть» плашки: кнопка пропала вместе с плашкой — фокус на заголовке своего drawer, не в body (найдено e2e Task 13)', async () => {
    const { open } = setup(undefined, undefined, { domain: annulDomain, annulOf: () => annulStub({ banner: bannerStub }) })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть плашку' }))
    expect(screen.queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    expect(document.activeElement).not.toBe(document.body)
    expect(a.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.tagName).toBe('H2')
  })

  it('тот же drawer: закрыта плашка rejected, пришёл новый rejected с другим annul.when — снова видна', async () => {
    let when = '2026-09-23T10:00:00'
    const domainWhen: DetailDomain<Doc, Doc> = { ...laneDomain, annulInfo: (d) => ({ ...infoOf(d), annul: d.id === 'd1' ? { ...rejectedAnnul, when } : null }) }
    const { open, detail } = setup(undefined, undefined, { domain: domainWhen, annulOf: () => annulStub({ banner: bannerStub }) })
    open('d1')
    await screen.findByText('Блок b1')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть плашку' }))
    expect(screen.queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    // та же деталь заново (тот же when) — плашка закрыта
    act(() => { detail.replaceDetail({ id: 'd1', detail: rows[0]! }) })
    expect(screen.queryByText(/Запрос на аннулирование отклонён/)).toBeNull()
    // новый запрос отклонён — другой when: плашка снова видна в том же drawer
    when = '2026-09-25T12:00:00'
    act(() => { detail.replaceDetail({ id: 'd1', detail: { ...rows[0]! } }) })
    expect(screen.getByText('Запрос на аннулирование отклонён · № 417')).toBeInTheDocument()
  })

  it('Prompt аннулирования — в overlay drawer своего документа; F5 при нём — браузеру', async () => {
    const view = actionsStub()
    const { open } = setup(undefined, undefined, {
      domain: annulDomain,
      actionsOf: () => view,
      annulOf: (id) => annulStub({ prompt: (info) => (id === 'd2' && info !== null ? <Prompt open title="Аннулировать документ?" note={info.subject} onResult={vi.fn()} /> : null) }),
    })
    open('d1', false, true)
    open('d2', true, true)
    await waitFor(() => expect(screen.getAllByText('Блок b1')).toHaveLength(2))
    const a = screen.getByRole('dialog', { name: 'Платёжная инструкция № 417' })
    const b = screen.getByRole('dialog', { name: 'Платёжная инструкция № 418' })
    expect(within(a).queryByRole('alertdialog')).toBeNull()
    const prompt = within(b).getByRole('alertdialog', { name: 'Аннулировать документ?' })
    expect(prompt).toHaveAccessibleDescription('№ 418')
    expect(fireEvent.keyDown(within(prompt).getByRole('button', { name: 'Отмена' }), { key: 'F5' })).toBe(true)
    expect(view.run).not.toHaveBeenCalled()
  })

  it('Prompt правки 2c важнее Prompt аннулирования того же документа — один Prompt', async () => {
    const ctx = editStub('d1', { confirm: { title: 'Отменить правку?', okLabel: 'Отменить правку', cancelLabel: 'Продолжить правку', tone: 'danger' } })
    const { open } = setup(undefined, undefined, {
      domain: annulDomain, editOf: () => ctx,
      annulOf: () => annulStub({ prompt: () => <Prompt open title="Аннулировать документ?" onResult={vi.fn()} /> }),
    })
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.getByRole('alertdialog', { name: 'Отменить правку?' })).toBeInTheDocument()
  })
})
