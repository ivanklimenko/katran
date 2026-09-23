import type { PersistAdapter } from './types'

/** Настройки вида (ширины, порядок, скрытые колонки, размер страницы) — в localStorage. Приватный режим — молча. */
export function localStoragePersist<T>(prefix = 'katran'): PersistAdapter<T> {
  const k = (key: string) => `${prefix}:${key}`
  return {
    load: (key) => {
      try {
        const raw = localStorage.getItem(k(key))
        return raw == null ? undefined : (JSON.parse(raw) as T)
      } catch { return undefined }
    },
    save: (key, value) => {
      try { localStorage.setItem(k(key), JSON.stringify(value)) } catch { /* приватный режим */ }
    },
  }
}

/** Для тестов и SSR. */
export function memoryPersist<T>(): PersistAdapter<T> {
  const m = new Map<string, T>()
  return { load: (key) => m.get(key), save: (key, value) => { m.set(key, value) } }
}
