import { useState } from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { TabPanel } from './TabPanel'
import { Tabs, type TabItem } from './Tabs'

// Вкладки валютной деталки стенда (TABS, index.html:647); недоступные — как tabsOff нечётной записи
const FX: TabItem[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
  { id: 'compliance', label: 'Комплаенс' }, { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' },
  { id: 'notif', label: 'Нотификации', disabled: true, hint: 'Нет данных' }, { id: 'source', label: 'Исходный текст' },
  { id: 'stream', label: 'Стриминг', disabled: true, hint: 'Нет данных' }, { id: 'mpu', label: 'MPU', disabled: true, hint: 'Нет данных' },
  { id: 'audit', label: 'Аудит' },
]

// jsdom не считает раскладку: ширины — заглушкой (замер вкладки 100, «•••» 40, разделителя групп 9, полоса — BAR),
// ResizeObserver — синхронный: вызывает колбэк при observe, как первый замер в Chromium; resize() — смена ширины полосы.
// Колбэк получает массив записей, как настоящий: autoUpdate floating-ui (Popover меню) его разбирает.
let BAR = 1000
let observers: SyncResizeObserver[] = []
class SyncResizeObserver {
  cb: (entries: unknown[]) => void
  constructor(cb: (entries: unknown[]) => void) { this.cb = cb; observers.push(this) }
  observe() { this.cb([]) }
  unobserve() {}
  disconnect() { observers = observers.filter((o) => o !== this) }
}
const resize = (w: number) => act(() => { BAR = w; observers.forEach((o) => o.cb([])) })
beforeEach(() => {
  BAR = 1000
  observers = []
  vi.stubGlobal('ResizeObserver', SyncResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    const m = this.getAttribute('data-k-measure')
    return m === '__more' ? 40 : m === '__sep' ? 9 : m ? 100 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => BAR)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Host({ start = 'main', overflow = true }: { start?: string; overflow?: boolean }) {
  const [v, setV] = useState(start)
  return (
    <>
      <Tabs id="dt" label="Разделы документа" items={FX} value={v} onChange={setV} overflow={overflow} variant="line" />
      {FX.map((it) => <TabPanel key={it.id} tabsId="dt" tabId={it.id} active={v === it.id}>Панель {it.label}</TabPanel>)}
    </>
  )
}
const names = () => screen.getAllByRole('tab').map((t) => t.textContent)

describe('Tabs: переполнение (спека 2a §3.1)', () => {
  it('недоступные — второй группой тем же порядком; не поместившиеся — в «••• N»', async () => {
    renderK(<Host />)
    expect(names()).toEqual(['Общие данные', 'Доп. поля', 'Статусы', 'Комплаенс', 'Связанные документы', 'Задачи', 'Исходный текст', 'Аудит', 'Нотификации'])
    expect(screen.getByRole('tab', { name: 'Нотификации' })).toBeDisabled()
    // подсказки на недоступной вкладке полосы нет: disabled не получает событий указателя (R12) — «Нет данных» только в меню
    expect(screen.getByRole('tab', { name: 'Нотификации' })).not.toHaveAttribute('data-k-tip')
    const more = screen.getByRole('button', { name: 'Ещё вкладки: 2' })
    expect(more).toHaveTextContent('••• 2')
    await userEvent.click(more)
    const menu = screen.getByRole('menu', { name: 'Вкладки' })
    expect(within(menu).getAllByRole('menuitem').map((x) => x.textContent)).toEqual(['СтримингНет данных', 'MPUНет данных'])
    expect(within(menu).getByRole('menuitem', { name: /Стриминг/ })).toBeDisabled()
  })

  it('выбранная вкладка всегда видна в полосе', () => {
    BAR = 540
    renderK(<Host start="audit" />)
    expect(names()).toEqual(['Общие данные', 'Доп. поля', 'Статусы', 'Комплаенс', 'Аудит'])
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Ещё вкладки: 6' })).toBeInTheDocument()
  })

  it('разделитель групп входит в расчёт: вкладка, которой не хватает места с ним, уходит в меню', () => {
    // 9 вкладок × 100 + «•••» 40 = 940 ≤ 945, но с разделителем 9 — 949: «Нотификации» уходит в меню
    BAR = 945
    renderK(<Host />)
    expect(names()).toEqual(['Общие данные', 'Доп. поля', 'Статусы', 'Комплаенс', 'Связанные документы', 'Задачи', 'Исходный текст', 'Аудит'])
    expect(screen.getByRole('button', { name: 'Ещё вкладки: 3' })).toBeInTheDocument()
  })

  it('меню не остаётся открытым, когда «•••» пропадает: шире — всё видно, снова уже — меню закрыто', async () => {
    BAR = 540
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: /Ещё вкладки/ }))
    expect(screen.getByRole('menu', { name: 'Вкладки' })).toBeInTheDocument()
    resize(5000)
    expect(screen.queryByRole('button', { name: /Ещё вкладки/ })).toBeNull()
    resize(540)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: /Ещё вкладки/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('выбор из меню — onChange, вкладка встаёт в полосу выбранной', async () => {
    BAR = 540
    renderK(<Host />)
    expect(screen.queryByRole('tab', { name: 'Задачи' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Ещё вкладки/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Задачи' }))
    expect(screen.getByRole('tab', { name: 'Задачи' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('клавиатура: стрелки ходят только по видимым доступным, выбор — Enter', async () => {
    renderK(<Host />)
    screen.getByRole('tab', { name: 'Общие данные' }).focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Общие данные' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    expect(screen.getByRole('tab', { name: 'Аудит' })).toHaveAttribute('aria-selected', 'true')
  })

  it('без overflow — как раньше: порядок как задан, без «•••», корень — tablist', () => {
    const { container } = renderK(<Host overflow={false} />)
    expect(names()).toEqual(FX.map((t) => t.label))
    expect(screen.queryByRole('button', { name: /Ещё вкладки/ })).toBeNull()
    expect(container.querySelector('[data-k-measure]')).toBeNull()
  })

  it('без ResizeObserver (jsdom без заглушки) — все вкладки в полосе', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('ResizeObserver', undefined)
    renderK(<Host />)
    expect(screen.getAllByRole('tab')).toHaveLength(11)
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Host />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
