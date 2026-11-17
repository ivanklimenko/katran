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
  it('поздняя отмена клика на window не открывает документ', async () => {
    history.replaceState(null, '', '/#/fx-docs?doc=u1')
    const stop = startRouting(() => {})
    const link = document.createElement('a')
    link.href = location.href
    document.body.append(link)
    const cancel = (event: MouseEvent) => event.preventDefault()
    window.addEventListener('click', cancel)
    try {
      link.click()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open fx-docs', 'link fx-docs u1'])
    } finally { window.removeEventListener('click', cancel); stop(); link.remove() }
  })

  it('stop отменяет отложенное открытие до завершения обработки клика', async () => {
    history.replaceState(null, '', '/#/fx-docs?doc=u1')
    const stop = startRouting(() => {})
    const link = document.createElement('a')
    link.href = location.href
    document.body.append(link)
    try {
      link.click()
      stop()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open fx-docs', 'link fx-docs u1', 'close fx-docs'])
    } finally { stop(); link.remove() }
  })

  it('target="" не наследует base, отсутствующий target берётся из первого base[target]', async () => {
    history.replaceState(null, '', '/#/rub-docs?doc=r1')
    const stop = startRouting(() => {})
    const noTarget = document.createElement('base')
    const blank = document.createElement('base')
    blank.target = '_blank'
    document.head.append(noTarget, blank)
    const link = document.createElement('a')
    link.href = location.href
    link.target = ''
    document.body.append(link)
    try {
      link.click()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open rub-docs', 'link rub-docs r1', 'link rub-docs r1'])
      link.removeAttribute('target')
      link.click()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open rub-docs', 'link rub-docs r1', 'link rub-docs r1'])
    } finally { stop(); link.remove(); noTarget.remove(); blank.remove() }
  })

  it('повторный явный переход по тому же адресу снова открывает документ, включая клик по вложенному элементу ссылки', async () => {
    history.replaceState(null, '', '/#/fx-docs?doc=u1')
    const stop = startRouting(() => {})
    const link = document.createElement('a')
    link.href = location.href
    const text = document.createElement('span')
    link.append(text)
    document.body.append(link)
    try {
      text.click()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open fx-docs', 'link fx-docs u1', 'link fx-docs u1'])
      stop()
      text.click()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open fx-docs', 'link fx-docs u1', 'link fx-docs u1', 'close fx-docs'])
    } finally { stop(); link.remove() }
  })

  it('отменённый клик, модификаторы, другая вкладка и download не открывают документ в текущем экране', async () => {
    history.replaceState(null, '', '/#/rub-docs?doc=r1')
    const stop = startRouting(() => {})
    const link = document.createElement('a')
    link.href = location.href
    document.body.append(link)
    try {
      for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...options }))
      }
      link.target = '_blank'
      link.click()
      link.target = ''
      link.download = 'document'
      link.click()
      link.removeAttribute('download')
      const cancelled = new MouseEvent('click', { bubbles: true, cancelable: true })
      cancelled.preventDefault()
      link.dispatchEvent(cancelled)
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(log).toEqual(['open rub-docs', 'link rub-docs r1'])
    } finally { stop(); link.remove() }
  })

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
