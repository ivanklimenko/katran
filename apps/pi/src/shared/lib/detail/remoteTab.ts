import type { ReactNode } from 'react'
import type { RemoteTabView, TabContext } from './types'

/**
 * Вид удалённой вкладки с типом данных T. Инвариант: data пришли через parseTab того же id вкладки —
 * сущность держит парсеры и виды одной таблицей ключей (контрактный тест), поэтому приведение здесь безопасно.
 */
export function remoteTab<T>(v: { render: (data: T, ctx: TabContext) => ReactNode; skeletonRows?: number | undefined }): RemoteTabView {
  return {
    kind: 'remote',
    render: (data, ctx) => v.render(data as T, ctx),
    ...(v.skeletonRows !== undefined ? { skeletonRows: v.skeletonRows } : {}),
  }
}
