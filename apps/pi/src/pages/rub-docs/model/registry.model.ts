import { createEvent, createStore, sample } from 'effector'
import { rubDocLayout, rubDocPorts } from '../../../entities/rub-doc'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { createRegistry } from '../../../widgets/doc-registry'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'rub-docs', layout: rubDocLayout, ports: rubDocPorts, lifecycle })
/** Вкладки рубля с данными в детали — только «Общие данные» (спека 2b §3.1); «Доп. полей» у рубля нет. */
export const RUB_LOCAL_TABS = ['main']
/** Деталка экрана — на том же жизненном цикле (спека 2a §5, 2b §3.3); вкладки кроме «Общих» — лениво через tabFx. */
export const detail = createDetail({ detailFx: rubDocPorts.detailFx, tabFx: rubDocPorts.tabFx, localTabs: RUB_LOCAL_TABS, lifecycle })
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
sample({ clock: firstRow, fn: (row) => ({ id: rubDocLayout.rowKey(row), secondary: false, quiet: true }), target: detail.open })
