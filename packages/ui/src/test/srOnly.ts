/**
 * Текст только для скринридера: в потоке не виден — абсолютный, обрезан, без переноса (как живая область провайдера).
 * Проверка по вычисленным стилям, а не по имени класса: классы частей кита — классы styled-components.
 */
export function isSrOnly(el: Element): boolean {
  const st = getComputedStyle(el)
  return st.position === 'absolute' && st.overflow === 'hidden' && st.whiteSpace === 'nowrap'
}
