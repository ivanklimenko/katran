import { vi } from 'vitest'

// Модели страниц подменены: проверяем только порядок вызовов жизненного цикла, без реестров и транспорта.
const log: string[] = []
vi.mock('../pages/fx-docs', () => ({
  lifecycle: { pageOpened: () => log.push('open fx-docs'), pageClosed: () => log.push('close fx-docs') },
}))
vi.mock('../pages/rub-docs', () => ({
  lifecycle: { pageOpened: () => log.push('open rub-docs'), pageClosed: () => log.push('close rub-docs') },
}))

const { parseRoute, startRouting } = await import('./routes')

const goHash = (h: string) => {
  location.hash = h
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

beforeEach(() => {
  log.length = 0
  history.replaceState(null, '', '/')
})

describe('parseRoute', () => {
  it('известный маршрут, пустой и неизвестный hash → fx-docs', () => {
    location.hash = '#/rub-docs'
    expect(parseRoute()).toBe('rub-docs')
    location.hash = ''
    expect(parseRoute()).toBe('fx-docs')
    location.hash = '#/nope'
    expect(parseRoute()).toBe('fx-docs')
  })

  it('хвост ?… внутри hash не мешает маршруту', () => {
    location.hash = '#/rub-docs?fail=search'
    expect(parseRoute()).toBe('rub-docs')
    location.hash = '#rub-docs?x'
    expect(parseRoute()).toBe('rub-docs')
  })
})

describe('startRouting', () => {
  it('старт открывает текущий экран; смена — pageClosed(старый) → pageOpened(новый); тот же маршрут не повторяет', () => {
    location.hash = '#/fx-docs'
    const seen: string[] = []
    const stop = startRouting((r) => seen.push(r))
    expect(log).toEqual(['open fx-docs'])

    goHash('#/rub-docs')
    expect(log).toEqual(['open fx-docs', 'close fx-docs', 'open rub-docs'])

    goHash('#/rub-docs?x=1')
    expect(log).toEqual(['open fx-docs', 'close fx-docs', 'open rub-docs'])
    expect(seen).toEqual(['fx-docs', 'rub-docs'])
    stop()
  })

  it('очистка закрывает текущий экран и снимает слушатель', () => {
    location.hash = '#/rub-docs'
    const seen: string[] = []
    const stop = startRouting((r) => seen.push(r))
    stop()
    expect(log).toEqual(['open rub-docs', 'close rub-docs'])

    goHash('#/fx-docs')
    expect(log).toEqual(['open rub-docs', 'close rub-docs'])
    expect(seen).toEqual(['rub-docs'])
  })
})
