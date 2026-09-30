import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery } from '@katran/effector'
import type { RecordLayout, RowState } from '@katran/ui'
import { ApiError } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { createRegistry } from '../lib/createRegistry'
import { DocRegistry } from './DocRegistry'

type Row = { id: string; status: string; name: string; inactive?: boolean }
const layout: RecordLayout<Row> = { rowKey: (r) => r.id, columns: [{ id: 'name', title: 'Имя', render: (r) => r.name }] }

function make(opts: { failSearch?: boolean; meta?: FilterMeta | null; rows?: Row[] } = {}) {
  let fail = opts.failSearch ?? false
  const rows = opts.rows ?? [{ id: 'a', status: 'ERROR', name: 'Альфа' }]
  const ports = {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => {
      if (fail) throw new ApiError(500, null, 'Сбой сервера')
      return { rows, total: rows.length }
    }),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => [{ value: 'ERROR', count: 1 }]),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => {
      if (opts.meta === null) return new Promise<FilterMeta>(() => {}) // каталог не приходит
      return opts.meta ?? { fields: [{ id: 'name', label: 'Имя', type: 'STRING', ops: [] }] }
    }),
  }
  const lifecycle = createPageLifecycle()
  const registry = createRegistry({ id: `t-${Math.random()}`, layout, ports, lifecycle, persist: memoryPersist() })
  return { registry, lifecycle, heal: () => { fail = false } }
}

describe('DocRegistry', () => {
  it('после pageOpened: заголовок со счётчиком, лейн с фасетами, запись; без нарушений axe', async () => {
    const { registry, lifecycle } = make()
    const { container } = renderK(<DocRegistry registry={registry} layout={layout} title="Валютные документы" describe={(r) => `документ ${r.name}`} />)
    act(() => { lifecycle.pageOpened() })
    expect(await screen.findByText('Альфа')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Валютные документы/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Статусы' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveTextContent('1'))
    expect(await axe(container)).toHaveNoViolations()
  })
  it('пока каталога нет — кнопка «Фильтры» недоступна, лейн работает', async () => {
    const { registry, lifecycle } = make({ meta: null })
    renderK(<DocRegistry registry={registry} layout={layout} title="Реестр" describe={(r) => r.name} />)
    act(() => { lifecycle.pageOpened() })
    await screen.findByText('Альфа')
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeDisabled()
  })
  it('ошибка запроса — alert с текстом ApiError; «Повторить» снимает', async () => {
    const { registry, lifecycle, heal } = make({ failSearch: true })
    renderK(<DocRegistry registry={registry} layout={layout} title="Реестр" describe={(r) => r.name} />)
    act(() => { lifecycle.pageOpened() })
    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent('Сбой сервера')
    heal()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Альфа')).toBeInTheDocument()
  })
  it('R13: строка «Документ не открыт» меняется после открытия записи (обычной и заблокированной)', async () => {
    const rows: Row[] = [{ id: 'a', status: 'ERROR', name: 'Альфа' }, { id: 'b', status: 'ERROR', name: 'Бета' }]
    const { registry, lifecycle } = make({ rows })
    renderK(
      <DocRegistry
        registry={registry}
        layout={layout}
        title="Реестр"
        describe={(r) => `документ ${r.name}`}
        rowState={(r): RowState => (r.id === 'b' ? { kind: 'locked', who: 'Иван', since: '2026-09-29T10:00:00Z' } : null)}
      />,
    )
    act(() => { lifecycle.pageOpened() })
    await screen.findByText('Альфа')
    expect(screen.getByText('Документ не открыт')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть запись 1' }))
    expect(await screen.findByText('Открыт документ Альфа')).toBeInTheDocument()
    expect(screen.queryByText('Документ не открыт')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Заблокирована/ }))
    expect(await screen.findByText('Открыт документ Бета (только просмотр)')).toBeInTheDocument()
  })
  it('R13: BulkBar allNote «без неактивных» — если на странице есть неактивная запись', async () => {
    const rows: Row[] = [{ id: 'a', status: 'ERROR', name: 'Альфа' }, { id: 'b', status: 'ERROR', name: 'Бета', inactive: true }]
    const { registry, lifecycle } = make({ rows })
    renderK(
      <DocRegistry
        registry={registry}
        layout={layout}
        title="Реестр"
        describe={(r) => r.name}
        rowState={(r): RowState => (r.inactive ? { kind: 'inactive', why: 'аннулирован' } : null)}
      />,
    )
    act(() => { lifecycle.pageOpened() })
    await screen.findByText('Альфа')
    // выбрать одну запись (не все) — доступна «Выбрать все N по фильтру»; жмём её, чтобы перейти в режим all и увидеть allNote в тексте полосы
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать запись 1' }))
    await userEvent.click(screen.getByRole('button', { name: /Выбрать все \d+ по фильтру/ }))
    expect(screen.getByRole('region', { name: 'Массовые действия' })).toHaveTextContent('без неактивных')
  })
})
