import { useEffect, useRef, type MutableRefObject } from 'react'

/**
 * Для кнопок копирования: снимает таймер вспышки при размонтировании и отдаёт флаг «смонтирован»
 * для проверки после `await copyText`. Без этого запись в стейт снятого компонента —
 * no-op, но React 17 в dev пишет в консоль «state update on an unmounted component».
 */
export function useUnmountGuard(timer: MutableRefObject<number | undefined>) {
  const alive = useRef(true)
  useEffect(() => {
    // Таймер — не DOM-узел: в очистке нужен именно последний запущенный, поэтому читаем .current в момент снятия.
    const t = timer
    alive.current = true
    return () => {
      alive.current = false
      window.clearTimeout(t.current)
    }
  }, [timer])
  return alive
}
