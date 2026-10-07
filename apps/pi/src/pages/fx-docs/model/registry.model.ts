import { createEvent, createStore, sample } from 'effector'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { createRegistry } from '../../../widgets/doc-registry'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
/** Вкладки валюты с данными в детали — без своего запроса (спека 2b §3.1): «Общие данные» и «Доп. поля». */
export const FX_LOCAL_TABS = ['main', 'extra']
/**
 * Деталка экрана — на том же жизненном цикле: уход с экрана закрывает оба drawer'а, чистит кэш детали и вкладок
 * и раскрытое (спека 2a §5, 2b §3.3). Остальные вкладки — лениво через tabFx.
 * guard — охрана ухода (план 2c, Р6): закрытие и замена документа идут через leaveRequested; ответ даёт модель правки
 * (edit.model.ts — без неё деталка не закрывается).
 */
export const detail = createDetail({ detailFx: fxDocPorts.detailFx, tabFx: fxDocPorts.tabFx, localTabs: FX_LOCAL_TABS, lifecycle, guard: true })
// реестр о деталке не знает: открытие — через шов openRequested (спека apps/pi §7, спека 2a §4.4)
sample({ clock: registry.openRequested, target: detail.open })

// В-Д4: при первом ответе реестра после входа на экран первая запись открывается в A (эталон grid.html:2192);
// quiet — открытие не пользователем: фокус остаётся в реестре (R10)
const $autoOpened = createStore(false).reset(lifecycle.pageClosed)

/**
 * Документ по ссылке ?doc= (спека 2d §3.6, §4 п. 6): роутер стенда (адаптер хоста) зовёт после pageOpened. Открытие в A
 * пользовательское (не quiet) — фокус в drawer; первая запись реестра в этом визите уже не открывается и его не вытесняет
 * (Review Focus 1). На закрытом экране не действует.
 */
export const docLinkOpened = createEvent<string>()
const linked = sample({ clock: docLinkOpened, source: lifecycle.$opened, filter: (opened) => opened, fn: (_, id) => id })
$autoOpened.on(linked, () => true)
sample({ clock: linked, fn: (id) => ({ id, secondary: false }), target: detail.open })
const firstRow = sample({
  clock: registry.grid.$rows.updates,
  source: { done: $autoOpened, opened: lifecycle.$opened },
  filter: ({ done, opened }, rows) => opened && !done && rows.length > 0,
  fn: (_, rows) => rows[0]!,
})
$autoOpened.on(firstRow, () => true)
sample({ clock: firstRow, fn: (row) => ({ id: fxDocLayout.rowKey(row), secondary: false, quiet: true }), target: detail.open })
