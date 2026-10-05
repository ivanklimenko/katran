import { act, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { memoryPersist, type Facet, type FacetsQuery, type FilterMeta, type GridPage, type GridQuery, type SuggestQuery } from '@katran/effector'
import type { GridPorts } from '../shared/api'
import { ApiError, fromFilterMetaResponse } from '../shared/api'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createRegistry, DocRegistry } from '../widgets/doc-registry'
import { fxDocLayout, type FxDoc } from '../entities/fx-doc'
import { rubDocLayout, type RubDoc } from '../entities/rub-doc'
import { fxDocsMeta, makeFxDocs } from './fake/fx-docs.data'
import { rubDocsMeta, makeRubDocs } from './fake/rub-docs.data'

/** Порты-заглушка: страница результатов без сети (как в DocRegistry.test.tsx), реальные раскладка/данные/каталог. */
function stubPorts<Row>(rows: Row[], meta: FilterMeta): GridPorts<Row> {
  return {
    searchFx: createEffect<GridQuery, GridPage<Row>, ApiError>(async () => ({ rows, total: rows.length })),
    facetsFx: createEffect<FacetsQuery, Facet[], ApiError>(async () => []),
    suggestFx: createEffect<SuggestQuery, string[], ApiError>(async () => []),
    filterMetaFx: createEffect<void, FilterMeta, ApiError>(async () => meta),
  }
}

/**
 * Спека §10: DocRegistry под renderK + axe — для обоих реестров, с боевой раскладкой и данными (не
 * только с синтетической одноколоночной раскладкой DocRegistry.test.tsx). Находка ревью — этих тестов
 * не было.
 */
describe('a11y обоих реестров (спека §10)', () => {
  it('валютные документы — без нарушений axe', async () => {
    // 20 строк боевой раскладки — axe на полном DOM грида дольше стандартных 5 с
    const rows = makeFxDocs().slice(0, 20)
    const ports = stubPorts<FxDoc>(rows, fromFilterMetaResponse(fxDocsMeta))
    const lifecycle = createPageLifecycle()
    const registry = createRegistry({ id: 'a11y-fx-docs', layout: fxDocLayout, ports, lifecycle, persist: memoryPersist() })
    const { container } = renderK(
      <DocRegistry
        registry={registry}
        layout={fxDocLayout}
        title="Валютные документы"
        describe={(d) => `документ ${d.docNumber}`}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
      />,
    )
    act(() => { lifecycle.pageOpened() })
    const grid = await screen.findByRole('grid', { name: 'Валютные документы' })
    await waitFor(() => expect(grid).not.toHaveAttribute('aria-busy', 'true'))
    expect(await axe(container)).toHaveNoViolations()
  }, 20_000)

  it('рублёвые документы — без нарушений axe', async () => {
    // 20 строк боевой раскладки — axe на полном DOM грида дольше стандартных 5 с
    const rows = makeRubDocs().slice(0, 20)
    const ports = stubPorts<RubDoc>(rows, fromFilterMetaResponse(rubDocsMeta))
    const lifecycle = createPageLifecycle()
    const registry = createRegistry({ id: 'a11y-rub-docs', layout: rubDocLayout, ports, lifecycle, persist: memoryPersist() })
    const { container } = renderK(
      <DocRegistry
        registry={registry}
        layout={rubDocLayout}
        title="Рублёвые документы"
        describe={(d) => `документ ${d.docNumber}`}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
      />,
    )
    act(() => { lifecycle.pageOpened() })
    const grid = await screen.findByRole('grid', { name: 'Рублёвые документы' })
    await waitFor(() => expect(grid).not.toHaveAttribute('aria-busy', 'true'))
    expect(await axe(container)).toHaveNoViolations()
  }, 20_000)
})
