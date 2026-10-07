/**
 * Ссылка на документ (план 2d, Ruling R5). По умолчанию — адрес текущей страницы с маршрутом грида и ?doc=<id>; хост
 * подменяет строитель один раз при подключении (configureDocLinks), модели берут его в момент копирования (buildDocLink),
 * поэтому подмена действует и на модели, созданные раньше.
 */
export type DocLinkBuilder = (gridId: string, id: string) => string

export function defaultDocLink(gridId: string, id: string): string {
  return `${location.origin}${location.pathname}#/${gridId}?doc=${encodeURIComponent(id)}`
}

let builder: DocLinkBuilder = defaultDocLink

/** Подменить строитель ссылок (слой app хоста); defaultDocLink — вернуть исходный. */
export function configureDocLinks({ build }: { build: DocLinkBuilder }): void {
  builder = build
}

/** Ссылка на документ текущим строителем. */
export function buildDocLink(gridId: string, id: string): string {
  return builder(gridId, id)
}
