/**
 * Переходы в блоки хоста (срез 2e, §4 п. 9). Приложение само не знает адресов чужих блоков метаприложения («Ручные отклонения»):
 * хост задаёт строители ссылок один раз при подключении (configureHostLinks, слой app), вкладки берут ссылку в момент отрисовки
 * (hostLink). Нет строителя — ссылки нет, вкладка показывает недоступную кнопку с подсказкой HOST_LINK_MISSING.
 */
export type HostLinks = { manualDeviations?: ((docId: string) => string) | undefined }

let links: HostLinks = {}

/** Заменить набор строителей целиком; configureHostLinks({}) — снять все ссылки. */
export function configureHostLinks(next: HostLinks): void {
  links = next
}

/** Ссылка хоста на блок для документа; null — хост не настроил переход. */
export function hostLink(kind: keyof HostLinks, docId: string): string | null {
  const build = links[kind]
  return build ? build(docId) : null
}

export const HOST_LINK_MISSING = 'Переход не настроен для этого стенда'
