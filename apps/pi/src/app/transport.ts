import { requestFileFx, requestFx } from '../shared/api'
import { configureHostLinks } from '../shared/lib/host-links'
import { browserFakeOptions } from './fake/params'
import { createFakeServer } from './fake/server'
import { createFakeFileServer } from './fake/files'
import { fakeGrids } from './fake/grids'

/** Единственная точка подключения транспорта. Внутри здесь — свой клиент: docs/guides/pi-usage.md. */
requestFx.use(createFakeServer(fakeGrids, browserFakeOptions))
requestFileFx.use(createFakeFileServer(fakeGrids, {
  delayMs: browserFakeOptions.delayMs,
  failing: browserFakeOptions.failing,
  observe: (req) => browserFakeOptions.observe?.({ method: 'GET', url: req.url }),
}))
// Ссылка на документ (кнопка лейна «Скопировать ссылку»): стенд оставляет defaultDocLink — адрес страницы с #/<грид>?doc=<id>.
// Хост подменяет строитель здесь же, рядом со своим транспортом, под свою маршрутизацию (docs/guides/pi-usage.md):
//   configureDocLinks({ build: (gridId, id) => `${hostOrigin}/pi/${gridId}?doc=${encodeURIComponent(id)}` })
// (configureDocLinks — из shared/lib/doc-link). Вход по ссылке хост передаёт странице: docLinkOpened(id) после pageOpened.
// Переходы в блоки хоста («Перейти в блок «Ручные отклонения»» на вкладке «Задачи»): по умолчанию их нет — кнопка недоступна с подсказкой.
// Хост задаёт строители рядом со своим транспортом (docs/guides/pi-usage.md), под свою маршрутизацию:
//   configureHostLinks({ manualDeviations: (docId) => `${hostOrigin}/manual-deviations?doc=${encodeURIComponent(docId)}` })
// (configureHostLinks — из shared/lib/host-links). Стенд включает ссылку регулятором ?hostlinks=1 (адрес — страница стенда с #/manual-deviations).
if (new URLSearchParams(location.search).get('hostlinks') === '1') {
  configureHostLinks({
    manualDeviations: (id) => `${location.origin}${location.pathname}#/manual-deviations?doc=${encodeURIComponent(id)}`,
  })
}
