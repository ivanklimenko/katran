import { useEffect, useState } from 'react'

export type Route = 'tokens' | 'buttons' | 'inputs' | 'values' | 'overlays' | 'states' | 'pagination' | 'tabs'
export const routes: { id: Route; title: string }[] = [
  { id: 'tokens', title: 'Токены' },
  { id: 'buttons', title: 'Кнопки' },
  { id: 'inputs', title: 'Поля ввода' },
  { id: 'values', title: 'Значения' },
  { id: 'overlays', title: 'Меню и поповеры' },
  { id: 'states', title: 'Состояния' },
  { id: 'pagination', title: 'Пагинация' },
  { id: 'tabs', title: 'Табы' },
]
const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '') as Route
  return routes.some((r) => r.id === h) ? h : 'tokens'
}
export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
