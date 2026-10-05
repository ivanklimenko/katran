import { act, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createEffect, type Effect } from 'effector'
import { FX_TYPES, fxDocDetailDomain, fxDocLayout, fxDocPorts, parseFxDocDetail } from '../entities/fx-doc'
import { RUB_TYPES, parseRubDocDetail, rubDocDetailDomain, rubDocLayout, rubDocPorts } from '../entities/rub-doc'
import { FX_LOCAL_TABS, fxDetailDomain } from '../pages/fx-docs'
import { RUB_LOCAL_TABS, rubDetailDomain } from '../pages/rub-docs'
import { requestFx, type ApiError, type TabQuery } from '../shared/api'
import type { DetailDomain } from '../shared/lib/detail'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createDetail, DocDetail } from '../widgets/doc-detail'
import { makeFxDocs } from './fake/fx-docs.data'
import { makeFxDocDetail } from './fake/fx-docs.detail'
import { fakeGrids } from './fake/grids'
import { makeRubDocs } from './fake/rub-docs.data'
import { makeRubDocDetail } from './fake/rub-docs.detail'
import { createFakeServer } from './fake/server'

// Вкладки 2b — через настоящие порты сущностей на фейке без задержек и регуляторов:
// цепочка «порт → requestFx → фейк → parseTab» та же, что в приложении (vitest изолирует модули по файлам)
requestFx.use(createFakeServer(fakeGrids))

/** Деталка с загруженным документом под axe (спека 2a §6): реальные домен, данные фейка и маппер. */
async function check<D extends { id: string }, Row>(domain: DetailDomain<D, Row>, doc: D, ready: RegExp) {
  const detailFx = createEffect<string, D, ApiError>(async () => doc)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id: doc.id, secondary: false })
  })
  await screen.findByRole('heading', { name: ready })
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

type Ports<D> = { detailFx: Effect<string, D, ApiError>; tabFx: Effect<TabQuery, unknown, ApiError> }

/** Первый документ фейка, у которого вкладка с данными (её нет в tabsOff детали). */
async function docWithTab<D, Row>(ids: string[], ports: Ports<D>, domain: DetailDomain<D, Row>, tab: string): Promise<string> {
  for (const id of ids) if (!domain.summary(await ports.detailFx(id)).tabsOff.includes(tab)) return id
  throw new Error(`В фейке нет документа с вкладкой ${tab}`)
}

/** Вкладка документа под axe (спека 2b §5): домен страницы с tabViews, настоящие порты, фейк, виды doc-trail и fx-doc. */
async function checkTab<D, Row>(domain: DetailDomain<D, Row>, ports: Ports<D>, localTabs: string[], id: string, tab: string) {
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx: ports.detailFx, tabFx: ports.tabFx, localTabs, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id, secondary: false })
  })
  await waitFor(() => expect(document.querySelector('[data-part="hero"]')).not.toBeNull())
  act(() => { detail.setTab({ slot: 'a', tab }) })
  await waitFor(() => expect(detail.$slots.getState().a?.tabView?.state ?? 'ready').toBe('ready'))
  const panel = screen.getByRole('tabpanel')
  await waitFor(() => expect(panel).not.toBeEmptyDOMElement())
  expect(within(panel).queryByRole('alert')).toBeNull()
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

describe('a11y деталки на реальных профилях обоих реестров (спека 2a §6)', () => {
  it('валюта: каждый тип MT', async () => {
    const rows = makeFxDocs()
    for (const t of FX_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      if (i < 0) continue
      await check(fxDocDetailDomain, parseFxDocDetail(makeFxDocDetail(rows[i]!, i, rows), 'ответ'), new RegExp(`^Поля ${t}$`))
    }
  }, 60_000)
  it('рубль: каждый вид документа', async () => {
    const rows = makeRubDocs()
    for (const t of RUB_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      await check(rubDocDetailDomain, parseRubDocDetail(makeRubDocDetail(rows[i]!, i, rows), 'ответ'), /^Отправитель \/ Получатель$/)
    }
  }, 60_000)
})

describe('a11y вкладок деталки на данных фейка (спека 2b §5)', () => {
  it('валюта: каждая вкладка кроме «Общих»', async () => {
    const ids = makeFxDocs().map((r) => fxDocLayout.rowKey(r))
    for (const t of fxDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(fxDetailDomain, fxDocPorts, FX_LOCAL_TABS, await docWithTab(ids, fxDocPorts, fxDetailDomain, t.id), t.id)
    }
  }, 120_000)
  it('рубль: каждая вкладка кроме «Общих»', async () => {
    const ids = makeRubDocs().map((r) => rubDocLayout.rowKey(r))
    for (const t of rubDetailDomain.tabs.filter((x) => x.id !== 'main')) {
      await checkTab(rubDetailDomain, rubDocPorts, RUB_LOCAL_TABS, await docWithTab(ids, rubDocPorts, rubDetailDomain, t.id), t.id)
    }
  }, 120_000)
})
