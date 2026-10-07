import { vi } from 'vitest'

// Модели страниц подменены: проверяем только порядок вызовов жизненного цикла, без реестров и транспорта.
const log: string[] = []
vi.mock('../pages/fx-docs', () => ({
  lifecycle: { pageOpened: () => log.push('open fx-docs'), pageClosed: () => log.push('close fx-docs') },
  docLinkOpened: (id: string) => log.push(`link fx-docs ${id}`),
}))
vi.mock('../pages/rub-docs', () => ({
  lifecycle: { pageOpened: () => log.push('open rub-docs'), pageClosed: () => log.push('close rub-docs') },
  docLinkOpened: (id: string) => log.push(`link rub-docs ${id}`),
}))

const { parseDocParam, parseRoute, startRouting } = await import('./routes')

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

describe('parseDocParam', () => {
  it('doc из хвоста hash раскодирован; без doc и с пустым — null', () => {
    location.hash = '#/fx-docs?doc=a%2Fb'
    expect(parseDocParam()).toBe('a/b')
    location.hash = '#/rub-docs?fail=search&doc=r%201'
    expect(parseDocParam()).toBe('r 1')
    location.hash = '#/fx-docs'
    expect(parseDocParam()).toBeNull()
    location.hash = '#/fx-docs?doc='
    expect(parseDocParam()).toBeNull()
    location.hash = '#/fx-docs?x=1'
    expect(parseDocParam()).toBeNull()
  })
})

describe('startRouting', () => {
  it('?doc= — после pageOpened docLinkOpened экрана маршрута; doc в адресе остаётся', () => {
    location.hash = '#/rub-docs?doc=a%2Fb'
    const stop = startRouting(() => {})
    expect(log).toEqual(['open rub-docs', 'link rub-docs a/b'])
    expect(location.hash).toBe('#/rub-docs?doc=a%2Fb')
    stop()
  })

  it('новая ссылка на том же экране открывает документ; та же ссылка и смена прочего хвоста — нет', () => {
    location.hash = '#/fx-docs'
    const stop = startRouting(() => {})
    goHash('#/fx-docs?doc=u1')
    goHash('#/fx-docs?doc=u1&x=1')
    goHash('#/fx-docs?doc=u2')
    expect(log).toEqual(['open fx-docs', 'link fx-docs u1', 'link fx-docs u2'])
    goHash('#/rub-docs?doc=u2')
    expect(log.slice(3)).toEqual(['close fx-docs', 'open rub-docs', 'link rub-docs u2'])
    stop()
  })

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
