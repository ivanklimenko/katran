import { requestFx } from '../shared/api'
import { browserFakeOptions } from './fake/params'
import { createFakeServer } from './fake/server'
import { fakeGrids } from './fake/grids'

/** Единственная точка подключения транспорта. Внутри здесь — свой клиент: docs/guides/pi-usage.md. */
requestFx.use(createFakeServer(fakeGrids, browserFakeOptions))
