import { fxDocLayout, fxEditableTargets, validateFxEdit, type FxDoc, type FxDocDetail } from '../../entities/fx-doc'
import type { EditValue } from '../../shared/api'
import { rubDocLayout } from '../../entities/rub-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { annulSeedsOf, createAnnulStore } from './annul'
import { createFxEditStore, type FakeEditStore } from './edits'
import { edMessage, pdfForm, swiftMessage } from './files'
import { fakeGrid, type FakeGrid } from './grid'
import { ratesOf } from './lookups'
import { createNotifStore } from './notif'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { rubDocsMeta, makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'

/**
 * Хранилище правок валюты: бек повторяет правила фронта и цели профиля (план 2c §3.6) — одни функции домена, без своей копии.
 * У сырой детали фейка edits нет (правки — в памяти хранилища), цели считаются по ней.
 */
export const createFxDocsEditStore = (seedId: string | null, accKtSeedId: string | null = null): FakeEditStore => createFxEditStore({
  seedId,
  accKtSeedId,
  validate: (target, now) => validateFxEdit(target, now as EditValue),
  targets: (detail) => fxEditableTargets({ edits: {}, ...detail } as unknown as FxDocDetail),
})

/** Коды печатных форм по профилям (pi-api.md §1.10): валюта — три формы, рубль — четыре; форма вне набора — 404. */
const FX_PRINT_FORMS = ['payment-order', 'memorial-order', 'swift-form'] as const
const RUB_PRINT_FORMS = ['payment-order', 'collection-order', 'payment-ordr', 'memorial-order'] as const

/** Сиды правок валюты: поле 57 — первый документ с полем 57 (первый в реестре — MT199, Ruling: makeFxDocs()[1]); Кт — второй MT103 в USD без блокировки (первый такой — документ примеров pi-api.md). */
export const editSeedIdsOf = (fx: readonly FxDoc[]): { seedId: string | null; accKtSeedId: string | null } => ({
  seedId: fx.find((r) => r.type !== 'MT199')?.id ?? null,
  accKtSeedId: fx.filter((r) => r.type === 'MT103' && r.currency === 'USD' && r.lock === null && r.inactive === null)[1]?.id ?? null,
})

/**
 * Первая нотификация сида с телом `text/plain` (проверка языка «текст»): последняя строка (`n3`) первого валютного документа с нотификациями.
 * Нотификации валюты — у завершённых документов (DONE, EXPORTED), см. fx-docs.trail.ts.
 */
export const plainNotifOf = (fx: readonly FxDoc[]): { docId: string; nid: string } | null => {
  const row = fx.find((r) => r.status === 'DONE' || r.status === 'EXPORTED')
  return row ? { docId: row.id, nid: 'n3' } : null
}

/**
 * Гриды фейка. Правки валюты живут в памяти своего набора: приложению — один набор на сессию (fakeGrids),
 * тестам — свежий на тест (createFakeGrids), чтобы правки одного теста не видел другой (preflight D8). То же — аннулирование
 * и переотправка нотификаций (срез 2e).
 */
export function createFakeGrids(): Record<string, FakeGrid> {
  const fx = makeFxDocs()
  const rub = makeRubDocs()
  const { seedId, accKtSeedId } = editSeedIdsOf(fx)
  const fxAnnul = annulSeedsOf(fx, [seedId, accKtSeedId])
  const rubAnnul = annulSeedsOf(rub, [], 0)
  return {
    'fx-docs': fakeGrid(fx, fxDocLayout.columns, fxDocsMeta, {
      sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail, tabs: { ids: FX_TRAIL_TABS, data: fxDocTrail },
      edits: createFxDocsEditStore(seedId, accKtSeedId),
      files: { message: (d) => ({ text: swiftMessage(d), ext: 'txt' }), forms: FX_PRINT_FORMS, print: pdfForm },
      annul: createAnnulStore({ pendingId: fxAnnul.pending, doneId: fxAnnul.done }),
      rates: ratesOf, balances: true,
      notif: createNotifStore({ format: 'json', plain: plainNotifOf(fx) }),
    }),
    'rub-docs': fakeGrid(rub, rubDocLayout.columns, rubDocsMeta, {
      sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail, tabs: { ids: RUB_TRAIL_TABS, data: rubDocTrail },
      files: { message: (d) => ({ text: edMessage(d), ext: 'xml' }), forms: RUB_PRINT_FORMS, print: pdfForm },
      annul: createAnnulStore({ pendingId: rubAnnul.pending }),
      balances: true,
      notif: createNotifStore({ format: 'xml' }),
    }),
  }
}

export const fakeGrids: Record<string, FakeGrid> = createFakeGrids()
