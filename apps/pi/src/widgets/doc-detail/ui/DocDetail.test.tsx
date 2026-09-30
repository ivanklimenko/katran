import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { ApiError } from '../../../shared/api'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createDetail } from '../lib/createDetail'
import { DocDetail } from './DocDetail'

// Синтетический домен: виджет не знает сущностей — всё доменное приходит объектом DetailDomain
type Doc = { id: string; num: string; ref: string }
const rows: Doc[] = [{ id: 'd1', num: '417', ref: 'FX2609220000417' }, { id: 'd2', num: '418', ref: 'FX2609220000418' }]
const sum = (d: Doc, tabsOff: string[]): DetailSummary => ({
  label: `Платёжная инструкция № ${d.num}`, uuid: `uuid-${d.id}`, created: '22.09.2026 07:31:45', type: 'MT103',
  status: { tone: 'ok', label: 'Обработан' }, kind: 'Клиентский перевод · входящий', tabsOff,
})
const domain: DetailDomain<Doc, Doc> = {
  title: 'Платёжная инструкция',
  tabs: [{ id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'audit', label: 'Аудит' }],
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
}

function setup(handler: (id: string) => Promise<Doc> = async (id) => rows.find((r) => r.id === id)!) {
  const detailFx = createEffect<string, Doc, ApiError>(handler)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const utils = renderK(
    <>
      <button type="button">Кнопка открытия</button>
      <DocDetail detail={detail} domain={domain} rowOf={(id) => rows.find((r) => r.id === id) ?? null} returnFocus={() => screen.queryByText('Кнопка открытия')} />
    </>,
  )
  act(() => { lifecycle.pageOpened() })
  const open = (id: string, secondary = false, quiet?: boolean) => act(() => { detail.open(quiet ? { id, secondary, quiet } : { id, secondary }) })
  return { ...utils, open }
}
const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))

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

  it('вкладки: без данных — недоступна; другая — «будет в срезе 2b»', async () => {
    const { open } = setup()
    open('d1')
    await screen.findByText('Блок b1')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toBeDisabled()
    await userEvent.click(screen.getByRole('tab', { name: 'Доп. поля' }))
    expect(screen.getByRole('tab', { name: 'Доп. поля' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Вкладка «Доп. поля» — будет в срезе 2b')).toBeInTheDocument()
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
