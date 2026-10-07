import { requestFileFx, requestFx } from '../shared/api'
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
